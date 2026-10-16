
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("recruiter@acme.test");
  const [password, setPassword] = useState("rotto-assessment");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            Welcome to Rotto
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Sign in to your recruiter workspace.
          </p>
        </div>

        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <p className="text-center text-xs text-slate-400">
          Recruiter access only
        </p>
      </form>
    </main>
  );
}
