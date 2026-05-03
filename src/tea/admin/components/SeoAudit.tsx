// src/tea/admin/components/SeoAudit.tsx
import * as React from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

interface PageItem {
  id: string;
  slug: string;
  title: string;
  seo: {
    title: string | null;
    description: string | null;
    image_id: string | null;
    no_index: boolean;
  };
}

function lengthClass(n: number, min: number, max: number): string {
  if (n === 0) return "text-destructive";
  if (n < min || n > max) return "text-yellow-600";
  return "text-green-600";
}

export function SeoAudit() {
  const [pages, setPages] = React.useState<PageItem[]>([]);

  React.useEffect(() => {
    api.get<{ items: PageItem[] }>("/pages").then((r) => setPages(r.items));
  }, []);

  const totals = {
    pages: pages.length,
    missingTitle: pages.filter((p) => !p.seo.title).length,
    missingDescription: pages.filter((p) => !p.seo.description).length,
    missingImage: pages.filter((p) => !p.seo.image_id).length,
    noIndex: pages.filter((p) => p.seo.no_index).length,
  };

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">SEO Audit</h1>

      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Pages", value: totals.pages },
          { label: "Missing title", value: totals.missingTitle },
          { label: "Missing description", value: totals.missingDescription },
          { label: "Missing image", value: totals.missingImage },
          { label: "No-indexed", value: totals.noIndex },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-md border border-border bg-card p-4 flex flex-col gap-1"
          >
            <span className="text-2xl font-semibold">{s.value}</span>
            <span className="text-xs text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Page</th>
              <th className="text-left px-4 py-2 font-medium">Title</th>
              <th className="text-left px-4 py-2 font-medium">Description</th>
              <th className="text-center px-4 py-2 font-medium">Image</th>
              <th className="text-center px-4 py-2 font-medium">noindex</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pages.map((p) => {
              const titleLen = p.seo.title?.length ?? 0;
              const descLen = p.seo.description?.length ?? 0;
              return (
                <tr key={p.id}>
                  <td className="px-4 py-2">
                    <Link
                      to={`/tea/admin/pages/${p.slug}`}
                      className="font-medium hover:underline"
                    >
                      {p.title}
                    </Link>
                    <div className="text-xs text-muted-foreground font-mono">/{p.slug}</div>
                  </td>
                  <td className="px-4 py-2">
                    {p.seo.title ? (
                      <span className="truncate inline-block max-w-xs" title={p.seo.title}>
                        {p.seo.title}{" "}
                        <span className={`text-xs ${lengthClass(titleLen, 30, 60)}`}>
                          ({titleLen})
                        </span>
                      </span>
                    ) : (
                      <span className="text-destructive text-xs">— missing —</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {p.seo.description ? (
                      <span
                        className="truncate inline-block max-w-md"
                        title={p.seo.description}
                      >
                        {p.seo.description}{" "}
                        <span className={`text-xs ${lengthClass(descLen, 120, 160)}`}>
                          ({descLen})
                        </span>
                      </span>
                    ) : (
                      <span className="text-destructive text-xs">— missing —</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {p.seo.image_id ? "✓" : <span className="text-destructive">✗</span>}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {p.seo.no_index ? <span className="text-yellow-600">●</span> : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
