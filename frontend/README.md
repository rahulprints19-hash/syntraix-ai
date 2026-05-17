# Syntrix AI

Syntrix AI is a production-ready AI SaaS web app built with Next.js 15, Supabase Auth/PostgreSQL, OpenAI streaming responses, Razorpay subscriptions, admin analytics, and a premium dark ChatGPT-style interface.

## Stack

- Next.js 15 App Router, React 19, TypeScript
- Tailwind CSS 4, Framer Motion, Shadcn-style UI primitives
- Supabase Auth, Supabase PostgreSQL, row-level security
- OpenAI SDK streaming chat
- Razorpay recurring subscriptions and signed webhooks
- Vercel deployment

## Local Setup

```powershell
Set-Location "C:\Users\rahul\OneDrive\Desktop\ai making\syntrix-ai\frontend"
Copy-Item .env.example .env.local
npm install
```

Fill `.env.local` with your Supabase, OpenAI, and Razorpay values.

## Supabase Setup

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/migrations/0001_syntrix_ai.sql`.
4. In Authentication > Providers, enable Email and Google.
5. Add redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://your-domain.com/auth/callback`
6. Copy the project URL, anon key, and service role key into `.env.local`.
7. To make yourself admin after registering, run:

```sql
update public.users
set role = 'admin'
where email = 'your-email@example.com';
```

## Razorpay Setup

1. Create monthly and yearly Razorpay subscription plans for Pro, Plus, and Ultra.
2. Put each plan id into the matching `RAZORPAY_PLAN_*` variable.
3. Create a webhook URL:
   - Local tunnel: `https://your-ngrok-url.ngrok-free.app/api/billing/webhook`
   - Production: `https://your-domain.com/api/billing/webhook`
4. Enable subscription and payment events.
5. Copy the webhook secret to `RAZORPAY_WEBHOOK_SECRET`.

## Development

```powershell
npm run dev
```

Open `http://localhost:3000`.

## Verification

```powershell
npm run typecheck
npm run build
```

## Deployment On Render

From the repo root, use `render.yaml` as a Render Blueprint. It deploys this app as a free Docker web service.

Required Render environment variables:

```text
NEXT_PUBLIC_APP_URL=https://your-render-url.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
OPENAI_API_KEY=sk-your-openai-key
OPENAI_DEFAULT_MODEL=gpt-4.1-mini
```

After the service is created, add this Supabase Auth redirect URL:

```text
https://your-render-url.onrender.com/auth/callback
```

## Deployment On Vercel

1. Push this repository to GitHub.
2. Create a new Vercel project.
3. Set the Vercel root directory to `frontend`.
4. Add every variable from `.env.example` in Vercel Project Settings.
5. Set `NEXT_PUBLIC_APP_URL` to your Vercel production URL.
6. Deploy.

## Production Notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, or `RAZORPAY_KEY_SECRET` to the browser.
- Keep Razorpay webhook verification enabled.
- Use Supabase RLS policies from the migration.
- Rotate service keys if they are ever leaked.
- Add model-specific usage pricing before charging users by token volume.
