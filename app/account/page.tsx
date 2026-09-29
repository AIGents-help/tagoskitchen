"use client";
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */

import { FormEvent, useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  Check,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  FileCheck2,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  ShieldCheck,
  Upload,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isChefBusiness, isKitchenProviderBusiness } from "@/lib/workspace-business";
import Breadcrumbs from "../breadcrumbs";
import "./account.css";
import "./loading.css";
import "./credential-renewal.css";
import "./workspaces.css";

type Account = {
  businessId: string;
  fullName: string;
  phone: string;
  businessName: string;
  businessType: string;
  status: "draft" | "submitted" | "approved" | "rejected" | "suspended";
  visibility: "visible" | "blocked";
};

type Credential = {
  id: string;
  credential_type: string;
  status: string;
  expires_on: string | null;
  reviewer_note: string | null;
};
type WorkspaceBusiness = {
  id: string;
  name: string;
  business_type: string;
  compliance_status: Account["status"];
  schedule_identity_visibility: "visible" | "blocked";
};

const credentialLabels: Record<string, string> = {
  food_handler_card: "Food-handler card",
  liability_insurance: "Liability insurance",
  business_license: "Business license",
  menu_process: "Menu & process documents",
};

const safeReturnPath = (value: string | null) =>
  value?.startsWith("/") && !value.startsWith("//") ? value : null;

const confirmationUrl = (returnTo: string | null) => {
  const url = new URL("/account", "https://www.tagoskitchen.com");
  if (returnTo) url.searchParams.set("returnTo", returnTo);
  return url.toString();
};

