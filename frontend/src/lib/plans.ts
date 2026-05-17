export type BillingInterval = "monthly" | "yearly";
export type PlanCode = "free" | "pro" | "plus" | "ultra";

export type PricingPlan = {
  code: PlanCode;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  monthlyMessages: number;
  models: string[];
  features: string[];
  razorpayPlanIds: Partial<Record<BillingInterval, string>>;
};

export const pricingPlans: PricingPlan[] = [
  {
    code: "free",
    name: "Free",
    description: "Start exploring Syntrix AI with essential chat access.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    monthlyMessages: 50,
    models: ["gpt-4.1-mini"],
    features: ["Limited messages", "Basic AI access", "Saved chats", "Community support"],
    razorpayPlanIds: {}
  },
  {
    code: "pro",
    name: "Pro",
    description: "For creators and students who need daily AI work.",
    monthlyPrice: 200,
    yearlyPrice: 2000,
    monthlyMessages: 1500,
    models: ["gpt-4.1-mini", "gpt-4.1"],
    features: ["More messages", "Fast models", "Export conversations", "Priority email support"],
    razorpayPlanIds: {
      monthly: process.env.RAZORPAY_PLAN_PRO_MONTHLY,
      yearly: process.env.RAZORPAY_PLAN_PRO_YEARLY
    }
  },
  {
    code: "plus",
    name: "Plus",
    description: "For professionals building workflows with AI.",
    monthlyPrice: 500,
    yearlyPrice: 5000,
    monthlyMessages: 6000,
    models: ["gpt-4.1-mini", "gpt-4.1", "gpt-5-mini"],
    features: ["Higher limits", "File analysis", "Prompt templates", "API key access"],
    razorpayPlanIds: {
      monthly: process.env.RAZORPAY_PLAN_PLUS_MONTHLY,
      yearly: process.env.RAZORPAY_PLAN_PLUS_YEARLY
    }
  },
  {
    code: "ultra",
    name: "Ultra Pro",
    description: "For teams and power users who want the best experience.",
    monthlyPrice: 2000,
    yearlyPrice: 20000,
    monthlyMessages: 50000,
    models: ["gpt-4.1-mini", "gpt-4.1", "gpt-5-mini", "gpt-5"],
    features: ["Highest limits", "Advanced models", "Admin analytics", "Dedicated support"],
    razorpayPlanIds: {
      monthly: process.env.RAZORPAY_PLAN_ULTRA_MONTHLY,
      yearly: process.env.RAZORPAY_PLAN_ULTRA_YEARLY
    }
  }
];

export function getPlan(code: string | null | undefined): PricingPlan {
  return pricingPlans.find((plan) => plan.code === code) ?? pricingPlans[0];
}

export function getPlanByCode(code: string): PricingPlan | null {
  return pricingPlans.find((plan) => plan.code === code) ?? null;
}
