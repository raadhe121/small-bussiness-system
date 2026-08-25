export function Spinner({ className = "" }) {
  return (
    <div
      className={`inline-block w-6 h-6 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <Spinner className="w-8 h-8" />
    </div>
  );
}

export default Spinner;
