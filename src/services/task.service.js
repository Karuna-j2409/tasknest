// Data-access layer: the ONLY place that runs SQL for tasks.
// node:sqlite is synchronous: each call runs the query and returns the result directly.
const db = require('../db/database');

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

function findAll({ status, priority, search } = {}) {
  const conditions = [];
  const params = {};

  if (status) {
    conditions.push('status = $status');
    params.status = status;
  }
  if (priority) {
    conditions.push('priority = $priority');
    params.priority = priority;
  }
  if (search) {
    conditions.push('(title LIKE $search OR subject LIKE $search OR description LIKE $search)');
    params.search = `%${search}%`;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Open tasks first, then by nearest due date (tasks without a date last), newest first
  return db.prepare(`
    SELECT * FROM tasks ${where}
    ORDER BY status = 'completed',
             due_date IS NULL,
             due_date,
             id DESC
  `).all(params);
}

function findById(id) {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) || null;
}

function create(task) {
  const result = db.prepare(`
    INSERT INTO tasks (title, description, subject, priority, status, due_date)
    VALUES ($title, $description, $subject, $priority, $status, $due_date)
  `).run(task);
  return findById(Number(result.lastInsertRowid));
}

// Used by both PUT (all fields) and PATCH (only some fields)
function update(id, changes) {
  const existing = findById(id);
  if (!existing) return null;

  const task = { ...existing, ...changes, id };
  db.prepare(`
    UPDATE tasks
    SET title = $title, description = $description, subject = $subject,
        priority = $priority, status = $status, due_date = $due_date,
        updated_at = ${NOW}
    WHERE id = $id
  `).run({
    id: task.id,
    title: task.title,
    description: task.description,
    subject: task.subject,
    priority: task.priority,
    status: task.status,
    due_date: task.due_date,
  });
  return findById(id);
}

function remove(id) {
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return result.changes > 0;
}

function stats() {
  const row = db.prepare(`
    SELECT COUNT(*)                                          AS total,
           COALESCE(SUM(status = 'pending'), 0)              AS pending,
           COALESCE(SUM(status = 'in-progress'), 0)          AS in_progress,
           COALESCE(SUM(status = 'completed'), 0)            AS completed,
           COALESCE(SUM(status <> 'completed'
                        AND due_date < date('now')), 0)      AS overdue
    FROM tasks
  `).get();
  return { ...row };
}

module.exports = { findAll, findById, create, update, remove, stats };
