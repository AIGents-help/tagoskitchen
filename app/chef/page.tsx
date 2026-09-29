"use client";
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */
import { FormEvent, useEffect, useState } from "react";
import {
  AlertCircle,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChefHat,
  Clock3,
  CreditCard,
  ExternalLink,
  Home,
  LogOut,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  Store,
  Truck,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isChefBusiness } from "@/lib/workspace-business";
import Breadcrumbs from "../breadcrumbs";
import BookingChanges from "./booking-changes";
import BillingCenter from "./billing-center";
import PayoutSetup from "./payout-setup";
import AgreementPanel from "../catering/agreement-panel";
import NotificationCenter from "../notification-center";
import "./workspace.css";
import "./jobs.css";
import "../booking-changes.css";
import "../billing.css";

type Business = {
  id: string;
  name: string;
  compliance_status: string;
  schedule_identity_visibility: string;
};
type Kitchen = {
  id: string;
  name: string;
  address_line1: string;
  city: string;
  region: string;
};
type Booking = {
  id: string;
  kitchen_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  subtotal_cents: number;
  platform_fee_cents: number;
  host_payout_cents: number;
  notes: string | null;
};
type Promotion = {
  id: string;
  title: string;
  location_type: string;
  public_location: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
};
type Incident = {
  id: string;
  booking_id: string | null;
  incident_type: string;
  description: string;
  status: string;
  created_at: string;
  resolution_notes: string | null;
};
type Opportunity = {
  id: string;
  event_type: string;
  event_date: string;
  approximate_time: string | null;
  general_location: string;
  guest_count: number | null;
  budget_range: string | null;
  cuisine_preferences: string | null;
  service_requirements: string | null;
  additional_details: string | null;
  status: string;
};
type Proposal = {
  id: string;
  opportunity_id: string;
  status: string;
  quote_cents: number | null;
  catering_opportunities: {
    event_type: string;
    event_date: string;
    general_location: string;
  }[];
};
type CateringPayment = { proposal_id: string; status: string };
type AdminResource = { id: string; kitchen_id: string; name: string; hourly_rate_cents: number; active: boolean };
type AssignedTime = { id: string; kitchen_id: string; equipment_resource_id: string | null; starts_at: string; ends_at: string; title: string };
const money = (c: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    c / 100,
  );
const localInput = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

