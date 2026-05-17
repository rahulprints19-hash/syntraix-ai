"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Bot, BrainCircuit, CheckCircle2, Lock, Search, Zap, type LucideIcon } from "lucide-react";

import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PricingTable } from "@/components/pricing/pricing-table";

const features: Array<{ detail: string; Icon: LucideIcon; title: string }> = [
  { detail: "Fast responses, model switching, markdown, code copy, and memory.", Icon: Zap, title: "Streaming AI chat" },
  { detail: "Search-ready conversation patterns with sources and summaries.", Icon: Search, title: "Perplexity-style research" },
  { detail: "Long-form reasoning, files, saved threads, and project context.", Icon: BrainCircuit, title: "Claude-like workspace" },
  { detail: "Supabase auth, Razorpay subscriptions, admin analytics, and usage tracking.", Icon: Lock, title: "SaaS controls" }
];

const faqs = [
  ["Can I use Syntrix AI for coding?", "Yes. It supports markdown, code blocks, copy buttons, saved chats, and file context."],
  ["Does it support Razorpay subscriptions?", "Yes. Checkout, subscription storage, webhooks, cancellation, and invoice history are wired."],
  ["Can I deploy it on Vercel?", "Yes. The app uses Next.js API routes, Supabase PostgreSQL, and Vercel-ready config."]
];

export function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden">
      <nav className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link className="flex items-center gap-3" href="/">
            <span className="grid size-10 place-items-center rounded-lg bg-cyan-300 text-lg font-black text-slate-950">S</span>
            <span className="font-semibold text-white">Syntrix AI</span>
          </Link>
          <div className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            <Link className={buttonClassName({ size: "sm", variant: "ghost" })} href="/login">
              Login
            </Link>
            <Link className={buttonClassName({ size: "sm" })} href="/register">
              Start free
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative px-4 py-20 sm:py-28">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.22),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.18),transparent_30%)]" />
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <p className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-100">
              The Future of AI Conversations
            </p>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.04] text-white sm:text-7xl">
              Premium AI chat, research, and workflows in one SaaS platform.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Syntrix AI combines the clean chat experience of ChatGPT, the research feel of Perplexity,
              and the workspace polish of Claude with subscriptions, admin analytics, and production APIs.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className={buttonClassName({ className: "gap-2", size: "lg" })} href="/register">
                Launch workspace <ArrowRight className="size-4" />
              </Link>
              <Link className={buttonClassName({ size: "lg", variant: "secondary" })} href="/pricing">
                View pricing
              </Link>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15, duration: 0.7 }}>
            <Card className="relative overflow-hidden p-0">
              <div className="border-b border-white/10 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Bot className="size-4 text-cyan-200" />
                  Syntrix conversation preview
                </div>
              </div>
              <div className="space-y-4 p-5">
                <div className="rounded-lg bg-white/5 p-4 text-sm text-slate-200">Compare GPT models for a SaaS support assistant.</div>
                <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-7 text-cyan-50">
                  <p className="font-semibold">Syntrix AI</p>
                  <p className="mt-2">
                    Use a fast model for routing, a stronger model for complex answers, track usage per user,
                    and gate premium models behind Plus or Ultra plans.
                  </p>
                  <pre className="mt-4 overflow-hidden rounded-md bg-slate-950/80 p-3 text-xs text-cyan-100">
                    <code>{`model: "gpt-4.1-mini"\nstream: true\nbilling: "usage_tracked"`}</code>
                  </pre>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center text-xs text-slate-300">
                  {["Streaming", "Memory", "Billing"].map((item) => (
                    <div key={item} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      <section id="features" className="px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map(({ detail, Icon, title }) => (
              <Card key={title}>
                <Icon className="size-6 text-cyan-200" />
                <h2 className="mt-5 text-lg font-semibold text-white">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">Pricing</p>
            <h2 className="mt-3 text-4xl font-semibold text-white">Start free. Scale when ready.</h2>
          </div>
          <PricingTable />
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-3">
          {["The cleanest AI SaaS starter I have used.", "Billing and admin are already thought through.", "Feels premium from first load."].map((quote) => (
            <Card key={quote}>
              <CheckCircle2 className="size-5 text-cyan-200" />
              <p className="mt-4 text-lg leading-8 text-white">&quot;{quote}&quot;</p>
              <p className="mt-4 text-sm text-slate-400">Syntrix AI beta user</p>
            </Card>
          ))}
        </div>
      </section>

      <section id="faq" className="px-4 py-16">
        <div className="mx-auto max-w-4xl space-y-4">
          {faqs.map(([question, answer]) => (
            <Card key={question}>
              <h3 className="text-lg font-semibold text-white">{question}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{answer}</p>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 px-4 py-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-sm text-slate-400 md:flex-row">
          <p>Syntrix AI. The Future of AI Conversations.</p>
          <div className="flex gap-4">
            <Link href="/pricing">Pricing</Link>
            <Link href="/login">Login</Link>
            <Link href="/register">Register</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
