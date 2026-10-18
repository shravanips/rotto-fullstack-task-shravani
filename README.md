
# Rotto Talent Search

A full-stack recruiting workspace that turns natural-language hiring briefs into structured, ranked candidate searches.

Recruiters can search across 5,000 candidate profiles, inspect and refine matching results, save hiring briefs, and organize candidates into shortlists. The application also supports company-specific workspaces, free-tier search limits, and subscription updates through Stripe webhooks.

**Tech stack:** Next.js 16 · TypeScript · Tailwind CSS · Supabase Auth · PostgreSQL · OpenAI · Stripe Webhooks

## Application Preview

### Recruiter Workspace

![Rotto recruiter dashboard](docs/screenshots/01-free-plan-dashboard.png)

### Natural-Language Search, Editable Filters, and Ranked Results

![Ranked candidate search results and editable filters](docs/screenshots/03-ranked-search-results.png)

### Candidate Shortlisting

![Candidate saved to a shortlist](docs/screenshots/05-saved-candidate.png)

<details>
<summary>More screenshots</summary>

#### Paid Recruiter Workspace

![Globex paid recruiter workspace](docs/screenshots/02-paid-plan-search.png)

#### Shortlist Management

![Recruiter shortlist management](docs/screenshots/04-shortlist-created.png)

#### Recruiter Authentication

![Rotto login screen](docs/screenshots/06-login.png)

</details>

## Getting Started

### Prerequisites

- Node.js 24
- Docker Desktop (running)
- Make

### Local Setup

From the project root:

```bash
make setup
make dev
```

Open **http://localhost:3000/login**.

`make setup` installs dependencies, starts local Supabase, applies database migrations, seeds the recruiter accounts, imports the 5,000 candidate records, and configures the local development environment.

### Demo Accounts

| Company | Email | Password | Plan |
| --- | --- | --- | --- |
| Acme | `recruiter@acme.test` | `rotto-assessment` | Free — 1 search total |
| Globex | `recruiter@globex.test` | `rotto-assessment` | Paid — unlimited |

The local setup supports deterministic parsing with `MOCK_LLM=true`, allowing the complete search workflow to run without paid OpenAI API access.

To use live model parsing, configure a valid `OPENAI_API_KEY` and set `MOCK_LLM=false`.

## Architecture and Search Design

The central design decision is to separate **interpreting a hiring brief** from **retrieving candidates**.

```text
Recruiter hiring brief
         |
         v
Natural-language parser
(gpt-4.1-mini / deterministic mock)
         |
         v
Structured filter validation
         |
         v
PostgreSQL candidate filtering and ranking
         |
         v
Atomic quota consumption + search snapshot
         |
         v
Paginated results (20 candidates per page)
         |
         v
Saved briefs and recruiter shortlists
```

Recruiters can review and edit extracted filters after a search. Submitting edited filters creates a new validated search without another LLM call.

### 1. Natural-Language Parsing

The application includes an OpenAI integration using `gpt-4.1-mini` to translate a recruiter's description into structured search filters, including role, seniority, location, skills, experience, education, and company type.

The model is responsible only for interpreting the hiring brief. It does not select candidates or generate candidate profiles.

A deterministic mock parser is also available for local development and reproducible testing.

### 2. Schema Validation and Editable Filters

Parsed filters are validated against the application's supported schema and vocabulary.

Unsupported requirements are rejected rather than silently dropped. This makes the system's limitations explicit and avoids presenting results as though every requested constraint was applied.

Recruiters can inspect and modify extracted filters directly in the dashboard, including:

- Role and seniority
- Location
- Skills
- Minimum experience
- Education and school
- Company type
- Open-to-work preference

When edited filters are submitted, the API validates them again before executing the search. Empty filter submissions are rejected.

This allows recruiters to correct or refine their searches without repeating the LLM parsing step.

Applying edited filters creates a new search snapshot and follows the same company quota rules as a natural-language search.

### 3. Database-Grounded Retrieval

Candidate matching and ranking happen in PostgreSQL using validated filters.

**Hallucination guard:** The LLM does not receive the candidate database, select candidate IDs, or generate candidate profiles. Every returned candidate comes from an existing database record.

This keeps search results grounded in source data and makes the retrieval logic independently testable.

### 4. Persistent Search Results

Each completed search creates a company-scoped snapshot of ranked candidates.

Results are returned in pages of 20. Pagination reads the stored snapshot rather than executing a new search or consuming another search credit.

The search snapshot preserves result ordering across pages.

### 5. Model Choice and Estimated Cost

The application uses `gpt-4.1-mini` for natural-language filter extraction.

I chose this model because the task requires a relatively small structured output rather than long-form generation or complex reasoning. Candidate retrieval and ranking remain in PostgreSQL.

Using illustrative pricing of $0.40 per million input tokens and $1.60 per million output tokens:

| Example request | Tokens | Estimated cost |
| --- | --- | --- |
| Input | 500 | $0.00020 |
| Output | 200 | $0.00032 |
| **Total** | **700** | **$0.00052** |

This is an illustrative estimate, not a measured production cost. Actual costs depend on prompt size, model pricing, token usage, and retries. Database and infrastructure costs are excluded.

## Engineering Decisions

