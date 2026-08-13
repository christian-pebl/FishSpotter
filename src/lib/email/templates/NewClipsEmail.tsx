import { Button, Text } from "@react-email/components";
import { EmailLayout } from "./_Layout";

export interface NewClipsPayload {
  displayName: string;
  /** Feed-visible clips added since this spotter was last notified. */
  clipCount: number;
  /** Human phrase for where they came from, e.g. "Loch Sunart and Bideford Bay". */
  sitesLabel: string;
  feedUrl: string;
  unsubscribeUrl: string;
}

export function NewClipsEmail(p: NewClipsPayload) {
  const clips = `${p.clipCount} new clip${p.clipCount === 1 ? "" : "s"}`;
  return (
    <EmailLayout preview={`${clips} to identify on PEBL FishSpotter`}>
      <Text style={{ fontSize: 22, fontWeight: 700, color: "#17252A", marginTop: 16 }}>
        {p.clipCount === 1 ? "A new clip has landed" : "New clips have landed"}
      </Text>
      <Text style={{ fontSize: 14, lineHeight: 1.55, color: "#17252A" }}>
        Hi {p.displayName}, there {p.clipCount === 1 ? "is" : "are"}{" "}
        <strong>{clips}</strong> waiting on the feed
        {p.sitesLabel ? (
          <>
            {" "}
            from <strong>{p.sitesLabel}</strong>
          </>
        ) : null}
        . Nobody has identified {p.clipCount === 1 ? "it" : "them"} yet, so the
        first-sighting Pebbles are still up for grabs.
      </Text>
      <Button
        href={p.feedUrl}
        style={{
          backgroundColor: "#3AAFA9",
          color: "#17252A",
          padding: "12px 20px",
          borderRadius: 9999,
          fontSize: 14,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Identify them
      </Button>
      <Text style={{ fontSize: 11, color: "#5A6E74", marginTop: 24 }}>
        You&apos;re getting this because you asked to be told when new footage is
        added. It only sends when there is something new to see.{" "}
        <a href={p.unsubscribeUrl} style={{ color: "#5A6E74", textDecoration: "underline" }}>
          One-click unsubscribe
        </a>
        .
      </Text>
    </EmailLayout>
  );
}
