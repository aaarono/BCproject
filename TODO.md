# TODO

## Core Marketplace Features

* [ ] Public seller profile `/users/:id`

  * Show seller info (avatar, displayName)
  * Show rating and reviews
  * Show seller listings

* [ ] Allow editing existing listings

  * PATCH `/listings/:id`
  * Edit title, description, price, type

* [ ] Allow deleting / archiving listings

  * DELETE `/listings/:id` or `status=ARCHIVED`
  * Remove from public feed

---

## Listings Improvements

* [ ] Add categories to listings

  * Create `Category` table
  * Add `listing.categoryId`
  * Category selector in CreateListingPage

* [ ] Add tags for listings

  * `listing_tags` table
  * Improve search relevance

* [ ] Add search for listings

  * Search by title
  * Search by category
  * Search by tags

* [ ] Add sorting for listings

  * newest
  * price
  * rating
  * popularity (future)

* [ ] Add quantity support for listings

  * Add `quantity` field to Listing
  * Allow buyer to specify quantity when creating Deal
  * Store `unitPrice` and `quantity` in Deal (immutable snapshot)
  * Decrease `listing.quantity` on deal COMPLETED
  * Auto-archive listing when quantity reaches 0

---

## Chat Improvements

* [ ] Allow sending images in chat

  * Upload endpoint
  * Store file URL
  * Render image messages

* [ ] Add realtime deal status updates in DealRoom
  * Replace temporary polling with WebSocket events for deal status changes
  * Update buyer/seller UI without page refresh

---

## User System Improvements

* [ ] User avatars

  * Upload avatar
  * Change avatar in settings
  * Show avatar in chat and profile

* [ ] Change password

  * PATCH `/users/me/password`

* [ ] Remove role selection from registration

  * Users can both buy and sell

* [ ] Move profile-related endpoints to a dedicated UsersController

  * Move `/auth/users/me/profile` to `/users/me/profile`
  * Keep auth endpoints focused on login/register/token/me

---

## Admin Panel

* [ ] Admin dashboard

* [ ] Manage users

  * View users
  * Ban user
  * Delete user

* [ ] Manage listings

  * Remove illegal listings
  * Archive listings

* [ ] Manage reviews

  * Remove abusive reviews

---

## UI / UX Improvements

* [ ] Show wallet balance in navbar

* [ ] Show displayName instead of email in navbar

* [ ] Improve loading states

* [ ] Improve empty states

  * No listings
  * No messages
  * No deals

* [ ] Improve validation

  * Frontend validation for forms
  * Backend DTO validation messages

* [ ] Improve chat UI

---

## Wallet / Escrow (Hardening)

* [ ] Make wallet + deal status updates fully atomic

  * Refactor WalletService methods to accept Prisma transaction client (tx)
  * Use single `prisma.$transaction` for:

    * ESCROW_LOCK + deal.status=FUNDED
    * ESCROW_RELEASE + deal.status=COMPLETED
  * Add idempotency / unique constraints to prevent duplicate ledger records per deal step

* [ ] Add dedicated Escrow wallet/account (optional, for realism)

  * Buyer pays: buyer → escrow
  * Complete: escrow → seller
  * Cancel/refund: escrow → buyer
  * Store escrow balance and reconcile with ledger

---

## Infrastructure / Tech Debt

* [ ] Move backend Docker setup from dev to production mode

  * Replace `start:dev` with `nest build` + `node dist/main.js`
  * Add `start:docker` script to package.json
  * Remove `prisma migrate dev` from entrypoint
  * Use `prisma migrate deploy`
  * Use `NODE_ENV=production`

* [ ] Upgrade Prisma from 6.15 to 7.x

  * Move `DATABASE_URL` from `schema.prisma` to `prisma.config.ts`
  * Use Prisma driver adapter (`@prisma/adapter-pg`)
  * Update PrismaService constructor
  * Verify migrations and runtime connection

* [ ] Dockerize frontend (Vite + React)

  * Add Dockerfile for frontend
  * Add frontend service to docker-compose
  * Optional: nginx for static serving

* [ ] Upgrade TailwindCSS from v3 to v4

  * Replace PostCSS setup according to Tailwind v4 docs
  * Remove tailwind v3 config patterns if needed
  * Verify build + dev server

---

## Testing

* [ ] Unit tests for services

  * DealsService
  * ListingsService
  * ConversationsService

* [ ] Integration tests for main flows

  * Deal lifecycle
  * Chat
  * Reviews

* [ ] Basic e2e tests
