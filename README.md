# Syntrix AI

Syntrix AI is a full-stack AI SaaS platform with a premium ChatGPT-style interface, Supabase authentication/database, OpenAI streaming chat, Razorpay subscriptions, admin dashboards, API key management, and Vercel-ready deployment.

The production SaaS app lives in `frontend/`.

## Folder Structure

```text
syntrix-ai/
|-- frontend/
|   |-- src/app/                 Next.js pages and API routes
|   |-- src/components/          UI, auth, pricing, dashboard, chat
|   |-- src/lib/                 Supabase, OpenAI, Razorpay, security helpers
|   |-- supabase/migrations/     PostgreSQL schema and RLS policies
|   |-- .env.example             Environment template
|   `-- vercel.json              Vercel config
|-- backend/                     Previous FastAPI workspace backend
|-- docker-compose.yml           Previous Docker stack
`-- README.md
```

## Quick Start

```powershell
Set-Location "C:\Users\rahul\OneDrive\Desktop\ai making\syntrix-ai\frontend"
Copy-Item .env.example .env.local
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Required Setup

1. Create a Supabase project.
2. Run `frontend/supabase/migrations/0001_syntrix_ai.sql` in Supabase SQL Editor.
3. Enable Supabase Email and Google auth.
4. Add Supabase URL, anon key, and service role key to `frontend/.env.local`.
5. Add `OPENAI_API_KEY`.
6. Create Razorpay subscription plans and add the `RAZORPAY_PLAN_*` ids.
7. Configure Razorpay webhook at `/api/billing/webhook`.

## Final Local Checks

```powershell
Set-Location "C:\Users\rahul\OneDrive\Desktop\ai making\syntrix-ai\frontend"
npm run typecheck
npm run build
```

## Deploy To Render

This repo includes `render.yaml` for Render Blueprints. It deploys the production Next.js app as a free Docker web service.

1. Push this repo to GitHub.
2. Open Render and choose **New > Blueprint**.
3. Connect the GitHub repo and select `render.yaml`.
4. When Render asks for secret environment variables, paste:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
5. If Render gives you a different URL than `https://syntrix-ai.onrender.com`, update `NEXT_PUBLIC_APP_URL` in the Render service environment.
6. In Supabase Auth URL Configuration, add:

```text
https://your-render-url.onrender.com/auth/callback
```

Render free web services are good for testing and hobby projects. Keep Supabase for auth/database unless you want to replace the auth and database layer separately.

## Deploy To Vercel

Deploy the `frontend` folder to Vercel. Add the same environment variables from `frontend/.env.example` and set `NEXT_PUBLIC_APP_URL` to the production URL.
