// @ts-nocheck
// supabase/functions/send-newsletter/index.ts
// Admin Edge Function: rozešle novinky všem uživatelům s email_updates = true
//
// Použití:
//   curl -X POST https://<project>.supabase.co/functions/v1/send-newsletter \
//     -H "Authorization: Bearer NEWSLETTER_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"subject":"Novinky v Matice v1.5","body":"Co je nového: ..."}'
//
// Supabase secrets (nastavit v Dashboard → Edge Functions → Secrets):
//   NEWSLETTER_SECRET   — tajný token pro admin auth (vymysli si vlastní)
//   RESEND_API_KEY      — API klíč z resend.com (free tier: 3 000 emailů/měsíc)
//   RESEND_FROM         — odesílací adresa, např. "Matika <noreply@tvoje-domena.cz>"
//   SUPABASE_URL        — automaticky dostupné v Edge Functions
//   SUPABASE_SERVICE_ROLE_KEY — potřebné pro přístup k auth.users; nastavit ručně

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // ── Admin auth ────────────────────────────────────────────────
  const secret = Deno.env.get("NEWSLETTER_SECRET");
  const auth   = req.headers.get("Authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  // ── Tělo požadavku ────────────────────────────────────────────
  let body: { subject?: string; body?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const { subject, body: emailBody } = body;
  if (!subject || !emailBody) return json({ error: "Chybí subject nebo body" }, 400);

  // ── Načti uživatele s opt-in přes service role ────────────────
  const supabaseUrl     = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey  = Deno.env.get("SERVICE_ROLE_KEY")!;
  const resendKey       = Deno.env.get("RESEND_API_KEY");
  const resendFrom      = Deno.env.get("RESEND_FROM") ?? "Matika <noreply@example.com>";

  if (!resendKey) return json({ error: "RESEND_API_KEY není nastaven" }, 500);

  // Načti profiles kde email_updates = true
  const profilesRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?email_updates=eq.true&select=id`,
    { headers: { "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}` } }
  );
  const profiles: Array<{ id: string }> = await profilesRes.json();

  if (!profiles.length) return json({ odeslano: 0, zprava: "Žádní opt-in uživatelé" });

  // Načti emailové adresy z auth.users pro dané ID
  const ids = profiles.map(p => p.id);
  const usersRes = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`,
    { headers: { "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}` } }
  );
  const usersData = await usersRes.json();
  const emailMap: Record<string, string> = {};
  (usersData.users ?? []).forEach((u: { id: string; email: string }) => {
    if (ids.includes(u.id)) emailMap[u.id] = u.email;
  });

  const emaily = Object.values(emailMap).filter(Boolean);
  if (!emaily.length) return json({ odeslano: 0, zprava: "Nepodařilo se načíst emaily" });

  // ── Rozešli přes Resend ───────────────────────────────────────
  let odeslano = 0;
  const chyby: string[] = [];

  for (const email of emaily) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:    resendFrom,
        to:      [email],
        subject,
        text:    emailBody,
        html:    `<p style="font-family:sans-serif;line-height:1.6">${emailBody.replace(/\n/g, "<br>")}</p><hr><p style="font-size:.8em;color:#888">Odhlásit se z novinek: přihlas se na <a href="https://matika.app">matika.app</a> → nastavení účtu → odškrtni "Novinky e-mailem".</p>`,
      }),
    });
    if (res.ok) { odeslano++; } else { chyby.push(email); }
  }

  return json({ odeslano, chyby, celkem: emaily.length });
});
