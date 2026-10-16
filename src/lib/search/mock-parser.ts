
import {
    candidateCities,
    candidateRoles,
    emptySearchFilters,
    searchFiltersSchema,
    type SearchFilters,
  } from "./filters";
  
  export function mockParseBrief(brief: string): SearchFilters {
    const text = brief.toLowerCase();
  
    const filters: SearchFilters = {
      ...emptySearchFilters,
    };
  
    // Determine roles
    if (text.includes("react engineer")) {
      filters.roles = [
        "Frontend Engineer",
        "Full Stack Engineer",
      ];
    } else {
      const matchingRole = candidateRoles.find((role) =>
        text.includes(role.toLowerCase())
      );
  
      if (matchingRole) {
        filters.roles = [matchingRole];
      }
    }
  
    // Determine seniority
    for (const seniority of [
      "junior",
      "mid",
      "senior",
      "staff",
    ] as const) {
      if (text.includes(seniority)) {
        filters.seniority = seniority;
        break;
      }
    }
  
    // Determine city
    const matchingCity = candidateCities.find((city) =>
      text.includes(city.toLowerCase())
    );
  
    if (matchingCity) {
      filters.city = matchingCity;
    }
  
    // Determine skills
    const supportedSkills = [
      "React",
      "Python",
      "AWS",
      "Go",
      "Kubernetes",
      "Swift",
      "SQL",
      "TypeScript",
      "Next.js",
      "Node.js",
    ];
  
    const skills = supportedSkills.filter((skill) => {
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(
        `(^|[^a-z0-9])${escaped}($|[^a-z0-9])`,
        "i"
      );
      return pattern.test(brief);
    });
  
    if (skills.length > 0) {
      filters.skills = skills;
    }
  
    // Determine work availability
    if (text.includes("open to work")) {
      filters.open_to_work = true;
    }
  
    // Determine company type
    if (text.includes("startup")) {
      filters.company_type = "startup";
    } else if (text.includes("enterprise")) {
      filters.company_type = "enterprise";
    }
  
    // Determine education
    if (/\bphd\b|doctorate/i.test(brief)) {
      filters.degree = "PhD";
    }
  
    if (text.includes("stanford")) {
      filters.school = "Stanford";
    }
  
    return searchFiltersSchema.parse(filters);
  }
  