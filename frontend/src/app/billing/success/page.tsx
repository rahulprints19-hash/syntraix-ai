import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function BillingSuccessPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <Card className="max-w-lg text-center">
        <CheckCircle2 className="mx-auto size-12 text-cyan-200" />
        <h1 className="mt-5 text-3xl font-semibold text-white">Payment started successfully</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Razorpay is processing your subscription. Your plan will update automatically when the webhook confirms payment.
        </p>
        <Link className={buttonClassName({ className: "mt-6" })} href="/dashboard">
          Return to dashboard
        </Link>
      </Card>
    </main>
  );
}
