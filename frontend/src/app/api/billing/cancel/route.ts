import { env } from "@/lib/env";
import { createRazorpayClient } from "@/lib/razorpay";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id,razorpay_subscription_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (subscription?.razorpay_subscription_id && env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    const razorpay = createRazorpayClient();
    await (razorpay.subscriptions as unknown as {
      cancel: (id: string, cancelAtCycleEnd?: boolean) => Promise<unknown>;
    }).cancel(subscription.razorpay_subscription_id, true);
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({ cancel_at_period_end: true, status: "cancel_requested" })
    .eq("user_id", user.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
