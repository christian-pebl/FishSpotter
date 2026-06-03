export default function LeaderboardLoading() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto w-full max-w-3xl flex-1 px-4 py-10"
      aria-busy="true"
      aria-label="Loading leaderboard"
    >
      <div className="pebl-surface rounded-card p-6 animate-pulse motion-reduce:animate-none">
        <div className="h-3 w-24 rounded-full bg-navy-900/12" />
        <div className="mt-3 h-7 w-2/3 max-w-md rounded-full bg-navy-900/12" />
        <div className="mt-2 h-3 w-1/2 max-w-sm rounded-full bg-navy-900/12" />
      </div>
      <div className="pebl-surface rounded-card mt-6 divide-y divide-navy-900/12 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 animate-pulse motion-reduce:animate-none">
            <div className="h-8 w-8 rounded-full bg-navy-900/12" />
            <div className="flex-1">
              <div className="h-3 w-1/3 rounded-full bg-navy-900/12" />
              <div className="mt-2 h-2 w-1/4 rounded-full bg-navy-900/12" />
            </div>
            <div className="h-4 w-12 rounded-full bg-navy-900/12" />
          </div>
        ))}
      </div>
    </main>
  );
}
