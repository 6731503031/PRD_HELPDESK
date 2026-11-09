import type { Priority } from './types';
import { api } from './client';

/** Uses the shared client so identity headers and /api/v1 stay consistent. */
export const getAiSuggestion = (input: { subject: string; description: string; urgency?: Priority }) =>
  api.suggest(input);
