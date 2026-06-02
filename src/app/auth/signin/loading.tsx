export default function SignInLoading() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto w-full max-w-sm flex-1 px-4 py-12"
      aria-busy="true"
      aria-label="Loading sign in"
    >
      <div className="pebl-surface rounded-card p-6 animate-pulse motion-reduce:animate-none">
        <div className="h-3 w-24 rounded-full bg-navy-900/12" />
        <div className="mt-3 h-7 w-2/3 max-w-md rounded-full bg-navy-900/12" />
        <div className="mt-6 space-y-3">
          <div className="h-10 w-full rounded-modal bg-navy-900/12" />
          <div className="h-10 w-full rounded-modal bg-navy-900/12" />
          <div className="h-11 w-full rounded-full bg-navy-900/12" />
        </div>
      </div>
    </main>
  );
}
