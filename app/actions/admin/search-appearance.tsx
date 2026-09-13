import type { Handle } from "remix/ui";
import type { Page } from "../../ui/public/content-types.ts";
export function SearchAppearance(
  handle: Handle<{ pages: Page[]; origin: string }>,
) {
  return () => (
    <>
      <div className="page-heading">
        <div>
          <h1>Search appearance</h1>
          <p className="muted">
            Page titles and descriptions for search results.
          </p>
        </div>
      </div>
      <div className="seo-list">
        {handle.props.pages.map((page) => (
          <section className="seo-row">
            <div>
              <span className="search-url">
                {handle.props.origin}/{page.slug}
              </span>
              <h2>
                <a href={"/tea/admin/pages/" + page.slug}>
                  {page.seo.title || page.title}
                </a>
              </h2>
              <p>{page.seo.description || "No description."}</p>
            </div>
            <div>
              <span className={"badge " + (page.seo.description ? "good" : "")}>
                {page.seo.no_index
                  ? "Hidden from search"
                  : page.seo.description
                    ? "Description ready"
                    : "Add a description"}
              </span>
              <a href={"/tea/admin/pages/" + page.slug}>Edit page ↗</a>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
