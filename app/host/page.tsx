"use client";
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useState } from "react";
import {
  Building2,
  Check,
  ChevronRight,
  FileCheck2,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Upload,
  UsersRound,
  Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import Breadcrumbs from "../breadcrumbs";
import "./host.css";

const equipmentOptions = [
  "Ovens",
  "Fryers",
  "Griddle",
  "Range",
  "Mixer",
  "Prep tables",
  "Walk-in cooler",
  "Freezer",
  "Dishwasher",
  "Food-truck commissary",
];
const amenityOptions = [
  "Dry storage",
  "Cold storage",
  "Freezer storage",
  "Receiving area",
  "Parking",
  "24/7 access",
  "Security cameras",
  "Loading entrance",
];

export default function HostPage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [existingApplication, setExistingApplication] = useState<{kitchen_name:string;status:string;admin_notes:string|null;submitted_at:string|null}|null>(null);
  const [checkingApplication, setCheckingApplication] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user;
      setUser(u ? { id: u.id, email: u.email } : null);
      if(u){const {data:application}=await supabase.from("kitchen_applications").select("kitchen_name,status,admin_notes,submitted_at").eq("applicant_id",u.id).order("created_at",{ascending:false}).limit(1).maybeSingle();setExistingApplication(application)}
      setCheckingApplication(false);
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      window.location.href = "/account?mode=signin";
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const selected = (name: string) => form.getAll(name).map(String);
    const { data: application, error: insertError } = await supabase
      .from("kitchen_applications")
      .insert({
        applicant_id: user.id,
        contact_name: String(form.get("contactName") || ""),
        contact_email: String(form.get("contactEmail") || ""),
        contact_phone: String(form.get("contactPhone") || ""),
        kitchen_name: String(form.get("kitchenName") || ""),
        address_line1: String(form.get("address") || ""),
        city: String(form.get("city") || ""),
        region: String(form.get("region") || ""),
        postal_code: String(form.get("postalCode") || ""),
        website: String(form.get("website") || "") || null,
        facility_type: String(form.get("facilityType") || ""),
        description: String(form.get("description") || ""),
        equipment: [
          ...selected("equipment"),
          ...String(form.get("customEquipment") || "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
        ],
        amenities: selected("amenities"),
        availability_notes: String(form.get("availability") || ""),
        proposed_hourly_rate_cents: Math.round(
          Number(form.get("hourlyRate") || 0) * 100,
        ),
        status: "draft",
        applicant_attested: true,
      })
      .select("id")
      .single();
    if (insertError || !application) {
      setError(insertError?.message || "Could not create the application.");
      setBusy(false);
      return;
    }
    const paths: Record<string, string> = {};
    for (const field of [
      "license",
      "insurance",
      "inspection",
      "authorization",
    ]) {
      const file = form.get(field);
      if (!(file instanceof File) || !file.size) continue;
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${user.id}/${application.id}/${field}-${Date.now()}-${safe}`;
      const { error: uploadError } = await supabase.storage
        .from("kitchen-applications")
        .upload(path, file);
      if (uploadError) {
        setError(
          `Application saved, but ${field} did not upload: ${uploadError.message}`,
        );
        setBusy(false);
        return;
      }
      paths[`${field}_path`] = path;
    }
    const { error: updateError } = await supabase
      .from("kitchen_applications")
      .update({
        ...paths,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", application.id);
    if (updateError) setError(updateError.message);
    else {
      setMessage(
        "Application submitted. TaGo's will review the facility before anything is listed.",
      );
      event.currentTarget.reset();
      setExistingApplication({kitchen_name:String(form.get("kitchenName")||"Your kitchen"),status:"submitted",admin_notes:null,submitted_at:new Date().toISOString()});
    }
    setBusy(false);
  }

  return (
    <main className="host-page">
      <header>
        <a href="/">
          <img src="/tagos-kitchen-logo.png" alt="TaGo's Kitchen" />
        </a>
        <div>
          <a href="/host/dashboard">Kitchen dashboard</a>
          <a href="/tour">Chef tour</a>
          <a href={user ? "/account" : "/account?mode=signin"}>
            {user ? "My account" : "Log in"}
          </a>
        </div>
      </header>
      <Breadcrumbs items={[{label:"Partner kitchens",href:"/host"}, "How it works & apply"]} />
      {!checkingApplication&&existingApplication&&!["rejected","withdrawn"].includes(existingApplication.status)&&<section className="application-progress"><div><p>KITCHEN ONBOARDING</p><h2>{existingApplication.kitchen_name}</h2><span className={`application-status ${existingApplication.status}`}>{existingApplication.status.replaceAll("_"," ")}</span></div><ol><li className="complete"><Check/><span><b>Application received</b><small>Your facility information is saved.</small></span></li><li className={existingApplication.status==="approved"?"complete":"current"}>{existingApplication.status==="approved"?<Check/>:<span>2</span>}<span><b>TaGo&apos;s review</b><small>{existingApplication.admin_notes||"Documents and facility details are being reviewed."}</small></span></li><li className={existingApplication.status==="approved"?"complete":""}>{existingApplication.status==="approved"?<Check/>:<span>3</span>}<span><b>Kitchen workspace</b><small>{existingApplication.status==="approved"?"Your operating workspace is ready.":"Unlocks after approval."}</small></span></li></ol><a href="/host/dashboard">{existingApplication.status==="approved"?"Open kitchen workspace":"View application status"}<ChevronRight/></a></section>}
      <section className="host-hero">
        <div>
          <p>PARTNER KITCHEN NETWORK</p>
          <h1>Put your unused kitchen capacity to work.</h1>
          <span>
            Offer approved cooks specific hours, work areas, or equipment. You
            control what is available; TaGo&apos;s manages discovery,
            applications, booking records, and the operating trail.
          </span>
          <a href={existingApplication&&!['rejected','withdrawn'].includes(existingApplication.status)?"/host/dashboard":"#apply"}>
            {existingApplication&&!['rejected','withdrawn'].includes(existingApplication.status)?"View my application":"Apply to list your kitchen"} <ChevronRight />
          </a>
        </div>
        <div className="host-capacity">
          <b>YOU CONTROL</b>
          <span>
            <Check /> Available hours
          </span>
          <span>
            <Check /> Equipment and work zones
          </span>
          <span>
            <Check /> Rates and minimum bookings
          </span>
          <span>
            <Check /> Facility-specific requirements
          </span>
          <span>
            <Check /> Final renter approval rules
          </span>
        </div>
      </section>
      <section className="host-how">
        <div>
          <p>HOW IT WORKS</p>
          <h2>A review-first marketplace</h2>
        </div>
        <div className="host-steps">
          <article>
            <b>1</b>
            <Building2 />
            <h3>Apply</h3>
            <span>
              Tell us about the licensed facility, equipment, access,
              availability, and pricing.
            </span>
          </article>
          <article>
            <b>2</b>
            <FileCheck2 />
            <h3>Verify</h3>
            <span>
              TaGo&apos;s reviews licenses, insurance, inspection history, and
              authority to rent the space.
            </span>
          </article>
          <article>
            <b>3</b>
            <Wrench />
            <h3>Configure</h3>
            <span>
              Choose the capacity you offer: resident placement, recurring
              production blocks, flexible hourly rentals—or any combination.
            </span>
          </article>
          <article>
            <b>4</b>
            <UsersRound />
            <h3>Host carefully</h3>
            <span>
              You publish your own openings and approve qualified renters.
              Check-in, checkout, condition, and incident records protect both
              sides.
            </span>
          </article>
        </div>
      </section>
      <section className="host-proof">
        <div>
          <p>PILOT REQUIREMENTS</p>
          <h2>What a kitchen should be ready to prove</h2>
          <span>
            Requirements can be tightened by jurisdiction, facility, menu, or
            equipment after review.
          </span>
        </div>
        <div>
          <article>
            <ShieldCheck />
            <b>Legal operation</b>
            <span>
              Current facility license or permit and latest inspection
              documentation.
            </span>
          </article>
          <article>
            <FileCheck2 />
            <b>Insurance</b>
            <span>
              Commercial general liability coverage appropriate for shared
              commercial use.
            </span>
          </article>
          <article>
            <KeyRound />
            <b>Authority</b>
            <span>
              Ownership, lease permission, or written authorization to license
              the kitchen to others.
            </span>
          </article>
          <article>
            <LockKeyhole />
            <b>Safe operations</b>
            <span>
              Secure access, sanitation process, equipment condition, emergency
              contacts, and clear house rules.
            </span>
          </article>
        </div>
      </section>
      {(!existingApplication||["rejected","withdrawn"].includes(existingApplication.status))&&<form id="apply" className="host-form" onSubmit={submit}>
        <div className="host-form-title">
          <p>PARTNER APPLICATION</p>
          <h2>Tell us about your kitchen</h2>
          <span>
            Submitting does not publish your facility. TaGo&apos;s reviews every
            application first.
          </span>
        </div>
        {!user && (
          <div className="host-login">
            <LockKeyhole />
            <span>
              <b>Sign in before submitting</b>You can review the form now. We
              will send you to login when you submit.
            </span>
            <a href="/account?mode=signin">Log in</a>
          </div>
        )}
        <fieldset>
          <legend>Contact and facility</legend>
          <div className="host-grid">
            <label>
              Your name
              <input name="contactName" required />
            </label>
            <label>
              Email
              <input
                name="contactEmail"
                type="email"
                required
                defaultValue={user?.email || ""}
              />
            </label>
            <label>
              Phone
              <input name="contactPhone" type="tel" />
            </label>
            <label>
              Kitchen name
              <input name="kitchenName" required />
            </label>
            <label>
              Street address
              <input name="address" required />
            </label>
            <label>
              City
              <input name="city" required />
            </label>
            <label>
              State
              <input name="region" required maxLength={2} placeholder="PA" />
            </label>
            <label>
              ZIP code
              <input name="postalCode" required inputMode="numeric" />
            </label>
            <label>
              Website
              <input name="website" type="url" placeholder="https://" />
            </label>
            <label>
              Facility type
              <select name="facilityType" required defaultValue="">
                <option value="" disabled>
                  Select one
                </option>
                <option>Restaurant kitchen</option>
                <option>Commissary kitchen</option>
                <option>Shared-use kitchen</option>
                <option>Catering kitchen</option>
                <option>Institutional kitchen</option>
                <option>Other licensed facility</option>
              </select>
            </label>
          </div>
          <label>
            Describe the facility and the businesses it currently supports
            <textarea name="description" required />
          </label>
        </fieldset>
        <fieldset>
          <legend>Capacity and equipment</legend>
          <p>Select everything you may be willing to rent.</p>
          <div className="check-grid">
            {equipmentOptions.map((x) => (
              <label key={x}>
                <input type="checkbox" name="equipment" value={x} />
                {x}
              </label>
            ))}
          </div>
          <label>
            Custom equipment or work areas
            <textarea
              name="customEquipment"
              placeholder="Example: smoker, dedicated 120 sq ft production area, two cold-storage shelves"
            />
          </label>
          <p>Optional amenities</p>
          <div className="check-grid">
            {amenityOptions.map((x) => (
              <label key={x}>
                <input type="checkbox" name="amenities" value={x} />
                {x}
              </label>
            ))}
          </div>
          <div className="host-grid">
            <label>
              When could renters use the space?
              <textarea
                name="availability"
                required
                placeholder="Days, hours, recurring blocked times, and resident-chef priority"
              />
            </label>
            <label>
              Proposed starting hourly rate
              <input
                name="hourlyRate"
                type="number"
                min="0"
                step="1"
                required
              />
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Verification documents</legend>
          <p>PDF, JPG, or PNG • 10 MB maximum per file • private review only</p>
          <div className="proof-grid">
            <label>
              <Upload />
              <span>
                <b>Facility license or permit</b>Current document
              </span>
              <input
                name="license"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                required
              />
            </label>
            <label>
              <Upload />
              <span>
                <b>Liability insurance</b>Current certificate
              </span>
              <input
                name="insurance"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                required
              />
            </label>
            <label>
              <Upload />
              <span>
                <b>Latest inspection</b>Most recent report or approval
              </span>
              <input
                name="inspection"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                required
              />
            </label>
            <label>
              <Upload />
              <span>
                <b>Authority to rent</b>Required if not shown by ownership
              </span>
              <input
                name="authorization"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
              />
            </label>
          </div>
        </fieldset>
        <label className="host-attest">
          <input type="checkbox" required />
          <span>
            I am authorized to submit this facility and certify that the
            information and documents are accurate. I understand that
            application approval does not guarantee bookings.
          </span>
        </label>
        {error && <div className="host-error">{error}</div>}
        {message && (
          <div className="host-success">
            <Check />
            {message}
          </div>
        )}
        <button className="host-submit" disabled={busy}>
          {busy ? "Submitting securely…" : "Submit kitchen for review"}
          <ChevronRight />
        </button>
      </form>}
    </main>
  );
}