export default function ChefWorkspace() {
  const [auth, setAuth] = useState<"loading" | "signed_out" | "ready">(
      "loading",
    ),
    [userId, setUserId] = useState(""),
    [business, setBusiness] = useState<Business | null>(null),
    [kitchens, setKitchens] = useState<Kitchen[]>([]),
    [bookings, setBookings] = useState<Booking[]>([]),
    [promotions, setPromotions] = useState<Promotion[]>([]),
    [incidents, setIncidents] = useState<Incident[]>([]),
    [opportunities, setOpportunities] = useState<Opportunity[]>([]),
    [proposals, setProposals] = useState<Proposal[]>([]),
    [cateringPayments, setCateringPayments] = useState<CateringPayment[]>([]),
    [adminResources, setAdminResources] = useState<AdminResource[]>([]),
    [assignedTimes, setAssignedTimes] = useState<AssignedTime[]>([]),
    [selectedJob, setSelectedJob] = useState<string | null>(null),
    [notice, setNotice] = useState(""),
    [adminMode, setAdminMode] = useState(false),
    [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    setNotice("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setAuth("signed_out");
      setBusy(false);
      return;
    }
    setUserId(user.id);
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("business");
    const wantsAdmin = params.get("admin") === "1" && Boolean(requested);
    const { data: staff } = await supabase
      .from("platform_staff")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const canAdmin = wantsAdmin && Boolean(staff);
    setAdminMode(canAdmin);
    await supabase.rpc("claim_sponsored_chef_profile");
    const { data: workspaceRows, error: workspaceError } =
      await supabase.rpc("get_my_workspaces");
    const owned = ((workspaceRows || []) as (Business & {
      member_role: string;
      business_type: string;
    })[]).filter((item) => item.member_role === "owner");
    let selected =
      (owned || []).find(
        (item) =>
          item.id === requested &&
          isChefBusiness(item),
      ) ||
      (owned || []).find(isChefBusiness);
    if (canAdmin && requested) {
      const { data: selectedByAdmin, error: selectedByAdminError } = await supabase
        .from("businesses")
        .select("id,name,compliance_status,schedule_identity_visibility,business_type")
        .eq("id", requested)
        .maybeSingle();
      if (selectedByAdminError) setNotice(selectedByAdminError.message);
      if (selectedByAdmin && isChefBusiness(selectedByAdmin)) selected = selectedByAdmin as typeof selected;
    }
    if (!selected) {
      setBusiness(null);
      setAuth("ready");
      setBusy(false);
      return;
    }
    const businessId = selected.id;
    const [k, books, promos, issues, jobs, bids, cateringPay] =
      await Promise.all([
        supabase.from("kitchens").select("id,name,address_line1,city,region"),
        supabase
          .from("bookings")
          .select(
            "id,kitchen_id,starts_at,ends_at,status,subtotal_cents,platform_fee_cents,host_payout_cents,notes",
          )
          .eq("renter_business_id", businessId)
          .order("starts_at", { ascending: false }),
        supabase
          .from("promotions")
          .select(
            "id,title,location_type,public_location,starts_at,ends_at,status",
          )
          .eq("business_id", businessId)
          .order("starts_at", { ascending: false }),
        supabase
          .from("incident_reports")
          .select(
            "id,booking_id,incident_type,description,status,created_at,resolution_notes",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("catering_opportunities")
          .select(
            "id,event_type,event_date,approximate_time,general_location,guest_count,budget_range,cuisine_preferences,service_requirements,additional_details,status",
          )
          .eq("status", "open")
          .gte("event_date", new Date().toISOString().slice(0, 10))
          .order("event_date"),
        supabase
          .from("catering_proposals")
          .select(
            "id,opportunity_id,status,quote_cents,catering_opportunities(event_type,event_date,general_location)",
          )
          .eq("business_id", businessId),
        supabase
          .from("catering_payments")
          .select("proposal_id,status")
          .eq("business_id", businessId),
      ]);
    setBusiness(selected as Business);
    setKitchens((k.data || []) as Kitchen[]);
    setBookings((books.data || []) as Booking[]);
    setPromotions((promos.data || []) as Promotion[]);
    setIncidents((issues.data || []) as Incident[]);
    setOpportunities((jobs.data || []) as Opportunity[]);
    setProposals((bids.data || []) as Proposal[]);
    setCateringPayments((cateringPay.data || []) as CateringPayment[]);
    if (canAdmin) {
      const {data:approvedRelationships}=await supabase.from("kitchen_chef_relationships").select("kitchen_id").eq("chef_business_id",businessId).eq("access_status","active");
      const approvedKitchenIds=(approvedRelationships||[]).map(row=>row.kitchen_id);
      const [resourceRows, blockRows, assignmentRows] = await Promise.all([
        approvedKitchenIds.length?supabase.from("equipment_resources").select("id,kitchen_id,name,hourly_rate_cents,active").eq("active",true).in("kitchen_id",approvedKitchenIds).order("name"):Promise.resolve({data:[]}),
        supabase.from("availability_blocks").select("id,kitchen_id,equipment_resource_id,starts_at,ends_at,title").eq("assigned_business_id",businessId).order("starts_at"),
        supabase.from("chef_assignments").select("id,kitchen_id,equipment_resource_id,starts_at,ends_at").eq("business_id",businessId).order("starts_at"),
      ]);
      setAdminResources((resourceRows.data || []) as AdminResource[]);
      setAssignedTimes([
        ...((blockRows.data || []) as AssignedTime[]),
        ...((assignmentRows.data || []) as Omit<AssignedTime,"title">[]).map((row)=>({...row,title:"Chef assignment"})),
      ].sort((a,b)=>a.starts_at.localeCompare(b.starts_at)));
    } else { setAdminResources([]); setAssignedTimes([]); }
    const err =
      workspaceError ||
      [k, books, promos, issues, jobs, bids, cateringPay].find((x) => x.error)
        ?.error;
    if (err) setNotice(err.message);
    setAuth("ready");
    setBusy(false);
  };
  const applyForJob = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!business || !userId || !selectedJob) return;
    setBusy(true);
    setNotice("");
    const form = e.currentTarget,
      f = new FormData(form),
      quote = String(f.get("quote") || "").trim();
    const { error } = await supabase.from("catering_proposals").insert({
      opportunity_id: selectedJob,
      business_id: business.id,
      submitted_by: userId,
      message: String(f.get("message") || ""),
      menu_details: String(f.get("menu_details") || "") || null,
      quote_cents: quote ? Math.round(Number(quote) * 100) : null,
      status: "submitted",
    });
    if (error) setNotice(error.message);
    else {
      form.reset();
      setSelectedJob(null);
      await load();
      setNotice(
        "Proposal submitted. You can track its status in My applications.",
      );
    }
    setBusy(false);
  };
  useEffect(() => {
    load();
    const { data } = supabase.auth.onAuthStateChange(() => setTimeout(load, 0));
    return () => data.subscription.unsubscribe();
  }, []);
  const createPromotion = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!business || !userId) return;
    setBusy(true);
    setNotice("");
    const v = Object.fromEntries(new FormData(e.currentTarget).entries());
    const { error } = await supabase.from("promotions").insert({
      business_id: business.id,
      kitchen_id: v.kitchen_id || null,
      title: v.title,
      description: v.description || null,
      location_type: v.location_type,
      public_location: v.public_location || null,
      starts_at: new Date(String(v.starts_at)).toISOString(),
      ends_at: new Date(String(v.ends_at)).toISOString(),
      status: "draft",
      created_by: userId,
    });
    if (error) setNotice(error.message);
    else {
      e.currentTarget.reset();
      await load();
      setNotice("Promotion submitted as a draft for TaGo's review.");
    }
    setBusy(false);
  };
  const submitAdminBooking = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!business || !adminMode) return;
    setBusy(true); setNotice("");
    const form=e.currentTarget, v=Object.fromEntries(new FormData(form).entries());
    const { error }=await supabase.rpc("admin_create_booking_request",{
      p_business_id:business.id,p_resource_id:String(v.resource_id),
      p_starts_at:new Date(String(v.starts_at)).toISOString(),p_ends_at:new Date(String(v.ends_at)).toISOString(),p_notes:String(v.notes||"")||null,
    });
    if(error)setNotice(error.message);else{form.reset();await load();setNotice(`Kitchen-time request submitted for ${business.name}.`)}
    setBusy(false);
  };
  const kname = (id: string) =>
    kitchens.find((k) => k.id === id)?.name || "Kitchen";
  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.replace("/");
  };
  const upcoming = bookings.filter(
    (b) =>
      new Date(b.ends_at) > new Date() &&
      !["cancelled", "refunded"].includes(b.status),
  );
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  if (auth === "loading") return <State title="Loading your workspace…" />;
  if (auth === "signed_out")
    return (
      <State
        title="Chef login required"
        copy="Sign in to view your private bookings and events."
        login
      />
    );
  if (!business)
    return (
      <State
        title={new URLSearchParams(window.location.search).get("admin") === "1" ? "Chef Workspace" : "Finish your Kitchen Passport"}
        copy={new URLSearchParams(window.location.search).get("admin") === "1" ? "Admin access is active. Select an actual chef or food business from Platform Admin before viewing or changing its workspace." : "Create your business profile before opening the chef workspace."}
        profile={new URLSearchParams(window.location.search).get("admin") !== "1"}
        href={new URLSearchParams(window.location.search).get("admin") === "1" ? "/admin" : undefined}
        action={new URLSearchParams(window.location.search).get("admin") === "1" ? "Open Platform Admin" : undefined}
      />
    );
  return (
    <main className="chef-workspace">
      {adminMode && <div className="workspace-admin-banner"><ShieldCheck/><span><b>Platform Admin acting as {business.name}</b>You can review and modify this Chef Workspace. Every change is made under your administrator login.</span><a href="/admin">Return to Platform Admin</a></div>}
      <header>
        <a href="/">
          <img src="/tagos-kitchen-logo.png" alt="TaGo's Kitchen" />
        </a>
        <nav>
          <a href="/">
            <Home />
            Home
          </a>
          <a href={`/account?business=${business.id}&manage=1`}>
            <ShieldCheck />
            Passport
          </a>
          <a href={`/chef/public-profile?business=${business.id}`}>
            <UtensilsCrossed />
            Menu &amp; profile
          </a>
          <a href="#kitchen-requests">
            <CalendarDays />
            Kitchen requests
          </a>
          <a href={`/chef/trucks?business=${business.id}`}>
            <Truck />
            Food trucks
          </a>
          <a href="#jobs">
            <BriefcaseBusiness />
            Jobs
          </a>
          <button onClick={signOut}>
            <LogOut />
            Sign out
          </button>
        </nav>
      </header>
      <Breadcrumbs items={[{label:"Account",href:"/account"},{label:"Chef Workspace",href:`/chef?business=${business.id}`}, business.name]} />
      <section className="chef-hero">
        <div>
          <p>CHEF WORKSPACE</p>
          <h1>{business.name}</h1>
          <span>
            Bookings, access, promotions and operating history in one place.
          </span>
        </div>
        <div className={`chef-status ${business.compliance_status}`}>
          <b>{business.compliance_status}</b>
          <span>
            {business.compliance_status === "approved"
              ? "Private schedule and booking access enabled"
              : "Complete approval before requesting kitchen time"}
          </span>
        </div>
      </section>
      <NotificationCenter />
      {notice && (
        <div className="chef-notice" role="status">
          <AlertCircle />
          <span>{notice}</span>
          <button
            type="button"
            className="chef-notice-close"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X />
          </button>
        </div>
      )}
      <section className="chef-metrics">
        <Metric label="Upcoming bookings" value={String(upcoming.length)} />
        <Metric label="Confirmed sessions" value={String(confirmed.length)} />
        <Metric
          label="Booking total"
          value={money(bookings.reduce((s, b) => s + b.subtotal_cents, 0))}
        />
        <Metric label="Open jobs" value={String(opportunities.length)} />
      </section>
      <section className="chef-toolbelt" aria-label="Chef tools">
        <a href={`/account?business=${business.id}&manage=1`}>
          <ShieldCheck />
          <span>
            <b>Kitchen Passport</b>
            <small>Edit profile, credentials and privacy</small>
          </span>
        </a>
        <a href={`/chef/public-profile?business=${business.id}`}>
          <UtensilsCrossed />
          <span>
            <b>Menu &amp; public profile</b>
            <small>Manage what customers can see</small>
          </span>
        </a>
        <a href="#kitchen-requests">
          <CalendarDays />
          <span>
            <b>Kitchen requests</b>
            <small>Request time and track approvals</small>
          </span>
        </a>
        <a href="#jobs">
          <BriefcaseBusiness />
          <span>
            <b>Jobs board</b>
            <small>Review and bid on opportunities</small>
          </span>
        </a>
        <a href="#promotions">
          <Megaphone />
          <span>
            <b>Promotions</b>
            <small>Create Pop Up Pick Up events</small>
          </span>
        </a>
        <a href="#payments">
          <CreditCard />
          <span>
            <b>Payments</b>
            <small>Charges, receipts and billing</small>
          </span>
        </a>
      </section>
      <section className="chef-grid" id="kitchen-requests">
        <Panel title="My reservations" icon={CalendarDays}>
          {(bookings.length || assignedTimes.length) ? (
            <div className="chef-list">
              {assignedTimes.map((slot)=><article key={`assigned-${slot.id}`}><div><b>{kname(slot.kitchen_id)}</b><span>{new Date(slot.starts_at).toLocaleString()} – {new Date(slot.ends_at).toLocaleTimeString()}</span><small>{slot.title} • {adminResources.find(r=>r.id===slot.equipment_resource_id)?.name||"Shared / whole-kitchen time"}</small></div><em>assigned</em></article>)}
              {bookings.map((b) => (
                <article key={b.id}>
                  <div>
                    <b>{kname(b.kitchen_id)}</b>
                    <span>
                      {new Date(b.starts_at).toLocaleString()} –{" "}
                      {new Date(b.ends_at).toLocaleTimeString()}
                    </span>
                    <small>
                      {money(b.subtotal_cents)} •{" "}
                      {b.status.replaceAll("_", " ")}
                    </small>
                  </div>
                  {b.status === "confirmed" && (
                    <a href={`/?booking=${b.id}#access`}>
                      <Clock3 />
                      Check in / out
                    </a>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <Empty
              text="No booking requests yet."
              action="Open Inner Schedule"
              href="/?view=schedule"
            />
          )}
        </Panel>
        <Panel title="Approval & access" icon={ShieldCheck}>
          <div className="access-summary">
            <b>
              {business.compliance_status === "approved"
                ? "You are approved to book"
                : "Your schedule is locked"}
            </b>
            <p>
              {business.compliance_status === "approved"
                ? "Use the private Inner Schedule to see equipment availability and request time. Your brand visibility preference is respected for other approved chefs."
                : "Finish required documents in your Kitchen Passport and submit them for review."}
            </p>
            <a
              href={
                business.compliance_status === "approved"
                  ? "/?view=schedule"
                  : "/account"
              }
            >
              {business.compliance_status === "approved"
                ? "Open Inner Schedule"
                : "Open Kitchen Passport"}
              <ExternalLink />
            </a>
          </div>
          <div className="visibility-row">
            <span>Inner Schedule identity</span>
            <b>
              {business.schedule_identity_visibility === "visible"
                ? "Brand visible"
                : "Shown as Reserved"}
            </b>
          </div>
          {adminMode&&<form className="admin-chef-booking" onSubmit={submitAdminBooking}><p>ADMINISTRATOR REQUEST</p><h3>Request kitchen time for {business.name}</h3><label>Kitchen equipment<select name="resource_id" required defaultValue=""><option value="" disabled>Select available equipment</option>{adminResources.map(resource=><option key={resource.id} value={resource.id}>{kname(resource.kitchen_id)} · {resource.name} · {money(resource.hourly_rate_cents)}/hr</option>)}</select></label><div className="date-pair"><label>Starts<input name="starts_at" type="datetime-local" required min={localInput(new Date())}/></label><label>Ends<input name="ends_at" type="datetime-local" required min={localInput(new Date())}/></label></div><label>Request notes<textarea name="notes" placeholder="Production purpose, setup needs, or instructions for the kitchen"/></label><button disabled={busy}>Submit to Kitchen for approval</button><small>This creates a pending request. The Kitchen Workspace must still approve it.</small></form>}
        </Panel>
      </section>
      <section className="chef-grid" id="promotions">
        <Panel title="Create a Pop Up Pick Up" icon={Megaphone}>
          <form onSubmit={createPromotion}>
            <label>
              Event headline
              <input
                name="title"
                required
                placeholder="Chef Larry is back in the neighborhood"
              />
            </label>
            <label>
              Featured item or details
              <textarea
                name="description"
                placeholder="Signature cheesesteaks, preorder instructions…"
              />
            </label>
            <label>
              Event location
              <select name="location_type" required>
                <option value="tagos">Pickup at TaGo&apos;s</option>
                <option value="food_truck">
                  Take the TaGo&apos;s food truck
                </option>
                <option value="offsite">Independent offsite location</option>
              </select>
            </label>
            <label>
              Kitchen location (when applicable)
              <select name="kitchen_id">
                <option value="">Not at a network kitchen</option>
                {kitchens.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Public location
              <input
                name="public_location"
                placeholder="Enter the real event location only"
              />
            </label>
            <div className="date-pair">
              <label>
                Starts
                <input
                  name="starts_at"
                  type="datetime-local"
                  defaultValue={localInput(new Date(Date.now() + 86400000))}
                  required
                />
              </label>
              <label>
                Ends
                <input
                  name="ends_at"
                  type="datetime-local"
                  defaultValue={localInput(new Date(Date.now() + 93600000))}
                  required
                />
              </label>
            </div>
            <button
              disabled={busy || business.compliance_status !== "approved"}
            >
              Submit promotion draft
            </button>
            {business.compliance_status !== "approved" && (
              <small>Promotion submission unlocks after approval.</small>
            )}
          </form>
        </Panel>
        <Panel title="My promotions" icon={Store}>
          {promotions.length ? (
            <div className="chef-list">
              {promotions.map((p) => (
                <article key={p.id}>
                  <div>
                    <b>{p.title}</b>
                    <span>
                      {new Date(p.starts_at).toLocaleString()} •{" "}
                      {p.location_type.replaceAll("_", " ")}
                    </span>
                    <small>
                      {p.public_location || "Location not yet supplied"}
                    </small>
                  </div>
                  <em>{p.status}</em>
                </article>
              ))}
            </div>
          ) : (
            <Empty text="No promotions submitted yet." />
          )}
        </Panel>
      </section>
      <section className="chef-grid" id="jobs">
        <Panel title="TaGo's Jobs Board" icon={BriefcaseBusiness}>
          {business.compliance_status !== "approved" ? (
            <Empty
              text="Jobs unlock after your Kitchen Passport is approved."
              action="Complete Kitchen Passport"
              href="/account"
            />
          ) : opportunities.length ? (
            <div className="chef-list job-list">
              {opportunities.map((job) => {
                const applied = proposals.find(
                  (p) => p.opportunity_id === job.id,
                );
                return (
                  <article key={job.id}>
                    <div>
                      <b>{job.event_type}</b>
                      <span>
                        {new Date(
                          `${job.event_date}T12:00:00`,
                        ).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                        {job.approximate_time
                          ? ` • ${job.approximate_time}`
                          : ""}{" "}
                        • {job.general_location}
                      </span>
                      <small>
                        {job.guest_count
                          ? `${job.guest_count} guests`
                          : "Guest count not supplied"}
                        {job.budget_range
                          ? ` • Budget ${job.budget_range}`
                          : ""}
                      </small>
                      {job.cuisine_preferences && (
                        <small>Cuisine: {job.cuisine_preferences}</small>
                      )}
                    </div>
                    {applied ? (
                      <em>{applied.status}</em>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedJob(job.id)}
                      >
                        Review &amp; apply
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <Empty text="No open catering or food-service opportunities right now." />
          )}
        </Panel>
        <Panel title="My applications" icon={Check}>
          <PayoutSetup businessId={business.id} />
          {selectedJob ? (
            <form onSubmit={applyForJob}>
              <label>
                Your proposal
                <textarea
                  name="message"
                  required
                  placeholder="Introduce your business and explain how you would serve this opportunity."
                />
              </label>
              <label>
                Proposed menu or service
                <textarea
                  name="menu_details"
                  placeholder="Menu, portions, staffing, delivery or setup details…"
                />
              </label>
              <label>
                Total quote (optional)
                <input
                  name="quote"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="750.00"
                />
              </label>
              <button disabled={busy}>Submit proposal</button>
              <button
                className="secondary-action"
                type="button"
                onClick={() => setSelectedJob(null)}
              >
                Cancel
              </button>
            </form>
          ) : proposals.length ? (
            <div className="chef-list">
              {proposals.map((proposal) => {
                const job = opportunities.find(
                  (o) => o.id === proposal.opportunity_id,
                );
                const matchedJob = proposal.catering_opportunities?.[0];
                return (
                  <article key={proposal.id}>
                    <div>
                      <b>
                        {job?.event_type ||
                          matchedJob?.event_type ||
                          "Food-service opportunity"}
                      </b>
                      <span>
                        {job
                          ? `${job.event_date} • ${job.general_location}`
                          : matchedJob
                            ? `${matchedJob.event_date} • ${matchedJob.general_location}`
                            : "Opportunity details are no longer public"}
                      </span>
                      <small>
                        {proposal.quote_cents == null
                          ? "Quote not supplied"
                          : money(proposal.quote_cents)}
                      </small>
                    </div>
                    <em>{proposal.status}</em>
                    {proposal.status === "accepted" && (
                      <div className="chef-match-handoff">
                        <b>You were selected</b>
                        <span>
                          The customer now has your published business contact
                          information and can reach you to finalize the job.
                        </span>
                        <strong
                          className={
                            cateringPayments.find(
                              (payment) => payment.proposal_id === proposal.id,
                            )?.status === "succeeded"
                              ? "paid"
                              : "awaiting"
                          }
                        >
                          {cateringPayments.find(
                            (payment) => payment.proposal_id === proposal.id,
                          )?.status === "succeeded"
                            ? "Customer payment confirmed"
                            : "Awaiting customer payment"}
                        </strong>
                        <AgreementPanel
                          proposalId={proposal.id}
                          role="chef"
                          quoteCents={proposal.quote_cents}
                        />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <Empty text="You have not applied to any opportunities yet." />
          )}
        </Panel>
      </section>
      <section id="payments">
        <BookingChanges bookings={bookings} onNotice={setNotice} />
        <BillingCenter
          bookingLabel={(id) => {
            const b = bookings.find((x) => x.id === id);
            return b
              ? `${kname(b.kitchen_id)} • ${new Date(b.starts_at).toLocaleDateString()}`
              : "Booking";
          }}
          onNotice={setNotice}
        />
      </section>
      <section id="issues">
        <Panel title="Reported issues" icon={AlertCircle}>
          {incidents.length ? (
            <div className="chef-list issues">
              {incidents.map((i) => (
                <article key={i.id}>
                  <div>
                    <b>{i.incident_type.replaceAll("_", " ")}</b>
                    <span>{i.description}</span>
                    {i.resolution_notes && (
                      <small>Resolution: {i.resolution_notes}</small>
                    )}
                  </div>
                  <em>{i.status}</em>
                </article>
              ))}
            </div>
          ) : (
            <Empty text="No issues associated with your bookings." />
          )}
        </Panel>
      </section>
    </main>
  );
}
function State({
  title,
  copy,
  login,
  profile,
  href,
  action,
}: {
  title: string;
  copy?: string;
  login?: boolean;
  profile?: boolean;
  href?: string;
  action?: string;
}) {
  return (
    <main className="chef-state">
      <img src="/tagos-kitchen-logo.png" alt="TaGo's Kitchen" />
      <h1>{title}</h1>
      {copy && <p>{copy}</p>}
      <a href={href || (login ? "/account?mode=signin" : profile ? "/account" : "/")}>
        {action || (login ? "Sign in" : profile ? "Open profile" : "Home")}
      </a>
    </main>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article>
      <span>{label}</span>
      <b>{value}</b>
    </article>
  );
}
function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Home;
  children: any;
}) {
  return (
    <section className="chef-panel">
      <header>
        <Icon />
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}
function Empty({
  text,
  action,
  href,
}: {
  text: string;
  action?: string;
  href?: string;
}) {
  return (
    <div className="chef-empty">
      <ChefHat />
      <b>{text}</b>
      {action && href && <a href={href}>{action}</a>}
    </div>
  );
}
