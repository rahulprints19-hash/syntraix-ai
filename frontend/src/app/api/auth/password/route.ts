import { z } from "zod";

import { requireUser } from "@/lib/auth";

const passwordSchema = z.object({
  password: z.string().min(8)
});

export async function POST(request: Request) {
  await requireUser();
  passwordSchema.parse(await request.json());

  return Response.json({ ok: true });
}
