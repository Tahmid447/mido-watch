import { createClient, configured } from "@/lib/supabase/server";
import { backupSchema } from "@/lib/model";
import { chatgptContext } from "@/lib/recommendation-pack";
export async function GET() {
  if (!configured()) return new Response("Unauthorized", { status: 401 });
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user || auth.user.is_anonymous)
    return new Response("Unauthorized", { status: 401 });
  const { data, error } = await db.rpc("export_library");
  if (error) return new Response("Unable to export", { status: 500 });
  return new Response(
    JSON.stringify(chatgptContext(backupSchema.parse(data))),
    {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition":
          "attachment; filename=mido-watch-chatgpt-context.json",
        "Cache-Control": "private, no-store",
      },
    },
  );
}
