import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.js';
import { commentsRouter } from './routes/comments.js';
import { conversationsRouter } from './routes/conversations.js';
import { notificationsRouter } from './routes/notifications.js';
import { postsRouter } from './routes/posts.js';
import { searchRouter } from './routes/search.js';
import { subscriptionRouter, dodoWebhookHandler } from './routes/subscription.js';
import { suggestionsRouter } from './routes/suggestions.js';
import { uploadRouter } from './routes/uploads.js';
import { usersRouter } from './routes/users.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(
    cors({
      origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
      credentials: true,
    }),
  );
  // Payment webhooks need the raw body to verify the signature.
  app.post(
    '/api/subscription/webhook',
    express.raw({ type: 'application/json' }),
    dodoWebhookHandler,
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(config.isProd ? 'combined' : 'dev'));
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: config.isProd ? 300 : 5000,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );

  app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d', index: false }));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', env: config.nodeEnv });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/posts', postsRouter);
  app.use('/api/comments', commentsRouter);
  app.use('/api/conversations', conversationsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/subscription', subscriptionRouter);
  app.use('/api/suggestions', suggestionsRouter);
  app.use('/api/uploads', uploadRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
