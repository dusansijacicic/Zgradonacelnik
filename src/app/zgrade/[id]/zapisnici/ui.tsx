"use client";

import { useState } from "react";

type Minute = {
  id: string;
  title: string;
  held_at: string;
  location: string | null;
  agenda: string | null;
  decisions: string | null;
  attendees_count: number | null;
  created_at: string;
};

type Props = {
  buildingId: string;
  initial: Minute[];
  isManager: boolean;
};

export default function ZapisniciClient({ buildingId, initial, isManager }: Props) {
  const [minutes, setMinutes] = useState(initial);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [heldAt, setHeldAt] = useState("");
  const [location, setLocation] = useState("");
  const [agenda, setAgenda] = useState("");
  const [decisions, setDecisions] = useState("");
  const [attendees, setAttendees] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !heldAt) { setError("Naslov i datum su obavezni."); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/meeting-minutes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          building_id: buildingId,
          title: title.trim(),
          held_at: new Date(heldAt).toISOString(),
          location: location.trim() || undefined,
          agenda: agenda.trim() || undefined,
          decisions: decisions.trim() || undefined,
          attendees_count: attendees ? parseInt(attendees, 10) : undefined,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; id?: string };
      if (!res.ok) throw new Error(json.error ?? "Greška");
      const newMinute: Minute = {
        id: json.id!,
        title: title.trim(),
        held_at: new Date(heldAt).toISOString(),
        location: location.trim() || null,
        agenda: agenda.trim() || null,
        decisions: decisions.trim() || null,
        attendees_count: attendees ? parseInt(attendees, 10) : null,
        created_at: new Date().toISOString(),
      };
      setMinutes((prev) => [newMinute, ...prev]);
      setTitle(""); setHeldAt(""); setLocation(""); setAgenda(""); setDecisions(""); setAttendees("");
      setShowForm(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Greška");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 space-y-4">
      {isManager && (
        <div>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              + Novi zapisnik
            </button>
          ) : (
            <form onSubmit={create} className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 space-y-3">
              <div className="text-sm font-medium text-zinc-900">Novi zapisnik</div>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Naslov zapisnika *"
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Datum i vreme *</label>
                  <input
                    required
                    type="datetime-local"
                    value={heldAt}
                    onChange={(e) => setHeldAt(e.target.value)}
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Lokacija</label>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="npr. Hol zgrade"
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Dnevni red</label>
                <textarea
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  placeholder="Tačke dnevnog reda..."
                  rows={3}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Odluke i zaključci</label>
                <textarea
                  value={decisions}
                  onChange={(e) => setDecisions(e.target.value)}
                  placeholder="Usvojene odluke..."
                  rows={4}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
              </div>
              <input
                type="number"
                min={0}
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                placeholder="Broj prisutnih stanara"
                className="h-10 w-40 rounded-lg border border-zinc-200 bg-white px-3 text-sm"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="h-9 rounded-lg bg-zinc-900 px-4 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
                >
                  {busy ? "Čuvanje..." : "Sačuvaj"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setError(null); }}
                  className="h-9 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Otkaži
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {minutes.length === 0 && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
          Nema zapisnika.{" "}
          {isManager ? "Kliknite '+ Novi zapisnik' da dodate prvi." : "Upravnik još nije dodao zapisnik."}
        </div>
      )}

      <div className="space-y-3">
        {minutes.map((m) => (
          <div key={m.id} className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === m.id ? null : m.id)}
              className="w-full text-left px-5 py-4 hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">{m.title}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {new Date(m.held_at).toLocaleString("sr-RS", { dateStyle: "long", timeStyle: "short" })}
                    {m.location ? ` • ${m.location}` : ""}
                    {m.attendees_count != null ? ` • ${m.attendees_count} prisutnih` : ""}
                  </div>
                </div>
                <span className="shrink-0 text-zinc-400 text-xs">{expanded === m.id ? "▲" : "▼"}</span>
              </div>
            </button>

            {expanded === m.id && (
              <div className="border-t border-zinc-100 px-5 py-4 space-y-4 text-sm">
                {m.agenda && (
                  <div>
                    <div className="mb-1 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Dnevni red</div>
                    <p className="text-zinc-700 whitespace-pre-wrap">{m.agenda}</p>
                  </div>
                )}
                {m.decisions && (
                  <div>
                    <div className="mb-1 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Odluke i zaključci</div>
                    <p className="text-zinc-700 whitespace-pre-wrap">{m.decisions}</p>
                  </div>
                )}
                <div className="text-xs text-zinc-400">
                  Objavljeno: {new Date(m.created_at).toLocaleDateString("sr-RS")}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
