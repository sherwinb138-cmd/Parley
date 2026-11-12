"use client";
// The "Import a PayPal dispute" box on the home screen.
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ImportForm() {
  const router = useRouter();
  const [disputeId, setDisputeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disputeId: disputeId.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed.");
      router.push(`/case/${data.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <input
          value={disputeId}
          onChange={(e) => setDisputeId(e.target.value)}
          placeholder="PayPal case ID, e.g. PP-R-ABC-12345678"
          className="min-w-0 flex-1 border-0 border-b border-stone-400 bg-transparent px-0 py-2 font-mono text-sm outline-none placeholder:text-stone-500 focus:border-stone-900"
          aria-label="PayPal case ID"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
        >
          {busy ? "Importing from PayPal…" : "Import dispute"}
        </button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
