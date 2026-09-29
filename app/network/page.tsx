import { Building2, ChefHat, ChevronRight, PackageCheck, Store, Truck } from "lucide-react";
import PublicHeader from "../public-header";
import "../public-marketplace.css";
import "./network.css";

const paths = [
  {
    icon: ChefHat,
    label: "CHEFS & FOOD BUSINESSES",
    title: "Cook, promote, and win work.",
    copy: "Create a public profile, post menus, request kitchen time, and respond to qualified customer opportunities.",
    href: "/account",
    action: "Create a Chef profile",
  },
  {
    icon: Building2,
    label: "KITCHEN PROVIDERS",
    title: "Put unused capacity to work.",
    copy: "List your licensed facility while keeping control of equipment, pricing, availability, approvals, and access.",
    href: "/host",
    action: "Apply as a Kitchen",
  },
  {
    icon: Truck,
    label: "FOOD TRUCK PROVIDERS",
    title: "Put a mobile kitchen into service.",
    copy: "Manage trucks, insured owner-supplied drivers, commissary prep, approved menus, dispatch, handoffs, maintenance, rentals, and payouts.",
    href: "/host/trucks",
    action: "Add a Food Truck",
  },
  {
    icon: Store,
    label: "RETAIL & COMMUNITY OUTLETS",
    title: "Bring local food to your customers.",
    copy: "Explore qualified local products, pickup partnerships, pop-ups, recurring orders, and private-label opportunities.",
    href: "/outlets",
    action: "Post an outlet opportunity",
  },
  {
    icon: PackageCheck,
    label: "VENDORS & SERVICE PROVIDERS",
    title: "Support the people doing the cooking.",
    copy: "Help network members source ingredients, packaging, equipment, delivery, maintenance, staffing, and business services.",
    href: "/account",
    action: "Join the TaGo's network",
  },
];

export default function NetworkPage() {
  return (
    <main className="public-page network-page">
      <PublicHeader />
      <section className="public-main">
        <p className="public-kicker">JOIN THE TAGO&apos;S NETWORK</p>
        <h1 className="public-title">Choose the role that fits your business.</h1>
        <p className="public-lead">
          TaGo&apos;s keeps each experience focused. You&apos;ll see only the tools,
          requests, and responsibilities connected to the role you choose.
        </p>
        <div className="network-grid">
          {paths.map(({ icon: Icon, ...path }) => (
            <article key={path.label}>
              <Icon />
              <p>{path.label}</p>
              <h2>{path.title}</h2>
              <span>{path.copy}</span>
              <a href={path.href}>{path.action} <ChevronRight /></a>
            </article>
          ))}
        </div>
        <aside className="network-note">
          <strong>One person can have more than one role.</strong>
          <span>A chef who manages a kitchen—or an owner who also cooks—can switch workspaces without creating separate accounts.</span>
        </aside>
      </section>
    </main>
  );
}
