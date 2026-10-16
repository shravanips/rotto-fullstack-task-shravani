
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secret) {
    throw new Error("Missing Supabase server configuration");
  }

  return createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function authenticateRecruiter(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return null;
  }

  const supabase = getSupabaseAdmin();

  // Verify the token with Supabase Auth.
  const { data: authData, error: authError } =
    await supabase.auth.getUser(token);

  if (authError || !authData.user) {
    return null;
  }

  // Find the recruiter's company.
  const { data: recruiter, error: recruiterError } =
    await supabase
      .from("recruiters")
      .select("id, company_id, email")
      .eq("id", authData.user.id)
      .single();

  if (recruiterError || !recruiter) {
    return null;
  }

  return {
    supabase,
    userId: authData.user.id,
    companyId: recruiter.company_id as string,
    email: recruiter.email as string,
  };
}
