
import { NextResponse } from "next/server";
import { authenticateRecruiter } from "@/lib/auth/recruiter";
import { searchFiltersSchema } from "@/lib/search/filters";

export async function GET(request: Request) {
  try {
    const auth = await authenticateRecruiter(request);

    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data, error } = await auth.supabase
      .from("saved_briefs")
      .select("id, brief, filters, created_at")
      .eq("company_id", auth.companyId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ saved_briefs: data ?? [] });
  } catch (error) {
    console.error("Get saved briefs failed:", error);

    return NextResponse.json(
      { error: "Could not load saved briefs" },
      { status: 500 }
    );
  }
}

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

    const brief =
      typeof body?.brief === "string" ? body.brief.trim() : "";

    if (brief.length < 1 || brief.length > 2000) {
      return NextResponse.json(
        { error: "Brief must be between 1 and 2000 characters" },
        { status: 400 }
      );
    }

    const parsedFilters = searchFiltersSchema.safeParse(body?.filters);

    if (!parsedFilters.success) {
      return NextResponse.json(
        { error: "Invalid search filters" },
        { status: 400 }
      );
    }

    const { data, error } = await auth.supabase
      .from("saved_briefs")
      .insert({
        company_id: auth.companyId,
        recruiter_id: auth.userId,
        brief,
        filters: parsedFilters.data,
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    console.error("Save brief failed:", error);

    return NextResponse.json(
      { error: "Could not save brief" },
      { status: 500 }
    );
  }
}
