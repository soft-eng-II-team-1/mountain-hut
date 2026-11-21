# Mountain Hut Management System

Full-stack application for managing a mountain hut:

- **Backend:** Node.js, Express, Passport, Prisma ORM
- **Database:** PostgreSQL
- **Frontend:** React, TypeScript, Vite
- **License:** Apache 2.0

## Project structure

- `backend/` - API, authentication, Prisma schema, and seed data
- `frontend/` - React and TypeScript web application
- `Dockerfile.deploy` - production Docker image containing the backend and frontend
- `compose.deploy.yaml` - Docker deployment with the application and PostgreSQL
- `.env.deploy.example` - template for deployment environment variables
- `docker-compose.yml` - PostgreSQL and development database configuration

## 1. Run in development mode

Development mode runs the backend and frontend separately and is intended for coding and testing.

### 1.1 Prerequisites

- Node.js 22 or newer
- npm
- Docker Engine or Docker Desktop

### 1.2 Start PostgreSQL

From the repository root:

```bash
docker compose -f docker-compose.yml up -d
```

This starts PostgreSQL with:

- User: `MountainHutUser`
- Password: `Group01SE2`
- Database: `MountainHut`
- Host port: `5432`

### 1.3 Configure and start the backend

Create or update `backend/.env` using `backend/.env.example` as a template.

Example:

```dotenv
PORT=3000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=<smtp-user>
SMTP_PASS=<smtp-password>
DATABASE_URL="postgresql://MountainHutUser:Group01SE2@localhost:5432/MountainHut?schema=public"
SESSION_SECRET=<long-random-session-secret>
```

Generate a session secret, for example:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Install dependencies, generate Prisma Client, apply migrations, and seed the database:

```bash
cd backend
npm install
npx prisma generate --config prisma7.config.ts
npx prisma migrate dev --config prisma7.config.ts
npx prisma db seed --config prisma7.config.ts
npm run dev
```

The backend is available at:

```text
http://localhost:3000
```

### 1.4 Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite, usually:

```text
http://localhost:5173
```

### 1.5 Development environment variables

| Variable | Required | Description |
|---|---:|---|
| `PORT` | No | Backend port. Defaults to `3000` |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma |
| `SESSION_SECRET` | Yes | Secret used to sign Express sessions |
| `SMTP_HOST` | No* | SMTP server hostname |
| `SMTP_PORT` | No* | SMTP server port |
| `SMTP_USER` | No* | SMTP account username |
| `SMTP_PASS` | No* | SMTP password or app password |

\*These variables are optional for starting the application. They are required together when real email delivery through an external SMTP provider is needed. When `SMTP_USER` and `SMTP_PASS` are missing, the mailer automatically uses an Ethereal test account.

The seed command resets existing seedable tables and creates the following test users:

| Role | Email | Password |
|---|---|---|
| Warden | `warden@rifugio.it` | `Password123!` |
| Employee | `employee@rifugio.it` | `Password123!` |
| Hiker | `hiker.giulia@example.com` | `Password123!` |

These seeded test accounts use example addresses that are not connected to real inboxes. They cannot be used to verify that service emails are actually received. To test email delivery, configure a real SMTP account and create an application account with an email address you can access.

Do not use development credentials or development SMTP secrets in a public deployment.

### 1.6 Stop development services

Stop the backend and frontend with `Ctrl+C`.

Stop and remove the development database containers:

```bash
docker compose -f docker-compose.yml down
```

Add `-v` to remove the PostgreSQL data volume as well:

```bash
docker compose -f docker-compose.yml down -v
```

---

## 2. Build the Docker image

Docker deployment builds a single image containing the React frontend and the Node.js backend.

### 2.1 Prerequisites

- Docker Engine or Docker Desktop
- Docker Compose V2

Verify Docker:

```bash
docker --version
docker compose version
```

### 2.2 Prepare deployment environment variables

From the repository root, copy the deployment template:

```bash
cp .env.deploy.example .env.deploy
```

On Windows PowerShell:

```powershell
Copy-Item .env.deploy.example .env.deploy
```

Edit `.env.deploy` and replace every placeholder:

```dotenv
POSTGRES_USER=mountain_hut
POSTGRES_PASSWORD=<secure-postgres-password>
POSTGRES_DB=mountain_hut
SESSION_SECRET=<long-random-session-secret>
APP_PORT=8080
APP_IMAGE=docker.io/<registry-user>/mountain-hut:sprint2
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
```

