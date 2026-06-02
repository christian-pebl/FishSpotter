export default function BrowseLoading() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto w-full max-w-6xl flex-1 px-4 py-10"
      aria-busy="true"
      aria-label="Loading archive"
    >
      <div className="pebl-surface rounded-hero p-6 animate-pulse motion-reduce:animate-none">
        <div className="h-3 w-24 rounded-full bg-navy-900/12" />
        <div className="mt-3 h-7 w-3/4 max-w-md rounded-full bg-navy-900/12" />
        <div className="mt-2 h-3 w-2/3 max-w-sm rounded-full bg-navy-900/12" />
      </div>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="aspect-video rounded-card bg-white/40 animate-pulse motion-reduce:animate-none"
          />
        ))}
      </div>
    </main>
  );
}
