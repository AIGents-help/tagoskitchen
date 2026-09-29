import {
  Building2,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  CreditCard,
  Eye,
  FileCheck2,
  LockKeyhole,
  Megaphone,
  PackageCheck,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  ShoppingBag,
  Upload,
  UsersRound,
  WalletCards,
  Wrench,
} from "lucide-react";
import Breadcrumbs from "../breadcrumbs";
import "./tour.css";
import "../experience.css";

export const metadata = {
  title: "How TaGo's Works | The Local Food Business Network",
  description: "See how customers, chefs, kitchens, outlets, and vendors connect through the TaGo's local food business network.",
};

const customerSteps = [
  { number: "01", icon: ShoppingBag, title: "Browse local food businesses", copy: "Explore public Chef profiles, menus, specialties, service areas, reviews, and contact options." },
  { number: "02", icon: BriefcaseBusiness, title: "Post what you need", copy: "Describe a catering event, recurring food service, company meal, delivery need, staffing request, or other opportunity once." },
  { number: "03", icon: UsersRound, title: "Compare qualified responses", copy: "Receive menus, ideas, pricing, and availability from approved businesses that fit the request." },
  { number: "04", icon: Check, title: "Approve the agreement", copy: "Choose a Chef, confirm the scope and price, and approve later changes before they alter the agreement." },
];

const chefSteps = [
  {
    number: "01",
    icon: FileCheck2,
    title: "Build your Kitchen Passport",
    copy: "Add your food business, choose schedule privacy, and keep required paperwork in one private profile.",
  },
  {
    number: "02",
    icon: ShieldCheck,
    title: "Get approved by TaGo’s",
    copy: "TaGo’s reviews credentials before private kitchen availability or resident-chef details become visible.",
  },
  {
    number: "03",
    icon: CalendarDays,
    title: "Book the right workspace",
    copy: "Approved chefs reserve available time, specific equipment, grouped stations, or the food truck.",
  },
  {
    number: "04",
    icon: Check,
    title: "Check in and close out",
    copy: "A mobile checklist records arrival, condition, cleaning, equipment shutdown, lights, and departure.",
  },
  { number: "05", icon: Megaphone, title: "Sell and promote", copy: "Create Pop-Up Pickup events at a network kitchen, from the food truck, or at a real off-site market or venue." },
  { number: "06", icon: WalletCards, title: "Grow the business", copy: "Track rentals and payments, promote events, and apply to catering or food-service opportunities from one workspace." },
];

const kitchenSteps = [
  { number: "01", icon: Building2, title: "Apply to the network", copy: "Submit the facility, operating authority, licenses, insurance, inspection information, equipment, and real location." },
  { number: "02", icon: ShieldCheck, title: "Complete verification", copy: "TaGo’s reviews the provider and facility before the location or its equipment can accept requests." },
  { number: "03", icon: Settings, title: "Build the listing", copy: "Set operating hours, prices, equipment capacity, booking minimums, lead time, house rules, deposits, and cancellation terms." },
  { number: "04", icon: UsersRound, title: "Protect resident priority", copy: "Block resident-chef time and dedicated resources first, then offer only the remaining safe capacity to approved chefs." },
  { number: "05", icon: Wrench, title: "Approve and operate", copy: "Review requests, approve usable time and equipment, control access, record condition, and manage maintenance or incidents." },
  { number: "06", icon: CreditCard, title: "Collect and receive payouts", copy: "TaGo’s manages processing and marketplace oversight while providers track rent, fees, payouts, disputes, and performance." },
];

const outletSteps = [
  { number: "01", icon: Store, title: "Post an outlet opportunity", copy: "Describe the shelf space, pickup location, pop-up, recurring order, private-label need, or community partnership you can offer." },
  { number: "02", icon: UsersRound, title: "Meet qualified producers", copy: "Connect with approved local Chefs and food businesses whose products or service fit your audience." },
  { number: "03", icon: CalendarDays, title: "Set the operating details", copy: "Agree on dates, quantities, delivery or pickup, display needs, pricing, and each party's responsibilities." },
  { number: "04", icon: Megaphone, title: "Promote the partnership", copy: "Help customers discover where and when they can buy from local TaGo's network businesses." },
];

const vendorSteps = [
  { number: "01", icon: PackageCheck, title: "List useful goods or services", copy: "Offer ingredients, packaging, delivery, maintenance, equipment, staffing, cleaning, or business support." },
  { number: "02", icon: Building2, title: "Serve kitchens and Chefs", copy: "Reach the network members who need routine supplies, scheduled delivery, repairs, or operational help." },
  { number: "03", icon: CalendarDays, title: "Coordinate recurring service", copy: "Set schedules, quantities, service areas, requirements, and the correct point of contact." },
  { number: "04", icon: WalletCards, title: "Build repeat business", copy: "Turn one successful service into an ongoing relationship across additional Chefs and kitchen locations." },
];

