import { Button, Text } from "@react-email/components";
import { EmailLayout } from "./_Layout";

const P = { fontSize: 14, lineHeight: 1.55, color: "#17252A" } as const;
const NOTE = { fontSize: 13, lineHeight: 1.5, color: "#5A6E74", margin: "2px 0 0" } as const;

export interface PrizeMilestoneEntry {
  spotter: string;
  pebbles: number;
  /** Who to write to, or why nobody can be written to yet. */
  note: string;
  /** isPrizeEligible's reasons, when the spotter fails the public claim rules. */
  flags: readonly string[];
}

/**
 * Internal note to PEBL staff (src/lib/prize-alerts.ts): these spotters have
 * reached the Pebble target, send them the guide. Like PrizeClaimStaffEmail it
 * carries no addresses; the desk has them, and for an under-18 the only one to
 * use is the parent's.
 */
export function PrizeMilestoneStaffEmail({
  send,
  waiting,
  target,
  deskUrl,
}: {
  send: readonly PrizeMilestoneEntry[];
  waiting: readonly PrizeMilestoneEntry[];
  target: number;
  deskUrl: string;
}) {
  const row = (e: PrizeMilestoneEntry, i: number) => (
    <Text key={i} style={{ ...P, margin: "12px 0 0" }}>
      <strong>{e.spotter}</strong>, {e.pebbles.toLocaleString("en-GB")} Pebbles
      <span style={{ display: "block", ...NOTE }}>{e.note}</span>
      {e.flags.length > 0 ? (
        <span style={{ display: "block", ...NOTE }}>
          Has not met the claim rules yet: {e.flags.join(", ")}.
        </span>
      ) : null}
    </Text>
  );

  return (
    <EmailLayout
      preview={
        send.length > 0
          ? `Send the Seasearch guide to ${send.map((e) => e.spotter).join(", ")}`
          : `${waiting.length} spotter${waiting.length === 1 ? "" : "s"} reached ${target.toLocaleString("en-GB")} Pebbles`
      }
    >
      {send.length > 0 ? (
        <>
          <Text style={{ fontSize: 20, fontWeight: 700, color: "#17252A", marginTop: 16 }}>
            Send a prize
          </Text>
          <Text style={P}>
            {send.length === 1 ? "This spotter has" : "These spotters have"} reached{" "}
            {target.toLocaleString("en-GB")} Pebbles. Email them for a UK postal address, post the
            Seasearch guide, then mark it posted on the desk.
          </Text>
          {send.map(row)}
        </>
      ) : null}
      {waiting.length > 0 ? (
        <>
          <Text style={{ fontSize: 16, fontWeight: 700, color: "#17252A", marginTop: 24 }}>
            Reached {target.toLocaleString("en-GB")}, but can&apos;t be sent one yet
          </Text>
          <Text style={P}>
            You&apos;ll get another email if they become reachable.
          </Text>
          {waiting.map(row)}
        </>
      ) : null}
      <Button
        href={deskUrl}
        style={{
          marginTop: 20,
          backgroundColor: "#3AAFA9",
          color: "#17252A",
          padding: "12px 20px",
          borderRadius: 9999,
          fontSize: 14,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Open the prize desk
      </Button>
    </EmailLayout>
  );
}
