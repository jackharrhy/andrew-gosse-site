import type { Handle } from "remix/ui";
import type { ContentStore } from "../data/content.ts";
import type { Page } from "../ui/public/content-types.ts";
import { Document } from "../ui/document.tsx";
import { renderBlocks, mediaUrl } from "./block-renderer.ts";

export function PublicPage(
  handle: Handle<{
    page: Page | null;
    store: ContentStore;
    path: string;
    preview?: boolean;
  }>,
) {
  return () => {
    const { page, store, path, preview } = handle.props,
      site = store.site(),
      sidebar = store.sidebar();
    const title = page?.slug
      ? (page.seo.title || page.title) + " | " + site.site_name
      : site.site_name;
    const canonical =
      page?.seo.canonical || new URL(path, site.canonical_origin).href;
    const description = page?.seo.description || site.description;
    const image = page?.seo.image_id
      ? new URL(mediaUrl(page.seo.image_id), site.canonical_origin).href
      : null;
    const analyticsId = !preview
      ? process.env.GOOGLE_ANALYTICS_ID?.match(/^G-[A-Z0-9]+$/)?.[0]
      : undefined;
    return (
      <Document
        title={page ? title : "Page not found | " + site.site_name}
        background={site.background_color}
        static={preview}
        head={
          <>
            {analyticsId && (
              <>
                <script
                  async
                  src={`https://www.googletagmanager.com/gtag/js?id=${analyticsId}`}
                ></script>
                <script
                  innerHTML={`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(analyticsId)});`}
                ></script>
              </>
            )}
            <link rel="canonical" href={canonical} />
            <meta name="description" content={description} />
            {(preview || page?.seo.no_index || !page) && (
              <meta name="robots" content="noindex, nofollow" />
            )}
            <meta property="og:site_name" content={site.site_name} />
            <meta property="og:type" content="website" />
            <meta property="og:title" content={title} />
            <meta property="og:url" content={canonical} />
            <meta property="og:description" content={description} />
            {image && <meta property="og:image" content={image} />}
            <meta
              name="twitter:card"
              content={image ? "summary_large_image" : "summary"}
            />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            {image && <meta name="twitter:image" content={image} />}
          </>
        }
      >
        <div className="site-layout">
          <nav className="site-sidebar" aria-label="Main navigation">
            <a href="/" aria-label="Andrew Gosse homepage">
              {sidebar.top_image_id ? (
                <img
                  className="site-portrait"
                  src={mediaUrl(sidebar.top_image_id)}
                  alt={store.mediaItem(sidebar.top_image_id)?.alt ?? ""}
                />
              ) : (
                site.site_name
              )}
            </a>
            <details className="site-menu" open={!preview}>
              <summary>Menu</summary>
              <div>
                {sidebar.categories.map((c) => (
                  <section>
                    <h2
                      style={{
                        backgroundImage: c.backgroundImageId
                          ? `url(${mediaUrl(c.backgroundImageId)})`
                          : undefined,
                      }}
                    >
                      {c.categoryTitle}
                    </h2>
                    <ul>
                      {c.items.map((i) => (
                        <li>
                          <a
                            href={"/" + i.pageSlug}
                            aria-current={
                              page?.slug === i.pageSlug ? "page" : undefined
                            }
                          >
                            {i.text}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                <a className="contact-link" href="/contact">
                  Contact Me
                </a>
                <div className="social-links">
                  {sidebar.links.map((l) => (
                    <a href={l.url} target="_blank" rel="noopener noreferrer">
                      {l.service}
                    </a>
                  ))}
                </div>
              </div>
            </details>
          </nav>
          <main id="content" className="site-content">
            {page ? (
              <article
                className="prose"
                innerHTML={renderBlocks(
                  page.blocks,
                  store.adornments(),
                  preview,
                )}
              />
            ) : (
              <>
                <h1>This page wandered off.</h1>
                <p>
                  <a href="/">Back to the homepage</a>
                </p>
              </>
            )}
          </main>
        </div>
      </Document>
    );
  };
}
