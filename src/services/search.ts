// Thin fuse.js wrapper for fuzzy landmark search. Kept as a separate module
// so the matching config (threshold, keys) lives in exactly one place.
import Fuse, { type IFuseOptions } from 'fuse.js';
import type { Landmark } from '../types';

const FUSE_OPTIONS: IFuseOptions<Landmark> = {
  keys: ['name'],
  threshold: 0.4,
  ignoreLocation: true,
  isCaseSensitive: false,
};

export function createLandmarkIndex(landmarks: Landmark[]): Fuse<Landmark> {
  return new Fuse(landmarks, FUSE_OPTIONS);
}

/** Normalizes stray whitespace so "wasteLAND" vs "waste  LAND"-style OCR/typo
 * variance doesn't need to rely on fuzz alone. */
function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ');
}

export function searchLandmarks(index: Fuse<Landmark>, query: string): Landmark[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];
  return index.search(normalized).map((result) => result.item);
}
