export const CATEGORIES = [
  'Food & Drinks',
  'Beauty & Fashion',
  'Health Care',
  'Accommodations',
  'Retail Shops',
  'Travel & Transportation',
  'Bars & Nightlife',
  'Services',
];

export const ACCOUNT_TYPES = ['user', 'business', 'company', 'freelancer'];

/** Account types allowed to publish posts and own a business profile. */
export const PUBLISHER_TYPES = ['business', 'company', 'freelancer'];

/** How many images a single comment may carry. */
export const MAX_COMMENT_IMAGES = 4;

/** How many images a single chat message may carry. */
export const MAX_MESSAGE_IMAGES = 4;

/** How many videos a single chat message may carry. */
export const MAX_MESSAGE_VIDEOS = 1;

/** How many links a profile may list. */
export const MAX_PROFILE_LINKS = 5;

/** Free days every new business, company or freelancer account starts with. */
export const TRIAL_DAYS = 14;

/**
 * Paid plans. Only publisher accounts subscribe. Amounts are in cents of SBD
 * and drive what the app displays; the amount actually charged comes from the
 * matching Dodo Payments product. [benefits] is the "what you get" list the app
 * shows for the plan; [verified] grants the badge.
 */
export const SUBSCRIPTION_PLANS = {
  monthly: {
    id: 'monthly',
    label: 'Monthly',
    amount: 15000,
    currency: 'sbd',
    interval: 'month',
    priceText: 'SBD 150 / month',
    note: 'Billed every month, cancel any time',
    verified: false,
    benefits: [
      'Publish posts with photos and videos',
      'Stay listed in search and the directory',
      'Pushed higher in the For You feed',
      'Featured in the Suggested strip on the home page',
      'Cancel any time, no lock in',
    ],
  },
  yearly: {
    id: 'yearly',
    label: 'Yearly',
    amount: 150000,
    currency: 'sbd',
    interval: 'year',
    priceText: 'SBD 1,500 / year',
    note: 'Two months free compared to monthly',
    verified: true,
    benefits: [
      'Everything in the monthly plan',
      'Verified badge on your profile and every post',
      'Two months free — SBD 300 saved a year',
      'Your price is locked in for 12 months',
      'One payment a year instead of twelve',
    ],
  },
};

/**
 * How much newer a paid business's post looks when the For You feed is ranked.
 * Boosted posts mix in with fresh ones instead of pushing everything else out.
 */
export const BOOST_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * The same trick for the viewer's own categories, picked at signup or learned
 * from what they do. Smaller than the paid boost, and still only a nudge: posts
 * outside their interests stay in the feed, just lower down.
 */
export const INTEREST_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

/** How many of the viewer's strongest categories the ranking pays attention to. */
export const TOP_INTERESTS = 3;

/**
 * Smart keyword mapping used by search: a query term expands into the
 * categories and free-text hints a Solomon Islands user probably meant.
 */
export const KEYWORD_MAP = {
  food: { categories: ['Food & Drinks'], hints: ['restaurant', 'cafe', 'takeaway', 'kitchen'] },
  eat: { categories: ['Food & Drinks'], hints: ['restaurant', 'cafe'] },
  restaurant: { categories: ['Food & Drinks'], hints: ['cafe', 'dining'] },
  cafe: { categories: ['Food & Drinks'], hints: ['coffee', 'cafe'] },
  coffee: { categories: ['Food & Drinks'], hints: ['cafe', 'coffee'] },
  travel: {
    categories: ['Travel & Transportation', 'Accommodations'],
    hints: ['tour', 'beach', 'resort', 'dive'],
  },
  tour: { categories: ['Travel & Transportation'], hints: ['tour', 'guide', 'island'] },
  transport: { categories: ['Travel & Transportation'], hints: ['taxi', 'bus', 'boat', 'charter'] },
  taxi: { categories: ['Travel & Transportation'], hints: ['taxi', 'transfer'] },
  boat: { categories: ['Travel & Transportation'], hints: ['boat', 'charter', 'ferry'] },
  beach: {
    categories: ['Travel & Transportation', 'Accommodations'],
    hints: ['beach', 'resort', 'island'],
  },
  hotel: { categories: ['Accommodations'], hints: ['resort', 'lodge', 'accommodation'] },
  accommodation: { categories: ['Accommodations'], hints: ['lodge', 'resort', 'guesthouse'] },
  stay: { categories: ['Accommodations'], hints: ['lodge', 'accommodation'] },
  health: {
    categories: ['Health Care'],
    hints: ['fitness', 'gym', 'wellness', 'clinic', 'pharmacy'],
  },
  clinic: { categories: ['Health Care'], hints: ['clinic', 'doctor', 'pharmacy'] },
  fitness: { categories: ['Health Care'], hints: ['gym', 'training', 'wellness'] },
  gym: { categories: ['Health Care'], hints: ['fitness', 'training'] },
  wellness: {
    categories: ['Health Care', 'Beauty & Fashion'],
    hints: ['spa', 'massage', 'wellness'],
  },
  beauty: { categories: ['Beauty & Fashion'], hints: ['salon', 'hair', 'nails', 'spa'] },
  fashion: { categories: ['Beauty & Fashion'], hints: ['clothing', 'boutique', 'tailor'] },
  clothes: { categories: ['Beauty & Fashion', 'Retail Shops'], hints: ['clothing', 'boutique'] },
  hair: { categories: ['Beauty & Fashion'], hints: ['salon', 'barber'] },
  salon: { categories: ['Beauty & Fashion'], hints: ['hair', 'nails'] },
  shop: { categories: ['Retail Shops'], hints: ['store', 'retail', 'market'] },
  shopping: { categories: ['Retail Shops'], hints: ['store', 'retail'] },
  store: { categories: ['Retail Shops'], hints: ['shop', 'retail'] },
  market: { categories: ['Retail Shops'], hints: ['market', 'produce'] },
  night: { categories: ['Bars & Nightlife'], hints: ['bar', 'club', 'live music'] },
  nightlife: { categories: ['Bars & Nightlife'], hints: ['bar', 'club', 'lounge'] },
  bar: { categories: ['Bars & Nightlife'], hints: ['pub', 'lounge', 'club'] },
  drinks: { categories: ['Bars & Nightlife', 'Food & Drinks'], hints: ['bar', 'lounge'] },
  music: { categories: ['Bars & Nightlife'], hints: ['live music', 'band', 'dj'] },
  service: { categories: ['Services'], hints: ['repair', 'maintenance', 'cleaning', 'laundry'] },
  repair: { categories: ['Services'], hints: ['fix', 'maintenance', 'handyman'] },
  cleaning: { categories: ['Services'], hints: ['clean', 'housekeeping', 'laundry'] },
  laundry: { categories: ['Services'], hints: ['wash', 'dry clean'] },
};

/** Expands a raw search query into extra categories and text hints. */
export function expandQuery(query) {
  const terms = String(query ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  const categories = new Set();
  const hints = new Set();

  for (const term of terms) {
    const mapped = KEYWORD_MAP[term] ?? KEYWORD_MAP[term.replace(/s$/, '')];
    if (!mapped) continue;
    mapped.categories.forEach((category) => categories.add(category));
    mapped.hints.forEach((hint) => hints.add(hint));
  }

  // "food drinks" should still match "Food & Drinks", so compare on words only.
  const directCategory = CATEGORIES.find(
    (category) =>
      category
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
        .join(' ') === terms.join(' '),
  );
  if (directCategory) categories.add(directCategory);

  return { categories: [...categories], hints: [...hints] };
}
