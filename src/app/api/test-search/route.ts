
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseBrief } from "@/lib/search/parse-brief";

export async function POST(request: Request) {
  try {
    const { brief } = await request.json();

    if (typeof brief !== "string" || !brief.trim()) {
      return NextResponse.json(
        { error: "A hiring brief is required" },
        { status: 400 }
      );
    }

    const filters = await parseBrief(brief);

    // Development-only client for testing the SQL function.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    );

    const { data, error } = await supabase.rpc(
      "search_candidates",
      {
        p_roles: filters.roles,
        p_seniority: filters.seniority,
        p_city: filters.city,
        p_skills: filters.skills,
        p_open_to_work: filters.open_to_work,
        p_company_type: filters.company_type,
        p_degree: filters.degree,
        p_school: filters.school,
        p_min_years_experience: filters.min_years_experience,
        p_limit: 20,
        p_offset: 0,
      }
    );

    if (error) {
      throw error;
    }

    return NextResponse.json({
      filters,
      total: data?.[0]?.total_count ?? 0,
      results: data ?? [],
    });
  } catch (error) {
    console.error("Search test failed:", error);

    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
