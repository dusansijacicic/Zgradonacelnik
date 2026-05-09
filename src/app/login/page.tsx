import { Suspense } from "react";
import LoginClient from "./ui";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16">
          <main className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="h-6 w-32 rounded bg-zinc-100" />
            <div className="mt-4 h-4 w-full rounded bg-zinc-100" />
            <div className="mt-2 h-4 w-5/6 rounded bg-zinc-100" />
            <div className="mt-6 h-10 w-full rounded-xl bg-zinc-200" />
          </main>
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}

