import type { Handle, RemixNode } from "remix/ui";
import { entryHref, entryPreloads } from "../assets.ts";

export function Document(
  handle: Handle<{
    title: string;
    children: RemixNode;
    head?: RemixNode;
    admin?: boolean;
    background?: string;
    static?: boolean;
  }>,
) {
  return () => (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.png" />
        <title>{handle.props.title}</title>
        <link
          rel="stylesheet"
          href={handle.props.admin ? "/admin.css" : "/site.css"}
        />
        {handle.props.head}
        {!handle.props.static &&
          entryPreloads.map((href) => <link rel="modulepreload" href={href} />)}
        {!handle.props.static && (
          <script type="module" src={entryHref}></script>
        )}
      </head>
      <body
        className={handle.props.admin ? "cms" : "site"}
        style={{ backgroundColor: handle.props.background }}
      >
        {handle.props.children}
      </body>
    </html>
  );
}
