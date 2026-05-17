"use client";

import { useState } from "react";

type Sub = {
  id: string;
  building_id: string;
  status: string;
  payment_reference: string | null;
  amount_rsd: number;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  buildings: { street: string; street_number: string; city: string; municipality: string | null } | null;
  user_profiles: { display_name: string | null; first_name: string | null; last_name: string | null } | null;
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  pending_payment: "bg-amber-100 text-amber-800",
  expired: "bg-zinc-100 text-zinc-700",
  cancelled: "bg-red-100 text-red-800",
  inactive: "bg-zinc-100 text-zinc-700",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Aktivan",
  pending_payment: "Čeka uplatu",
  expired: "Istekao",
  cancelled: "Otkazan",
  inactive: "Neaktivan",
};

export default function AdminPretplateClient({ initial }: { initial: Sub[] }) {
  const [subs, setSubs] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function doAction(
    buildingId: string,
    action: "activate" | "deactivate" | "cancel",
    months = 1,
  ) {
    setBusy(buildingId + action);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/building-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ building_id: buildingId, action, months }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Greška");
      setMsg(`Uspešno: ${action}`);
      setSubs((prev) =>
        prev.map((s) =>
          s.building_id === buildingId
            ? {
                ...s,
                status:
                  action === "activate"
                    ? "active"
                    : action === "cancel"
                      ? "cancelled"
                      : "inactive",
                current_period_end:
                  action === "activate"
                    ? new Date(Date.now() + months * 30 * 86400000).toISOString()
                    : s.current_period_end,
              }
            : s,
        ),
      );
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Greška");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-5">
      {msg && (
        <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800">
          {msg}
        </div>
      )}

      {!subs.length && (
        <p className="py-6 text-center text-sm text-zinc-500">Nema zahteva za Premium.</p>
      )}

      <div className="space-y-3">
        {subs.map((s) => {
          const b = s.buildings;
          const u = s.user_profiles;
          const address = b
            ? `${b.street} ${b.street_number}, ${b.city}${b.municipality ? ` (${b.municipality})` : ""}`
            : s.building_id;
          const managerName =
            u?.display_name ||
            [u?.first_name, u?.last_name].filter(Boolean).join(" ") ||
            "—";

          return (
            <div key={s.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-900 truncate">{address}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    Upravnik: {managerName} • Ref:{" "}
                    <span className="font-mono font-medium text-zinc-800">
                      {s.payment_reference ?? "—"}
                    </span>{" "}
                    • {s.amount_rsd} RSD •{" "}
                    {new Date(s.created_at).toLocaleDateString("sr-RS")}
                  </div>
                  {s.current_period_end && s.status === "active" && (
                    <div className="mt-0.5 text-xs text-emerald-700">
                      Aktivan do: {new Date(s.current_period_end).toLocaleDateString("sr-RS")}
                    </div>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[s.status] ?? "bg-zinc-100 text-zinc-700"}`}
                >
                  {STATUS_LABELS[s.status] ?? s.status}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {s.status !== "active" && (
                  <>
                    <button
                      disabled={!!busy}
                      onClick={() => doAction(s.building_id, "activate", 1)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {busy === s.building_id + "activate" ? "..." : "Aktiviraj (1 mes.)"}
                    </button>
                    <button
                      disabled={!!busy}
                      onClick={() => doAction(s.building_id, "activate", 12)}
                      className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                      Aktiviraj (12 mes.)
                    </button>
                  </>
                )}
                {s.status === "active" && (
                  <button
                    disabled={!!busy}
                    onClick={() => doAction(s.building_id, "deactivate")}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    Deaktiviraj
                  </button>
                )}
                <button
                  disabled={!!busy}
                  onClick={() => doAction(s.building_id, "cancel")}
                  className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Otkaži
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
