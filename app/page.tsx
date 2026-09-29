"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, Building2, CalendarDays, Check, ChefHat, ChevronRight, Clock3, CreditCard, Crown, Download, Eye, EyeOff, FileCheck2, Flag, Flame, LockKeyhole, LogIn, LogOut, Mail, MapPin, Megaphone, Menu, PackageCheck, Palette, Plus, Search, Settings, ShieldCheck, ShoppingBag, Sparkles, Store, Truck, Upload, UserPlus, UserRound, WalletCards, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isChefBusiness } from "@/lib/workspace-business";
import BookingAccess from "./booking-access";
import {LiveDiscover,LiveInnerSchedule,LivePromotions} from "./live-marketplace";
import Breadcrumbs from "./breadcrumbs";
import "./nav-links.css";
import "./home-auth.css";
import "./readability.css";
import "./access-layout.css";
import "./public-home.css";
import "./public-paths.css";
import "./experience.css";
import "./opportunity-callout.css";

type View = "discover"|"popups"|"schedule"|"profile"|"payments"|"brand";
const equipment = [
  {name:"Full cook line", detail:"Ovens + fryers + griddle", rate:45, color:"orange"},
  {name:"Double ovens", detail:"Both ovens + prep table", rate:24, color:"gold"},
  {name:"Fryer station", detail:"Two fryers + landing table", rate:22, color:"blue"},
  {name:"Flat-top griddle", detail:"Griddle + prep surface", rate:20, color:"green"},
  {name:"Food truck service", detail:"Commissary + water/waste", rate:30, color:"purple"},
];
const locations = [
  {name:"TaGo's Linwood Kitchen",city:"100 Worrilow Street, Linwood, PA",distance:"Home location",type:"TaGo's owned",rate:20,status:"Open today",features:"Full cook line • Food truck commissary",image:"/tagos-kitchen.png"},
];
const credentials = [
  {name:"Food Handler Card", status:"Verified", detail:"Expires Oct 18, 2027"},
  {name:"Liability Insurance", status:"Action needed", detail:"Upload policy • $1M minimum"},
  {name:"Business License", status:"Verified", detail:"Renews Jan 31, 2027"},
  {name:"Menu & Process Review", status:"Under review", detail:"Submitted Sep 10"},
];

export default function Home(){
  const [view,setView]=useState<View>("discover"); const [mobile,setMobile]=useState(false); const [location,setLocation]=useState(0); const [resource,setResource]=useState(0); const [hours,setHours]=useState(4); const [day,setDay]=useState(1); const [notice,setNotice]=useState(""); const [uploaded,setUploaded]=useState(false); const [showBrand,setShowBrand]=useState(true); const [approved,setApproved]=useState(false); const [signedIn,setSignedIn]=useState(false); const [authReady,setAuthReady]=useState(false); const [enteredMarketplace,setEnteredMarketplace]=useState(false); const [accountName,setAccountName]=useState("Guest chef");
  useEffect(()=>{const params=new URLSearchParams(window.location.search);if(params.has("view"))setEnteredMarketplace(true);if(params.get("view")==="schedule")queueMicrotask(()=>setView("schedule"));const load=async()=>{const {data:{session}}=await supabase.auth.getSession();if(!session){setAuthReady(true);return}setSignedIn(true);const {data:workspaces}=await supabase.rpc("get_my_workspaces");const b=(workspaces||[]).find(isChefBusiness);if(b){setAccountName(b.name);setApproved(b.compliance_status==="approved");setShowBrand(b.schedule_identity_visibility!=="blocked")}else setAccountName(session.user.email||"Platform account");setAuthReady(true)};load()},[]);
  const item=equipment[resource], total=item.rate*hours, commission=total*.10;
  const signOut=async()=>{await supabase.auth.signOut();window.location.replace("/")};
  const nav=(v:View,label:string,Icon:typeof Search)=>
<button className={view===v?"nav-active":""} onClick={()=>{setView(v);setMobile(false)}}>
<Icon/>{label}</button>;
  if(!authReady)return <main className="public-loading"><img src="/tagos-pin-mascot.png" alt=""/><b>Loading TaGo&apos;s Kitchen…</b></main>;
  if(!signedIn&&!enteredMarketplace)return <PublicWelcome onExplore={()=>{setView("discover");setEnteredMarketplace(true)}}/>;
  return <main className="app-shell">
    <aside className={mobile?"sidebar mobile-open":"sidebar"}>
<div className="side-head">
<a className="brand brand-logo" onClick={()=>setView("discover")}>
<img src="/tagos-kitchen-logo.png" alt="TaGo's Kitchen"/>
</a>
<button className="close-menu" onClick={()=>setMobile(false)}>
<X/>
</button>
</div>
<nav>
<small>MARKETPLACE</small>{nav("discover","Find a kitchen",Search)}<a href="/food-businesses"><ChefHat/> Find food businesses</a><a href="/catering"><Mail/> Request catering</a>{nav("popups","Events",Megaphone)}<a href="/host"><Store/> List your kitchen</a><small>WORKSPACE</small>{nav("schedule","My schedule",CalendarDays)}<a href="/account">
<UserRound/>Business profile</a>{signedIn&&<a href="/chef"><ChefHat/>Chef Workspace</a>}{signedIn?<a href="/chef#payments"><WalletCards/>Payments</a>:nav("payments","Payments",WalletCards)}</nav>
<div className="side-card pin-card">
<img src="/tagos-pin-mascot.png" alt="TaGo's bouncing location pin"/>
<div>
<b>{approved?"Kitchen Passport approved":"Create your Kitchen Passport"}</b>
<span>{approved?"Private scheduling is unlocked.":"Submit credentials to unlock scheduling."}</span>
<a href="/account">{approved?"View profile":"Create profile"}</a>
</div>
</div>
<div className="user-chip">
<span>{accountName.split(" ").map(x=>x[0]).slice(0,2).join("")}</span>
<div>
<b>{accountName}</b>
<small>{approved?"Approved renter":"Renter account"}</small>
</div>
<a href="/admin" className="admin-link" title="Owner portal">
<Settings/>
</a>
</div>
</aside>
    <section className="workspace">
<header className="app-top">
<button className="menu-btn" onClick={()=>setMobile(true)}>
<Menu/>
</button>
<div className="top-brand">
<img src="/tagos-pin-mascot.png" alt=""/>
<div>
<p>TaGo&apos;s Kitchen</p>
<small>Put Your Cookin&apos; on the Map</small>
</div>
</div>
<div className="top-actions">{signedIn?<>
<a className="account-button" href="/tour">How it works</a>
<a className="account-button" href="/account">
<UserRound/> My account</a>
<button className="account-button" onClick={signOut}><LogOut/> Sign out</button>
<button className="new-booking" onClick={()=>setView("discover")}>
<Plus/> New booking</button>
</>:<>
<a className="account-button" href="/tour">How it works</a>
<a className="login-button" href="/account?mode=signin">
<LogIn/> Log in</a>
<a className="signup-button" href="/account">
<UserPlus/> Create profile</a>
</>}</div>
</header>
    <Breadcrumbs items={[{discover:"Find a kitchen",popups:"Pop-Up Pickup",schedule:"Inner Schedule",profile:"Business profile",payments:"Payments",brand:"Brand studio"}[view]]}/>
    {notice&&<div className="toast">
<Check/>{notice}<button onClick={()=>setNotice("")}>
<X/>
</button>
</div>}
    {view==="discover"&&<LiveDiscover approved={approved} onBooked={setNotice}/>}
    {view==="popups"&&<LivePromotions approved={approved} onNotice={setNotice}/>}
    {view==="schedule"&&<>{approved&&<div className="view access-view">
<BookingAccess/>
</div>}<LiveInnerSchedule approved={approved}/>
</>}
    {view==="profile"&&<>
<Profile uploaded={uploaded} setUploaded={setUploaded} notice={setNotice}/>
<PrivacyPanel showBrand={showBrand} setShowBrand={setShowBrand} notice={setNotice}/>
</>}
    {view==="payments"&&<Payments/>}
    {view==="brand"&&<BrandStudio/>}
    </section>
  </main>
}

