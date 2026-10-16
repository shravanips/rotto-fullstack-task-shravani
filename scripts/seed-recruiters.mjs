
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY");
}

const supabase = createClient(url, secret, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const recruiters = [
  { email: "recruiter@acme.test", slug: "acme" },
  { email: "recruiter@globex.test", slug: "globex" },
];

for (const recruiter of recruiters) {
  // Find the company
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id")
    .eq("slug", recruiter.slug)
    .single();

  if (companyError || !company) {
    throw new Error(`Company not found: ${recruiter.slug}`);
  }

  // Check whether the recruiter already exists
  const { data: users, error: listError } =
    await supabase.auth.admin.listUsers();

  if (listError) {
    throw listError;
  }

  let user = users.users.find(
    (u) => u.email === recruiter.email
  );

  // Create the recruiter if needed
  if (!user) {
    const { data, error } =
      await supabase.auth.admin.createUser({
        email: recruiter.email,
        password: "rotto-assessment",
        email_confirm: true,
      });

    if (error || !data.user) {
      throw new Error(
        `Could not create ${recruiter.email}: ${error?.message ?? "Unknown error"}`
      );
    }

    user = data.user;
  }

  // Link the recruiter to the correct company
  const { error: profileError } = await supabase
    .from("recruiters")
    .upsert(
      {
        id: user.id,
        company_id: company.id,
        email: recruiter.email,
      },
      { onConflict: "id" }
    );

  if (profileError) {
    throw new Error(
      `Could not link ${recruiter.email}: ${profileError.message}`
    );
  }

  console.log(
    `Ready: ${recruiter.email} (${recruiter.slug})`
  );
}