| Area | Implementation | Rationale |
| --- | --- | --- |
| Authentication | Supabase Auth | Restricts recruiter workflows to authenticated users |
| Tenant isolation | Company-scoped database access and RLS policies | Keeps Acme and Globex data separate |
| Search parsing | OpenAI structured extraction with deterministic mock mode | Supports natural-language input and reproducible local testing |
| Filter refinement | Editable, server-validated filters | Lets recruiters correct results without another LLM call |
| Retrieval | PostgreSQL filtering and ranking | Provides grounded, reproducible search results |
| Quota enforcement | Atomic PostgreSQL search creation | Prevents concurrent requests from bypassing free-tier limits |
| Pagination | Persisted ranked snapshots | Preserves result ordering and avoids additional quota consumption |
| Recruiter workflow | Saved briefs and shortlist management | Supports repeated searches and candidate organization |
| Billing | Signed Stripe webhook processing | Handles subscription state changes, duplicate events, and out-of-order delivery |

## API Overview

Authenticated recruiter endpoints use a Supabase bearer token.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/search` | Parse a hiring brief or apply validated edited filters and create a ranked search |
| `GET` | `/api/search/[id]` | Retrieve a saved search page |
| `GET` | `/api/people/[id]` | Retrieve a candidate profile |
| `GET / POST` | `/api/saved-briefs` | List and save hiring briefs |
| `GET / POST` | `/api/shortlists` | List and create shortlists |
| `GET / PATCH / DELETE` | `/api/shortlists/[id]` | Retrieve, rename, or delete a shortlist |
| `POST / DELETE` | `/api/shortlists/[id]/people/[personId]` | Add or remove a candidate |
| `GET` | `/api/plan` | Retrieve the current company's plan and quota |
| `POST` | `/api/billing/events` | Process signed Stripe webhook events |

### Search Requests

Natural-language search:

```json
{
  "brief": "Senior Python backend engineer with AWS experience"
}
```

The same endpoint also accepts a `filters` object for recruiter-edited searches. Submitted filters are validated server-side before retrieval.

Search responses include the search ID, filters, total matches, ranked candidates, and remaining search allowance.

## Validation

The implementation was tested locally across the main application and API workflows:

- **Build and type safety:** Production build and TypeScript validation completed during development.
- **Authentication:** Recruiter sign-in, sign-out, and unauthorized API requests.
- **Tenant isolation:** Separate Acme and Globex workspaces, with company isolation tested through API requests.
- **Search correctness:** Structured filters, database ranking, candidate retrieval, and deterministic fixture queries.
- **Editable filters:** Server-side validation of recruiter-submitted filters, including rejection of empty filter submissions.
- **Pagination:** Stable results across pages of 20 without consuming additional searches.
- **Quota enforcement:** Free-tier limit configured to exactly one search per company, with further attempts returning HTTP `402`.
- **Paid access:** Unlimited search behavior for the paid recruiter account.
- **Recruiter workflows:** Saving briefs, creating shortlists, renaming and deleting shortlists, and adding or removing candidates.
- **Webhook handling:** Signed Stripe events, duplicate delivery, and stale subscription events.

### OpenAI Integration and Testing

The application includes a real OpenAI integration using `gpt-4.1-mini`. The implementation supports an `OPENAI_API_KEY` environment variable and can switch between live model parsing and a deterministic mock parser using `MOCK_LLM`.

For local development and assessment testing, I used `MOCK_LLM=true` to avoid unnecessary API token costs and keep search behavior reproducible.

This allowed me to test the search workflow, including structured filter validation, PostgreSQL retrieval, ranking, pagination, and quota enforcement, without making paid model requests.

I also attempted a live OpenAI request, but it returned an API quota error. Therefore, the integration is implemented, but successful live-model execution remains unverified.

To enable live parsing, configure a valid `OPENAI_API_KEY` and set `MOCK_LLM=false` in `.env.local`.

API keys are kept in local environment configuration and should never be committed to GitHub.

The mock parser is intended for reproducible local evaluation, not as a substitute for validating model quality in production.

### Remaining Verification

The final production build should be rerun after the latest dashboard changes. A direct database-level RLS audit and a clean-machine setup test have not yet been completed.

## Tradeoffs and Future Work

The current retrieval system uses a constrained set of structured filters instead of unrestricted semantic search.

I chose this approach to prioritize predictable matching, auditable ranking, and clear separation between language interpretation and candidate retrieval. The tradeoff is that some natural-language requirements cannot yet be represented.

Editable filters help recruiters correct the parser's interpretation, but they are still limited to the supported filter vocabulary. Each revised search creates a new snapshot and consumes a search credit.

With another week, I would focus on:

1. **Automated end-to-end tests:** Cover authentication, search, quota enforcement, filter editing, and shortlist workflows in a browser.
2. **Parsing evaluation:** Measure filter extraction accuracy and unsupported-requirement detection across more varied hiring briefs.
3. **Search quality:** Expand the filter vocabulary and evaluate ranking relevance against labeled queries.
4. **Security verification:** Add automated tenant-isolation and RLS policy tests.
5. **Observability:** Add latency measurements, structured logs, token usage tracking, and search failure diagnostics.

## Demo

**Loom walkthrough:** Coming soon.

The walkthrough demonstrates recruiter authentication, natural-language search, editable filters, ranked results, shortlist creation and management, and free-versus-paid plan behavior.
