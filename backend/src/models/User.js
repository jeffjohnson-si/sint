import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ACCOUNT_TYPES, CATEGORIES, PUBLISHER_TYPES } from '../config/constants.js';
import { config } from '../config/env.js';
import { isVerifiedBusiness } from '../utils/verified.js';

const profileLinkSchema = new mongoose.Schema(
  {
    label: { type: String, default: '', maxlength: 40 },
    url: { type: String, required: true },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 200,
    },
    passwordHash: { type: String, required: true, select: false },
    accountType: { type: String, required: true, enum: ACCOUNT_TYPES, default: 'user' },

    /**
     * Whether the address has been confirmed with a 6-digit code. Defaults to
     * true so seeded and pre-existing accounts are not locked out; sign-up sets
     * it to false explicitly and only /auth/verify-email flips it back.
     */
    emailVerified: { type: Boolean, default: true },
    emailVerifiedAt: { type: Date, default: null },

    avatarUrl: { type: String, default: '' },
    coverUrl: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 1000 },
    category: { type: String, enum: [...CATEGORIES, ''], default: '' },
    location: { type: String, default: '', maxlength: 200 },
    phone: { type: String, default: '', maxlength: 40 },
    address: { type: String, default: '', maxlength: 300 },
    contactEmail: { type: String, default: '', maxlength: 200 },

    /** Free-form profile links (website, Facebook, catalogue...), any account type. */
    links: { type: [profileLinkSchema], default: [] },

    savedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    postCount: { type: Number, default: 0 },
    followerCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },

    /** Category -> score, grown by searches, follows, likes, saves and comments. */
    interests: { type: Map, of: Number, default: () => new Map() },

    /** Billing state. Only publisher accounts ever leave the 'none' status. */
    subscription: {
      status: {
        type: String,
        enum: ['none', 'trialing', 'active', 'past_due', 'canceled'],
        default: 'none',
      },
      plan: { type: String, enum: ['', 'monthly', 'yearly'], default: '' },
      trialEndsAt: { type: Date, default: null },
      currentPeriodEnd: { type: Date, default: null },
      cancelAtPeriodEnd: { type: Boolean, default: false },
      /** Subscription id from Dodo Payments, set on checkout and by the webhook. */
      dodoSubscriptionId: { type: String, default: '' },
    },



    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetExpiresAt: { type: Date, default: null, select: false },
  },
  { timestamps: true },
);

userSchema.index({ fullName: 'text', bio: 'text', category: 'text', location: 'text' });
userSchema.index({ accountType: 1, category: 1 });
// Serves `boostedAuthorIds`, which runs on every feed and suggestions request.
userSchema.index({ 'subscription.status': 1, 'subscription.currentPeriodEnd': 1 });

userSchema.virtual('isPublisher').get(function isPublisher() {
  return PUBLISHER_TYPES.includes(this.accountType);
});

/**
 * Effective billing status: a stored 'trialing' or 'active' that has run past
 * its end date reads as 'canceled', so nothing depends on a cron job.
 */
userSchema.methods.subscriptionStatus = function subscriptionStatus() {
  if (!PUBLISHER_TYPES.includes(this.accountType)) return 'none';

  const now = Date.now();
  const { status, trialEndsAt, currentPeriodEnd } = this.subscription ?? {};

  if (status === 'trialing') {
    return trialEndsAt && trialEndsAt.getTime() > now ? 'trialing' : 'canceled';
  }
  if (status === 'active' || status === 'past_due') {
    return currentPeriodEnd && currentPeriodEnd.getTime() > now ? status : 'canceled';
  }
  return status ?? 'none';
};

/** Publishers may only post while trialing or paid up. */
userSchema.methods.canPublish = function canPublish() {
  return ['trialing', 'active'].includes(this.subscriptionStatus());
};

/** Paid businesses are pushed up the For You feed and the Suggested strip. */
userSchema.methods.isBoosted = function isBoosted() {
  return this.subscriptionStatus() === 'active';
};

/** The verified badge is a yearly plan perk. */
userSchema.methods.isVerified = function isVerified() {
  return isVerifiedBusiness(this);
};

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 12);
};

userSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

/** Shape sent to clients. Never includes credentials. */
userSchema.methods.toPublicJson = function toPublicJson(options = {}) {
  return {
    id: this._id.toString(),
    fullName: this.fullName,
    email: options.includeEmail ? this.email : undefined,
    accountType: this.accountType,
    isPublisher: PUBLISHER_TYPES.includes(this.accountType),
    isVerified: this.isVerified(),
    emailVerified: this.emailVerified !== false,
    avatarUrl: this.avatarUrl,
    coverUrl: this.coverUrl,
    bio: this.bio,
    category: this.category,
    location: this.location,
    phone: this.phone,
    address: this.address,
    contactEmail: this.contactEmail,
    links: (this.links ?? []).map((link) => ({ label: link.label ?? '', url: link.url })),
    subscription: PUBLISHER_TYPES.includes(this.accountType)
      ? {
          status: this.subscriptionStatus(),
          plan: this.subscription?.plan ?? '',
          trialEndsAt: this.subscription?.trialEndsAt ?? null,
          currentPeriodEnd: this.subscription?.currentPeriodEnd ?? null,
          cancelAtPeriodEnd: this.subscription?.cancelAtPeriodEnd ?? false,
          canPublish: config.billingEnforced ? this.canPublish() : true,
          isBoosted: this.isBoosted(),
        }
      : null,
    postCount: this.postCount,
    followerCount: this.followerCount,
    followingCount: this.followingCount,
    isFollowing: options.isFollowing,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model('User', userSchema);
