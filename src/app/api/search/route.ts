
import { NextResponse } from "next/server";
import { authenticateRecruiter } from "@/lib/auth/recruiter";
import { parseBrief } from "@/lib/search/parse-brief";

import { searchFiltersSchema } from "@/lib/search/filters";

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
    // A normal search uses the LLM to extract filters.
    // A corrected search uses recruiter-edited filters,
    // validated against the same strict schema.
    const hasEditedFilters =
    Object.prototype.hasOwnProperty.call(body, "filters");

    let filters;

    if (hasEditedFilters) {
    const validation = searchFiltersSchema.safeParse(body.filters);

    if (!validation.success) {
        return NextResponse.json(
        { error: "Invalid search filters" },
        { status: 400 }
        );
    }

    filters = validation.data;
    } else {
    filters = await parseBrief(brief.trim());
    }

    // Prevent edited searches from accidentally matching everyone.
    // The restriction applies only to manually corrected filters.
    if (hasEditedFilters) {
        const hasActiveFilters = Object.values(filters).some(
        (value) =>
            value !== null &&
            (!Array.isArray(value) || value.length > 0)
        );
    
        if (!hasActiveFilters) {
        return NextResponse.json(
            {
            error: "At least one search filter is required",
            },
            { status: 400 }
        );
        }
    }

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


    // One database transaction creates the search, snapshots
    // every ranked result, and consumes the search credit.
    const { data: createdRows, error: createError } =
      await auth.supabase.rpc("create_search_atomic", {
        p_company_id: auth.companyId,
        p_recruiter_id: auth.userId,
        p_brief: brief.trim(),
        p_filters: filters,
        p_matches: orderedMatches.map(
          (match: {
            candidate_id: string;
            rank_score: number;
          }) => ({
            candidate_id: match.candidate_id,
            rank_score: match.rank_score,
          })
        ),
      });

    if (createError) {
      throw createError;
    }

    const created = createdRows?.[0];

    if (!created?.search_id) {
      return NextResponse.json(
        { error: "No free searches remaining" },
        { status: 402 }
      );
    }

    return NextResponse.json({
      search_id: created.search_id,
      filters,
      total: orderedMatches.length,
      results: orderedMatches.slice(0, 20),
      searches_remaining: created.searches_remaining,
    });screenTop
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Unsupported search requirements:")
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: 422 }
      );
    }

    console.error("Search API failed:", error);

    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
