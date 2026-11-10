// Fingerprints. A fingerprint is a sha256 hash: a short code that changes if the content changes.
// They let anyone see that an evidence item is the same as when it was added.
// They are stored in Parley's own database, so they are a consistency check, not proof against tampering.
import { createHash } from "node:crypto";

export function fingerprint(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

/** One fingerprint for the whole case file: the hash of every evidence fingerprint, in ID order. */
export function caseFingerprint(items: Array<{ id: string; sha256: string }>): string {
  const ordered = [...items].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  return fingerprint(ordered.map((e) => `${e.id}:${e.sha256}`).join("\n"));
}
