import mongoose from 'mongoose';

const commentImageSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['image'], default: 'image' },
    url: { type: String, required: true },
  },
  { _id: false },
);

const commentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null, index: true },
    text: { type: String, default: '', trim: true, maxlength: 2000 },
    media: { type: [commentImageSchema], default: [] },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likeCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

commentSchema.index({ post: 1, parent: 1, createdAt: 1 });

export const Comment = mongoose.model('Comment', commentSchema);