export default function AccountPage() {
  const [sessionUser, setSessionUser] = useState<{
    id: string;
    email?: string;
  } | null>(null);
  const [mode, setMode] = useState<"signin" | "signup" | "recovery">("signup");
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [expirationDates, setExpirationDates] = useState<
    Record<string, string>
  >({});
  const [busy, setBusy] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [workspaceBusinesses, setWorkspaceBusinesses] = useState<
    WorkspaceBusiness[]
  >([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function signOut() {
    await supabase.auth.signOut();
    window.location.replace("/");
  }

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const requestedMode = search.get("mode");
    const requestedReturnTo = safeReturnPath(search.get("returnTo"));
    if (requestedMode === "signin") {
      queueMicrotask(() => setMode("signin"));
    }
    if (requestedMode === "reset") {
      queueMicrotask(() => setPasswordRecovery(true));
    }
    const continueWithUser = async (user: { id: string; email?: string }) => {
      setSessionUser({ id: user.id, email: user.email });
      await loadAccount(user.id);
      if (requestedReturnTo && requestedMode !== "reset")
        window.location.replace(requestedReturnTo);
    };
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (user) void continueWithUser(user);
      else setSessionUser(null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (_event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      const user = next?.user;
      if (user) setTimeout(() => void continueWithUser(user), 0);
      else {
        setAccount(null);
        setCredentials([]);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function loadAccount(userId: string) {
    await supabase.rpc("claim_sponsored_chef_profile");
    const [{ data: profile }, { data: staff }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name,phone")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("platform_staff")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    setIsStaff(!!staff);
    const { data: businesses, error: workspaceError } =
      await supabase.rpc("get_my_workspaces");
    if (workspaceError) setError(workspaceError.message);
    const owned = (
      (businesses || []) as (WorkspaceBusiness & { member_role: string })[]
    ).filter((business) => business.member_role === "owner");
    setWorkspaceBusinesses(owned);
    const requestedBusiness = new URLSearchParams(window.location.search).get(
      "business",
    );
    const business =
      owned.find((item) => item.id === requestedBusiness) ||
      owned.find(isChefBusiness) ||
      owned[0];
    if (!business) {
      setAccount({
        businessId: "",
        fullName: profile?.full_name || "",
        phone: profile?.phone || "",
        businessName: "",
        businessType: "",
        status: "draft",
        visibility: "visible",
      });
      return;
    }
    setAccount({
      businessId: business.id,
      fullName: profile?.full_name || "",
      phone: profile?.phone || "",
      businessName: business.name,
      businessType: business.business_type || "",
      status: business.compliance_status,
      visibility: business.schedule_identity_visibility,
    });
    const { data: docs } = await supabase
      .from("credentials")
      .select("id,credential_type,status,expires_on,reviewer_note")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false });
    setCredentials((docs || []) as Credential[]);
  }

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const fullName = String(form.get("fullName") || "").trim();
    const returnTo = safeReturnPath(
      new URLSearchParams(window.location.search).get("returnTo"),
    );
    if (mode === "recovery") {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo: "https://www.tagoskitchen.com/account?mode=reset" },
      );
      if (resetError) setError(resetError.message);
      else
        setMessage(
          "Password reset email sent. Open the link in that email to choose a new password.",
        );
      setBusy(false);
      return;
    }
    const result =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: fullName },
              emailRedirectTo: confirmationUrl(returnTo),
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) setError(result.error.message);
    else if (mode === "signup" && !result.data.session)
      setMessage(
        "Account created. Check your email to confirm it, then return here to sign in.",
      );
    else {
      if (returnTo)
        window.location.replace(returnTo);
      else
        setMessage(
          mode === "signup"
            ? "Account created. Complete your Kitchen Passport below."
            : "Signed in.",
        );
    }
    setBusy(false);
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget),
      password = String(form.get("password") || "");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) setError(updateError.message);
    else {
      setPasswordRecovery(false);
      setMessage("Password updated. You are signed in.");
    }
    setBusy(false);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionUser) return;
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const values = {
      p_full_name: String(form.get("fullName") || ""),
      p_phone: String(form.get("phone") || ""),
      p_business_name: String(form.get("businessName") || ""),
      p_business_type: String(form.get("businessType") || ""),
      p_visibility: String(form.get("visibility") || "visible"),
    };
    const { error: saveError } = await supabase.rpc(
      "complete_renter_onboarding",
      values,
    );
    if (saveError) setError(saveError.message);
    else {
      setMessage("Kitchen Passport saved securely.");
      await loadAccount(sessionUser.id);
    }
    setBusy(false);
  }

  async function uploadCredential(
    type: string,
    expiresOn: string,
    file?: File,
  ) {
    if (!sessionUser || !account?.businessId || !file) return;
    setBusy(true);
    setError("");
    setMessage("");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${sessionUser.id}/${account.businessId}/${type}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("business-credentials")
      .upload(path, file, { upsert: false });
    if (uploadError) {
      setError(uploadError.message);
      setBusy(false);
      return;
    }
    const { error: recordError } = await supabase.from("credentials").insert({
      business_id: account.businessId,
      credential_type: type,
      document_path: path,
      expires_on: expiresOn || null,
      status: "pending",
    });
    if (recordError) setError(recordError.message);
    else {
      setMessage(`${credentialLabels[type]} submitted for private review.`);
      await loadAccount(sessionUser.id);
    }
    setBusy(false);
  }

  async function submitForReview() {
    if (!account?.businessId || !sessionUser) return;
    setBusy(true);
    setError("");
    const { error: reviewError } = await supabase.rpc(
      "submit_business_for_review",
      { p_business_id: account.businessId },
    );
    if (reviewError) setError(reviewError.message);
    else {
      setMessage(
        "Submitted to TaGo's for review. We will notify you when a decision is made.",
      );
      await loadAccount(sessionUser.id);
    }
    setBusy(false);
  }

  if (passwordRecovery)
    return (
      <main className="account-page">
        <header>
          <a href="/">
            <img src="/tagos-kitchen-logo.png" alt="TaGo's Kitchen" />
          </a>
          <a href="/">Back to marketplace</a>
        </header>
        <Breadcrumbs items={[{label:"Account",href:"/account"}, "Reset password"]} />
        <section className="auth-shell">
          <div className="auth-story">
            <img src="/tagos-pin-mascot.png" alt="" />
            <p>ACCOUNT RECOVERY</p>
            <h1>Choose a new password.</h1>
            <span>
              Use at least eight characters and do not reuse a password from
              another service.
            </span>
          </div>
          <form className="auth-card" onSubmit={updatePassword}>
            <p>SECURE RESET</p>
            <h2>New password</h2>
            <label>
              Password
              <input
                name="password"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </label>
            {error && (
              <div className="form-error">
                <AlertCircle />
                {error}
              </div>
            )}
            <button disabled={busy}>
              {busy ? "Updating…" : "Update password"}
              <ChevronRight />
            </button>
          </form>
        </section>
      </main>
    );

  if (!sessionUser)
    return (
      <main className="account-page">
        <header>
          <a href="/">
            <img src="/tagos-kitchen-logo.png" alt="TaGo's Kitchen" />
          </a>
          <a href="/">Back to marketplace</a>
        </header>
        <Breadcrumbs
          items={[
            {label:"Account",href:"/account"},
            mode === "signin"
              ? "Log in"
              : mode === "recovery"
                ? "Reset password"
                : "Create profile",
          ]}
        />
        <section className="auth-shell">
          <div className="auth-story">
            <img src="/tagos-pin-mascot.png" alt="TaGo's map pin mascot" />
            <p>KITCHEN PASSPORT</p>
            <h1>
              Get approved.
              <br />
              Get cooking.
            </h1>
            <span>
              Create one secure profile, submit your paperwork, and unlock
              TaGo&apos;s private equipment schedule after approval.
            </span>
            <ul>
              <li>
                <ShieldCheck /> Private credential storage
              </li>
              <li>
                <Clock3 /> Clear approval status
              </li>
              <li>
                <LockKeyhole /> Members-only scheduling
              </li>
            </ul>
          </div>
          <form className="auth-card" onSubmit={authenticate}>
            <p>
              {mode === "signup"
                ? "CREATE YOUR PROFILE"
                : mode === "recovery"
                  ? "ACCOUNT RECOVERY"
                  : "WELCOME BACK"}
            </p>
            <h2>
              {mode === "signup"
                ? "Start your Kitchen Passport"
                : mode === "recovery"
                  ? "Reset your password"
                  : "Sign in to your workspace"}
            </h2>
            {mode === "signup" && (
              <label>
                Full name
                <input name="fullName" required autoComplete="name" />
              </label>
            )}
            <label>
              Email
              <input name="email" type="email" required autoComplete="email" />
            </label>
            {mode !== "recovery" && (
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  minLength={8}
                  required
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                />
              </label>
            )}
            {error && (
              <div className="form-error">
                <AlertCircle />
                {error}
              </div>
            )}
            {message && (
              <div className="form-message">
                <Check />
                {message}
              </div>
            )}
            <button disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "signup"
                  ? "Create my profile"
                  : mode === "recovery"
                    ? "Send reset email"
                    : "Sign in"}
              <ChevronRight />
            </button>
            <button
              type="button"
              className="mode-link"
              onClick={() => {
                setMode(mode === "signup" ? "signin" : "signup");
                setError("");
                setMessage("");
              }}
            >
              {mode === "signup"
                ? "Already have an account? Sign in"
                : mode === "recovery"
                  ? "Back to sign in"
                  : "New to TaGo's? Create a profile"}
            </button>
            {mode === "signin" && (
              <button
                type="button"
                className="mode-link"
                onClick={() => {
                  setMode("recovery");
                  setError("");
                  setMessage("");
                }}
              >
                Forgot your password?
              </button>
            )}
          </form>
        </section>
      </main>
    );

  if (!account)
    return (
      <main className="account-page">
        <header>
          <a href="/">
            <img src="/tagos-kitchen-logo.png" alt="TaGo's Kitchen" />
          </a>
        </header>
        <div className="account-loading">
          <img src="/tagos-pin-mascot.png" alt="" />
          <b>Loading your Kitchen Passport…</b>
        </div>
      </main>
    );

  const statusCopy = {
    draft: "Complete your profile and upload your food-handler card.",
    submitted: "TaGo's is reviewing your paperwork.",
    approved: "Approved—your Inner Schedule access is unlocked.",
    rejected: "Changes are needed. Review the notes and resubmit.",
    suspended: "Schedule access is paused. Contact TaGo's.",
  }[account.status];
  const requiredTypes = [
    "food_handler_card",
    "liability_insurance",
    "business_license",
  ];
  const readyForReview = requiredTypes.every((type) => {
    const doc = credentials.find(
      (c) =>
        c.credential_type === type &&
        ["pending", "approved"].includes(c.status),
    );
    return (
      !!doc &&
      (type === "business_license" || !!doc.expires_on) &&
      (!doc.expires_on ||
        doc.expires_on >= new Date().toISOString().slice(0, 10))
    );
  });
  const accessReady =
    account.status === "approved" &&
    requiredTypes.every((type) => {
      const doc = credentials.find(
        (c) => c.credential_type === type && c.status === "approved",
      );
      return (
        !!doc &&
        (type === "business_license" || !!doc.expires_on) &&
        (!doc.expires_on ||
          doc.expires_on >= new Date().toISOString().slice(0, 10))
      );
    });
  const profileReady = Boolean(account.fullName && account.businessName && account.businessType);
  const submittedDocuments = requiredTypes.filter((type) => credentials.some((c) => c.credential_type === type && ["pending", "approved"].includes(c.status))).length;
  const onboardingSteps = [
    { label: "Business profile", detail: profileReady ? "Complete" : "Missing information", done: profileReady, href: "#business-profile" },
    { label: "Required documents", detail: `${submittedDocuments} of ${requiredTypes.length} submitted`, done: submittedDocuments === requiredTypes.length, href: "#compliance-vault" },
    { label: "TaGo's review", detail: account.status === "approved" ? "Approved" : account.status === "submitted" ? "Under review" : account.status === "rejected" ? "Changes requested" : "Not submitted", done: account.status === "approved", href: "#compliance-vault" },
    { label: "Booking access", detail: accessReady ? "Unlocked" : "Locked", done: accessReady, href: "#booking-access" },
  ];
  const nextStep = onboardingSteps.find((step) => !step.done);
  const manageProfile =
    new URLSearchParams(window.location.search).get("manage") === "1";
  const providerBusinesses = workspaceBusinesses.filter(isKitchenProviderBusiness);
  const chefBusinesses = workspaceBusinesses.filter(isChefBusiness);
  if (
    !manageProfile &&
    (isStaff || providerBusinesses.length > 0 || workspaceBusinesses.length > 1)
  )
    return (
      <main className="account-page">
        <header>
          <a href="/">
            <img src="/tagos-kitchen-logo.png" alt="TaGo's Kitchen" />
          </a>
          <div>
            <span>{sessionUser.email}</span>
            <button onClick={signOut}>
              <LogOut /> Sign out
            </button>
          </div>
        </header>
        <Breadcrumbs items={[{label:"Account",href:"/account"}, "Choose workspace"]} />
        <section className="workspace-home">
          <p>YOUR AUTHORIZED WORKSPACES</p>
          <h1>Which hat are you wearing?</h1>
          <span>
            The same secure login can hold more than one role. Each workspace
            exposes only the controls assigned to that role.
          </span>
          <div className="workspace-cards">
            <a href="/customer">
              <UtensilsCrossed />
              <div>
                <b>Personal &amp; business food needs</b>
                <strong>Customer Workspace</strong>
                <span>Find chefs, post food-service needs, compare proposals, and manage your requests.</span>
              </div>
              <ChevronRight />
            </a>
            {isStaff && (
              <a href="/chef?admin=1">
                <UserRound />
                <div>
                  <b>Chef operations</b>
                  <strong>Chef Workspace</strong>
                  <span>
                    Enter the chef experience, then select the chef or food
                    business context you need to review.
                  </span>
                </div>
                <ChevronRight />
              </a>
            )}
            {!isStaff && chefBusinesses.map((item) => (
              <a key={item.id} href={`/chef?business=${item.id}`}>
                <UserRound />
                <div>
                  <b>{item.name}</b>
                  <strong>Chef Workspace</strong>
                  <span>
                    Manage bookings, your Kitchen Passport, menus, promotions,
                    events and business opportunities.
                  </span>
                </div>
                <ChevronRight />
              </a>
            ))}
            {providerBusinesses.map((item) => (
              <a key={item.id} href={`/host/dashboard?business=${item.id}`}>
                <Building2 />
                <div>
                  <b>Kitchen operations</b>
                  <strong>Kitchen Workspace</strong>
                  <span>
                    Manage the facility, listing, equipment, hours, booking
                    approvals, maintenance and payouts.
                  </span>
                </div>
                <ChevronRight />
              </a>
            ))}
            {isStaff && (
              <a href="/admin">
                <LayoutDashboard />
                <div>
                  <b>TaGo&apos;s Kitchen Platform</b>
                  <strong>Platform Admin</strong>
                  <span>
                    Approve chefs and kitchens, oversee payments and
                    commissions, manage escalations and monitor the network.
                  </span>
                </div>
                <ChevronRight />
              </a>
            )}
          </div>
        </section>
      </main>
    );
  return (
    <main className="account-page">
      <header>
        <a href="/">
          <img src="/tagos-kitchen-logo.png" alt="TaGo's Kitchen" />
        </a>
        <div>
          <span>{sessionUser.email}</span>
          <button onClick={signOut}>
            <LogOut /> Sign out
          </button>
        </div>
      </header>
      <Breadcrumbs items={[{label:"Account",href:"/account"}, "Kitchen Passport"]} />
      <div className="passport-head">
        <div>
          <p>YOUR KITCHEN PASSPORT</p>
          <h1>Profile & credentials</h1>
          <span>
            Your paperwork is private. Only you and authorized TaGo&apos;s
            reviewers can access it.
          </span>
        </div>
        <div className={`status-badge ${account?.status || "draft"}`}>
          <b>{(account?.status || "draft").toUpperCase()}</b>
          <span>{statusCopy}</span>
        </div>
      </div>
      {error && (
        <div className="page-alert error">
          <AlertCircle />
          {error}
        </div>
      )}
      {message && (
        <div className="page-alert">
          <Check />
          {message}
        </div>
      )}
      <section className="onboarding-progress" aria-label="Kitchen Passport progress">
        <header><div><p>YOUR NEXT STEP</p><h2>{nextStep?.label || "Kitchen Passport complete"}</h2><span>{nextStep ? nextStep.detail : "You are ready to book kitchens and use the chef workspace."}</span></div>{nextStep && <a href={nextStep.href}>Continue <ChevronRight /></a>}</header>
        <ol>{onboardingSteps.map((step,index)=><li className={step.done?"complete":""} key={step.label}><span>{step.done?<Check/>:index+1}</span><div><b>{step.label}</b><small>{step.detail}</small></div></li>)}</ol>
      </section>
      <div className="account-grid">
        <form className="profile-form" id="business-profile" onSubmit={saveProfile}>
          <div className="section-title">
            <UserRound />
            <div>
              <p>STEP 1</p>
              <h2>Business profile</h2>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Your full name
              <input
                name="fullName"
                required
                defaultValue={account?.fullName}
              />
            </label>
            <label>
              Phone
              <input name="phone" type="tel" defaultValue={account?.phone} />
            </label>
            <label>
              Business or brand name
              <input
                name="businessName"
                required
                defaultValue={account?.businessName}
              />
            </label>
            <label>
              Business type
              <select name="businessType" defaultValue={account?.businessType}>
                <option value="">Select one</option>
                <option>Caterer</option>
                <option>Food truck</option>
                <option>Baker</option>
                <option>Meal prep</option>
                <option>Pop-up chef</option>
                <option>Packaged food</option>
              </select>
            </label>
          </div>
          <fieldset>
            <legend>Inner Schedule privacy</legend>
            <label className="privacy-option">
              <input
                type="radio"
                name="visibility"
                value="visible"
                defaultChecked={account?.visibility !== "blocked"}
              />
              <Eye />
              <span>
                <b>Show my brand</b>Approved chefs can see your brand and
                contact you about swaps.
              </span>
            </label>
            <label className="privacy-option">
              <input
                type="radio"
                name="visibility"
                value="blocked"
                defaultChecked={account?.visibility === "blocked"}
              />
              <EyeOff />
              <span>
                <b>Show only “Reserved”</b>Your identity stays hidden from
                peers; admins always see it.
              </span>
            </label>
          </fieldset>
          <button className="primary" disabled={busy}>
            Save profile <ChevronRight />
          </button>
        </form>
        <section className="vault" id="compliance-vault">
          <div className="section-title">
            <FileCheck2 />
            <div>
              <p>STEP 2</p>
              <h2>Compliance vault</h2>
            </div>
          </div>
          <p className="vault-intro">
            PDF, JPG, or PNG • 10 MB maximum • encrypted private storage
          </p>
          {Object.entries(credentialLabels).map(([type, label]) => {
            const doc = credentials.find((c) => c.credential_type === type),
              needsExpiration =
                type === "food_handler_card" || type === "liability_insurance",
              expired =
                !!doc?.expires_on &&
                doc.expires_on < new Date().toISOString().slice(0, 10);
            return (
              <article key={type}>
                <div className={`doc-state ${doc?.status || "missing"}`}>
                  {doc?.status === "approved" ? (
                    <Check />
                  ) : doc ? (
                    <Clock3 />
                  ) : (
                    <Upload />
                  )}
                </div>
                <div>
                  <b>{label}</b>
                  <span>
                    {doc
                      ? `${expired ? "Expired" : doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}${doc.expires_on ? ` • expires ${doc.expires_on}` : " • no expiration entered"}`
                      : "Not submitted"}
                  </span>
                  {doc?.reviewer_note && (
                    <small className="reviewer-note">
                      Reviewer: {doc.reviewer_note}
                    </small>
                  )}
                </div>
                <div className="credential-upload">
                  <label>
                    {needsExpiration
                      ? "Expiration date"
                      : "Expiration (if any)"}
                    <input
                      type="date"
                      min={new Date().toISOString().slice(0, 10)}
                      value={expirationDates[type] || ""}
                      required={needsExpiration}
                      onChange={(e) =>
                        setExpirationDates((v) => ({
                          ...v,
                          [type]: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="upload-button">
                    {doc ? "Upload renewal" : "Upload"}
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      disabled={
                        busy ||
                        !account?.businessId ||
                        (needsExpiration && !expirationDates[type])
                      }
                      onChange={(e) =>
                        uploadCredential(
                          type,
                          expirationDates[type] || "",
                          e.target.files?.[0],
                        )
                      }
                    />
                  </label>
                </div>
              </article>
            );
          })}
          <button
            className="review-button"
            onClick={submitForReview}
            disabled={
              busy ||
              !account?.businessId ||
              !readyForReview ||
              account?.status === "submitted" ||
              account?.status === "approved"
            }
          >
            Submit for approval <ChevronRight />
          </button>
          <small>
            Food-handler certification, liability insurance, and a business
            license are required. Expiration dates are mandatory for food-safety
            and insurance documents.
          </small>
        </section>
      </div>
      <section id="booking-access" className={`access-card ${accessReady ? "unlocked" : ""}`}>
        <img src="/tagos-pin-mascot.png" alt="" />
        <div>
          <p>STEP 3</p>
          <h2>
            {accessReady
              ? "Your Inner Schedule is unlocked"
              : account.status === "approved"
                ? "Renew credentials to restore booking access"
                : "Approval unlocks the Inner Schedule"}
          </h2>
          <span>
            Only approved resident chefs can see kitchen and equipment
            availability. The public calendar remains promotional events only.
          </span>
        </div>
        <a href={accessReady ? "/chef" : "#"}>
          {accessReady
            ? "Open Chef Workspace"
            : account.status === "approved"
              ? "Renewal required"
              : "Waiting for approval"}
          <ChevronRight />
        </a>
      </section>
    </main>
  );
}
