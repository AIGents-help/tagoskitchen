import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/supabase-server";

type AgreementInput = {
  proposalId?: string;
  action?: "save_submit" | "accept" | "request_change";
  finalMenu?: string;
  serviceDetails?: string;
  eventTiming?: string;
  totalCents?: number;
  cancellationTerms?: string;
  changeNote?: string;
};

async function context(request: Request, proposalId: string) {
  const { admin, user } = await requireSupabaseUser(request);
  const { data: proposal, error } = await admin
    .from("catering_proposals")
    .select(
      "id,opportunity_id,business_id,status,quote_cents,catering_opportunities(customer_id)",
    )
    .eq("id", proposalId)
    .single();
  if (error || !proposal) throw new Error("Selected proposal not found.");
  if (proposal.status !== "accepted")
    throw new Error(
      "The chef must be selected before final terms can be approved.",
    );
  const opportunity = proposal.catering_opportunities as unknown as {
    customer_id: string;
  };
  const { data: membership } = await admin
    .from("business_members")
    .select("user_id")
    .eq("business_id", proposal.business_id)
    .eq("user_id", user.id)
    .maybeSingle();
  const isCustomer = opportunity.customer_id === user.id,
    isChef = !!membership;
  if (!isCustomer && !isChef)
    throw new Error("You are not authorized for this agreement.");
  return {
    admin,
    user,
    proposal,
    customerId: opportunity.customer_id,
    isCustomer,
    isChef,
  };
}

export async function GET(request: Request) {
  try {
    const proposalId = new URL(request.url).searchParams.get("proposalId");
    if (!proposalId)
      return NextResponse.json(
        { error: "Proposal is required." },
        { status: 400 },
      );
    const { admin } = await context(request, proposalId);
    const { data, error } = await admin
      .from("catering_agreements")
      .select(
        "id,revision,status,final_menu,service_details,event_timing,total_cents,cancellation_terms,customer_change_note,submitted_at,accepted_at",
      )
      .eq("proposal_id", proposalId)
      .order("revision", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ agreements: data || [] });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load agreement.",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as AgreementInput;
    if (!input.proposalId || !input.action)
      return NextResponse.json(
        { error: "Agreement action is required." },
        { status: 400 },
      );
    const { admin, proposal, customerId, isCustomer, isChef } = await context(
      request,
      input.proposalId,
    );
    const { data: rows, error: loadError } = await admin
      .from("catering_agreements")
      .select("*")
      .eq("proposal_id", proposal.id)
      .order("revision", { ascending: false });
    if (loadError) throw loadError;
    const latest = rows?.[0];
    if (input.action === "save_submit") {
      if (!isChef)
        return NextResponse.json(
          { error: "Only the selected chef can submit final terms." },
          { status: 403 },
        );
      const finalMenu = (input.finalMenu || "").trim(),
        serviceDetails = (input.serviceDetails || "").trim(),
        eventTiming = (input.eventTiming || "").trim(),
        cancellationTerms = (input.cancellationTerms || "").trim(),
        totalCents = Math.round(Number(input.totalCents));
      if (
        [finalMenu, serviceDetails, eventTiming, cancellationTerms].some(
          (value) => value.length < 5,
        ) ||
        !Number.isFinite(totalCents) ||
        totalCents <= 0
      )
        return NextResponse.json(
          { error: "Complete every agreement field and enter a valid total." },
          { status: 400 },
        );
      const { data: payment } = await admin
        .from("catering_payments")
        .select("status")
        .eq("proposal_id", proposal.id)
        .maybeSingle();
      if (
        payment?.status === "succeeded" &&
        totalCents !== proposal.quote_cents
      )
        return NextResponse.json(
          {
            error:
              "The price cannot change after payment. Use the existing paid total or contact TaGo's.",
          },
          { status: 409 },
        );
      const values = {
        final_menu: finalMenu,
        service_details: serviceDetails,
        event_timing: eventTiming,
        total_cents: totalCents,
        cancellation_terms: cancellationTerms,
        status: "pending_customer",
        customer_change_note: null,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (
        latest &&
        ["pending_customer", "changes_requested"].includes(latest.status)
      ) {
        const { error } = await admin
          .from("catering_agreements")
          .update(values)
          .eq("id", latest.id);
        if (error) throw error;
      } else {
        const { error } = await admin
          .from("catering_agreements")
          .insert({
            ...values,
            proposal_id: proposal.id,
            opportunity_id: proposal.opportunity_id,
            business_id: proposal.business_id,
            customer_id: customerId,
            revision: (latest?.revision || 0) + 1,
          });
        if (error) throw error;
      }
      return NextResponse.json({
        ok: true,
        message: "Final terms sent to the customer for approval.",
      });
    }
    if (!isCustomer)
      return NextResponse.json(
        { error: "Only the customer can approve or request changes." },
        { status: 403 },
      );
    if (!latest)
      return NextResponse.json(
        { error: "The chef has not submitted final terms yet." },
        { status: 409 },
      );
    if (input.action === "request_change") {
      const note = (input.changeNote || "").trim();
      if (note.length < 5)
        return NextResponse.json(
          { error: "Describe the change you need." },
          { status: 400 },
        );
      if (latest.status === "accepted") {
        const { error } = await admin
          .from("catering_agreements")
          .insert({
            proposal_id: proposal.id,
            opportunity_id: proposal.opportunity_id,
            business_id: proposal.business_id,
            customer_id: customerId,
            revision: latest.revision + 1,
            status: "changes_requested",
            final_menu: latest.final_menu,
            service_details: latest.service_details,
            event_timing: latest.event_timing,
            total_cents: latest.total_cents,
            cancellation_terms: latest.cancellation_terms,
            customer_change_note: note,
          });
        if (error) throw error;
      } else {
        const { error } = await admin
          .from("catering_agreements")
          .update({
            status: "changes_requested",
            customer_change_note: note,
            updated_at: new Date().toISOString(),
          })
          .eq("id", latest.id);
        if (error) throw error;
      }
      return NextResponse.json({
        ok: true,
        message: "Change request sent to the chef.",
      });
    }
    if (input.action === "accept") {
      if (latest.status !== "pending_customer")
        return NextResponse.json(
          { error: "These terms are not awaiting approval." },
          { status: 409 },
        );
      await admin
        .from("catering_agreements")
        .update({ status: "superseded", updated_at: new Date().toISOString() })
        .eq("proposal_id", proposal.id)
        .eq("status", "accepted");
      const { error } = await admin
        .from("catering_agreements")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", latest.id);
      if (error) throw error;
      const { error: proposalError } = await admin
        .from("catering_proposals")
        .update({
          quote_cents: latest.total_cents,
          updated_at: new Date().toISOString(),
        })
        .eq("id", proposal.id);
      if (proposalError) throw proposalError;
      return NextResponse.json({
        ok: true,
        message: "Final terms accepted. Secure payment is now available.",
      });
    }
    return NextResponse.json(
      { error: "Unsupported agreement action." },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update agreement.",
      },
      { status: 400 },
    );
  }
}
