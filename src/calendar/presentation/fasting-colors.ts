import type { FoodRuleId } from '../fasting/fasting-api';

/** Light print backgrounds keep black dates and red feast text readable. */
export const FASTING_COLORS: Readonly<Record<FoodRuleId, string>> = {
  'no-fast': '#ffffff',
  fast: '#dcebc9',
  fish: '#cce9f3',
  oil: '#f7e5b5',
  'boiled-no-oil': '#ecdac7',
  'dry-eating': '#e3d5ed',
  'strict-fast': '#bfd9de',
  'dairy-eggs': '#fff3bf',
  memorial: '#dedee5',
};
