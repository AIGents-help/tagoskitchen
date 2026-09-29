"use client";

import { useEffect, useState } from "react";
import { Building2, ChefHat, ExternalLink, Mail, Phone, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import PublicHeader from "../../public-header";
import "../../public-marketplace.css";
import "../../linked-profiles.css";

type ChefProfile={id:string;chef_name:string;business_name:string;business_type:string;email:string;phone:string|null;notes:string|null;status:string;kitchen_id:string};
type Kitchen={id:string;name:string;address_line1:string;city:string;region:string};

export default function KitchenChefProfile(){
  const [chef,setChef]=useState<ChefProfile|null>(null),[kitchen,setKitchen]=useState<Kitchen|null>(null),[state,setState]=useState<"loading"|"ready"|"missing">("loading");
  useEffect(()=>{(async()=>{const id=decodeURIComponent(location.pathname.split("/").filter(Boolean).pop()||"");const {data:profile}=await supabase.from("sponsored_chef_profiles").select("id,chef_name,business_name,business_type,email,phone,notes,status,kitchen_id").eq("id",id).maybeSingle();if(!profile){setState("missing");return}setChef(profile as ChefProfile);const {data:facility}=await supabase.from("kitchens").select("id,name,address_line1,city,region").eq("id",profile.kitchen_id).maybeSingle();setKitchen(facility as Kitchen|null);setState("ready")})()},[]);
  if(state==="loading")return <Shell><div className="linked-state">Loading Chef Profile…</div></Shell>;
  if(state==="missing"||!chef)return <Shell><div className="linked-state"><ChefHat/><h1>Chef Profile unavailable</h1><p>This profile may require an authorized kitchen or TaGo&apos;s administrator account.</p></div></Shell>;
  return <Shell><a className="linked-back" href="/host/dashboard">← Kitchen workspace</a><section className="linked-hero"><div className="linked-icon"><ChefHat/></div><div><p>TAGO&apos;S KITCHEN CHEF PROFILE</p><h1>{chef.business_name}</h1><span>{chef.chef_name} · {chef.business_type}</span><div className="linked-badges"><b><ShieldCheck/>{chef.status.replaceAll("_"," ")}</b></div></div></section><div className="linked-grid"><section className="linked-card"><p>CONTACT</p><h2>{chef.chef_name}</h2><a href={`mailto:${chef.email}`}><Mail/>{chef.email}</a>{chef.phone&&<a href={`tel:${chef.phone}`}><Phone/>{chef.phone}</a>}{chef.notes&&<div className="linked-note">{chef.notes}</div>}</section>{kitchen&&<section className="linked-card"><p>APPROVED KITCHEN</p><a className="linked-profile-link" href={`/kitchens/${kitchen.id}`} target="_blank" rel="noopener noreferrer"><Building2/><span><b>{kitchen.name}</b><small>{kitchen.address_line1}, {kitchen.city}, {kitchen.region}</small></span><ExternalLink/></a><small className="linked-private-note">This link shows public facility information only. Schedules and internal records remain private.</small></section>}</div></Shell>;
}
function Shell({children}:{children:React.ReactNode}){return <main className="public-page linked-profile-page"><PublicHeader/><section className="linked-main">{children}</section></main>}
