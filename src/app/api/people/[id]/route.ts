
import { NextResponse } from "next/server";
import { authenticateRecruiter } from "@/lib/auth/recruiter";

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

    const { data: candidate, error } =
      await auth.supabase
        .from("candidates")
        .select("*")
        .eq("id", id)
        .maybeSingle();

    if (error) {
      throw error;
    }

    if (!candidate) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(candidate);
  } catch (error) {
    console.error("Candidate profile failed:", error);

    return NextResponse.json(
      { error: "Could not load candidate profile" },
      { status: 500 }
    );
  }
}
