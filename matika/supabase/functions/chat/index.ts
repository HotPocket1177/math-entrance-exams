// supabase/functions/chat/index.ts
// Deno Edge Function: proxy na OpenAI
// Auth je ověřena Supabase gateway (invalid: null v request logu)

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin":  allowedOrigin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age":       "86400",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: { message: "Method not allowed" } }, 405);
  }

  // Vyžadujeme Authorization header — bez něj request zamítneme
  // (Supabase gateway už JWT ověřila, tato kontrola jen brání anonymním voláním)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: { message: "Chybí autorizační hlavička" } }, 401);
  }

  let body: {
    messages: Array<{ role: string; content: string }>;
    model?: string;
    max_tokens?: number;
    temperature?: number;
  };

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: { message: "Neplatné JSON tělo" } }, 400);
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonResponse({ error: { message: "Pole messages nesmí být prázdné" } }, 400);
  }

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) {
    return jsonResponse({ error: { message: "OpenAI klíč není nakonfigurován" } }, 500);
  }

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model:       body.model       ?? "gpt-4o-mini",
      messages:    body.messages,
      max_tokens:  body.max_tokens  ?? 200,
      temperature: body.temperature ?? 0.7,
    }),
  });

  const responseData = await openaiRes.json();
  return jsonResponse(responseData, openaiRes.status);
});
