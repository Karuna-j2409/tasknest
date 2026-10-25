// Builds the Express app (without starting it) so tests can import it directly
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./config/env');
const db = require('./db/database');
const taskRoutes = require('./routes/task.routes');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();

// ---- Security headers. The CSP allows Bootstrap + Google Fonts from their CDNs only ----
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'script-src': ["'self'", 'https://cdn.jsdelivr.net'],
        'style-src': ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.gstatic.com'],
        // The container serves plain HTTP (the cloud platform adds HTTPS in front),
        // so don't force browsers to upgrade asset requests to https://
        'upgrade-insecure-requests': null,
      },
    },
  })
);
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '10kb' }));

if (config.nodeEnv !== 'test') {
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
}

app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.rateLimitMax,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => config.nodeEnv === 'test',
    message: { success: false, message: 'Too many requests, please try again later' },
  })
);

// ---- Health check (used by Docker HEALTHCHECK and the cloud platform) ----
app.get('/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.status(200).json({ status: 'ok', database: 'up', uptime: Math.round(process.uptime()) });
  } catch {
    res.status(503).json({ status: 'error', database: 'down' });
  }
});

// ---- REST API ----
app.use('/api/v1/tasks', taskRoutes);

// ---- Frontend (HTML, CSS, JS) ----
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---- Errors (must be last) ----
app.use(notFound);
app.use(errorHandler);

module.exports = app;
