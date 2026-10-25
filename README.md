# TaskNest – Student Task Manager

Module 4 · Practical 2 — a responsive **Student Task Management** web app built with **Node.js, Express.js and SQLite**, containerized with **Docker** and deployed to the **cloud (Render)**.

🔗 **Live URL:** `https://<your-app-name>.onrender.com` *(update after deploying)*

## Features
- Create, view, update and delete tasks (full **CRUD**) from a Bootstrap 5 interface
- Each task has a title, subject, description, priority, status and due date
- Live stats: total, pending, in progress, completed and **overdue**
- Search, filter by status and priority, and sorting with open and nearest-due tasks first
- Quick status change (PATCH) and full edit in a modal (PUT)
- **Persistent storage** in an SQLite database file, kept in a Docker volume
- Validation with Zod, security headers (helmet + Content Security Policy), CORS and rate limiting
- Health check endpoint used by Docker and the cloud platform
- Graceful shutdown on `docker stop`
- 28 automated tests (Jest + Supertest)

## Tech stack
| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Bootstrap 5, JavaScript (`fetch`) |
| Backend | Node.js 24, Express.js 5 |
| Database | SQLite (Node's built-in `node:sqlite`) |
| Validation / security | Zod, helmet, cors, express-rate-limit |
| Testing | Jest, Supertest |
| DevOps | Docker (multi-stage build), Docker Compose, GitHub, Render |

## Project structure
```
tasknest/
├── src/
│   ├── app.js                  # Express app: security, API routes, static frontend
│   ├── server.js               # Starts server, graceful shutdown
│   ├── config/env.js           # Environment variables
│   ├── db/database.js          # Opens SQLite file, creates the tasks table
│   ├── routes/task.routes.js
│   ├── controllers/task.controller.js
│   ├── services/task.service.js   # All SQL lives here
│   ├── validators/task.validator.js
│   ├── middlewares/            # validate, errorHandler
│   └── utils/ApiError.js
├── public/                     # Frontend served by Express
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── tests/tasks.test.js
├── Dockerfile                  # Multi-stage, non-root, healthcheck
├── .dockerignore
├── docker-compose.yml          # Optional one-command run
├── .env.example
└── package.json
```

## REST API
Base URL: `/api/v1/tasks`

| Method | Endpoint | Description | Success |
|--------|----------|-------------|---------|
| GET | `/api/v1/tasks?status=&priority=&search=` | List tasks (with optional filters) | 200 |
| GET | `/api/v1/tasks/stats` | Counts by status + overdue | 200 |
| GET | `/api/v1/tasks/:id` | Get one task | 200 |
| POST | `/api/v1/tasks` | Create a task | 201 |
| PUT | `/api/v1/tasks/:id` | Replace a task | 200 |
| PATCH | `/api/v1/tasks/:id` | Update some fields (e.g. status) | 200 |
| DELETE | `/api/v1/tasks/:id` | Delete a task | 200 |
| GET | `/health` | Service + database status | 200 / 503 |

Example body:
```json
{
  "title": "Finish DBMS practical",
  "subject": "DBMS",
  "description": "Joins + transactions",
  "priority": "high",
  "status": "pending",
  "due_date": "2026-11-05"
}
```
`priority`: `low | medium | high` · `status`: `pending | in-progress | completed` · `due_date`: `YYYY-MM-DD` or `null`.

## Run without Docker
```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 28 tests, in-memory database
```

## Run with Docker
```bash
docker build -t tasknest:1.0 .
docker run -d -p 3000:3000 -v tasknest-data:/app/data --name tasknest tasknest:1.0
# open http://localhost:3000
```
Or with Compose: `docker compose up -d --build`

| Command | Purpose |
|---------|---------|
| `docker ps` | Running containers (shows `healthy`) |
| `docker logs -f tasknest` | Follow logs |
| `docker stop tasknest` / `docker start tasknest` | Stop / start |
| `docker rm -f tasknest` | Remove container (data stays in the `tasknest-data` volume) |

## Environment variables
| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | HTTP port (Render sets this automatically) |
| `NODE_ENV` | `development` (`production` in Docker) | Logging / error detail |
| `DB_PATH` | `./data/tasks.db` (`/app/data/tasks.db` in Docker) | SQLite file location |
| `CORS_ORIGIN` | `*` | Allowed origins |
| `RATE_LIMIT_MAX` | `300` | API requests per 15 min per IP |

## Deployment (Render)
New **Web Service** → connect this GitHub repo → Language **Docker** → Health check path `/health` → **Deploy**.
On the free plan the file system is temporary, so data resets when the service restarts or redeploys. Attach a Render **Persistent Disk** at `/app/data` (paid plans) to keep data permanently.
