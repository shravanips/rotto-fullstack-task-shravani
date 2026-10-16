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

const password = "rotto-assessment";

const recruiters = [
  { email: "recruiter@acme.test", slug: "acme" },
  { email: "recruiter@globex.test", slug: "globex" },
];

for (const recruiter of recruiters) {
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id")
    .eq("slug", recruiter.slug)
    .single();

  if (companyError || !company) {
    throw new Error(`Company not found: ${recruiter.slug}`);
  }
// Need to edit this part
  //const { data: created, error: authError } =
    //await supabase.auth.admin.createUser({
      // email: recruiter.email,
      // password,
      //email_confirm: true,
    //});
/// end of the edit

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  throw new Error("Missing Supabase credentials");
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
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id")
    .eq("slug", recruiter.slug)
    .single();

  if (companyError || !company) {
    throw new Error(`Company not found: ${recruiter.slug}`);
  }

  const { data: users, error: listError } =
    await supabase.auth.admin.listUsers();

  if (listError) throw listError;

  let user = users.users.find(
    (u) => u.email === recruiter.email
  );

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: recruiter.email,
      password: "rotto-assessment",
      email_confirm: true,
    });

    if (error) throw error;
    user = data.user;
  }

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

  if (profileError) throw profileError;

  console.log(`Ready: ${recruiter.email} (${recruiter.slug})`);
  }


  if (authError) {
    throw new Error(
      `Could not create ${recruiter.email}: ${authError.message}`
    );
  }

  const { error: profileError } = await supabase
    .from("recruiters")
    .insert({
      id: created.user.id,
      company_id: company.id,
      email: recruiter.email,
    });

  if (profileError) {
    throw new Error(
      `Could not link ${recruiter.email}: ${profileError.message}`
    );
  }

  console.log(`Created ${recruiter.email} for ${recruiter.slug}`);
}
