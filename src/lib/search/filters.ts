
import { z } from "zod";

export const candidateRoles = [
  "DevOps Engineer",
  "Mobile Engineer",
  "Backend Engineer",
  "Marketing Manager",
  "Product Manager",
  "Product Designer",
  "Full Stack Engineer",
  "Data Engineer",
  "Recruiter",
  "Account Executive",
  "Data Scientist",
  "Machine Learning Engineer",
  "Frontend Engineer",
] as const;

export const candidateCities = [
  "Atlanta",
  "Austin",
  "Boston",
  "Chicago",
  "Denver",
  "Los Angeles",
  "Miami",
  "New York",
  "San Francisco",
  "Seattle",
] as const;

export const searchFiltersSchema = z.object({
  roles: z.array(z.enum(candidateRoles)).nullable().default(null),

  seniority: z.enum([
    "junior",
    "mid",
    "senior",
    "staff",
  ]).nullable().default(null),

  city: z.enum(candidateCities).nullable().default(null),

  skills: z.array(z.string().min(1)).nullable().default(null),

  open_to_work: z.boolean().nullable().default(null),

  company_type: z.enum([
    "startup",
    "enterprise",
  ]).nullable().default(null),

  degree: z.enum([
    "BA",
    "BS",
    "MBA",
    "MS",
    "PhD",
  ]).nullable().default(null),

  school: z.string().min(1).nullable().default(null),

  min_years_experience: z.number()
    .nonnegative()
    .nullable()
    .default(null),
}).strict();

export type SearchFilters = z.infer<
  typeof searchFiltersSchema
>;

export const emptySearchFilters: SearchFilters = {
  roles: null,
  seniority: null,
  city: null,
  skills: null,
  open_to_work: null,
  company_type: null,
  degree: null,
  school: null,
  min_years_experience: null,
};
