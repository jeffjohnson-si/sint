import mongoose from 'mongoose';
import { config } from './env.js';

export async function connectDb(uri = config.mongoUri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    // In development Mongoose builds any missing index on boot, which keeps the
    // dev database in step with the schemas. In production that turns every
    // deploy into an index build, so indexes are applied on purpose instead:
    // `npm run sync-indexes`.
    autoIndex: !config.isProd,
  });
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
