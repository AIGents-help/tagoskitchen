import { NextResponse } from "next/server";
import { getStripe, paymentProcessingReady, siteOrigin } from "@/lib/stripe-server";
import { requireSupabaseUser } from "@/lib/supabase-server";

export async function POST(request: Request) {
  if (!paymentProcessingReady())
    return NextResponse.json(
      { error: "Online payments are temporarily unavailable. Please contact TaGo's before paying." },
      { status: 503 },
    );
  try {
    const { proposalId } = (await request.json()) as { proposalId?: string };
    if (!proposalId)
      return NextResponse.json(
        { error: "A selected proposal is required." },
        { status: 400 },
      );
    const { admin, user } = await requireSupabaseUser(request);
    const { data: proposal, error: proposalError } = await admin
      .from("catering_proposals")
      .select("id,opportunity_id,business_id,status,quote_cents")
      .eq("id", proposalId)
      .single();
    if (proposalError) throw proposalError;
    if (proposal.status !== "accepted" || !proposal.quote_cents)
      return NextResponse.json(
        { error: "This proposal is not ready for payment." },
        { status: 409 },
      );
    const { data: opportunity, error: opportunityError } = await admin
      .from("catering_opportunities")
      .select("id,customer_id,event_type,status")
      .eq("id", proposal.opportunity_id)
      .single();
    if (opportunityError) throw opportunityError;
    if (opportunity.customer_id !== user.id)
      return NextResponse.json(
        { error: "This catering request does not belong to you." },
        { status: 403 },
      );
    if (opportunity.status !== "matched")
      return NextResponse.json(
        { error: "Only matched opportunities can be paid." },
        { status: 409 },
      );
    const { data: agreement, error: agreementError } = await admin
      .from("catering_agreements")
      .select("status,total_cents")
      .eq("proposal_id", proposal.id)
      .order("revision", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (agreementError) throw agreementError;
    if (!agreement || agreement.status !== "accepted")
      return NextResponse.json(
        {
          error:
            "The final catering agreement must be accepted before payment.",
        },
        { status: 409 },
      );
    if (agreement.total_cents !== proposal.quote_cents)
      return NextResponse.json(
        {
          error:
            "The accepted agreement total does not match this proposal. Refresh and try again.",
        },
        { status: 409 },
      );
    const { data: business, error: businessError } = await admin
      .from("businesses")
      .select("name,stripe_account_id,payouts_enabled")
      .eq("id", proposal.business_id)
      .single();
    if (businessError) throw businessError;
    if (!business.stripe_account_id || !business.payouts_enabled)
      return NextResponse.json(
        { error: "The selected chef is still completing Stripe payout setup." },
        { status: 409 },
      );
    const { data: prior } = await admin
      .from("catering_payments")
      .select("status")
      .eq("proposal_id", proposal.id)
      .maybeSingle();
    if (prior?.status === "succeeded")
      return NextResponse.json(
        { error: "This catering job is already paid." },
        { status: 409 },
      );
    const amount = proposal.quote_cents,
      fee = Math.round(amount * 0.1),
      origin = siteOrigin(request),
      stripe = getStripe();
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: user.email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: amount,
              product_data: {
                name: opportunity.event_type,
                description: `Catering by ${business.name} through TaGo's`,
              },
            },
          },
        ],
        payment_intent_data: {
          application_fee_amount: fee,
          transfer_data: { destination: business.stripe_account_id },
        },
        success_url: `${origin}/catering/manage?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/catering/manage?payment=cancelled`,
        metadata: {
          tagos_payment_type: "catering",
          tagos_opportunity_id: opportunity.id,
          tagos_proposal_id: proposal.id,
          tagos_business_id: proposal.business_id,
          tagos_customer_id: user.id,
          tagos_platform_fee_cents: String(fee),
        },
      },
      { idempotencyKey: `tagos-catering-${proposal.id}-${amount}` },
    );
    const { error: saveError } = await admin
      .from("catering_payments")
      .upsert(
        {
          opportunity_id: opportunity.id,
          proposal_id: proposal.id,
          business_id: proposal.business_id,
          customer_id: user.id,
          amount_cents: amount,
          platform_fee_cents: fee,
          provider_net_cents: amount - fee,
          status: "pending",
          stripe_checkout_session_id: session.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "proposal_id" },
      );
    if (saveError) throw saveError;
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start catering checkout.",
      },
      { status: 400 },
    );
  }
}