function PublicWelcome({onExplore}:{onExplore:()=>void}){
  const customerSteps=["Browse public chef profiles and menus","Contact a chef you already want","Or post your needs for matched quotes"];
  const chefSteps=["Create a free Kitchen Passport","Submit required business credentials","Request time and specific equipment","Pay after the kitchen approves","Check in, clean up, and check out","Promote events and apply to catering or food-service jobs"];
  const kitchenSteps=["Apply with a real licensed facility","Prove insurance, authority, and compliance","Set your own openings, rules, and prices","Offer resident, recurring, and flexible capacity","Approve requests and control access","Track rent, fees, issues, and payouts"];
  const outletSteps=["Post the products or food service you want","Set your location, requirements, and schedule","Review responses from qualified local businesses","Build a pickup, shelf, pop-up, or recurring partnership"];
  const vendorSteps=["List the goods or services you provide","Reach kitchens and food businesses in one network","Coordinate recurring supply, delivery, maintenance, or support","Build repeat relationships with local operators"];
  return <main className="public-home">
    <header className="public-nav"><a href="/"><img src="/tagos-kitchen-logo.png" alt="TaGo's Kitchen"/></a><nav><a className="public-how-link" href="/tour">How it works</a><a href="/food-businesses">Find a chef</a><button onClick={onExplore}>Find a kitchen</button><a href="/catering">Post what you need</a><a href="#join-network">Join the network</a><a href="/account?mode=signin">Log in</a></nav></header>
    <section className="public-hero"><div><p>THE LOCAL FOOD BUSINESS NETWORK</p><h1>Make it. Sell it.<br/>Serve it.</h1><span>Find a licensed kitchen, hire a local chef, or grow your food business through one connected marketplace.</span><div className="public-actions"><a href="/food-businesses">Find a chef <ChevronRight/></a><button onClick={onExplore}>Find a kitchen</button><a href="/catering">Post what you need</a></div><a className="hero-how-link" href="/tour">See how the entire TaGo&apos;s network works <ChevronRight/></a><small>You can browse without an account. Sign in only when you are ready to connect, request, or book.</small></div><div className="public-hero-visual"><img className="public-experience-photo" src="/tagos-experience-hero.png" alt="Independent chefs preparing food in a professional kitchen with a food truck ready outside"/><img className="public-pin-guide" src="/tagos-pin-mascot.png" alt=""/><div className="public-visual-caption"><b>Put your cookin&apos; on the map.</b><span>Space, opportunity, and local food—all connected.</span></div></div></section>
    <section className="public-paths" aria-label="Choose how you want to use TaGo's">
      <article><span><ShoppingBag/></span><p>I NEED FOOD</p><h2>Find the right chef.</h2><div><a href="/food-businesses">Browse chefs and menus <ChevronRight/></a><a href="/catering">Post my needs</a></div></article>
      <article><span><Building2/></span><p>I NEED A KITCHEN</p><h2>Find space to cook.</h2><div><button onClick={onExplore}>Browse kitchens <ChevronRight/></button><a href="/account">Create a Kitchen Passport</a></div></article>
      <article id="join-network"><span><Store/></span><p>I PROVIDE FOOD RESOURCES</p><h2>Join the network.</h2><div><a href="/account">Join as a chef <ChevronRight/></a><a href="/host">List a kitchen</a><a href="/outlets">Post an outlet opportunity</a><a href="/network">View every network role</a></div></article>
    </section>
    <section className="public-job-callout"><Mail/><div><p>NEED CATERING OR FOOD SERVICE?</p><h2>Post the job once. Let approved chefs bring you ideas and quotes.</h2><span>Company meals, private events, recurring food service, delivery, staffing, and more.</span></div><a href="/catering">Post your event requirements <ChevronRight/></a></section>
    <section id="how-it-works" className="public-how"><div className="public-section-head"><p>HOW TAGO&apos;S WORKS</p><h2>One network. A clear path for every role.</h2><span>Customers, chefs, kitchens, outlets, and vendors each enter through a focused workspace—but connect through the same local food network.</span></div><div className="public-lanes network-lanes"><article><header><ShoppingBag/><div><p>FOR CUSTOMERS</p><h3>Browse or tell us what you need.</h3></div></header><ol>{customerSteps.map((step,index)=><li key={step}><b>{index+1}</b><span>{step}</span></li>)}</ol><div className="lane-actions"><a href="/food-businesses">Find a Chef <ChevronRight/></a><a href="/catering">Post a request</a></div></article><article><header><ChefHat/><div><p>FOR CHEFS &amp; FOOD BUSINESSES</p><h3>Find space. Get cooking. Get discovered.</h3></div></header><ol>{chefSteps.slice(0,4).map((step,index)=><li key={step}><b>{index+1}</b><span>{step}</span></li>)}</ol><div className="lane-actions"><a href="/account">Create a Chef profile <ChevronRight/></a><a href="/tour#chefs">See the Chef experience</a></div></article><article><header><Building2/><div><p>FOR KITCHEN PROVIDERS</p><h3>Offer capacity without surrendering control.</h3></div></header><ol>{kitchenSteps.slice(0,4).map((step,index)=><li key={step}><b>{index+1}</b><span>{step}</span></li>)}</ol><div className="lane-actions"><a href="/host">Apply as a Kitchen <ChevronRight/></a><a href="/tour#kitchens">See the Kitchen experience</a></div></article><article><header><Store/><div><p>FOR OUTLETS</p><h3>Bring local food into your location.</h3></div></header><ol>{outletSteps.map((step,index)=><li key={step}><b>{index+1}</b><span>{step}</span></li>)}</ol><div className="lane-actions"><a href="/outlets">Post an opportunity <ChevronRight/></a><a href="/tour#outlets">See outlet options</a></div></article><article><header><PackageCheck/><div><p>FOR VENDORS &amp; SERVICES</p><h3>Support the businesses doing the cooking.</h3></div></header><ol>{vendorSteps.map((step,index)=><li key={step}><b>{index+1}</b><span>{step}</span></li>)}</ol><div className="lane-actions"><a href="/network">Join the network <ChevronRight/></a><a href="/tour#vendors">See vendor options</a></div></article></div></section>
    <section className="public-control"><div><ShieldCheck/><p>WHAT STAYS PRIVATE</p><h2>Operational schedules are never public.</h2><span>Visitors see promotional events—not chef work schedules. Approved members see only the availability they are authorized to use. Kitchen providers retain control of their own equipment, hours, approvals, access, and payouts.</span></div><button onClick={onExplore}>Explore the marketplace <ChevronRight/></button></section>
    <footer><img src="/tagos-kitchen-logo.png" alt="TaGo's Kitchen"/><span>100 Worrilow Street, Linwood, PA</span><div><a href="/tour">How it works</a><a href="/catering">Post a catering job</a><a href="/account?mode=signin">Log in</a><a href="/host">List your kitchen</a></div></footer>
  </main>
}

