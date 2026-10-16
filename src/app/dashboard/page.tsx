"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function loadRecruiter() {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }

      setEmail(auth.user.email ?? "");

      const { data: recruiter, error: recruiterError } =
        await supabase
          .from("recruiters")
          .select("company_id, companies(name)")
          .eq("id", auth.user.id)
          .single();

      if (recruiterError || !recruiter) {
        router.replace("/login");
        return;
      }

      const companies = recruiter.companies as
        | { name: string }
        | { name: string }[]
        | null;

      setCompany(
        Array.isArray(companies)
          ? companies[0]?.name ?? ""
          : companies?.name ?? ""
      );

      setLoading(false);
    }

    loadRecruiter();
  }, [router]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="p-10 text-slate-600">
        Loading your workspace...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              Rotto Dashboard
            </h1>
            <p className="mt-2 text-slate-600">
              Welcome to {company}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-800"
          >
            Sign out
          </button>
        </header>

        <section className="mt-10 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Recruiter Workspace
          </h2>

          <p className="mt-3 text-slate-600">
            Signed in as: {email}
          </p>

          <p className="mt-2 text-slate-600">
            Company: {company}
          </p>

          <p className="mt-6 text-sm text-slate-500">
            Candidate search, saved briefs, and shortlists
            will appear here as we build them.
          </p>
        </section>
      </div>
    </main>
  );
}
