"use client";
import { FormEvent, useEffect, useState } from "react";
import {
  AlertTriangle,
  Box,
  Building2,
  CalendarDays,
  Check,
  ChefHat,
  CircleDollarSign,
  ClipboardCheck,
  Home,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Plus,
  Search,
  RefreshCw,
  ShieldCheck,
  Store,
  Truck,
  TicketCheck,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import Breadcrumbs from "../breadcrumbs";
import BookingChangeQueue from "./booking-change-queue";
import BillingOperations from "./billing-operations";
import "./live-portal.css";
import "../booking-changes.css";
import "../billing.css";

type Tab =
  | "overview"
  | "schedule"
  | "equipment"
  | "promotions"
  | "maintenance"
  | "money"
  | "bookings"
  | "people"
  | "providers"
  | "trucks"
  | "reports";
type Kitchen = {
  id: string;
  name: string;
  slug: string;
  address_line1: string;
  city: string;
  region: string;
  active: boolean;
  contact_email: string | null;
  contact_phone: string | null;
  license_status: string;
  accepting_requests: boolean;
};
type ChefDirectoryRow = {
  record_id: string; source: "business" | "sponsored"; business_id: string | null;
  first_name: string | null; last_name: string | null; display_name: string | null;
  business_name: string; business_type: string; email: string | null; phone: string | null;
  status: string; kitchen_ids: string[]; kitchen_names: string[];
};
type Biz = {
  id: string;
  name: string;
  slug: string;
  business_type: string | null;
  compliance_status: string;
  payouts_enabled: boolean;
  stripe_account_id: string | null;
};
type Equip = {
  id: string;
  kitchen_id: string;
  name: string;
  category: string;
  hourly_rate_cents: number;
  capacity: number;
  active: boolean;
};
type Book = {
  id: string;
  kitchen_id: string;
  renter_business_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  subtotal_cents: number;
  platform_fee_cents: number;
  host_payout_cents: number;
  stripe_payment_intent_id: string | null;
  security_deposit_cents: number;
  cleaning_fee_cents: number;
};
type Block = {
  id: string;
  kitchen_id: string;
  equipment_resource_id: string | null;
  kind: string;
  title: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  created_by: string;
};
type Assignment = {
  id: string;
  kitchen_id: string;
  business_id: string;
  equipment_resource_id: string | null;
  assignment_type: string;
  visibility: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
};
type Promo = {
  id: string;
  kitchen_id: string | null;
  business_id: string | null;
  title: string;
  description: string | null;
  location_type: string;
  public_location: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
};
type Ticket = {
  id: string;
  kitchen_id: string;
  equipment_resource_id: string | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  assigned_to: string | null;
  due_at: string | null;
  cost_cents: number;
};
type Tx = {
  id: string;
  kitchen_id: string;
  booking_id: string | null;
  transaction_type: string;
  gross_cents: number;
  platform_fee_cents: number;
  provider_net_cents: number;
  status: string;
  payment_provider: string;
  external_reference: string | null;
  occurred_at: string;
};
type Payout = {
  id: string;
  kitchen_id: string;
  amount_cents: number;
  status: string;
  due_at: string | null;
  paid_at: string | null;
  provider_reference: string | null;
  issue_notes: string | null;
};
type Report = {
  id: string;
  booking_id: string | null;
  kitchen_id: string;
  incident_type: string;
  description: string;
  emergency_services_called: boolean;
  occurred_at: string;
  created_at: string;
  status: string;
  assigned_to: string | null;
  resolution_notes: string | null;
};
type KitchenApp = {
  id: string;
  kitchen_name: string;
  contact_name: string;
  contact_email: string;
  city: string;
  region: string;
  status: string;
  equipment: string[];
  license_path: string | null;
  insurance_path: string | null;
  inspection_path: string | null;
};
type Doc = {
  id: string;
  business_id: string;
  credential_type: string;
  status: string;
  document_path: string;
  expires_on: string | null;
  reviewer_note: string | null;
};
type TruckAdmin = { id:string; name:string; owner_business_id:string; base_kitchen_id:string|null; service_area:string|null; status:string; active:boolean; accepting_requests:boolean; transportation_policy:string; renter_driving_allowed:boolean };
type TruckDriverAdmin = { id:string; truck_id:string; full_name:string; active:boolean; insurance_approved:boolean; mvr_reviewed_at:string|null; truck_orientation_completed_at:string|null; license_expires_on:string|null };
type TruckDocAdmin = { id:string; truck_id:string; document_type:string; status:string; expires_on:string|null; document_path:string|null; reviewer_note:string|null };

const navItems: [Tab, typeof Home, string][] = [
  ["overview", LayoutDashboard, "Command center"],
  ["promotions", Megaphone, "Promotions"],
  ["maintenance", Wrench, "Provider issues"],
  ["money", CircleDollarSign, "Payments & payouts"],
  ["bookings", ClipboardCheck, "Booking oversight"],
  ["people", UsersRound, "Chef directory"],
  ["providers", Building2, "Kitchen directory"],
  ["trucks", Truck, "Food truck network"],
  ["reports", AlertTriangle, "Escalations & closeouts"],
];
const truckRequiredDocuments=["Mobile food-facility license","Health inspection","Commissary license / agreement","Vehicle registration","Vehicle inspection","Commercial auto insurance","General liability insurance","Fire suppression inspection","Propane / generator inspection"];
const dollars = (c: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    c / 100,
  );
const localInput = (d = new Date()) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

export default function AdminPortal() {
  const [tab, setTab] = useState<Tab>("overview"),
    [menu, setMenu] = useState(false),
    [busy, setBusy] = useState(true),
    [auth, setAuth] = useState<
      "checking" | "authorized" | "signed_out" | "denied"
    >("checking"),
    [note, setNote] = useState("");
  const [userId, setUserId] = useState(""),
    [ownerName, setOwnerName] = useState("Tony");
  const [kitchens, setKitchens] = useState<Kitchen[]>([]),
    [biz, setBiz] = useState<Biz[]>([]),
    [equipment, setEquipment] = useState<Equip[]>([]),
    [books, setBooks] = useState<Book[]>([]),
    [blocks, setBlocks] = useState<Block[]>([]),
    [assignments, setAssignments] = useState<Assignment[]>([]),
    [promos, setPromos] = useState<Promo[]>([]),
    [tickets, setTickets] = useState<Ticket[]>([]),
    [txs, setTxs] = useState<Tx[]>([]),
    [payouts, setPayouts] = useState<Payout[]>([]),
    [reports, setReports] = useState<Report[]>([]),
    [apps, setApps] = useState<KitchenApp[]>([]),
    [docs, setDocs] = useState<Doc[]>([]);
  const [foodTrucks,setFoodTrucks]=useState<TruckAdmin[]>([]),[truckDrivers,setTruckDrivers]=useState<TruckDriverAdmin[]>([]),[truckDocs,setTruckDocs]=useState<TruckDocAdmin[]>([]);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [chefs, setChefs] = useState<ChefDirectoryRow[]>([]);
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryStatus, setDirectoryStatus] = useState("all");
  const [chefSort, setChefSort] = useState("last_name");
  const [editingChef, setEditingChef] = useState<ChefDirectoryRow | null>(null);
  const [editingKitchen, setEditingKitchen] = useState<Kitchen | null>(null);
  const load = async () => {
    setBusy(true);
    const qs = await Promise.all([
      supabase
        .from("kitchens")
        .select("id,name,slug,address_line1,city,region,active,contact_email,contact_phone,license_status,accepting_requests")
        .order("created_at"),
      supabase
        .from("businesses")
        .select(
          "id,name,slug,business_type,compliance_status,payouts_enabled,stripe_account_id",
        )
        .order("created_at"),
      supabase
        .from("equipment_resources")
        .select("*")
        .is("archived_at", null)
        .order("name"),
      supabase
        .from("bookings")
        .select(
          "id,kitchen_id,renter_business_id,starts_at,ends_at,status,subtotal_cents,platform_fee_cents,host_payout_cents,stripe_payment_intent_id,security_deposit_cents,cleaning_fee_cents",
        )
        .order("starts_at", { ascending: false }),
      supabase.from("availability_blocks").select("*").order("starts_at"),
      supabase.from("chef_assignments").select("*").order("starts_at"),
      supabase
        .from("promotions")
        .select("*")
        .order("starts_at", { ascending: false }),
      supabase
        .from("maintenance_tickets")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("booking_transactions")
        .select("*")
        .order("occurred_at", { ascending: false }),
      supabase
        .from("provider_payouts")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("incident_reports")
        .select(
          "id,booking_id,kitchen_id,incident_type,description,emergency_services_called,occurred_at,created_at,status,assigned_to,resolution_notes",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("kitchen_applications")
        .select(
          "id,kitchen_name,contact_name,contact_email,city,region,status,equipment,license_path,insurance_path,inspection_path",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("credentials")
        .select(
          "id,business_id,credential_type,status,document_path,expires_on,reviewer_note",
        )
        .order("created_at", { ascending: false }),
      supabase.rpc("admin_list_chefs"),
      supabase.from("food_trucks").select("id,name,owner_business_id,base_kitchen_id,service_area,status,active,accepting_requests,transportation_policy,renter_driving_allowed").order("name"),
      supabase.from("food_truck_drivers").select("id,truck_id,full_name,active,insurance_approved,mvr_reviewed_at,truck_orientation_completed_at,license_expires_on"),
      supabase.from("food_truck_documents").select("id,truck_id,document_type,status,expires_on,document_path,reviewer_note"),
    ]);
    setKitchens((qs[0].data || []) as Kitchen[]);
    setBiz((qs[1].data || []) as Biz[]);
    setEquipment((qs[2].data || []) as Equip[]);
    setBooks((qs[3].data || []) as Book[]);
    setBlocks((qs[4].data || []) as Block[]);
    setAssignments((qs[5].data || []) as Assignment[]);
    setPromos((qs[6].data || []) as Promo[]);
    setTickets((qs[7].data || []) as Ticket[]);
    setTxs((qs[8].data || []) as Tx[]);
    setPayouts((qs[9].data || []) as Payout[]);
    setReports((qs[10].data || []) as Report[]);
    setApps((qs[11].data || []) as KitchenApp[]);
    setDocs((qs[12].data || []) as Doc[]);
    setChefs((qs[13].data || []) as ChefDirectoryRow[]);
    setFoodTrucks((qs[14].data||[]) as TruckAdmin[]);
    setTruckDrivers((qs[15].data||[]) as TruckDriverAdmin[]);
    setTruckDocs((qs[16].data||[]) as TruckDocAdmin[]);
    const err = qs.find((q) => q.error)?.error;
    if (err) setNote(err.message);
    setBusy(false);
  };
  useEffect(() => {
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setAuth("signed_out");
        setBusy(false);
        return;
      }
      const { data: staff } = await supabase
        .from("platform_staff")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!staff) {
        setAuth("denied");
        setBusy(false);
        return;
      }
      setUserId(user.id);
      setOwnerName(
        user.user_metadata?.full_name || user.email?.split("@")[0] || "Tony",
      );
      setAuth("authorized");
      await load();
    };
    check();
    const { data } = supabase.auth.onAuthStateChange(() =>
      setTimeout(check, 0),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  const act = async (fn: () => PromiseLike<{ error: any }>, success: string) => {
    setNote("");
    const { error } = await fn();
    if (error) {
      setNote(error.message);
      return;
    }
    setNote(success);
    await load();
  };
  const openDocument = async (bucket: string, path: string | null) => {
    if (!path) {
      setNote("No document was submitted.");
      return;
    }
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 120);
    if (error || !data?.signedUrl) {
      setNote(error?.message || "Document could not be opened.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };
  const values = (e: FormEvent<HTMLFormElement>) =>
    Object.fromEntries(new FormData(e.currentTarget).entries());
  const kname = (id: string | null) =>
    kitchens.find((k) => k.id === id)?.name || "Network";
  const bname = (id: string | null) =>
    biz.find((b) => b.id === id)?.name || "Private business";
  const ename = (id: string | null) =>
    equipment.find((e) => e.id === id)?.name || "All resources";
  const filteredChefs = chefs
    .filter((chef) => directoryStatus === "all" || chef.status === directoryStatus)
    .filter((chef) => `${chef.display_name || ""} ${chef.business_name} ${chef.email || ""} ${(chef.kitchen_names || []).join(" ")}`.toLowerCase().includes(directorySearch.toLowerCase()))
    .sort((a, b) => {
      const av = chefSort === "kitchen" ? (a.kitchen_names?.[0] || "") : chefSort === "business" ? a.business_name : chefSort === "first_name" ? (a.first_name || "") : (a.last_name || a.display_name || "");
      const bv = chefSort === "kitchen" ? (b.kitchen_names?.[0] || "") : chefSort === "business" ? b.business_name : chefSort === "first_name" ? (b.first_name || "") : (b.last_name || b.display_name || "");
      return av.localeCompare(bv);
    });
  const filteredKitchens = kitchens
    .filter((k) => directoryStatus === "all" || (directoryStatus === "active" ? k.active : !k.active))
    .filter((k) => `${k.name} ${k.city} ${k.region} ${k.contact_email || ""}`.toLowerCase().includes(directorySearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  const upcoming = [
    ...assignments.map((a) => ({ ...a, row: "assignment" })),
    ...blocks.map((b) => ({ ...b, row: "block" })),
  ]
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))
    .filter((x) => new Date(x.ends_at) > new Date());
  const collected = txs
    .filter((x) => x.status === "succeeded")
    .reduce((s, x) => s + x.gross_cents, 0);
  const fees = txs
    .filter((x) => x.status === "succeeded")
    .reduce((s, x) => s + x.platform_fee_cents, 0);
  const outstanding = payouts
    .filter((x) =>
      ["pending", "scheduled", "held", "failed"].includes(x.status),
    )
    .reduce((s, x) => s + x.amount_cents, 0);
  const todayBooks = books.filter(
    (x) => new Date(x.starts_at).toDateString() === new Date().toDateString(),
  );

  if (auth === "checking")
    return <AuthState title="Checking administrator access…" />;
  if (auth === "signed_out")
    return (
      <AuthState
        title="Administrator login"
        copy="Sign in with the TaGo's owner account."
        login
      />
    );
  if (auth === "denied")
    return (
      <AuthState
        title="Owner access only"
        copy="This account is not authorized for the command center."
        switchAccount
      />
    );
  return (
    <main className="ops-admin">
      <aside className={menu ? "open" : ""}>
        <div className="ops-logo">
          <a href="/">
            <img src="/tagos-kitchen-logo.png" alt="TaGo's Kitchen" />
          </a>
          <button onClick={() => setMenu(false)} aria-label="Close menu">
            <X />
          </button>
        </div>
        <nav>
          {navItems.map(([key, Icon, label]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => {
                setTab(key);
                setMenu(false);
                setDirectorySearch("");
                setDirectoryStatus("all");
              }}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <div className="ops-user">
          <b>{ownerName}</b>
          <span>Owner administrator</span>
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
      <section>
        <header>
          <button
            className="ops-menu"
            onClick={() => setMenu(true)}
            aria-label="Open menu"
          >
            <Menu />
          </button>
          <div>
            <b>TaGo&apos;s Kitchen Platform</b>
            <span>Network command center</span>
          </div>
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
            { label: "Admin", href: "/admin" },
            navItems.find((x) => x[0] === tab)?.[2] || "Command center",
          ]}
        />
        {note && (
          <div className="ops-note">
            <Check />
            {note}
            <button onClick={() => setNote("")}>×</button>
          </div>
        )}
        {busy ? (
          <div className="ops-loading">Loading live operations…</div>
        ) : (
          <div className="ops-content">
            {tab === "overview" && (
              <>
                <Heading
                  over="OWNER COMMAND CENTER"
                  title="Run the whole marketplace"
                  copy="Work the exceptions first, then manage capacity, money and growth."
                />
                <div className="metrics">
                  <Metric
                    label="Today’s bookings"
                    value={String(todayBooks.length)}
                    detail="Confirmed and pending"
                  />
                  <Metric
                    label="Open maintenance"
                    value={String(
                      tickets.filter(
                        (t) => !["resolved", "closed"].includes(t.status),
                      ).length,
                    )}
                    detail="Across all providers"
                  />
                  <Metric
                    label="Rent collected"
                    value={dollars(collected)}
                    detail="Recorded successful transactions"
                  />
                  <Metric
                    label="Payouts outstanding"
                    value={dollars(outstanding)}
                    detail="Pending, held or failed"
                  />
                </div>
                <div className="ops-grid">
                  <Panel title="Needs attention" icon={AlertTriangle}>
                    {[
                      [
                        apps.filter((a) => a.status === "submitted").length,
                        "Kitchen applications",
                      ],
                      [
                        biz.filter((b) => b.compliance_status === "submitted")
                          .length,
                        "Chef approvals",
                      ],
                      [
                        tickets.filter(
                          (t) =>
                            t.priority === "urgent" &&
                            !["resolved", "closed"].includes(t.status),
                        ).length,
                        "Urgent tickets",
                      ],
                      [
                        payouts.filter((p) =>
                          ["held", "failed"].includes(p.status),
                        ).length,
                        "Payout issues",
                      ],
                    ].map(([n, l]) => (
                      <button
                        className="action-row"
                        key={String(l)}
                        onClick={() =>
                          setTab(
                            l === "Kitchen applications"
                              ? "providers"
                              : l === "Chef approvals"
                                ? "people"
                                : l === "Urgent tickets"
                                  ? "maintenance"
                                  : "money",
                          )
                        }
                      >
                        <b>{n}</b>
                        <span>{l}</span>→
                      </button>
                    ))}
                  </Panel>
                  <Panel title="Three-tier kitchen capacity" icon={ChefHat}>
                    <p>
                      Every kitchen controls its own openings while protecting
                      resident priority before releasing other capacity.
                    </p>
                    <div className="resident-slots">
                      <span>
                        Tier 1 <b>Resident placement</b>
                      </span>
                      <span>
                        Tier 2 <b>Recurring production</b>
                      </span>
                      <span className="open">
                        Tier 3 <b>Flexible booking</b>
                      </span>
                    </div>
                  </Panel>
                </div>
              </>
            )}

            {tab === "schedule" && (
              <>
                <Heading
                  over="CAPACITY CONTROL"
                  title="Schedule & assignments"
                  copy="Block time, protect residents and assign approved chef businesses."
                />
                <div className="ops-grid">
                  <Panel title="Assign a chef" icon={ChefHat}>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const v = values(e);
                        act(
                          () =>
                            supabase.from("chef_assignments").insert({
                              kitchen_id: v.kitchen_id,
                              business_id: v.business_id,
                              equipment_resource_id:
                                v.equipment_resource_id || null,
                              assignment_type: v.assignment_type,
                              visibility: v.visibility,
                              starts_at: new Date(
                                String(v.starts_at),
                              ).toISOString(),
                              ends_at: new Date(
                                String(v.ends_at),
                              ).toISOString(),
                              notes: v.notes || null,
                              created_by: userId,
                            }),
                          "Chef assignment added.",
                        );
                        e.currentTarget.reset();
                      }}
                    >
                      <Select
                        name="kitchen_id"
                        label="Kitchen"
                        items={kitchens.map((k) => [k.id, k.name])}
                      />
                      <Select
                        name="business_id"
                        label="Chef / brand"
                        items={biz
                          .filter(
                            (b) =>
                              b.slug !== "tagos-kitchen" &&
                              b.compliance_status === "approved",
                          )
                          .map((b) => [b.id, b.name])}
                      />
                      <Select
                        name="equipment_resource_id"
                        label="Equipment (optional)"
                        optional
                        items={equipment
                          .filter((e) => e.active)
                          .map((e) => [e.id, e.name])}
                      />
                      <div className="form-pair">
                        <Select
                          name="assignment_type"
                          label="Assignment"
                          items={[
                            ["resident", "Resident"],
                            ["flex", "Flexible"],
                            ["event", "Event"],
                          ]}
                        />
                        <Select
                          name="visibility"
                          label="Inner schedule display"
                          items={[
                            ["business_name", "Show brand"],
                            ["blocked_only", "Show blocked only"],
                          ]}
                        />
                      </div>
                      <DatePair />
                      <label>
                        Admin notes
                        <textarea name="notes" />
                      </label>
                      <button className="primary">
                        <Plus />
                        Assign time
                      </button>
                    </form>
                  </Panel>
                  <Panel title="Block or reserve capacity" icon={CalendarDays}>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const v = values(e);
                        act(
                          () =>
                            supabase.from("availability_blocks").insert({
                              kitchen_id: v.kitchen_id,
                              equipment_resource_id:
                                v.equipment_resource_id || null,
                              scope: v.equipment_resource_id
                                ? "resource"
                                : "whole_kitchen",
                              kind: v.kind,
                              title: v.title,
                              starts_at: new Date(
                                String(v.starts_at),
                              ).toISOString(),
                              ends_at: new Date(
                                String(v.ends_at),
                              ).toISOString(),
                              notes: v.notes || null,
                              created_by: userId,
                            }),
                          "Availability updated.",
                        );
                        e.currentTarget.reset();
                      }}
                    >
                      <Select
                        name="kitchen_id"
                        label="Kitchen"
                        items={kitchens.map((k) => [k.id, k.name])}
                      />
                      <Select
                        name="equipment_resource_id"
                        label="Equipment (optional)"
                        optional
                        items={equipment
                          .filter((e) => e.active)
                          .map((e) => [e.id, e.name])}
                      />
                      <Select
                        name="kind"
                        label="Type"
                        items={[
                          ["available", "Available"],
                          ["blocked", "Blocked"],
                          ["resident_priority", "Resident priority"],
                          ["maintenance", "Maintenance"],
                        ]}
                      />
                      <label>
                        Label
                        <input
                          name="title"
                          required
                          placeholder="Deep clean, resident priority…"
                        />
                      </label>
                      <DatePair />
                      <button className="primary">
                        <Plus />
                        Add to schedule
                      </button>
                    </form>
                  </Panel>
                </div>
                {editingBlock && (
                  <Panel title="Edit calendar block" icon={CalendarDays}>
                    <form
                      key={editingBlock.id}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const v = values(e);
                        act(
                          () => supabase.from("availability_blocks").update({
                            title: v.title,
                            kind: v.kind,
                            equipment_resource_id: v.equipment_resource_id || null,
                            scope: v.equipment_resource_id ? "resource" : "whole_kitchen",
                            starts_at: new Date(String(v.starts_at)).toISOString(),
                            ends_at: new Date(String(v.ends_at)).toISOString(),
                            notes: v.notes || null,
                          }).eq("id", editingBlock.id),
                          "Calendar block updated.",
                        );
                        setEditingBlock(null);
                      }}
                    >
                      <div className="admin-form-grid">
                        <label>Label<input name="title" required defaultValue={editingBlock.title} /></label>
                        <Select name="kind" label="Type" items={[[editingBlock.kind,editingBlock.kind.replaceAll("_"," ")],...["available","blocked","resident_priority","maintenance"].filter((kind) => kind !== editingBlock.kind).map((kind) => [kind,kind.replaceAll("_"," ")])]} />
                        <Select name="equipment_resource_id" label="Equipment (optional)" optional items={[...(editingBlock.equipment_resource_id ? [[editingBlock.equipment_resource_id, equipment.find((item) => item.id === editingBlock.equipment_resource_id)?.name || "Selected equipment"]] : []),...equipment.filter((item) => item.kitchen_id === editingBlock.kitchen_id && item.active && item.id !== editingBlock.equipment_resource_id).map((item) => [item.id,item.name])]} />
                        <label>Starts<input name="starts_at" type="datetime-local" required defaultValue={localInput(new Date(editingBlock.starts_at))} /></label>
                        <label>Ends<input name="ends_at" type="datetime-local" required defaultValue={localInput(new Date(editingBlock.ends_at))} /></label>
                        <label>Admin notes<textarea name="notes" defaultValue={editingBlock.notes || ""} /></label>
                      </div>
                      <div className="admin-edit-actions"><button className="primary"><Check />Save changes</button><button type="button" onClick={() => setEditingBlock(null)}>Cancel</button></div>
                    </form>
                  </Panel>
                )}
                <Panel title="Upcoming internal schedule" icon={CalendarDays}>
                  {upcoming.length ? (
                    <div className="data-list">
                      {upcoming.map((x: any) => (
                        <article key={x.row + x.id}>
                          <div>
                            <b>
                              {x.row === "assignment"
                                ? bname(x.business_id)
                                : x.title}
                            </b>
                            <span>
                              {kname(x.kitchen_id)} •{" "}
                              {ename(x.equipment_resource_id)} •{" "}
                              {new Date(x.starts_at).toLocaleString()}
                            </span>
                          </div>
                          <em>
                            {x.row === "assignment"
                              ? x.assignment_type
                              : x.kind}
                          </em>
                          {x.row === "block" && <button onClick={() => setEditingBlock(blocks.find((block) => block.id === x.id) || null)}>Edit</button>}
                          <button
                            onClick={() =>
                              act(
                                () =>
                                  supabase
                                    .from(
                                      x.row === "assignment"
                                        ? "chef_assignments"
                                        : "availability_blocks",
                                    )
                                    .delete()
                                    .eq("id", x.id),
                                "Schedule entry removed.",
                              )
                            }
                          >
                            Remove
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <Empty text="No upcoming assignments or blocks" />
                  )}
                </Panel>
              </>
            )}

            {tab === "equipment" && (
              <>
                <Heading
                  over="ASSET CONTROL"
                  title="Equipment & rentable capacity"
                  copy="Add, price, pause or retire every resource at every kitchen."
                />
                <div className="ops-grid">
                  <Panel title="Add equipment" icon={Plus}>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const v = values(e);
                        act(
                          () =>
                            supabase.from("equipment_resources").insert({
                              kitchen_id: v.kitchen_id,
                              name: v.name,
                              category: v.category,
                              hourly_rate_cents: Math.round(
                                Number(v.rate) * 100,
                              ),
                              capacity: Number(v.capacity),
                              active: true,
                            }),
                          "Equipment added.",
                        );
                        e.currentTarget.reset();
                      }}
                    >
                      <Select
                        name="kitchen_id"
                        label="Kitchen"
                        items={kitchens.map((k) => [k.id, k.name])}
                      />
                      <label>
                        Equipment name
                        <input
                          name="name"
                          required
                          placeholder="Convection oven"
                        />
                      </label>
                      <label>
                        Category
                        <input
                          name="category"
                          required
                          placeholder="oven, prep, storage…"
                        />
                      </label>
                      <div className="form-pair">
                        <label>
                          Hourly rate
                          <input
                            name="rate"
                            type="number"
                            min="0"
                            step=".01"
                            defaultValue="0"
                          />
                        </label>
                        <label>
                          Capacity
                          <input
                            name="capacity"
                            type="number"
                            min="1"
                            defaultValue="1"
                          />
                        </label>
                      </div>
                      <button className="primary">
                        <Plus />
                        Add equipment
                      </button>
                    </form>
                  </Panel>
                  <Panel title="Asset controls" icon={Box}>
                    <div className="data-list compact">
                      {equipment.map((e) => (
                        <article key={e.id}>
                          <div>
                            <b>{e.name}</b>
                            <span>
                              {kname(e.kitchen_id)} • {e.category} • capacity{" "}
                              {e.capacity} • {dollars(e.hourly_rate_cents)}/hr
                            </span>
                          </div>
                          <em className={e.active ? "good" : "bad"}>
                            {e.active ? "Active" : "Retired"}
                          </em>
                          <button
                            onClick={() =>
                              act(
                                () =>
                                  supabase
                                    .from("equipment_resources")
                                    .update({ active: !e.active })
                                    .eq("id", e.id),
                                e.active
                                  ? "Equipment retired and removed from availability."
                                  : "Equipment reactivated.",
                              )
                            }
                          >
                            {e.active ? "Retire" : "Reactivate"}
                          </button>
                        </article>
                      ))}
                    </div>
                  </Panel>
                </div>
              </>
            )}

            {tab === "promotions" && (
              <>
                <Heading
                  over="PUBLIC CALENDAR"
                  title="Promotional events"
                  copy="Only published promotions appear publicly; operational schedules stay private."
                />
                <div className="ops-grid">
                  <Panel title="Create promotion" icon={Megaphone}>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const v = values(e);
                        act(
                          () =>
                            supabase.from("promotions").insert({
                              kitchen_id: v.kitchen_id || null,
                              business_id: v.business_id || null,
                              title: v.title,
                              description: v.description || null,
                              location_type: v.location_type,
                              public_location: v.public_location || null,
                              starts_at: new Date(
                                String(v.starts_at),
                              ).toISOString(),
                              ends_at: new Date(
                                String(v.ends_at),
                              ).toISOString(),
                              status: v.status,
                              created_by: userId,
                            }),
                          "Promotion saved.",
                        );
                        e.currentTarget.reset();
                      }}
                    >
                      <Select
                        name="business_id"
                        label="Featured chef / brand"
                        optional
                        items={biz.map((b) => [b.id, b.name])}
                      />
                      <Select
                        name="kitchen_id"
                        label="Kitchen (optional)"
                        optional
                        items={kitchens.map((k) => [k.id, k.name])}
                      />
                      <label>
                        Headline
                        <input
                          name="title"
                          required
                          placeholder="Chef Larry’s cheesesteak pickup"
                        />
                      </label>
                      <label>
                        Description
                        <textarea name="description" />
                      </label>
                      <Select
                        name="location_type"
                        label="Location type"
                        items={[
                          ["tagos", "Pickup at TaGo's"],
                          ["food_truck", "TaGo's food truck"],
                          ["offsite", "Independent offsite location"],
                        ]}
                      />
                      <label>
                        Public location
                        <input
                          name="public_location"
                          placeholder="Use only the real event address"
                        />
                      </label>
                      <DatePair />
                      <Select
                        name="status"
                        label="Publication"
                        items={[
                          ["draft", "Draft"],
                          ["scheduled", "Scheduled"],
                          ["published", "Publish now"],
                        ]}
                      />
                      <button className="primary">
                        <Plus />
                        Save promotion
                      </button>
                    </form>
                  </Panel>
                  <Panel title="Promotion controls" icon={Megaphone}>
                    {promos.length ? (
                      <div className="data-list compact">
                        {promos.map((p) => (
                          <article key={p.id}>
                            <div>
                              <b>{p.title}</b>
                              <span>
                                {bname(p.business_id)} •{" "}
                                {p.location_type.replaceAll("_", " ")} •{" "}
                                {new Date(p.starts_at).toLocaleString()}
                              </span>
                            </div>
                            <em>{p.status}</em>
                            <button
                              onClick={() =>
                                act(
                                  () =>
                                    supabase
                                      .from("promotions")
                                      .update({
                                        status:
                                          p.status === "published"
                                            ? "draft"
                                            : "published",
                                      })
                                      .eq("id", p.id),
                                  p.status === "published"
                                    ? "Promotion unpublished."
                                    : "Promotion published.",
                                )
                              }
                            >
                              {p.status === "published"
                                ? "Unpublish"
                                : "Publish"}
                            </button>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Empty text="No promotions yet" />
                    )}
                  </Panel>
                </div>
              </>
            )}

            {tab === "maintenance" && (
              <>
                <Heading
                  over="FACILITY CARE"
                  title="Maintenance tickets"
                  copy="Track outages, vendor work, costs and equipment availability."
                />
                <div className="ops-grid">
                  <Panel title="Open a ticket" icon={Wrench}>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const v = values(e);
                        act(
                          () =>
                            supabase.from("maintenance_tickets").insert({
                              kitchen_id: v.kitchen_id,
                              equipment_resource_id:
                                v.equipment_resource_id || null,
                              title: v.title,
                              description: v.description || null,
                              priority: v.priority,
                              assigned_to: v.assigned_to || null,
                              due_at: v.due_at
                                ? new Date(String(v.due_at)).toISOString()
                                : null,
                              cost_cents: Math.round(Number(v.cost || 0) * 100),
                              opened_by: userId,
                            }),
                          "Maintenance ticket opened.",
                        );
                        e.currentTarget.reset();
                      }}
                    >
                      <Select
                        name="kitchen_id"
                        label="Kitchen"
                        items={kitchens.map((k) => [k.id, k.name])}
                      />
                      <Select
                        name="equipment_resource_id"
                        label="Equipment (optional)"
                        optional
                        items={equipment.map((e) => [e.id, e.name])}
                      />
                      <label>
                        Issue
                        <input
                          name="title"
                          required
                          placeholder="Fryer thermostat inconsistent"
                        />
                      </label>
                      <label>
                        Description
                        <textarea name="description" />
                      </label>
                      <div className="form-pair">
                        <Select
                          name="priority"
                          label="Priority"
                          items={[
                            ["normal", "Normal"],
                            ["high", "High"],
                            ["urgent", "Urgent"],
                            ["low", "Low"],
                          ]}
                        />
                        <label>
                          Assigned vendor / person
                          <input name="assigned_to" />
                        </label>
                      </div>
                      <div className="form-pair">
                        <label>
                          Due
                          <input name="due_at" type="datetime-local" />
                        </label>
                        <label>
                          Expected cost
                          <input name="cost" type="number" min="0" step=".01" />
                        </label>
                      </div>
                      <button className="primary">
                        <Plus />
                        Open ticket
                      </button>
                    </form>
                  </Panel>
                  <Panel title="Ticket queue" icon={TicketCheck}>
                    {tickets.length ? (
                      <div className="data-list compact">
                        {tickets.map((t) => (
                          <article key={t.id}>
                            <div>
                              <b>{t.title}</b>
                              <span>
                                {kname(t.kitchen_id)} •{" "}
                                {ename(t.equipment_resource_id)} •{" "}
                                {t.assigned_to || "Unassigned"} •{" "}
                                {dollars(t.cost_cents)}
                              </span>
                            </div>
                            <em
                              className={t.priority === "urgent" ? "bad" : ""}
                            >
                              {t.priority} / {t.status}
                            </em>
                            <button
                              onClick={() =>
                                act(
                                  () =>
                                    supabase
                                      .from("maintenance_tickets")
                                      .update({
                                        status:
                                          t.status === "resolved"
                                            ? "open"
                                            : "resolved",
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
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Empty text="No maintenance tickets" />
                    )}
                  </Panel>
                </div>
              </>
            )}

            {tab === "money" && (
              <>
                <Heading
                  over="FINANCIAL CONTROL"
                  title="Rent, fees & provider payouts"
                  copy="Issue real invoices, record funds received and control provider payouts. Stripe automation remains off until connected."
                />
                <div className="metrics">
                  <Metric
                    label="Gross collected"
                    value={dollars(collected)}
                    detail="Succeeded ledger entries"
                  />
                  <Metric
                    label="Platform fees"
                    value={dollars(fees)}
                    detail="Marketplace revenue"
                  />
                  <Metric
                    label="Provider balance"
                    value={dollars(outstanding)}
                    detail="Unpaid or held"
                  />
                  <Metric
                    label="Payment automation"
                    value={
                      biz.some((b) => b.stripe_account_id)
                        ? "Connected"
                        : "Not connected"
                    }
                    detail="Stripe Connect status"
                  />
                </div>
                <BillingOperations
                  bookings={books}
                  label={(id) => {
                    const b = books.find((x) => x.id === id);
                    return b
                      ? `${bname(b.renter_business_id)} • ${kname(b.kitchen_id)}`
                      : "Booking";
                  }}
                  onNotice={setNote}
                  onRefresh={load}
                />
                <div className="ops-grid">
                  <Panel title="Other financial entry" icon={CircleDollarSign}>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const v = values(e),
                          gross = Math.round(Number(v.gross) * 100),
                          fee = Math.round(Number(v.fee) * 100);
                        act(
                          () =>
                            supabase.from("booking_transactions").insert({
                              kitchen_id: v.kitchen_id,
                              booking_id: v.booking_id || null,
                              transaction_type: v.transaction_type,
                              gross_cents: gross,
                              platform_fee_cents: fee,
                              provider_net_cents: gross - fee,
                              status: v.status,
                              payment_provider: v.payment_provider,
                              external_reference: v.external_reference || null,
                              notes: v.notes || null,
                              created_by: userId,
                            }),
                          "Financial entry recorded.",
                        );
                        e.currentTarget.reset();
                      }}
                    >
                      <Select
                        name="kitchen_id"
                        label="Kitchen provider"
                        items={kitchens.map((k) => [k.id, k.name])}
                      />
                      <Select
                        name="booking_id"
                        label="Booking (optional)"
                        optional
                        items={books.map((b) => [
                          b.id,
                          bname(b.renter_business_id) +
                            " • " +
                            new Date(b.starts_at).toLocaleDateString(),
                        ])}
                      />
                      <Select
                        name="transaction_type"
                        label="Entry type"
                        items={[
                          ["refund", "Processed refund"],
                          ["adjustment", "Adjustment"],
                          ["cleaning_fee", "Cleaning fee"],
                          ["damage_fee", "Damage fee"],
                        ]}
                      />
                      <div className="form-pair">
                        <label>
                          Gross amount
                          <input
                            name="gross"
                            type="number"
                            min="0"
                            step=".01"
                            required
                          />
                        </label>
                        <label>
                          Platform fee
                          <input
                            name="fee"
                            type="number"
                            min="0"
                            step=".01"
                            defaultValue="0"
                          />
                        </label>
                      </div>
                      <div className="form-pair">
                        <Select
                          name="status"
                          label="Status"
                          items={[
                            ["pending", "Pending"],
                            ["succeeded", "Succeeded"],
                            ["failed", "Failed"],
                            ["refunded", "Refunded"],
                            ["disputed", "Disputed"],
                          ]}
                        />
                        <Select
                          name="payment_provider"
                          label="Recorded via"
                          items={[
                            ["manual", "Manual"],
                            ["stripe", "Stripe"],
                            ["cash", "Cash"],
                            ["other", "Other"],
                          ]}
                        />
                      </div>
                      <label>
                        Reference
                        <input name="external_reference" />
                      </label>
                      <button className="primary">
                        <Plus />
                        Record entry
                      </button>
                    </form>
                  </Panel>
                  <Panel title="Provider payout queue" icon={CircleDollarSign}>
                    {payouts.length ? (
                      <div className="data-list compact">
                        {payouts.map((p) => (
                          <article key={p.id}>
                            <div>
                              <b>
                                {kname(p.kitchen_id)} •{" "}
                                {dollars(p.amount_cents)}
                              </b>
                              <span>
                                {p.provider_reference ||
                                  "No external reference"}{" "}
                                {p.issue_notes && "• " + p.issue_notes}
                              </span>
                            </div>
                            <em
                              className={
                                ["failed", "held"].includes(p.status)
                                  ? "bad"
                                  : p.status === "paid"
                                    ? "good"
                                    : ""
                              }
                            >
                              {p.status}
                            </em>
                            <button
                              onClick={() =>
                                act(
                                  () =>
                                    supabase
                                      .from("provider_payouts")
                                      .update({
                                        status:
                                          p.status === "paid" ? "held" : "paid",
                                        paid_at:
                                          p.status === "paid"
                                            ? null
                                            : new Date().toISOString(),
                                      })
                                      .eq("id", p.id),
                                  p.status === "paid"
                                    ? "Payout placed on hold."
                                    : "Payout marked paid.",
                                )
                              }
                            >
                              {p.status === "paid" ? "Hold" : "Mark paid"}
                            </button>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Empty text="No provider payouts recorded" />
                    )}
                    <h3>Transaction ledger</h3>
                    {txs.length ? (
                      <div className="mini-ledger">
                        {txs.slice(0, 12).map((t) => (
                          <p key={t.id}>
                            <span>
                              {t.transaction_type.replaceAll("_", " ")} •{" "}
                              {kname(t.kitchen_id)}
                            </span>
                            <b>{dollars(t.gross_cents)}</b>
                            <em>{t.status}</em>
                          </p>
                        ))}
                      </div>
                    ) : (
                      <Empty text="No financial transactions recorded" />
                    )}
                  </Panel>
                </div>
              </>
            )}

            {tab === "bookings" && (
              <>
                <Heading
                  over="RENTAL OPERATIONS"
                  title="Bookings"
                  copy="Review every reservation, payment state and host payout."
                />
                <Panel title="Booking queue" icon={ClipboardCheck}>
                  {books.length ? (
                    <div className="data-list">
                      {books.map((b) => (
                        <article key={b.id}>
                          <div>
                            <b>{bname(b.renter_business_id)}</b>
                            <span>
                              {kname(b.kitchen_id)} •{" "}
                              {new Date(b.starts_at).toLocaleString()} –{" "}
                              {new Date(b.ends_at).toLocaleTimeString()} • host{" "}
                              {dollars(b.host_payout_cents)}
                            </span>
                          </div>
                          <em>
                            {b.status}
                            {b.stripe_payment_intent_id ? " • paid online" : ""}
                          </em>
                          <select
                            value={b.status}
                            onChange={(e) =>
                              act(
                                () =>
                                  supabase
                                    .from("bookings")
                                    .update({ status: e.target.value })
                                    .eq("id", b.id),
                                "Booking status updated.",
                              )
                            }
                          >
                            <option>draft</option>
                            <option>pending_documents</option>
                            <option>pending_payment</option>
                            <option>confirmed</option>
                            <option>completed</option>
                            <option>cancelled</option>
                            <option>refunded</option>
                          </select>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <Empty text="No bookings yet" />
                  )}
                </Panel>
                <BookingChangeQueue
                  bookingLabel={(id) => {
                    const b = books.find((x) => x.id === id);
                    return b
                      ? `${bname(b.renter_business_id)} • ${kname(b.kitchen_id)}`
                      : "Booking";
                  }}
                  onNotice={setNote}
                  onRefresh={load}
                />
              </>
            )}

            {tab === "people" && (
              <>
                <Heading
                  over="PEOPLE & COMPLIANCE"
                  title="All chefs and food businesses"
                  copy="Search, sort, view and edit every pending, approved, rejected or kitchen-sponsored chef record."
                />
                <DirectoryTools search={directorySearch} setSearch={setDirectorySearch} status={directoryStatus} setStatus={setDirectoryStatus} sort={chefSort} setSort={setChefSort} chef />
                <div className="admin-directory">
                  <div className="directory-head"><span>Chef</span><span>Business</span><span>Kitchen</span><span>Status</span><span>Actions</span></div>
                  {filteredChefs.map((chef) => (
                    <article key={`${chef.source}-${chef.record_id}`}>
                      <div><b>{chef.display_name || "Name not entered"}</b><small>{chef.email || "No email"}</small></div>
                      <div><b>{chef.business_name}</b><small>{chef.business_type || "Food business"}</small></div>
                      <span>{chef.kitchen_names?.join(", ") || "Not assigned"}</span>
                      <em>{chef.status.replaceAll("_", " ")}</em>
                      <button onClick={() => setEditingChef(chef)}>View / Edit</button>
                    </article>
                  ))}
                </div>
                {!filteredChefs.length && <Empty text="No chefs match these filters" />}
              </>
            )}

            {tab === "providers" && (
              <>
                <Heading
                  over="MARKETPLACE NETWORK"
                  title="All kitchens and providers"
                  copy="Search, view and edit every active, paused and pending kitchen record."
                />
                <DirectoryTools search={directorySearch} setSearch={setDirectorySearch} status={directoryStatus} setStatus={setDirectoryStatus} />
                <div className="admin-directory kitchen-directory">
                  <div className="directory-head"><span>Kitchen</span><span>Location</span><span>Contact</span><span>Status</span><span>Actions</span></div>
                  {filteredKitchens.map((k) => (
                    <article key={k.id}>
                      <div><b>{k.name}</b><small>{k.license_status || "License not entered"}</small></div>
                      <span>{k.address_line1}, {k.city}, {k.region}</span>
                      <span>{k.contact_email || k.contact_phone || "No contact entered"}</span>
                      <em>{k.active ? "Active" : "Private / paused"}</em>
                      <button onClick={() => setEditingKitchen(k)}>View / Edit</button>
                    </article>
                  ))}
                </div>
                <h2 className="section-title">Applications</h2>
                {apps.length ? (
                  <div className="cards">
                    {apps.map((a) => (
                      <article key={a.id}>
                        <header>
                          <div>
                            <h2>{a.kitchen_name}</h2>
                            <span>
                              {a.contact_name} • {a.contact_email}
                            </span>
                          </div>
                          <em>{a.status.replaceAll("_", " ")}</em>
                        </header>
                        <p>
                          {a.city}, {a.region}
                        </p>
                        <ul className="application-docs">
                          <li>
                            <button
                              onClick={() =>
                                openDocument(
                                  "kitchen-applications",
                                  a.license_path,
                                )
                              }
                            >
                              License
                            </button>
                            <b>
                              {a.license_path ? "Open document" : "Missing"}
                            </b>
                          </li>
                          <li>
                            <button
                              onClick={() =>
                                openDocument(
                                  "kitchen-applications",
                                  a.insurance_path,
                                )
                              }
                            >
                              Insurance
                            </button>
                            <b>
                              {a.insurance_path ? "Open document" : "Missing"}
                            </b>
                          </li>
                          <li>
                            <button
                              onClick={() =>
                                openDocument(
                                  "kitchen-applications",
                                  a.inspection_path,
                                )
                              }
                            >
                              Inspection
                            </button>
                            <b>
                              {a.inspection_path ? "Open document" : "Missing"}
                            </b>
                          </li>
                          <li>
                            Equipment
                            <b>{a.equipment?.join(", ") || "Not listed"}</b>
                          </li>
                        </ul>
                        <footer>
                          <button
                            onClick={() =>
                              act(
                                () =>
                                  supabase
                                    .from("kitchen_applications")
                                    .update({
                                      status: "more_information",
                                      reviewed_at: new Date().toISOString(),
                                    })
                                    .eq("id", a.id),
                                "More information requested.",
                              )
                            }
                          >
                            Need info
                          </button>
                          <button
                            disabled={a.status === "approved"}
                            onClick={() =>
                              act(
                                () =>
                                  supabase.rpc(
                                    "admin_approve_kitchen_application",
                                    { p_application_id: a.id },
                                  ),
                                "Provider approved. A private kitchen workspace was created for configuration.",
                              )
                            }
                          >
                            <Check />
                            {a.status === "approved"
                              ? "Approved"
                              : "Approve privately"}
                          </button>
                        </footer>
                      </article>
                    ))}
                  </div>
                ) : (
                  <Empty text="No provider applications" />
                )}
              </>
            )}

            {tab === "trucks" && (
              <>
                <Heading over="MOBILE KITCHEN NETWORK" title="Food trucks, drivers and clearances" copy="Approve the truck as a mobile food facility. Transportation always remains under the truck owner’s control." />
                <div className="metrics">
                  <Metric label="Trucks" value={String(foodTrucks.length)} detail="Across all providers" />
                  <Metric label="Awaiting review" value={String(foodTrucks.filter(t=>t.status==="submitted").length)} detail="Submitted by providers" />
                  <Metric label="Authorized drivers" value={String(truckDrivers.filter(d=>d.active&&d.insurance_approved&&d.mvr_reviewed_at&&d.truck_orientation_completed_at).length)} detail="Insurance, MVR and orientation" />
                  <Metric label="Approved trucks" value={String(foodTrucks.filter(t=>t.status==="approved"&&t.active).length)} detail="Eligible for public listing" />
                </div>
                <div className="cards truck-admin-cards">
                  {foodTrucks.map(truck=>{const drivers=truckDrivers.filter(d=>d.truck_id===truck.id),documents=truckDocs.filter(d=>d.truck_id===truck.id),driverReady=drivers.some(d=>d.active&&d.insurance_approved&&!!d.mvr_reviewed_at&&!!d.truck_orientation_completed_at&&(!d.license_expires_on||new Date(d.license_expires_on)>=new Date())),missing=truckRequiredDocuments.filter(type=>!documents.some(d=>d.document_type===type&&d.status==="approved"&&(!d.expires_on||new Date(d.expires_on)>=new Date()))),ready=driverReady&&missing.length===0&&!truck.renter_driving_allowed&&truck.transportation_policy==="owner_supplied_driver";return <article key={truck.id}>
                    <header><div><h2>{truck.name}</h2><span>{biz.find(b=>b.id===truck.owner_business_id)?.name||"Provider"}{truck.base_kitchen_id?` • ${kname(truck.base_kitchen_id)}`:" • Commissary not assigned"}</span></div><em>{truck.status}</em></header>
                    <p>{truck.service_area||"Service area not entered"}</p>
                    <ul className="application-docs"><li>Transportation policy<b>{truck.renter_driving_allowed?"BLOCKED: renter driving enabled":"Owner-supplied driver only"}</b></li><li>Authorized driver<b>{driverReady?"Ready":"Incomplete"}</b></li><li>Compliance documents<b>{missing.length?`${missing.length} missing or unapproved`:"All current"}</b></li><li>Public availability<b>{truck.active&&truck.accepting_requests?"Published and accepting":"Not publicly bookable"}</b></li></ul>
                    {drivers.length>0&&<details><summary>Review authorized drivers</summary><div className="truck-doc-review">{drivers.map(driver=><form key={driver.id} onSubmit={e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.currentTarget));act(()=>supabase.from("food_truck_drivers").update({insurance_approved:v.insurance_approved==="yes",mvr_reviewed_at:v.mvr_reviewed==="yes"?driver.mvr_reviewed_at||new Date().toISOString():null,truck_orientation_completed_at:v.orientation_completed==="yes"?driver.truck_orientation_completed_at||new Date().toISOString():null,active:v.active==="yes"}).eq("id",driver.id),`${driver.full_name} authorization saved.`)}}><b>{driver.full_name}</b><span>{driver.license_expires_on?`License expires ${driver.license_expires_on}`:"License expiration missing"}</span><select name="insurance_approved" defaultValue={driver.insurance_approved?"yes":"no"}><option value="no">Insurance pending</option><option value="yes">Insurance approved</option></select><select name="mvr_reviewed" defaultValue={driver.mvr_reviewed_at?"yes":"no"}><option value="no">MVR pending</option><option value="yes">MVR reviewed</option></select><select name="orientation_completed" defaultValue={driver.truck_orientation_completed_at?"yes":"no"}><option value="no">Orientation pending</option><option value="yes">Orientation completed</option></select><select name="active" defaultValue={driver.active?"yes":"no"}><option value="yes">Active</option><option value="no">Paused</option></select><button>Save driver</button></form>)}</div></details>}
                    {documents.length>0&&<details><summary>Review submitted documents</summary><div className="truck-doc-review">{documents.map(doc=><form key={doc.id} onSubmit={e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.currentTarget));act(()=>supabase.from("food_truck_documents").update({status:v.status,reviewer_note:v.reviewer_note||null,updated_at:new Date().toISOString()}).eq("id",doc.id),`${doc.document_type} review saved.`)}}><b>{doc.document_type}</b><span>{doc.expires_on?`Expires ${doc.expires_on}`:"No expiration entered"}</span><select name="status" defaultValue={doc.status}><option value="submitted">Submitted</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="expired">Expired</option></select><input name="reviewer_note" defaultValue={doc.reviewer_note||""} placeholder="Reviewer note"/><button>Save</button></form>)}</div></details>}
                    <footer><a className="profile-open" href={`/host/trucks?truck=${truck.id}&admin=1`}>Work as this Food Truck</a><button onClick={()=>act(()=>supabase.from("food_trucks").update({status:"rejected",active:false,accepting_requests:false}).eq("id",truck.id),"Food truck returned to provider for correction.")}>Return / reject</button><button disabled={!ready} onClick={()=>act(()=>supabase.from("food_trucks").update({status:"approved",active:true}).eq("id",truck.id),"Food truck approved for the network.")}><Check/>{ready?"Approve truck":"Requirements incomplete"}</button></footer>
                  </article>})}
                </div>
                {!foodTrucks.length&&<Empty text="No food trucks have been added"/>}
              </>
            )}

            {tab === "reports" && (
              <>
                <Heading
                  over="SAFETY & ACCOUNTABILITY"
                  title="Issues, incidents & closeouts"
                  copy="Assign, investigate and close the operational trail for every reported issue."
                />
                <div className="metrics">
                  <Metric
                    label="Open incidents"
                    value={String(
                      reports.filter(
                        (r) => !["resolved", "closed"].includes(r.status),
                      ).length,
                    )}
                    detail="Needs follow-up"
                  />
                  <Metric
                    label="Open maintenance"
                    value={String(
                      tickets.filter(
                        (t) => !["resolved", "closed"].includes(t.status),
                      ).length,
                    )}
                    detail="Facility issues"
                  />
                  <Metric
                    label="Payment disputes"
                    value={String(
                      txs.filter((t) => t.status === "disputed").length,
                    )}
                    detail="Needs resolution"
                  />
                  <Metric
                    label="Failed payouts"
                    value={String(
                      payouts.filter((p) => p.status === "failed").length,
                    )}
                    detail="Provider issues"
                  />
                </div>
                <Panel title="Incident queue" icon={AlertTriangle}>
                  {reports.length ? (
                    <div className="incident-queue">
                      {reports.map((r) => (
                        <form
                          key={r.id}
                          onSubmit={(e) => {
                            e.preventDefault();
                            const v = values(e);
                            act(
                              () =>
                                supabase
                                  .from("incident_reports")
                                  .update({
                                    status: v.status,
                                    assigned_to: v.assigned_to || null,
                                    resolution_notes:
                                      v.resolution_notes || null,
                                    resolved_at: [
                                      "resolved",
                                      "closed",
                                    ].includes(String(v.status))
                                      ? new Date().toISOString()
                                      : null,
                                    resolved_by: [
                                      "resolved",
                                      "closed",
                                    ].includes(String(v.status))
                                      ? userId
                                      : null,
                                  })
                                  .eq("id", r.id),
                              "Incident record updated.",
                            );
                          }}
                        >
                          <header>
                            <div>
                              <b>{r.incident_type.replaceAll("_", " ")}</b>
                              <span>
                                {kname(r.kitchen_id)} •{" "}
                                {new Date(r.occurred_at).toLocaleString()}
                                {r.emergency_services_called
                                  ? " • Emergency services called"
                                  : ""}
                              </span>
                            </div>
                            <em
                              className={
                                r.status === "resolved" || r.status === "closed"
                                  ? "good"
                                  : "bad"
                              }
                            >
                              {r.status}
                            </em>
                          </header>
                          <p>{r.description}</p>
                          <div className="form-pair">
                            <Select
                              name="status"
                              label="Status"
                              items={[
                                [r.status, r.status],
                                ...[
                                  "open",
                                  "investigating",
                                  "resolved",
                                  "closed",
                                ]
                                  .filter((s) => s !== r.status)
                                  .map((s) => [s, s]),
                              ]}
                            />
                            <label>
                              Assigned to
                              <input
                                name="assigned_to"
                                defaultValue={r.assigned_to || ""}
                                placeholder="Tony, provider, insurer…"
                              />
                            </label>
                          </div>
                          <label>
                            Resolution notes
                            <textarea
                              name="resolution_notes"
                              defaultValue={r.resolution_notes || ""}
                            />
                          </label>
                          <button className="primary">Save incident</button>
                        </form>
                      ))}
                    </div>
                  ) : (
                    <Empty text="No incidents reported" />
                  )}
                </Panel>
              </>
            )}
            {tab === "equipment" && (
              <EquipmentRateControls
                equipment={equipment}
                kitchenName={kname}
                onSaved={async (message) => {
                  setNote(message);
                  await load();
                }}
              />
            )}
          </div>
        )}
      </section>
      {editingChef && (
        <div className="admin-modal" role="dialog" aria-modal="true" aria-label="Edit chef">
          <form onSubmit={async (event) => {
            event.preventDefault();
            const v = Object.fromEntries(new FormData(event.currentTarget).entries());
            const { error } = await supabase.rpc("admin_update_chef", {
              p_record_id: editingChef.record_id, p_source: editingChef.source,
              p_display_name: String(v.display_name), p_business_name: String(v.business_name),
              p_business_type: String(v.business_type), p_phone: String(v.phone || ""), p_status: String(v.status),
            });
            if (error) setNote(error.message); else { setEditingChef(null); setNote("Chef record updated."); await load(); }
          }}>
            <header><div><p>CHEF DIRECTORY</p><h2>View / Edit Chef</h2></div><button type="button" onClick={() => setEditingChef(null)} aria-label="Close"><X /></button></header>
            <div className="form-pair"><label>Chef name<input name="display_name" defaultValue={editingChef.display_name || ""} required /></label><label>Business name<input name="business_name" defaultValue={editingChef.business_name} required /></label></div>
            <div className="form-pair"><label>Business type<input name="business_type" defaultValue={editingChef.business_type} required /></label><label>Phone<input name="phone" defaultValue={editingChef.phone || ""} /></label></div>
            <div className="form-pair"><label>Email<input value={editingChef.email || ""} readOnly /></label><label>Approval status<select name="status" defaultValue={editingChef.status}><option value="draft">Draft</option><option value="submitted">Submitted</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option></select></label></div>
            <label>Approved / assigned kitchens<input value={editingChef.kitchen_names?.join(", ") || "Not assigned"} readOnly /></label>
            <div className="admin-workspace-actions"><button type="button" className="profile-open" onClick={async()=>{const {data,error}=await supabase.rpc("admin_prepare_chef_workspace",{p_record_id:editingChef.record_id,p_source:editingChef.source});if(error){setNote(error.message);return}location.href=`/chef?business=${data}&admin=1`}}>Work as this Chef</button>{editingChef.business_id && <a className="profile-open secondary" href={`/food-businesses/${editingChef.business_id}`} target="_blank" rel="noopener noreferrer">Open public profile</a>}</div>
            <footer><button type="button" onClick={() => setEditingChef(null)}>Cancel</button><button className="primary">Save changes</button></footer>
          </form>
        </div>
      )}
      {editingKitchen && (
        <div className="admin-modal" role="dialog" aria-modal="true" aria-label="Edit kitchen">
          <form onSubmit={async (event) => {
            event.preventDefault(); const v=Object.fromEntries(new FormData(event.currentTarget).entries());
            const { error }=await supabase.from("kitchens").update({name:String(v.name),address_line1:String(v.address_line1),city:String(v.city),region:String(v.region),contact_email:String(v.contact_email||"")||null,contact_phone:String(v.contact_phone||"")||null,license_status:String(v.license_status),active:v.active==="true",accepting_requests:v.accepting_requests==="true"}).eq("id",editingKitchen.id);
            if(error)setNote(error.message);else{setEditingKitchen(null);setNote("Kitchen record updated.");await load();}
          }}>
            <header><div><p>KITCHEN DIRECTORY</p><h2>View / Edit Kitchen</h2></div><button type="button" onClick={() => setEditingKitchen(null)} aria-label="Close"><X /></button></header>
            <label>Kitchen name<input name="name" defaultValue={editingKitchen.name} required /></label>
            <div className="form-pair"><label>Address<input name="address_line1" defaultValue={editingKitchen.address_line1} required /></label><label>City<input name="city" defaultValue={editingKitchen.city} required /></label></div>
            <div className="form-pair"><label>State / region<input name="region" defaultValue={editingKitchen.region} required /></label><label>License status<input name="license_status" defaultValue={editingKitchen.license_status || "pending"} /></label></div>
            <div className="form-pair"><label>Contact email<input name="contact_email" type="email" defaultValue={editingKitchen.contact_email || ""} /></label><label>Contact phone<input name="contact_phone" defaultValue={editingKitchen.contact_phone || ""} /></label></div>
            <div className="form-pair"><label>Listing status<select name="active" defaultValue={String(editingKitchen.active)}><option value="true">Active</option><option value="false">Private / paused</option></select></label><label>Booking requests<select name="accepting_requests" defaultValue={String(editingKitchen.accepting_requests)}><option value="true">Accepting</option><option value="false">Not accepting</option></select></label></div>
            <div className="admin-workspace-actions"><a className="profile-open" href={`/host/dashboard?kitchen=${editingKitchen.id}&admin=1`}>Work as this Kitchen</a><a className="profile-open secondary" href={`/kitchens/${editingKitchen.id}`} target="_blank" rel="noopener noreferrer">Open public profile</a></div>
            <footer><button type="button" onClick={() => setEditingKitchen(null)}>Cancel</button><button className="primary">Save changes</button></footer>
          </form>
        </div>
      )}
    </main>
  );
}

function AuthState({
  title,
  copy,
  login,
  switchAccount,
}: {
  title: string;
  copy?: string;
  login?: boolean;
  switchAccount?: boolean;
}) {
  return (
    <main className="admin-auth-state">
      <img src="/tagos-kitchen-logo.png" alt="TaGo's Kitchen" />
      <h1>{title}</h1>
      {copy && <p>{copy}</p>}
      {login && <a href="/account?mode=signin">Log in as administrator</a>}
      {switchAccount && (
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            location.href = "/account?mode=signin";
          }}
        >
          Use a different account
        </button>
      )}
      <a className="auth-home" href="/">
        Return home
      </a>
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
    <div className="ops-heading">
      <p>{over}</p>
      <h1>{title}</h1>
      <span>{copy}</span>
    </div>
  );
}
function DirectoryTools({search,setSearch,status,setStatus,sort,setSort,chef=false}:{search:string;setSearch:(value:string)=>void;status:string;setStatus:(value:string)=>void;sort?:string;setSort?:(value:string)=>void;chef?:boolean}) {
  return <div className="directory-tools">
    <label><Search/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder={chef?"Search chef, business, email or kitchen":"Search kitchen, location or contact"}/></label>
    <select value={status} onChange={(e)=>setStatus(e.target.value)} aria-label="Filter status">
      <option value="all">All statuses</option>
      {chef?<><option value="draft">Draft</option><option value="invited">Invited</option><option value="pending">Pending</option><option value="submitted">Submitted</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="claimed">Claimed</option></>:<><option value="active">Active</option><option value="paused">Private / paused</option></>}
    </select>
    {chef&&sort&&setSort&&<select value={sort} onChange={(e)=>setSort(e.target.value)} aria-label="Sort chefs"><option value="last_name">Sort: Last name</option><option value="first_name">Sort: First name</option><option value="business">Sort: Business</option><option value="kitchen">Sort: Kitchen</option></select>}
  </div>;
}
function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="metric-live">
      <span>{label}</span>
      <b>{value}</b>
      <small>{detail}</small>
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
    <section className="ops-panel">
      <header>
        <Icon />
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="ops-empty">
      <ClipboardCheck />
      <b>{text}</b>
      <span>New live records will appear here.</span>
    </div>
  );
}
function Select({
  name,
  label,
  items,
  optional,
}: {
  name: string;
  label: string;
  items: string[][];
  optional?: boolean;
}) {
  return (
    <label>
      {label}
      <select name={name} required={!optional}>
        <option value="">
          {optional ? "None / all resources" : "Choose…"}
        </option>
        {items.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
function DatePair() {
  const start = localInput(new Date(Date.now() + 86400000)),
    end = localInput(new Date(Date.now() + 90000000));
  return (
    <div className="form-pair">
      <label>
        Starts
        <input
          name="starts_at"
          type="datetime-local"
          defaultValue={start}
          required
        />
      </label>
      <label>
        Ends
        <input
          name="ends_at"
          type="datetime-local"
          defaultValue={end}
          required
        />
      </label>
    </div>
  );
}
function EquipmentRateControls({
  equipment,
  kitchenName,
  onSaved,
}: {
  equipment: Equip[];
  kitchenName: (id: string | null) => string;
  onSaved: (message: string) => Promise<void>;
}) {
  const [error, setError] = useState("");
  return (
    <Panel title="Edit online rates & capacity" icon={CircleDollarSign}>
      <div className="rate-editor">
        {equipment.map((item) => (
          <form
            key={item.id}
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              const v = Object.fromEntries(
                new FormData(e.currentTarget).entries(),
              );
              const { error: saveError } = await supabase
                .from("equipment_resources")
                .update({
                  name: String(v.name),
                  hourly_rate_cents: Math.round(Number(v.rate) * 100),
                  capacity: Number(v.capacity),
                })
                .eq("id", item.id);
              if (saveError) setError(saveError.message);
              else await onSaved(item.name + " updated for online booking.");
            }}
          >
            <label>
              Equipment
              <input name="name" defaultValue={item.name} required />
            </label>
            <label>
              Rate per hour
              <input
                name="rate"
                type="number"
                min="0"
                step=".01"
                defaultValue={(item.hourly_rate_cents / 100).toFixed(2)}
                required
              />
            </label>
            <label>
              Capacity
              <input
                name="capacity"
                type="number"
                min="1"
                defaultValue={item.capacity}
                required
              />
            </label>
            <span>{kitchenName(item.kitchen_id)}</span>
            <button className="primary">Save</button>
          </form>
        ))}
      </div>
      {error && <div className="live-error">{error}</div>}
      <small>
        Equipment with a $0 rate remains visible as “Rate pending” and cannot be
        reserved online.
      </small>
    </Panel>
  );
}
