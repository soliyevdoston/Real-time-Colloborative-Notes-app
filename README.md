# Real-time Collaborative Notes App

Hiring-grade mini Google Docs implementation with:
- Auth (register/login/refresh/logout, JWT)
- Cabinet/Profile (name update + avatar upload)
- Notes CRUD
- Collaboration (owner invites collaborators by email)
- Real-time editing (TipTap + Y.js + Hocuspocus)
- Presence + online users (Socket.IO)
- Comments (real-time create/resolve)
- Version history (auto snapshots, keep last 5)

## Repository structure

- `frontend/` → Next.js 16 + TypeScript
- `backend/` → Express.js + Socket.IO + Hocuspocus + Prisma + PostgreSQL

## Tech Stack

### Frontend
- Next.js (App Router)
- React Query
- TipTap + Y.js + Hocuspocus provider
- Socket.IO client

### Backend
- Express.js (TypeScript)
- Socket.IO
- Hocuspocus server
- Prisma ORM
- PostgreSQL
- JWT + httpOnly refresh cookie

## Architecture (high-level)

1. REST API handles auth, note metadata, collaborators, comments, versions.
2. Hocuspocus server handles realtime document sync for note bodies.
3. Socket.IO handles presence, online users, comment events, version-created notifications.
4. Prisma persists users/notes/members/comments/versions/refresh tokens.

## Local setup

## 1) Backend

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Backend runs on:
- API: `http://localhost:4000`
- Hocuspocus WS: `ws://localhost:1234`

## 2) Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Frontend runs on:
- App: `http://localhost:3000`

## Environment variables

### Backend (`backend/.env`)
- `PORT=4000`
- `HOCUSPOCUS_PORT=1234`
- `FRONTEND_URL=http://localhost:3000`
- `BACKEND_PUBLIC_URL=http://localhost:4000`
- `DATABASE_URL=postgresql://...`
- `JWT_ACCESS_SECRET=...`
- `JWT_REFRESH_SECRET=...`
- `ACCESS_TOKEN_TTL=15m`
- `REFRESH_TOKEN_TTL_DAYS=7`

### Frontend (`frontend/.env.local`)
- `NEXT_PUBLIC_API_URL=http://localhost:4000/api`
- `NEXT_PUBLIC_SOCKET_URL=http://localhost:4000`
- `NEXT_PUBLIC_COLLAB_URL=ws://localhost:1234`

## API summary

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/auth/profile`
- `POST /api/auth/avatar`

### Notes
- `GET /api/notes`
- `POST /api/notes`
- `GET /api/notes/:noteId`
- `PATCH /api/notes/:noteId`
- `DELETE /api/notes/:noteId`

### Collaborators
- `POST /api/notes/:noteId/collaborators`
- `DELETE /api/notes/:noteId/collaborators/:userId`

### Comments
- `GET /api/notes/:noteId/comments`
- `POST /api/notes/:noteId/comments`
- `PATCH /api/comments/:commentId/resolve`

### Versions
- `GET /api/notes/:noteId/versions`
- `POST /api/notes/:noteId/versions/:versionId/restore`

## Socket events

Client emits:
- `presence:join`
- `presence:leave`
- `presence:cursor`
- `comment:create`
- `comment:resolve`

Server emits:
- `presence:update`
- `comment:created`
- `comment:resolved`
- `version:created`

## Build check

Validated locally:
- `cd backend && npm run build` ✅
- `cd frontend && npm run build` ✅
