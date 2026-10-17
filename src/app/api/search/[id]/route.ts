
import { NextResponse } from "next/server";
import { authenticateRecruiter } from "@/lib/auth/recruiter";

const PAGE_SIZE = 20;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRecruiter(request);

    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const url = new URL(request.url);
    const pageText = url.searchParams.get("page") ?? "1";
    const page = Number(pageText);

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !/^[1-9]\d*$/.test(pageText)
    ) {
      return NextResponse.json(
        { error: "Page must be a positive integer" },
        { status: 400 }
      );
    }

    // Check that this search belongs to the recruiter's company.
    const { data: search, error: searchError } =
      await auth.supabase
        .from("searches")
        .select("id, filters, total")
        .eq("id", id)
        .eq("company_id", auth.companyId)
        .maybeSingle();

    if (searchError) {
      throw searchError;
    }

    if (!search) {
      return NextResponse.json(
        { error: "Search not found" },
        { status: 404 }
      );
    }

    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE - 1;

    // Read the saved result order rather than running a new search.
    const { data: results, error: resultsError } =
      await auth.supabase
        .from("search_results")
        .select("candidate_id, rank_score, position")
        .eq("search_id", id)
        .order("position", { ascending: true })
        .range(start, end);

    if (resultsError) {
      throw resultsError;
    }

    return NextResponse.json({
      search_id: search.id,
      filters: search.filters,
      total: search.total,
      page,
      results: results ?? [],
    });
  } catch (error) {
    console.error("Search pagination failed:", error);

    return NextResponse.json(
      { error: "Could not load search results" },
      { status: 500 }
    );
  }
}
