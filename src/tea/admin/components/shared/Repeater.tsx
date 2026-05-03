// src/tea/admin/components/shared/Repeater.tsx
import * as React from "react";

interface Props<T> {
  items: T[];
  onChange: (items: T[]) => void;
  renderItem: (item: T, index: number, update: (item: T) => void) => React.ReactNode;
  createItem: () => T;
  addLabel: string;
}

export function Repeater<T>({
  items,
  onChange,
  renderItem,
  createItem,
  addLabel,
}: Props<T>) {
  const moveUp = (i: number) => {
    if (i === 0) return;
    const next = [...items];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next);
  };
  const moveDown = (i: number) => {
    if (i === items.length - 1) return;
    const next = [...items];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onChange(next);
  };
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
  const update = (i: number) => (item: T) => {
    const next = [...items];
    next[i] = item;
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 group">
          <div className="flex flex-col gap-0.5 pt-1 opacity-30 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => moveUp(i)}
              disabled={i === 0}
              className="text-xs px-1.5 py-0.5 rounded border border-input hover:bg-accent disabled:opacity-30"
              title="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => moveDown(i)}
              disabled={i === items.length - 1}
              className="text-xs px-1.5 py-0.5 rounded border border-input hover:bg-accent disabled:opacity-30"
              title="Move down"
            >
              ↓
            </button>
          </div>
          <div className="flex-1">{renderItem(item, i, update(i))}</div>
          <button
            type="button"
            onClick={() => remove(i)}
            className="mt-1 text-sm w-7 h-7 rounded border border-input text-muted-foreground hover:border-destructive hover:text-destructive hover:bg-destructive/5"
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, createItem()])}
        className="self-start text-sm px-3 py-1.5 rounded-md border border-input hover:bg-accent transition-colors"
      >
        {addLabel}
      </button>
    </div>
  );
}
