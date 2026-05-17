import Razorpay from "razorpay";

import { env, requireEnv } from "@/lib/env";

export function createRazorpayClient() {
  return new Razorpay({
    key_id: requireEnv(env.RAZORPAY_KEY_ID, "RAZORPAY_KEY_ID"),
    key_secret: requireEnv(env.RAZORPAY_KEY_SECRET, "RAZORPAY_KEY_SECRET")
  });
}
