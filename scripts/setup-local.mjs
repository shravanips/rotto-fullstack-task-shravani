
import fs from "node:fs";
import { execFileSync } from "node:child_process";

function supabaseEnv() {
  const output = execFileSync(
    "npx",
    ["supabase", "status", "-o", "env"],
    { encoding: "utf8" }
  );

  const values = {};

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);

    if (!match) continue;

    const [, key, rawValue] = match;
    values[key] = rawValue.replace(/^"|"$/g, "");
  }

  return values;
}

const values = supabaseEnv();

const url = values.API_URL;
const publishableKey = values.PUBLISHABLE_KEY;
const secretKey = values.SECRET_KEY;

if (!url || !publishableKey || !secretKey) {
  throw new Error(
    "Could not find local Supabase URL or keys. Is Supabase running?"
  );
}

const envPath = ".env.local";

const existing = fs.existsSync(envPath)
  ? fs.readFileSync(envPath, "utf8")
  : "";

const envMap = new Map();

for (const line of existing.split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;

  const separator = line.indexOf("=");
  if (separator < 0) continue;

  const key = line.slice(0, separator);
  const value = line.slice(separator + 1);

  envMap.set(key, value);
}

// Always use keys from the currently running local Supabase instance.
envMap.set("NEXT_PUBLIC_SUPABASE_URL", url);
envMap.set("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", publishableKey);
envMap.set("SUPABASE_SECRET_KEY", secretKey);

// Local testing is free. A real model key can be added separately.
if (!envMap.has("MOCK_LLM")) {
  envMap.set("MOCK_LLM", "true");
}

if (!envMap.has("STRIPE_WEBHOOK_SECRET")) {
  envMap.set(
    "STRIPE_WEBHOOK_SECRET",
    "whsec_rotto_local_assessment_only"
  );
}

fs.writeFileSync(
  envPath,
  [...envMap]
    .map(([key, value]) => `${key}=${value}`)
    .join("\n") + "\n",
  { mode: 0o600 }
);

console.log("Local Supabase environment configured.");

const childEnv = {
  ...process.env,
  SUPABASE_URL: url,
  SUPABASE_SECRET_KEY: secretKey,
};

for (const script of [
  "scripts/seed-recruiters.mjs",
  "scripts/import-candidates.mjs",
]) {
  console.log(`Running ${script}...`);

  execFileSync("node", [script], {
    env: childEnv,
    stdio: "inherit",
  });
}

console.log("\nLocal setup completed successfully!");
