export function LiveIndicator() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-chart-3 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-chart-3" />
      </span>
      <span className="text-xs font-medium text-chart-3">Live</span>
    </div>
  )
}
