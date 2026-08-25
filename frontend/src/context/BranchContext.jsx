import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "./AuthContext";
import { setSelectedBranch, setFallbackBranch } from "../services/branchState";

const BranchContext = createContext(null);

const SWITCH_ROLES = ["OWNER", "ADMIN", "MANAGER"];

export function BranchProvider({ children }) {
  const { user } = useAuth();
  const canSwitch = !!user && SWITCH_ROLES.includes(user.role);

  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("all");

  // Initialize selection: managers/owners may switch (default consolidated),
  // employees are locked to their assigned branch.
  useEffect(() => {
    if (!user) return;
    if (canSwitch) {
      const stored = localStorage.getItem("bh_branch");
      setSelectedBranchId(stored && stored !== "all" ? stored : "all");
      api.get("/branches").then((r) => setBranches(r.data.data?.items || r.data.data || [])).catch(() => setBranches([]));
    } else {
      setSelectedBranchId(user.branchId || "all");
      setBranches(user.branchId ? [{ id: user.branchId, name: "My Branch" }] : []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Keep the interceptor + persistence in sync with the current selection.
  useEffect(() => {
    setSelectedBranch(selectedBranchId);
    localStorage.setItem("bh_branch", selectedBranchId);
  }, [selectedBranchId]);

  // Resolve a concrete branch for writes when "All branches" is selected.
  useEffect(() => {
    let fb = user?.branchId || null;
    if (selectedBranchId !== "all") fb = selectedBranchId;
    else if (branches.length) fb = branches[0].id;
    setFallbackBranch(fb);
  }, [selectedBranchId, branches, user?.branchId]);

  const value = {
    branches,
    selectedBranchId,
    setBranch: setSelectedBranchId,
    canSwitch,
    userBranchId: user?.branchId || null,
    isConsolidated: selectedBranchId === "all",
    selectedBranch: branches.find((b) => b.id === selectedBranchId) || null,
  };

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export const useBranch = () => useContext(BranchContext);
