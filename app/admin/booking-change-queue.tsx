"use client";
import {useEffect,useState} from "react";
import {CalendarClock,Check,X} from "lucide-react";
import {supabase} from "@/lib/supabase";
type Change={id:string;booking_id:string;request_type:string;requested_starts_at:string|null;requested_ends_at:string|null;reason:string;status:string;admin_note:string|null;created_at:string};
export default function BookingChangeQueue({bookingLabel,onNotice,onRefresh}:{bookingLabel:(id:string)=>string;onNotice:(s:string)=>void;onRefresh:()=>Promise<void>}){
 const [rows,setRows]=useState<Change[]>([]),[busy,setBusy]=useState(false);
 const load=async()=>{const {data,error}=await supabase.from("booking_change_requests").select("id,booking_id,request_type,requested_starts_at,requested_ends_at,reason,status,admin_note,created_at").order("created_at",{ascending:false});if(error)onNotice(error.message);else setRows((data||[]) as Change[])};
 useEffect(()=>{load()},[]);
 const decide=async(form:HTMLFormElement,id:string,decision:string)=>{setBusy(true);const v=Object.fromEntries(new FormData(form).entries());const {error}=await supabase.rpc("admin_decide_booking_change",{p_request_id:id,p_decision:decision,p_admin_note:v.admin_note||null});if(error)onNotice(error.message);else{onNotice(`Request ${decision}.`);await Promise.all([load(),onRefresh()])}setBusy(false)};
 return <section className="ops-panel change-queue"><header><CalendarClock/><h2>Booking change requests</h2></header>{rows.length?<div>{rows.map(r=><form key={r.id}><header><div><b>{r.request_type.replaceAll("_"," ")}</b><span>{bookingLabel(r.booking_id)} • submitted {new Date(r.created_at).toLocaleDateString()}</span></div><em className={r.status}>{r.status}</em></header><p>{r.reason}</p>{r.requested_starts_at&&<p><b>Requested time:</b> {new Date(r.requested_starts_at).toLocaleString()} – {new Date(r.requested_ends_at!).toLocaleTimeString()}</p>}<label>Decision note<textarea name="admin_note" defaultValue={r.admin_note||""} placeholder="Reason, refund instructions or next steps…"/></label>{r.status==="pending"&&<footer><button type="button" disabled={busy} onClick={e=>decide(e.currentTarget.form!,r.id,"declined")}><X/>Decline</button><button type="button" disabled={busy} onClick={e=>decide(e.currentTarget.form!,r.id,"approved")}><Check/>Approve</button></footer>}</form>)}</div>:<p>No booking change requests.</p>}</section>
}
