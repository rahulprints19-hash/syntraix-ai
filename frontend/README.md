# Syntrix AI Frontend

Next.js 15 app with demo cookie auth, OpenAI streaming chat, in-memory chat history, Razorpay-ready pricing, and Render deployment support.

## Local Setup

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Required:

```text
NEXT_PUBLIC_APP_URL=http://localhost:3000
OPENAI_API_KEY=sk-your-openai-key
OPENAI_DEFAULT_MODEL=gpt-4.1-mini
```

Optional Razorpay values are included in `.env.example`.

## Auth

Supabase has been removed. Register or sign in with any email/password. The session is stored in an HttpOnly cookie. Chat history and API keys are in memory, so they can reset when the server restarts.

To make an account admin, set:

```text
ADMIN_EMAILS=you@example.com
```

## Render

Deploy from the repo root with Docker:

```text
Dockerfile Path: docker/frontend.prod.Dockerfile
Docker Context Directory: .
```

Required Render env vars:

```text
NEXT_PUBLIC_APP_URL=https://your-render-url.onrender.com
OPENAI_API_KEY=sk-your-openai-key
OPENAI_DEFAULT_MODEL=gpt-4.1-mini
```

No Supabase variables are needed.