function PopUpPickup({notice}:{notice:(s:string)=>void}){
  const [creating,setCreating]=useState(false); const [qty,setQty]=useState(2); const [published,setPublished]=useState(false); const [locationType,setLocationType]=useState<"tagos"|"truck"|"offsite">("tagos"); const [offsiteName,setOffsiteName]=useState(""); const [offsiteAddress,setOffsiteAddress]=useState("");
  const events=[
    {chef:"Chef Larry",badge:"NEIGHBORHOOD FAVORITE",dish:"Signature Cheesesteaks",copy:"Chef Larry is back in the neighborhood—hot off the griddle and made to order.",day:"THU 17",time:"6–8 PM",place:"Pickup at TaGo's",tone:"cheese",price:14,left:18},
    {chef:"Chef Nia",badge:"FOOD TRUCK POP-UP",dish:"Smoked Jerk Chicken Bowls",copy:"TaGo's food truck rolls out with a limited batch and house pepper sauce. Final location is announced by the chef.",day:"SAT 19",time:"4–7 PM",place:"Food truck • Location TBA",tone:"jerk",price:16,left:11},
    {chef:"Sweet Ground Bakery",badge:"SUNDAY MORNING",dish:"Warm Cinnamon Roll Box",copy:"Four oversized rolls, baked at TaGo's and ready for your Sunday table.",day:"SUN 20",time:"9–11 AM",place:"Pickup at TaGo's",tone:"rolls",price:22,left:7},
  ];
  return <div className="view popup-view">
<div className="popup-title">
<div>
<p>LOCAL FOOD. LIMITED DROPS.</p>
<h1>Pop-Up Pickup</h1>
<span>Preorder from independent chefs, then pick up at TaGo&apos;s, meet the food truck, or find a chef at a local market or event.</span>
</div>
<button onClick={()=>setCreating(!creating)}>
<Plus/> Create a food drop</button>
</div>
    {creating&&<form className="event-builder" onSubmit={event=>{event.preventDefault();setPublished(true);setCreating(false);notice("Your Pop-Up Pickup event is live and ready to share.")}}>
<div className="builder-head">
<div>
<p>CHEF PROMOTION</p>
<h2>Create your pickup event</h2>
</div>
<button type="button" onClick={()=>setCreating(false)} aria-label="Close">
<X/>
</button>
</div>
<div className="event-type">
<button type="button" className={locationType==="tagos"?"active":""} onClick={()=>setLocationType("tagos")}>
<Store/> Pickup at TaGo&apos;s</button>
<button type="button" className={locationType==="truck"?"active":""} onClick={()=>setLocationType("truck")}>
<Truck/> Take the food truck</button>
<button type="button" className={locationType==="offsite"?"active":""} onClick={()=>setLocationType("offsite")}>
<MapPin/> Off-site event</button>
</div>
<div className="builder-grid">
<label>Event headline<input defaultValue="Chef Larry is back in the neighborhood"/>
</label>
<label>Featured item<input defaultValue="Fat-Back Scrappy Dappy Doo"/>
</label>
<label>Pickup date<input type="date" defaultValue="2026-09-24"/>
</label>
<label>Service window<input defaultValue="6:00 PM – 8:00 PM"/>
</label>
<label>Price<input type="number" defaultValue="14"/>
</label>
<label>Available quantity<input type="number" defaultValue="40"/>
</label>{locationType==="truck"&&<>
<label>Public pickup address<input required placeholder="Where will the truck be parked?"/>
</label>
<label>Truck reservation<input defaultValue="TaGo's licensed food truck"/>
</label>
</>}{locationType==="offsite"&&<>
<label>Event or venue name<input required value={offsiteName} onChange={event=>setOffsiteName(event.target.value)} placeholder="Flea market, festival, venue…"/>
</label>
<label>Public pickup address<input required value={offsiteAddress} onChange={event=>setOffsiteAddress(event.target.value)} placeholder="Street, city, state and ZIP"/>
</label>
<label>Location type<select required defaultValue="">
<option value="" disabled>Select one</option>
<option>Flea market</option>
<option>Farmers market</option>
<option>Festival or fair</option>
<option>Private venue</option>
<option>Community event</option>
<option>Other approved location</option>
</select>
</label>
</>}</div>
<label className="wide-label">Promotion message<textarea defaultValue="Chef Larry will be cooking his signature cheesesteaks Thursday from 6–8. Preorder now—when they're gone, they're gone."/>
</label>
<div className="builder-foot">
<span>
<ShieldCheck/> Publishing requires verified credentials and a confirmed public pickup location.</span>
<button type="submit">
<Megaphone/> Publish event</button>
</div>
</form>}
    {published&&<div className="published-strip">
<Check/>
<b>Your food drop is live.</b>
<span>Chef Larry • Fat-Back Scrappy Dappy Doo • Thu 24, 6–8 PM</span>
<button>Share event</button>
</div>}
    <section className="celebrity-chef">
<img src="/tagos-pin-mascot.png" alt="TaGo's spotlight pin"/>
<div>
<p>
<Crown/> TAGO&apos;S CHEF SPOTLIGHT</p>
<h2>From resident chef to neighborhood headliner.</h2>
<span>TaGo&apos;s selects standout resident chefs for a featured campaign across our larger audience—professional content, priority placement, preorder promotion, and a signature food-truck event.</span>
<div>
<b>Featured storytelling</b>
<b>Platform-wide promotion</b>
<b>Signature pickup event</b>
</div>
</div>
<button onClick={()=>notice("Chef Spotlight interest recorded. TaGo's will review your profile and upcoming menu.")}>Put my cookin&apos; on the map <ChevronRight/>
</button>
</section>
    <section className="public-calendar">
<div className="section-heading">
<div>
<p>PUBLIC EVENT CALENDAR</p>
<h2>What&apos;s cooking around the neighborhood</h2>
</div>
<span>Promotional events only</span>
</div>
<div className="promo-week">
<div className="promo-day">
<b>THU</b>
<strong>17</strong>
<article>
<span>6–8 PM</span>
<h3>Chef Larry&apos;s Cheesesteaks</h3>
<p>Pickup at TaGo&apos;s</p>
</article>
</div>
<div className="promo-day">
<b>FRI</b>
<strong>18</strong>
<i>No public event</i>
</div>
<div className="promo-day">
<b>SAT</b>
<strong>19</strong>
<article className="truck-event">
<span>4–7 PM</span>
<h3>Chef Nia&apos;s Food Truck Pop-Up</h3>
<p>Location announced by chef</p>
</article>
</div>
<div className="promo-day">
<b>SUN</b>
<strong>20</strong>
<article>
<span>9–11 AM</span>
<h3>Warm Cinnamon Roll Box</h3>
<p>Pickup at TaGo&apos;s</p>
</article>
</div>
</div>
<small>
<LockKeyhole/> Kitchen reservations, chef production times, and equipment availability are never shown publicly.</small>
</section>
    <div className="popup-toolbar">
<div>
<b>Upcoming food drops</b>
<span>Order ahead. Limited quantities. Pickup only.</span>
</div>
<div>
<button className="active">All drops</button>
<button>At TaGo&apos;s</button>
<button>Food truck</button>
</div>
</div>
    <div className="event-grid">{events.map((e,i)=>
<article className="food-event" key={e.dish}>
<div className={`food-art ${e.tone}`}>
<span>{e.badge}</span>
<strong>{i===0?"PHILLY-STYLE":i===1?"MOBILE KITCHEN":"BAKED FRESH"}</strong>
<b>{e.dish.split(" ").slice(0,2).join(" ")}</b>
</div>
<div className="event-copy">
<div className="chef-line">
<span className="chef-avatar">{e.chef.split(" ").map(x=>x[0]).join("")}</span>
<div>
<b>{e.chef}</b>
<small>Verified resident chef</small>
</div>
</div>
<h2>{e.dish}</h2>
<p>{e.copy}</p>
<div className="pickup-facts">
<span>
<CalendarDays/>{e.day}</span>
<span>
<Clock3/>{e.time}</span>
<span>
<MapPin/>{e.place}</span>
</div>
<div className="order-row">
<div>
<b>${e.price}</b>
<small>{e.left} orders left</small>
</div>
<div className="qty">
<button onClick={()=>setQty(Math.max(1,qty-1))}>−</button>
<b>{i===0?qty:1}</b>
<button onClick={()=>setQty(qty+1)}>+</button>
</div>
<button onClick={()=>notice(`${i===0?qty:1} ${e.dish} added to your preorder.`)}>
<ShoppingBag/> Preorder</button>
</div>
</div>
</article>)}</div>
    <section className="chef-cta">
<div>
<Truck/>
<span>
<b>Take your menu to the neighborhood.</b>Book kitchen prep, reserve the TaGo&apos;s food truck, publish your location, and collect preorders in one flow.</span>
</div>
<button onClick={()=>{setCreating(true);setLocationType("truck");window.scrollTo({top:0,behavior:"smooth"})}}>Plan a mobile pop-up <ChevronRight/>
</button>
</section>
  </div>
}

