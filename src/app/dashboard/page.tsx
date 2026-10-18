
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import {
  candidateCities,
  candidateRoles,
  emptySearchFilters,
  type SearchFilters,
} from "@/lib/search/filters";

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

function candidateInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function DashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(true);

  const [brief, setBrief] = useState("");
  const [animatedBrief, setAnimatedBrief] = useState("");
  const [briefFocused, setBriefFocused] = useState(false);
  const [briefInteracted, setBriefInteracted] = useState(false);

  useEffect(() => {
    if (brief || briefFocused) {
      return;
    }

    const examples = [
      "Senior React engineers in New York with startup experience",
      "Machine learning engineers with Python and PyTorch",
      "Product designers in San Francisco with Figma experience",
    ];

    let exampleIndex = 0;
    let characterIndex = 0;
    let deleting = false;
    let timeout: ReturnType<typeof setTimeout>;

    function animate() {
      const example = examples[exampleIndex];

      if (!deleting) {
        characterIndex++;
        setAnimatedBrief(example.slice(0, characterIndex));

        if (characterIndex >= example.length) {
          deleting = true;
          timeout = setTimeout(animate, 1700);
          return;
        }
      } else {
        characterIndex--;
        setAnimatedBrief(example.slice(0, characterIndex));

        if (characterIndex <= 0) {
          deleting = false;
          exampleIndex = (exampleIndex + 1) % examples.length;
          timeout = setTimeout(animate, 450);
          return;
        }
      }

      timeout = setTimeout(animate, deleting ? 25 : 65);
    }

    timeout = setTimeout(animate, 400);

    return () => clearTimeout(timeout);
  }, [brief, briefFocused, briefInteracted]);

  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const [searchId, setSearchId] = useState<string | null>(null);
  const [results, setResults] = useState<CandidateResult[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Candidate>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<SearchFilters>(emptySearchFilters);
  const [editedFilters, setEditedFilters] =
    useState<SearchFilters>(emptySearchFilters);
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

      // Clear temporary search state when a recruiter signs in.
      // Saved briefs and shortlists are loaded separately for their company.
      setBrief("");
      setAnimatedBrief("");
      setBriefFocused(false);
      setBriefInteracted(false);
      setSearchId(null);
      setResults([]);
      setProfiles({});
      setTotal(0);
      setPage(1);
      setFilters(emptySearchFilters);
      setEditedFilters(emptySearchFilters);
      setPlan(null);
      setSavedBriefs([]);
      setShortlists([]);
      setSelectedShortlistId("");
      setShortlistMembers([]);
      setWorkspaceMessage("");

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
      const validatedFilters = search.filters as SearchFilters;
      setFilters(validatedFilters);
      setEditedFilters(validatedFilters);
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

  async function applyEditedFilters() {
    if (!brief.trim() || searching || !searchId) return;
  
    const hasActiveFilters = Object.values(editedFilters).some(
      (value) =>
        value !== null &&
        (!Array.isArray(value) || value.length > 0)
    );
  
    if (!hasActiveFilters) {
      setError("Select at least one filter before applying changes.");
      return;
    }
  
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
        body: JSON.stringify({
          brief: brief.trim(),
          filters: editedFilters,
        }),
      });
  
      const body = await response.json();
  
      if (!response.ok) {
        throw new Error(
          body.error ??
            (response.status === 402
              ? "You have used your free search. Upgrade to apply more filters."
              : "Could not apply filters.")
        );
      }
  
      const search = body as SearchResponse;
      const validatedFilters = search.filters as SearchFilters;
  
      setSearchId(search.search_id);
      setResults(search.results);
      setTotal(search.total);
      setFilters(validatedFilters);
      setEditedFilters(validatedFilters);
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
        caught instanceof Error
          ? caught.message
          : "Could not apply filters."
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

