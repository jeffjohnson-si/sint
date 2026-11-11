import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { config } from './config/env.js';

async function main() {
  await connectDb();
  console.log('Connected to MongoDB');

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`SINT API listening on http://localhost:${config.port} (${config.nodeEnv})`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Failed to start SINT API:', error.message);
  process.exit(1);
});