function BrandStudio(){
  const [pattern,setPattern]=useState("Bounce"); const [surface,setSurface]=useState("Eggshell");
  return <div className="view brand-studio">
<div className="brand-hero">
<div>
<p>TAGO&apos;S BRAND STUDIO</p>
<h1>Put Your Cookin&apos; on the Map</h1>
<span>Approved marks, applications, packaging, merchandise, and campaign tools in one place.</span>
<div className="brand-actions">
<button>
<Download/> Download logo kit</button>
<button>
<Sparkles/> Request campaign creative</button>
</div>
</div>
<img src="/tagos-pin-mascot.png" alt="TaGo's bouncing pin mascot"/>
</div>
    <section className="identity-system">
<div className="section-heading">
<div>
<p>CORE IDENTITY</p>
<h2>Use the right mark for the moment</h2>
</div>
<span>Approved master assets</span>
</div>
<div className="mark-grid">
<article className="master-mark">
<small>PRIMARY LOGO</small>
<img src="/tagos-kitchen-logo.png" alt="TaGo's Kitchen primary logo"/>
<footer>
<b>Full brand signature</b>
<span>Truck, storefront, headers, packaging</span>
</footer>
</article>
<article className="icon-mark">
<small>MASCOT + ICON</small>
<img src="/tagos-pin-mascot.png" alt="TaGo's pin icon"/>
<footer>
<b>The bouncing pin</b>
<span>App, avatar, map, stickers, motion</span>
</footer>
</article>
</div>
</section>
    <section className="application-panel">
<div className="section-heading">
<div>
<p>IN THE WILD</p>
<h2>One identity, every surface</h2>
</div>
</div>
<img src="/tagos-brand-applications.png" alt="TaGo's food truck, apparel, sandwich wrap, bag, and sticker applications"/>
<div className="application-tags">
<span>Food truck</span>
<span>Staff apparel</span>
<span>Sandwich wrap</span>
<span>Takeout bags</span>
<span>Sticker system</span>
</div>
</section>
    <div className="brand-lower">
<section className="pattern-lab">
<div className="section-heading">
<div>
<p>PATTERN LAB</p>
<h2>Build a packaging pattern</h2>
</div>
</div>
<div className={`pattern-preview ${surface.toLowerCase()} ${pattern.toLowerCase()}`}>
<div>{Array.from({length:20}).map((_,i)=>
<img key={i} src="/tagos-pin-mascot.png" alt=""/>)}</div>
<span>SANDWICH WRAP PREVIEW</span>
</div>
<div className="pattern-controls">
<label>Pattern<select value={pattern} onChange={e=>setPattern(e.target.value)}>
<option>Bounce</option>
<option>Scatter</option>
<option>March</option>
</select>
</label>
<label>Paper<select value={surface} onChange={e=>setSurface(e.target.value)}>
<option>Eggshell</option>
<option>Charcoal</option>
<option>White</option>
</select>
</label>
<button>
<Download/> Export repeat tile</button>
</div>
</section>
<section className="usage-rules">
<div className="section-heading">
<div>
<p>QUICK RULES</p>
<h2>Keep TaGo&apos;s recognizable</h2>
</div>
</div>
<ul>
<li>
<Check/>
<span>
<b>Give it room</b>Keep clear space equal to the pin&apos;s center dot.</span>
</li>
<li>
<Check/>
<span>
<b>Protect the lettering</b>Never retype or stretch the custom TaGo&apos;s wordmark.</span>
</li>
<li>
<Check/>
<span>
<b>Use the pin with purpose</b>Let it bounce, point, locate, approve, and celebrate.</span>
</li>
<li>
<X/>
<span>
<b>No unapproved colors</b>Stay with charcoal, orange, and warm eggshell.</span>
</li>
</ul>
<div className="swatches">
<i/>
<i/>
<i/>
<span>#181816</span>
<span>#FF5A12</span>
<span>#F6E7C8</span>
</div>
</section>
</div>
  </div>
}

