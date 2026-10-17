
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

    const { data, error } = await auth.supabase
      .from("shortlists")
      .select("id, name, created_at")
      .eq("company_id", auth.companyId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ shortlists: data ?? [] });
  } catch (error) {
    console.error("Get shortlists failed:", error);

    return NextResponse.json(
      { error: "Could not load shortlists" },
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
    const name =
      typeof body?.name === "string" ? body.name.trim() : "";

    if (name.length < 1 || name.length > 120) {
      return NextResponse.json(
        { error: "Name must be between 1 and 120 characters" },
        { status: 400 }
      );
    }

    const { data, error } = await auth.supabase
      .from("shortlists")
      .insert({
        company_id: auth.companyId,
        created_by: auth.userId,
        name,
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json(
      { id: data.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create shortlist failed:", error);

    return NextResponse.json(
      { error: "Could not create shortlist" },
      { status: 500 }
    );
  }
}
