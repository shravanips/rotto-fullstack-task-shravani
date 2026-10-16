import fs from "node:fs";
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

const candidates = JSON.parse(
  fs.readFileSync("data/candidates.json", "utf8")
);

if (!Array.isArray(candidates)) {
  throw new Error("Expected candidates.json to contain an array");
}

console.log(`Found ${candidates.length} candidates`);

const batchSize = 200;

for (let i = 0; i < candidates.length; i += batchSize) {
  const batch = candidates.slice(i, i + batchSize);

  const { error } = await supabase
    .from("candidates")
    .upsert(batch, { onConflict: "id" });

  if (error) {
    throw new Error(
      `Batch ${i / batchSize + 1} failed: ${error.message}`
    );
  }

  console.log(
    `Imported ${Math.min(i + batchSize, candidates.length)}/${candidates.length}`
  );
}

console.log("Candidate import completed successfully!");
