import { redirect } from "next/navigation";

// The leaderboard now lives as a tab inside the Pebbles hub (/pebbles), so the
// pebble score, the shop, and the ranking are one connected destination. This
// route is kept as a redirect so every existing /leaderboard link (side menu,
// onboarding, shared URLs) keeps working.
export default function LeaderboardRedirect() {
  redirect("/pebbles?tab=leaderboard");
}
