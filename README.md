# Mountain Hut Management System

### Apache Licence 2.0 - Justification
We chose the Apache 2.0 License to promote maximum adoption, transparency, and community collaboration. By using this permissive industry-standard license, we make it easy and safe for developers to integrate, modify, and distribute the software without copyleft restrictions. This open foundation allows us to build a sustainable business by offering managed cloud services and enterprise-grade tools for teams that need a hands-off solution.

## Project Structure
- `/backend` — Node.js + Express server with Prisma ORM (PostgreSQL) and Prisma Client
- `/frontend` — React + TypeScript (Vite) client application

## Getting Started

### 1. Backend

#### 1.1 Prerequisites

```bash
cd backend
npm install
```

#### 1.2 Docker and prisma configuration

```bash
cd backend
docker compose up -d
npx prisma migrate dev --config prisma7.config.ts
npx prisma generate --config prisma7.config.ts
```

#### 1.3 Run Backend
```bash
cd backend
npm run dev
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 3. Testing

#### 3.1 Unit Tests
```bash
cd backend
npm run test:unit
```

#### 3.2 Integration Tests
```bash
cd backend
npm run test:integration
```

#### 3.3 Full Test Suite
```bash
cd backend
npm run test
```