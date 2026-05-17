import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  first_name: z.string().min(1).max(80),
  last_name: z.string().min(1).max(80),
  user_type: z.enum(["resident", "professional_manager", "other"]),
  municipality: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Nevalidni podaci" }, { status: 400 });
  }

  const { first_name, last_name, user_type, municipality, city } = parsed.data;

  const { error } = await supabase.from("user_profiles").upsert(
    {
      user_id: user.id,
      first_name,
      last_name,
      display_name: `${first_name} ${last_name}`.trim(),
      user_type,
      ...(municipality ? { municipality } : {}),
      ...(city ? { city } : {}),
      onboarding_completed: true,
    },
    { onConflict: "user_id" },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
