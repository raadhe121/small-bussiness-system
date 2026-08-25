export const inr = (n, opts = {}) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: opts.decimals ?? 2,
    minimumFractionDigits: opts.decimals ?? 2,
    ...opts,
  }).format(Number(n) || 0);

export const compactInr = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
  if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(2)} L`;
  if (Math.abs(v) >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return inr(v, { decimals: 0 });
};

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const toInputDate = (d = new Date()) => {
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};

export const titleCase = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/(^|[\s_-])\w/g, (c) => c.toUpperCase())
    .replace(/_/g, " ");

export const ROLE_LABELS = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
  ACCOUNTANT: "Accountant",
};
