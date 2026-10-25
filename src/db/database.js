// Opens the SQLite database (a single file) using Node's built-in `node:sqlite` module
// and creates the tasks table on first run. No separate database server is needed.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config/env');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL CHECK (length(title) BETWEEN 3 AND 100),
    description TEXT    NOT NULL DEFAULT '',
    subject     TEXT    NOT NULL DEFAULT 'General',
    priority    TEXT    NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('low', 'medium', 'high')),
    status      TEXT    NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in-progress', 'completed')),
    due_date    TEXT,                                        -- YYYY-MM-DD or NULL
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
`;

function openDatabase(file) {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true }); // make sure ./data exists
  }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;'); // better concurrency + crash safety
  db.exec(SCHEMA);
  return db;
}

const db = openDatabase(config.dbPath);

module.exports = db;
