import express from 'express';
import { PUBLISHER_TYPES, TOP_INTERESTS } from '../config/constants.js';
import { requireAuth } from '../middleware/auth.js';
import { Follow } from '../models/Follow.js';
import { User } from '../models/User.js';
import { rankedInterests } from '../utils/interests.js';
import { boostedAuthorIds } from '../utils/query.js';

export const suggestionsRouter = express.Router();

const MAX_SUGGESTIONS = 12;

/**
 * GET /api/suggestions - businesses the viewer is likely to care about.
 *
 * Ranked by the categories they have searched, followed, liked, saved or
 * commented on (see `utils/interests.js`), then topped up with popular
 * publishers so a brand new account still sees something useful.
 */
suggestionsRouter.get('/', requireAuth, async (req, res) => {
  const limit = Math.min(MAX_SUGGESTIONS, Math.max(1, Number.parseInt(req.query.limit ?? '10', 10) || 10));

  const following = await Follow.find({ follower: req.user._id }).select('following');
  const excluded = [req.user._id, ...following.map((row) => row.following)];

  const interests = rankedInterests(req.user).slice(0, TOP_INTERESTS);
  const boosted = await boostedAuthorIds();
  const items = [];

  /**
   * Adds publishers that are not already in the list, best ranking first.
   *
   * The exclusion and the `ids` shortlist both live on `_id`, so they have to be
   * merged into one object. Spreading a filter with its own `_id` over the
   * `$nin` used to drop the exclusions entirely, which let the same business
   * appear twice in the same response.
   */
  async function fill({ categories, ids } = {}) {
    if (items.length >= limit) return;

    const filter = {
      accountType: { $in: PUBLISHER_TYPES },
      _id: { $nin: [...excluded, ...items.map((item) => item._id)] },
    };
    if (categories?.length) filter.category = { $in: categories };
    if (ids) filter._id.$in = ids;

    const matches = await User.find(filter)
      .sort({ followerCount: -1, postCount: -1, fullName: 1 })
      .limit(limit - items.length);
    items.push(...matches);
  }

  // Paid businesses in the viewer's categories come first, then the rest.
  if (interests.length > 0) {
    await fill({ categories: interests, ids: boosted });
    await fill({ categories: interests });
  }
  await fill({ ids: boosted });
  await fill({});

  res.json({
    interests,
    items: items.map((user) => user.toPublicJson({ isFollowing: false })),
  });
});
