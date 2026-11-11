import mongoose from 'mongoose';

const verificationCodeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** 'email' */
    channel: {
      type: String,
      enum: ['email'],
      required: true,
    },
    /**
     * What the code is for. Reset codes and sign-up verification codes share
     * this collection, so a reset code can never be replayed to verify an email.
     */
    purpose: {
      type: String,
      enum: ['password_reset', 'email_verify'],
      default: 'password_reset',
      index: true,
    },
    /** The 6-digit code, stored as a hash so it cannot be read back. */
    codeHash: {
      type: String,
      required: true,
      select: false,
    },
    /** The destination — email address or phone number, for logging / sending. */
    destination: {
      type: String,
      required: true,
    },
    /** 10 minutes from creation. */
    expiresAt: {
      type: Date,
      required: true,
    },
    /** True once a code has been used successfully. */
    used: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

/** One active code per user at a time — prevents flooding. */
verificationCodeSchema.index({ user: 1, used: 1 });

/** Quickly expire old codes during cleanup. */
verificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const VerificationCode = mongoose.model('VerificationCode', verificationCodeSchema);
