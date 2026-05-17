import { z } from "zod";

const resetSchema = z.object({
  email: z.string().email()
});

export async function POST(request: Request) {
  resetSchema.parse(await request.json());

  return Response.json({
    message: "Demo auth does not send email. You can sign in or register with any email and password."
  });
}
