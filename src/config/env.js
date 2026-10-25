// Reads configuration from environment variables (and a local .env file if present).
// Inside Docker / on the cloud, values come from `docker run -e ...` or the platform's settings.
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const nodeEnv = process.env.NODE_ENV || 'development';

module.exports = {
  nodeEnv,
  port: Number(process.env.PORT) || 3000,
  // Tests use an in-memory database so they never touch real data
  dbPath: process.env.DB_PATH || (nodeEnv === 'test' ? ':memory:' : path.resolve(__dirname, '../../data/tasks.db')),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 300,
};
