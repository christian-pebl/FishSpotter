import { redirect } from "next/navigation";

// The leaderboard lives on the single Pebbles page (/pebbles) alongside the
// prize progress. This route is kept as a redirect so every existing
// /leaderboard link (side menu, onboarding, shared URLs) keeps working.
export default function LeaderboardRedirect() {
  redirect("/pebbles");
}
