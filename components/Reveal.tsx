// Text helpers. `Reveal` makes the words of a heading appear one by one, from left to right.
// To switch every animation off in one go, set ANIMATIONS to false. The text then shows at once.
import { Fragment } from "react";

export const ANIMATIONS = true;

const isPayPal = (word: string) => /^PayPal/.test(word);

/** Plain body text. Kept as one place to restyle running text later. */
export function Hl({ children }: { children: string }) {
  return <>{children}</>;
}

/** A heading or key sentence whose words appear one by one. With `blue`, the word "PayPal" is blue. `delay` (ms) starts it later. */
export function Reveal({ children, delay = 0, step = 45, blue = false }: { children: string; delay?: number; step?: number; blue?: boolean }) {
  const words = children.split(" ");
  const tone = (word: string) => (blue && isPayPal(word) ? "text-paypal" : "");
  if (!ANIMATIONS) {
    return (
      <>
        {words.map((word, i) => (
          <Fragment key={i}>
            <span className={tone(word)}>{word}</span>
            {i < words.length - 1 ? " " : ""}
          </Fragment>
        ))}
      </>
    );
  }
  return (
    <>
      {words.map((word, i) => (
        <Fragment key={i}>
          <span className={`reveal-word ${tone(word)}`} style={{ animationDelay: `${delay + i * step}ms` }}>
            {word}
          </span>
          {i < words.length - 1 ? " " : ""}
        </Fragment>
      ))}
    </>
  );
}
