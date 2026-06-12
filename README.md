# Chat&Pay

A full-stack digital payments platform with wallet management, P2P transfers, E2E encrypted chat, and transaction analytics.

---

## Architecture

```
chatpay/
├── frontend/              # Next.js frontend (React 19, Tailwind CSS v4)
├── backend/
│   ├── user-app/          # Express 5 — auth, wallet, P2P         :3001
│   └── chat-server/       # Express 5 + WebSocket — E2E chat      :3003
└── packages/
    ├── db/                # Shared Prisma client (PostgreSQL)
    └── common/            # Shared Zod validation schemas
```

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| Next.js 15 (Pages Router) | Framework |
| React 19 | UI |
| TypeScript | Type safety |
| Tailwind CSS v4 | Styling |
| Axios | HTTP client |
| Lucide React | Icons |
| TweetNaCl | E2E encryption (NaCl box) |

### Backend
| Service | Tech | Responsibility |
|---|---|---|
| `user-app` | Express 5, Prisma, JWT | Signup/signin, wallet balance, P2P transfers, OnRamp |
| `chat-server` | Express 5, WebSocket, Prisma, JWT | E2E encrypted messaging, conversations, public key exchange |

### Infrastructure
| Technology | Purpose |
|---|---|
| PostgreSQL | Primary database |
| Prisma 7 | ORM + migrations |

---

## Features

- Email + password signup/signin with JWT authentication
- Add money to wallet (simulated top-up)
- Send money to another user by phone number (P2P wallet transfer)
- Transaction history with status tracking
- Monthly activity chart (12-month sent/received breakdown)
- **E2E encrypted real-time chat** (NaCl box encryption, WebSocket delivery)
- Responsive sidebar layout (dark theme sidebar + light content area)
- Notification bell for incoming payments

---

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database (get a free one from [Neon](https://neon.tech) or [Supabase](https://supabase.com))

### Setup

```bash
# 1. Install shared packages
cd packages/db && npm install
cd ../common && npm install && npm run build

# 2. Set up the database
# Create backend/user-app/.env with your DATABASE_URL and JWT_SECRET
# (see backend/user-app/.env.example)
cd ../../packages/db
npx prisma db push --schema=./prisma/schema.prisma

# 3. Start user-app backend
cd ../../backend/user-app && npm install
npm run dev    # → http://localhost:3001

# 4. Start chat server (new terminal)
# Create backend/chat-server/.env (same DATABASE_URL and JWT_SECRET, PORT=3003)
cd ../chat-server && npm install
npm run dev    # → http://localhost:3003

# 5. Start frontend (new terminal)
# Create frontend/.env.local with:
#   NEXT_PUBLIC_USER_BACKEND_URL=http://localhost:3001
#   NEXT_PUBLIC_CHAT_SERVER_URL=http://localhost:3003
cd ../../frontend && npm install
npm run dev    # → http://localhost:3000
```

### Environment Variables

**backend/user-app/.env**
```
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
JWT_SECRET=your-secret-key-here
```

**backend/chat-server/.env**
```
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
JWT_SECRET=your-secret-key-here
PORT=3003
```

**frontend/.env.local**
```
NEXT_PUBLIC_USER_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_CHAT_SERVER_URL=http://localhost:3003
```

---

## Roadmap

- [x] ~~E2E encrypted chat (NaCl/TweetNaCl)~~
- [ ] Merchant app (Google OAuth, QR codes, dashboard)
- [ ] Stripe payment integration for real OnRamp
- [ ] Bank withdrawals (Razorpay + BullMQ queue)
- [ ] Redis caching and rate limiting
- [ ] QR code scan-to-pay

---

## License

ISC
