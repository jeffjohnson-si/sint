import mongoose from 'mongoose';
import multer from 'multer';
import { config } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

/** Central error translator: keeps stack traces out of API responses. */
export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message, details: error.details });
    return;
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large'
        : error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Too many files'
          : 'Upload failed';
    res.status(400).json({ message });
    return;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    res.status(400).json({
      message: 'Validation failed',
      details: Object.fromEntries(
        Object.entries(error.errors).map(([field, err]) => [field, err.message]),
      ),
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

  console.error('Unhandled error on %s %s', req.method, req.originalUrl, error);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ message: `No route for ${req.method} ${req.originalUrl}` });
}

export const isProdErrorLoggingEnabled = config.isProd;
