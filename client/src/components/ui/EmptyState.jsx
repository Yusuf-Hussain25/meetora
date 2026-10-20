// Friendly placeholder for lists with nothing in them yet.
const EmptyState = ({ icon, title, children, action, className = '' }) => (
  <div className={`flex flex-col items-center justify-center px-6 py-14 text-center ${className}`}>
    {icon && (
      <span className="relative mb-5 grid size-16 place-items-center rounded-2xl border border-line bg-surface-2 text-accent-text shadow-glow">
        {icon}
      </span>
    )}
    <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
    {children && <p className="mt-1.5 max-w-sm text-sm text-fg-3">{children}</p>}
    {action && <div className="mt-6">{action}</div>}
  </div>
);

export default EmptyState
