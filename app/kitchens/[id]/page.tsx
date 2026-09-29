"use client";

import { useEffect, useState } from "react";
import { Building2, Check, Clock3, MapPin, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabase";
import PublicHeader from "../../public-header";
import "../../public-marketplace.css";
import "../../linked-profiles.css";

type Kitchen={id:string;name:string;address_line1:string;city:string;region:string;listing_description:string|null;weekly_hours:Record<string,[string,string]|null>;included_amenities:string[];minimum_booking_minutes:number;booking_lead_hours:number};
type Resource={id:string;name:string;category:string;hourly_rate_cents:number;capacity:number};
const money=(c:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(c/100);

export default function KitchenProfile(){
  const [kitchen,setKitchen]=useState<Kitchen|null>(null),[resources,setResources]=useState<Resource[]>([]),[state,setState]=useState<"loading"|"ready"|"missing">("loading");
  useEffect(()=>{(async()=>{const id=decodeURIComponent(location.pathname.split("/").filter(Boolean).pop()||"");const [k,r]=await Promise.all([supabase.from("kitchens").select("id,name,address_line1,city,region,listing_description,weekly_hours,included_amenities,minimum_booking_minutes,booking_lead_hours").eq("id",id).eq("active",true).maybeSingle(),supabase.from("equipment_resources").select("id,name,category,hourly_rate_cents,capacity").eq("kitchen_id",id).eq("active",true).is("archived_at",null).order("name")]);if(!k.data){setState("missing");return}setKitchen(k.data as Kitchen);setResources((r.data||[]) as Resource[]);setState("ready")})()},[]);
  if(state==="loading")return <Shell><div className="linked-state">Loading kitchen profile…</div></Shell>;
  if(state==="missing"||!kitchen)return <Shell><div className="linked-state"><Building2/><h1>Kitchen profile unavailable</h1></div></Shell>;
  const hours=Object.entries(kitchen.weekly_hours||{});
  return <Shell><a className="linked-back" href="/?view=discover">← Find a kitchen</a><section className="linked-hero kitchen"><div className="linked-icon"><Building2/></div><div><p>TAGO&apos;S APPROVED KITCHEN</p><h1>{kitchen.name}</h1><span><MapPin/>{kitchen.address_line1}, {kitchen.city}, {kitchen.region}</span></div></section><div className="linked-grid"><section className="linked-card"><p>ABOUT THIS KITCHEN</p><h2>Facility details</h2><div className="linked-description">{kitchen.listing_description||"Commercial kitchen space available through the TaGo's network."}</div><div className="linked-facts"><b><Clock3/>{kitchen.minimum_booking_minutes/60}-hour minimum</b><b>{kitchen.booking_lead_hours}-hour booking lead time</b></div>{kitchen.included_amenities?.length>0&&<div className="linked-amenities">{kitchen.included_amenities.map(item=><span key={item}><Check/>{item}</span>)}</div>}</section><section className="linked-card"><p>OPERATING HOURS</p><h2>Weekly access</h2><div className="linked-hours">{hours.map(([day,value])=><div key={day}><b>{day}</b><span>{value?`${value[0]}–${value[1]}`:"Closed"}</span></div>)}</div></section></div><section className="linked-card linked-equipment"><p>AVAILABLE EQUIPMENT</p><h2>Bookable resources</h2>{resources.length?<div>{resources.map(item=><article key={item.id}><Wrench/><span><b>{item.name}</b><small>{item.category} · Capacity {item.capacity}</small></span><strong>{money(item.hourly_rate_cents)}/hr</strong></article>)}</div>:<div className="linked-note">Equipment listings are being prepared.</div>}</section></Shell>;
}
function Shell({children}:{children:React.ReactNode}){return <main className="public-page linked-profile-page"><PublicHeader/><section className="linked-main">{children}</section></main>}
