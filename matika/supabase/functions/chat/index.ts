// @ts-nocheck
// supabase/functions/chat/index.ts
// Deno Edge Function: proxy na Claude (Anthropic Messages API)
//
// Bezpečnost: gateway pustí i veřejný anon klíč (je to platný JWT), proto
// funkce sama ověří, že token patří přihlášenému uživateli, a hlídá jeho
// denní limit (tabulka ai_pouziti, migrace 008).
//
// Secrets: ANTHROPIC_API_KEY (povinný), ANTHROPIC_MODEL (volitelný, výchozí claude-haiku-5-5),
//          AI_DENNI_LIMIT (volitelný, výchozí 200 požadavků na uživatele a den).
//          SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY doplňuje Supabase sám.
//
// Klient posílá { messages, max_tokens?, effort? } — messages ve tvaru
// [{ role: 'system'|'user'|'assistant', content: string }]. Systémové zprávy
// se spojí do parametru `system`. Odpověď: { text, stop_reason, model }.

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const MODEL         = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-5-5";

// Záložní model při odmítnutí umí jen Opus 5 / 5.5, Fable 5 / 5.1 a Sonnet 5.5;
// Haiku 5.5 ho nemá a parametr `fallbacks` se mu posílat nemá.
const MA_FALLBACK = /^claude-(opus-5|fable-5|sonnet-5-5)/.test(MODEL);

// Strop výstupu (včetně přemýšlení modelu) — chrání proti drahým požadavkům
const MAX_TOKENS_STROP = 8000;
const EFFORT_POVOLENE  = new Set(["low", "medium", "high"]);

// Strop vstupu — aplikace posílá nejvýš pár desítek zpráv a jednotky tisíc znaků;
// cokoli většího není kouč, ale pokus použít funkci jako obecný chatbot
const MAX_ZPRAV = 80;
const MAX_ZNAKU = 60000;

// Denní limit požadavků na uživatele (sada 5 úloh + koučování ≈ 30–60 požadavků)
const DENNI_LIMIT = Math.max(1, Number(Deno.env.get("AI_DENNI_LIMIT")) || 200);

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin":  allowedOrigin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey",
  "Access-Control-Max-Age":       "86400",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function chyba(message: string, status: number, code?: string): Response {
  return jsonResponse({ error: { message, ...(code ? { code } : {}) } }, status);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return chyba("Method not allowed", 405);
  }

  // Token musí patřit přihlášenému uživateli — anon klíč (veřejný, je v config.js)
  // sice projde gateway, ale getUser() pro něj žádného uživatele nevrátí
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return chyba("Chybí autorizační hlavička", 401);
  }
  const { data: authData, error: authError } = await admin.auth.getUser(authHeader.slice(7));
  const userId = authData?.user?.id;
  if (authError || !userId) {
    return chyba("Pro AI kouče se musíš přihlásit.", 401);
  }

  let body: {
    messages: Array<{ role: string; content: string }>;
    max_tokens?: number;
    effort?: string;
  };

  try {
    body = await req.json();
  } catch {
    return chyba("Neplatné JSON tělo", 400);
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return chyba("Pole messages nesmí být prázdné", 400);
  }
  const znaku = body.messages.reduce((n, m) => n + String(m?.content ?? "").length, 0);
  if (body.messages.length > MAX_ZPRAV || znaku > MAX_ZNAKU) {
    return chyba("Požadavek je příliš dlouhý", 413);
  }

  if (!Deno.env.get("ANTHROPIC_API_KEY")) {
    return chyba("Anthropic klíč není nakonfigurován", 500);
  }

  // OpenAI-style historie → system + user/assistant zprávy
  const system = body.messages
    .filter((m) => m.role === "system")
    .map((m) => String(m.content))
    .join("\n\n");
  const messages = body.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: String(m.content) }));

  if (messages.length === 0 || messages[0].role !== "user") {
    return chyba("Konverzace musí začínat zprávou uživatele", 400);
  }

  // Denní limit — rezervace je atomická, souběžné požadavky ho nepřekročí
  const { data: pocet, error: limitError } = await admin.rpc("ai_zarezervuj", {
    p_user: userId, p_limit: DENNI_LIMIT,
  });
  if (limitError) {
    console.error("Kontrola limitu selhala:", limitError.message);
    return chyba("AI je teď nedostupná, zkus to za chvíli", 503);
  }
  if (pocet === null) {
    return chyba(
      "Dnešní limit AI kouče je vyčerpaný. Zítra bude zase k dispozici.",
      429, "denni_limit",
    );
  }

  const maxTokens = Math.min(Math.max(Number(body.max_tokens) || 4000, 256), MAX_TOKENS_STROP);
  const effort    = EFFORT_POVOLENE.has(body.effort ?? "") ? body.effort : "medium";

  try {
    const params = {
      model:         MODEL,
      max_tokens:    maxTokens,
      output_config: { effort },
      // Systémový prompt kouče je v rámci jedné úlohy stejný → cache
      cache_control: { type: "ephemeral" },
      ...(system ? { system } : {}),
      messages,
    };

    // Při odmítnutí bezpečnostním klasifikátorem zkusí API jiný model (jen kde je podporováno)
    const response = MA_FALLBACK
      ? await client.beta.messages.create({
          ...params,
          betas:     ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        })
      : await client.messages.create(params);

    const u = response.usage ?? {};
    const vstup = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    const { error: zapisError } = await admin.rpc("ai_zapis_tokeny", {
      p_user: userId, p_vstup: vstup, p_vystup: u.output_tokens ?? 0,
    });
    if (zapisError) console.warn("Zápis tokenů selhal:", zapisError.message);

    if (response.stop_reason === "refusal") {
      return chyba("Model odmítl odpovědět", 422);
    }

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!text) {
      // Typicky stop_reason "max_tokens" — model nestihl odpovědět
      return chyba(`Prázdná odpověď modelu (${response.stop_reason})`, 502);
    }

    return jsonResponse({
      text, stop_reason: response.stop_reason, model: response.model,
      zbyva: Math.max(0, DENNI_LIMIT - pocet),
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return chyba("Příliš mnoho požadavků, zkus to za chvíli", 429);
    } else if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}:`, error.message);
      return chyba(`AI není dostupná (${error.status ?? "síť"})`, 502);
    }
    console.error("Neočekávaná chyba:", error);
    return chyba("Neočekávaná chyba serveru", 500);
  }
});
