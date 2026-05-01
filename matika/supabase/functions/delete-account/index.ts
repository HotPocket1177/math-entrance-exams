// @ts-nocheck
// supabase/functions/delete-account/index.ts
// Smaže veškerá data přihlášeného uživatele a jeho auth účet.
//
// Použití: volá se z aplikace s JWT tokenem přihlášeného uživatele.
// Secrets: SERVICE_ROLE_KEY (nastaven v Dashboard → Edge Functions → Secrets)

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

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const anonKey        = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")!;

  // ── Ověř JWT a získej userId ──────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { "apikey": anonKey, "Authorization": authHeader },
  });
  if (!userRes.ok) return json({ error: "Unauthorized" }, 401);

  const userData = await userRes.json();
  const userId: string = userData?.id;
  if (!userId) return json({ error: "Unauthorized" }, 401);

  const adminHeaders = {
    "apikey":        serviceRoleKey,
    "Authorization": `Bearer ${serviceRoleKey}`,
    "Content-Type":  "application/json",
  };

  // ── Smaž data z databáze ─────────────────────────────────────
  const tablesToDelete = [
    `session_progress?user_id=eq.${userId}`,
    `progress?user_id=eq.${userId}`,
    `profiles?id=eq.${userId}`,
  ];

  for (const path of tablesToDelete) {
    await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      method: "DELETE",
      headers: adminHeaders,
    });
  }

  // ── Smaž auth účet ───────────────────────────────────────────
  const deleteRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method:  "DELETE",
    headers: adminHeaders,
  });

  if (!deleteRes.ok) {
    const errText = await deleteRes.text();
    console.error("deleteUser error:", errText);
    return json({ error: "Nepodařilo se smazat účet. Zkus to znovu." }, 500);
  }

  return json({ ok: true });
});
