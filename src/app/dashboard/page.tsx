
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CandidateResult = {
  candidate_id: string;
  rank_score: number;
  position?: number;
};

type SearchResponse = {
  search_id: string;
  filters: Record<string, unknown>;
  total: number;
  results: CandidateResult[];
  searches_remaining: number | null;
};

type PageResponse = {
  search_id: string;
  filters: Record<string, unknown>;
  total: number;
  page: number;
  results: CandidateResult[];
};

type Candidate = {
  id: string;
  full_name: string;
  headline: string | null;
  current_title: string | null;
  current_company: string | null;
  skills: string[] | null;
  location: unknown;
  years_experience: number | null;
  open_to_work: boolean;
};

type Plan = {
  plan: "free" | "paid";
  searches_remaining: number | null;
};

function locationText(location: unknown): string {
  if (typeof location === "string") return location;

  if (location && typeof location === "object") {
    const value = location as Record<string, unknown>;

    return [value.city, value.state, value.country]
      .filter((part): part is string => typeof part === "string")
      .join(", ");
  }

  return "";
}

export default function DashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(true);

  const [brief, setBrief] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const [searchId, setSearchId] = useState<string | null>(null);
  const [results, setResults] = useState<CandidateResult[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Candidate>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const [plan, setPlan] = useState<Plan | null>(null);

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

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (token) {
        try {
          const response = await fetch("/api/plan", {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.ok) {
            setPlan((await response.json()) as Plan);
          }
        } catch {
          // Search can still be used if the plan display fails.
        }
      }
    }

    void loadRecruiter();
  }, [router]);

  async function getToken(): Promise<string> {
    const supabase = createClient();
    const { data, error: sessionError } =
      await supabase.auth.getSession();

    const token = data.session?.access_token;

    if (sessionError || !token) {
      throw new Error("Your session expired. Please sign in again.");
    }

    return token;
  }

  async function loadProfiles(
    matches: CandidateResult[],
    token: string
  ) {
    const loaded = await Promise.all(
      matches.map(async (match) => {
        const response = await fetch(
          `/api/people/${encodeURIComponent(match.candidate_id)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok) {
          throw new Error(
            `Could not load candidate ${match.candidate_id}`
          );
        }

        const body = await response.json();

        // Accept either a direct profile or a { candidate } response.
        const candidate = (body.candidate ?? body) as Candidate;

        return [match.candidate_id, candidate] as const;
      })
    );

    setProfiles((previous) => ({
      ...previous,
      ...Object.fromEntries(loaded),
    }));
  }

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!brief.trim() || searching) return;

    setSearching(true);
    setError("");

    try {
      const token = await getToken();

      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ brief: brief.trim() }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(
          body.error ??
            (response.status === 402
              ? "You have used all free searches."
              : "Search failed.")
        );
      }

      const search = body as SearchResponse;

      setSearchId(search.search_id);
      setResults(search.results);
      setTotal(search.total);
      setFilters(search.filters);
      setPage(1);

      setPlan((previous) =>
        previous
          ? {
              ...previous,
              searches_remaining: search.searches_remaining,
            }
          : {
              plan: "free",
              searches_remaining: search.searches_remaining,
            }
      );

      await loadProfiles(search.results, token);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Search failed."
      );
    } finally {
      setSearching(false);
    }
  }

  async function changePage(nextPage: number) {
    if (!searchId || searching) return;

    setSearching(true);
    setError("");

    try {
      const token = await getToken();

      const response = await fetch(
        `/api/search/${encodeURIComponent(searchId)}?page=${nextPage}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Could not load results.");
      }

      const searchPage = body as PageResponse;

      setResults(searchPage.results);
      setPage(searchPage.page);

      await loadProfiles(searchPage.results, token);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load results."
      );
    } finally {
      setSearching(false);
    }
  }

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

  const totalPages = Math.ceil(total / 20);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Rotto
            </h1>
            <p className="mt-1 text-slate-600">
              {company} · Recruiter workspace
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {email}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {plan && (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm">
                <span className="font-semibold capitalize">
                  {plan.plan} plan
                </span>
                <span className="ml-2 text-slate-500">
                  {plan.searches_remaining === null
                    ? "Unlimited searches"
                    : `${plan.searches_remaining} searches left`}
                </span>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </header>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">
            Find your next hire
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Describe the person you want to find in plain English.
          </p>

          <form onSubmit={handleSearch} className="mt-5">
            <label htmlFor="brief" className="sr-only">
              Candidate search brief
            </label>

            <textarea
              id="brief"
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              placeholder="Senior React engineers in New York with startup experience"
              rows={3}
              maxLength={2000}
              className="w-full resize-y rounded-xl border border-slate-300 p-4 text-sm outline-none focus:border-indigo-500"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Filters are extracted from your brief, then applied to the candidate database.
              </p>

              <button
                type="submit"
                disabled={searching || !brief.trim()}
                className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {searching ? "Working..." : "Search candidates"}
              </button>
            </div>
          </form>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
        </section>

        {searchId && (
          <section className="mt-7">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">
                  Search results
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {total} matching candidates
                  {total > 0 && ` · Page ${page} of ${totalPages}`}
                </p>
              </div>
            </div>

            {Object.keys(filters).length > 0 && (
              <details className="mb-5 rounded-lg border border-slate-200 bg-white p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  View extracted search filters
                </summary>
                <pre className="mt-3 overflow-x-auto text-xs text-slate-600">
                  {JSON.stringify(filters, null, 2)}
                </pre>
              </details>
            )}

            {results.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                No matching candidates found. Try a broader search.
              </div>
            ) : (
              <div className="grid gap-4">
                {results.map((match) => {
                  const candidate = profiles[match.candidate_id];

                  return (
                    <article
                      key={match.candidate_id}
                      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold">
                            {candidate?.full_name ??
                              match.candidate_id}
                          </h3>

                          <p className="mt-1 text-sm text-slate-700">
                            {candidate?.current_title ??
                              candidate?.headline ??
                              "Candidate profile"}
                            {candidate?.current_company &&
                              ` · ${candidate.current_company}`}
                          </p>

                          {candidate && (
                            <p className="mt-2 text-xs text-slate-500">
                              {locationText(candidate.location)}
                              {candidate.years_experience !== null &&
                                ` · ${candidate.years_experience} years experience`}
                              {candidate.open_to_work &&
                                " · Open to work"}
                            </p>
                          )}
                        </div>

                        <span className="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                          Score {match.rank_score}
                        </span>
                      </div>

                      {candidate?.skills &&
                        candidate.skills.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {candidate.skills.slice(0, 8).map((skill) => (
                              <span
                                key={skill}
                                className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                    </article>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-4">
                <button
                  onClick={() => void changePage(page - 1)}
                  disabled={searching || page <= 1}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="text-sm text-slate-600">
                  Page {page} / {totalPages}
                </span>

                <button
                  onClick={() => void changePage(page + 1)}
                  disabled={searching || page >= totalPages}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
