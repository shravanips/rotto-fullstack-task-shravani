
import { mockParseBrief } from "./mock-parser";

import OpenAI from "openai";
import {
  candidateCities,
  candidateRoles,
  searchFiltersSchema,
  type SearchFilters,
} from "./filters";

const MODEL = "gpt-4.1-mini";

export async function parseBrief(
  brief: string
): Promise<SearchFilters> {
    if (
        process.env.NODE_ENV !== "production" &&
        process.env.MOCK_LLM === "true"
      ) {
        return mockParseBrief(brief);
      }
    
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `
You convert recruiting briefs into database filters.

Return ONLY a JSON object with these keys:
roles, seniority, city, skills, open_to_work,
company_type, degree, school, min_years_experience.

Supported roles:
${candidateRoles.join(", ")}

Supported cities:
${candidateCities.join(", ")}

Supported seniority: junior, mid, senior, staff.
Supported company types: startup, enterprise.
Supported degrees: BA, BS, MBA, MS, PhD.

Rules:
- Use null for criteria not mentioned.
- roles and skills must be arrays or null.
- "React engineers" may include both Frontend Engineer
  and Full Stack Engineer.
- Use exact supported role and city values.
- Do not invent skills, schools, or other filter values.
- Do not silently ignore unsupported requirements.
- If the brief contains a requirement that cannot be
  represented by these filters, return an additional
  key "unsupported_requirements" containing those
  requirements as an array of strings.
- Otherwise, return "unsupported_requirements": [].
- Never select candidates or generate candidate IDs.
        `.trim(),
      },
      {
        role: "user",
        content: brief,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("Model returned an empty response");
  }

  const parsed: unknown = JSON.parse(content);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new Error("Model returned invalid filters");
  }

  const {
    unsupported_requirements,
    ...filters
  } = parsed as Record<string, unknown>;

  if (
    !Array.isArray(unsupported_requirements) ||
    !unsupported_requirements.every(
      (item) => typeof item === "string"
    )
  ) {
    throw new Error("Invalid unsupported requirements");
  }

  if (unsupported_requirements.length > 0) {
    throw new Error(
      `Unsupported search requirements: ${unsupported_requirements.join(", ")}`
    );
  }

  return searchFiltersSchema.parse(filters);
}
