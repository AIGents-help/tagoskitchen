"use client";
import { useEffect, useState } from "react";
import { BriefcaseBusiness, Check, Clock3, Mail, Phone, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import PublicHeader from "../../public-header";
import ReviewForm from "./review-form";
import AgreementPanel from "../agreement-panel";
import "../../public-marketplace.css";
import "./manage.css";
import "./customer-link.css";
type Job = {
  id: string;
  event_type: string;
  event_date: string;
  approximate_time: string | null;
  general_location: string;
  guest_count: number | null;
  budget_range: string | null;
  cuisine_preferences: string | null;
  service_requirements: string | null;
  status: string;
};
type Bid = {
  id: string;
  opportunity_id: string;
  business_id: string;
  message: string;
  menu_details: string | null;
  quote_cents: number | null;
  status: string;
  created_at: string;
  businesses: { name: string } | null;
};
type PublicProfile = {
  business_id: string;
  business_name: string;
  contact_email: string | null;
  contact_phone: string | null;
};
const money = (c: number | null) =>
  c == null
    ? "Quote not supplied"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(c / 100);
export default function ManageCatering() {
  const [state, setState] = useState("loading"),
    [jobs, setJobs] = useState<Job[]>([]),
    [bids, setBids] = useState<Bid[]>([]),
    [profiles, setProfiles] = useState<PublicProfile[]>([]),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const load = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setState("signed_out");
      return;
    }
    const [j, p, pr] = await Promise.all([
      supabase
        .from("catering_opportunities")
        .select(
          "id,event_type,event_date,approximate_time,general_location,guest_count,budget_range,cuisine_preferences,service_requirements,status",
        )
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("catering_proposals")
        .select(
          "id,opportunity_id,business_id,message,menu_details,quote_cents,status,created_at,businesses(name)",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("business_public_profiles")
        .select("business_id,business_name,contact_email,contact_phone")
        .eq("is_published", true),
    ]);
    if (j.error || p.error || pr.error)
      setNotice(
        j.error?.message ||
          p.error?.message ||
          pr.error?.message ||
          "Unable to load requests.",
      );
    setJobs((j.data || []) as Job[]);
    setBids((p.data || []) as unknown as Bid[]);
    setProfiles((pr.data || []) as PublicProfile[]);
    setState("ready");
  };
  useEffect(() => {
    load();
  }, []);
  async function choose(id: string) {
    setBusy(true);
    const { error } = await supabase.rpc("select_catering_proposal", {
      p_proposal_id: id,
    });
    setNotice(
      error
        ? error.message
        : "Chef selected. Their public contact information is ready so you can finalize the job.",
    );
    if (!error) await load();
    setBusy(false);
  }
  async function update(id: string, status: "closed" | "cancelled") {
    setBusy(true);
    const { error } = await supabase
      .from("catering_opportunities")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    setNotice(
      error
        ? error.message
        : status === "closed"
          ? "Opportunity closed."
          : "Opportunity cancelled.",
    );
    if (!error) await load();
    setBusy(false);
  }
  if (state === "loading")
    return (
      <Shell>
        <Empty text="Loading your requests…" />
      </Shell>
    );
  if (state === "signed_out")
    return (
      <Shell>
        <div className="public-empty">
          <h2>Sign in to manage your catering requests.</h2>
          <a href="/account?mode=signin&returnTo=/catering/manage">Sign in</a>
        </div>
      </Shell>
    );
  return (
    <Shell>
      <p className="public-kicker">REQUESTER DASHBOARD</p>
      <div className="manager-title">
        <div>
          <h1 className="public-title">My catering opportunities</h1>
          <p className="public-lead">
            Compare menus and quotes, select a chef, or close a request.
          </p>
        </div>
        <a href="/catering">Post another request</a>
      </div>
      {notice && <div className="form-note">{notice}</div>}
      {jobs.length ? (
        <div className="opportunity-list">
          {jobs.map((job) => {
            const proposals = bids.filter((b) => b.opportunity_id === job.id);
            return (
              <article className="opportunity" key={job.id}>
                <header>
                  <div>
                    <span className={`request-status ${job.status}`}>
                      {job.status}
                    </span>
                    <h2>{job.event_type}</h2>
                    <p>
                      <Clock3 />
                      {new Date(
                        `${job.event_date}T12:00:00`,
                      ).toLocaleDateString()}{" "}
                      {job.approximate_time && `• ${job.approximate_time}`} •{" "}
                      {job.general_location}
                    </p>
                  </div>
                  <b>
                    {proposals.length} proposal
                    {proposals.length === 1 ? "" : "s"}
                  </b>
                </header>
                <details>
                  <summary>
                    <BriefcaseBusiness />
                    View request details
                  </summary>
                  <div className="request-detail-grid">
                    <span>
                      <b>Guests</b>
                      {job.guest_count || "Not supplied"}
                    </span>
                    <span>
                      <b>Budget</b>
                      {job.budget_range || "Not supplied"}
                    </span>
                    <span>
                      <b>Menu needs</b>
                      {job.cuisine_preferences || "Not supplied"}
                    </span>
                    <span>
                      <b>Service</b>
                      {job.service_requirements || "Not supplied"}
                    </span>
                  </div>
                </details>
                <section className="proposal-list">
                  {proposals.length ? (
                    proposals.map((bid) => (
                      <article
                        key={bid.id}
                        className={
                          bid.status === "accepted" ? "selected-proposal" : ""
                        }
                      >
                        <div className="proposal-head">
                          <div>
                            <h3>
                              {bid.businesses?.name || "Approved TaGo's chef"}
                            </h3>
                            <span>
                              {new Date(bid.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <strong>{money(bid.quote_cents)}</strong>
                        </div>
                        <p>{bid.message}</p>
                        {bid.menu_details && (
                          <div className="menu-proposal">
                            <b>Proposed menu or service</b>
                            <span>{bid.menu_details}</span>
                          </div>
                        )}
                        {bid.status === "accepted" ? (
                          <>
                            <em>
                              <Check />
                              Selected chef
                            </em>
                            <MatchContact
                              profile={profiles.find(
                                (p) => p.business_id === bid.business_id,
                              )}
                              businessName={bid.businesses?.name}
                            />
                            <AgreementPanel
                              proposalId={bid.id}
                              role="customer"
                              quoteCents={bid.quote_cents}
                            />
                            <ReviewForm
                              opportunityId={job.id}
                              proposalId={bid.id}
                              businessId={bid.business_id}
                              eventDate={job.event_date}
                              opportunityStatus={job.status}
                            />
                          </>
                        ) : (
                          job.status === "open" && (
                            <button
                              disabled={busy}
                              onClick={() => choose(bid.id)}
                            >
                              Select this chef
                            </button>
                          )
                        )}
                      </article>
                    ))
                  ) : (
                    <div className="no-proposals">
                      Approved chefs can see this request. New proposals will
                      appear here.
                    </div>
                  )}
                </section>
                {["open", "matched"].includes(job.status) && (
                  <footer>
                    {job.status === "open" && (
                      <button
                        disabled={busy}
                        onClick={() => update(job.id, "cancelled")}
                      >
                        <X />
                        Cancel request
                      </button>
                    )}
                    {job.status === "open" && (
                      <button
                        disabled={busy}
                        onClick={() => update(job.id, "closed")}
                      >
                        <Check />
                        Close opportunity
                      </button>
                    )}
                    {job.status === "matched" &&
                      new Date(`${job.event_date}T23:59:59`) <= new Date() && (
                        <button
                          className="complete-job"
                          disabled={busy}
                          onClick={() => update(job.id, "closed")}
                        >
                          <Check />
                          Mark job completed
                        </button>
                      )}
                  </footer>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="public-empty">
          <h2>No catering requests yet.</h2>
          <p>
            Post an opportunity and invite approved chefs to submit menus and
            quotes.
          </p>
          <a href="/catering">Post a catering opportunity</a>
        </div>
      )}
    </Shell>
  );
}
function MatchContact({
  profile,
  businessName,
}: {
  profile: PublicProfile | undefined;
  businessName: string | undefined;
}) {
  if (!profile)
    return (
      <div className="match-handoff">
        <b>{businessName || "Your selected chef"}</b>
        <span>
          This chef has not published direct contact information yet. Their
          accepted proposal remains saved here.
        </span>
      </div>
    );
  return (
    <div className="match-handoff">
      <b>Contact {profile.business_name}</b>
      <span>
        Confirm the final menu, timing, service details, and payment terms
        directly.
      </span>
      <div>
        {profile.contact_email && (
          <a href={`mailto:${profile.contact_email}`}>
            <Mail />
            {profile.contact_email}
          </a>
        )}
        {profile.contact_phone && (
          <a href={`tel:${profile.contact_phone}`}>
            <Phone />
            {profile.contact_phone}
          </a>
        )}
      </div>
    </div>
  );
}
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="public-page catering-manager">
      <PublicHeader />
      <section className="public-main">
        <a className="customer-home-link" href="/customer">
          ← Customer workspace
        </a>
        {children}
      </section>
    </main>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="public-empty">
      <h2>{text}</h2>
    </div>
  );
}
