// Headline number with a label and an optional supporting line.
const StatTile = ({ icon: Icon, label, value, hint }) => (
  <div className="card flex flex-col gap-4 rounded-[22px] p-5">
    <div className="flex items-center justify-between">
      <span className="text-[13px] font-medium text-fg-2">{label}</span>
      <span className="grid size-8 place-items-center rounded-lg bg-surface-2 text-fg-2"><Icon size={16} /></span>
    </div>
    <div>
      <p className="text-[28px] leading-none font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-2 text-[12.5px] text-fg-3">{hint}</p>}
    </div>
  </div>
);

export const StatTileSkeleton = () => (
  <div className="card flex flex-col gap-5 rounded-[22px] p-5">
    <div className="skeleton h-4 w-24" />
    <div className="skeleton h-7 w-16" />
  </div>
);

export default StatTile
