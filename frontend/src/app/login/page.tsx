import { AuthForm } from "@/components/auth/auth-form";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const errorParam = (await searchParams)?.error;
  const error = Array.isArray(errorParam) ? errorParam[0] : errorParam;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <AuthForm initialError={error} mode="login" />
    </main>
  );
}
