# Bachelor Project "Marketplace Platform for Digital Products and Services"

Full-stack web application – marketplace of digital goods and services.

## Tech Stack

- Backend: NestJS, Prisma, PostgreSQL
- Frontend: React, Vite, TypeScript, TailwindCSS
- Infrastructure: Docker, Docker Compose

---

## Requirements

### Common
- Node.js >= 18
- npm >= 9
- Docker + Docker Compose

### Tested on
- Windows 11
- macOS (Apple Silicon)

---

## Project Structure

.
├── apps
│ ├── backend # NestJS + Prisma API
│ └── frontend # React + Vite + Tailwind
├── docker-compose.yml
├── TODO.md
└── README.md


---

## Quick Start (recommended – Docker)

1. Clone repository

    git clone <repo-url>
    cd BCproject

2. Start backend + database

    docker compose up --build

Backend API:    http://localhost:3000
Health check:   http://localhost:3000/health
PostgreSQL runs inside Docker.

3. Start frontend (local dev)

    cd apps/frontend
    npm install
    npm run dev

Frontend:   http://localhost:5173

Backend (local run without Docker – optional)
Use this only if Docker is not available.

    cd apps/backend
    npm install
    npx prisma migrate dev
    npm run start:dev

Requires running PostgreSQL locally and a valid DATABASE_URL in .env.

Environment Variables
Backend
Create file:

    apps/backend/.env

Example:

    DATABASE_URL=postgresql://marketplace:marketplace@localhost:5432/marketplace?schema=public

Example file is available:

    apps/backend/.env.example

Ports:

    Service	Port
    Backend API	3000
    Frontend	5173
    PostgreSQL	5432
    
## Notes

Docker setup is currently development-oriented

Prisma version: 6.15

TailwindCSS version: v3

Planned improvements and upgrades are listed in TODO.md

Common Issues
Docker build is very slow
Make sure apps/backend/.dockerignore exists and ignores node_modules.

Prisma connection errors
Check that DATABASE_URL matches the current environment (Docker vs local).

License
MIT