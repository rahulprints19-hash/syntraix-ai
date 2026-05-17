import Link from "next/link";

import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="max-w-md p-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">Email verification</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Your email is verified</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          You can now open your Syntrix AI dashboard and start a new conversation.
        </p>
        <Link className={buttonClassName({ className: "mt-6" })} href="/dashboard">
          Open dashboard
        </Link>
      </Card>
    </main>
  );
}
