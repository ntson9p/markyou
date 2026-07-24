export interface TextCounts {
  words: number;
  characters: number;
  /** Reading time in whole minutes, floor 1 when there is any content. */
  readingMinutes: number;
}

const WORDS_PER_MINUTE = 200;

/** Word/character counts over markdown source (FR-10.2). */
export function countText(text: string): TextCounts {
  const characters = [...text.replace(/\s/g, '')].length;
  const words = text.split(/\s+/).filter(Boolean).length;
  const readingMinutes = words === 0 ? 0 : Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  return { words, characters, readingMinutes };
}
