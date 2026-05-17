import { env, requireEnv } from "@/lib/env";
import { getPlanByCode } from "@/lib/plans";
import { verifyRazorpaySignature } from "@/lib/security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        amount?: number;
        currency?: string;
        id?: string;
        status?: string;
      };
    };
    subscription?: {
      entity?: {
        current_end?: number;
        id?: string;
        notes?: {
          interval?: string;
          planCode?: string;
          userId?: string;
        };
        status?: string;
      };
    };
  };
};

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const secret = requireEnv(env.RAZORPAY_WEBHOOK_SECRET, "RAZORPAY_WEBHOOK_SECRET");

  if (!verifyRazorpaySignature(body, signature, secret)) {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  const payload = JSON.parse(body) as RazorpayWebhookPayload;
  const subscription = payload.payload?.subscription?.entity;
  const payment = payload.payload?.payment?.entity;
  const notes = subscription?.notes;
  const userId = notes?.userId;
  const planCode = notes?.planCode;
  const plan = getPlanByCode(planCode ?? "");

  if (!subscription?.id || !userId || !plan) {
    return Response.json({ ok: true });
  }

  const supabase = createSupabaseAdminClient();
  const currentPeriodEnd = subscription.current_end
    ? new Date(subscription.current_end * 1000).toISOString()
    : new Date().toISOString();
  const isActive = ["subscription.activated", "subscription.charged", "payment.captured"].includes(payload.event ?? "");

  await supabase.from("subscriptions").upsert(
    {
      current_period_end: currentPeriodEnd,
      interval: notes?.interval === "yearly" ? "yearly" : "monthly",
      plan_code: plan.code,
      razorpay_subscription_id: subscription.id,
      status: isActive ? "active" : subscription.status ?? "pending",
      user_id: userId
    },
    { onConflict: "user_id" }
  );

  if (isActive) {
    await supabase.from("users").update({ plan_code: plan.code }).eq("id", userId);
  }

  if (payment?.id) {
    await supabase.from("payments").upsert(
      {
        amount: payment.amount ?? 0,
        currency: payment.currency ?? "INR",
        provider: "razorpay",
        razorpay_payment_id: payment.id,
        razorpay_subscription_id: subscription.id,
        status: payment.status ?? "captured",
        user_id: userId
      },
      { onConflict: "razorpay_payment_id" }
    );
  }

  await supabase.from("admin_logs").insert({
    action: "razorpay_webhook",
    metadata: { event: payload.event, subscriptionId: subscription.id },
    user_id: userId
  });

  return Response.json({ ok: true });
}
