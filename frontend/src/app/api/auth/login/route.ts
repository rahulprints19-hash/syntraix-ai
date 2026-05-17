import { z } from "zod";

import { createDemoUser, signInDemoUser } from "@/lib/demo-auth";

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  const payload = authSchema.parse(await request.json());
  const user = await createDemoUser(payload.email);
  await signInDemoUser(user);

  return Response.json({ user });
}
