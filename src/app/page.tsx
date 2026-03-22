import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">What’s that creature?</h1>
        <p className="text-slate-400 mb-6">
          Watch short clips from lakes, rivers and coastlines. Guess the creature, see what the community said, and climb the leaderboard.
        </p>
        <Link
          href="/feed"
          className="inline-block bg-cyan-500 text-slate-900 font-semibold px-6 py-3 rounded-lg hover:bg-cyan-400"
        >
          Browse clips
        </Link>
      </main>
    </div>
  );
}
