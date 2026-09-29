"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  LockKeyhole,
  MapPin,
  Megaphone,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { CalendarEntry, MonthEvents, WeekSchedule } from "./schedule-calendar";
import "./live-marketplace.css";
import "./equipment-listings.css";

type Kitchen = {
  id: string;
  name: string;
  address_line1: string;
  city: string;
  region: string;
  active: boolean;
  included_amenities: string[];
};
type Resource = {
  id: string;
  kitchen_id: string;
  name: string;
  category: string;
  hourly_rate_cents: number;
  capacity: number;
  active: boolean;
  image_path: string | null;
};
type ScheduleEntry = {
  entry_id: string;
  kitchen_id: string;
  resource_id: string | null;
  starts_at: string;
  ends_at: string;
  entry_type: string;
  display_name: string;
  resource_name: string | null;
};
type Promotion = {
  id: string;
  title: string;
  description: string | null;
  location_type: string;
  public_location: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  business_id: string | null;
};
const money = (c: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    c / 100,
  );
const localDate = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

export function LiveDiscover({
  approved,
  onBooked,
}: {
  approved: boolean;
  onBooked: (message: string) => void;
}) {
  const [kitchens, setKitchens] = useState<Kitchen[]>([]),
    [resources, setResources] = useState<Resource[]>([]),
    [approvedKitchenIds, setApprovedKitchenIds] = useState<string[] | null>(null),
    [kitchenId, setKitchenId] = useState(""),
    [resourceId, setResourceId] = useState("");
  const [starts, setStarts] = useState(
      localDate(new Date(Date.now() + 86400000)),
    ),
    [hours, setHours] = useState(4),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState<{ id: string; total: number } | null>(
      null,
    );
  useEffect(() => {
    (async () => {
      let allowedKitchenIds: string[] | null = null;
      if (approved) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: memberships } = await supabase.from("business_members").select("business_id").eq("user_id", user.id).eq("role", "owner");
          const businessIds = (memberships || []).map((membership) => membership.business_id);
          if (businessIds.length) {
            const { data: relationships } = await supabase.from("kitchen_chef_relationships").select("kitchen_id").in("chef_business_id", businessIds).eq("access_status", "active");
            allowedKitchenIds = Array.from(new Set((relationships || []).map((relationship) => relationship.kitchen_id)));
          } else allowedKitchenIds = [];
        } else allowedKitchenIds = [];
      }
      const [k, r] = await Promise.all([
        supabase
          .from("kitchens")
          .select("id,name,address_line1,city,region,active,included_amenities")
          .eq("active", true)
          .order("name"),
        supabase
          .from("equipment_resources")
          .select(
            "id,kitchen_id,name,category,hourly_rate_cents,capacity,active,image_path",
          )
          .eq("active", true)
          .is("archived_at", null)
          .order("name"),
      ]);
      const ks = ((k.data || []) as Kitchen[]).filter((item) => allowedKitchenIds === null || allowedKitchenIds.includes(item.id)),
        rs = ((r.data || []) as Resource[]).filter((item) => allowedKitchenIds === null || allowedKitchenIds.includes(item.kitchen_id));
      setApprovedKitchenIds(allowedKitchenIds);
      setKitchens(ks);
      setResources(rs);
      setKitchenId(ks[0]?.id || "");
      setLoading(false);
    })();
  }, [approved]);
  const available = resources.filter((r) => r.kitchen_id === kitchenId),
    selected = available.find((r) => r.id === resourceId) || available[0];
  useEffect(() => {
    if (selected && !resourceId) setResourceId(selected.id);
  }, [selected, resourceId]);
  const total = (selected?.hourly_rate_cents || 0) * hours;
  const book = async () => {
    if (!approved) {
      location.href = "/account";
      return;
    }
    if (!selected) return;
    setSaving(true);
    setError("");
    setReceipt(null);
    const start = new Date(starts),
      end = new Date(start.getTime() + hours * 3600000);
    const { data, error: e } = await supabase.rpc("create_booking_request", {
      p_resource_id: selected.id,
      p_starts_at: start.toISOString(),
      p_ends_at: end.toISOString(),
      p_notes: null,
    });
    if (e) setError(e.message);
    else {
      const result = data as any;
      setReceipt({ id: result.booking_id, total: result.subtotal_cents });
      onBooked(
        "Reservation request sent to the kitchen. You will receive an invoice after approval.",
      );
    }
    setSaving(false);
  };
  if (loading) return <Working text="Loading live kitchens and equipment…" />;
  const selectedKitchen = kitchens.find((k) => k.id === kitchenId);
  return (
    <div className="view live-discover">
      <div className="live-page-head">
        <p>KITCHEN MARKETPLACE</p>
        <h1>Find your kitchen</h1>
        <span>
          Live locations, equipment and pricing from the TaGo&apos;s network.
        </span>
      </div>
      {kitchens.length === 0 ? (
        <Empty
          title={approvedKitchenIds !== null ? "No approved kitchens yet" : "No kitchens are available yet"}
          copy={approvedKitchenIds !== null ? "A kitchen must approve your business for this location before you can request its equipment or time slots." : "Approved locations will appear here when their equipment and schedules are configured."}
        />
      ) : (
        <div className="live-market-grid">
          <section>
            <div className="live-location-list">
              {kitchens.map((k) => (
                <button
                  key={k.id}
                  className={kitchenId === k.id ? "selected" : ""}
                  onClick={() => {
                    setKitchenId(k.id);
                    setResourceId("");
                  }}
                >
                  <Store />
                  <span>
                    <b>{k.name}</b>
                    <small>
                      <MapPin />
                      {k.address_line1}, {k.city}, {k.region}
                    </small>
                  </span>
                  {kitchenId === k.id && <Check />}
                </button>
              ))}
            </div>
            {(selectedKitchen?.included_amenities?.length ?? 0) > 0 && (
              <div className="included-amenities">
                <b>Included at no charge</b>
                <div>
                  {selectedKitchen?.included_amenities?.map((item) => (
                    <span key={item}>
                      <Check />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <h2>Choose equipment</h2>
            <div className="live-resource-list">
              {available.map((r) => (
                <button
                  key={r.id}
                  className={selected?.id === r.id ? "selected" : ""}
                  onClick={() => setResourceId(r.id)}
                >
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
                    <div className="equipment-image-placeholder">
                      <Store />
                    </div>
                  )}
                  <span>
                    <b>{r.name}</b>
                    <small>
                      {r.category.replaceAll("_", " ")} • capacity {r.capacity}
                    </small>
                  </span>
                  <strong>
                    {r.hourly_rate_cents > 0
                      ? money(r.hourly_rate_cents) + "/hr"
                      : "Rate pending"}
                  </strong>
                </button>
              ))}
            </div>
            {available.length === 0 && (
              <Empty
                title="Equipment is being configured"
                copy="This kitchen is not ready for online reservations yet."
              />
            )}
          </section>
          <aside className="live-booking-card">
            <p>RESERVATION REQUEST</p>
            <h2>{selected?.name || "Choose equipment"}</h2>
            <label>
              Start date and time
              <input
                type="datetime-local"
                value={starts}
                min={localDate(new Date())}
                onChange={(e) => setStarts(e.target.value)}
              />
            </label>
            <label>
              Duration
              <div className="duration-control">
                <button onClick={() => setHours(Math.max(2, hours - 1))}>
                  −
                </button>
                <b>{hours} hours</b>
                <button onClick={() => setHours(Math.min(12, hours + 1))}>
                  +
                </button>
              </div>
            </label>
            <div className="live-total">
              <span>Equipment rental</span>
              <b>
                {selected?.hourly_rate_cents ? money(total) : "Not yet priced"}
              </b>
              <small>
                10% marketplace fee is deducted from the provider payout.
              </small>
            </div>
            {error && <div className="live-error">{error}</div>}
            {receipt && (
              <div className="live-success">
                <Check />
                <span>
                  <b>Request sent</b>Reference {receipt.id.slice(0, 8)} •{" "}
                  {money(receipt.total)} awaiting kitchen approval
                </span>
              </div>
            )}
            <button
              className="live-primary"
              disabled={!selected || !selected.hourly_rate_cents || saving}
              onClick={book}
            >
              {saving
                ? "Saving…"
                : !approved
                  ? "Complete profile to reserve"
                  : selected?.hourly_rate_cents
                    ? "Request this time"
                    : "Admin must set a rate"}
              <ChevronRight />
            </button>
            <small className="truth-note">
              <ShieldCheck /> The kitchen reviews first. Approval creates the
              invoice; payment and the current agreement confirm the booking.
            </small>
          </aside>
        </div>
      )}
    </div>
  );
}

export function LiveInnerSchedule({ approved }: { approved: boolean }) {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    if (!approved) {
      setLoading(false);
      return;
    }
    (async () => {
      const from = new Date(),
        to = new Date(Date.now() + 30 * 86400000);
      const { data, error: e } = await supabase.rpc("get_inner_schedule", {
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      });
      if (e) setError(e.message);
      else setEntries((data || []) as ScheduleEntry[]);
      setLoading(false);
    })();
  }, [approved]);
  if (!approved)
    return (
      <div className="view">
        <div className="live-page-head">
          <p>VERIFIED MEMBERS ONLY</p>
          <h1>Inner Schedule</h1>
          <span>
            Live equipment availability is limited to approved Kitchen Passport
            holders.
          </span>
        </div>
        <section className="schedule-lock">
          <LockKeyhole />
          <div>
            <h2>Approval required</h2>
            <p>
              Finish your profile and submit the required credentials.
              TaGo&apos;s will unlock the private schedule after approval.
            </p>
            <a href="/account">
              Finish my Kitchen Passport <ChevronRight />
            </a>
          </div>
        </section>
      </div>
    );
  if (loading) return <Working text="Loading the private schedule…" />;
  const calendarEntries: CalendarEntry[] = entries.map((entry) => ({
    id: `${entry.entry_type}-${entry.entry_id}`,
    title: entry.display_name,
    subtitle: entry.resource_name || "Shared kitchen",
    startsAt: entry.starts_at,
    endsAt: entry.ends_at,
    tone:
      entry.display_name.startsWith("Your")
        ? "confirmed"
        : entry.entry_type.includes("available")
          ? "available"
          : entry.entry_type.includes("resident")
            ? "resident"
            : entry.entry_type.includes("maintenance")
              ? "maintenance"
              : entry.entry_type.includes("request")
                ? "requested"
                : "blocked",
  }));
  return (
    <div className="view">
      <div className="live-page-head">
        <p>APPROVED CHEF WORKSPACE</p>
        <h1>Inner Schedule</h1>
        <span>
          Real bookings, resident assignments and equipment blocks for the next
          30 days.
        </span>
      </div>
      <div className="inner-security">
        <ShieldCheck />
        <span>
          <b>Private and redacted</b>Brands appear only when they choose
          visibility. TaGo&apos;s administrators always see the actual business.
        </span>
      </div>
      {error && <div className="live-error">{error}</div>}
      <WeekSchedule entries={calendarEntries} />
      {!entries.length && <Empty title="No activity scheduled" copy="Available bookable equipment appears under Find a Kitchen." />}
      <div className="schedule-request-cta"><div><b>Need production time?</b><span>Choose a kitchen, equipment and duration, then submit a request for approval.</span></div><a href="/?view=discover">Request a time slot <ChevronRight /></a></div>
    </div>
  );
}

