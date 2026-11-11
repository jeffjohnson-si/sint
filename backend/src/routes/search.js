import express from 'express';
import { CATEGORIES, PUBLISHER_TYPES, expandQuery } from '../config/constants.js';
import { optionalAuth } from '../middleware/auth.js';
import { Follow } from '../models/Follow.js';
import { User } from '../models/User.js';
import { escapeRegex, normaliseCategory, parsePaging } from '../utils/query.js';
import { recordInterest } from '../utils/interests.js';

export const searchRouter = express.Router();

/**
 * GET /api/search - finds businesses by name, category or mapped keyword.
 * "food" also matches Food & Drinks, "travel" matches Travel & Transportation
 * and Accommodations, etc.
 */
searchRouter.get('/', optionalAuth, async (req, res) => {
  const query = String(req.query.q ?? '').trim();
  const { page, limit, skip } = parsePaging(req.query);
  const { categories, hints } = expandQuery(query);

  const filter = { accountType: { $in: PUBLISHER_TYPES } };

  if (req.query.category && req.query.category !== 'All') {
    filter.category = normaliseCategory(req.query.category);
  }

  if (query) {
    const pattern = new RegExp(escapeRegex(query), 'i');
    const hintPatterns = hints.map((hint) => new RegExp(escapeRegex(hint), 'i'));
    filter.$or = [
      { fullName: pattern },
      { bio: pattern },
      { location: pattern },
      { category: pattern },
      ...(categories.length ? [{ category: { $in: categories } }] : []),
      ...hintPatterns.flatMap((hintPattern) => [{ fullName: hintPattern }, { bio: hintPattern }]),
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ followerCount: -1, fullName: 1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  const followedIds = req.user
    ? new Set(
        (await Follow.find({ follower: req.user._id, following: { $in: users.map((u) => u._id) } }))
          .map((row) => row.following.toString()),
      )
    : new Set();

  // Searching is a strong hint about what the viewer is looking for, so the
  // categories behind the query (or of the best matches) feed suggestions.
  if (req.user && query) {
    const searched = categories.length > 0
      ? categories
      : users.slice(0, 3).map((user) => user.category);
    await recordInterest(req.user._id, searched, 'search');
  }


  res.json({
    query,
    mappedCategories: categories,
    items: users.map((user) =>
      user.toPublicJson({ isFollowing: followedIds.has(user._id.toString()) }),
    ),
    page,
    limit,
    total,
    hasMore: skip + users.length < total,
  });
});

searchRouter.get('/categories', (req, res) => {
  res.json({ items: ['All', ...CATEGORIES] });
});
