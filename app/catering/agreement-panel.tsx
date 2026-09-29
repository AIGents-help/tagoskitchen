"use client";
import { FormEvent, useEffect, useState } from "react";
import { Check, FileSignature, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import "./agreement-panel.css";

type Agreement = {
  id: string;
  revision: number;
  status: string;
  final_menu: string;
  service_details: string;
  event_timing: string;
  total_cents: number;
  cancellation_terms: string;
  customer_change_note: string | null;
  accepted_at: string | null;
};
export default function AgreementPanel({
  proposalId,
  role,
  quoteCents,
}: {
  proposalId: string;
  role: "chef" | "customer";
  quoteCents: number | null;
}) {
  const [agreements, setAgreements] = useState<Agreement[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const latest = agreements[0];
  const request = async (
    method: "GET" | "POST",
    body?: Record<string, unknown>,
  ) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Sign in again to continue.");
    const response = await fetch(
      `/api/catering/agreements${method === "GET" ? `?proposalId=${proposalId}` : ""}`,
      {
        method,
        headers: {
          authorization: `Bearer ${session.access_token}`,
          ...(method === "POST" ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    const result = await response.json() as any;
    if (!response.ok)
      throw new Error(result.error || "Agreement could not be updated.");
    return result;
  };
  const load = async () => {
    try {
      const result = await request("GET");
      setAgreements(result.agreements || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load agreement.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [proposalId]);
  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await request("POST", { proposalId, ...body });
      setMessage(result.message);
      await load();
      window.dispatchEvent(
        new CustomEvent("tagos-agreement-updated", { detail: { proposalId } }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update agreement.");
    } finally {
      setBusy(false);
    }
  };
  if (loading)
    return (
      <div className="agreement-panel agreement-loading">
        Loading final terms…
      </div>
    );
  const summary = latest && (
    <div className="agreement-summary">
      <header>
        <div>
          <b>Final service agreement</b>
          <span>Revision {latest.revision}</span>
        </div>
        <em className={latest.status}>{latest.status.replaceAll("_", " ")}</em>
      </header>
      <dl>
        <div>
          <dt>Final menu</dt>
          <dd>{latest.final_menu}</dd>
        </div>
        <div>
          <dt>Service and staffing</dt>
          <dd>{latest.service_details}</dd>
        </div>
        <div>
          <dt>Timing</dt>
          <dd>{latest.event_timing}</dd>
        </div>
        <div>
          <dt>Final total</dt>
          <dd>
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(latest.total_cents / 100)}
          </dd>
        </div>
        <div>
          <dt>Cancellation terms</dt>
          <dd>{latest.cancellation_terms}</dd>
        </div>
      </dl>
      {latest.customer_change_note && (
        <div className="change-note">
          <b>Customer requested:</b> {latest.customer_change_note}
        </div>
      )}
      {agreements.length > 1 && (
        <small>
          {agreements.length - 1} earlier revision
          {agreements.length === 2 ? "" : "s"} retained in the agreement
          history.
        </small>
      )}
    </div>
  );
  if (role === "chef")
    return (
      <section className="agreement-panel">
        <div className="agreement-title">
          <FileSignature />
          <div>
            <b>Catering agreement</b>
            <span>
              {latest?.status === "accepted"
                ? "Approved terms are locked. Submit an amendment only when something changes."
                : latest?.status === "pending_customer"
                  ? "Waiting for customer approval."
                  : latest?.status === "changes_requested"
                    ? "Revise the requested item and resubmit."
                    : "Send the customer the exact terms they will approve."}
            </span>
          </div>
        </div>
        {summary}
        <form
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            act({
              action: "save_submit",
              finalMenu: f.get("final_menu"),
              serviceDetails: f.get("service_details"),
              eventTiming: f.get("event_timing"),
              totalCents: Math.round(Number(f.get("total")) * 100),
              cancellationTerms: f.get("cancellation_terms"),
            });
          }}
        >
          <label>
            Final menu
            <textarea
              name="final_menu"
              required
              minLength={5}
              defaultValue={latest?.final_menu || ""}
            />
          </label>
          <label>
            Service, delivery, setup and staffing
            <textarea
              name="service_details"
              required
              minLength={5}
              defaultValue={latest?.service_details || ""}
            />
          </label>
          <label>
            Arrival, service and completion times
            <input
              name="event_timing"
              required
              minLength={5}
              defaultValue={latest?.event_timing || ""}
            />
          </label>
          <label>
            Final total
            <input
              name="total"
              type="number"
              min="0.01"
              step="0.01"
              required
              defaultValue={(
                (latest?.total_cents || quoteCents || 0) / 100
              ).toFixed(2)}
            />
          </label>
          <label>
            Cancellation and change terms
            <textarea
              name="cancellation_terms"
              required
              minLength={5}
              defaultValue={
                latest?.cancellation_terms ||
                "Customer-approved changes must be recorded through TaGo's. Cancellation terms are as stated here."
              }
            />
          </label>
          <button disabled={busy}>
            <RefreshCw />
            {busy
              ? "Sending…"
              : latest?.status === "accepted"
                ? "Submit amended terms"
                : "Send for customer approval"}
          </button>
        </form>
        {message && <p className="agreement-message">{message}</p>}
        {error && <p className="agreement-error">{error}</p>}
      </section>
    );
  return (
    <section className="agreement-panel">
      <div className="agreement-title">
        <FileSignature />
        <div>
          <b>Final catering agreement</b>
          <span>
            {!latest
              ? "Waiting for the chef to submit final terms."
              : latest.status === "pending_customer"
                ? "Review every detail before approving payment."
                : latest.status === "changes_requested"
                  ? "Your requested changes are with the chef."
                  : latest.status === "accepted"
                    ? "These terms are approved and locked."
                    : "Review the latest terms."}
          </span>
        </div>
      </div>
      {summary}
      {latest?.status === "pending_customer" && (
        <div className="agreement-actions">
          <button
            className="accept"
            disabled={busy}
            onClick={() => act({ action: "accept" })}
          >
            <Check />
            Accept final terms
          </button>
          <ChangeForm
            busy={busy}
            onSubmit={(note) =>
              act({ action: "request_change", changeNote: note })
            }
          />
        </div>
      )}
      {latest?.status === "accepted" && (
        <ChangeForm
          busy={busy}
          amendment
          onSubmit={(note) =>
            act({ action: "request_change", changeNote: note })
          }
        />
      )}{" "}
      {message && <p className="agreement-message">{message}</p>}
      {error && <p className="agreement-error">{error}</p>}
    </section>
  );
}
function ChangeForm({
  busy,
  amendment,
  onSubmit,
}: {
  busy: boolean;
  amendment?: boolean;
  onSubmit: (note: string) => void;
}) {
  return (
    <form
      className="change-form"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget,
          note = String(new FormData(form).get("change_note") || "");
        onSubmit(note);
        form.reset();
      }}
    >
      <label>
        {amendment ? "Request an amendment" : "Need something changed?"}
        <textarea
          name="change_note"
          required
          minLength={5}
          placeholder="State the exact menu, timing, service, price, or cancellation change needed."
        />
      </label>
      <button disabled={busy}>
        {amendment ? "Request new revision" : "Send change request"}
      </button>
    </form>
  );
}
