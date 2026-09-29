"use client";
import { useEffect, useState } from "react";
import { Building2, ChefHat, ExternalLink, Mail, MapPin, Phone, ShieldCheck, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import PublicHeader from "../../public-header";
import "../../public-marketplace.css";
import "./storefront.css";
import "./reviews.css";
type Profile = {
  business_id: string;
  business_name: string;
  public_description: string | null;
  service_area: string | null;
  food_categories: string[];
  menu_summary: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  catering_available: boolean;
};
type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price_cents: number;
  photo_url: string | null;
};
type Review = {
  id: string;
  rating: number;
  review_text: string;
  created_at: string;
};
type ApprovedKitchen = { kitchen_id:string; kitchen_name:string; address_line1:string; city:string; region:string };
const money = (c: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    c / 100,
  );
export default function ChefStorefront() {
  const [profile, setProfile] = useState<Profile | null>(null),
    [items, setItems] = useState<MenuItem[]>([]),
    [reviews, setReviews] = useState<Review[]>([]),
    [kitchens, setKitchens] = useState<ApprovedKitchen[]>([]),
    [state, setState] = useState<"loading" | "ready" | "missing">("loading"),
    [error, setError] = useState("");
  useEffect(() => {
    async function load() {
      const id = decodeURIComponent(
        location.pathname.split("/").filter(Boolean).pop() || "",
      );
      const [p, m, r, k] = await Promise.all([
        supabase
          .from("business_public_profiles")
          .select(
            "business_id,business_name,public_description,service_area,food_categories,menu_summary,contact_email,contact_phone,catering_available",
          )
          .eq("business_id", id)
          .eq("is_published", true)
          .maybeSingle(),
        supabase
          .from("menu_items")
          .select("id,name,description,category,price_cents,photo_url")
          .eq("business_id", id)
          .eq("available", true)
          .order("sort_order")
          .order("created_at"),
        supabase
          .from("chef_reviews")
          .select("id,rating,review_text,created_at")
          .eq("business_id", id)
          .order("created_at", { ascending: false }),
        supabase.rpc("get_public_chef_kitchens", { p_business_id: id }),
      ]);
      if (p.error || m.error || r.error || k.error)
        setError(
          p.error?.message || m.error?.message || r.error?.message || k.error?.message || "",
        );
      if (!p.data) {
        setState("missing");
        return;
      }
      setProfile(p.data as Profile);
      setItems((m.data || []) as MenuItem[]);
      setReviews((r.data || []) as Review[]);
      setKitchens((k.data || []) as ApprovedKitchen[]);
      setState("ready");
    }
    load();
  }, []);
  if (state === "loading")
    return (
      <Shell>
        <div className="storefront-state">Loading chef storefront…</div>
      </Shell>
    );
  if (state === "missing" || !profile)
    return (
      <Shell>
        <div className="storefront-state">
          <ChefHat />
          <h1>This storefront is not public.</h1>
          <p>
            The chef may still be preparing their profile or may have removed it
            from public view.
          </p>
          <a href="/food-businesses">Browse public chefs</a>
        </div>
      </Shell>
    );
  const hero = items.find((x) => x.photo_url)?.photo_url;
  const average = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;
  return (
    <Shell>
      <a className="storefront-back" href="/food-businesses">
        ← All chefs and food businesses
      </a>
      <section className="storefront-hero">
        <div className="storefront-copy">
          <p>TAGO&apos;S VERIFIED FOOD BUSINESS</p>
          <h1>{profile.business_name}</h1>
          <span>
            {profile.public_description ||
              profile.menu_summary ||
              "Independent food business cooking through the TaGo's network."}
          </span>
          <div className="storefront-facts">
            {profile.service_area && (
              <b>
                <MapPin />
                Serves {profile.service_area}
              </b>
            )}
            <b>
              <ShieldCheck />
              Approved TaGo&apos;s business
            </b>
            {profile.catering_available && (
              <b>
                <ChefHat />
                Available for catering
              </b>
            )}
            {reviews.length > 0 && (
              <b>
                <Star />
                {average.toFixed(1)} from {reviews.length} verified review
                {reviews.length === 1 ? "" : "s"}
              </b>
            )}
          </div>
          <div className="storefront-contact">
            {profile.contact_email && (
              <a href={`mailto:${profile.contact_email}`}>
                <Mail />
                Email this chef
              </a>
            )}
            {profile.contact_phone && (
              <a href={`tel:${profile.contact_phone}`}>
                <Phone />
                Call this chef
              </a>
            )}
            <a href="/catering">Post a general request</a>
          </div>
        </div>
        <div className={hero ? "storefront-photo" : "storefront-photo empty"}>
          {hero ? (
            <img src={hero} alt={`Food prepared by ${profile.business_name}`} />
          ) : (
            <>
              <ChefHat />
              <span>Menu photography coming soon</span>
            </>
          )}
        </div>
      </section>
      {error && <div className="form-note form-error-note">{error}</div>}
      <section className="storefront-body">
        <div>
          <p className="public-kicker">MENU</p>
          <h2>What&apos;s cooking</h2>
          <span>
            {profile.menu_summary ||
              "Contact this chef for current menu details and availability."}
          </span>
        </div>
        {items.length ? (
          <div className="storefront-menu">
            {items.map((item) => (
              <article key={item.id}>
                {item.photo_url ? (
                  <img src={item.photo_url} alt={item.name} />
                ) : (
                  <div className="menu-placeholder">
                    <ChefHat />
                  </div>
                )}
                <div>
                  <span>{item.category || "Menu item"}</span>
                  <h3>{item.name}</h3>
                  <p>
                    {item.description ||
                      "Contact the chef for ingredients, portions, and availability."}
                  </p>
                  <b>{money(item.price_cents)}</b>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="storefront-empty-menu">
            This chef has not published individual menu items yet.
          </div>
        )}
      </section>
      {kitchens.length > 0 && <section className="chef-kitchen-links"><header><p className="public-kicker">APPROVED KITCHENS</p><h2>Where this chef cooks</h2></header><div>{kitchens.map((kitchen)=><a key={kitchen.kitchen_id} href={`/kitchens/${kitchen.kitchen_id}`} target="_blank" rel="noopener noreferrer"><Building2/><span><b>{kitchen.kitchen_name}</b><small>{kitchen.address_line1}, {kitchen.city}, {kitchen.region}</small></span><ExternalLink/></a>)}</div></section>}
      <section className="storefront-reviews">
        <header>
          <div>
            <p className="public-kicker">VERIFIED REVIEWS</p>
            <h2>What customers say</h2>
          </div>
          {reviews.length > 0 && (
            <strong>
              <Star />
              {average.toFixed(1)}
            </strong>
          )}
        </header>
        {reviews.length ? (
          <div className="review-list">
            {reviews.map((review) => (
              <article key={review.id}>
                <div
                  className="review-stars"
                  aria-label={`${review.rating} out of 5 stars`}
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={i < review.rating ? "filled" : ""}
                    />
                  ))}
                </div>
                <p>{review.review_text}</p>
                <span>
                  <ShieldCheck />
                  Verified catering customer ·{" "}
                  {new Date(review.created_at).toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <div className="storefront-empty-menu">
            No verified customer reviews yet.
          </div>
        )}
      </section>
      <section className="storefront-trust">
        <ShieldCheck />
        <div>
          <h2>Profile controlled by the food business.</h2>
          <p>
            Menus, contact information, service areas, and images are published
            by the business. Reviews can only come from verified TaGo&apos;s
            catering matches. Private kitchen schedules, credentials, and
            internal records remain protected.
          </p>
        </div>
      </section>
    </Shell>
  );
}
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="public-page chef-storefront">
      <PublicHeader />
      <section className="storefront-main">{children}</section>
    </main>
  );
}
