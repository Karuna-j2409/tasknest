// Entry point: starts the HTTP server and shuts down cleanly.
// Graceful shutdown matters in Docker: `docker stop` sends SIGTERM and waits 10 s before killing.
const app = require('./app');
const config = require('./config/env');
const db = require('./db/database');

const server = app.listen(config.port, () => {
  console.log(`TaskNest running at http://localhost:${config.port} (${config.nodeEnv})`);
  console.log(`SQLite database: ${config.dbPath}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
