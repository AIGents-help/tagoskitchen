"use client";

import { useEffect, useState } from "react";
import { BriefcaseBusiness, CheckCircle2, ChefHat, ChevronRight, ClipboardList, Clock3, LogOut, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import PublicHeader from "../public-header";
import NotificationCenter from "../notification-center";
import "../public-marketplace.css";
import "./customer.css";

type Request = { id:string; event_type:string; event_date:string; general_location:string; status:string };
type Proposal = { id:string; opportunity_id:string; status:string };

export default function CustomerWorkspace() {
  const [state,setState]=useState<"loading"|"signed_out"|"ready">("loading");
  const [requests,setRequests]=useState<Request[]>([]);
  const [proposals,setProposals]=useState<Proposal[]>([]);
  const [email,setEmail]=useState("");
  const [error,setError]=useState("");
  useEffect(()=>{async function load(){const {data:{user}}=await supabase.auth.getUser();if(!user){setState("signed_out");return}setEmail(user.email||"Customer");const [r,p]=await Promise.all([supabase.from("catering_opportunities").select("id,event_type,event_date,general_location,status").eq("customer_id",user.id).order("created_at",{ascending:false}),supabase.from("catering_proposals").select("id,opportunity_id,status").order("created_at",{ascending:false})]);setRequests((r.data||[]) as Request[]);setProposals((p.data||[]) as Proposal[]);setError(r.error?.message||p.error?.message||"");setState("ready")}load()},[]);
  if(state==="loading")return <Shell><div className="customer-state">Loading your customer workspace…</div></Shell>;
  if(state==="signed_out")return <Shell><div className="customer-state"><h1>Your food requests, in one place.</h1><p>Sign in to post an opportunity, compare chef proposals, and manage your bookings.</p><a href="/account?mode=signin&returnTo=/customer">Sign in to continue</a></div></Shell>;
  const open=requests.filter(x=>x.status==="open"),matched=requests.filter(x=>x.status==="matched");
  const awaiting=open.filter(x=>proposals.some(p=>p.opportunity_id===x.id&&p.status==="submitted"));
  const waiting=open.filter(x=>!proposals.some(p=>p.opportunity_id===x.id));
  return <Shell><section className="customer-head"><div><p>CUSTOMER WORKSPACE</p><h1>What do you need?</h1><span>{email}</span></div><div><NotificationCenter/><a href="/catering"><Plus/>Post what you need</a><button onClick={async()=>{await supabase.auth.signOut();location.href="/"}}><LogOut/>Sign out</button></div></section>{error&&<div className="form-note form-error-note">{error}</div>}<section className="customer-actions"><a href="/food-businesses"><ChefHat/><div><strong>Find a Chef</strong><span>Browse public profiles, menus, photos, and direct contact information.</span></div><ChevronRight/></a><a href="/catering"><BriefcaseBusiness/><div><strong>Post What You Need</strong><span>Describe the event or food service once and receive qualified proposals.</span></div><ChevronRight/></a><a href="/catering/manage"><ClipboardList/><div><strong>Manage Requests</strong><span>Compare menus and quotes, select a chef, or close an opportunity.</span></div><ChevronRight/></a></section><section className="attention-panel"><header><div><p>NEEDS ATTENTION</p><h2>Your active requests</h2></div><a href="/catering/manage">View all requests <ChevronRight/></a></header><div className="attention-grid"><article><span>{awaiting.length}</span><div><b>Proposals to review</b><small>{awaiting.length?"Chefs are waiting for your decision.":"Nothing is waiting on you."}</small></div></article><article><span>{waiting.length}</span><div><b>Waiting for proposals</b><small>Open requests that have not received a response yet.</small></div></article><article><span>{matched.length}</span><div><b>Chef selected</b><small>Matched requests ready for final coordination.</small></div></article></div>{requests.length?<div className="recent-requests">{requests.slice(0,3).map(r=><a href="/catering/manage" key={r.id}><span className={`customer-status ${r.status}`}>{r.status}</span><div><b>{r.event_type}</b><small><Clock3/>{new Date(`${r.event_date}T12:00:00`).toLocaleDateString()} · {r.general_location}</small></div><ChevronRight/></a>)}</div>:<div className="customer-empty"><CheckCircle2/><b>No requests yet.</b><span>Browse chefs directly or post your needs to the TaGo&apos;s network.</span></div>}</section></Shell>;
}

function Shell({children}:{children:React.ReactNode}){return <main className="public-page customer-page"><PublicHeader/><section className="customer-main">{children}</section></main>}
