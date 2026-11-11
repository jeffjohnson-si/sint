import mongoose from 'mongoose';
import { SUBSCRIPTION_PLANS } from '../config/constants.js';

/**
 * A payment a business says it has made outside the app — a bank transfer, cash,
 * or anything else settled off platform. Nothing here grants access on its own:
 * only an approval writes to the user's subscription, and every approval records
 * who made it.
 */
const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: String, enum: Object.keys(SUBSCRIPTION_PLANS), required: true },
    method: { type: String, enum: ['transfer', 'cash', 'other'], default: 'transfer' },

    /** Cents, taken from the plan on the server. Never sent by the client. */
    amount: { type: Number, required: true },
    currency: { type: String, default: 'SBD' },

    /** The transaction id or receipt number from the payment provider. */
    reference: { type: String, required: true, trim: true, uppercase: true, maxlength: 60 },
    note: { type: String, default: '', trim: true, maxlength: 500 },

    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: '', trim: true, maxlength: 500 },

    /** What the approval granted, kept so a dispute can be reconstructed. */
    grantedPeriodEnd: { type: Date, default: null },
  },
  { timestamps: true },
);

// One receipt cannot activate two accounts, and cannot be replayed later.
paymentSchema.index({ reference: 1 }, { unique: true });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ user: 1, createdAt: -1 });

paymentSchema.methods.toPublicJson = function toPublicJson() {
  return {
    id: this._id.toString(),
    plan: this.plan,
    method: this.method,
    amount: this.amount,
    currency: this.currency,
    reference: this.reference,
    note: this.note,
    status: this.status,
    reviewedAt: this.reviewedAt,
    reviewNote: this.reviewNote,
    grantedPeriodEnd: this.grantedPeriodEnd,
    createdAt: this.createdAt,
  };
};

export const Payment = mongoose.model('Payment', paymentSchema);
