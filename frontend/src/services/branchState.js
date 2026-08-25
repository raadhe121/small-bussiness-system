// Shared, module-level branch selection used by the axios interceptor.
// BranchContext updates these so that list reads and writes automatically
// include the right branchId without touching every API call site.

let selectedBranchId = "all"; // 'all' (consolidated) or a branch uuid
let fallbackBranchId = null; // concrete branch used for writes when 'all' is selected

export function setSelectedBranch(id) {
  selectedBranchId = id || "all";
}

export function getSelectedBranch() {
  return selectedBranchId;
}

export function setFallbackBranch(id) {
  fallbackBranchId = id || null;
}

export function getFallbackBranch() {
  return fallbackBranchId;
}
