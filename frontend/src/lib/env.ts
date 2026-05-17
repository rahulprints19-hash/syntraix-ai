import { z } from "zod";

const serverEnvSchema = z.object({
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_DEFAULT_MODEL: z.string().default("gpt-4.1-mini"),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_PLAN_PLUS_MONTHLY: z.string().optional(),
  RAZORPAY_PLAN_PLUS_YEARLY: z.string().optional(),
  RAZORPAY_PLAN_PRO_MONTHLY: z.string().optional(),
  RAZORPAY_PLAN_PRO_YEARLY: z.string().optional(),
  RAZORPAY_PLAN_ULTRA_MONTHLY: z.string().optional(),
  RAZORPAY_PLAN_ULTRA_YEARLY: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional()
});

export const env = serverEnvSchema.parse(process.env);

export function hasSupabaseConfig(): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function hasSupabaseAdminConfig(): boolean {
  return Boolean(hasSupabaseConfig() && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}
