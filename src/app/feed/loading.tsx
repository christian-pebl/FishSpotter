export default function FeedLoading() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="relative flex flex-1 flex-col items-center justify-center bg-navy-900 px-4 py-12"
      aria-busy="true"
      aria-label="Loading live feed"
    >
      <div className="pebl-surface rounded-card w-full max-w-sm animate-pulse motion-reduce:animate-none p-6">
        <div className="h-3 w-24 rounded-full bg-navy-900/12" />
        <div className="mt-4 aspect-[9/16] w-full rounded-card bg-navy-900/12" />
        <div className="mt-4 h-3 w-3/4 rounded-full bg-navy-900/12" />
        <div className="mt-2 h-3 w-2/3 rounded-full bg-navy-900/12" />
      </div>
    </main>
  );
}
