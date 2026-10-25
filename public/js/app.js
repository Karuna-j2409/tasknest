// =========================================================
// TaskNest frontend: talks to the REST API with fetch()
// =========================================================

const API = '/api/v1/tasks';

const els = {
  form: document.getElementById('taskForm'),
  list: document.getElementById('taskList'),
  empty: document.getElementById('emptyState'),
  search: document.getElementById('searchInput'),
  statusFilter: document.getElementById('statusFilter'),
  priorityFilter: document.getElementById('priorityFilter'),
  editForm: document.getElementById('editForm'),
  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toastMessage'),
};

const editModal = new bootstrap.Modal(document.getElementById('editModal'));
const toast = new bootstrap.Toast(els.toast, { delay: 2500 });
let tasksById = {};

// ---------- API helper ----------
// Sends a request and returns the JSON body; throws an Error with the server's message on failure
async function api(path = '', options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await response.json();
  if (!response.ok) {
    const details = body.errors ? `: ${body.errors.map((e) => e.message).join(', ')}` : '';
    throw new Error(`${body.message}${details}`);
  }
  return body;
}

// ---------- Rendering ----------
// Escape user text before putting it into HTML (prevents XSS)
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function formatDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isOverdue(task) {
  const today = new Date().toISOString().slice(0, 10);
  return task.status !== 'completed' && task.due_date && task.due_date < today;
}

function taskCard(task) {
  const statusOptions = [
    ['pending', 'Pending'],
    ['in-progress', 'In progress'],
    ['completed', 'Completed'],
  ]
    .map(([value, label]) => `<option value="${value}" ${task.status === value ? 'selected' : ''}>${label}</option>`)
    .join('');

  const due = task.due_date
    ? `<span class="due-date ${isOverdue(task) ? 'overdue' : ''}"><i class="bi bi-calendar-event me-1"></i>${
        isOverdue(task) ? 'Overdue · ' : ''
      }${formatDate(task.due_date)}</span>`
    : '';

  return `
    <article class="task-card priority-${task.priority} ${task.status === 'completed' ? 'is-completed' : ''}" data-id="${task.id}">
      <div class="d-flex flex-wrap justify-content-between gap-2">
        <h3 class="task-title">${escapeHtml(task.title)}</h3>
        <div class="task-actions">
          <select class="form-select form-select-sm status-select" data-action="status" aria-label="Change status">${statusOptions}</select>
          <button class="btn btn-sm btn-outline-secondary" data-action="edit" aria-label="Edit task"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" data-action="delete" aria-label="Delete task"><i class="bi bi-trash"></i></button>
        </div>
      </div>
      ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
      <div class="task-meta mt-2">
        <span class="badge badge-soft">${escapeHtml(task.subject)}</span>
        <span class="badge text-bg-light text-capitalize">${task.priority} priority</span>
        ${due}
      </div>
    </article>`;
}

function renderTasks(tasks) {
  tasksById = Object.fromEntries(tasks.map((t) => [t.id, t]));
  els.list.innerHTML = tasks.map(taskCard).join('');
  els.empty.classList.toggle('d-none', tasks.length > 0);
}

function renderStats(stats) {
  document.getElementById('statTotal').textContent = stats.total;
  document.getElementById('statPending').textContent = stats.pending;
  document.getElementById('statProgress').textContent = stats.in_progress;
  document.getElementById('statCompleted').textContent = stats.completed;
  document.getElementById('statOverdue').textContent = stats.overdue;
}

function showToast(message, type = 'success') {
  els.toast.classList.remove('toast-success', 'toast-error');
  els.toast.classList.add(`toast-${type}`);
  els.toastMessage.textContent = message;
  toast.show();
}

// ---------- Load data ----------
async function refresh() {
  const params = new URLSearchParams();
  if (els.statusFilter.value) params.set('status', els.statusFilter.value);
  if (els.priorityFilter.value) params.set('priority', els.priorityFilter.value);
  if (els.search.value.trim()) params.set('search', els.search.value.trim());

  try {
    const [list, stats] = await Promise.all([api(`?${params}`), api('/stats')]);
    renderTasks(list.data);
    renderStats(stats.data);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------- Create ----------
els.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!els.form.checkValidity()) {
    els.form.classList.add('was-validated');
    return;
  }

  const task = {
    title: document.getElementById('title').value,
    subject: document.getElementById('subject').value.trim() || 'General',
    description: document.getElementById('description').value,
    priority: document.getElementById('priority').value,
    due_date: document.getElementById('dueDate').value || null,
  };

  try {
    await api('', { method: 'POST', body: JSON.stringify(task) });
    els.form.reset();
    els.form.classList.remove('was-validated');
    showToast('Task added');
    refresh();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ---------- Status change / edit / delete (one listener for all cards) ----------
els.list.addEventListener('change', async (event) => {
  if (event.target.dataset.action !== 'status') return;
  const id = event.target.closest('.task-card').dataset.id;
  try {
    await api(`/${id}`, { method: 'PATCH', body: JSON.stringify({ status: event.target.value }) });
    showToast('Status updated');
    refresh();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

els.list.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = button.closest('.task-card').dataset.id;

  if (button.dataset.action === 'edit') {
    openEditModal(tasksById[id]);
  }

  if (button.dataset.action === 'delete') {
    if (!confirm(`Delete "${tasksById[id].title}"?`)) return;
    try {
      await api(`/${id}`, { method: 'DELETE' });
      showToast('Task deleted');
      refresh();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
});

// ---------- Edit (PUT replaces the whole task) ----------
function openEditModal(task) {
  document.getElementById('editId').value = task.id;
  document.getElementById('editTitle').value = task.title;
  document.getElementById('editSubject').value = task.subject;
  document.getElementById('editDescription').value = task.description;
  document.getElementById('editPriority').value = task.priority;
  document.getElementById('editStatus').value = task.status;
  document.getElementById('editDueDate').value = task.due_date || '';
  els.editForm.classList.remove('was-validated');
  editModal.show();
}

els.editForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!els.editForm.checkValidity()) {
    els.editForm.classList.add('was-validated');
    return;
  }

  const id = document.getElementById('editId').value;
  const task = {
    title: document.getElementById('editTitle').value,
    subject: document.getElementById('editSubject').value.trim() || 'General',
    description: document.getElementById('editDescription').value,
    priority: document.getElementById('editPriority').value,
    status: document.getElementById('editStatus').value,
    due_date: document.getElementById('editDueDate').value || null,
  };

  try {
    await api(`/${id}`, { method: 'PUT', body: JSON.stringify(task) });
    editModal.hide();
    showToast('Task updated');
    refresh();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ---------- Filters (search waits until typing pauses) ----------
let searchTimer;
els.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(refresh, 300);
});
els.statusFilter.addEventListener('change', refresh);
els.priorityFilter.addEventListener('change', refresh);

refresh();
