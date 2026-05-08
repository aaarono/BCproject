# Bachelor Project

Production-oriented marketplace MVP for digital goods and services.

Main focus of the project:
- strong domain invariants for escrow and wallet operations
- ownership-based authorization (not strict buyer/seller action gating)
- realtime user experience for chat, inbox, and deal state changes

## Current Features

### Auth and User Profile
- JWT auth with protected routes
- Profile and settings management
- Avatar upload
- Password change
- Payment card linking/unlinking (for wallet operations)

### Listings and Catalog
- Listing create/edit/archive/restore
- Listing categories, tags, stock quantity for goods
- Smart catalog filters and sorting
    - type, category, tags
    - price range
    - seller rating
    - sale priority
    - only online sellers
- Listing price history endpoint and chart

### Flash Sales
- Time-bound sales with validation and anti-abuse rules
- Effective price + sale badges in UI

### Conversations and Realtime Chat
- Conversation context is bound to listing + buyer + seller
- Hybrid model
    - REST for history and pagination
    - WebSocket for realtime messages/events
- Message media attachments (images/videos, multiple files)
- Inbox realtime updates and unread counters

### Deals and Escrow
- Deal lifecycle
    - INITIATED, FUNDED, DELIVERED, COMPLETED, CANCELED
- Current create flow lands into FUNDED when buyer has enough balance
- Escrow semantics preserved
    - lock funds on funding
    - release on completion
    - refund on cancel
- Atomic deal + wallet money operations via database transactions

### Wallet and Ledger
- User wallet balance
- Top-up and withdraw operations
- Escrow lock/release/refund ledger entries
- Transaction history for auditability

### Reviews and Reputation
- One review per completed deal
- Seller rating aggregation
- Reputation displayed in listings and profiles

### Top Sellers and Achievements
- Overall and weekly top sellers endpoints and pages
- Achievements MVP
    - definitions
    - manual assignment via admin
    - automatic sync by user stats
    - public/profile display

### Admin
- Admin panel with moderation and management for
    - users
    - listings
    - deals
    - reviews
    - achievements

## Architecture Principles

- No strict marketplace role gating for actions:
    authorization is based on authentication + ownership checks.
- Financial operations are atomic and transaction-safe.
- Wallet + transaction ledger are mandatory and preserved.
- Realtime updates are WebSocket-first for inbox/chat/deals.
- Validation is strict globally (whitelist + forbid non-whitelisted + transform).

## Tech Stack

- Backend: NestJS, Prisma, PostgreSQL, JWT, Socket.IO
- Frontend: React, Vite, TypeScript, Tailwind CSS
- Infra: Docker, Docker Compose, GitHub Actions CI

## Production Readiness Highlights

- Backend Docker runs in production mode (`NODE_ENV=production`, `prisma migrate deploy`, `start:prod`).
- Frontend Docker serves production build via Nginx (SPA fallback enabled).
- Docker services include healthchecks (db, backend, frontend).
- Backend lint and e2e are green.
- Structured request logging is enabled with `x-request-id` correlation.

## Repository Structure

```text
.
├── apps/
│   ├── backend/
│   └── frontend/
├── docker-compose.yml
├── TODO.md
└── README.md
```

## Quick Start

### Option A: Full stack in Docker (one command)

1) Start database, backend, and frontend

```bash
docker compose up --build -d
```

URLs:
- Frontend: http://localhost:8080
- Backend API: http://localhost:3000
- Swagger: http://localhost:3000/api/docs

2) Run smoke checks

PowerShell:

scripts/smoke.ps1

### Option B: Backend + DB in Docker, Frontend locally

1) Start database and backend

```bash
docker compose up --build -d db backend
```

2) Start frontend locally

```bash
cd apps/frontend
npm install
npm run dev
```

URLs:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Swagger: http://localhost:3000/api/docs

Note:
- Docker backend starts in production mode via `apps/backend/docker-entrypoint.sh`.

### Option C: Fully local development

Backend:

```bash
cd apps/backend
npm install
npx prisma migrate deploy
npm run start:dev
```

Frontend:

```bash
cd apps/frontend
npm install
npm run dev
```

## Environment

Backend expects environment variables in apps/backend/.env.

Commonly used values:
- DATABASE_URL
- JWT_SECRET
- CORS_ORIGIN
- PORT
- APP_BASE_URL
- SMTP_HOST
- SMTP_PORT
- SMTP_SECURE
- SMTP_USER
- SMTP_PASS
- SMTP_FROM

Frontend can use:
- VITE_API_URL
- VITE_WS_URL

## Quality and CI

CI workflow runs for backend and frontend:
- dependency install
- security audit
- lint
- backend unit tests
- backend e2e tests
- frontend tests (if present)
- build

Pipeline file:
- .github/workflows/ci.yml

Local quality checks:

```bash
# backend
cd apps/backend
npm run lint
npm test -- --runInBand
npm run test:e2e
npm run build

# frontend
cd apps/frontend
npm run lint
npm run build
```

## Notes

- Current implementation is an MVP with strong domain foundations.
- Planned enhancements are tracked in TODO.md.