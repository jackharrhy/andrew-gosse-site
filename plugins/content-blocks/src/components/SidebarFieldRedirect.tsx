// plugins/content-blocks/src/components/SidebarFieldRedirect.tsx
// Field widget that replaces the broken JSON inputs on the sidebar content page.
// Renders a prominent link to the custom Sidebar Editor plugin page instead.
import * as React from "react";

interface FieldWidgetProps {
  value: unknown;
  onChange: (value: unknown) => void;
  label: string;
  id: string;
  required?: boolean;
}

export function SidebarFieldRedirect({ label }: FieldWidgetProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <a
        href="/_emdash/admin/plugins/content-blocks/sidebar"
        className="inline-flex items-center gap-2 self-start px-4 py-2 rounded border border-input bg-card text-sm font-medium hover:bg-accent transition-colors"
      >
        Edit in Sidebar Editor →
      </a>
      <p className="text-xs text-muted-foreground">
        This field is managed through the Sidebar Editor.
      </p>
    </div>
  );
}
