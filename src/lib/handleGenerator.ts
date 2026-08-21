import { CONFIG } from "./config";

const { adjectives: ADJECTIVES, nouns: NOUNS, maxLength: MAX_HANDLE_LENGTH } = CONFIG.handle;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Generates a single themed handle, e.g. "SplashyOtter42" or "SoggyPenguin". */
export function generateHandle(): string {
  const base = pick(ADJECTIVES) + pick(NOUNS);
  const withSuffix =
    Math.random() < CONFIG.handle.suffixProbability
      ? base + String(Math.floor(Math.random() * 100))
      : base;
  return withSuffix.length <= MAX_HANDLE_LENGTH ? withSuffix : base;
}

/** Generates `count` suggestions, distinct within this batch. The handle
 * space (adjectives × nouns, with an optional numeric suffix) is far larger
 * than any requested count, so with a generous collision bound the batch is
 * effectively guaranteed to fill — but we stop early rather than loop
 * forever in the impossible case the RNG never yields a new handle. */
export function generateHandleBatch(count = CONFIG.handle.suggestionCount): string[] {
  const set = new Set<string>();
  let attempts = 0;
  while (set.size < count && attempts < count * 100) {
    set.add(generateHandle());
    attempts++;
  }
  return [...set];
}
