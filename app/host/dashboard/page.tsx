"use client";
import { FormEvent, useEffect, useState } from "react";
import {
  AlertTriangle,
  Box,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Download,
  FileText,
  Home,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  TicketCheck,
  Trash2,
  UserPlus,
  UsersRound,
  Truck,
  Wrench,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { CalendarEntry, WeekSchedule } from "../../schedule-calendar";
import Breadcrumbs from "../../breadcrumbs";
import "../host.css";
import "./dashboard.css";
import "./provider-controls.css";
import "./portfolio.css";
import "./equipment-media.css";

type Tab =
  | "overview"
  | "requests"
  | "chefs"
  | "listing"
  | "equipment"
  | "availability"
  | "operations"
  | "payouts";
type Application = {
  kitchen_name: string;
  status: string;
  admin_notes: string | null;
};
type Kitchen = {
  id: string;
  name: string;
  address_line1: string;
  city: string;
  region: string;
  active: boolean;
  listing_description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  minimum_booking_minutes: number;
  booking_lead_hours: number;
  cancellation_policy: string | null;
  house_rules: string | null;
  accepting_requests: boolean;
  weekly_hours: Record<string, [string, string] | null>;
  included_amenities: string[];
};
type Booking = {
  id: string;
  renter_business_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  subtotal_cents: number;
  host_payout_cents: number;
  security_deposit_cents: number;
  cleaning_fee_cents: number;
  notes: string | null;
};
type Resource = {
  id: string;
  name: string;
  category: string;
  hourly_rate_cents: number;
  capacity: number;
  active: boolean;
  image_path: string | null;
  archived_at: string | null;
};
type Block = {
  id: string;
  title: string;
  kind: string;
  starts_at: string;
  ends_at: string;
  equipment_resource_id: string | null;
  scope: "whole_kitchen" | "resource" | "custom";
  custom_allocation: {
    dedicated_sqft?: number;
    cold_storage?: string;
    dry_storage?: string;
    table_space?: string;
    shared_cooking_equipment?: boolean;
    notes?: string;
  } | null;
  created_by: string;
  assigned_business_id: string | null;
  assigned_sponsored_profile_id: string | null;
  purpose: string | null;
  notes: string | null;
};
type Ticket = {
  id: string;
  title: string;
  priority: string;
  status: string;
  equipment_resource_id: string | null;
};
type Payout = {
  id: string;
  amount_cents: number;
  status: string;
  due_at: string | null;
  issue_notes: string | null;
};
type Invoice = {
  id: string;
  booking_id: string;
  invoice_number: string;
  amount_due_cents: number;
  amount_paid_cents: number;
  status: string;
};
type SponsoredChef = {
  id: string;
  chef_name: string;
  email: string;
  phone: string | null;
  business_name: string;
  business_type: string;
  notes: string | null;
  status: string;
  compliance_status: string;
  created_at: string;
};
type ChefRelationship = {
  id: string;
  sponsored_profile_id: string | null;
  chef_business_id: string | null;
  relationship_tier: "resident" | "recurring" | "hourly";
  access_status: "pending" | "active" | "paused" | "ended";
  resident_priority: boolean;
  dedicated_sqft: number | null;
  cold_storage: string | null;
  freezer_storage: string | null;
  dry_storage: string | null;
  table_space: string | null;
  shared_equipment_notes: string | null;
  starts_on: string | null;
  ends_on: string | null;
  internal_notes: string | null;
};
type ResidentDocument = {
  id: string;
  sponsored_profile_id: string;
  relationship_id: string | null;
  document_type: string;
  document_path: string;
  original_name: string;
  created_at: string;
};
type ResidentInvoice = {
  id: string;
  invoice_number: string;
  sponsored_profile_id: string;
  relationship_id: string | null;
  billing_period: string;
  amount_due_cents: number;
  amount_paid_cents: number;
  payment_method: string | null;
  paid_at: string | null;
  status: string;
  recipient_email: string;
  notes: string | null;
  issued_at: string | null;
  sent_at: string | null;
  due_at: string | null;
  source: string;
};
type ResidentBillingSchedule = {
  id: string;
  sponsored_profile_id: string;
  relationship_id: string | null;
  amount_cents: number;
  due_day: number;
  starts_on: string;
  ends_on: string | null;
  active: boolean;
};
const cash = (c: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    c / 100,
  );
const local = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
const days = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
const standardAmenities = [
  "3-bin dishwashing sink",
  "Mop station",
  "Prep table included with rental",
  "Parking",
  "Loading access",
  "Wi-Fi",
  "Security / surveillance",
  "Hand-washing sink",
  "Restroom access",
  "Waste disposal",
];
const nav: [Tab, typeof Home, string][] = [
  ["overview", Building2, "Kitchen overview"],
  ["requests", ClipboardCheck, "Booking requests"],
  ["chefs", UsersRound, "Chef roster"],
  ["listing", Settings, "Listing & hours"],
  ["equipment", Box, "Equipment & rates"],
  ["availability", CalendarDays, "Calendar & availability"],
  ["operations", Wrench, "Maintenance & access"],
  ["payouts", CircleDollarSign, "Invoices & payouts"],
];

export default function HostDashboard() {
  const [state, setState] = useState<
      "loading" | "signed_out" | "empty" | "pending" | "ready"
    >("loading"),
    [tab, setTab] = useState<Tab>("overview"),
    [menu, setMenu] = useState(false),
    [application, setApplication] = useState<Application | null>(null),
    [kitchens, setKitchens] = useState<Kitchen[]>([]),
    [kitchen, setKitchen] = useState<Kitchen | null>(null),
    [bookings, setBookings] = useState<Booking[]>([]),
    [brands, setBrands] = useState<Record<string, string>>({}),
    [approvedBrandIds, setApprovedBrandIds] = useState<string[]>([]),
    [resources, setResources] = useState<Resource[]>([]),
    [blocks, setBlocks] = useState<Block[]>([]),
    [tickets, setTickets] = useState<Ticket[]>([]),
    [payouts, setPayouts] = useState<Payout[]>([]),
    [invoices, setInvoices] = useState<Invoice[]>([]),
    [sponsoredChefs, setSponsoredChefs] = useState<SponsoredChef[]>([]),
    [chefRelationships, setChefRelationships] = useState<ChefRelationship[]>(
      [],
    ),
    [residentDocuments, setResidentDocuments] = useState<ResidentDocument[]>(
      [],
    ),
    [residentInvoices, setResidentInvoices] = useState<ResidentInvoice[]>([]),
    [residentBillingSchedules, setResidentBillingSchedules] = useState<
      ResidentBillingSchedule[]
    >([]),
    [adminMode, setAdminMode] = useState(false),
    [userId, setUserId] = useState(""),
    [message, setMessage] = useState("");
  const load = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setState("signed_out");
      return;
    }
    setUserId(user.id);
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("kitchen");
    const wantsAdmin = params.get("admin") === "1" && Boolean(requested);
    const { data: staff } = await supabase
      .from("platform_staff")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const canAdmin = wantsAdmin && Boolean(staff);
    setAdminMode(canAdmin);
    const { data: members } = await supabase
      .from("business_members")
      .select("business_id,role")
      .eq("user_id", user.id);
    const owned = (members || [])
      .filter((m) => ["owner", "manager"].includes(m.role))
      .map((m) => m.business_id);
    let found: Kitchen | null = null;
    if (owned.length || canAdmin) {
      let query = supabase
        .from("kitchens")
        .select(
          "id,name,address_line1,city,region,active,listing_description,contact_email,contact_phone,minimum_booking_minutes,booking_lead_hours,cancellation_policy,house_rules,accepting_requests,weekly_hours,included_amenities",
        );
      if (!canAdmin) query = query.in("owner_business_id", owned);
      const { data } = await query.order("name");
      const portfolio = (data || []) as Kitchen[];
      setKitchens(portfolio);
      found =
        portfolio.find((item) => item.id === requested) || portfolio[0] || null;
    }
    if (!found && !canAdmin) {
      const { data: app } = await supabase
        .from("kitchen_applications")
        .select("kitchen_name,status,admin_notes")
        .eq("applicant_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setApplication(app as Application | null);
      setState(app ? "pending" : "empty");
      return;
    }
    if (!found) return;
    setKitchen(found);
    const id = found.id;
    const qs = await Promise.all([
      supabase
        .from("bookings")
        .select(
          "id,renter_business_id,starts_at,ends_at,status,subtotal_cents,host_payout_cents,security_deposit_cents,cleaning_fee_cents,notes",
        )
        .eq("kitchen_id", id)
        .order("starts_at", { ascending: false }),
      supabase
        .from("equipment_resources")
        .select(
          "id,name,category,hourly_rate_cents,capacity,active,image_path,archived_at",
        )
        .eq("kitchen_id", id)
        .is("archived_at", null)
        .order("name"),
      supabase
        .from("availability_blocks")
        .select(
          "id,title,kind,starts_at,ends_at,equipment_resource_id,scope,custom_allocation,created_by,assigned_business_id,assigned_sponsored_profile_id,purpose,notes",
        )
        .eq("kitchen_id", id)
        .order("starts_at"),
      supabase
        .from("maintenance_tickets")
        .select("id,title,priority,status,equipment_resource_id")
        .eq("kitchen_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("provider_payouts")
        .select("id,amount_cents,status,due_at,issue_notes")
        .eq("kitchen_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("booking_invoices")
        .select(
          "id,booking_id,invoice_number,amount_due_cents,amount_paid_cents,status",
        )
        .eq("kitchen_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("sponsored_chef_profiles")
        .select(
          "id,chef_name,email,phone,business_name,business_type,notes,status,compliance_status,created_at",
        )
        .eq("kitchen_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("kitchen_chef_relationships")
        .select(
          "id,sponsored_profile_id,chef_business_id,relationship_tier,access_status,resident_priority,dedicated_sqft,cold_storage,freezer_storage,dry_storage,table_space,shared_equipment_notes,starts_on,ends_on,internal_notes",
        )
        .eq("kitchen_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("resident_documents")
        .select(
          "id,sponsored_profile_id,relationship_id,document_type,document_path,original_name,created_at",
        )
        .eq("kitchen_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("resident_invoices")
        .select(
          "id,invoice_number,sponsored_profile_id,relationship_id,billing_period,amount_due_cents,amount_paid_cents,payment_method,paid_at,status,recipient_email,notes,issued_at,sent_at,due_at,source",
        )
        .eq("kitchen_id", id)
        .order("billing_period", { ascending: false }),
      supabase
        .from("resident_billing_schedules")
        .select(
          "id,sponsored_profile_id,relationship_id,amount_cents,due_day,starts_on,ends_on,active",
        )
        .eq("kitchen_id", id)
        .order("created_at", { ascending: false }),
    ]);
    setBookings((qs[0].data || []) as Booking[]);
    setResources((qs[1].data || []) as Resource[]);
    setBlocks((qs[2].data || []) as Block[]);
    setTickets((qs[3].data || []) as Ticket[]);
    setPayouts((qs[4].data || []) as Payout[]);
    setInvoices((qs[5].data || []) as Invoice[]);
    setSponsoredChefs((qs[6].data || []) as SponsoredChef[]);
    setChefRelationships((qs[7].data || []) as ChefRelationship[]);
    setResidentDocuments((qs[8].data || []) as ResidentDocument[]);
    setResidentInvoices((qs[9].data || []) as ResidentInvoice[]);
    setResidentBillingSchedules(
      (qs[10].data || []) as ResidentBillingSchedule[],
    );
    setBrands({});
    setApprovedBrandIds([]);
    const ids = Array.from(new Set([
      ...(qs[0].data || []).map((b: any) => b.renter_business_id),
      ...(qs[7].data || []).map((relationship: any) => relationship.chef_business_id).filter(Boolean),
    ]));
    if (ids.length) {
      const { data } = await supabase
        .from("businesses")
        .select("id,name,compliance_status")
        .in("id", ids);
      setBrands(Object.fromEntries((data || []).map((b) => [b.id, b.name])));
      setApprovedBrandIds((data || []).filter((b) => b.compliance_status === "approved").map((b) => b.id));
    }
    setState("ready");
  };
  useEffect(() => {
    load();
  }, []);
  const connectStripe = async () => {
    setMessage("");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setMessage("Sign in again to connect Stripe.");
      return;
    }
    const response = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { authorization: `Bearer ${session.access_token}` },
      }),
      result = await response.json() as any;
    if (!response.ok || !result.url) {
      setMessage(result.error || "Stripe setup is unavailable.");
      return;
    }
    location.href = result.url;
  };
  const run = async (job: () => PromiseLike<{ error: any }>, success: string) => {
    setMessage("");
    const { error } = await job();
    if (error) setMessage(error.message);
    else {
      setMessage(success);
      await load();
    }
  };
  const vals = (form: HTMLFormElement) =>
    Object.fromEntries(new FormData(form).entries());
  if (state === "loading") return <State title="Loading kitchen workspace…" />;
  if (state === "signed_out")
    return (
      <State
        title="Kitchen provider login"
        copy="Sign in with an account authorized for this facility."
        href="/account?mode=signin"
        action="Log in"
      />
    );
  if (state === "empty")
    return (
      <State
        title="No kitchen connected"
        copy="Apply to join the TaGo's kitchen network, then your approved facility will appear here."
        href="/host"
        action="Apply as a kitchen"
      />
    );
  if (state === "pending")
    return (
      <State
        title={
          application?.status === "approved"
            ? "Kitchen setup in progress"
            : "Application under review"
        }
        copy={
          application?.admin_notes ||
          "TaGo's will connect this workspace after reviewing the facility documents."
        }
        href="/host"
        action="Review application requirements"
      />
    );
  if (!kitchen) return null;
  const pending = bookings.filter(
      (b) =>
        ["draft", "pending_documents", "pending_payment"].includes(b.status) &&
        !invoices.some((i) => i.booking_id === b.id),
    ),
    confirmed = bookings.filter((b) => b.status === "confirmed"),
    earned = bookings
      .filter((b) => b.status === "completed")
      .reduce((s, b) => s + b.host_payout_cents, 0),
    due = payouts
      .filter((p) => p.status !== "paid")
      .reduce((s, p) => s + p.amount_cents, 0),
    brand = (id: string) => brands[id] || "Approved chef business";
  const decide = async (
    form: HTMLFormElement,
    b: Booking,
    decision: string,
  ) => {
    const v = vals(form);
    await run(
      () =>
        supabase.rpc("provider_decide_booking", {
          p_booking_id: b.id,
          p_decision: decision,
          p_provider_note: v.note || null,
          p_security_deposit_cents: Math.round(Number(v.deposit || 0) * 100),
          p_cleaning_fee_cents: Math.round(Number(v.cleaning || 0) * 100),
          p_deposit_due_at: v.deposit_due
            ? new Date(String(v.deposit_due)).toISOString()
            : null,
          p_balance_due_at: v.balance_due
            ? new Date(String(v.balance_due)).toISOString()
            : null,
        }),
      decision === "approved"
        ? "Booking approved and invoice issued."
        : decision === "declined"
          ? "Booking declined."
          : "Chef asked for more information.",
    );
  };
  return (
    <main className="provider-workspace">
      {adminMode && <div className="provider-admin-banner"><ShieldCheck/><span><b>Platform Admin acting as {kitchen.name}</b>Full kitchen controls are active under your administrator login.</span><a href="/admin">Return to Platform Admin</a></div>}
      <aside className={menu ? "open" : ""}>
        <div className="provider-logo">
          <a href="/">
            <img src="/tagos-kitchen-logo.png" alt="TaGo's Kitchen" />
          </a>
          <button onClick={() => setMenu(false)}>
            <X />
          </button>
        </div>
        <div className="kitchen-portfolio">
          <label>
            Managing location
            <select
              value={kitchen.id}
              onChange={(e) =>
                (location.href = `/host/dashboard?kitchen=${e.target.value}${adminMode ? "&admin=1" : ""}`)
              }
            >
              {kitchens.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <a href="/host#apply">
            <Plus />
            Add Kitchen
          </a>
          <a className="fleet-link" href="/host/trucks">
            <Truck />
            Food Truck Fleet
          </a>
          <small>
            {kitchens.length} {kitchens.length === 1 ? "location" : "locations"}{" "}
            in this portfolio
          </small>
        </div>
        <nav>
          {nav.map(([key, Icon, label]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => {
                setTab(key);
                setMenu(false);
              }}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <div className="provider-user">
          <b>{kitchen.name}</b>
          <span>Kitchen provider</span>
          <a href={adminMode ? "/admin" : "/account"}>{adminMode ? "Return to Platform Admin" : "Switch workspace"}</a>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              location.href = "/";
            }}
          >
            <LogOut />
            Sign out
          </button>
        </div>
      </aside>
      <section className="provider-main">
        <header>
          <button className="provider-menu" onClick={() => setMenu(true)}>
            <Menu />
          </button>
          <div>
            <b>Kitchen Portfolio</b>
            <span>
              {kitchens.length} managed{" "}
              {kitchens.length === 1 ? "location" : "locations"}
            </span>
          </div>
          <a className="header-add-kitchen" href="/host#apply">
            <Plus />
            Add Kitchen
          </a>
          <button onClick={load}>
            <RefreshCw />
            Refresh
          </button>
          <a href="/">
            <Home />
            Home
          </a>
        </header>
        <Breadcrumbs
          items={[
            { label: "Account", href: "/account" },
            { label: "Kitchen Workspace", href: "/host/dashboard" },
            { label: kitchen.name, href: "/host/dashboard" },
            nav.find((n) => n[0] === tab)?.[2] || "Overview",
          ]}
        />
        {message && (
          <div className="partner-note">
            <Check />
            <span>{message}</span>
          </div>
        )}
        <div className="provider-content">
          {tab === "overview" && (
            <Overview
              kitchen={kitchen}
              pending={pending}
              confirmed={confirmed}
              earned={earned}
              due={due}
              brand={brand}
              setTab={setTab}
            />
          )}
          {tab === "requests" && (
            <Requests rows={pending} brand={brand} decide={decide} />
          )}
          {tab === "chefs" && (
            <ChefRoster
              kitchenId={kitchen.id}
              userId={userId}
              rows={sponsoredChefs}
              relationships={chefRelationships}
              documents={residentDocuments}
              run={run}
            />
          )}
          {tab === "listing" && <Listing kitchen={kitchen} run={run} />}
          {tab === "equipment" && (
            <Equipment kitchenId={kitchen.id} resources={resources} run={run} />
          )}
          {tab === "availability" && (
            <Availability
              kitchenId={kitchen.id}
              userId={userId}
              resources={resources}
              blocks={blocks}
              bookings={bookings}
              brands={brands}
              approvedBrandIds={approvedBrandIds}
              sponsoredChefs={sponsoredChefs}
              relationships={chefRelationships}
              setTab={setTab}
              run={run}
            />
          )}
          {tab === "operations" && (
            <Operations
              kitchenId={kitchen.id}
              userId={userId}
              resources={resources}
              tickets={tickets}
              run={run}
            />
          )}
          {tab === "payouts" && (
            <>
              <button className="provider-primary" onClick={connectStripe}>
                <CircleDollarSign />
                Connect Stripe payouts
              </button>
              <Financials
                invoices={invoices}
                payouts={payouts}
                bookings={bookings}
                brand={brand}
                kitchen={kitchen}
                userId={userId}
                residentInvoices={residentInvoices}
                residentBillingSchedules={residentBillingSchedules}
                sponsoredChefs={sponsoredChefs}
                relationships={chefRelationships}
                run={run}
              />
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function Overview({
  kitchen,
  pending,
  confirmed,
  earned,
  due,
  brand,
  setTab,
}: {
  kitchen: Kitchen;
  pending: Booking[];
  confirmed: Booking[];
  earned: number;
  due: number;
  brand: (id: string) => string;
  setTab: (t: Tab) => void;
}) {
  return (
    <>
      <Heading
        over="KITCHEN PROVIDER"
        title={kitchen.name}
        copy={`${kitchen.address_line1}, ${kitchen.city}, ${kitchen.region}`}
      />
      <section className="host-metrics">
        <Metric
          icon={ClipboardCheck}
          label="Requests to review"
          value={String(pending.length)}
        />
        <Metric
          icon={CalendarDays}
          label="Confirmed sessions"
          value={String(confirmed.length)}
        />
        <Metric
          icon={CircleDollarSign}
          label="Recorded earnings"
          value={cash(earned)}
        />
        <Metric
          icon={AlertTriangle}
          label="Payout outstanding"
          value={cash(due)}
        />
      </section>
      <div className="provider-console">
        <Panel title="Next decisions" icon={ClipboardCheck}>
          {pending.slice(0, 5).map((b) => (
            <button
              className="provider-action"
              key={b.id}
              onClick={() => setTab("requests")}
            >
              <span>
                <b>{brand(b.renter_business_id)}</b>
                {new Date(b.starts_at).toLocaleString()}
              </span>
              <ChevronRight />
            </button>
          ))}
          {!pending.length && (
            <Empty text="No booking requests need a decision" />
          )}
        </Panel>
        <Panel title="Marketplace status" icon={ShieldCheck}>
          <div className="listing-state">
            <b>
              {kitchen.active
                ? "Listed in the network"
                : "Private—not publicly listed"}
            </b>
            <span>
              {kitchen.accepting_requests
                ? "Accepting booking requests"
                : "New booking requests paused"}
            </span>
            <p>
              TaGo&apos;s controls network approval and public activation. Your
              kitchen controls its operating availability.
            </p>
            <button onClick={() => setTab("listing")}>Manage listing</button>
          </div>
        </Panel>
      </div>
    </>
  );
}
function Requests({
  rows,
  brand,
  decide,
}: {
  rows: Booking[];
  brand: (id: string) => string;
  decide: (f: HTMLFormElement, b: Booking, d: string) => void;
}) {
  return (
    <>
      <Heading
        over="BOOKING CONTROL"
        title="Approve kitchen use"
        copy="Approval creates the chef's invoice. Payment confirmation finalizes the reservation."
      />
      {rows.length ? (
        <div className="provider-request-grid">
          {rows.map((b) => (
            <form key={b.id}>
              <header>
                <div>
                  <h2>{brand(b.renter_business_id)}</h2>
                  <span>
                    {new Date(b.starts_at).toLocaleString()} –{" "}
                    {new Date(b.ends_at).toLocaleTimeString()}
                  </span>
                </div>
                <em>{b.status.replaceAll("_", " ")}</em>
              </header>
              <p>{b.notes || "No booking note supplied."}</p>
              <div className="request-total">
                <span>
                  Kitchen time<b>{cash(b.subtotal_cents)}</b>
                </span>
                <span>
                  Recorded host share<b>{cash(b.host_payout_cents)}</b>
                </span>
              </div>
              <div className="provider-pair">
                <label>
                  Security deposit
                  <input
                    name="deposit"
                    type="number"
                    min="0"
                    step=".01"
                    defaultValue={(b.security_deposit_cents / 100).toFixed(2)}
                  />
                </label>
                <label>
                  Cleaning fee
                  <input
                    name="cleaning"
                    type="number"
                    min="0"
                    step=".01"
                    defaultValue={(b.cleaning_fee_cents / 100).toFixed(2)}
                  />
                </label>
              </div>
              <div className="provider-pair">
                <label>
                  Deposit due
                  <input
                    name="deposit_due"
                    type="datetime-local"
                    defaultValue={local(new Date())}
                  />
                </label>
                <label>
                  Balance due
                  <input
                    name="balance_due"
                    type="datetime-local"
                    defaultValue={local(
                      new Date(
                        Math.max(
                          Date.now(),
                          new Date(b.starts_at).getTime() - 86400000,
                        ),
                      ),
                    )}
                  />
                </label>
              </div>
              <label>
                Message to chef
                <textarea
                  name="note"
                  placeholder="Access instructions, clarification, or approval conditions…"
                />
              </label>
              <footer>
                <button
                  type="button"
                  onClick={(e) => decide(e.currentTarget.form!, b, "declined")}
                >
                  Decline
                </button>
                <button
                  type="button"
                  onClick={(e) =>
                    decide(e.currentTarget.form!, b, "needs_information")
                  }
                >
                  Need information
                </button>
                <button
                  type="button"
                  className="provider-primary"
                  onClick={(e) => decide(e.currentTarget.form!, b, "approved")}
                >
                  <Check />
                  Approve & invoice
                </button>
              </footer>
            </form>
          ))}
        </div>
      ) : (
        <Empty text="No booking requests are waiting for kitchen approval" />
      )}
    </>
  );
}
function Listing({
  kitchen,
  run,
}: {
  kitchen: Kitchen;
  run: (j: () => PromiseLike<{ error: any }>, s: string) => void;
}) {
  return (
    <>
      <Heading
        over="FACILITY PROFILE"
        title="Listing, rules & regular hours"
        copy="Keep operating information accurate. TaGo's controls public network activation."
      />
      <Panel title="Kitchen listing" icon={Building2}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = vals(e.currentTarget),
              hours = Object.fromEntries(
                days.map((d) => [
                  d,
                  v[`${d}_closed`]
                    ? null
                    : [String(v[`${d}_open`]), String(v[`${d}_close`])],
                ]),
              );
            run(
              () =>
                supabase.rpc("provider_update_kitchen_settings", {
                  p_kitchen_id: kitchen.id,
                  p_name: v.name,
                  p_description: v.description || null,
                  p_email: v.email || null,
                  p_phone: v.phone || null,
                  p_minimum_minutes: Number(v.minimum),
                  p_lead_hours: Number(v.lead),
                  p_cancellation: v.cancellation || null,
                  p_rules: v.rules || null,
                  p_accepting: v.accepting === "on",
                  p_weekly_hours: hours,
                }),
              "Kitchen settings saved.",
            );
          }}
        >
          <label>
            Public kitchen name
            <input name="name" defaultValue={kitchen.name} required />
          </label>
          <label>
            Listing description
            <textarea
              name="description"
              defaultValue={kitchen.listing_description || ""}
            />
          </label>
          <div className="provider-pair">
            <label>
              Contact email
              <input
                name="email"
                type="email"
                defaultValue={kitchen.contact_email || ""}
              />
            </label>
            <label>
              Contact phone
              <input name="phone" defaultValue={kitchen.contact_phone || ""} />
            </label>
          </div>
          <div className="provider-pair">
            <label>
              Minimum booking (minutes)
              <input
                name="minimum"
                type="number"
                min="30"
                step="30"
                defaultValue={kitchen.minimum_booking_minutes}
              />
            </label>
            <label>
              Advance notice (hours)
              <input
                name="lead"
                type="number"
                min="0"
                defaultValue={kitchen.booking_lead_hours}
              />
            </label>
          </div>
          <label>
            Cancellation policy
            <textarea
              name="cancellation"
              defaultValue={kitchen.cancellation_policy || ""}
            />
          </label>
          <label>
            House rules
            <textarea name="rules" defaultValue={kitchen.house_rules || ""} />
          </label>
          <label className="provider-check">
            <input
              name="accepting"
              type="checkbox"
              defaultChecked={kitchen.accepting_requests}
            />
            Accept new booking requests
          </label>
          <h3>Regular operating hours</h3>
          <div className="weekly-hours">
            {days.map((d) => {
              const h = kitchen.weekly_hours?.[d] || ["06:00", "22:00"];
              return (
                <div key={d}>
                  <b>{d}</b>
                  <input name={`${d}_open`} type="time" defaultValue={h?.[0]} />
                  <span>to</span>
                  <input
                    name={`${d}_close`}
                    type="time"
                    defaultValue={h?.[1]}
                  />
                  <label>
                    <input
                      name={`${d}_closed`}
                      type="checkbox"
                      defaultChecked={!kitchen.weekly_hours?.[d]}
                    />
                    Closed
                  </label>
                </div>
              );
            })}
          </div>
          <button className="provider-primary">Save kitchen settings</button>
        </form>
      </Panel>
      <Panel title="Included at no charge" icon={Check}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const selected = f.getAll("amenity").map(String);
            const custom = String(f.get("custom_amenities") || "")
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean);
            run(
              () =>
                supabase.rpc("provider_update_kitchen_amenities", {
                  p_kitchen_id: kitchen.id,
                  p_amenities: [...selected, ...custom],
                }),
              "Included amenities saved.",
            );
          }}
        >
          <p className="amenity-help">
            These items appear as included with this location&apos;s rental—not
            as separately priced equipment.
          </p>
          <div className="amenity-grid">
            {standardAmenities.map((item) => (
              <label className="provider-check" key={item}>
                <input
                  type="checkbox"
                  name="amenity"
                  value={item}
                  defaultChecked={(kitchen.included_amenities || []).includes(
                    item,
                  )}
                />
                {item}
              </label>
            ))}
          </div>
          <label>
            Other included items, separated by commas
            <input
              name="custom_amenities"
              defaultValue={(kitchen.included_amenities || [])
                .filter((item) => !standardAmenities.includes(item))
                .join(", ")}
              placeholder="Ice machine, dumpster access, utilities"
            />
          </label>
          <button className="provider-primary">Save included amenities</button>
        </form>
      </Panel>
    </>
  );
}
function Equipment({
  kitchenId,
  resources,
  run,
}: {
  kitchenId: string;
  resources: Resource[];
  run: (j: () => PromiseLike<{ error: any }>, s: string) => void;
}) {
  return (
    <>
      <Heading
        over="RENTABLE CAPACITY"
        title="Equipment & rates"
        copy="Add equipment, set hourly pricing, or mark an item unavailable without losing its history. A $0 rate means it is not rented separately."
      />
      <Panel title="Equipment inventory" icon={Box}>
        <form
          className="provider-add"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget,
              v = vals(form),
              image = new FormData(form).get("image");
            run(async () => {
              const { data, error } = await supabase
                .from("equipment_resources")
                .insert({
                  kitchen_id: kitchenId,
                  name: v.name,
                  category: v.category,
                  hourly_rate_cents: Math.round(Number(v.rate) * 100),
                  capacity: Number(v.capacity),
                  active: true,
                })
                .select("id")
                .single();
              if (error || !data) return { error };
              if (image instanceof File && image.size) {
                const safe = image.name.replace(/[^a-zA-Z0-9._-]/g, "-");
                const path = `${kitchenId}/${data.id}/${Date.now()}-${safe}`;
                const uploaded = await supabase.storage
                  .from("kitchen-assets")
                  .upload(path, image);
                if (uploaded.error) return uploaded;
                return supabase
                  .from("equipment_resources")
                  .update({ image_path: path })
                  .eq("id", data.id);
              }
              return { error: null };
            }, "Equipment added.");
            form.reset();
          }}
        >
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Category
            <input name="category" required />
          </label>
          <label>
            Rate/hour
            <input name="rate" type="number" min="0" step=".01" required />
          </label>
          <label>
            Capacity
            <input name="capacity" type="number" min="1" defaultValue="1" />
          </label>
          <label>
            Equipment photo
            <input
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </label>
          <button>
            <Plus />
            Add
          </button>
        </form>
        <div className="provider-rows">
          {resources.map((r) => (
            <form
              key={r.id}
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget,
                  v = vals(form),
                  image = new FormData(form).get("image");
                run(async () => {
                  let imagePath = r.image_path;
                  if (image instanceof File && image.size) {
                    const safe = image.name.replace(/[^a-zA-Z0-9._-]/g, "-");
                    imagePath = `${kitchenId}/${r.id}/${Date.now()}-${safe}`;
                    const uploaded = await supabase.storage
                      .from("kitchen-assets")
                      .upload(imagePath, image);
                    if (uploaded.error) return uploaded;
                  }
                  return supabase
                    .from("equipment_resources")
                    .update({
                      name: v.name,
                      category: v.category,
                      hourly_rate_cents: Math.round(Number(v.rate) * 100),
                      capacity: Number(v.capacity),
                      image_path: imagePath,
                    })
                    .eq("id", r.id);
                }, "Equipment updated.");
              }}
            >
              <div className="equipment-card-head">
                <div className="equipment-photo">
                  {r.image_path ? (
                    <img
                      src={
                        supabase.storage
                          .from("kitchen-assets")
                          .getPublicUrl(r.image_path).data.publicUrl
                      }
                      alt={r.name}
                    />
                  ) : (
                    <Box />
                  )}
                </div>
                <span
                  className={
                    r.active ? "equipment-status active" : "equipment-status"
                  }
                >
                  {r.active ? "Available" : "Unavailable"}
                </span>
              </div>
              <div className="equipment-fields">
                <label>
                  Name
                  <input name="name" defaultValue={r.name} required />
                </label>
                <label>
                  Category
                  <input name="category" defaultValue={r.category} required />
                </label>
                <label>
                  Rate per hour
                  <input
                    name="rate"
                    type="number"
                    min="0"
                    step=".01"
                    defaultValue={(r.hourly_rate_cents / 100).toFixed(2)}
                  />
                </label>
                <label>
                  Capacity
                  <input
                    name="capacity"
                    type="number"
                    min="1"
                    defaultValue={r.capacity}
                  />
                </label>
                <label className="equipment-file">
                  Replace photo
                  <input
                    name="image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                  />
                </label>
              </div>
              <div className="equipment-actions">
                <button>Save changes</button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() =>
                    run(
                      () =>
                        supabase
                          .from("equipment_resources")
                          .update({ active: !r.active })
                          .eq("id", r.id),
                      r.active
                        ? "Equipment marked unavailable."
                        : "Equipment restored to availability.",
                    )
                  }
                >
                  {r.active ? "Mark unavailable" : "Restore availability"}
                </button>
                <button
                  type="button"
                  className="remove-action"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Remove ${r.name} from this kitchen inventory? Its booking history will be preserved.`,
                      )
                    )
                      run(
                        () =>
                          supabase
                            .from("equipment_resources")
                            .update({
                              active: false,
                              archived_at: new Date().toISOString(),
                            })
                            .eq("id", r.id),
                        "Equipment removed from inventory.",
                      );
                  }}
                >
                  <Trash2 /> Remove
                </button>
              </div>
            </form>
          ))}
        </div>
      </Panel>
    </>
  );
}
function Availability({
  kitchenId,
  userId,
  resources,
  blocks,
  bookings,
  brands,
  approvedBrandIds,
  sponsoredChefs,
  relationships,
  setTab,
  run,
}: {
  kitchenId: string;
  userId: string;
  resources: Resource[];
  blocks: Block[];
  bookings: Booking[];
  brands: Record<string, string>;
  approvedBrandIds: string[];
  sponsoredChefs: SponsoredChef[];
  relationships: ChefRelationship[];
  setTab: (tab: Tab) => void;
  run: (j: () => PromiseLike<{ error: any }>, s: string) => void;
}) {
  const [scope, setScope] = useState("whole_kitchen");
  const [slot, setSlot] = useState<{ starts: string; ends: string } | null>(null);
  const [editing, setEditing] = useState<Block | null>(null);
  const approvedAssignments = relationships.filter((relationship) => relationship.access_status === "active" && (relationship.sponsored_profile_id ? sponsoredChefs.some((chef) => chef.id === relationship.sponsored_profile_id && chef.compliance_status === "approved") : !!relationship.chef_business_id && approvedBrandIds.includes(relationship.chef_business_id))).map((relationship) => {
    const sponsored = sponsoredChefs.find((chef) => chef.id === relationship.sponsored_profile_id);
    return relationship.sponsored_profile_id
      ? { value: `sponsored:${relationship.sponsored_profile_id}`, label: sponsored ? `${sponsored.chef_name} — ${sponsored.business_name}` : "Approved sponsored chef" }
      : { value: `business:${relationship.chef_business_id}`, label: brands[relationship.chef_business_id || ""] || "Approved chef business" };
  });
  const pendingAssignments = relationships.filter((relationship) => relationship.access_status === "active" && !approvedAssignments.some((approved) => approved.value.endsWith(relationship.sponsored_profile_id || relationship.chef_business_id || "missing"))).map((relationship) => {
    const sponsored = sponsoredChefs.find((chef) => chef.id === relationship.sponsored_profile_id);
    return sponsored?.business_name || brands[relationship.chef_business_id || ""] || "Chef profile";
  });
  const calendarEntries: CalendarEntry[] = [
    ...blocks.map((block) => ({
      id: `block-${block.id}`,
      title: block.title,
      subtitle:
        block.assigned_sponsored_profile_id
          ? sponsoredChefs.find((chef) => chef.id === block.assigned_sponsored_profile_id)?.business_name || "Assigned chef"
          : block.assigned_business_id
            ? brands[block.assigned_business_id] || "Assigned chef"
            : block.scope === "resource"
          ? resources.find((resource) => resource.id === block.equipment_resource_id)?.name || "Equipment"
          : block.scope === "custom"
            ? "Resident footprint"
            : "Whole kitchen",
      startsAt: block.starts_at,
      endsAt: block.ends_at,
      tone:
        block.kind === "available"
          ? "available"
          : block.kind === "resident_priority"
            ? "resident"
            : block.kind === "maintenance"
              ? "maintenance"
              : "blocked",
      editable: block.created_by === userId,
    }) as CalendarEntry),
    ...bookings
      .filter((booking) => !["cancelled", "declined"].includes(booking.status))
      .map((booking) => ({
        id: `booking-${booking.id}`,
        title: brands[booking.renter_business_id] || "Chef booking",
        subtitle: booking.status === "confirmed" ? "Confirmed kitchen booking" : "Awaiting kitchen approval",
        startsAt: booking.starts_at,
        endsAt: booking.ends_at,
        tone: booking.status === "confirmed" ? "confirmed" : "requested",
      } as CalendarEntry)),
  ];
  return (
    <>
      <Heading
        over="CAPACITY CALENDAR"
        title="Availability & protected time"
        copy="See the full week at a glance. Click any open time to create a block, then choose whether it applies to the whole kitchen, a resident footprint or one piece of equipment."
      />
      <WeekSchedule
        entries={calendarEntries}
        onEntrySelect={(entry) => {
          const block = blocks.find((item) => `block-${item.id}` === entry.id);
          if (!block || block.created_by !== userId) return;
          setEditing(block);
          setScope(block.scope);
          setSlot({ starts: local(new Date(block.starts_at)), ends: local(new Date(block.ends_at)) });
          setTimeout(() => document.getElementById("schedule-block-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
        }}
        onEmptySlot={(starts, ends) => {
          setEditing(null);
          setScope("whole_kitchen");
          setSlot({ starts: local(starts), ends: local(ends) });
          document.getElementById("schedule-block-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        emptyLabel="Create schedule block"
      />
      <Panel title={editing ? "Edit schedule block" : "Add a schedule block"} icon={CalendarDays}>
        <div className="manual-schedule-callout">
          <div>
            <ShieldCheck />
            <span>
              <b>Kitchen Admin scheduling</b>
              Assign time for an approved chef even when they do not use the online workspace. Your account and audit note remain attached to the entry.
            </span>
          </div>
          <button type="button" onClick={() => setTab("chefs")}>Manage or add an offline chef</button>
        </div>
        <form
          id="schedule-block-form"
          key={`${editing?.id || "new"}-${slot?.starts || "blank"}-${slot?.ends || "blank"}`}
          onSubmit={(e) => {
            e.preventDefault();
            const v = vals(e.currentTarget);
            const customAllocation =
              scope === "custom"
                ? {
                    dedicated_sqft: Number(v.dedicated_sqft || 0) || undefined,
                    cold_storage: v.cold_storage || undefined,
                    dry_storage: v.dry_storage || undefined,
                    table_space: v.table_space || undefined,
                    shared_cooking_equipment: true,
                    notes: v.allocation_notes || undefined,
                  }
                : null;
            const assignment = String(v.assignment || "purpose:closed");
            const [assignmentType, assignmentId] = assignment.split(":");
            const payload = {
                  kitchen_id: kitchenId,
                  equipment_resource_id:
                    scope === "resource" ? v.resource_id : null,
                  scope,
                  custom_allocation: customAllocation,
                  kind: v.kind,
                  title: v.title,
                  starts_at: new Date(String(v.starts)).toISOString(),
                  ends_at: new Date(String(v.ends)).toISOString(),
                  created_by: userId,
                  assigned_business_id: assignmentType === "business" ? assignmentId : null,
                  assigned_sponsored_profile_id: assignmentType === "sponsored" ? assignmentId : null,
                  purpose: assignmentType === "purpose" ? assignmentId : "chef_production",
                  notes: v.admin_notes || null,
                };
            run(
              () => editing
                ? supabase.from("availability_blocks").update(payload).eq("id", editing.id).eq("created_by", userId)
                : supabase.from("availability_blocks").insert(payload),
              editing ? "Schedule assignment updated and audit saved." : assignmentType === "purpose" ? "Schedule block added." : "Chef time assigned and audit saved.",
            );
            e.currentTarget.reset();
            setEditing(null);
            setSlot(null);
            setScope("whole_kitchen");
          }}
        >
          <label>
            Assigned chef / purpose
            <select name="assignment" required defaultValue={editing?.assigned_business_id ? `business:${editing.assigned_business_id}` : editing?.assigned_sponsored_profile_id ? `sponsored:${editing.assigned_sponsored_profile_id}` : `purpose:${editing?.purpose || "closed"}`}>
              <optgroup label="Approved chefs at this location">
                {!approvedAssignments.length && <option disabled>No approved chefs available — add one in Chef roster</option>}
                {approvedAssignments.map((assignment) => <option key={assignment.value} value={assignment.value}>{assignment.label}</option>)}
              </optgroup>
              {pendingAssignments.length > 0 && <optgroup label="Awaiting TaGo's approval">
                {pendingAssignments.map((name) => <option key={name} disabled>{name} — not assignable yet</option>)}
              </optgroup>}
              <optgroup label="Kitchen purposes">
                <option value="purpose:open_availability">Open availability</option>
                <option value="purpose:maintenance">Maintenance</option>
                <option value="purpose:cleaning">Cleaning / sanitation</option>
                <option value="purpose:private_event">Private event</option>
                <option value="purpose:owner_use">Owner use</option>
                <option value="purpose:closed">Closed</option>
              </optgroup>
            </select>
          </label>
          <label>
            Kitchen Admin audit note
            <textarea name="admin_notes" defaultValue={editing?.notes || ""} placeholder="Example: Entered by kitchen admin after confirming Peg's Tuesday production time by phone." />
          </label>
          <label>
            Label
            <input name="title" defaultValue={editing?.title || ""} required />
          </label>
          <label>
            Equipment
            <select
              name="scope_choice"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value="whole_kitchen">Whole kitchen — exclusive</option>
              <option value="custom">
                Custom resident footprint — shared equipment
              </option>
              <option value="resource">Specific cooking equipment</option>
            </select>
          </label>
          {scope === "resource" && (
            <label>
              Select equipment
              <select name="resource_id" required defaultValue={editing?.equipment_resource_id || ""}>
                <option value="" disabled>
                  Choose equipment
                </option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {scope === "custom" && (
            <div className="custom-allocation">
              <div>
                <b>Dedicated resident footprint</b>
                <span>
                  Record assigned space and storage. Cooking equipment stays
                  shared and must be scheduled separately.
                </span>
              </div>
              <div className="provider-pair">
                <label>
                  Dedicated square feet
                  <input name="dedicated_sqft" type="number" min="0" step="1" />
                </label>
                <label>
                  Prep / table space
                  <input
                    name="table_space"
                    placeholder="Example: Table 2, 6 linear feet"
                  />
                </label>
                <label>
                  Cold storage
                  <input
                    name="cold_storage"
                    placeholder="Example: Fridge shelf A"
                  />
                </label>
                <label>
                  Dry storage
                  <input
                    name="dry_storage"
                    placeholder="Example: Rack 3, two shelves"
                  />
                </label>
              </div>
              <label>
                Allocation notes
                <textarea
                  name="allocation_notes"
                  placeholder="Access rules, dishwasher priority, shared-use limits…"
                />
              </label>
              <p className="shared-equipment-note">
                <Check /> Shared ovens, fryers, griddle and other cooking
                equipment remain bookable unless separately blocked.
              </p>
            </div>
          )}
          <label>
            Type
            <select name="kind" defaultValue={editing?.kind || "blocked"}>
              <option value="blocked">Owner blocked time</option>
              <option value="maintenance">Maintenance</option>
              <option value="resident_priority">Resident priority</option>
              <option value="available">Additional availability</option>
            </select>
          </label>
          <div className="provider-pair">
            <label>
              Starts
            <input name="starts" type="datetime-local" defaultValue={slot?.starts || ""} required />
            </label>
            <label>
              Ends
              <input name="ends" type="datetime-local" defaultValue={slot?.ends || ""} required />
            </label>
          </div>
          <button className="provider-primary">
            {editing ? <Check /> : <Plus />}
            {editing ? "Save changes" : "Add block"}
          </button>
          {editing && <button type="button" className="provider-secondary" onClick={() => { setEditing(null); setSlot(null); setScope("whole_kitchen"); }}>Cancel editing</button>}
        </form>
        <div className="provider-list">
          {blocks.map((b) => (
            <p key={b.id}>
              <span>
                <b>{b.title}</b>
                {(b.assigned_sponsored_profile_id || b.assigned_business_id) && <small className="manual-assignment-label">Assigned to {b.assigned_sponsored_profile_id ? sponsoredChefs.find((chef) => chef.id === b.assigned_sponsored_profile_id)?.business_name || "Approved chef" : brands[b.assigned_business_id || ""] || "Approved chef"} · recorded by Kitchen Admin</small>}
                {new Date(b.starts_at).toLocaleString()} •{" "}
                {b.scope === "custom"
                  ? [
                      b.custom_allocation?.dedicated_sqft
                        ? `${b.custom_allocation.dedicated_sqft} dedicated sq ft`
                        : "Custom resident footprint",
                      b.custom_allocation?.cold_storage,
                      b.custom_allocation?.dry_storage,
                      b.custom_allocation?.table_space,
                      "shared cooking equipment",
                    ]
                      .filter(Boolean)
                      .join(" • ")
                  : resources.find((r) => r.id === b.equipment_resource_id)
                      ?.name || "Whole kitchen — exclusive"}
                {b.notes && <small className="schedule-audit-note">Audit note: {b.notes}</small>}
              </span>
              <em>{b.kind.replaceAll("_", " ")}</em>
              {b.created_by === userId && <button type="button" onClick={() => { setEditing(b); setScope(b.scope); setSlot({ starts: local(new Date(b.starts_at)), ends: local(new Date(b.ends_at)) }); document.getElementById("schedule-block-form")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Edit</button>}
              {b.created_by === userId && <button
                onClick={() =>
                  run(
                    () =>
                      supabase
                        .from("availability_blocks")
                        .delete()
                        .eq("id", b.id),
                    "Block removed.",
                  )
                }
              >
                Remove
              </button>}
            </p>
          ))}
        </div>
      </Panel>
    </>
  );
}
function Operations({
  kitchenId,
  userId,
  resources,
  tickets,
  run,
}: {
  kitchenId: string;
  userId: string;
  resources: Resource[];
  tickets: Ticket[];
  run: (j: () => PromiseLike<{ error: any }>, s: string) => void;
}) {
  return (
    <>
      <Heading
        over="FACILITY OPERATIONS"
        title="Maintenance, safety & access"
        copy="Record equipment issues here. Check-in, closeout and incidents remain attached to reservations."
      />
      <Panel title="Maintenance tickets" icon={TicketCheck}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = vals(e.currentTarget);
            run(
              () =>
                supabase.from("maintenance_tickets").insert({
                  kitchen_id: kitchenId,
                  equipment_resource_id: v.resource_id || null,
                  title: v.title,
                  description: v.description || null,
                  priority: v.priority,
                  opened_by: userId,
                }),
              "Maintenance ticket opened.",
            );
            e.currentTarget.reset();
          }}
        >
          <label>
            Issue
            <input name="title" required />
          </label>
          <label>
            Description
            <textarea name="description" />
          </label>
          <label>
            Equipment
            <select name="resource_id">
              <option value="">Facility-wide</option>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select name="priority">
              <option>normal</option>
              <option>high</option>
              <option>urgent</option>
              <option>low</option>
            </select>
          </label>
          <button className="provider-primary">
            <Plus />
            Open ticket
          </button>
        </form>
        <div className="provider-list">
          {tickets.map((t) => (
            <p key={t.id}>
              <span>
                <b>{t.title}</b>
                {resources.find((r) => r.id === t.equipment_resource_id)
                  ?.name || "Facility-wide"}
              </span>
              <em>
                {t.priority} / {t.status}
              </em>
              <button
                onClick={() =>
                  run(
                    () =>
                      supabase
                        .from("maintenance_tickets")
                        .update({
                          status: t.status === "resolved" ? "open" : "resolved",
                          resolved_at:
                            t.status === "resolved"
                              ? null
                              : new Date().toISOString(),
                        })
                        .eq("id", t.id),
                    t.status === "resolved"
                      ? "Ticket reopened."
                      : "Ticket resolved.",
                  )
                }
              >
                {t.status === "resolved" ? "Reopen" : "Resolve"}
              </button>
            </p>
          ))}
        </div>
      </Panel>
    </>
  );
}
function Financials({
  invoices,
  payouts,
  bookings,
  brand,
  kitchen,
  userId,
  residentInvoices,
  residentBillingSchedules,
  sponsoredChefs,
  relationships,
  run,
}: {
  invoices: Invoice[];
  payouts: Payout[];
  bookings: Booking[];
  brand: (id: string) => string;
  kitchen: Kitchen;
  userId: string;
  residentInvoices: ResidentInvoice[];
  residentBillingSchedules: ResidentBillingSchedule[];
  sponsoredChefs: SponsoredChef[];
  relationships: ChefRelationship[];
  run: (job: () => PromiseLike<{ error: any }>, success: string) => Promise<void>;
}) {
  const residentName = (id: string) =>
    sponsoredChefs.find((chef) => chef.id === id)?.business_name || "Resident";
  const printInvoice = (invoice: ResidentInvoice) => {
    const chef = sponsoredChefs.find(
      (item) => item.id === invoice.sponsored_profile_id,
    );
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) return;
    popup.document.write(
      `<!doctype html><html><head><title>${invoice.invoice_number}</title><style>body{font-family:Arial,sans-serif;color:#171717;margin:0;padding:48px}header{display:flex;justify-content:space-between;border-bottom:5px solid #ef6c22;padding-bottom:18px}header img{width:180px;height:auto}h1{font-size:28px;margin:0}.paid{color:#187a45;font-weight:800;font-size:18px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin:36px 0}.box{border:1px solid #ddd;border-radius:12px;padding:18px}.total{font-size:22px;font-weight:800}footer{margin-top:60px;border-top:1px solid #ddd;padding-top:16px;color:#555}@media print{button{display:none}}</style></head><body><header><img src="/tagos-kitchen-logo.png" alt="TaGo's Kitchen"><div><h1>Paid Rent Invoice</h1><div>${invoice.invoice_number}</div><div class="paid">PAID</div></div></header><div class="grid"><div class="box"><b>Billed to</b><p>${chef?.business_name || "Resident"}<br>${chef?.chef_name || ""}<br>${invoice.recipient_email}</p></div><div class="box"><b>Kitchen</b><p>${kitchen.name}<br>${kitchen.address_line1}<br>${kitchen.city}, ${kitchen.region}</p></div></div><div class="box"><p><b>Billing period:</b> ${new Date(invoice.billing_period + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p><p><b>Description:</b> Resident commissary kitchen rent</p><p><b>Payment method:</b> ${invoice.payment_method || "Recorded payment"}</p><p><b>Paid:</b> ${invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString() : "—"}</p><p class="total">Amount paid: ${cash(invoice.amount_paid_cents)}</p><p>Balance due: ${cash(Math.max(0, invoice.amount_due_cents - invoice.amount_paid_cents))}</p></div><footer>TaGo's Kitchen • 100 Worrilow Street, Linwood, PA 19061<br>Thank you. This invoice confirms payment received.</footer><button onclick="window.print()">Print or save PDF</button></body></html>`,
    );
    popup.document.close();
  };
  const emailInvoice = async (invoice: ResidentInvoice) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session)
      return { error: new Error("Sign in again before emailing an invoice.") };
    const response = await fetch("/api/resident-invoices/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ invoiceId: invoice.id }),
    });
    const result = await response.json() as any;
    return {
      error: response.ok
        ? null
        : new Error(result.error || "Invoice email failed."),
    };
  };
  return (
    <>
      <Heading
        over="KITCHEN FINANCIALS"
        title="Invoices, earnings & payouts"
        copy="See what chefs owe, what the platform collected and what is owed to your kitchen."
      />
      <div className="provider-console">
        <Panel title="Recurring resident billing" icon={CalendarDays}>
          <p className="billing-intro">
            Create one schedule per resident. TaGo&apos;s will open that
            month&apos;s invoice on the selected due date without creating
            duplicates.
          </p>
          <form
            className="resident-billing-form"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget,
                f = new FormData(form),
                profile = sponsoredChefs.find(
                  (item) => item.id === f.get("sponsored_profile_id"),
                ),
                relationship = relationships.find(
                  (item) => item.sponsored_profile_id === profile?.id,
                );
              if (!profile) return;
              run(
                () =>
                  supabase.from("resident_billing_schedules").upsert(
                    {
                      kitchen_id: kitchen.id,
                      sponsored_profile_id: profile.id,
                      relationship_id: relationship?.id || null,
                      amount_cents: Math.round(Number(f.get("amount")) * 100),
                      due_day: Number(f.get("due_day")),
                      starts_on: `${String(f.get("starts_on"))}-01`,
                      ends_on: f.get("ends_on")
                        ? `${String(f.get("ends_on"))}-01`
                        : null,
                      active: true,
                      created_by: userId,
                      updated_at: new Date().toISOString(),
                    },
                    { onConflict: "sponsored_profile_id" },
                  ),
                `${profile.business_name} recurring billing saved.`,
              );
              form.reset();
            }}
          >
            <label>
              Resident
              <select name="sponsored_profile_id" required>
                <option value="">Select resident</option>
                {sponsoredChefs
                  .filter((chef) =>
                    relationships.some(
                      (r) =>
                        r.sponsored_profile_id === chef.id &&
                        r.relationship_tier === "resident" &&
                        r.access_status === "active",
                    ),
                  )
                  .map((chef) => (
                    <option key={chef.id} value={chef.id}>
                      {chef.business_name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Monthly rent
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue="500.00"
                required
              />
            </label>
            <label>
              Due day
              <input
                name="due_day"
                type="number"
                min="1"
                max="28"
                defaultValue="1"
                required
              />
            </label>
            <label>
              Starts
              <input name="starts_on" type="month" required />
            </label>
            <label>
              Ends (optional)
              <input name="ends_on" type="month" />
            </label>
            <button className="provider-primary">
              <Plus />
              Save recurring schedule
            </button>
          </form>
          {residentBillingSchedules.length ? (
            <div className="billing-schedule-list">
              {residentBillingSchedules.map((schedule) => (
                <article key={schedule.id}>
                  <div>
                    <b>{residentName(schedule.sponsored_profile_id)}</b>
                    <span>
                      {cash(schedule.amount_cents)} monthly · due on day{" "}
                      {schedule.due_day}
                    </span>
                    <small>
                      Starts{" "}
                      {new Date(
                        `${schedule.starts_on}T12:00:00`,
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                      {schedule.ends_on
                        ? ` · ends ${new Date(`${schedule.ends_on}T12:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
                        : ""}
                    </small>
                  </div>
                  <em className={schedule.active ? "active" : "paused"}>
                    {schedule.active ? "active" : "paused"}
                  </em>
                  <button
                    onClick={() =>
                      run(
                        () =>
                          supabase
                            .from("resident_billing_schedules")
                            .update({
                              active: !schedule.active,
                              updated_at: new Date().toISOString(),
                            })
                            .eq("id", schedule.id),
                        `${residentName(schedule.sponsored_profile_id)} billing ${schedule.active ? "paused" : "resumed"}.`,
                      )
                    }
                  >
                    {schedule.active ? "Pause" : "Resume"}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <Empty text="No recurring billing schedules yet." />
          )}
        </Panel>
        <Panel title="Resident rent & paid receipts" icon={FileText}>
          <form
            className="resident-invoice-form"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget,
                f = new FormData(form);
              const profile = sponsoredChefs.find(
                (item) => item.id === f.get("sponsored_profile_id"),
              );
              const relationship = relationships.find(
                (item) => item.sponsored_profile_id === profile?.id,
              );
              if (!profile) return;
              run(
                () =>
                  supabase.from("resident_invoices").insert({
                    kitchen_id: kitchen.id,
                    sponsored_profile_id: profile.id,
                    relationship_id: relationship?.id || null,
                    billing_period: `${String(f.get("billing_period"))}-01`,
                    amount_due_cents: Math.round(Number(f.get("amount")) * 100),
                    amount_paid_cents: Math.round(
                      Number(f.get("amount")) * 100,
                    ),
                    payment_method: String(f.get("payment_method")),
                    paid_at: `${String(f.get("paid_at"))}T12:00:00-04:00`,
                    status: "paid",
                    recipient_email: profile.email,
                    notes: "Resident commissary kitchen rent",
                    issued_by: userId,
                    issued_at: new Date().toISOString(),
                  }),
                `${profile.business_name} paid receipt created.`,
              );
              form.reset();
            }}
          >
            <label>
              Resident
              <select name="sponsored_profile_id" required>
                <option value="">Select resident</option>
                {sponsoredChefs.map((chef) => (
                  <option key={chef.id} value={chef.id}>
                    {chef.business_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Billing month
              <input name="billing_period" type="month" required />
            </label>
            <label>
              Amount
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue="500.00"
                required
              />
            </label>
            <label>
              Payment method
              <select name="payment_method" defaultValue="Cash">
                <option>Cash</option>
                <option>Check</option>
                <option>Zelle</option>
                <option>Card</option>
                <option>Other</option>
              </select>
            </label>
            <label>
              Paid date
              <input name="paid_at" type="date" required />
            </label>
            <button className="provider-primary">
              <Plus />
              Create paid receipt
            </button>
          </form>
          {residentInvoices.length ? (
            <div className="resident-invoice-list">
              {residentInvoices.map((invoice) => (
                <article key={invoice.id}>
                  <div>
                    <b>{invoice.invoice_number}</b>
                    <span>
                      {residentName(invoice.sponsored_profile_id)} •{" "}
                      {new Date(
                        invoice.billing_period + "T12:00:00",
                      ).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <small>
                      {invoice.status === "paid"
                        ? `${cash(invoice.amount_paid_cents)} paid by ${invoice.payment_method || "recorded payment"}`
                        : `${cash(invoice.amount_due_cents - invoice.amount_paid_cents)} due${invoice.due_at ? ` ${new Date(`${invoice.due_at}T12:00:00`).toLocaleDateString()}` : ""}`}
                      {invoice.sent_at
                        ? ` • emailed ${new Date(invoice.sent_at).toLocaleDateString()}`
                        : ""}
                    </small>
                  </div>
                  <em className={invoice.status}>{invoice.status}</em>
                  {invoice.status !== "paid" && (
                    <form
                      className="record-rent-payment"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        run(
                          () =>
                            supabase
                              .from("resident_invoices")
                              .update({
                                amount_paid_cents: invoice.amount_due_cents,
                                payment_method: String(f.get("payment_method")),
                                paid_at: `${String(f.get("paid_at"))}T12:00:00-04:00`,
                                status: "paid",
                                updated_at: new Date().toISOString(),
                              })
                              .eq("id", invoice.id),
                          `${residentName(invoice.sponsored_profile_id)} payment recorded.`,
                        );
                      }}
                    >
                      <select name="payment_method">
                        <option>Cash</option>
                        <option>Check</option>
                        <option>Zelle</option>
                        <option>Card</option>
                        <option>Other</option>
                      </select>
                      <input name="paid_at" type="date" required />
                      <button>Record paid</button>
                    </form>
                  )}
                  {invoice.status === "paid" && (
                    <button onClick={() => printInvoice(invoice)}>
                      <Download />
                      Print / PDF
                    </button>
                  )}
                  <button
                    onClick={() =>
                      run(
                        () => emailInvoice(invoice),
                        `${invoice.status === "paid" ? "Receipt" : "Invoice"} emailed to ${invoice.recipient_email}.`,
                      )
                    }
                  >
                    <Send />
                    Email {invoice.status === "paid" ? "receipt" : "invoice"}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <Empty text="No resident rent invoices yet" />
          )}
        </Panel>
        <Panel title="Booking invoices" icon={ClipboardCheck}>
          {invoices.length ? (
            <div className="provider-list">
              {invoices.map((i) => (
                <p key={i.id}>
                  <span>
                    <b>{i.invoice_number}</b>
                    {brand(
                      bookings.find((b) => b.id === i.booking_id)
                        ?.renter_business_id || "",
                    )}{" "}
                    • {cash(i.amount_paid_cents)} of {cash(i.amount_due_cents)}{" "}
                    paid
                  </span>
                  <em>{i.status}</em>
                </p>
              ))}
            </div>
          ) : (
            <Empty text="No booking invoices yet" />
          )}
        </Panel>
        <Panel title="Provider payouts" icon={CircleDollarSign}>
          {payouts.length ? (
            <div className="provider-list">
              {payouts.map((p) => (
                <p key={p.id}>
                  <span>
                    <b>{cash(p.amount_cents)}</b>
                    {p.due_at
                      ? "Due " + new Date(p.due_at).toLocaleDateString()
                      : "No due date"}
                    {p.issue_notes && " • " + p.issue_notes}
                  </span>
                  <em>{p.status}</em>
                </p>
              ))}
            </div>
          ) : (
            <Empty text="No payouts recorded yet" />
          )}
        </Panel>
      </div>
    </>
  );
}
const vals = (form: HTMLFormElement) =>
  Object.fromEntries(new FormData(form).entries());
function ChefRoster({
  kitchenId,
  userId,
  rows,
  relationships,
  documents,
  run,
}: {
  kitchenId: string;
  userId: string;
  rows: SponsoredChef[];
  relationships: ChefRelationship[];
  documents: ResidentDocument[];
  run: (job: () => PromiseLike<{ error: any }>, success: string) => Promise<void>;
}) {
  const [editingChefId, setEditingChefId] = useState<string | null>(null);
  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    await run(
      () =>
        supabase.from("sponsored_chef_profiles").insert({
          kitchen_id: kitchenId,
          created_by: userId,
          chef_name: String(f.get("chef_name") || "").trim(),
          email: String(f.get("email") || "")
            .trim()
            .toLowerCase(),
          phone: String(f.get("phone") || "") || null,
          business_name: String(f.get("business_name") || "").trim(),
          business_type: String(f.get("business_type") || "Independent chef"),
          notes: String(f.get("notes") || "") || null,
        }),
      "Chef profile created. Share the claim link so the chef can securely take ownership.",
    );
    form.reset();
  };
  const claimUrl =
    "https://www.tagoskitchen.com/account?mode=signup&returnTo=/chef";
  return (
    <>
      <Heading
        over="CHEF ROSTER"
        title="Create or invite a chef"
        copy="Help a chef get started, then let them securely claim and control their own workspace."
      />
      <div className="provider-two-col">
        <Panel title="Create a provisional Chef Passport" icon={UserPlus}>
          <form className="sponsored-chef-form" onSubmit={add}>
            <label>
              Chef&apos;s name
              <input name="chef_name" required />
            </label>
            <label>
              Email used to claim profile
              <input name="email" type="email" required />
            </label>
            <label>
              Phone
              <input name="phone" type="tel" />
            </label>
            <label>
              Business or brand name
              <input name="business_name" required />
            </label>
            <label>
              Business type
              <select name="business_type">
                <option>Independent chef</option>
                <option>Caterer</option>
                <option>Baker</option>
                <option>Meal-prep business</option>
                <option>Food truck operator</option>
                <option>Packaged-food maker</option>
              </select>
            </label>
            <label className="wide">
              Kitchen notes
              <textarea
                name="notes"
                placeholder="Relationship, expected use, onboarding needs…"
              />
            </label>
            <button>
              <UserPlus />
              Create Chef Profile
            </button>
          </form>
          <div className="claim-instructions">
            <ShieldCheck />
            <div>
              <b>Secure claim link</b>
              <span>
                The chef signs up with the same email entered above. TaGo&apos;s
                transfers the provisional profile into their independent Chef
                workspace.
              </span>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(claimUrl);
                }}
              >
                Copy claim link
              </button>
            </div>
          </div>
        </Panel>
        <Panel title="Invited and claimed chefs" icon={UsersRound}>
          {rows.length ? (
            <div className="sponsored-list">
              {rows.map((row) => editingChefId === row.id ? (
                <form
                  className="sponsored-chef-edit"
                  key={row.id}
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const f = new FormData(event.currentTarget);
                    await run(
                      () => supabase.from("sponsored_chef_profiles").update({
                        chef_name: String(f.get("chef_name") || "").trim(),
                        email: String(f.get("email") || "").trim().toLowerCase(),
                        phone: String(f.get("phone") || "").trim() || null,
                        business_name: String(f.get("business_name") || "").trim(),
                        business_type: String(f.get("business_type") || "Independent chef"),
                        notes: String(f.get("notes") || "").trim() || null,
                      }).eq("id", row.id),
                      `${row.business_name} profile updated.`,
                    );
                    setEditingChefId(null);
                  }}
                >
                  <header><b>Edit Chef Profile</b><em className={row.status}>{row.status}</em></header>
                  <div className="sponsored-edit-fields">
                    <label>Chef&apos;s name<input name="chef_name" required defaultValue={row.chef_name}/></label>
                    <label>Business or brand<input name="business_name" required defaultValue={row.business_name}/></label>
                    <label>Email<input name="email" type="email" required defaultValue={row.email}/></label>
                    <label>Phone<input name="phone" type="tel" defaultValue={row.phone || ""}/></label>
                    <label>Business type<select name="business_type" defaultValue={row.business_type}><option>Independent chef</option><option>Caterer</option><option>Baker</option><option>Meal-prep business</option><option>Food truck operator</option><option>Packaged-food maker</option></select></label>
                    <label className="wide">Kitchen notes<textarea name="notes" defaultValue={row.notes || ""}/></label>
                  </div>
                  <div className="sponsored-edit-actions"><button type="submit"><Check/>Save profile</button><button type="button" onClick={()=>setEditingChefId(null)}><X/>Cancel</button></div>
                  {row.status === "claimed" && <small className="claimed-profile-note">This updates the kitchen-managed listing. The chef keeps control of their public storefront, menu, and customer-facing content.</small>}
                </form>
              ) : (
                <article key={row.id}>
                  <div>
                    <a className="profile-jump" href={`/chef-profiles/${row.id}`} target="_blank" rel="noopener noreferrer">{row.business_name}</a>
                    <span>{row.chef_name} • {row.email}</span>
                    {row.phone && <small>{row.phone}</small>}
                    {row.notes && <small>{row.notes}</small>}
                  </div>
                  <em className={row.status}>{row.status}</em>
                  <div className="sponsored-row-actions">
                    <button onClick={()=>setEditingChefId(row.id)}>Edit profile</button>
                    {row.status === "invited" && <button onClick={() => run(() => supabase.from("sponsored_chef_profiles").update({ status: "cancelled" }).eq("id", row.id), "Invitation cancelled.")}>Cancel invite</button>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty text="No kitchen-created chef profiles yet." />
          )}
        </Panel>
      </div>
      <Panel title="Relationship, space & access" icon={ShieldCheck}>
        <p className="relationship-intro">
          Assign each chef to the kitchen&apos;s three-tier model. Use resident
          priority only for a dedicated recurring position.
        </p>
        {rows.filter((row) => row.status !== "cancelled").length ? (
          <div className="relationship-list">
            {rows
              .filter((row) => row.status !== "cancelled")
              .map((row) => {
                const current = relationships.find(
                  (r) => r.sponsored_profile_id === row.id,
                );
                return (
                  <form
                    key={`${row.id}-${current?.id || "new"}`}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget),
                        payload = {
                          kitchen_id: kitchenId,
                          sponsored_profile_id: row.id,
                          chef_business_id: current?.chef_business_id || null,
                          relationship_tier: String(f.get("tier")),
                          access_status: String(f.get("access_status")),
                          resident_priority:
                            f.get("resident_priority") === "on",
                          dedicated_sqft: f.get("dedicated_sqft")
                            ? Number(f.get("dedicated_sqft"))
                            : null,
                          cold_storage:
                            String(f.get("cold_storage") || "") || null,
                          freezer_storage:
                            String(f.get("freezer_storage") || "") || null,
                          dry_storage:
                            String(f.get("dry_storage") || "") || null,
                          table_space:
                            String(f.get("table_space") || "") || null,
                          shared_equipment_notes:
                            String(f.get("shared_equipment_notes") || "") ||
                            null,
                          starts_on: f.get("starts_on") || null,
                          ends_on: f.get("ends_on") || null,
                          internal_notes:
                            String(f.get("internal_notes") || "") || null,
                          created_by: userId,
                          updated_at: new Date().toISOString(),
                        };
                      await run(
                        () =>
                          current
                            ? supabase
                                .from("kitchen_chef_relationships")
                                .update(payload)
                                .eq("id", current.id)
                            : supabase
                                .from("kitchen_chef_relationships")
                                .insert(payload),
                        `${row.business_name} relationship saved.`,
                      );
                    }}
                  >
                    <header>
                      <div>
                        <a className="profile-jump" href={`/chef-profiles/${row.id}`} target="_blank" rel="noopener noreferrer">{row.business_name}</a>
                        <span>
                          {row.chef_name} • {row.status}
                        </span>
                      </div>
                      <em>{current?.relationship_tier || "Not assigned"}</em>
                    </header>
                    <div className="relationship-fields">
                      <label>
                        Tier
                        <select
                          name="tier"
                          defaultValue={current?.relationship_tier || "hourly"}
                        >
                          <option value="resident">Resident</option>
                          <option value="recurring">Recurring</option>
                          <option value="hourly">Hourly / Pop-Up</option>
                        </select>
                      </label>
                      <label>
                        Access
                        <select
                          name="access_status"
                          defaultValue={current?.access_status || "pending"}
                        >
                          <option value="pending">Pending</option>
                          <option value="active">Active</option>
                          <option value="paused">Paused</option>
                          <option value="ended">Ended</option>
                        </select>
                      </label>
                      <label>
                        Dedicated square feet
                        <input
                          name="dedicated_sqft"
                          type="number"
                          min="0"
                          defaultValue={current?.dedicated_sqft || ""}
                        />
                      </label>
                      <label>
                        Cold storage
                        <input
                          name="cold_storage"
                          defaultValue={current?.cold_storage || ""}
                        />
                      </label>
                      <label>
                        Freezer storage
                        <input
                          name="freezer_storage"
                          defaultValue={current?.freezer_storage || ""}
                        />
                      </label>
                      <label>
                        Dry storage
                        <input
                          name="dry_storage"
                          defaultValue={current?.dry_storage || ""}
                        />
                      </label>
                      <label>
                        Table space
                        <input
                          name="table_space"
                          defaultValue={current?.table_space || ""}
                        />
                      </label>
                      <label>
                        Starts
                        <input
                          name="starts_on"
                          type="date"
                          defaultValue={current?.starts_on || ""}
                        />
                      </label>
                      <label>
                        Ends
                        <input
                          name="ends_on"
                          type="date"
                          defaultValue={current?.ends_on || ""}
                        />
                      </label>
                      <label className="wide">
                        Shared cooking equipment
                        <input
                          name="shared_equipment_notes"
                          defaultValue={current?.shared_equipment_notes || ""}
                          placeholder="Griddle and fryers shared; dishwasher priority…"
                        />
                      </label>
                      <label className="wide">
                        Internal notes
                        <textarea
                          name="internal_notes"
                          defaultValue={current?.internal_notes || ""}
                        />
                      </label>
                      <label className="priority-check">
                        <input
                          name="resident_priority"
                          type="checkbox"
                          defaultChecked={current?.resident_priority}
                        />
                        Protect resident-priority time and capacity
                      </label>
                    </div>
                    <button className="save-relationship">
                      <Check />
                      Save relationship
                    </button>
                  </form>
                );
              })}
          </div>
        ) : (
          <Empty text="Create a Chef Profile above before assigning a kitchen relationship." />
        )}
      </Panel>
      <Panel title="Resident agreements & documents" icon={FileText}>
        <p className="relationship-intro">
          Attach signed leases, commissary agreements and other resident records
          to each Chef Profile.
        </p>
        <div className="resident-document-list">
          {rows
            .filter((row) => row.status !== "cancelled")
            .map((row) => {
              const relationship = relationships.find(
                (item) => item.sponsored_profile_id === row.id,
              );
              const attached = documents.filter(
                (item) => item.sponsored_profile_id === row.id,
              );
              return (
                <article key={row.id}>
                  <div>
                    <a className="profile-jump" href={`/chef-profiles/${row.id}`} target="_blank" rel="noopener noreferrer">{row.business_name}</a>
                    <span>
                      {row.chef_name} • {row.email}
                    </span>
                    {attached.map((document) => (
                      <button
                        key={document.id}
                        type="button"
                        onClick={async () => {
                          const { data } = await supabase.storage
                            .from("business-credentials")
                            .createSignedUrl(document.document_path, 300);
                          if (data?.signedUrl)
                            window.open(
                              data.signedUrl,
                              "_blank",
                              "noopener,noreferrer",
                            );
                        }}
                      >
                        <FileText />
                        {document.original_name}
                      </button>
                    ))}
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const input = form.elements.namedItem(
                        "document",
                      ) as HTMLInputElement;
                      const file = input.files?.[0];
                      if (!file) return;
                      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
                      const path = `${userId}/resident-agreements/${kitchenId}/${row.id}/${Date.now()}-${safe}`;
                      const uploaded = await supabase.storage
                        .from("business-credentials")
                        .upload(path, file);
                      if (uploaded.error) {
                        return run(async () => ({ error: uploaded.error }), "");
                      }
                      await run(
                        () =>
                          supabase.from("resident_documents").insert({
                            kitchen_id: kitchenId,
                            sponsored_profile_id: row.id,
                            relationship_id: relationship?.id || null,
                            document_type: "lease",
                            document_path: path,
                            original_name: file.name,
                            mime_type: file.type || "application/pdf",
                            uploaded_by: userId,
                          }),
                        `${row.business_name} agreement attached.`,
                      );
                      form.reset();
                    }}
                  >
                    <input
                      name="document"
                      type="file"
                      accept="application/pdf"
                      required
                    />
                    <button className="provider-primary">
                      <Plus />
                      Attach document
                    </button>
                  </form>
                </article>
              );
            })}
        </div>
      </Panel>
    </>
  );
}
function State({
  title,
  copy,
  href,
  action,
}: {
  title: string;
  copy?: string;
  href?: string;
  action?: string;
}) {
  return (
    <main className="host-dash-state">
      <img src="/tagos-kitchen-logo.png" alt="TaGo's Kitchen" />
      <h1>{title}</h1>
      {copy && <p>{copy}</p>}
      {href && (
        <a href={href}>
          {action}
          <ChevronRight />
        </a>
      )}
    </main>
  );
}
function Heading({
  over,
  title,
  copy,
}: {
  over: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="provider-heading">
      <p>{over}</p>
      <h1>{title}</h1>
      <span>{copy}</span>
    </div>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <article>
      <Icon />
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
  icon: typeof CalendarDays;
  children: any;
}) {
  return (
    <article className="provider-panel">
      <div className="dash-card-title">
        <Icon />
        <div>
          <p>MANAGE</p>
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </article>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="dash-empty">{text}</div>;
}
