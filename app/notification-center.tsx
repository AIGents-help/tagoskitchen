"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import "./notification-center.css";

type Notification = { id:string; title:string; body:string; href:string; read_at:string|null; created_at:string };

export default function NotificationCenter() {
  const [items,setItems]=useState<Notification[]>([]),[open,setOpen]=useState(false);
  useEffect(()=>{supabase.from("user_notifications").select("id,title,body,href,read_at,created_at").order("created_at",{ascending:false}).limit(12).then(({data})=>setItems((data||[]) as Notification[]))},[]);
  const unread=items.filter(item=>!item.read_at).length;
  const markAllRead=async()=>{const now=new Date().toISOString(),ids=items.filter(item=>!item.read_at).map(item=>item.id);if(!ids.length)return;const {error}=await supabase.from("user_notifications").update({read_at:now}).in("id",ids);if(!error)setItems(current=>current.map(item=>({...item,read_at:item.read_at||now})))};
  const openItem=async(item:Notification)=>{if(!item.read_at)await supabase.from("user_notifications").update({read_at:new Date().toISOString()}).eq("id",item.id);window.location.href=item.href};
  return <section className={`activity-center ${open?"is-open":""}`} aria-label="Activity"><button className="activity-toggle" type="button" onClick={()=>setOpen(value=>!value)} aria-expanded={open}><span><Bell/>Activity</span>{unread>0&&<b aria-label={`${unread} unread`}>{unread>9?"9+":unread}</b>}</button>{open&&<div className="activity-panel"><header><div><p>ACTIVITY</p><h2>What needs your attention</h2></div>{unread>0&&<button type="button" onClick={markAllRead}><CheckCheck/>Mark all read</button>}</header>{items.length?<div className="activity-list">{items.map(item=><button type="button" onClick={()=>openItem(item)} className={item.read_at?"":"unread"} key={item.id}><i aria-hidden="true"/><span><b>{item.title}</b><small>{item.body}</small><time>{new Date(item.created_at).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</time></span><ChevronRight/></button>)}</div>:<p className="activity-empty">You&apos;re all caught up. Important updates will appear here.</p>}</div>}</section>;
}
