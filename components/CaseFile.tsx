"use client";
// The case file: every evidence item in order, with its ID, source, time and fingerprint,
// plus the form the buyer or seller uses to add a photo or a statement.
import { useState } from "react";
import type { CaseBundle, Party } from "@/lib/case/types";
import { EvidenceId, SourceBadge, shortDate } from "./ui";

export function CaseFile({ bundle, role, onChanged }: { bundle: CaseBundle; role: Party; onChanged: () => void }) {
  const { evidence } = bundle;
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold">Case file</h2>
        <p className="font-mono text-xs text-stone-500" title="One fingerprint for the whole case file. It changes if any evidence changes.">
          {evidence.length} items · fingerprint {bundle.fingerprint.slice(0, 12)}
        </p>
      </div>

      <ol className="flex flex-col gap-3">
        {evidence.map((e) => (
          <li key={e.id} id={`evidence-${e.id}`} className="scroll-mt-24 rounded-xl border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <EvidenceId id={e.id} />
              <SourceBadge source={e.source} />
              <span className="text-sm font-medium">{e.title}</span>
              <span className="ml-auto text-xs text-stone-500">{shortDate(e.occurred_at || e.created_at)}</span>
            </div>
            {e.file_path && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/cases/${bundle.case.id}/evidence/${e.id}/file`}
                alt={e.title}
                className="mt-3 max-h-64 rounded-lg border border-stone-200 object-contain"
              />
            )}
            <Body text={e.body} />
            <p className="mt-2 font-mono text-[11px] text-stone-400" title={e.sha256}>
              fingerprint {e.sha256.slice(0, 16)}…
            </p>
          </li>
        ))}
      </ol>

      {!bundle.case.is_replay && bundle.case.paypal_status !== "RESOLVED" && (
        <AddEvidence caseId={bundle.case.id} role={role} onAdded={onChanged} />
      )}
    </section>
  );
}

const PHOTO_MARK = "AI description of photo:";

/** Shows the text of an evidence item. For a photo, the uploader's own words and the AI's reading are kept visibly apart. */
function Body({ text }: { text: string | null }) {
  if (!text) return null;
  const at = text.indexOf(PHOTO_MARK);
  const own = (at === -1 ? text : text.slice(0, at)).trim();
  const ai = at === -1 ? "" : text.slice(at + PHOTO_MARK.length).trim();
  return (
    <>
      {own && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{own}</p>}
      {ai && (
        <div className="mt-2 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-3">
          <p className="text-xs font-medium text-stone-500">AI description of photo. What a model sees in the image, not a verified fact. The photo itself is the evidence.</p>
          <p className="mt-1 text-sm leading-relaxed text-stone-700">{ai}</p>
        </div>
      )}
    </>
  );
}

function AddEvidence({ caseId, role, onAdded }: { caseId: string; role: Party; onAdded: () => void }) {
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("party", role);
      form.set("note", note);
      if (file) form.set("file", file);
      const res = await fetch(`/api/cases/${caseId}/evidence`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add the evidence.");
      setNote("");
      setFile(null);
      formEl.reset();
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4">
      <p className="text-sm font-medium">Add evidence as the {role}</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Write a statement, or describe the photo you are adding"
        className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-500"
      />
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-200 file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
        <button
          type="submit"
          disabled={busy || (!note.trim() && !file)}
          className="ml-auto rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add to case file"}
        </button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <p className="text-xs text-stone-500">Both sides see everything in the case file. Photos: JPG, PNG or WebP, up to 5 MB.</p>
    </form>
  );
}
