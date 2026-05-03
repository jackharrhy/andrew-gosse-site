// src/tea/admin/components/Dashboard.tsx
import { Link } from "react-router-dom";

const TILES = [
  { href: "/tea/admin/pages", label: "Pages", desc: "Edit content pages with BlockNote" },
  { href: "/tea/admin/homepage", label: "Homepage", desc: "Edit the homepage blocks" },
  { href: "/tea/admin/sidebar", label: "Sidebar", desc: "Categories, nav items, social links" },
  { href: "/tea/admin/site", label: "Site", desc: "Background color and global config" },
  { href: "/tea/admin/adornments", label: "Adornments", desc: "Tape, lines, decorative presets" },
  { href: "/tea/admin/media", label: "Media", desc: "Upload and manage images" },
  { href: "/tea/admin/seo", label: "SEO Audit", desc: "Check title/description coverage" },
];

export function Dashboard() {
  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4">
        {TILES.map((tile) => (
          <Link
            key={tile.href}
            to={tile.href}
            className="p-5 rounded-md border border-border hover:bg-accent hover:border-accent-foreground/20 transition-colors flex flex-col gap-1"
          >
            <span className="font-semibold text-sm">{tile.label}</span>
            <span className="text-xs text-muted-foreground">{tile.desc}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
