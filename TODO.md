# TODO (Prioritized)

> Обновлено: 2026-03-17
> Ниже только то, чего **не хватает** или что нужно допилить/улучшить.

---

## P0 — Critical (обязательно закрыть перед защитой)

### Security & Config
* [ ] Вынести секреты и URL из кода в env
  * `JWT_SECRET` не должен быть `super_secret_change_me`
  * `VITE_API_URL` вместо hardcode `http://localhost:3000`
  * URL сокета через env (`VITE_WS_URL`)
* [ ] Убрать хранение access token в `localStorage`
  * перейти на httpOnly cookie + SameSite
  * обновить auth flow на фронте и бэке
* [ ] Синхронизировать CORS для REST и WebSocket
  * сейчас REST и Gateway настроены по-разному

### Business Logic & Data Integrity
* [ ] Убрать race condition в обновлении рейтинга продавца
  * атомарный апдейт `ratingAvg`/`ratingCount` в транзакции
* [ ] Включить role-based ограничения на эндпоинтах
  * создание/редактирование/архивация listing только для SELLER
* [ ] Исправить `WalletTransaction.userId`
  * сделать обязательным (`NOT NULL`) и миграцию

### Code Quality Gate
* [ ] Довести backend lint до зелёного
  * убрать `any`, unsafe-access и неиспользуемые импорты
* [ ] Довести frontend lint до зелёного
  * убрать `any`, исправить `react-hooks` предупреждения

---

## P1 — High (чтобы проект перестал быть «сырым и скучным»)

### Design Overhaul (полный редизайн)
* [ ] Зафиксировать новый UI-kit (через v0)
  * типографика, палитра, карточки, кнопки, формы, states
* [ ] Пересобрать ключевые экраны
  * Главная/каталог
  * Listing page
  * Deal room
  * Профиль продавца
  * Inbox/чат
* [ ] Улучшить UX-состояния
  * skeleton/loading
  * empty states
  * понятные error states

### “Interesting Features” (по запросу руководителя)
* [ ] Flash Sales / распродажи
  * поле скидки + валидность по времени
  * старая/новая цена + badge `SALE`
  * отдельный блок «Текущие акции»
* [ ] Top Sellers
  * endpoint leaderboard
  * ранжирование по `ratingAvg`, `ratingCount`, активности
  * UI-блок/страница с топом продавцов
* [ ] Smart Catalog
  * сортировка: newest / price / rating / sale
  * фильтры: type / price range / rating

### Realtime UX
* [ ] Убрать polling где возможно, использовать socket events
  * чаты и статус сделки должны обновляться в realtime

---

## P2 — Medium (сильно усиливает диплом и портфолио)

### Marketplace Extensions
* [ ] Категории для листингов
* [ ] Теги для листингов
* [ ] Quantity support + immutable snapshot цены в deal
* [ ] Таймауты сделок (auto-cancel для зависших сценариев)
* [ ] Отмена сделки покупателем в допустимых статусах

### User Features
* [ ] Аватары пользователей (upload + отображение)
* [ ] Смена пароля (`PATCH /users/me/password`)

### Chat Enhancements
* [ ] Отправка изображений в чат

### Reliability & Observability
* [ ] Добавить структурированное логирование на бэке
* [ ] Добавить `updatedAt` в основные сущности Prisma
* [ ] Идемпотентность ledger-операций (защита от дублей)

---

## P3 — Low / Nice-to-have

### Admin & Moderation
* [ ] Базовая админка
  * управление пользователями
  * модерация листингов
  * модерация отзывов

### Infra / Delivery
* [ ] Перевести backend Docker в production mode
  * `migrate deploy`, `start:prod`, `NODE_ENV=production`
* [ ] Dockerize frontend
* [ ] CI/CD pipeline (lint + test + build)

### Stack Upgrades
* [ ] Prisma 7.x migration
* [ ] Tailwind v4 migration

---

## Demo & Defense Readiness (обязательно зафиксировать)

* [ ] Подготовить demo-flow на 5–7 минут
  * register/login → listing → conversation → deal lifecycle → review
  * показать Flash Sales + Top Sellers
* [ ] Обновить README (корень + frontend + backend)
  * реальные фичи, запуск, env, скриншоты
* [ ] Подготовить короткий showcase для портфолио
  * 60–90 сек видео + 5–8 скриншотов

