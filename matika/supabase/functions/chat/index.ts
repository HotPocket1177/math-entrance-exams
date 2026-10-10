// @ts-nocheck
// supabase/functions/chat/index.ts
// Deno Edge Function: proxy na Claude (Anthropic Messages API)
// Auth je ověřena Supabase gateway (invalid: null v request logu)
//
// Secrets: ANTHROPIC_API_KEY (povinný), ANTHROPIC_MODEL (volitelný, výchozí claude-opus-5-5)
//
// Klient posílá { messages, max_tokens?, effort? } — messages ve tvaru
// [{ role: 'system'|'user'|'assistant', content: string }]. Systémové zprávy
// se spojí do parametru `system`. Odpověď: { text, stop_reason, model }.

import Anthropic from "npm:@anthropic-ai/sdk";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const MODEL         = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-opus-5-5";

// Strop výstupu (včetně přemýšlení modelu) — chrání proti drahým požadavkům
const MAX_TOKENS_STROP = 8000;
const EFFORT_POVOLENE  = new Set(["low", "medium", "high"]);

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

function chyba(message: string, status: number): Response {
  return jsonResponse({ error: { message } }, status);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return chyba("Method not allowed", 405);
  }

  // Vyžadujeme Authorization header — bez něj request zamítneme
  // (Supabase gateway už JWT ověřila, tato kontrola jen brání anonymním voláním)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return chyba("Chybí autorizační hlavička", 401);
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

  const maxTokens = Math.min(Math.max(Number(body.max_tokens) || 4000, 256), MAX_TOKENS_STROP);
  const effort    = EFFORT_POVOLENE.has(body.effort ?? "") ? body.effort : "medium";

  try {
    const response = await client.beta.messages.create({
      model:         MODEL,
      max_tokens:    maxTokens,
      output_config: { effort },
      // Systémový prompt kouče je v rámci jedné úlohy stejný → cache
      cache_control: { type: "ephemeral" },
      ...(system ? { system } : {}),
      messages,
      // Při odmítnutí bezpečnostním klasifikátorem zkusí API jiný model
      betas:         ["server-side-fallback-2026-07-01"],
      fallbacks:     "default",
    });

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

    return jsonResponse({ text, stop_reason: response.stop_reason, model: response.model });
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
