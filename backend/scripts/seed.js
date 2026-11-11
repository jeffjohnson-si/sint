/**
 * Seeds a demo Solomon Islands directory: businesses, freelancers, normal users,
 * posts, follows, comments, a conversation and notifications.
 *
 * Usage: npm run seed
 * Every demo account uses the password: password123
 */
import { connectDb, disconnectDb } from '../src/config/db.js';
import { PUBLISHER_TYPES } from '../src/config/constants.js';
import { Comment } from '../src/models/Comment.js';
import { Conversation } from '../src/models/Conversation.js';
import { Follow } from '../src/models/Follow.js';
import { Message } from '../src/models/Message.js';
import { Notification } from '../src/models/Notification.js';
import { Post } from '../src/models/Post.js';
import { User } from '../src/models/User.js';
import { notify } from '../src/utils/notify.js';

const DEMO_PASSWORD = 'password123';
const image = (seed) => `https://picsum.photos/seed/${seed}/800/600`;
const days = (count) => new Date(Date.now() + count * 24 * 60 * 60 * 1000);

/**
 * Demo billing states so the app shows a verified yearly business, a boosted
 * monthly one, a trial and a lapsed account that hits the paywall. Publishers
 * not listed here fall back to the monthly plan.
 */
const subscriptions = {
  'lime@sint.sb': { status: 'active', plan: 'yearly', currentPeriodEnd: days(300) },
  'coral@sint.sb': { status: 'active', plan: 'yearly', currentPeriodEnd: days(250) },
  'glow@sint.sb': { status: 'trialing', trialEndsAt: days(6) },
  'wantok@sint.sb': { status: 'canceled', plan: 'monthly', currentPeriodEnd: days(-4) },
  // The development shortcut (POST /auth/dev-login) signs in here.
  'demo@sint.sb': { status: 'active', plan: 'yearly', currentPeriodEnd: days(320) },
};
const defaultSubscription = { status: 'active', plan: 'monthly', currentPeriodEnd: days(21) };


const accounts = [
  {
    fullName: 'SINT Demo Business',
    email: 'demo@sint.sb',
    accountType: 'business',
    category: 'Food & Drinks',
    location: 'Honiara, Guadalcanal',
    bio: 'Development account for testing the whole flow. Safe to break — reseed any time.',
    phone: '+677 00000',
    address: 'Mendana Avenue, Honiara',
    links: [],
  },
  {
    fullName: 'Lime Lounge Honiara',
    email: 'lime@sint.sb',
    accountType: 'business',
    category: 'Food & Drinks',
    location: 'Honiara, Guadalcanal',
    bio: 'Fresh island cuisine and the best coffee on Mendana Avenue.',
    phone: '+677 21123',
    address: 'Mendana Avenue, Honiara',
    links: [
      { label: 'Facebook', url: 'https://facebook.com/limeloungesb' },
      { label: 'Menu', url: 'https://limelounge.example/menu' },
    ],
  },
  {
    fullName: 'Coral Sea Resort',
    email: 'coral@sint.sb',
    accountType: 'company',
    category: 'Accommodations',
    location: 'Honiara, Guadalcanal',
    bio: 'Beachfront rooms, conference facilities and sunset views over Iron Bottom Sound.',
    phone: '+677 20000',
    address: 'Point Cruz, Honiara',
    links: [{ label: 'Website', url: 'https://coralsearesort.example' }],
  },
  {
    fullName: 'Tavanipupu Island Tours',
    email: 'tours@sint.sb',
    accountType: 'business',
    category: 'Travel & Transportation',
    location: 'Marau Sound, Guadalcanal',
    bio: 'Day trips, dive charters and village tours across the Solomons.',
    phone: '+677 34567',
    address: 'Marau Sound',
    links: [{ label: 'Instagram', url: 'https://instagram.com/tavanipupu' }],
  },
  {
    fullName: 'Pacific Glow Beauty Bar',
    email: 'glow@sint.sb',
    accountType: 'business',
    category: 'Beauty & Fashion',
    location: 'Ranadi, Honiara',
    bio: 'Hair, nails and bridal packages by island stylists.',
    phone: '+677 25555',
    address: 'Ranadi Industrial Area',
    links: [],

  },
  {
    fullName: 'Iron Bottom Fitness',
    email: 'fitness@sint.sb',
    accountType: 'business',
    category: 'Health Care',
    location: 'Honiara, Guadalcanal',
    bio: 'Gym, group classes and wellness coaching for all fitness levels.',
    phone: '+677 26262',
    address: 'Kukum Highway, Honiara',
    links: [],

  },
  {
    fullName: 'Auki Hardware & Supplies',
    email: 'auki@sint.sb',
    accountType: 'company',
    category: 'Retail Shops',
    location: 'Auki, Malaita',
    bio: 'Building materials, tools and solar kits shipped province wide.',
    phone: '+677 40111',
    address: 'Loboi Avenue, Auki',
    links: [],

  },
  {
    fullName: 'Club Wantok',
    email: 'wantok@sint.sb',
    accountType: 'business',
    category: 'Bars & Nightlife',
    location: 'Point Cruz, Honiara',
    bio: 'Live island music, DJs and the friendliest bar staff in town.',
    phone: '+677 23232',
    address: 'Point Cruz, Honiara',
    links: [],

  },
  {
    fullName: 'Joyce Maeta Design',
    email: 'joyce@sint.sb',
    accountType: 'freelancer',
    category: 'Retail Shops',
    location: 'Gizo, Western Province',
    bio: 'Freelance graphic designer. Logos, signage and social media kits.',
    phone: '+677 60123',
    address: 'Gizo',
    links: [{ label: 'Website', url: 'https://joycemaeta.example' }],
  },
  {
    fullName: 'Peter Sale',
    email: 'peter@sint.sb',
    accountType: 'user',
    location: 'Honiara, Guadalcanal',
    bio: 'Looking for good food and weekend trips around Honiara.',
  },
  {
    fullName: 'Mary Kolomana',
    email: 'mary@sint.sb',
    accountType: 'user',
    location: 'Auki, Malaita',
    bio: 'Teacher. Supporting local Solomon Islands businesses.',
  },
];

