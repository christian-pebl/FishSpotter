/**
 * Conference load-test harness (READ-ONLY).
 *
 * Simulates a QR-code crowd hitting the public read paths concurrently and
 * reports latency percentiles + error rate, so we have EVIDENCE the app holds
 * under a spike before the conference rather than hope. This is the network
 * "stress test" half of the hardening plan (the unit tests cover the logic).
 *
 * SAFETY:
 *  - Read-only. It only issues GETs to public SSR pages; it never POSTs an
 *    answer, so it writes nothing to the database.
 *  - It refuses the production hosts (fishspotter.app / fish-spotter.vercel.app)
 *    unless --force is passed, so you point it at a PREVIEW deploy, not prod.
 *    Hammering the live Supabase would risk the very thing we are protecting.
 *
 * Usage:
 *   npx tsx scripts/loadtest.ts --url https://<preview>.vercel.app --users 100 --seconds 30
 *   npx tsx scripts/loadtest.ts --url http://localhost:3000 --users 50 --seconds 20
 *   # add  --snippet <id>  to also hammer GET /api/snippets/<id>/stats
 */

type Args = {
  url: string;
  users: number;
  seconds: number;
  snippet?: string;
  force: boolean;
};

function parseArgs(argv: string[]): Args {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const url = get("--url") ?? process.env.LOADTEST_URL ?? "";
  return {
    url: url.replace(/\/$/, ""),
    users: Number(get("--users") ?? 50),
    seconds: Number(get("--seconds") ?? 20),
    snippet: get("--snippet"),
    force: argv.includes("--force"),
  };
}

const PROD_HOSTS = ["fishspotter.app", "fish-spotter.vercel.app"];

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url) {
    console.error("Missing --url <baseUrl> (or LOADTEST_URL). Aborting.");
    process.exit(1);
  }
  if (PROD_HOSTS.some((h) => args.url.includes(h)) && !args.force) {
    console.error(
      `Refusing to load-test a production host (${args.url}). Point this at a ` +
        `PREVIEW deploy. Pass --force only if you really mean to hit prod.`,
    );
    process.exit(1);
  }

  // The public, DB-backed read paths a QR crowd lands on. All GET, all safe.
  const paths = ["/", "/feed", "/leaderboard", "/species"];
  if (args.snippet) paths.push(`/api/snippets/${args.snippet}/stats`);

  const deadline = Date.now() + args.seconds * 1000;
  const latencies: number[] = [];
  let ok = 0;
  let failed = 0;
  const statusCounts = new Map<number | string, number>();

  async function worker() {
    while (Date.now() < deadline) {
      const path = paths[Math.floor((latencies.length + ok + failed) % paths.length)];
      const started = performance.now();
      try {
        const res = await fetch(args.url + path, {
          headers: { "user-agent": "fishspotter-loadtest" },
        });
        // Drain the body so the connection completes (and we measure real TTLB).
        await res.arrayBuffer();
        const ms = performance.now() - started;
        latencies.push(ms);
        statusCounts.set(res.status, (statusCounts.get(res.status) ?? 0) + 1);
        if (res.ok) ok++;
        else failed++;
      } catch (err) {
        failed++;
        const key = err instanceof Error ? err.name : "error";
        statusCounts.set(key, (statusCounts.get(key) ?? 0) + 1);
      }
    }
  }

  console.log(
    `Load test: ${args.users} concurrent users x ${args.seconds}s against ${args.url}`,
  );
  console.log(`Paths: ${paths.join(", ")}\n`);

  await Promise.all(Array.from({ length: args.users }, () => worker()));

  const sorted = [...latencies].sort((a, b) => a - b);
  const total = ok + failed;
  console.log(`Requests:     ${total}  (${(total / args.seconds).toFixed(1)}/s)`);
  console.log(`OK:           ${ok}`);
  console.log(`Failed:       ${failed}  (${total ? ((failed / total) * 100).toFixed(2) : "0"}%)`);
  console.log(`Latency p50:  ${percentile(sorted, 50).toFixed(0)} ms`);
  console.log(`Latency p95:  ${percentile(sorted, 95).toFixed(0)} ms`);
  console.log(`Latency p99:  ${percentile(sorted, 99).toFixed(0)} ms`);
  console.log(`Latency max:  ${(sorted[sorted.length - 1] ?? 0).toFixed(0)} ms`);
  console.log(
    `Status mix:   ${[...statusCounts.entries()].map(([k, v]) => `${k}:${v}`).join("  ")}`,
  );

  // A simple pass/fail heuristic for the prove phase: <1% errors and a sane p95.
  const errorRate = total ? failed / total : 1;
  if (errorRate > 0.01) {
    console.log(`\nFAIL: error rate ${(errorRate * 100).toFixed(2)}% exceeds 1%.`);
    process.exit(1);
  }
  console.log(`\nPASS: error rate under 1%.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
