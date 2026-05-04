// src/tea/admin/components/Layout.tsx
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface Props {
  user: { id: number; email: string };
  children: React.ReactNode;
}

const NAV = [
  { href: "/tea/admin", label: "Dashboard" },
  { href: "/tea/admin/pages", label: "Pages" },
  { href: "/tea/admin/homepage", label: "Homepage" },
  { href: "/tea/admin/sidebar", label: "Sidebar" },
  { href: "/tea/admin/site", label: "Site" },
  { href: "/tea/admin/adornments", label: "Adornments" },
  { href: "/tea/admin/media", label: "Media" },
  { href: "/tea/admin/seo", label: "SEO" },
];

export function Layout({ user, children }: Props) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await api.post("/auth/logout").catch(() => undefined);
    navigate("/tea/admin/login");
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 shrink-0 border-r border-border bg-card flex flex-col">
        <div className="px-5 py-4 border-b border-border">
          <Link to="/tea/admin" className="font-semibold text-lg">
            TeaCMS
          </Link>
        </div>
        <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="px-3 py-1.5 rounded text-sm hover:bg-accent transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-border flex flex-col gap-2">
          <span className="text-xs text-muted-foreground truncate">{user.email}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-left text-muted-foreground hover:text-destructive transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
