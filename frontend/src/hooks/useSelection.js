import { useMemo, useState } from "react";

/**
 * Manages a Set of selected row ids for a list, keeping selection in sync
 * with the currently-loaded items (so stale ids from a previous page are dropped).
 */
export default function useSelection(items = []) {
  const [selected, setSelected] = useState(() => new Set());

  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const idSet = useMemo(() => new Set(ids), [ids]);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = (checked) => setSelected(checked ? new Set(ids) : new Set());

  const clear = () => setSelected(new Set());

  const selectedIds = useMemo(
    () => [...selected].filter((id) => idSet.has(id)),
    [selected, idSet]
  );

  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const someSelected = selectedIds.length > 0;

  return {
    selectedIds,
    count: selectedIds.length,
    has: (id) => selected.has(id),
    toggle,
    toggleAll,
    clear,
    allSelected,
    someSelected,
  };
}
