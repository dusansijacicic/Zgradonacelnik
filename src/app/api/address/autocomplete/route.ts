import { NextResponse } from "next/server";
import { getSessionUser, jsonError } from "@/lib/api";
import { autocompleteAddress, PlacesConfigError } from "@/lib/googlePlaces";

export async function GET(request: Request) {
  const { user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 160);
  const session = (url.searchParams.get("session") ?? "").slice(0, 64);
  if (q.length < 3) return NextResponse.json({ suggestions: [] });
  if (!/^[A-Za-z0-9-]{8,64}$/.test(session)) return jsonError("bad_session", 400);

  try {
    const suggestions = await autocompleteAddress(q, session);
    return NextResponse.json({ suggestions });
  } catch (e) {
    if (e instanceof PlacesConfigError) return jsonError("places_not_configured", 503, e.message);
    return jsonError("places_error", 502);
  }
}
