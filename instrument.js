import * as Sentry from '@sentry/node';
import dotenv from 'dotenv';

// Load environment variables so SENTRY_DSN can be read
dotenv.config();

Sentry.init({
    dsn: process.env.SENTRY_DSN || 'https://placeholder@o0.ingest.sentry.io/0',
    tracesSampleRate: 1.0,
});
