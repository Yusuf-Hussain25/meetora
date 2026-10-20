# Meetora

Video meetings in the browser: peer-to-peer WebRTC calls, in-meeting chat and a searchable history of every session.

- **Client:** React 19 + Vite, Clerk for sign-in, Socket.io client
- **Server:** Express 5 + Socket.io for signaling, Neon Postgres for meetings, participants and chat

## Getting started

### Prerequisites

- Node.js 20.9+
- A free [Clerk](https://dashboard.clerk.com) application (Email + Google sign-in)
- A free [Neon](https://console.neon.tech) Postgres database

### Setup

```bash
git clone https://github.com/Yusuf-Hussain25/meetora.git
cd meetora

cd server && npm install && cp .env.example .env && cd ..
cd client && npm install && cp .env.example .env && cd ..
```

Fill in both `.env` files. Every key is explained in the `.env.example` next to it.

### Run

```bash
# terminal 1
cd server && npm run server     # http://localhost:3000, creates the tables on start

# terminal 2
cd client && npm run dev        # http://localhost:5173
```

## Author

**Yusuf Hussain** · [github.com/Yusuf-Hussain25](https://github.com/Yusuf-Hussain25)