const postsByEmail = {
  'demo@sint.sb': [
    {
      content:
        'Demo post — this account exists so the whole flow can be exercised end to end: publish, comment, message, subscribe.',
      media: [{ type: 'image', url: image('sint-demo-1') }],
    },
    {
      content: 'Second demo post. Nothing here is real, so edit or delete it freely.',
      media: [],
    },
  ],
  'lime@sint.sb': [
    {
      content: 'Fresh tuna poke bowls are back on the menu today. Come in before 2pm!',
      media: [{ type: 'image', url: image('sint-lime-1') }],
    },
    {
      content: 'New opening hours: Monday to Saturday, 7am until 9pm. Sunday brunch from 8am.',
      media: [],
    },
  ],
  'coral@sint.sb': [
    {
      content: 'Weekend package: two nights, breakfast for two and airport transfers included.',
      media: [
        { type: 'image', url: image('sint-coral-1') },
        { type: 'image', url: image('sint-coral-2') },
      ],
    },
  ],
  'tours@sint.sb': [
    {
      content: 'Saturday dive charter to Bonegi has three seats left. Message us to book.',
      media: [{ type: 'image', url: image('sint-tours-1') }],
      location: 'Bonegi Beach',
    },
  ],
  'glow@sint.sb': [
    {
      content: 'Bridal season is here. Book your trial before the end of the month for 20% off.',
      media: [{ type: 'image', url: image('sint-glow-1') }],
    },
  ],
  'fitness@sint.sb': [
    {
      content: 'Free community bootcamp this Sunday, 6am at the Panatina field. All welcome.',
      media: [],
    },
  ],
  'auki@sint.sb': [
    {
      content: 'Solar kits restocked: 200W panels, batteries and inverters ready for pickup in Auki.',
      media: [{ type: 'image', url: image('sint-auki-1') }],
    },
  ],
  'wantok@sint.sb': [
    {
      content: 'Live band Friday night from 8pm. No cover charge before 9pm.',
      media: [{ type: 'image', url: image('sint-wantok-1') }],
    },
  ],
  'joyce@sint.sb': [
    {
      content: 'Just finished a signage refresh for a Gizo guesthouse. Taking new work next week.',
      media: [
        { type: 'image', url: image('sint-joyce-1') },
        { type: 'image', url: image('sint-joyce-2') },
      ],
    },
  ],
};

