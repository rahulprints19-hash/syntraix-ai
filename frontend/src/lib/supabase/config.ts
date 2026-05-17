export type SupabasePublicConfig = {
  anonKey: string;
  url: string;
};

const PLACEHOLDER_SUPABASE_HOSTS = new Set(["your-project.supabase.co"]);
const PLACEHOLDER_KEY_PARTS = ["your-", "supabase-anon-key"];

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    if (PLACEHOLDER_SUPABASE_HOSTS.has(parsedUrl.hostname) || parsedUrl.hostname.startsWith("your-")) {
      return null;
    }
  } catch {
    return null;
  }

  if (PLACEHOLDER_KEY_PARTS.some((part) => anonKey.includes(part))) {
    return null;
  }

  return { anonKey, url };
}

export function requireSupabasePublicConfig(): SupabasePublicConfig {
  const config = getSupabasePublicConfig();

  if (!config) {
    throw new Error(
      "Supabase is not configured. Update NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart the dev server."
    );
  }

  return config;
}