function PageTitle({eyebrow,title,children}:{eyebrow:string,title:string,children:React.ReactNode}){return <div className="page-title">
<div>
<p>{eyebrow}</p>
<h1>{title}</h1>
<span>{children}</span>
</div>
</div>}

function Discover({location,setLocation,resource,setResource,item,hours,setHours,day,setDay,total,commission,book}:{location:number,setLocation:(n:number)=>void,resource:number,setResource:(n:number)=>void,item:typeof equipment[0],hours:number,setHours:(n:number)=>void,day:number,setDay:(n:number)=>void,total:number,commission:number,book:()=>void}){
  const days=["Fri 12","Sat 13","Sun 14","Mon 15","Tue 16"];
  const kitchen=locations[location];
  return <div className="view">
<PageTitle eyebrow="KITCHEN MARKETPLACE" title="Find your kitchen">
<>Choose a licensed location, then reserve only the space and equipment you need.</>
</PageTitle>
<div className="location-tools">
<label>
<Search/>
<input placeholder="Search by city or kitchen name"/>
</label>
<button className="active">
<MapPin/> Near me</button>
<button>All kitchens</button>
<button>Food truck ready</button>
</div>
<div className="location-strip">{locations.map((l,i)=>
<button className={location===i?"location-card selected":"location-card"} onClick={()=>{setLocation(i);setResource(0)}} key={l.name}>
<span className="location-type">{l.type}</span>
<h2>{l.name}</h2>
<p>
<MapPin/>{l.city} • {l.distance}</p>
<small>{l.features}</small>
<div>
<b>From ${l.rate}/hr</b>
<em>{l.status}</em>
</div>{location===i&&<i>
<Check/>
</i>}</button>)}</div>
<div className="market-layout">
<div>
<section className="kitchen-banner">
<img src={kitchen.image} alt={`${kitchen.name} commercial kitchen`}/>
<div className="banner-copy">
<span>{kitchen.type.toUpperCase()}</span>
<h2>{kitchen.name}</h2>
<p>{kitchen.city} • {kitchen.features}</p>
</div>
<b>
<i/> {kitchen.status.toUpperCase()}</b>
</section>
<div className="resource-head">
<div>
<h2>Choose equipment</h2>
<p>Book separate work zones without paying for the whole room.</p>
</div>
<span>{equipment.length} options</span>
</div>
<div className="resource-grid">{equipment.map((e,i)=>
<button key={e.name} className={resource===i?"resource selected":"resource"} onClick={()=>setResource(i)}>
<span className={`equip-icon ${e.color}`}>
<Flame/>
</span>
<div>
<b>{e.name}</b>
<small>{e.detail}</small>
</div>
<strong>${e.rate}<small>/hr</small>
</strong>{resource===i&&<i className="pick">
<Check/>
</i>}</button>)}</div>
</div>
<aside className="booking-panel">
<div className="panel-top">
<p>YOUR RESERVATION</p>
<b>${item.rate}<small>/hour</small>
</b>
</div>
<span className="booking-location">
<MapPin/>{kitchen.name}</span>
<h2>{item.name}</h2>
<span>{item.detail}</span>
<label>Select a date</label>
<div className="day-row">{days.map((d,i)=>
<button key={d} className={day===i?"active":""} onClick={()=>setDay(i)}>{d.split(" ")[0]}<b>{d.split(" ")[1]}</b>
</button>)}</div>
<label>Start time</label>
<div className="time-grid">
<button>6:00 AM</button>
<button className="active">8:00 AM</button>
<button>12:00 PM</button>
<button>4:00 PM</button>
</div>
<label>Duration</label>
<div className="duration">
<button onClick={()=>setHours(Math.max(2,hours-1))}>−</button>
<b>{hours} hours</b>
<button onClick={()=>setHours(Math.min(10,hours+1))}>+</button>
</div>
<div className="cost">
<p>
<span>{hours} hrs × ${item.rate}</span>
<b>${total.toFixed(2)}</b>
</p>
<p>
<span>Processing</span>
<b>Calculated at checkout</b>
</p>
<hr/>
<p className="total">
<span>Booking total</span>
<b>${total.toFixed(2)}</b>
</p>
<small>Kitchen payout ${(total-commission).toFixed(2)} • Platform ${commission.toFixed(2)}</small>
</div>
<button className="book-btn" onClick={book}>Reserve equipment <ChevronRight/>
</button>
<p className="protected">
<ShieldCheck/> Protected payment. Free cancellation for 24 hours.</p>
</aside>
</div>
</div>
}

