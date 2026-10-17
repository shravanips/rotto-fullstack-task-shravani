
import { NextResponse } from "next/server";
import { authenticateRecruiter } from "@/lib/auth/recruiter";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: Request,
  context: RouteContext
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

    // Verify the shortlist belongs to this recruiter's company.
    const { data: shortlist, error: shortlistError } =
      await auth.supabase
        .from("shortlists")
        .select("id, name")
        .eq("id", id)
        .eq("company_id", auth.companyId)
        .maybeSingle();

    if (shortlistError) throw shortlistError;

    if (!shortlist) {
      return NextResponse.json(
        { error: "Shortlist not found" },
        { status: 404 }
      );
    }

    const { data: members, error: membersError } =
      await auth.supabase
        .from("shortlist_people")
        .select("candidate_id, added_at")
        .eq("shortlist_id", id)
        .order("added_at", { ascending: false });

    if (membersError) throw membersError;

    const ids = (members ?? []).map(
      (member) => member.candidate_id
    );

    if (ids.length === 0) {
      return NextResponse.json({
        id: shortlist.id,
        name: shortlist.name,
        candidates: [],
      });
    }

    const { data: candidates, error: candidatesError } =
      await auth.supabase
        .from("candidates")
        .select(
          "id, full_name, current_title, current_company, skills, location"
        )
        .in("id", ids);

    if (candidatesError) throw candidatesError;

    const byId = new Map(
      (candidates ?? []).map((candidate) => [
        candidate.id,
        candidate,
      ])
    );

    return NextResponse.json({
      id: shortlist.id,
      name: shortlist.name,
      candidates: ids
        .map((candidateId) => byId.get(candidateId))
        .filter(Boolean),
    });
  } catch (error) {
    console.error("Get shortlist members failed:", error);

    return NextResponse.json(
      { error: "Could not load shortlist members" },
      { status: 500 }
    );
  }
}
