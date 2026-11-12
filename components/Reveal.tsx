// Shows a line of text with two touches:
//   1. the word "PayPal" is always blue, and
//   2. the words appear one by one, from left to right.
// To switch every animation off in one go, set ANIMATIONS to false. The text then shows at once,
// and "PayPal" stays blue.
import { Fragment } from "react";

export const ANIMATIONS = true;

const isPayPal = (word: string) => /^PayPal/.test(word);

/** Text with "PayPal" in blue. No animation. Use it for body text. */
export function Hl({ children }: { children: string }) {
  const parts = children.split(/(PayPal(?:\u2019s|'s)?)/);
  return (
    <>
      {parts.map((part, i) => (isPayPal(part) ? <span key={i} className="font-medium text-paypal">{part}</span> : <Fragment key={i}>{part}</Fragment>))}
    </>
  );
}

/** A heading or key sentence: "PayPal" in blue, and words appearing one by one. `delay` (ms) starts it later. */
export function Reveal({ children, delay = 0, step = 45 }: { children: string; delay?: number; step?: number }) {
  if (!ANIMATIONS) return <Hl>{children}</Hl>;
  const words = children.split(" ");
  return (
    <>
      {words.map((word, i) => (
        <Fragment key={i}>
          <span className={`reveal-word ${isPayPal(word) ? "text-paypal" : ""}`} style={{ animationDelay: `${delay + i * step}ms` }}>
            {word}
          </span>
          {i < words.length - 1 ? " " : ""}
        </Fragment>
      ))}
    </>
  );
}
