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

/** Generates `count` suggestions, distinct within this batch. */
export function generateHandleBatch(count = CONFIG.handle.suggestionCount): string[] {
  const set = new Set<string>();
  let attempts = 0;
  while (set.size < count && attempts < count * 20) {
    set.add(generateHandle());
    attempts++;
  }
  return [...set];
}
