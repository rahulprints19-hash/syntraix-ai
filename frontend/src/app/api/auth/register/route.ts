import { z } from "zod";

import { createDemoUser, signInDemoUser } from "@/lib/demo-auth";

const registerSchema = z.object({
  email: z.string().email(),
  fullName: z.string().max(120).optional(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  const payload = registerSchema.parse(await request.json());
  const user = await createDemoUser(payload.email, payload.fullName);
  await signInDemoUser(user);

  return Response.json({ user });
}