async function seed() {
  await connectDb();

  await Promise.all([
    User.deleteMany({}),
    Post.deleteMany({}),
    Comment.deleteMany({}),
    Follow.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    Notification.deleteMany({}),
  ]);

  const usersByEmail = new Map();
  for (const [index, account] of accounts.entries()) {
    const user = new User({
      ...account,
      contactEmail: account.email,
      avatarUrl: image(`sint-avatar-${index}`),
      coverUrl: account.accountType === 'user' ? '' : image(`sint-cover-${index}`),
    });
    if (PUBLISHER_TYPES.includes(account.accountType)) {
      user.subscription = { ...user.subscription.toObject(), ...(subscriptions[account.email] ?? defaultSubscription) };
    }
    await user.setPassword(DEMO_PASSWORD);
    await user.save();
    usersByEmail.set(account.email, user);
  }

  const createdPosts = [];
  for (const [email, posts] of Object.entries(postsByEmail)) {
    const author = usersByEmail.get(email);
    for (const draft of posts) {
      const post = await Post.create({
        author: author._id,
        content: draft.content,
        media: draft.media ?? [],
        category: author.category,
        location: draft.location ?? author.location,
      });
      createdPosts.push(post);
    }
    author.postCount = posts.length;
    await author.save();
  }

  // Peter follows food, travel and nightlife; Mary follows the Auki hardware store.
  const follows = [
    ['peter@sint.sb', 'lime@sint.sb'],
    ['peter@sint.sb', 'tours@sint.sb'],
    ['peter@sint.sb', 'wantok@sint.sb'],
    ['mary@sint.sb', 'auki@sint.sb'],
    ['mary@sint.sb', 'joyce@sint.sb'],
  ];
  for (const [followerEmail, followingEmail] of follows) {
    const follower = usersByEmail.get(followerEmail);
    const following = usersByEmail.get(followingEmail);
    await Follow.create({ follower: follower._id, following: following._id });
    await User.updateOne({ _id: follower._id }, { $inc: { followingCount: 1 } });
    await User.updateOne({ _id: following._id }, { $inc: { followerCount: 1 } });
    await notify({
      user: following._id,
      actor: follower._id,
      type: 'follow',
      text: `${follower.fullName} started following you`,
    });
  }

  const peter = usersByEmail.get('peter@sint.sb');
  const mary = usersByEmail.get('mary@sint.sb');
  const firstPost = createdPosts[0];

  await Post.updateOne(
    { _id: firstPost._id },
    { $addToSet: { likes: peter._id }, $inc: { likeCount: 1 } },
  );
  await notify({
    user: firstPost.author,
    actor: peter._id,
    type: 'like',
    text: `${peter.fullName} liked your post`,
    post: firstPost._id,
  });

  const comment = await Comment.create({
    post: firstPost._id,
    author: peter._id,
    text: 'Best poke bowl in Honiara. See you at lunch!',
  });
  await Comment.create({
    post: firstPost._id,
    author: firstPost.author,
    parent: comment._id,
    text: 'Thanks Peter, table will be ready.',
  });
  await Comment.updateOne({ _id: comment._id }, { $inc: { replyCount: 1 } });
  await Post.updateOne({ _id: firstPost._id }, { $inc: { commentCount: 2 } });
  await notify({
    user: firstPost.author,
    actor: peter._id,
    type: 'comment',
    text: `${peter.fullName} commented on your post`,
    post: firstPost._id,
    comment: comment._id,
  });

  await User.updateOne({ _id: mary._id }, { $addToSet: { savedPosts: createdPosts.at(-1)._id } });

  const lime = usersByEmail.get('lime@sint.sb');
  const conversation = await Conversation.create({ participants: [peter._id, lime._id] });
  const messages = [
    [peter._id, 'Hi, do you cater for a 30 person office lunch?'],
    [lime._id, 'Yes we do. What date were you thinking?'],
    [peter._id, 'Friday next week, around midday.'],
  ];
  for (const [sender, text] of messages) {
    await Message.create({ conversation: conversation._id, sender, text });
  }
  conversation.lastMessage = {
    text: messages.at(-1)[1],
    sender: messages.at(-1)[0],
    at: new Date(),
  };
  conversation.unread.set(lime._id.toString(), 1);
  await conversation.save();
  await notify({
    user: lime._id,
    actor: peter._id,
    type: 'message',
    text: `${peter.fullName} sent you a message`,
    conversation: conversation._id,
  });

  console.log(
    `Seeded ${accounts.length} accounts, ${createdPosts.length} posts, ${follows.length} follows.`,
  );
  console.log(`Sign in with any email above, password: ${DEMO_PASSWORD}`);

  await disconnectDb();
}

seed().catch(async (error) => {
  console.error('Seed failed:', error);
  await disconnectDb();
  process.exit(1);
});
