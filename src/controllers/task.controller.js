// HTTP layer: reads the request, calls the service, sends the response
const taskService = require('../services/task.service');
const ApiError = require('../utils/ApiError');

function findOrFail(id) {
  const task = taskService.findById(id);
  if (!task) throw ApiError.notFound(`Task with id ${id} not found`);
  return task;
}

// GET /api/v1/tasks?status=&priority=&search=
function getAll(req, res) {
  const tasks = taskService.findAll(req.validated.query);
  res.status(200).json({ success: true, count: tasks.length, data: tasks });
}

// GET /api/v1/tasks/stats
function getStats(req, res) {
  res.status(200).json({ success: true, data: taskService.stats() });
}

// GET /api/v1/tasks/:id
function getById(req, res) {
  res.status(200).json({ success: true, data: findOrFail(req.validated.params.id) });
}

// POST /api/v1/tasks
function create(req, res) {
  const task = taskService.create(req.validated.body);
  res.status(201).location(`/api/v1/tasks/${task.id}`).json({ success: true, message: 'Task created', data: task });
}

// PUT /api/v1/tasks/:id   (replace the whole task)
// PATCH /api/v1/tasks/:id (change only the fields sent)
function update(req, res) {
  const { id } = req.validated.params;
  const task = taskService.update(id, req.validated.body);
  if (!task) throw ApiError.notFound(`Task with id ${id} not found`);
  res.status(200).json({ success: true, message: 'Task updated', data: task });
}

// DELETE /api/v1/tasks/:id
function remove(req, res) {
  const { id } = req.validated.params;
  if (!taskService.remove(id)) throw ApiError.notFound(`Task with id ${id} not found`);
  res.status(200).json({ success: true, message: 'Task deleted' });
}

module.exports = { getAll, getStats, getById, create, update, remove };
