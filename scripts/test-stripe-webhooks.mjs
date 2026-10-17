
import fs from "node:fs";
import crypto from "node:crypto";

const fixture = JSON.parse(
  fs.readFileSync("data/stripe-events.json", "utf8")
);

const env = fs.readFileSync(".env.local", "utf8");
const secretLine = env
  .split(/\r?\n/)
  .filter((line) => line.startsWith("STRIPE_WEBHOOK_SECRET="))
  .at(-1);

if (!secretLine) {
  throw new Error("Missing STRIPE_WEBHOOK_SECRET in .env.local");
}

const secret = secretLine.slice("STRIPE_WEBHOOK_SECRET=".length);

for (const entry of fixture.events) {
  const timestamp = Math.floor(Date.now() / 1000);

  // Sign the original payload string, not a reserialized object.
  const signedContent = `${timestamp}.${entry.payload}`;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(signedContent, "utf8")
    .digest("hex");

  const response = await fetch(
    "http://localhost:3000/api/billing/events",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": `t=${timestamp},v1=${signature}`,
      },
      body: entry.payload,
    }
  );

  const result = await response.json();

  console.log(
    JSON.stringify({
      description: entry.description,
      http_status: response.status,
      result,
    })
  );

  if (!response.ok) {
    process.exitCode = 1;
    break;
  }
}

console.log(
  "\nExpected final plans:",
  JSON.stringify(fixture.expected_plans_after)
);
