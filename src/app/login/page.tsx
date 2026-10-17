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
    <main className="flex min-h-screen items-center justify-center bg-[#faf9ff] px-4 py-8 text-[#24212d] sm:px-8">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[32px] border border-[#e9e2f5] bg-white shadow-[0_24px_80px_rgba(65,43,120,0.09)] lg:min-h-[680px] lg:grid-cols-2">

        {/* Branding panel */}
        <section className="relative flex flex-col justify-between overflow-hidden bg-[#7658f6] p-8 text-white sm:p-12 lg:p-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-20 -left-24 h-72 w-72 rounded-full bg-[#c6b4ff]/30 blur-3xl"
          />

          <div className="relative">
            <span className="text-4xl font-extrabold tracking-[-0.075em]">
              rotto<span className="text-[#e6ffb7]">.</span>
            </span>

            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/65">
              Recruiter workspace
            </p>
          </div>

          <div className="relative my-16 lg:my-0">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-white/70">
              A smarter way to search
            </p>

            <h1 className="max-w-lg text-4xl font-extrabold leading-[1.12] tracking-[-0.06em] sm:text-5xl lg:text-6xl">
              Find your next{" "}
              <span className="text-[#e6ffb7]">
                great hire.
              </span>
            </h1>

            <p className="mt-6 max-w-sm text-sm leading-7 text-white/85 sm:text-base">
              Describe the people you need, discover matching profiles,
              and build your shortlist in one place.
            </p>

            <div className="mt-9 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold">
                Natural-language search
              </span>

              <span className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold">
                Candidate ranking
              </span>

              <span className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold">
                Shortlists
              </span>
            </div>
          </div>

          <div className="relative border-t border-white/25 pt-6">
            <p className="text-xs text-white/75">
              Powered by Next.js + Supabase
            </p>
            <p className="mt-2 text-xs text-white/75">
              Designed &amp; built by shravanips
            </p>
          </div>
        </section>

        {/* Login form */}
        <section className="flex items-center justify-center px-7 py-14 sm:px-12 lg:px-16">
          <div className="w-full max-w-sm">
            <div className="mb-10">
              <span className="inline-flex rounded-full bg-[#f0eaff] px-4 py-2 text-xs font-bold text-[#7658f6]">
                Welcome back
              </span>

              <h2 className="mt-6 text-3xl font-extrabold tracking-[-0.055em] sm:text-4xl">
                Sign in to{" "}
                <span className="rotto-highlight-purple">
                  Rotto.
                </span>
              </h2>

              <p className="mt-3 text-sm leading-6 text-[#777]">
                Access your recruiter workspace.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-bold text-[#34303e]"
                >
                  Email address
                </label>

                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-[#e5e0ed] bg-[#fcfbff] px-4 py-3.5 text-sm outline-none focus:border-[#a992ff] focus:ring-2 focus:ring-[#e8e0ff]"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-bold text-[#34303e]"
                >
                  Password
                </label>

                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-[#e5e0ed] bg-[#fcfbff] px-4 py-3.5 text-sm outline-none focus:border-[#a992ff] focus:ring-2 focus:ring-[#e8e0ff]"
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#7658f6] px-5 py-4 text-sm font-bold text-white shadow-[0_8px_24px_rgba(118,88,246,0.18)] hover:-translate-y-0.5 hover:bg-[#6244e6] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign in →"}
              </button>
            </form>

            <div className="mt-9 border-t border-[#eee9f4] pt-6 text-center">
              <p className="text-xs text-[#888]">
                Recruiter access only · Assessment workspace
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
