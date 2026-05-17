import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function BillingFailurePage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <Card className="max-w-lg text-center">
        <AlertTriangle className="mx-auto size-12 text-amber-200" />
        <h1 className="mt-5 text-3xl font-semibold text-white">Payment was not completed</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          No plan change was applied. You can retry checkout from the pricing page whenever you are ready.
        </p>
        <Link className={buttonClassName({ className: "mt-6", variant: "secondary" })} href="/pricing">
          Back to pricing
        </Link>
      </Card>
    </main>
  );
}
