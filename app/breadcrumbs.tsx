import { ChevronRight, Home } from "lucide-react";
import "./breadcrumbs.css";

export type BreadcrumbItem = string | { label: string; href?: string };

export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <a href="/"><Home />Home</a>
      {items.map((item, index) => {
        const label = typeof item === "string" ? item : item.label;
        const href = typeof item === "string" ? undefined : item.href;
        const current = index === items.length - 1;
        return (
          <span key={`${label}-${index}`}>
            <ChevronRight />
            {href && !current ? <a href={href}>{label}</a> : <b aria-current={current ? "page" : undefined}>{label}</b>}
          </span>
        );
      })}
    </nav>
  );
}
