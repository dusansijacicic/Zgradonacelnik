import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("oauth_address_line, oauth_address_synced_at, city, municipality")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Profil
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Prikazano ime i adresa sa Google naloga (ako ih provajder pošalje u JWT) sinhronizuju se pri
          prijavi. Grad/opština u profilu na platformi su zasebna polja kada ih uvedemo u obrasci.
        </p>
        <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
          <div className="font-medium text-zinc-900">Nalog</div>
          <div className="mt-1 text-zinc-700 break-all">{user.id}</div>
          <div className="mt-1 text-zinc-700 break-all">{user.email}</div>
          {profile?.oauth_address_line ? (
            <div className="mt-4 border-t border-zinc-200 pt-3">
              <div className="text-xs font-medium text-zinc-500">Adresa iz Google naloga (JWT)</div>
              <div className="mt-1 text-zinc-800">{profile.oauth_address_line}</div>
              {profile.oauth_address_synced_at ? (
                <div className="mt-1 text-xs text-zinc-500">
                  Ažurirano: {new Date(profile.oauth_address_synced_at).toLocaleString("sr-RS")}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 border-t border-zinc-200 pt-3 text-xs text-zinc-500">
              Google trenutno nije poslao formatiranu adresu u metapodacima — često JWT sadrži samo ime
              i email. Ako kasnije uključite dodatne scope-ove ili People API, ovo polje će se
              popuniti pri sledećoj prijavi.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

