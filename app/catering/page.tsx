"use client";

import { FormEvent, useState } from "react";
import { BriefcaseBusiness, Check, LockKeyhole } from "lucide-react";
import { supabase } from "@/lib/supabase";
import PublicHeader from "../public-header";
import "../public-marketplace.css";
import "./request.css";

export default function CateringRequest() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      location.href = "/account?mode=signin&returnTo=/catering";
      return;
    }
    const f = new FormData(e.currentTarget);
    const { data: saved, error: saveError } = await supabase
      .from("catering_opportunities")
      .insert({
        customer_id: user.id,
        event_type: f.get("event_type"),
        event_date: f.get("event_date"),
        approximate_time: f.get("approximate_time") || null,
        general_location: f.get("general_location"),
        guest_count: f.get("guest_count") ? Number(f.get("guest_count")) : null,
        budget_range: f.get("budget_range") || null,
        cuisine_preferences: f.get("cuisine_preferences") || null,
        service_requirements: f.get("service_requirements") || null,
        additional_details: f.get("additional_details") || null,
        status: "open",
      })
      .select("id")
      .single();
    if (saveError) setError(saveError.message);
    else {
      e.currentTarget.reset();
      setMessage(
        `Your opportunity is posted. Reference ${saved.id.slice(0, 8).toUpperCase()}. Approved chefs can now submit proposals.`,
      );
    }
    setBusy(false);
  }
  return (
    <main className="public-page catering-request">
      <PublicHeader />
      <section className="request-hero">
        <div>
          <p className="public-kicker">TAGO&apos;S OPPORTUNITY BOARD</p>
          <h1>Post your catering or food-service needs.</h1>
          <span>
            Tell our network what you need once. Approved chefs can respond with
            a menu, service plan, and quote.
          </span>
        </div>
        <div className="request-flow">
          <BriefcaseBusiness />
          <b>How it works</b>
          <span>1. List the job</span>
          <span>2. Chefs submit proposals</span>
          <span>3. Review and choose</span>
        </div>
      </section>
      <section className="public-main request-main">
        <div className="request-guidance">
          <h2>Give chefs enough detail to quote accurately.</h2>
          <p>
            Use the organization or event name, required delivery or service
            time, guest count, meal expectations, service needs, and budget.
            Keep private access instructions and personal addresses out of the
            public description until you select a chef.
          </p>
          <div>
            <Check /> Free to post
          </div>
          <div>
            <Check /> Visible only to approved chefs
          </div>
          <div>
            <Check /> No obligation to accept a proposal
          </div>
        </div>
        <form className="public-form" onSubmit={submit}>
          <label>
            Opportunity title
            <input
              name="event_type"
              required
              placeholder="Monroe Energy employee luncheon"
            />
          </label>
          <label>
            Event or delivery date
            <input name="event_date" type="date" required />
          </label>
          <label>
            Required delivery or service time
            <input
              name="approximate_time"
              required
              placeholder="Delivery completed by 11:30 AM"
            />
          </label>
          <label>
            General service location
            <input
              name="general_location"
              required
              placeholder="Trainer, PA — exact address shared after selection"
            />
          </label>
          <label>
            Estimated guests or servings
            <input
              name="guest_count"
              type="number"
              min="1"
              required
              placeholder="150"
            />
          </label>
          <label>
            Budget range (optional)
            <input name="budget_range" placeholder="$2,500–$3,500" />
          </label>
          <label className="wide">
            Meal, cuisine, or menu requirements
            <textarea
              name="cuisine_preferences"
              required
              placeholder="Full hot meal with two entrées, sides, vegetarian option, drinks…"
            />
          </label>
          <label className="wide">
            Delivery and service requirements
            <textarea
              name="service_requirements"
              required
              placeholder="Delivery by 11:30 AM, disposable chafers, setup, serving staff, cleanup…"
            />
          </label>
          <label className="wide">
            Additional information
            <textarea
              name="additional_details"
              placeholder="Dietary restrictions, loading limitations, contact process, proposal deadline…"
            />
          </label>
          <div className="request-privacy">
            <LockKeyhole />
            <span>
              <b>Protected opportunity board</b>Only approved TaGo&apos;s food
              businesses can view job details and submit proposals.
            </span>
          </div>
          {message && <div className="form-note">{message}<a className="manage-request-link" href="/catering/manage">View my requests and proposals</a></div>}
          {error && <div className="form-note form-error-note">{error}</div>}
          <button disabled={busy}>
            {busy ? "Posting opportunity…" : "Post this opportunity"}
          </button>
          <a className="existing-requests" href="/catering/manage">Already posted? Manage your requests</a>
        </form>
      </section>
    </main>
  );
}
