## Infrastructure / Tech debt (after MVP)

- [ ] Move backend Docker setup from dev to production mode
  - Replace `start:dev` with `nest build` + `node dist/main.js`
  - Add `start:docker` script to package.json
  - Remove prisma migrate dev from entrypoint, use migrate deploy
  - Use NODE_ENV=production

- [ ] Upgrade Prisma from 6.15 to 7.x
  - Move DATABASE_URL from schema.prisma to prisma.config.ts
  - Use Prisma driver adapter (@prisma/adapter-pg)
  - Update PrismaService constructor
  - Verify migrations and runtime connection

- [ ] Dockerize frontend (Vite + React)
  - Add Dockerfile for frontend
  - Add frontend service to docker-compose
  - Optional: nginx for static serving

- [ ] Upgrade TailwindCSS from v3 to v4
  - Replace PostCSS setup according to Tailwind v4 docs
  - Remove tailwind v3 config patterns if needed
  - Verify build + dev server

## Messages

- [ ] Realtime chat via WebSocket (NestJS Gateway)
  - JWT auth in WS handshake
  - Join rooms only for conversation participants
  - Emit `message:new` on send
  - Keep message history via REST (pagination)

## Wallet / Escrow (hardening)

- [ ] Make wallet + deal status updates fully atomic
  - Refactor WalletService methods to accept Prisma transaction client (tx)
  - Use single prisma.$transaction for:
    - ESCROW_LOCK + deal.status=FUNDED
    - ESCROW_RELEASE + deal.status=COMPLETED
  - Add idempotency / unique constraints to prevent duplicate ledger records per deal step

- [ ] Add dedicated Escrow wallet/account (optional, for realism)
  - Buyer pays: buyer -> escrow
  - Complete: escrow -> seller
  - Cancel/refund: escrow -> buyer
  - Store escrow balance and reconcile with ledger

## Listings improvements

- [ ] Add quantity support for listings
  - Add `quantity` field to Listing
  - Allow buyer to specify quantity when creating Deal
  - Store `unitPrice` and `quantity` in Deal (immutable snapshot)
  - Decrease listing.quantity on deal COMPLETED
  - Auto-archive listing when quantity reaches 0

## Profile

- [ ] Move profile-related endpoints to a dedicated UsersController
  - Move `/auth/users/me/profile` to `/users/me/profile`
  - Keep auth endpoints focused on login/register/token/me
  - Prepare UsersController for future settings/profile features