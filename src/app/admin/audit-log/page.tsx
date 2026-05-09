import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminAuditLogPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/audit-log");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  const { data: rows } = await supabase
    .from("audit_log")
    .select("id, actor_user_id, action, entity_type, entity_id, created_at, metadata")
    .order("created_at", { ascending: false })
    .limit(300);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-6xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Audit log
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Najvažnije akcije u sistemu (MVP).
          </p>

          <div className="mt-6 grid gap-3">
            {(rows ?? []).map((r) => (
              <div key={r.id} className="rounded-xl border border-zinc-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-medium text-zinc-900">
                    {r.action}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {new Date(r.created_at).toLocaleString("sr-RS")}
                  </div>
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  actor: {r.actor_user_id ?? "—"} • {r.entity_type ?? "—"} •{" "}
                  {r.entity_id ?? "—"}
                </div>
                {r.metadata ? (
                  <pre className="mt-3 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
                    {JSON.stringify(r.metadata, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
            {!rows?.length ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                Nema zapisa.
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

