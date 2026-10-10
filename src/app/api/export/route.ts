import { createClient, configured } from "@/lib/supabase/server";
export async function GET() {
  if (!configured())
    return Response.json({ error: "Not configured" }, { status: 503 });
  const db = await createClient();
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user || user.is_anonymous)
    return Response.json({ error: "Authentication required" }, { status: 401 });
  const { data, error } = await db.rpc("export_library");
  if (error)
    return Response.json(
      { error: "Export failed. Your library has not changed." },
      { status: 500 },
    );
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="mido-watch-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