async function renameShortlist() {
  if (!selectedShortlistId || workspaceBusy) return;

  const current = shortlists.find(
    (item) => item.id === selectedShortlistId
  );

  if (!current) return;

  const newName = window.prompt(
    "Rename shortlist:",
    current.name
  );

  if (newName === null) return;

  const name = newName.trim();

  if (!name || name.length > 100) {
    setWorkspaceMessage(
      "Shortlist name must contain 1–100 characters."
    );
    return;
  }

  if (name === current.name) return;

  setWorkspaceBusy(true);
  setWorkspaceMessage("");

  try {
    const token = await getToken();

    const response = await fetch(
      `/api/shortlists/${encodeURIComponent(selectedShortlistId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      }
    );

    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error ?? "Could not rename shortlist.");
    }

    setShortlists((previous) =>
      previous.map((item) =>
        item.id === selectedShortlistId
          ? { ...item, name: body.name }
          : item
      )
    );

    setWorkspaceMessage("Shortlist renamed successfully.");
  } catch (caught) {
    setWorkspaceMessage(
      caught instanceof Error
        ? caught.message
        : "Could not rename shortlist."
    );
  } finally {
    setWorkspaceBusy(false);
  }
}

async function deleteShortlist() {
  if (!selectedShortlistId || workspaceBusy) return;

  const current = shortlists.find(
    (item) => item.id === selectedShortlistId
  );

  if (!current) return;

  const confirmed = window.confirm(
    `Delete "${current.name}" and remove its saved candidates from this shortlist?`
  );

  if (!confirmed) return;

  setWorkspaceBusy(true);
  setWorkspaceMessage("");

  try {
    const token = await getToken();

    const response = await fetch(
      `/api/shortlists/${encodeURIComponent(selectedShortlistId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error ?? "Could not delete shortlist.");
    }

    const remaining = shortlists.filter(
      (item) => item.id !== selectedShortlistId
    );

    setShortlists(remaining);
    setSelectedShortlistId(remaining[0]?.id ?? "");
    setShortlistMembers([]);

    setWorkspaceMessage("Shortlist deleted successfully.");
  } catch (caught) {
    setWorkspaceMessage(
      caught instanceof Error
        ? caught.message
        : "Could not delete shortlist."
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
  if (!selectedShortlistId) return;

  let cancelled = false;

  async function refreshMembers() {
    await Promise.resolve();

    if (!cancelled) {
      await loadShortlistMembers(selectedShortlistId);
    }
  }

  void refreshMembers();

  return () => {
    cancelled = true;
  };

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
    <main className="min-h-screen bg-[#fafafa] px-4 py-6 text-[#222222] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="sticky top-4 z-30 mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 rounded-full border border-[#ece8f5] bg-white/95 px-5 py-3 shadow-[0_8px_35px_rgba(36,24,75,0.07)] backdrop-blur-xl sm:px-7">
          <a
            href="#search"
            className="text-2xl font-extrabold tracking-[-0.07em] text-[#222222]"
          >
            rotto<span className="text-[#7658f6]">.</span>
          </a>

          <nav aria-label="Workspace navigation" className="flex flex-wrap items-center gap-4 text-xs font-semibold text-[#666] sm:gap-6 sm:text-sm">
            <a href="#search" className="hover:text-[#7658f6]">
              Search
            </a>
            <a href="#saved-briefs" className="hover:text-[#7658f6]">
              Saved briefs
            </a>
            <a href="#shortlists" className="hover:text-[#7658f6]">
              Shortlists
            </a>
            <a href="#saved-candidates" className="hover:text-[#7658f6]">
              Candidates
            </a>
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden text-xs font-semibold text-[#777] lg:inline">
              {company}
            </span>

            {plan && (
              <div className="rounded-full bg-[#f2eeff] px-3 py-2 text-xs text-[#6244e6]">
                <span className="font-bold capitalize">{plan.plan}</span>
                <span className="ml-2">
                  {plan.searches_remaining === null
                    ? "Unlimited"
                    : `${plan.searches_remaining} searches left`}
                </span>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="rounded-full border border-[#e8e2f5] bg-white px-4 py-2 text-xs font-semibold hover:bg-[#f7f4ff]"
            >
              Sign out
            </button>
          </div>
        </header>

        <p className="mt-3 text-center text-xs text-[#888]">
          {company} · Recruiter workspace · {email}
        </p>


        <section id="search" className="rotto-fade-up scroll-mt-28 pt-16 sm:pt-24">
          <div className="mb-12 text-center">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#7658F6]">
              AI-powered talent search
            </p>

            <h2 className="text-4xl font-extrabold tracking-[-0.055em] text-[#222222] sm:text-5xl lg:text-6xl">
              ChatGPT for{" "}
              <span className="rotto-highlight-purple">hiring.</span>
            </h2>

            <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[#777777] sm:text-base">
              Describe your ideal candidate in plain English.
              Find the right people from 5,000 candidate profiles.
            </p>
          </div>

          <form
            onSubmit={handleSearch}
            className="rotto-search-glow mx-auto max-w-5xl rounded-[28px] border border-[#e4d9ff] bg-white p-5 shadow-[0_20px_70px_rgba(118,88,246,0.10)] sm:p-7"
          >
            <label htmlFor="brief" className="sr-only">
              Candidate search brief
            </label>

            <textarea
              id="brief"
              value={brief}
              onChange={(event) => {
                setBriefInteracted(true);
                setBrief(event.target.value);
              }}
              placeholder={
                briefFocused
                  ? "Describe your ideal candidate..."
                  : animatedBrief || "Describe your ideal candidate..."
              }
              onFocus={() => {
                setBriefFocused(true);
                setBriefInteracted(true);
              }}
              onBlur={() => setBriefFocused(false)}
              rows={3}
              maxLength={2000}
              className="min-h-32 w-full resize-y rounded-2xl border border-[#e8e2f5] bg-[#fcfbff] p-5 text-base leading-7 text-[#222222] outline-none placeholder:text-[#a5a0b1] focus:border-[#a992ff] focus:ring-2 focus:ring-[#e8e0ff]"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Filters are extracted from your brief, then applied to the candidate database.
              </p>

              <button
                type="submit"
                disabled={searching || !brief.trim()}
                className="rounded-xl bg-[#7658f6] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#6244e6] disabled:cursor-not-allowed disabled:bg-[#b4a4ff] disabled:text-white"
              >
                {searching ? "Working..." : "Search candidates"}
              </button>
            </div>
          </form>

          {error && (
            <p
              role="alert"
              className="mx-auto mt-5 max-w-5xl rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </p>
          )}
        </section>

        <section className="mt-12 grid gap-5 md:grid-cols-2">
          <div id="saved-briefs" className="scroll-mt-28 rounded-3xl border border-[#e9e3f5] bg-[#f5f0ff] p-6">
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

          <div
            id="shortlists"
            className="scroll-mt-28 rounded-3xl border border-[#dcece3] bg-[#eaf6ef] p-6"
          >
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
                maxLength={100}
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
              onChange={(event) => {
                setShortlistMembers([]);
                setSelectedShortlistId(event.target.value);
              }}
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

            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void renameShortlist()}
                disabled={workspaceBusy || !selectedShortlistId}
                className="rounded-lg border border-[#c8d9cf] bg-white px-4 py-2 text-xs font-semibold text-[#315c46] hover:bg-[#f6fff9] disabled:opacity-40"
              >
                Rename
              </button>

              <button
                type="button"
                onClick={() => void deleteShortlist()}
                disabled={workspaceBusy || !selectedShortlistId}
                className="rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                Delete
              </button>
            </div>
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


        <section
          id="saved-candidates"
          className="mt-6 scroll-mt-28 rounded-[28px] border border-[#eee4f3] bg-[#fffafd] p-6 sm:p-8"
        >
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
                  className="rotto-hover-card rounded-[22px] border border-[#ece5f5] bg-white p-5 shadow-[0_5px_20px_rgba(31,25,59,0.025)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        aria-hidden="true"
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e9deff] text-sm font-extrabold text-[#6b49d6]"
                      >
                        {candidateInitials(candidate.full_name)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-extrabold tracking-tight text-[#24212d]">
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
                          className="rounded-full bg-[#f0ebff] px-3 py-1.5 text-xs font-medium text-[#6650a5]"
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



        {searchId && (
          <section id="results" className="mt-12 scroll-mt-28">
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

            <div className="mb-6 rounded-2xl border border-[#e7ddff] bg-[#faf8ff] p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#222222]">
                    Refine your search
                  </h3>
                  <p className="mt-1 text-sm text-[#777777]">
                    Edit or remove the filters we understood from your brief.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditedFilters(emptySearchFilters);
                  }}
                  disabled={searching}
                  className="text-xs font-semibold text-[#7658f6] hover:underline disabled:opacity-50"
                >
                  Clear all
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  City
                  <select
                    value={editedFilters.city ?? ""}
                    onChange={(event) =>
                      setEditedFilters((previous) => ({
                        ...previous,
                        city: event.target.value
                          ? (event.target.value as SearchFilters["city"])
                          : null,
                      }))
                    }
                    className="w-full rounded-xl border border-[#e4d9ff] bg-white p-3 text-sm text-[#222222]"
                  >
                    <option value="">Any city</option>
                    {candidateCities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  Seniority
                  <select
                    value={editedFilters.seniority ?? ""}
                    onChange={(event) =>
                      setEditedFilters((previous) => ({
                        ...previous,
                        seniority: event.target.value
                          ? (event.target.value as SearchFilters["seniority"])
                          : null,
                      }))
                    }
                    className="w-full rounded-xl border border-[#e4d9ff] bg-white p-3 text-sm text-[#222222]"
                  >
                    <option value="">Any seniority</option>
                    {["junior", "mid", "senior", "staff"].map((level) => (
                      <option key={level} value={level}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  Role
                  <select
                    value={editedFilters.roles?.[0] ?? ""}
                    onChange={(event) =>
                      setEditedFilters((previous) => ({
                        ...previous,
                        roles: event.target.value
                          ? [event.target.value as (typeof candidateRoles)[number]]
                          : null,
                      }))
                    }
                    className="w-full rounded-xl border border-[#e4d9ff] bg-white p-3 text-sm text-[#222222]"
                  >
                    <option value="">Any role</option>
                    {candidateRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  Company type
                  <select
                    value={editedFilters.company_type ?? ""}
                    onChange={(event) =>
                      setEditedFilters((previous) => ({
                        ...previous,
                        company_type: event.target.value
                          ? (event.target.value as SearchFilters["company_type"])
                          : null,
                      }))
                    }
                    className="w-full rounded-xl border border-[#e4d9ff] bg-white p-3 text-sm text-[#222222]"
                  >
                    <option value="">Any company</option>
                    <option value="startup">Startup</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </label>

                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  Degree
                  <select
                    value={editedFilters.degree ?? ""}
                    onChange={(event) =>
                      setEditedFilters((previous) => ({
                        ...previous,
                        degree: event.target.value
                          ? (event.target.value as SearchFilters["degree"])
                          : null,
                      }))
                    }
                    className="w-full rounded-xl border border-[#e4d9ff] bg-white p-3 text-sm text-[#222222]"
                  >
                    <option value="">Any degree</option>
                    {["BA", "BS", "MBA", "MS", "PhD"].map((degree) => (
                      <option key={degree} value={degree}>
                        {degree}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  Open to work
                  <select
                    value={
                      editedFilters.open_to_work === null
                        ? ""
                        : String(editedFilters.open_to_work)
                    }
                    onChange={(event) =>
                      setEditedFilters((previous) => ({
                        ...previous,
                        open_to_work:
                          event.target.value === ""
                            ? null
                            : event.target.value === "true",
                      }))
                    }
                    className="w-full rounded-xl border border-[#e4d9ff] bg-white p-3 text-sm text-[#222222]"
                  >
                    <option value="">Any status</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </label>

                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  Skills (comma-separated)
                  <input
                    type="text"
                    value={(editedFilters.skills ?? []).join(", ")}
                    onChange={(event) =>
                      setEditedFilters((previous) => ({
                        ...previous,
                        skills:
                          event.target.value.trim() === ""
                            ? null
                            : event.target.value
                                .split(",")
                                .map((skill) => skill.trim())
                                .filter(Boolean),
                      }))
                    }
                    placeholder="React, TypeScript"
                    className="w-full rounded-xl border border-[#e4d9ff] bg-white p-3 text-sm text-[#222222]"
                  />
                </label>

                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  School
                  <input
                    type="text"
                    value={editedFilters.school ?? ""}
                    onChange={(event) =>
                      setEditedFilters((previous) => ({
                        ...previous,
                        school: event.target.value.trim() || null,
                      }))
                    }
                    placeholder="University name"
                    className="w-full rounded-xl border border-[#e4d9ff] bg-white p-3 text-sm text-[#222222]"
                  />
                </label>

                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  Minimum experience (years)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editedFilters.min_years_experience ?? ""}
                    onChange={(event) =>
                      setEditedFilters((previous) => ({
                        ...previous,
                        min_years_experience:
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                      }))
                    }
                    placeholder="Any experience"
                    className="w-full rounded-xl border border-[#e4d9ff] bg-white p-3 text-sm text-[#222222]"
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e7ddff] pt-4">
                <p className="text-xs text-slate-500">
                  Applying changes runs a new search and uses one search credit.
                </p>

                <button
                  type="button"
                  onClick={() => void applyEditedFilters()}
                  disabled={
                    searching ||
                    JSON.stringify(editedFilters) === JSON.stringify(filters)
                  }
                  className="rounded-xl bg-[#7658f6] px-5 py-3 text-sm font-bold text-white hover:bg-[#6244e6] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {searching ? "Applying..." : "Apply filters"}
                </button>
              </div>
            </div>

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
                      className="rotto-hover-card rounded-[24px] border border-[#eae3f4] bg-white p-6 shadow-[0_8px_25px_rgba(31,25,59,0.035)]"
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
                          <span className="rounded-full bg-[#e9e1ff] px-4 py-2 text-xs font-bold text-[#6244e6]">
                            Score {match.rank_score}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              void updateShortlistCandidate(match.candidate_id, "add")
                            }
                            disabled={workspaceBusy || !selectedShortlistId}
                            className="rounded-full border border-[#d8caff] bg-[#f5f0ff] px-4 py-2 text-xs font-bold text-[#6244e6] hover:bg-[#e9e1ff] disabled:opacity-40"
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

        <footer className="mt-24 space-y-14 pb-8">
          {/* Separate lavender call-to-action card */}
          <section className="mx-auto max-w-5xl rounded-[36px] border border-[#e4d8ff] bg-[#f0eaff] px-7 py-16 text-center sm:px-12 sm:py-20">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#7658f6]">
              Ready to find your next hire?
            </p>

            <h2 className="mx-auto mt-7 max-w-3xl text-4xl font-extrabold leading-[1.15] tracking-[-0.055em] text-[#21183b] sm:text-5xl">
              Your next great hire
              <span className="block text-[#7658f6]">
                is one search away.
              </span>
            </h2>

            <p className="mx-auto mt-7 max-w-xl text-sm leading-7 text-[#6b6280] sm:text-base">
              Describe what you&apos;re looking for. Explore matching
              profiles and build a shortlist worth reviewing.
            </p>

            <a
              href="#search"
              className="mt-9 inline-flex items-center gap-2 rounded-full bg-[#7658f6] px-7 py-3.5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(118,88,246,0.18)] hover:-translate-y-0.5 hover:bg-[#6244e6]"
            >
              Start searching
              <span aria-hidden="true">↗</span>
            </a>
          </section>

          {/* Separate dark footer card */}
          <div className="rounded-[36px] bg-[#21183b] px-8 pb-8 pt-14 text-white sm:px-12 sm:pt-16">
            <div className="grid gap-12 sm:grid-cols-[1.2fr_1fr]">
              <div>
                <a
                  href="#search"
                  className="text-5xl font-extrabold tracking-[-0.08em]"
                >
                  rotto<span className="text-[#c6ffb0]">.</span>
                </a>

                <p className="mt-5 max-w-xs text-sm leading-7 text-[#c9c0da]">
                  Search naturally. Build better shortlists.
                </p>
              </div>

              <nav
                aria-label="Footer navigation"
                className="flex flex-col gap-4 sm:items-start sm:pl-12"
              >
                <p className="mb-1 text-sm font-bold text-white">
                  Explore
                </p>

                <a href="#search" className="text-sm text-[#c9c0da] hover:text-white">
                  Search
                </a>
                <a href="#saved-briefs" className="text-sm text-[#c9c0da] hover:text-white">
                  Saved briefs
                </a>
                <a href="#shortlists" className="text-sm text-[#c9c0da] hover:text-white">
                  Shortlists
                </a>
                <a href="#saved-candidates" className="text-sm text-[#c9c0da] hover:text-white">
                  Candidates
                </a>
              </nav>
            </div>

            <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-white/20 pt-7">
              <p className="text-xs text-[#c9c0da]">
                Powered by Next.js + Supabase
              </p>

              <p className="text-xs font-medium text-white">
                Designed &amp; built by shravanips
                <span className="ml-2 text-[#d7b4ff]" aria-hidden="true">♡</span>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
