
import { NextResponse } from "next/server";
import { authenticateRecruiter } from "@/lib/auth/recruiter";

type RouteContext = {
  params: Promise<{ id: string; personId: string }>;
};

async function getAuthorizedShortlist(
  request: Request,
  context: RouteContext
) {
  const auth = await authenticateRecruiter(request);

  if (!auth) {
    return { error: "Unauthorized", status: 401 } as const;
  }

  const { id, personId } = await context.params;

  const { data: shortlist, error } = await auth.supabase
    .from("shortlists")
    .select("id")
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .maybeSingle();

  if (error) throw error;

  if (!shortlist) {
    return { error: "Shortlist not found", status: 404 } as const;
  }

  return { auth, shortlistId: id, personId };
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const result = await getAuthorizedShortlist(request, context);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    const { auth, shortlistId, personId } = result;

    const { data: candidate, error: candidateError } =
      await auth.supabase
        .from("candidates")
        .select("id")
        .eq("id", personId)
        .maybeSingle();

    if (candidateError) throw candidateError;

    if (!candidate) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 }
      );
    }

    const { error } = await auth.supabase
      .from("shortlist_people")
      .upsert(
        {
          shortlist_id: shortlistId,
          candidate_id: personId,
        },
        { onConflict: "shortlist_id,candidate_id", ignoreDuplicates: true }
      );

    if (error) throw error;

    return NextResponse.json({
      success: true,
      shortlist_id: shortlistId,
      candidate_id: personId,
    });
  } catch (error) {
    console.error("Add shortlist candidate failed:", error);

    return NextResponse.json(
      { error: "Could not add candidate" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext
) {
  try {
    const result = await getAuthorizedShortlist(request, context);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    const { auth, shortlistId, personId } = result;

    const { error } = await auth.supabase
      .from("shortlist_people")
      .delete()
      .eq("shortlist_id", shortlistId)
      .eq("candidate_id", personId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      shortlist_id: shortlistId,
      candidate_id: personId,
    });
  } catch (error) {
    console.error("Remove shortlist candidate failed:", error);

    return NextResponse.json(
      { error: "Could not remove candidate" },
      { status: 500 }
    );
  }
}
