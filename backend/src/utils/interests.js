import { CATEGORIES } from '../config/constants.js';
import { User } from '../models/User.js';

/**
 * How much each signal says about what a viewer cares about. Following a
 * business is a much stronger hint than glancing at a search result.
 */
const WEIGHTS = {
  follow: 4,
  save: 2,
  comment: 2,
  like: 1,
  search: 1,
};

/**
 * Grows the viewer's interest score for [categories]. Suggestions are ranked
 * from these scores, so every real interaction nudges what the user is shown.
 * Never throws: a failed bump must not break the action that triggered it.
 */
export async function recordInterest(userId, categories, signal = 'like') {
  if (!userId) return;

  const list = Array.isArray(categories) ? categories : [categories];
  const unique = [...new Set(list.filter((category) => CATEGORIES.includes(category)))];
  if (unique.length === 0) return;

  const weight = WEIGHTS[signal] ?? 1;
  const increments = {};
  for (const category of unique) increments[`interests.${category}`] = weight;

  try {
    await User.updateOne({ _id: userId }, { $inc: increments });
  } catch {
    // Interest tracking is best effort.
  }
}

/** The viewer's categories, strongest first. */
export function rankedInterests(user) {
  const interests = user?.interests;
  if (!interests) return [];

  const entries = interests instanceof Map ? [...interests.entries()] : Object.entries(interests);
  return entries
    .filter(([category, score]) => CATEGORIES.includes(category) && score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => category);
}
