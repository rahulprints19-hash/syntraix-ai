# Syntrix AI

Syntrix AI is a Next.js AI chat SaaS app with demo cookie auth, OpenAI streaming chat, Razorpay-ready pricing, admin stats, API key management, and Render deployment support.

The production app lives in `frontend/`.

## Folder Structure

```text
syntrix-ai/
|-- frontend/                 Next.js app
|-- backend/                  Previous FastAPI workspace backend
|-- docker/                   Dockerfiles
|-- render.yaml               Render deployment config
`-- README.md
```

## Local Setup

```powershell
Set-Location "C:\Users\rahul\OneDrive\Desktop\ai making\syntrix-ai\frontend"
Copy-Item .env.example .env.local
npm install
npm run dev
```

Then open `http://localhost:3000`.

Auth is demo-only now: register or sign in with any email/password. Data is stored in memory and can reset when the server restarts.

## Required Setup

Only OpenAI is required for AI chat:

```text
OPENAI_API_KEY=sk-your-openai-key
OPENAI_DEFAULT_MODEL=gpt-4.1-mini
```

Razorpay variables are optional unless you want live payments.

## Checks

```powershell
Set-Location "C:\Users\rahul\OneDrive\Desktop\ai making\syntrix-ai\frontend"
npm run typecheck
npm run build
```

## Deploy To Render

This repo includes `render.yaml` for Render. It deploys the production Next.js app as a free Docker web service.

1. Push this repo to GitHub.
2. In Render, create a Web Service from the public GitHub repo.
3. Choose Docker.
4. Use Dockerfile path `docker/frontend.prod.Dockerfile`.
5. Use Docker context `.`.
6. Add `OPENAI_API_KEY`.
7. Set `NEXT_PUBLIC_APP_URL` to your Render URL.

No Supabase environment variables are needed.
