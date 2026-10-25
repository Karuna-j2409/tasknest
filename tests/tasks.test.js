// Integration tests: real Express app + in-memory SQLite database (NODE_ENV=test)
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db/database');

const API = '/api/v1/tasks';

afterAll(() => db.close());

describe('Health, frontend and security', () => {
  test('GET /health reports the database is up', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.database).toBe('up');
  });

  test('GET / serves the frontend HTML', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('TaskNest');
  });

  test('static CSS and JS are served', async () => {
    expect((await request(app).get('/css/style.css')).status).toBe(200);
    expect((await request(app).get('/js/app.js')).status).toBe(200);
  });

  test('security headers are set (helmet + CSP allowing the Bootstrap CDN)', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain('https://cdn.jsdelivr.net');
    expect(res.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
  });
});

describe('Create tasks', () => {
  test('POST creates a task with defaults (201)', async () => {
    const res = await request(app).post(API).send({ title: 'Revise OS notes' });
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`${API}/${res.body.data.id}`);
    expect(res.body.data).toMatchObject({
      title: 'Revise OS notes',
      subject: 'General',
      priority: 'medium',
      status: 'pending',
      due_date: null,
    });
  });

  test('POST with all fields', async () => {
    const res = await request(app).post(API).send({
      title: 'Finish DBMS assignment',
      subject: 'DBMS',
      description: 'Practical 2: joins + transactions',
      priority: 'high',
      due_date: '2000-01-01', // in the past, so it counts as overdue
    });
    expect(res.status).toBe(201);
    expect(res.body.data.priority).toBe('high');
  });

  test('POST with a future low-priority task', async () => {
    const res = await request(app).post(API).send({
      title: 'Read Docker docs',
      subject: 'DevOps',
      priority: 'low',
      due_date: '2099-12-31',
    });
    expect(res.status).toBe(201);
  });

  test('POST with invalid data returns 400 listing every problem', async () => {
    const res = await request(app).post(API).send({ title: 'x', priority: 'urgent', due_date: '31-12-2026' });
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.field)).toEqual(['title', 'priority', 'due_date']);
  });

  test('POST without title returns 400', async () => {
    const res = await request(app).post(API).send({ subject: 'Maths' });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].message).toBe('title is required');
  });

  test('POST with malformed JSON returns 400', async () => {
    const res = await request(app).post(API).set('Content-Type', 'application/json').send('{bad json');
    expect(res.status).toBe(400);
  });

  test('user text is stored as-is (escaping happens in the frontend)', async () => {
    const res = await request(app).post(API).send({ title: '<script>alert(1)</script>' });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('<script>alert(1)</script>');
    await request(app).delete(`${API}/${res.body.data.id}`);
  });
});

describe('Read tasks', () => {
  test('GET lists tasks: open tasks first, nearest due date first', async () => {
    const res = await request(app).get(API);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
    expect(res.body.data.map((t) => t.title)).toEqual([
      'Finish DBMS assignment', // due 2000-01-01
      'Read Docker docs',       // due 2099-12-31
      'Revise OS notes',        // no due date
    ]);
  });

  test('filter by priority', async () => {
    const res = await request(app).get(`${API}?priority=high`);
    expect(res.body.data.map((t) => t.title)).toEqual(['Finish DBMS assignment']);
  });

  test('search matches title, subject and description (case-insensitive)', async () => {
    const res = await request(app).get(`${API}?search=dbms`);
    expect(res.body.count).toBe(1);
    const bySubject = await request(app).get(`${API}?search=devops`);
    expect(bySubject.body.data[0].title).toBe('Read Docker docs');
  });

  test('invalid filter value returns 400', async () => {
    const res = await request(app).get(`${API}?status=done`);
    expect(res.status).toBe(400);
  });

  test('GET /:id returns one task', async () => {
    const res = await request(app).get(`${API}/1`);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Revise OS notes');
  });

  test('GET /:id for a missing task returns 404', async () => {
    expect((await request(app).get(`${API}/999`)).status).toBe(404);
  });

  test('GET /:id with a non-numeric id returns 400', async () => {
    expect((await request(app).get(`${API}/abc`)).status).toBe(400);
  });

  test('GET /stats counts tasks by status, including overdue', async () => {
    const res = await request(app).get(`${API}/stats`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ total: 3, pending: 3, in_progress: 0, completed: 0, overdue: 1 });
  });
});

describe('Update tasks', () => {
  test('PATCH changes only the fields sent', async () => {
    const res = await request(app).patch(`${API}/2`).send({ status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'completed', priority: 'high', subject: 'DBMS' });
  });

  test('completed tasks are no longer overdue and move to the end of the list', async () => {
    const stats = await request(app).get(`${API}/stats`);
    expect(stats.body.data).toMatchObject({ completed: 1, overdue: 0 });
    const list = await request(app).get(API);
    expect(list.body.data.at(-1).title).toBe('Finish DBMS assignment');
  });

  test('PATCH with an empty body returns 400', async () => {
    const res = await request(app).patch(`${API}/2`).send({});
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('body');
  });

  test('PUT replaces the whole task (missing optional fields reset to defaults)', async () => {
    const res = await request(app).put(`${API}/3`).send({ title: 'Read Docker docs fully', status: 'in-progress' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      title: 'Read Docker docs fully',
      status: 'in-progress',
      subject: 'General',
      priority: 'medium',
      due_date: null,
    });
    expect(res.body.data.updated_at >= res.body.data.created_at).toBe(true);
  });

  test('PUT without a title returns 400', async () => {
    expect((await request(app).put(`${API}/3`).send({ status: 'pending' })).status).toBe(400);
  });

  test('PUT on a missing task returns 404', async () => {
    expect((await request(app).put(`${API}/999`).send({ title: 'Ghost task' })).status).toBe(404);
  });
});

describe('Delete tasks', () => {
  test('DELETE removes the task', async () => {
    expect((await request(app).delete(`${API}/1`)).status).toBe(200);
    expect((await request(app).get(`${API}/1`)).status).toBe(404);
  });

  test('DELETE again returns 404', async () => {
    expect((await request(app).delete(`${API}/1`)).status).toBe(404);
  });
});

describe('Unknown routes', () => {
  test('unknown API route returns 404 JSON', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
