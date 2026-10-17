
import { NextResponse } from "next/server";
import { authenticateRecruiter } from "@/lib/auth/recruiter";
import { parseBrief } from "@/lib/search/parse-brief";

export async function POST(request: Request) {
  try {
    const auth = await authenticateRecruiter(request);

    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const brief = body?.brief;

    if (
      typeof brief !== "string" ||
      !brief.trim() ||
      brief.length > 2000
    ) {
      return NextResponse.json(
        { error: "Brief must contain 1–2000 characters" },
        { status: 400 }
      );
    }

    // The LLM extracts filters only.
    // PostgreSQL performs the actual candidate search.
    const filters = await parseBrief(brief.trim());

    const { data: matches, error: searchError } =
      await auth.supabase.rpc("search_candidates", {
        p_roles: filters.roles,
        p_seniority: filters.seniority,
        p_city: filters.city,
        p_skills: filters.skills,
        p_open_to_work: filters.open_to_work,
        p_company_type: filters.company_type,
        p_degree: filters.degree,
        p_school: filters.school,
        p_min_years_experience: filters.min_years_experience,
        p_limit: 5000,
        p_offset: 0,
      });

    if (searchError) {
      throw searchError;
    }

    const orderedMatches = matches ?? [];

    // Temporary implementation: consume the quota before saving.
    // We'll make quota + search creation transactional next.
    const { data: quotaRows, error: quotaError } =
      await auth.supabase.rpc("consume_search_quota", {
        p_company_id: auth.companyId,
      });

    if (quotaError) {
      throw quotaError;
    }

    const quota = quotaRows?.[0];

    if (!quota?.allowed) {
      return NextResponse.json(
        { error: "No free searches remaining" },
        { status: 402 }
      );
    }

    const { data: savedSearch, error: saveError } =
      await auth.supabase
        .from("searches")
        .insert({
          company_id: auth.companyId,
          recruiter_id: auth.userId,
          brief: brief.trim(),
          filters,
          total: orderedMatches.length,
        })
        .select("id")
        .single();

    if (saveError || !savedSearch) {
      throw saveError ?? new Error("Could not save search");
    }

    const rows = orderedMatches.map(
      (
        match: {
          candidate_id: string;
          rank_score: number;
        },
        index: number
      ) => ({
        search_id: savedSearch.id,
        candidate_id: match.candidate_id,
        position: index,
        rank_score: match.rank_score,
      })
    );

    // Insert snapshots in batches.
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await auth.supabase
        .from("search_results")
        .insert(rows.slice(i, i + 200));

      if (error) {
        throw error;
      }
    }

    return NextResponse.json({
      search_id: savedSearch.id,
      filters,
      total: orderedMatches.length,
      results: orderedMatches.slice(0, 20),
      searches_remaining: quota.remaining,
    });
  } catch (error) {
    console.error("Search API failed:", error);

    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
