"use client";
// The "Try a live case" button on the home screen, with a counter of how many open PayPal disputes are left.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function DemoStart() {
  const router = useRouter();
  const [available, setAvailable] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/demo/start", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAvailable(typeof d.available === "number" ? d.available : 0))
      .catch(() => setAvailable(0));
  }, []);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/start", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start a live case.");
      router.push(`/case/${data.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">Try a live case</p>
          <p className="text-sm text-stone-600">
            Opens a real sandbox dispute. Play both sides: organize the facts, agree, and watch PayPal close it.
            {available === null ? " Checking PayPal…" : available > 0 ? ` ${available} open case${available === 1 ? "" : "s"} left.` : " None are open right now; the finished cases below show the full flow."}
          </p>
        </div>
        <button onClick={start} disabled={busy || !available} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
          {busy ? "Opening from PayPal…" : "Start a live case"}
        </button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
