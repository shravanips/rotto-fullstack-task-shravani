
import { NextResponse } from "next/server";
import { parseBrief } from "@/lib/search/parse-brief";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (
      typeof body.brief !== "string" ||
      !body.brief.trim()
    ) {
      return NextResponse.json(
        { error: "A hiring brief is required" },
        { status: 400 }
      );
    }

    const filters = await parseBrief(body.brief);

    return NextResponse.json({ filters });
  } catch (error) {
    console.error("Parser test failed:", error);

    return NextResponse.json(
      { error: "Failed to parse hiring brief" },
      { status: 500 }
    );
  }
}
