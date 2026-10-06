"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TurnstileWidget from "@/components/TurnstileWidget";

type Candidate = { id: number; full_name: string; municipality: string | null; license_number: string | null; claimed?: boolean };

export default function VerificationClient({
  defaultEmail,
  ownEmailCandidates,
}: {
  defaultEmail: string;
  ownEmailCandidates: Candidate[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState(ownEmailCandidates.length ? defaultEmail : "");
  const [candidates, setCandidates] = useState<Candidate[]>(ownEmailCandidates.length > 1 ? ownEmailCandidates : []);
  const [registryId, setRegistryId] = useState<number | null>(ownEmailCandidates.length === 1 ? ownEmailCandidates[0].id : null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function send() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/manager-verification/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, registry_id: registryId ?? undefined, captcha_token: captchaToken }),
      });
      const json = (await res.json()) as {
        status?: string;
        id?: string;
        full_name?: string;
        error?: string;
        detail?: string;
        candidates?: Candidate[];
      };
      if (res.status === 409 && json.candidates) {
        setCandidates(json.candidates);
        setMsg({ text: json.detail ?? "Izaberi koji upravnik si ti.", ok: false });
        return;
      }
      if (!res.ok) throw new Error(json.detail ?? json.error ?? "Greška");
      if (json.status === "verified") {
        setMsg({ text: "Potvrđeno! Sada si verifikovan profesionalni upravnik.", ok: true });
        router.refresh();
        return;
      }
      setRequestId(json.id ?? null);
      setMsg({ text: `Kod je poslat na ${email}. Važi 15 minuta.`, ok: true });
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : "Greška", ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!requestId) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/manager-verification/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request_id: requestId, otp }),
      });
      const json = (await res.json()) as { error?: string; detail?: string };
      if (!res.ok) throw new Error(json.detail ?? json.error ?? "Greška");
      setMsg({ text: "Potvrđeno! Sada si verifikovan profesionalni upravnik.", ok: true });
      router.refresh();
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : "Greška", ok: false });
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm";

  return (
    <div className="mt-6 space-y-4">
      {ownEmailCandidates.length > 0 && !requestId ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <div className="font-semibold">Tvoj email ({defaultEmail}) je u registru upravnika.</div>
          <p className="mt-1 text-xs">Pošto si se prijavio tom adresom, potvrda ide jednim klikom — bez koda.</p>
        </div>
      ) : null}

      {!requestId ? (
        <div className="grid gap-3">
          <label className="text-xs font-semibold text-zinc-600">Email iz registra upravnika</label>
          <input
            type="email"
            className={inputCls}
            placeholder="email@upisan-u-registar.rs"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setCandidates([]);
              setRegistryId(null);
            }}
          />

          {candidates.length > 1 ? (
            <div className="space-y-2">
              {candidates.map((c) => (
                <label
                  key={c.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${
                    registryId === c.id ? "border-brand-navy bg-brand-navy/5" : "border-zinc-200"
                  } ${c.claimed ? "opacity-50" : ""}`}
                >
                  <input
                    type="radio"
                    name="registry"
                    disabled={c.claimed}
                    checked={registryId === c.id}
                    onChange={() => setRegistryId(c.id)}
                  />
                  <span>
                    <span className="font-medium">{c.full_name}</span>
                    <span className="text-xs text-zinc-500">
                      {c.license_number ? ` · lic. ${c.license_number}` : ""}
                      {c.municipality ? ` · ${c.municipality}` : ""}
                      {c.claimed ? " · već povezan" : ""}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ) : null}

          <TurnstileWidget onToken={setCaptchaToken} />

          <button
            disabled={busy || !email || (candidates.length > 1 && !registryId)}
            onClick={send}
            className="h-11 rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? "..." : ownEmailCandidates.length && email === defaultEmail ? "Potvrdi da sam upravnik" : "Pošalji kod na email"}
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          <input
            className={`${inputCls} text-center text-lg tracking-[0.4em]`}
            inputMode="numeric"
            maxLength={6}
            placeholder="______"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          />
          <button disabled={busy || otp.length !== 6} onClick={verify} className="h-11 rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-60">
            Potvrdi kod
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setRequestId(null);
              setOtp("");
              setMsg(null);
            }}
            className="h-11 rounded-xl border border-zinc-200 bg-white text-sm font-medium text-zinc-900 disabled:opacity-60"
          >
            Nazad
          </button>
        </div>
      )}

      {msg ? (
        <div
          className={`rounded-xl border p-3 text-sm ${
            msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      ) : null}
    </div>
  );
}
