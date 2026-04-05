// plugins/content-blocks/src/components/Repeater.tsx
import * as React from "react";

interface RepeaterProps<T> {
  items: T[];
  onChange: (items: T[]) => void;
  renderItem: (
    item: T,
    index: number,
    update: (item: T) => void
  ) => React.ReactNode;
  createItem: () => T;
  addLabel: string;
}

export function Repeater<T>({
  items,
  onChange,
  renderItem,
  createItem,
  addLabel,
}: RepeaterProps<T>) {
  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...items];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  };

  const moveDown = (index: number) => {
    if (index === items.length - 1) return;
    const next = [...items];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const update = (index: number) => (item: T) => {
    const next = [...items];
    next[index] = item;
    onChange(next);
  };

  const add = () => {
    onChange([...items, createItem()]);
  };

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        <div key={index} className="flex gap-2 items-start">
          <div className="flex flex-col gap-1 pt-1">
            <button
              type="button"
              onClick={() => moveUp(index)}
              disabled={index === 0}
              className="text-xs px-1 py-0.5 rounded border border-input hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
              title="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => moveDown(index)}
              disabled={index === items.length - 1}
              className="text-xs px-1 py-0.5 rounded border border-input hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
              title="Move down"
            >
              ↓
            </button>
          </div>
          <div className="flex-1">{renderItem(item, index, update(index))}</div>
          <button
            type="button"
            onClick={() => remove(index)}
            className="mt-1 text-sm px-2 py-1 rounded border border-destructive text-destructive hover:bg-destructive/10"
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="self-start text-sm px-3 py-1.5 rounded border border-input hover:bg-accent"
      >
        {addLabel}
      </button>
    </div>
  );
}
