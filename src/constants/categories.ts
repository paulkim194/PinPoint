import type { LandmarkCategory } from '../types';

export const CATEGORY_ORDER: LandmarkCategory[] = ['stage', 'gate', 'meetup', 'other'];

export const CATEGORY_LABELS: Record<LandmarkCategory, string> = {
  stage: 'Stage',
  gate: 'Gate',
  meetup: 'Meetup',
  other: 'Other',
};

export const CATEGORY_COLORS: Record<LandmarkCategory, string> = {
  stage: '#f97316', // orange
  gate: '#22c55e', // green
  meetup: '#3b82f6', // blue
  other: '#a855f7', // purple
};
