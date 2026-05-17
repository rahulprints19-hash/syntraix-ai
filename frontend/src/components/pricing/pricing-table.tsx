"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { pricingPlans, type BillingInterval } from "@/lib/plans";
import { cn, formatInr } from "@/lib/utils";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export function PricingTable({ currentPlan = "free" }: { currentPlan?: string }) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const publicKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

  useEffect(() => {
    if (document.querySelector("script[src='https://checkout.razorpay.com/v1/checkout.js']")) {
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  async function checkout(planCode: string) {
    if (planCode === "free") {
      return;
    }

    setLoadingPlan(planCode);
    try {
      const response = await fetch("/api/billing/checkout", {
        body: JSON.stringify({ interval, planCode }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Checkout failed.");
      }

      if (!window.Razorpay || !publicKey) {
        throw new Error("Razorpay checkout is not configured.");
      }

      const checkoutOptions: Record<string, unknown> = {
        currency: "INR",
        description: `${payload.planName} ${interval} subscription`,
        handler: () => {
          window.location.href = "/billing/success";
        },
        key: publicKey,
        name: "Syntrix AI",
        prefill: payload.prefill,
        theme: { color: "#38bdf8" }
      };

      if (payload.subscriptionId) {
        checkoutOptions.subscription_id = payload.subscriptionId;
      } else {
        checkoutOptions.amount = payload.amount;
        checkoutOptions.order_id = payload.orderId;
      }

      const razorpay = new window.Razorpay(checkoutOptions);
      razorpay.open();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Payment failed.");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <section className="space-y-8">
      <div className="mx-auto flex w-fit rounded-lg border border-white/10 bg-white/5 p-1">
        {(["monthly", "yearly"] as const).map((value) => (
          <button
            key={value}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition",
              interval === value ? "bg-cyan-300 text-slate-950" : "text-slate-300 hover:text-white"
            )}
            onClick={() => setInterval(value)}
            type="button"
          >
            {value === "monthly" ? "Monthly" : "Yearly"}
            {value === "yearly" ? <span className="ml-2 text-xs">Save more</span> : null}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {pricingPlans.map((plan) => {
          const price = interval === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
          const isCurrent = currentPlan === plan.code;
          const isLoading = loadingPlan === plan.code;

          return (
            <Card key={plan.code} className={cn("relative flex flex-col p-5", plan.code === "plus" && "border-cyan-300/40")}>
              {plan.code === "plus" ? (
                <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-cyan-300 px-2 py-1 text-xs font-semibold text-slate-950">
                  <Sparkles className="size-3" />
                  Popular
                </div>
              ) : null}
              <p className="text-lg font-semibold text-white">{plan.name}</p>
              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">{plan.description}</p>
              <p className="mt-5 text-3xl font-semibold text-white">
                {price === 0 ? "Free" : formatInr(price)}
                {price > 0 ? <span className="text-sm text-slate-400">/{interval === "monthly" ? "mo" : "yr"}</span> : null}
              </p>
              <p className="mt-2 text-sm text-cyan-100">{plan.monthlyMessages.toLocaleString("en-IN")} messages/month</p>
              <ul className="mt-5 flex-1 space-y-3 text-sm text-slate-300">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-cyan-200" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button className="mt-6 w-full" disabled={isCurrent || isLoading || plan.code === "free"} onClick={() => void checkout(plan.code)}>
                {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {isCurrent ? "Current plan" : plan.code === "free" ? "Included" : "Upgrade"}
              </Button>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
