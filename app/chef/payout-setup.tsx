"use client";
import {useEffect,useState} from "react";
import {Check,CreditCard} from "lucide-react";
import {supabase} from "@/lib/supabase";
import "./payout-setup.css";
export default function PayoutSetup({businessId}:{businessId:string}){const [ready,setReady]=useState<boolean|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
useEffect(()=>{async function check(){const {data:{session}}=await supabase.auth.getSession();if(!session)return;const response=await fetch(`/api/stripe/connect?businessId=${encodeURIComponent(businessId)}`,{headers:{authorization:`Bearer ${session.access_token}`}});const result=await response.json() as any;setReady(Boolean(result.ready))}check()},[businessId]);
async function connect(){setBusy(true);setError("");const {data:{session}}=await supabase.auth.getSession();if(!session){setError("Sign in again to continue.");setBusy(false);return}const response=await fetch("/api/stripe/connect",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${session.access_token}`},body:JSON.stringify({businessId,returnTo:"/chef"})});const result=await response.json() as any;if(!response.ok||!result.url){setError(result.error||"Stripe setup is unavailable.");setBusy(false);return}location.href=result.url}
if(ready===true)return <div className="payout-ready"><Check/><span><b>Catering payouts ready</b>Customer payments can be transferred to your connected Stripe account.</span></div>;
return <div className="payout-setup"><CreditCard/><span><b>Connect catering payouts</b>Complete Stripe onboarding before customers can pay accepted quotes through TaGo&apos;s.</span><button onClick={connect} disabled={busy}>{busy?"Opening Stripe…":ready===null?"Check or connect Stripe":"Connect Stripe"}</button>{error&&<small>{error}</small>}</div>}
