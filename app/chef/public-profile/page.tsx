"use client";
import { FormEvent, useEffect, useState } from "react";
import { Check, ImagePlus, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isChefBusiness } from "@/lib/workspace-business";
import PublicHeader from "../../public-header";
import "../../public-marketplace.css";
import "./profile.css";
type Business = {
  id: string;
  name: string;
  business_type: string;
  compliance_status: string;
  member_role: string;
};
type Profile = {
  business_name: string;
  public_description: string | null;
  service_area: string | null;
  food_categories: string[];
  menu_summary: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  catering_available: boolean;
  is_published: boolean;
};
type Item = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price_cents: number;
  photo_url: string | null;
  available: boolean;
};
const money = (c: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    c / 100,
  );
export default function ManagePublicProfile() {
  const [business, setBusiness] = useState<Business | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [items, setItems] = useState<Item[]>([]),
    [state, setState] = useState("loading"),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setState("signed_out");
      return;
    }
    const { data, error: workspaceError } =
      await supabase.rpc("get_my_workspaces");
    const requested = new URLSearchParams(window.location.search).get(
      "business",
    );
    const owned = ((data || []) as Business[]).filter(
      (b) => b.member_role === "owner" && isChefBusiness(b),
    );
    const selected = owned.find((b) => b.id === requested) || owned[0];
    if (workspaceError) {
      setError(workspaceError.message);
      setState("ready");
      return;
    }
    if (!selected) {
      setState("no_business");
      return;
    }
    setBusiness(selected);
    const [p, m] = await Promise.all([
      supabase
        .from("business_public_profiles")
        .select(
          "business_name,public_description,service_area,food_categories,menu_summary,contact_email,contact_phone,catering_available,is_published",
        )
        .eq("business_id", selected.id)
        .maybeSingle(),
      supabase
        .from("menu_items")
        .select("id,name,description,category,price_cents,photo_url,available")
        .eq("business_id", selected.id)
        .order("sort_order")
        .order("created_at"),
    ]);
    if (p.error || m.error)
      setError(p.error?.message || m.error?.message || "");
    setProfile(p.data as Profile | null);
    setItems((m.data || []) as Item[]);
    setState("ready");
  };
  useEffect(() => {
    load();
  }, []);
  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!business) return;
    setMessage("");
    setError("");
    const f = new FormData(e.currentTarget),
      published = f.get("is_published") === "on",
      email = String(f.get("contact_email") || "").trim(),
      phone = String(f.get("contact_phone") || "").trim();
    if (published && !email && !phone) {
      setError("Add a contact email or phone before publishing.");
      return;
    }
    setBusy(true);
    const { error: x } = await supabase.from("business_public_profiles").upsert(
      {
        business_id: business.id,
        business_name: String(f.get("business_name") || business.name),
        public_description: String(f.get("public_description") || "") || null,
        service_area: String(f.get("service_area") || "") || null,
        food_categories: String(f.get("food_categories") || "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        menu_summary: String(f.get("menu_summary") || "") || null,
        contact_email: email || null,
        contact_phone: phone || null,
        catering_available: f.get("catering_available") === "on",
        is_published: published,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id" },
    );
    setError(x?.message || "");
    if (!x) setMessage("Public profile saved.");
    setBusy(false);
  }
  async function addItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!business) return;
    setBusy(true);
    setError("");
    const form = e.currentTarget,
      f = new FormData(form),
      file = f.get("photo") as File;
    let photo_url: string | null = null;
    if (file?.size) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const path = `${user!.id}/${business.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const upload = await supabase.storage
        .from("menu-images")
        .upload(path, file);
      if (upload.error) {
        setError(upload.error.message);
        setBusy(false);
        return;
      }
      photo_url = supabase.storage.from("menu-images").getPublicUrl(path)
        .data.publicUrl;
    }
    const { error: x } = await supabase
      .from("menu_items")
      .insert({
        business_id: business.id,
        name: f.get("name"),
        description: f.get("description") || null,
        category: f.get("category") || null,
        price_cents: Math.round(Number(f.get("price") || 0) * 100),
        photo_url,
        available: true,
      });
    if (x) setError(x.message);
    else {
      form.reset();
      await load();
      setMessage("Menu item saved.");
    }
    setBusy(false);
  }
  async function toggle(item: Item) {
    const { error: x } = await supabase
      .from("menu_items")
      .update({
        available: !item.available,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    if (x) setError(x.message);
    else {
      await load();
      setMessage(
        item.available
          ? "Menu item marked unavailable."
          : "Menu item is available again.",
      );
    }
  }
  async function remove(id: string) {
    if (!window.confirm("Remove this menu item?")) return;
    const { error: x } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", id);
    if (x) setError(x.message);
    else {
      await load();
      setMessage("Menu item removed.");
    }
  }
  if (state === "loading")
    return (
      <Shell>
        <div className="public-empty">
          <h2>Loading your storefront…</h2>
        </div>
      </Shell>
    );
  if (state === "signed_out")
    return (
      <Shell>
        <div className="public-empty">
          <h2>Log in to manage your storefront.</h2>
          <a href="/account?mode=signin&returnTo=/chef/public-profile">
            Log in
          </a>
        </div>
      </Shell>
    );
  return (
    <Shell>
      <p className="public-kicker">CHEF STOREFRONT</p>
      <h1 className="public-title">Profile, menu &amp; prices</h1>
      <p className="public-lead">
        Control what customers see. Credentials, schedules, kitchen
        arrangements, and reports remain private.
      </p>
      {message && (
        <div className="form-note storefront-note">
          <Check />
          {message}
        </div>
      )}
      {error && <div className="form-note form-error-note">{error}</div>}
      {state === "no_business" ? (
        <div className="public-empty">
          <h2>Create your food-business profile first.</h2>
          <a href="/account">Open my account</a>
        </div>
      ) : (
        <>
          <form className="public-form" onSubmit={saveProfile}>
            <label>
              Public business name
              <input
                name="business_name"
                required
                defaultValue={profile?.business_name || business?.name || ""}
              />
            </label>
            <label>
              Service area
              <input
                name="service_area"
                defaultValue={profile?.service_area || ""}
                placeholder="Delaware County and nearby areas"
              />
            </label>
            <label className="wide">
              Public description
              <textarea
                name="public_description"
                defaultValue={profile?.public_description || ""}
              />
            </label>
            <label className="wide">
              Menu or service summary
              <textarea
                name="menu_summary"
                defaultValue={profile?.menu_summary || ""}
              />
            </label>
            <label className="wide">
              Food categories, separated by commas
              <input
                name="food_categories"
                defaultValue={profile?.food_categories?.join(", ") || ""}
              />
            </label>
            <label>
              Public contact email
              <input
                name="contact_email"
                type="email"
                defaultValue={profile?.contact_email || ""}
              />
            </label>
            <label>
              Public contact phone
              <input
                name="contact_phone"
                defaultValue={profile?.contact_phone || ""}
              />
            </label>
            <label className="wide check-label">
              <span>
                <input
                  name="catering_available"
                  type="checkbox"
                  defaultChecked={profile?.catering_available}
                />{" "}
                Available for catering inquiries
              </span>
            </label>
            <label className="wide check-label">
              <span>
                <input
                  name="is_published"
                  type="checkbox"
                  defaultChecked={profile?.is_published}
                />{" "}
                Publish my storefront after TaGo&apos;s approval
              </span>
            </label>
            <button disabled={busy}>Save storefront profile</button>
          </form>
          <section className="menu-manager">
            <div className="menu-heading">
              <div>
                <p className="public-kicker">YOUR MENU</p>
                <h2>Items &amp; pricing</h2>
              </div>
              <span>{items.filter((i) => i.available).length} available</span>
            </div>
            <form className="menu-add" onSubmit={addItem}>
              <label>
                Item name
                <input
                  name="name"
                  required
                  placeholder="Signature cheesesteak"
                />
              </label>
              <label>
                Category
                <input name="category" placeholder="Sandwiches" />
              </label>
              <label>
                Price
                <input
                  name="price"
                  type="number"
                  min="0"
                  step=".01"
                  required
                  placeholder="14.00"
                />
              </label>
              <label className="wide">
                Description
                <textarea
                  name="description"
                  placeholder="Portion, options, and dietary information…"
                />
              </label>
              <label className="wide photo-field">
                <ImagePlus />
                Item photo
                <input
                  name="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                />
              </label>
              <button disabled={busy}>
                <Plus />
                Add menu item
              </button>
            </form>
            <div className="menu-items">
              {items.length ? (
                items.map((item) => (
                  <article
                    key={item.id}
                    className={!item.available ? "unavailable" : ""}
                  >
                    {item.photo_url ? (
                      <img src={item.photo_url} alt={item.name} />
                    ) : (
                      <div className="menu-placeholder">
                        <ImagePlus />
                      </div>
                    )}
                    <div>
                      <span>{item.category || "Menu item"}</span>
                      <h3>{item.name}</h3>
                      <p>{item.description || "No description added."}</p>
                      <strong>{money(item.price_cents)}</strong>
                    </div>
                    <footer>
                      <button onClick={() => toggle(item)}>
                        {item.available ? "Mark unavailable" : "Restore item"}
                      </button>
                      <button
                        className="remove-item"
                        onClick={() => remove(item.id)}
                      >
                        <Trash2 />
                        Remove
                      </button>
                    </footer>
                  </article>
                ))
              ) : (
                <div className="public-empty">
                  <h2>No menu items yet.</h2>
                  <p>Add the first item customers should see.</p>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </Shell>
  );
}
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="public-page">
      <PublicHeader />
      <section className="public-main">{children}</section>
    </main>
  );
}