function InnerSchedule({setView,approved,showBrand,notice}:{setView:(v:View)=>void;approved:boolean;showBrand:boolean;notice:(s:string)=>void}){
  if(!approved)return <div className="view">
<PageTitle eyebrow="VERIFIED MEMBERS ONLY" title="Inner Schedule">
<>Kitchen and equipment availability is private to approved resident chefs.</>
</PageTitle>
<section className="schedule-gate">
<img src="/tagos-pin-mascot.png" alt="TaGo's private schedule"/>
<div>
<span>
<LockKeyhole/> ACCESS LOCKED</span>
<h2>Complete your Kitchen Passport</h2>
<p>Create your account, submit the required paperwork, and wait for TaGo&apos;s approval to see production times, equipment availability, and other opted-in resident brands.</p>
<ul>
<li>
<Check/> Create your business profile</li>
<li>
<Upload/> Upload required credentials</li>
<li>
<Clock3/> TaGo&apos;s reviews and approves access</li>
</ul>
<button onClick={()=>{window.location.href="/account"}}>Create or finish profile <ChevronRight/>
</button>
</div>
</section>
</div>;
  return <div className="view">
<PageTitle eyebrow="APPROVED CHEF WORKSPACE" title="Inner Schedule">
<>Coordinate production around equipment availability and the privacy choices of other resident brands.</>
</PageTitle>
<div className="inner-notice">
<ShieldCheck/>
<span>
<b>Private network calendar</b>Only approved chefs and TaGo&apos;s administrators can access this schedule. Admin always sees the business behind every block.</span>
</div>
<div className="schedule-layout">
<section className="calendar-card">
<div className="card-head">
<div>
<p>SEPTEMBER 2026</p>
<h2>Kitchen & equipment availability</h2>
</div>
<span className="privacy-state">{showBrand?<>
<Eye/> My brand is visible</>:<>
<EyeOff/> My time shows as blocked</>}</span>
</div>
<div className="calendar-grid inner-grid">
<div/>
<b>FRI 12</b>
<b>SAT 13</b>
<b>SUN 14</b>
<b>MON 15</b>
<span>6 AM</span>
<i/>
<i/>
<i/>
<i/>
<span>8 AM</span>
<i/>
<i className="event orange">{showBrand?"Tony's Kitchen Co.":"Reserved"}<br/>
<small>Full cook line</small>
</i>
<i/>
<i/>
<span>10 AM</span>
<i/>
<i className="event orange continue"/>
<i/>
<i/>
<span>12 PM</span>
<i className="event blue">Resident brand<br/>
<small>Double ovens</small>
</i>
<i/>
<i/>
<i/>
<span>2 PM</span>
<i/>
<i/>
<i/>
<i className="event private-event">Reserved<br/>
<small>Food truck</small>
</i>
<span>4 PM</span>
<i/>
<i/>
<i/>
<i className="event private-event continue"/>
</div>
<div className="calendar-key">
<span>
<i className="open"/>Available</span>
<span>
<i className="named"/>Brand visible</span>
<span>
<i className="hidden"/>Private reservation</span>
</div>
</section>
<aside className="upcoming">
<div className="card-head">
<div>
<p>YOUR BOOKINGS</p>
<h2>Production time</h2>
</div>
</div>{[{d:"13",m:"SEP",name:"Full cook line",time:"8:00 AM–12:00 PM",status:"Confirmed"},{d:"18",m:"SEP",name:"Fryer station",time:"6:00 AM–10:00 AM",status:"Confirmed"}].map(b=>
<article key={b.d}>
<time>
<b>{b.d}</b>{b.m}</time>
<div>
<b>{b.name}</b>
<span>{b.time}</span>
<small className="verified">{b.status}</small>
</div>
<button className="report-mini" onClick={()=>notice(`Issue report opened for ${b.name} on Sep ${b.d}.`)}>
<Flag/> Report</button>
</article>)}<button className="outline-wide" onClick={()=>setView("discover")}>
<Plus/> Book equipment</button>
<button className="issue-wide" onClick={()=>notice("General kitchen issue report opened. Admin will receive the booking, equipment, time, and reporter details.")}>
<AlertTriangle/> Report a kitchen issue</button>
</aside>
</div>
</div>
}

