import crypto from 'node:crypto';
import mongoose from 'mongoose';
import multer from 'multer';
import { HttpError } from '../utils/httpError.js';

/**
 * Every error leaves here as a short, friendly sentence.
 *
 * Details — schema names, duplicate keys, stack traces, driver messages — are
 * logged on the server and never returned, so a failed request cannot be used
 * to map the database or the code. The one exception is our own `code` tag
 * (e.g. `subscription_required`), which the client needs and which says
 * nothing about the implementation.
 */
export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof HttpError) {
    const code = error.details?.code;
    res.status(error.status).json({
      message: error.message,
      ...(code ? { details: { code } } : {}),
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'That file is too large'
        : error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Too many files'
          : 'Upload failed';
    res.status(400).json({ message });
    return;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    console.error('Validation error on %s %s:', req.method, req.originalUrl, error.message);
    res.status(400).json({
      message: 'Some of the details are not valid. Please check and try again.',
    });
    return;
  }

  if (error instanceof mongoose.Error.CastError) {
    res.status(400).json({ message: 'Invalid identifier' });
    return;
  }

  if (error?.code === 11000) {
    res.status(409).json({ message: 'That value is already taken' });
    return;
  }

  // Anything unexpected: keep the stack private, give the user a short handle
  // to quote when reporting it, and describe nothing.
  const errorId = crypto.randomUUID().slice(0, 8);
  console.error(`[${errorId}] Unhandled error on ${req.method} ${req.originalUrl}`, error);
  res.status(500).json({ message: 'Something went wrong. Please try again.', errorId });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ message: 'Not found' });
}