export default function TourPage() {
  return (
    <main className="tour-page">
      <header className="tour-header">
        <a href="/" aria-label="TaGo's Kitchen home">
          <img src="/tagos-kitchen-logo.png" alt="TaGo's Kitchen" />
        </a>
        <div>
          <a href="/account?mode=signin">Log in</a>
          <a className="tour-cta" href="/account">Create profile</a>
        </div>
      </header>
      <Breadcrumbs items={[{label:"How it works",href:"/tour"}, "The complete TaGo's network"]} />

      <section className="tour-hero">
        <div>
          <p>PUBLIC PRODUCT TOUR</p>
          <h1>See where you fit—and what happens next.</h1>
          <span>
            Follow the complete path for customers, Chefs, kitchen providers,
            outlets, and vendors. Each role gets focused tools and connects only
            where there is a useful opportunity.
          </span>
          <div className="tour-actions">
            <a href="/account">Start my profile <ChevronRight /></a>
            <a href="/">Return home</a>
          </div>
        </div>
        <img src="/tagos-pin-mascot.png" alt="TaGo's map pin mascot" />
      </section>

      <section className="tour-experience">
        <img src="/tagos-experience-hero.png" alt="A chef plating food in a commercial kitchen while another food business prepares to serve" />
        <div className="tour-experience-copy">
          <p>PICTURE THE POSSIBILITY</p>
          <h2>Your recipe. A real workspace. A path to customers.</h2>
          <span>Prep in an approved kitchen, serve from the food truck, or build a following through a neighborhood pop-up.</span>
          <div><b>PREP</b><i>→</i><b>SERVE</b><i>→</i><b>GROW</b></div>
        </div>
        <img className="tour-pin-guide" src="/tagos-pin-mascot.png" alt="" />
      </section>

      <section id="customers" className="tour-journey-head">
        <p>FOR CUSTOMERS, COMPANIES &amp; EVENT PLANNERS</p>
        <h2>Find a Chef directly—or invite the network to respond</h2>
        <span>For private events, company meals, catering dates, recurring service, delivery, staffing, and other food needs.</span>
      </section>
      <section className="tour-steps tour-four-steps">
        {customerSteps.map(({ number, icon: Icon, title, copy }) => (
          <article key={number}><span>{number}</span><Icon/><h2>{title}</h2><p>{copy}</p></article>
        ))}
      </section>
      <div className="tour-role-actions"><a href="/food-businesses">Browse public Chef profiles <ChevronRight/></a><a href="/catering">Post what you need</a></div>

      <section id="chefs" className="tour-journey-head">
        <p>FOR CHEFS &amp; FOOD BUSINESSES</p>
        <h2>From paperwork to paid food event</h2>
        <span>For caterers, food trucks, bakers, meal-prep businesses, packaged-food makers, and pop-up chefs.</span>
      </section>
      <section className="tour-steps">
        {chefSteps.map(({ number, icon: Icon, title, copy }) => (
          <article key={number}>
            <span>{number}</span>
            <Icon />
            <h2>{title}</h2>
            <p>{copy}</p>
          </article>
        ))}
      </section>

      <section id="kitchens" className="tour-provider">
        <div className="provider-visual">
          <img src="/tagos-kitchen.png" alt="A fully equipped commercial kitchen ready for independent food businesses" />
          <div><b>Turn downtime into opportunity.</b><span>List approved hours, equipment, pricing, and rules while you stay in control.</span></div>
        </div>
        <div className="tour-journey-head">
          <p>FOR KITCHEN PROVIDERS</p>
          <h2>Turn qualified capacity into managed revenue</h2>
          <span>For licensed commercial kitchens, commissaries, restaurants with unused production time, and approved food-truck facilities.</span>
        </div>
        <div className="tour-steps provider-steps">
          {kitchenSteps.map(({ number, icon: Icon, title, copy }) => (
            <article key={number}>
              <span>{number}</span><Icon /><h2>{title}</h2><p>{copy}</p>
            </article>
          ))}
        </div>
        <div className="provider-actions"><a href="/host"><Store /> See kitchen requirements and apply <ChevronRight /></a><small>Applying does not automatically publish a location. Every provider and facility is reviewed first.</small></div>
      </section>

      <section className="tour-opportunity-network">
        <div id="outlets" className="tour-journey-head">
          <p>FOR RETAIL &amp; COMMUNITY OUTLETS</p>
          <h2>Turn your location or audience into an opportunity</h2>
          <span>For stores, cafés, offices, markets, event venues, community organizations, and other places willing to carry or feature local food.</span>
        </div>
        <div className="tour-steps tour-four-steps">
          {outletSteps.map(({ number, icon: Icon, title, copy }) => (
            <article key={number}><span>{number}</span><Icon/><h2>{title}</h2><p>{copy}</p></article>
          ))}
        </div>
        <div className="tour-role-actions"><a href="/outlets">Post an outlet opportunity <ChevronRight/></a></div>

        <div id="vendors" className="tour-journey-head vendor-head">
          <p>FOR VENDORS &amp; SERVICE PROVIDERS</p>
          <h2>Become part of the operating network</h2>
          <span>Support resident Chefs and kitchens with the routine products and services required to keep food businesses moving.</span>
        </div>
        <div className="tour-steps tour-four-steps">
          {vendorSteps.map(({ number, icon: Icon, title, copy }) => (
            <article key={number}><span>{number}</span><Icon/><h2>{title}</h2><p>{copy}</p></article>
          ))}
        </div>
        <div className="tour-role-actions"><a href="/network">Explore every network role <ChevronRight/></a></div>
      </section>

      <section className="tour-preview">
        <div className="tour-copy">
          <p>PROFILE PREVIEW</p>
          <h2>Paperwork that travels with your business</h2>
          <span>
            The Kitchen Passport shows exactly what is missing, pending, or
            approved. Credential files remain private.
          </span>
          <ul>
            <li><Check /> Food-handler card</li>
            <li><Check /> Liability insurance</li>
            <li><Check /> Business license</li>
            <li><Check /> Menu and process documents</li>
          </ul>
        </div>
        <div className="screen-card">
          <div className="screen-top"><b>Kitchen Passport</b><em>68% complete</em></div>
          <div className="sample-notice"><Sparkles /><span><b>Preview only</b>No real user information is shown.</span></div>
          <label>Business or brand name<input value="Your Food Brand" readOnly /></label>
          <div className="sample-doc"><ShieldCheck /><span><b>Food-handler card</b>Approved</span><em>Verified</em></div>
          <div className="sample-doc"><Upload /><span><b>Liability insurance</b>Ready for upload</span><button>Upload</button></div>
          <div className="sample-privacy"><Eye /><span><b>Show my brand on the Inner Schedule</b>Approved chefs may contact me about schedule swaps.</span></div>
        </div>
      </section>

      <section className="tour-preview reverse">
        <div className="tour-copy">
          <p>PRIVATE SCHEDULE PREVIEW</p>
          <h2>Three ways to use a shared kitchen</h2>
          <span>
            Each kitchen can offer resident placement, recurring production blocks,
            and flexible hourly or equipment rentals. The kitchen publishes its own
            openings, prices, and availability while protecting resident priority.
          </span>
          <div className="privacy-rule"><LockKeyhole /><b>The public never sees this calendar.</b></div>
        </div>
        <div className="screen-card schedule-sample">
          <div className="screen-top"><b>Inner Schedule</b><em>Approved members only</em></div>
          <div className="sample-slot resident"><Clock3 /><span><b>1. Resident placement</b>Dedicated capacity and schedule priority</span><small>Kitchen managed</small></div>
          <div className="sample-slot private"><Clock3 /><span><b>2. Recurring production</b>Consistent approved time or equipment blocks</span><small>Kitchen managed</small></div>
          <div className="sample-slot open"><CalendarDays /><span><b>3. Flexible booking</b>Remaining hourly and equipment availability</span><small>Approved chefs</small></div>
        </div>
      </section>

      <section className="tour-closeout">
        <div>
          <p>MOBILE ACCOUNTABILITY</p>
          <h2>Leave the kitchen ready for the next chef.</h2>
        </div>
        <div className="checklist-phone">
          <b>Checkout checklist</b>
          {["Dishes washed and put away", "Equipment cleaned and turned off", "Surfaces sanitized", "Lights off and doors secured"].map(item => (
            <span key={item}><Check />{item}</span>
          ))}
          <button>Confirm checkout</button>
        </div>
      </section>
      <section className="tour-final-choice">
        <p>CHOOSE YOUR STARTING POINT</p>
        <h2>You only see the tools that match your role.</h2>
        <div><a href="/food-businesses">I need a Chef</a><a href="/?view=discover">I need a kitchen</a><a href="/account">I am a Chef</a><a href="/host">I provide a kitchen</a><a href="/outlets">I have an outlet</a><a href="/network">I provide services</a></div>
      </section>
    </main>
  );
}