export function LivePromotions({
  approved,
  onNotice,
}: {
  approved: boolean;
  onNotice: (message: string) => void;
}) {
  const [promos, setPromos] = useState<Promotion[]>([]),
    [businessId, setBusinessId] = useState(""),
    [showForm, setShowForm] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: m } = await supabase
        .from("business_members")
        .select("business_id")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .maybeSingle();
      setBusinessId(m?.business_id || "");
    }
    const { data, error: e } = await supabase
      .from("promotions")
      .select(
        "id,title,description,location_type,public_location,starts_at,ends_at,status,business_id",
      )
      .order("starts_at");
    if (e) setError(e.message);
    else setPromos((data || []) as Promotion[]);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget),
      start = new Date(String(form.get("starts_at"))),
      end = new Date(String(form.get("ends_at")));
    const locationType = String(form.get("location_type"));
    const publicLocation =
      locationType === "tagos"
        ? "100 Worrilow Street, Linwood, PA"
        : String(form.get("public_location") || "").trim();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !businessId) return;
    const { error: saveError } = await supabase
      .from("promotions")
      .insert({
        business_id: businessId,
        kitchen_id: null,
        title: String(form.get("title")),
        description: String(form.get("description") || "") || null,
        location_type: locationType,
        public_location: publicLocation,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: "draft",
        created_by: user.id,
      });
    if (saveError) setError(saveError.message);
    else {
      setShowForm(false);
      onNotice(
        "Promotion submitted as a draft for TaGo's review and publishing.",
      );
      await load();
    }
  };
  const publicPromos = promos.filter(
      (p) => p.status === "published" && new Date(p.ends_at) > new Date(),
    ),
    ownDrafts = promos.filter(
      (p) => p.business_id === businessId && p.status !== "published",
    );
  if (loading) return <Working text="Loading live promotions…" />;
  const eventEntries: CalendarEntry[] = publicPromos.map((promo) => ({
    id: promo.id,
    title: promo.title,
    subtitle: promo.public_location || promo.location_type.replaceAll("_", " "),
    startsAt: promo.starts_at,
    endsAt: promo.ends_at,
    tone: "event",
  }));
  return (
    <div className="view live-promos">
      <div className="live-page-head actions">
        <div>
          <p>PUBLIC EVENT CALENDAR</p>
          <h1>Pop-Up Pickup</h1>
          <span>Only real, approved promotional events appear here.</span>
        </div>
        {approved && (
          <button onClick={() => setShowForm(!showForm)}>
            <Megaphone />
            {showForm ? "Close form" : "Create promotion"}
          </button>
        )}
      </div>
      {error && <div className="live-error">{error}</div>}
      {showForm && (
        <form className="promo-builder" onSubmit={submit}>
          <h2>Submit a promotional event</h2>
          <label>
            Headline
            <input name="title" required placeholder="What are you cooking?" />
          </label>
          <label>
            Description
            <textarea name="description" required />
          </label>
          <div className="promo-pair">
            <label>
              Starts
              <input name="starts_at" type="datetime-local" required />
            </label>
            <label>
              Ends
              <input name="ends_at" type="datetime-local" required />
            </label>
          </div>
          <label>
            Location type
            <select name="location_type" required>
              <option value="tagos">Pickup at TaGo&apos;s</option>
              <option value="food_truck">TaGo&apos;s food truck</option>
              <option value="offsite">Independent offsite event</option>
            </select>
          </label>
          <label>
            Public address for truck or offsite events
            <input name="public_location" placeholder="Actual event address" />
          </label>
          <button className="live-primary">Submit for review</button>
        </form>
      )}
      {ownDrafts.length > 0 && (
        <section className="draft-strip">
          <b>Your promotion drafts</b>
          {ownDrafts.map((p) => (
            <span key={p.id}>
              {p.title} <em>{p.status}</em>
            </span>
          ))}
        </section>
      )}
      <MonthEvents entries={eventEntries} />
      <section className="promotion-grid">
        {publicPromos.map((p) => (
          <article key={p.id}>
            <div className="promo-date">
              <b>
                {new Date(p.starts_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </b>
              <span>
                {new Date(p.starts_at).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div>
              <em>
                {p.location_type === "food_truck" ? <Truck /> : <MapPin />}
                {p.location_type.replaceAll("_", " ")}
              </em>
              <h2>{p.title}</h2>
              <p>{p.description}</p>
              <strong>{p.public_location}</strong>
            </div>
          </article>
        ))}
      </section>
      {publicPromos.length === 0 && (
        <Empty
          title="No public food drops are scheduled"
          copy="Approved chef promotions will appear here after TaGo's reviews and publishes them."
        />
      )}
    </div>
  );
}

function Working({ text }: { text: string }) {
  return (
    <div className="view">
      <div className="working-live">
        <img src="/tagos-pin-mascot.png" alt="" />
        <b>{text}</b>
      </div>
    </div>
  );
}
function Empty({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="market-empty">
      <Clock3 />
      <b>{title}</b>
      <span>{copy}</span>
    </div>
  );
}