function PrivacyPanel({showBrand,setShowBrand,notice}:{showBrand:boolean;setShowBrand:(v:boolean)=>void;notice:(s:string)=>void}){return <div className="privacy-panel-wrap">
<section className="privacy-panel">
<div className="privacy-icon">{showBrand?<Eye/>:<EyeOff/>}</div>
<div>
<p>INNER SCHEDULE PRIVACY</p>
<h2>How should other approved chefs see your bookings?</h2>
<span>TaGo&apos;s administrators always see your business. This choice controls only what other approved resident chefs see.</span>
</div>
<div className="privacy-choices">
<button className={showBrand?"active":""} onClick={()=>{setShowBrand(true);notice("Your brand will be visible to approved chefs on the Inner Schedule.")}}>
<Eye/>
<b>Show my brand</b>
<span>Supports networking and schedule swaps.</span>
</button>
<button className={!showBrand?"active":""} onClick={()=>{setShowBrand(false);notice("Other chefs will see only that the time and equipment are reserved.")}}>
<EyeOff/>
<b>Show as blocked</b>
<span>Keeps your business name private.</span>
</button>
</div>
</section>
</div>}

function Schedule({setView}:{setView:(v:View)=>void}){return <InnerSchedule setView={setView} approved={true} showBrand={true} notice={()=>{}}/>}

