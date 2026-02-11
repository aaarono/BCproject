# Bachelor Project  
## Marketplace Platform for Digital Products and Services

Full-stack web application implementing a marketplace for digital goods and services  
with escrow-based deals, internal chat, wallet system and seller reputation.

This project is developed as a bachelor thesis and focuses on backend architecture,
business logic and data consistency.

---

## Core Features

### Authentication & Users
- JWT-based authentication
- User roles: **BUYER**, **SELLER**
- Secure access control per role

### Listings
- Sellers can create digital goods or service listings
- Listings are visible only when ACTIVE
- Seller reputation (rating) is displayed directly in listings

### Conversations & Chat
- Per-listing conversations between buyer and seller
- REST-based messaging (WebSocket planned)
- Access restricted to deal participants only

### Deals & Escrow
- Full deal lifecycle:
  - INITIATED → FUNDED → DELIVERED → COMPLETED
- Buyer funds are locked in escrow
- Funds are released to seller only after completion
- Strict role and state validation

### Wallet System
- Internal user wallets
- Mock balance top-up
- Escrow-based fund locking
- Transaction ledger for auditability

### Reviews & Seller Rating
- Buyers can leave reviews **only after completed deals**
- One review per deal
- Seller rating is aggregated and stored
- Seller reputation is visible in listings

---

## Tech Stack

### Backend
- **NestJS**
- **Prisma ORM**
- **PostgreSQL**
- JWT authentication
- REST API

### Frontend
- **React**
- **Vite**
- **TypeScript**
- **TailwindCSS (v3)**

### Infrastructure
- **Docker**
- **Docker Compose**

---

## Project Structure
```
.
├── apps
│ ├── backend # NestJS + Prisma API
│ └── frontend # React + Vite + Tailwind
├── docker-compose.yml
├── TODO.md
└── README.md
```
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

## Quick Start (Recommended – Docker)

### 1. Clone repository

    git clone <repo-url>
    cd BCproject

### 2. Start backend + database

    docker compose up --build

Services:

Backend API: http://localhost:3000

PostgreSQL runs inside Docker

### 3. Start frontend (local dev)

    cd apps/frontend
    npm install
    npm run dev

Frontend: http://localhost:5173

### Local Development (Without Docker)
Use this only if Docker is not available.

    cd apps/backend
    npm install
    npx prisma migrate dev
    npm run start:dev

 Requires:
 - Running PostgreSQL locally
 - Valid DATABASE_URL
 - Environment Variables
 - Backend
 - Create file:
    
    apps/backend/.env

Example:

    apps/backend/.env.example

#### Ports
- Service Port
 - Backend API	3000
 - Frontend	5173
 - PostgreSQL	5432
### Notes
- Docker setup is development-oriented
- Prisma version: 6.15
- TailwindCSS version: v3
- Planned improvements are listed in TODO.md

### Common Issues
- Docker build is very slow
- Make sure apps/backend/.dockerignore exists and ignores node_modules.
- Prisma connection errors
- Ensure DATABASE_URL matches the environment (Docker vs local PostgreSQL).

License
MIT