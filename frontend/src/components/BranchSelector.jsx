import { useBranch } from "../context/BranchContext";

export default function BranchSelector() {
  const { branches, selectedBranchId, setBranch, canSwitch, isConsolidated } = useBranch();

  if (!canSwitch) {
    const current = branches.find((b) => b.id === selectedBranchId);
    return (
      <div className="branch-chip" title="You are assigned to a single branch">
        <span className="branch-dot" />
        <span>{current?.name || "My Branch"}</span>
      </div>
    );
  }

  return (
    <div className="branch-select-wrap">
      <label className="branch-select-label" htmlFor="branch-select">Branch</label>
      <select
        id="branch-select"
        className="branch-select"
        value={selectedBranchId}
        onChange={(e) => setBranch(e.target.value)}
      >
        <option value="all">All branches (consolidated)</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}{b.isDefault ? " (default)" : ""}
          </option>
        ))}
      </select>
      {!isConsolidated && <span className="branch-active-dot" title="Filtered to a single branch" />}
    </div>
  );
}
