// plugins/content-blocks/src/components/BlocksFieldRedirect.tsx
// Field widget that replaces the portableText blocks field on the standard
// page/homepage editor with a link to the bespoke Page Editor.
import * as React from "react";

interface FieldWidgetProps {
  value: unknown;
  onChange: (value: unknown) => void;
  label: string;
  id: string;
  required?: boolean;
}

export function BlocksFieldRedirect({ label }: FieldWidgetProps) {
  // Derive entry id and collection from the current URL.
  // Standard EmDash editor URL: /_emdash/admin/content/<collection>/<id>
  const segments = window.location.pathname.split("/").filter(Boolean);
  // segments: ["_emdash", "admin", "content", "<collection>", "<id>"]
  const entryId = segments[segments.length - 1] ?? "";
  const collection = segments[segments.length - 2] ?? "pages";
  const href = `/_emdash/admin/plugins/content-blocks/page-editor?id=${entryId}&collection=${collection}`;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <a
        href={href}
        className="inline-flex items-center gap-2 self-start px-4 py-2 rounded border border-input bg-card text-sm font-medium hover:bg-accent transition-colors"
      >
        Edit in Page Editor →
      </a>
      <p className="text-xs text-muted-foreground">
        This field is managed through the Page Editor.
      </p>
    </div>
  );
}