Generate `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2.3 Deployment environment variables

| Variable | Required | Description |
|---|---:|---|
| `POSTGRES_USER` | Yes | PostgreSQL administrator user |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL administrator password |
| `POSTGRES_DB` | Yes | PostgreSQL database name |
| `SESSION_SECRET` | Yes | Secret used to sign Express sessions |
| `APP_PORT` | Yes | Port published on the host. Defaults to `8080` |
| `APP_IMAGE` | Yes | Public Docker image reference used by the deployment |
| `SMTP_HOST` | No* | SMTP server hostname |
| `SMTP_PORT` | No* | SMTP server port |
| `SMTP_USER` | No* | SMTP account username |
| `SMTP_PASS` | No* | SMTP password or app password |

\*These variables are optional for starting the application. They are required together when real email delivery through an external SMTP provider is needed. When `SMTP_USER` and `SMTP_PASS` are missing, the mailer automatically uses an Ethereal test account.

`DATABASE_URL`, `PORT`, and `SERVE_FRONTEND` are generated by `compose.deploy.yaml` and do not need to be placed in `.env.deploy`.

### 2.4 Build locally

Run this command from the repository root:

```bash
docker build -f Dockerfile.deploy -t mountain-hut:deployment .
```

Verify that the image exists:

```bash
docker image ls mountain-hut
```

The build:

- Builds the frontend
- Copies `frontend/dist` into the backend `public/` directory
- Generates the Prisma Client
- Packages the backend and frontend into the same image

### 2.5 Publish the image

Tag the local image for Docker Hub or another registry:

```bash
docker tag mountain-hut:deployment <registry-user>/mountain-hut:sprint2
docker push <registry-user>/mountain-hut:sprint2
```

Example public image reference:

```text
docker.io/<registry-user>/mountain-hut:sprint2
```

Add the complete public image reference to the project spreadsheet before the Sprint 2 deadline.

---

## 3. Run the Docker image

Deployment runs the application and PostgreSQL with Docker Compose.

### 3.1 Run using the distributed image

Before running the application, create `.env.deploy` in the repository root. This file contains deployment configuration local to the machine that starts the image:

```dotenv
POSTGRES_USER=mountain_hut
POSTGRES_PASSWORD=<secure-postgres-password>
POSTGRES_DB=mountain_hut
SESSION_SECRET=<long-random-session-secret>
APP_PORT=8080
APP_IMAGE=docker.io/<registry-user>/mountain-hut:sprint2
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
```

Set `APP_IMAGE` in `.env.deploy` to the actual public image reference published for the project.

Then download and run the distributed image:

```bash
docker compose --env-file .env.deploy -f compose.deploy.yaml pull app
docker compose --env-file .env.deploy -f compose.deploy.yaml up -d
```

Compose will:

- Start PostgreSQL
- Wait until PostgreSQL is healthy
- Start the application container
- Apply Prisma migrations automatically
- Serve the frontend and backend through one application port
- Create the persistent volume `deployment-postgres-data`

Open:

```text
http://localhost:8080
```

If `APP_PORT` has a different value, use that port instead.

Do not publish private values in the compose file or in the Docker image. The `app` container receives private values only through environment variables at runtime.

### 3.2 Run using a locally built image

To use a local image instead of the distributed image, change the `app` image in `compose.deploy.yaml`:

```yaml
image: mountain-hut:deployment
```

Build the image and start the complete deployment:

```bash
docker build -f Dockerfile.deploy -t mountain-hut:deployment .
docker compose --env-file .env.deploy -f compose.deploy.yaml up -d
```

### 3.3 Run all containers manually

Docker Compose is the recommended method, but the equivalent container setup can be started with `docker run` after creating a PostgreSQL network and database container.

Example:

```bash
docker network create mountain-hut-network

docker run -d --name mountain_hut_deployment_db \
  --network mountain-hut-network \
  --env POSTGRES_USER=mountain_hut \
  --env POSTGRES_PASSWORD=<secure-postgres-password> \
  --env POSTGRES_DB=mountain_hut \
  --volume deployment-postgres-data:/var/lib/postgresql/data \
  postgres:16-alpine

docker run -d --name mountain_hut_deployment_app \
  --network mountain-hut-network \
  --env PORT=3000 \
  --env SERVE_FRONTEND=true \
  --env SESSION_SECRET=<long-random-session-secret> \
  --env DATABASE_URL='postgresql://mountain_hut:<secure-postgres-password>@mountain_hut_deployment_db:5432/mountain_hut?schema=public' \
  --env SMTP_HOST='' \
  --env SMTP_PORT='' \
  --env SMTP_USER='' \
  --env SMTP_PASS='' \
  --publish 8080:3000 \
  mountain-hut:deployment
```

This manual command is only an example. Docker Compose is preferred because it waits for PostgreSQL and starts the containers in the correct order.

### 3.4 Check the deployment

```bash
docker compose --env-file .env.deploy -f compose.deploy.yaml ps
docker compose --env-file .env.deploy -f compose.deploy.yaml logs -f app
```

### 3.5 Seed the deployed database

The deployed database is created and migrated automatically, but it is not necessarily seeded.

To add test users, tables, and slots:

```bash
docker compose --env-file .env.deploy -f compose.deploy.yaml exec app npx prisma db seed --config prisma7.config.ts
```

The seed deletes existing records before recreating test data. Only run it against a development or test database.

Deployment test credentials:

| Role | Email | Password |
|---|---|---|
| Warden | `warden@rifugio.it` | `Password123!` |
| Employee | `employee@rifugio.it` | `Password123!` |
| Hiker | `hiker.giulia@example.com` | `Password123!` |

### 3.6 Stop or remove the deployment

Stop containers and preserve database data:

```bash
docker compose --env-file .env.deploy -f compose.deploy.yaml down
```

Stop containers and remove the PostgreSQL volume:

```bash
docker compose --env-file .env.deploy -f compose.deploy.yaml down -v
```

---

## SMTP configuration

SMTP is optional. The application starts without SMTP, but password recovery and confirmation emails may not be delivered.

For Gmail or providers requiring two-factor authentication, use a dedicated app password in `SMTP_PASS`, not the personal account password.

Configure these variables together:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

For port `465`, the mailer uses implicit TLS.

Seeded test users do not have real email inboxes. To verify that password recovery or other service emails arrive, configure SMTP and create an account using a real email address that you can access.

---

## Testing

Run the backend tests from the `backend/` directory:

```bash
cd backend
npm run test:unit
npm run test:integration
npm run test
npm run test:coverage
```

The HTML coverage report is generated in `backend/coverage/lcov-report/index.html`.

---

## Apache License 2.0 - Justification

We chose the Apache 2.0 License to promote maximum adoption, transparency, and community collaboration. By using this permissive industry-standard license, we make it easy and safe for developers to integrate, modify, and distribute the software without copyleft restrictions. This open foundation allows us to build a sustainable business by offering managed cloud services and enterprise-grade tools for teams that need a hands-off solution.
