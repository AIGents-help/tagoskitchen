"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PublicHeader from "../public-header";
import "../public-marketplace.css";
import "./menus.css";
import "./storefront-links.css";
type Listing = {
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
type MenuItem = { id:string; business_id:string; name:string; description:string|null; category:string|null; price_cents:number; photo_url:string|null };
const money=(c:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(c/100);
export default function FoodBusinesses() {
  const [rows, setRows] = useState<Listing[]>([]),
    [items,setItems]=useState<MenuItem[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      supabase.from("business_public_profiles").select("business_id,business_name,public_description,service_area,food_categories,menu_summary,contact_email,contact_phone,catering_available").eq("is_published", true),
      supabase.from("menu_items").select("id,business_id,name,description,category,price_cents,photo_url").eq("available",true).order("sort_order").order("created_at")
    ]).then(([profiles,menu])=>{setRows((profiles.data||[]) as Listing[]);setItems((menu.data||[]) as MenuItem[]);setError(profiles.error?.message||menu.error?.message||"");setLoading(false)});
  }, []);
  return (
    <main className="public-page">
      <PublicHeader />
      <section className="public-main">
        <p className="public-kicker">FOOD BUSINESSES</p>
        <h1 className="public-title">
          Discover approved businesses cooking through TaGo&apos;s.
        </h1>
        <p className="public-lead">
          Browse profiles businesses have chosen to publish. Credentials,
          kitchen schedules, private addresses, and internal records are never
          shown here.
        </p>
        {loading ? (
          <div className="public-empty">
            <h2>Loading food businesses…</h2>
          </div>
        ) : error ? (
          <div className="public-empty">
            <h2>Profiles are temporarily unavailable.</h2>
            <p>{error}</p>
          </div>
        ) : rows.length ? (
          <div className="public-grid">
            {rows.map((row) => (
              <article className="public-card" key={row.business_id}>
                <p className="public-kicker">
                  {row.catering_available
                    ? "AVAILABLE FOR CATERING"
                    : "PUBLIC PROFILE"}
                </p>
                <h2><a className="business-title-link" href={`/food-businesses/${row.business_id}`}>{row.business_name}</a></h2>
                <p>
                  {row.public_description ||
                    row.menu_summary ||
                    "Profile details coming soon."}
                </p>
                <div className="tags">
                  {row.food_categories.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                {items.some(item=>item.business_id===row.business_id)&&<div className="public-menu"><b>Featured menu</b>{items.filter(item=>item.business_id===row.business_id).slice(0,4).map(item=><div key={item.id}>{item.photo_url&&<img src={item.photo_url} alt=""/>}<span><strong>{item.name}</strong><small>{item.category||item.description||"Menu item"}</small></span><em>{money(item.price_cents)}</em></div>)}</div>}
                {row.service_area && <span>Serves {row.service_area}</span>}
                <br />
                <a className="view-storefront" href={`/food-businesses/${row.business_id}`}>View full profile and menu</a>
              </article>
            ))}
          </div>
        ) : (
          <div className="public-empty">
            <h2>No public profiles yet.</h2>
            <p>
              Approved businesses will appear here only after they choose to
              publish a profile. TaGo&apos;s does not create fake listings.
            </p>
            <a href="/account">Join as a food business</a>
          </div>
        )}
      </section>
    </main>
  );
}
