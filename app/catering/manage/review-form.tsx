"use client";
import { FormEvent, useEffect, useState } from "react";
import { Check, CreditCard, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import "./reviews.css";
import "./payments.css";
type Props = {
  opportunityId: string;
  proposalId: string;
  businessId: string;
  eventDate: string;
  opportunityStatus: string;
};
export default function ReviewForm({
  opportunityId,
  proposalId,
  businessId,
  eventDate,
  opportunityStatus,
}: Props) {
  const [rating, setRating] = useState(5),
    [existing, setExisting] = useState<number | null>(null),
    [quote, setQuote] = useState<number | null>(null),
    [payment, setPayment] = useState<string | null>(null),
    [agreementAccepted, setAgreementAccepted] = useState(false),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    async function load() {
      const [reviewResult, proposalResult, paymentResult, agreementResult] =
        await Promise.all([
          supabase
            .from("chef_reviews")
            .select("rating")
            .eq("proposal_id", proposalId)
            .maybeSingle(),
          supabase
            .from("catering_proposals")
            .select("quote_cents")
            .eq("id", proposalId)
            .single(),
          supabase
            .from("catering_payments")
            .select("status")
            .eq("proposal_id", proposalId)
            .maybeSingle(),
          supabase
            .from("catering_agreements")
            .select("status")
            .eq("proposal_id", proposalId)
            .order("revision", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
      if (reviewResult.data) setExisting(reviewResult.data.rating);
      setQuote(proposalResult.data?.quote_cents || null);
      setPayment(paymentResult.data?.status || null);
      setAgreementAccepted(agreementResult.data?.status === "accepted");
      setReady(true);
    }
    load();
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ proposalId: string }>).detail;
      if (detail?.proposalId === proposalId) load();
    };
    window.addEventListener("tagos-agreement-updated", refresh);
    return () => window.removeEventListener("tagos-agreement-updated", refresh);
  }, [proposalId]);
  async function pay() {
    setBusy(true);
    setError("");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError("Sign in again to continue.");
      setBusy(false);
      return;
    }
    const response = await fetch("/api/stripe/catering/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ proposalId }),
    });
    const result = await response.json() as any;
    if (!response.ok || !result.url) {
      setError(result.error || "Checkout is unavailable.");
      setBusy(false);
      return;
    }
    location.href = result.url;
  }
  if (!ready)
    return (
      <div className="review-after-event">
        Checking payment and review status…
      </div>
    );
  const amount =
    quote == null
      ? null
      : new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(quote / 100);
  const paymentPanel =
    payment === "succeeded" ? (
      <div className="payment-complete">
        <Check />
        Paid securely through TaGo&apos;s
      </div>
    ) : !agreementAccepted ? (
      <div className="review-after-event">
        Accept the final catering agreement before making payment.
      </div>
    ) : quote ? (
      <div className="catering-payment">
        <div>
          <b>Secure catering payment</b>
          <span>
            {amount} total · includes TaGo&apos;s marketplace processing
          </span>
        </div>
        <button type="button" disabled={busy} onClick={pay}>
          <CreditCard />
          {busy ? "Opening checkout…" : `Pay ${amount}`}
        </button>
      </div>
    ) : (
      <div className="review-after-event">
        This proposal did not include an online-payment amount.
      </div>
    );
  const eventPassed = new Date(`${eventDate}T23:59:59`) <= new Date();
  const lifecycle = (
    <div className="job-lifecycle">
      <b>Job progress</b>
      <ol>
        <li className="done">
          <Check />
          Chef selected
        </li>
        <li className={payment === "succeeded" ? "done" : "current"}>
          {payment === "succeeded" ? <Check /> : <CreditCard />}
          {payment === "succeeded" ? "Payment confirmed" : "Payment needed"}
        </li>
        <li className={eventPassed ? "done" : "current"}>
          {eventPassed ? <Check /> : <span>3</span>}
          {eventPassed ? "Event date reached" : "Event upcoming"}
        </li>
        <li className={opportunityStatus === "closed" ? "done" : ""}>
          {opportunityStatus === "closed" ? <Check /> : <span>4</span>}
          {opportunityStatus === "closed"
            ? "Job completed"
            : "Complete after event"}
        </li>
      </ol>
    </div>
  );
  if (!eventPassed)
    return (
      <>
        {lifecycle}
        {paymentPanel}
        <div className="review-after-event">
          A verified review can be submitted after the event.
        </div>
        {error && <small className="payment-error">{error}</small>}
      </>
    );
  if (existing)
    return (
      <>
        {lifecycle}
        {paymentPanel}
        <div className="review-complete">
          <Check />
          Verified review submitted · {existing}/5
        </div>
        {error && <small className="payment-error">{error}</small>}
      </>
    );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sign in again to submit your review.");
      setBusy(false);
      return;
    }
    const text = String(
      new FormData(e.currentTarget).get("review") || "",
    ).trim();
    const { error: saveError } = await supabase.from("chef_reviews").insert({
      opportunity_id: opportunityId,
      proposal_id: proposalId,
      business_id: businessId,
      customer_id: user.id,
      rating,
      review_text: text,
    });
    if (saveError) setError(saveError.message);
    else setExisting(rating);
    setBusy(false);
  }
  return (
    <>
      {lifecycle}
      {paymentPanel}
      <form className="verified-review-form" onSubmit={submit}>
        <b>Review this completed job</b>
        <span>Only verified TaGo&apos;s customers can publish a review.</span>
        <div className="rating-picker" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => setRating(n)}
              aria-label={`${n} star rating`}
            >
              <Star className={n <= rating ? "filled" : ""} />
            </button>
          ))}
        </div>
        <textarea
          name="review"
          required
          minLength={20}
          maxLength={2000}
          placeholder="Describe the food, service, communication, and reliability."
        />
        <button disabled={busy}>
          {busy ? "Publishing review…" : "Publish verified review"}
        </button>
        {error && <small>{error}</small>}
      </form>
    </>
  );
}