function Profile({uploaded,setUploaded,notice}:{uploaded:boolean,setUploaded:(b:boolean)=>void,notice:(s:string)=>void}){return <div className="view">
<PageTitle eyebrow="BUSINESS PROFILE" title="Your kitchen passport">
<>Upload credentials once and use the verified profile at every kitchen in the network.</>
</PageTitle>
<div className="profile-layout">
<div>
<section className="identity-card">
<div className="avatar">TK</div>
<div>
<h2>Tony&apos;s Kitchen Co.</h2>
<p>Caterer • Food truck operator</p>
<span>
<ShieldCheck/> Identity verified</span>
</div>
<button>Edit profile</button>
</section>
<section className="credential-card">
<div className="card-head">
<div>
<p>COMPLIANCE VAULT</p>
<h2>Credentials & documents</h2>
</div>
<span className="completion">3 of 4 ready</span>
</div>{credentials.map((c,i)=>
<article key={c.name}>
<span className={c.status==="Verified"?"doc-icon good":c.status==="Action needed"?"doc-icon bad":"doc-icon pending"}>{c.status==="Verified"?<Check/>:c.status==="Action needed"?<AlertTriangle/>:<Clock3/>}</span>
<div>
<b>{c.name}</b>
<small>{i===1&&uploaded?"Insurance certificate selected • ready to submit":c.detail}</small>
</div>
<em className={c.status==="Verified"?"verified":c.status==="Action needed"?"warning":"pending-label"}>{i===1&&uploaded?"Ready":c.status}</em>{i===1&&<label className="mini-upload">
<Upload/> {uploaded?"Replace":"Upload"}<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e=>setUploaded(!!e.target.files?.length)}/>
</label>}</article>)}<button className="save-profile" disabled={!uploaded} onClick={()=>notice("Insurance submitted for review. Your dashboard will update when approved.")}>Submit for verification</button>
</section>
</div>
<aside className="passport">
<p>KITCHEN PASSPORT</p>
<div className="passport-ring">68<small>%</small>
</div>
<h3>Almost ready for instant booking</h3>
<p>Complete the missing requirement and approved kitchens can accept you automatically.</p>
<ul>
<li>
<Check/> Contact & identity</li>
<li>
<Check/> Food-handler card</li>
<li>
<Check/> Business license</li>
<li className="missing">
<AlertTriangle/> Liability insurance</li>
</ul>
<hr/>
<small>Each kitchen may request additional documents based on its license and equipment.</small>
</aside>
</div>
</div>}

function Payments(){return <div className="view">
<PageTitle eyebrow="MONEY" title="Payments & client sales">
<>Pay for kitchen time—and let your own customers pay you through your TaGo&apos;s storefront.</>
</PageTitle>
<div className="payments-hero">
<div>
<span>AVAILABLE BALANCE</span>
<h2>$1,842.60</h2>
<p>From 28 customer orders</p>
</div>
<button>Transfer to bank</button>
<i>Next payout • Monday</i>
</div>
<div className="summary-row">
<Metric icon={CreditCard} label="Customer sales" value="$3,480" hint="This month"/>
<Metric icon={Store} label="Kitchen spending" value="$540" hint="12 production hours"/>
<Metric icon={BarChart3} label="Net after kitchen" value="$2,940" hint="Before food costs"/>
<Metric icon={WalletCards} label="Orders" value="28" hint="94% paid"/>
</div>
<div className="pay-layout">
<section className="sales-card">
<div className="card-head">
<div>
<p>SELL THROUGH TAGO&apos;S</p>
<h2>Your customer checkout</h2>
</div>
<span className="connected">STRIPE READY</span>
</div>
<p>Create payment links for catering deposits, food-truck preorders, meal-prep subscriptions, and invoices. Customer money goes to your connected account; the platform can earn a configurable processing fee.</p>
<div className="pay-actions">
<button>
<Plus/> Create payment link</button>
<button>
<FileCheck2/> Send an invoice</button>
<button>
<PackageCheck/> Add a product</button>
</div>
<div className="mini-store">
<span>YOUR STOREFRONT</span>
<b>tagos.market/tonys-kitchen</b>
<button>View storefront <ChevronRight/>
</button>
</div>
</section>
<section className="transactions">
<div className="card-head">
<div>
<p>RECENT</p>
<h2>Transactions</h2>
</div>
<button>Export</button>
</div>{[{n:"Williams Catering",t:"Event deposit",v:"+$650.00"},{n:"Kitchen booking",t:"TaGo's • 4 hours",v:"−$180.00"},{n:"Meal Prep × 12",t:"Customer orders",v:"+$324.00"},{n:"Stripe payout",t:"Bank transfer",v:"−$1,100.00"}].map((x,i)=>
<article key={x.n}>
<span className={i===1||i===3?"tx out":"tx"}>{i===1?<Store/>:<CreditCard/>}</span>
<div>
<b>{x.n}</b>
<small>{x.t}</small>
</div>
<strong className={x.v[0]==="+"?"money-in":""}>{x.v}</strong>
</article>)}</section>
</div>
</div>}

function Metric({icon:Icon,label,value,hint,tone=""}:{icon:typeof Search,label:string,value:string,hint:string,tone?:string}){return <article className={`metric ${tone}`}>
<span>
<Icon/>
</span>
<div>
<small>{label}</small>
<b>{value}</b>
<p>{hint}</p>
</div>
</article>}
