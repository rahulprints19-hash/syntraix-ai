import { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { env, requireEnv } from "@/lib/env";
import { setUserPlan } from "@/lib/memory-store";
import { type BillingInterval, getPlanByCode } from "@/lib/plans";
import { createRazorpayClient } from "@/lib/razorpay";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  interval: z.enum(["monthly", "yearly"]),
  planCode: z.enum(["pro", "plus", "ultra"])
});

type RazorpaySubscription = {
  id: string;
  short_url?: string;
  status?: string;
};

export async function POST(request: NextRequest) {
  const payload = checkoutSchema.parse(await request.json());
  const plan = getPlanByCode(payload.planCode);

  if (!plan) {
    return Response.json({ error: "Unknown plan." }, { status: 400 });
  }

  const planId = plan.razorpayPlanIds[payload.interval as BillingInterval];
  if (!planId) {
    return Response.json(
      {
        error:
          "Razorpay plan id is missing. Add the matching RAZORPAY_PLAN_* value to your environment."
      },
      { status: 500 }
    );
  }

  const user = await requireUser();

  const razorpay = createRazorpayClient();
  const subscription = (await (razorpay.subscriptions as unknown as {
    create: (options: Record<string, unknown>) => Promise<RazorpaySubscription>;
  }).create({
    customer_notify: 1,
    notes: {
      interval: payload.interval,
      planCode: plan.code,
      userId: user.id
    },
    plan_id: planId,
    total_count: payload.interval === "monthly" ? 120 : 10
  })) as RazorpaySubscription;

  const amount = payload.interval === "monthly" ? plan.monthlyPrice * 100 : plan.yearlyPrice * 100;
  setUserPlan(user.id, plan.code);

  return Response.json({
    amount,
    key: requireEnv(env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? env.RAZORPAY_KEY_ID, "RAZORPAY_KEY_ID"),
    planName: plan.name,
    prefill: {
      email: user.email,
      name: user.user_metadata?.full_name ?? user.email
    },
    subscriptionId: subscription.id
  });
}
