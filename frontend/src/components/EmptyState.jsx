import { EmptyBoxIllustration } from "./Illustrations";

export default function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="relative mb-3">
        <EmptyBoxIllustration className="w-32 h-auto" />
        {Icon && (
          <span className="absolute -bottom-1 right-0 rounded-full bg-white/90 backdrop-blur border border-white/60 shadow-sm p-2">
            <Icon className="w-5 h-5 text-brand-500" />
          </span>
        )}
      </div>
      <h3 className="text-sm font-semibold text-slate-700">{title || "Nothing here yet"}</h3>
      {subtitle && <p className="mt-1 text-sm text-slate-500 max-w-sm">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
