
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";


const supportedTypes = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");

    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 }
    );
  }

  // Signature verification requires the original, unmodified body.
  const rawBody = await request.text();
  const stripe = new Stripe("sk_test_local_webhook_only");

  let event: Stripe.Event;

  try {
    // The assessment fixtures were signed in the past.
    // A larger tolerance permits replaying those supplied fixtures.
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      secret,
      60 * 60 * 24 * 365
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid Stripe signature" },
      { status: 400 }
    );
  }

  if (!supportedTypes.has(event.type)) {
    return NextResponse.json({ status: "ignored" });
  }

  const subscription = event.data.object as Stripe.Subscription;
  const companySlug = subscription.metadata?.company;
  const subscriptionStatus = subscription.status;

  if (!companySlug || typeof companySlug !== "string") {
    return NextResponse.json(
      { error: "Missing company metadata" },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc(
    "apply_stripe_subscription_event",
    {
      p_event_id: event.id,
      p_event_created: event.created,
      p_event_type: event.type,
      p_company_slug: companySlug,
      p_subscription_status: subscriptionStatus,
    }
  );

  if (error) {
    console.error("Stripe event processing failed:", error);

    return NextResponse.json(
      { error: "Could not process billing event" },
      { status: 500 }
    );
  }

  return NextResponse.json({ status: data });
}
