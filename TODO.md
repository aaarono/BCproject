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
