
import { NextResponse } from "next/server";
import { authenticateRecruiter } from "@/lib/auth/recruiter";

export async function GET(request: Request) {
  try {
    const auth = await authenticateRecruiter(request);

    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: companyPlan, error } = await auth.supabase
      .from("company_plans")
      .select("plan, searches_used, free_search_limit")
      .eq("company_id", auth.companyId)
      .single();

    if (error || !companyPlan) {
      console.error("Plan lookup failed:", error);

      return NextResponse.json(
        { error: "Could not load company plan" },
        { status: 500 }
      );
    }

    const searchesRemaining =
      companyPlan.plan === "paid"
        ? null
        : Math.max(
            0,
            companyPlan.free_search_limit - companyPlan.searches_used
          );

    return NextResponse.json({
      plan: companyPlan.plan,
      searches_remaining: searchesRemaining,
    });
  } catch (error) {
    console.error("Plan API failed:", error);

    return NextResponse.json(
      { error: "Could not load company plan" },
      { status: 500 }
    );
  }
}
