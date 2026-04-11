// plugins/content-blocks/src/components/SeoAudit.tsx
import * as React from "react";
import { fetchContentList } from "@emdash-cms/admin";

interface SeoData {
  title: string | null;
  description: string | null;
  image: string | null;
  noIndex: boolean;
}

interface PageItem {
  id: string;
  slug: string | null;
  data: Record<string, unknown>;
  seo?: SeoData | null;
}

function Check({ ok, warn }: { ok: boolean; warn?: boolean }) {
  if (ok) return <span className="text-green-600 font-bold">✓</span>;
  if (warn) return <span className="text-yellow-500 font-bold">⚠</span>;
  return <span className="text-destructive font-bold">✗</span>;
}

function charCount(s: string | null | undefined, min: number, max: number) {
  if (!s) return null;
  const n = s.length;
  const ok = n >= min && n <= max;
  return (
    <span className={`text-xs ml-1 ${ok ? "text-muted-foreground" : "text-yellow-500"}`}>
      ({n})
    </span>
  );
}

export function SeoAudit() {
  const [pages, setPages] = React.useState<PageItem[]>([]);
  const [homepage, setHomepage] = React.useState<PageItem | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.all([
      fetchContentList("pages", { limit: 100 }),
      fetchContentList("homepage", { limit: 1 }),
    ])
      .then(([pagesResult, homepageResult]) => {
        setPages(
          (pagesResult.items as PageItem[]).sort((a, b) =>
            (a.slug ?? "").localeCompare(b.slug ?? "")
          )
        );
        setHomepage((homepageResult.items[0] as PageItem) ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const allItems: Array<{ label: string; slug: string; id: string; collection: string; seo?: SeoData | null }> = [
    ...(homepage
      ? [{ label: "Homepage", slug: "/", id: homepage.id, collection: "homepage", seo: homepage.seo }]
      : []),
    ...pages.map((p) => ({
      label: (p.data?.page_slug as string) || p.slug || p.id,
      slug: p.slug ?? "",
      id: p.id,
      collection: "pages",
      seo: p.seo,
    })),
  ];

  const missing = allItems.filter(
    (p) => !p.seo?.title || !p.seo?.description
  ).length;

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading SEO data…</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">SEO Audit</h1>
        <p className="text-sm text-muted-foreground">
          Overview of SEO metadata across all pages. Click a page to edit its SEO in the standard editor.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total pages", value: allItems.length },
          {
            label: "Missing title or description",
            value: missing,
            bad: missing > 0,
          },
          {
            label: "Complete",
            value: allItems.length - missing,
            good: allItems.length - missing > 0,
          },
        ].map(({ label, value, bad, good }) => (
          <div
            key={label}
            className={`rounded-md border p-4 flex flex-col gap-1 ${
              bad ? "border-destructive bg-destructive/5" : good ? "border-green-500/30 bg-green-500/5" : "border-border"
            }`}
          >
            <span className="text-2xl font-bold">{value}</span>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-4 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Page</th>
              <th className="text-left px-4 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Title</th>
              <th className="text-left px-4 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Description</th>
              <th className="text-center px-4 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Image</th>
              <th className="text-center px-4 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">noindex</th>
            </tr>
          </thead>
          <tbody>
            {allItems.map((item, i) => {
              const editorUrl = `/_emdash/admin/content/${item.collection}/${item.id}`;
              const hasTitle = !!item.seo?.title;
              const hasDesc = !!item.seo?.description;
              const hasImage = !!item.seo?.image;
              const complete = hasTitle && hasDesc;

              return (
                <tr
                  key={item.id}
                  className={`border-b border-border last:border-0 ${
                    !complete ? "bg-destructive/3" : i % 2 === 0 ? "" : "bg-muted/20"
                  }`}
                >
                  <td className="px-4 py-3">
                    <a
                      href={editorUrl}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {item.label}
                    </a>
                    {item.seo?.noIndex && (
                      <span className="ml-2 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                        noindex
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1">
                      <Check ok={hasTitle} />
                      {item.seo?.title ? (
                        <span className="text-muted-foreground truncate max-w-48" title={item.seo.title}>
                          {item.seo.title}
                          {charCount(item.seo.title, 30, 60)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50 italic text-xs">empty</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1">
                      <Check ok={hasDesc} warn={!!(item.seo?.description && (item.seo.description.length < 120 || item.seo.description.length > 160))} />
                      {item.seo?.description ? (
                        <span className="text-muted-foreground truncate max-w-64" title={item.seo.description}>
                          {item.seo.description}
                          {charCount(item.seo.description, 120, 160)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50 italic text-xs">empty</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Check ok={hasImage} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.seo?.noIndex ? (
                      <span className="text-yellow-500 font-bold">⚠</span>
                    ) : (
                      <span className="text-muted-foreground/30">–</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex gap-6 text-xs text-muted-foreground">
        <span><span className="text-green-600 font-bold">✓</span> Present</span>
        <span><span className="text-yellow-500 font-bold">⚠</span> Present but length outside recommended range</span>
        <span><span className="text-destructive font-bold">✗</span> Missing</span>
        <span>Title: 30–60 chars · Description: 120–160 chars</span>
      </div>
    </div>
  );
}
