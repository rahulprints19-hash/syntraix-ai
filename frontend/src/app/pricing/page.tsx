import Link from "next/link";

import { PricingTable } from "@/components/pricing/pricing-table";

export default function PricingPage() {
  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <Link className="text-sm text-cyan-200" href="/">
          Back to Syntrix AI
        </Link>
        <div className="mb-10 mt-10 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">Pricing</p>
          <h1 className="mt-3 text-5xl font-semibold text-white">Plans for every AI workflow.</h1>
          <p className="mt-4 text-lg leading-8 text-slate-300">
            Choose monthly or yearly billing, pay securely through Razorpay, and manage your subscription in settings.
          </p>
        </div>
        <PricingTable />
      </div>
    </main>
  );
}
