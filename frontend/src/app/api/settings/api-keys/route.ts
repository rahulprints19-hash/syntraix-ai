import { NextRequest } from "next/server";

import { createApiKey, hashSecret } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("api_keys")
    .select("id,name,key_prefix,last_used_at,revoked_at,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ keys: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name = "Production key" } = await request.json().catch(() => ({}));
  const apiKey = createApiKey();
  const keyPrefix = apiKey.slice(0, 10);

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      key_hash: hashSecret(apiKey),
      key_prefix: keyPrefix,
      name: String(name).slice(0, 80),
      user_id: user.id
    })
    .select("id,name,key_prefix,created_at")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ apiKey, key: data });
}
