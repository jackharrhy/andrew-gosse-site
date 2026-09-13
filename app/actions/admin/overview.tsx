import type { Handle } from "remix/ui";
import type { ContentStore } from "../../data/content.ts";
import { AdminLayout } from "./layout.tsx";
import { mediaUrl } from "../block-renderer.ts";

export function Overview(handle: Handle<{ store: ContentStore }>) {
  return () => {
    const store = handle.props.store,
      pages = store.editorPages(),
      media = store.media(),
      adornments = store.adornments();
    const portrait = store
      .homepage()
      .blocks.filter((b) => b.type === "media")[1];
    return (
      <AdminLayout title="Overview" path="/tea/admin">
        <div className="page-heading">
          <div>
            <h1>Overview</h1>
          </div>
          <a className="button" href="/" target="_blank">
            Open website ↗
          </a>
        </div>
        <section className="overview-feature">
          <div>
            <h2>Homepage</h2>
            <a className="button primary" href="/tea/admin/homepage">
              Edit homepage
            </a>
            <div className="inventory">
              <span>
                <strong>{pages.length}</strong> pages
              </span>
              <span>
                <strong>{media.length}</strong> media files
              </span>
              <span>
                <strong>{adornments.length}</strong> adornments
              </span>
            </div>
          </div>
          {portrait && (
            <img
              src={mediaUrl(portrait.props.mediaId)}
              alt={portrait.props.alt}
            />
          )}
        </section>
        <div className="overview-columns">
          <section>
            <div className="section-heading">
              <h2>Pages</h2>
              <a href="/tea/admin/pages">All pages →</a>
            </div>
            {pages.slice(0, 6).map((p) => (
              <a className="simple-row" href={"/tea/admin/pages/" + p.slug}>
                <span>
                  {p.title}
                  <small>/{p.slug}</small>
                </span>
                <span>↗</span>
              </a>
            ))}
          </section>
          <section>
            <div className="section-heading">
              <h2>To review</h2>
            </div>
            <a className="task-row" href="/tea/admin/seo">
              <strong>Search descriptions</strong>
              <p>
                {pages.filter((p) => !p.seo.description).length} pages without a
                description.
              </p>
            </a>
            <a className="task-row" href="/tea/admin/media">
              <strong>Alternative text</strong>
              <p>
                {media.filter((m) => !m.alt).length} files without alt text.
              </p>
            </a>
            <a className="task-row" href="/tea/admin/sidebar">
              <strong>Navigation</strong>
              <p>Sidebar links and categories.</p>
            </a>
          </section>
        </div>
      </AdminLayout>
    );
  };
}
