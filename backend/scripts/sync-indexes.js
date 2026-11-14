/**
 * Applies the indexes declared in the Mongoose schemas to the connected
 * database. Production runs with `autoIndex: false` (see src/config/db.js), so
 * this is the deliberate step after a schema change.
 *
 * Usage:
 *   npm run sync-indexes            create any missing index, drop nothing
 *   npm run sync-indexes -- --prune also drop indexes no longer in the schemas
 *
 * `--prune` is destructive: an index created by hand outside these schemas will
 * be removed. Leave it off unless you know an old index needs to go.
 */
import { connectDb, disconnectDb } from '../src/config/db.js';
import { config } from '../src/config/env.js';
import { Comment } from '../src/models/Comment.js';
import { Conversation } from '../src/models/Conversation.js';
import { Follow } from '../src/models/Follow.js';
import { Message } from '../src/models/Message.js';
import { Notification } from '../src/models/Notification.js';
import { Post } from '../src/models/Post.js';
import { User } from '../src/models/User.js';
import { VerificationCode } from '../src/models/VerificationCode.js';

// VerificationCode matters here: its TTL index is what expires old codes, and
// production never builds indexes automatically.
const models = [
  User,
  Post,
  Comment,
  Follow,
  Notification,
  Conversation,
  Message,
  VerificationCode,
];
const prune = process.argv.includes('--prune');

async function run() {
  await connectDb();
  console.log(`Connected to ${config.mongoUri.replace(/\/\/[^@]*@/, '//***@')}`);
  console.log(prune ? 'Mode: sync (creates and drops)' : 'Mode: create only');

  for (const model of models) {
    const before = (await model.collection.indexes().catch(() => [])).length;

    if (prune) {
      const dropped = await model.syncIndexes();
      if (dropped.length > 0) console.log(`${model.modelName}: dropped ${dropped.join(', ')}`);
    } else {
      await model.createIndexes();
    }

    const after = (await model.collection.indexes()).length;
    const created = after - before;
    console.log(`${model.modelName}: ${after} indexes${created > 0 ? ` (+${created})` : ''}`);
  }

  await disconnectDb();
}

run().catch(async (error) => {
  console.error(error);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
