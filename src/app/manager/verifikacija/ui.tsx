"use client";

import { useState } from "react";
import TurnstileWidget from "@/components/TurnstileWidget";

export default function VerificationClient() {
  const [step, setStep] = useState<"request" | "verify">("request");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  const [requestId, setRequestId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function requestOtp() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/manager-verification/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          captcha_token: captchaToken,
        }),
      });
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error ?? "Greška");
      setRequestId(json.id);
      setStep("verify");
      setMsg("OTP kod je poslat na email. Važi 15 minuta.");
    } catch (e: any) {
      setMsg(e?.message ?? "Greška");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    if (!requestId) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/manager-verification/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          request_id: requestId,
          otp,
        }),
      });
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error ?? "Greška");
      setMsg("Verifikacija uspešna. Osveži stranicu da vidiš status.");
    } catch (e: any) {
      setMsg(e?.message ?? "Greška");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="text-sm font-medium text-zinc-900">
        Email verifikacija (MVP)
      </div>
      <p className="mt-1 text-sm text-zinc-600">
        Unesi podatke iz registra i email koji postoji u registru. Dobićeš OTP kod
        na taj email.
      </p>

      {step === "request" ? (
        <div className="mt-4 grid gap-3">
          <input
            className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
            placeholder="Ime"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <input
            className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
            placeholder="Prezime"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <input
            className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
            placeholder="Email iz registra"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            disabled={busy}
            onClick={requestOtp}
            className="h-11 rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-60"
          >
            Pošalji OTP
          </button>

          <div className="pt-2">
            <TurnstileWidget onToken={setCaptchaToken} />
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          <input
            className="h-11 rounded-xl border border-zinc-200 px-3 text-sm tracking-widest"
            placeholder="OTP (6 cifara)"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          <button
            disabled={busy}
            onClick={verifyOtp}
            className="h-11 rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-60"
          >
            Potvrdi OTP
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setStep("request");
              setOtp("");
              setRequestId(null);
            }}
            className="h-11 rounded-xl border border-zinc-200 bg-white text-sm font-medium text-zinc-900 disabled:opacity-60"
          >
            Nazad
          </button>
        </div>
      )}

      {msg ? (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
          {msg}
        </div>
      ) : null}
    </div>
  );
}

