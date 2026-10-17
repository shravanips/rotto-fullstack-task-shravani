
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


type SavedBrief = {
  id: string;
  brief: string;
  filters: Record<string, unknown>;
  created_at: string;
};

type Shortlist = {
  id: string;
  name: string;
  created_at: string;
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

  const [savedBriefs, setSavedBriefs] = useState<SavedBrief[]>([]);
  const [shortlists, setShortlists] = useState<Shortlist[]>([]);
  const [shortlistName, setShortlistName] = useState("");
  const [selectedShortlistId, setSelectedShortlistId] = useState("");
  const [workspaceMessage, setWorkspaceMessage] = useState("");
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  
  const [shortlistMembers, setShortlistMembers] = useState<Candidate[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);


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
          const headers = { Authorization: `Bearer ${token}` };
      
          const [planResponse, briefsResponse, shortlistsResponse] =
            await Promise.all([
              fetch("/api/plan", { headers }),
              fetch("/api/saved-briefs", { headers }),
              fetch("/api/shortlists", { headers }),
            ]);
      
          if (planResponse.ok) {
            setPlan((await planResponse.json()) as Plan);
          }
      
          if (briefsResponse.ok) {
            const body = await briefsResponse.json();
            setSavedBriefs(body.saved_briefs ?? []);
          }
      
          if (shortlistsResponse.ok) {
            const body = await shortlistsResponse.json();
            const lists = (body.shortlists ?? []) as Shortlist[];
      
            setShortlists(lists);
            if (lists.length > 0) {
              setSelectedShortlistId(lists[0].id);
            }
          }
        } catch {
          setWorkspaceMessage("Could not load all workspace data.");
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


  async function loadShortlistMembers(shortlistId: string) {
    if (!shortlistId) {
      setShortlistMembers([]);
      return;
    }
  
    setMembersLoading(true);
  
    try {
      const token = await getToken();
  
      const response = await fetch(
        `/api/shortlists/${encodeURIComponent(shortlistId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );
  
      const body = await response.json();
  
      if (!response.ok) {
        throw new Error(body.error ?? "Could not load shortlist.");
      }
  
      setShortlistMembers(body.candidates ?? []);
    } catch (caught) {
      setWorkspaceMessage(
        caught instanceof Error
          ? caught.message
          : "Could not load shortlist."
      );
    } finally {
      setMembersLoading(false);
    }
  }
  

async function saveCurrentBrief() {
  if (!searchId || !brief.trim()) {
    setWorkspaceMessage("Run a search before saving its brief.");
    return;
  }

  setWorkspaceBusy(true);
  setWorkspaceMessage("");

  try {
    const token = await getToken();

    const response = await fetch("/api/saved-briefs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        brief: brief.trim(),
        filters,
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error ?? "Could not save brief.");
    }

    const listResponse = await fetch("/api/saved-briefs", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!listResponse.ok) {
      throw new Error("Brief saved, but the list could not be refreshed.");
    }

    const listBody = await listResponse.json();
    setSavedBriefs(listBody.saved_briefs ?? []);
    setWorkspaceMessage("Search brief saved.");
  } catch (caught) {
    setWorkspaceMessage(
      caught instanceof Error ? caught.message : "Could not save brief."
    );
  } finally {
    setWorkspaceBusy(false);
  }
}

async function createShortlist() {
  const name = shortlistName.trim();
  if (!name) return;

  setWorkspaceBusy(true);
  setWorkspaceMessage("");

  try {
    const token = await getToken();

    const response = await fetch("/api/shortlists", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name }),
    });

    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error ?? "Could not create shortlist.");
    }

    const listResponse = await fetch("/api/shortlists", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!listResponse.ok) {
      throw new Error("Shortlist created, but the list could not be refreshed.");
    }

    const listBody = await listResponse.json();

    setShortlists(listBody.shortlists ?? []);
    setSelectedShortlistId(body.id);
    setShortlistName("");
    setWorkspaceMessage(`Created shortlist "${name}".`);
  } catch (caught) {
    setWorkspaceMessage(
      caught instanceof Error ? caught.message : "Could not create shortlist."
    );
  } finally {
    setWorkspaceBusy(false);
  }
}

async function updateShortlistCandidate(
  candidateId: string,
  action: "add" | "remove"
) {
  if (!selectedShortlistId) {
    setWorkspaceMessage("Create or select a shortlist first.");
    return;
  }

  setWorkspaceBusy(true);
  setWorkspaceMessage("");

  try {
    const token = await getToken();

    const response = await fetch(
      `/api/shortlists/${encodeURIComponent(selectedShortlistId)}/people/${encodeURIComponent(candidateId)}`,
      {
        method: action === "add" ? "POST" : "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error ?? "Could not update shortlist.");
    }

    await loadShortlistMembers(selectedShortlistId);

    setWorkspaceMessage(
      action === "add"
        ? "Candidate added to shortlist."
        : "Candidate removed from shortlist."
    );
  } catch (caught) {
    setWorkspaceMessage(
      caught instanceof Error ? caught.message : "Could not update shortlist."
    );
  } finally {
    setWorkspaceBusy(false);
  }
}
useEffect(() => {
  if (!selectedShortlistId) {
    setShortlistMembers([]);
    return;
  }

  void loadShortlistMembers(selectedShortlistId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedShortlistId]);

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


        <section className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Saved briefs</h2>
              <button
                type="button"
                onClick={() => void saveCurrentBrief()}
                disabled={workspaceBusy || !searchId}
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
              >
                Save current search
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Save a search after running it. Select a brief to reuse its text.
            </p>

            <div className="mt-4 max-h-44 space-y-2 overflow-y-auto">
              {savedBriefs.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No saved briefs yet.
                </p>
              ) : (
                savedBriefs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setBrief(item.brief);
                      setWorkspaceMessage(
                        "Brief loaded. Click Search candidates to run a new search."
                      );
                    }}
                    className="block w-full rounded-lg border border-slate-200 p-3 text-left text-sm hover:bg-slate-50"
                  >
                    {item.brief}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold">Shortlists</h2>

            <p className="mt-2 text-xs text-slate-500">
              Create a shortlist and select it before adding candidates.
            </p>

            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={shortlistName}
                onChange={(event) => setShortlistName(event.target.value)}
                placeholder="e.g. Frontend candidates"
                maxLength={120}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />

              <button
                type="button"
                onClick={() => void createShortlist()}
                disabled={workspaceBusy || !shortlistName.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Create
              </button>
            </div>

            <label
              htmlFor="selected-shortlist"
              className="mt-4 block text-xs font-medium text-slate-600"
            >
              Active shortlist
            </label>

            <select
              id="selected-shortlist"
              value={selectedShortlistId}
              onChange={(event) => setSelectedShortlistId(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {shortlists.length === 0 && (
                <option value="">No shortlists created</option>
              )}

              {shortlists.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {workspaceMessage && (
          <p
            role="status"
            className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
          >
            {workspaceMessage}
          </p>
        )}


        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                Saved candidates
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Candidates in your currently selected shortlist.
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              {shortlistMembers.length} candidates
            </span>
          </div>

          {membersLoading ? (
            <p className="mt-4 text-sm text-slate-500">
              Loading saved candidates...
            </p>
          ) : shortlistMembers.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No candidates saved in this shortlist yet.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {shortlistMembers.map((candidate) => (
                <div
                  key={candidate.id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {candidate.full_name}
                      </h3>

                      <p className="mt-1 text-sm text-slate-600">
                        {candidate.current_title ?? "Candidate"}
                        {candidate.current_company &&
                          ` · ${candidate.current_company}`}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {locationText(candidate.location)}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={workspaceBusy}
                      onClick={() =>
                        void updateShortlistCandidate(candidate.id, "remove")
                      }
                      className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>

                  {candidate.skills && candidate.skills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {candidate.skills.slice(0, 5).map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>



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


                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                            Score {match.rank_score}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              void updateShortlistCandidate(match.candidate_id, "add")
                            }
                            disabled={workspaceBusy || !selectedShortlistId}
                            className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"
                          >
                            Add to shortlist
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void updateShortlistCandidate(match.candidate_id, "remove")
                            }
                            disabled={workspaceBusy || !selectedShortlistId}
                            className="text-xs text-slate-500 hover:text-red-600 disabled:opacity-40"
                          >
                            Remove
                          </button>
                        </div>

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
