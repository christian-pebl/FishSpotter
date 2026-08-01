import { Button, Text } from "@react-email/components";
import { EmailLayout } from "./_Layout";

export interface NewCommentPayload {
  authorName: string;
  reasonLabel: string;
  body: string;
  suggestedName: string | null;
  snippetLabel: string;
  theirAnswer: string | null;
  inboxUrl: string;
  isReport: boolean;
  reportCount: number;
}

/**
 * Instant staff notification for a new clip comment (or the first report of one).
 *
 * This is an internal operational email to PEBL staff, not marketing, so it
 * carries no unsubscribe link — the throttle in comment-notify.ts is what keeps
 * it from becoming a pager.
 */
export function NewCommentEmail(p: NewCommentPayload) {
  const heading = p.isReport
    ? `Comment reported (${p.reportCount})`
    : `New comment: ${p.reasonLabel}`;

  return (
    <EmailLayout preview={`${heading} — ${p.body.slice(0, 80)}`}>
      <Text style={{ fontSize: 20, fontWeight: 700, color: "#17252A", marginTop: 16 }}>
        {heading}
      </Text>

      <Text style={{ fontSize: 14, lineHeight: 1.55, color: "#17252A" }}>
        <strong>{p.authorName}</strong> on <strong>{p.snippetLabel}</strong>
        {p.theirAnswer ? ` (called it “${p.theirAnswer}”)` : ""}:
      </Text>

      <Text
        style={{
          fontSize: 14,
          lineHeight: 1.6,
          color: "#17252A",
          background: "#DEF2F1",
          borderLeft: "3px solid #3AAFA9",
          padding: "10px 14px",
          borderRadius: 6,
          whiteSpace: "pre-wrap",
        }}
      >
        {p.body}
      </Text>

      {p.suggestedName && (
        <Text style={{ fontSize: 13, color: "#2B7A78" }}>
          Suggested species: <strong>{p.suggestedName}</strong>
        </Text>
      )}

      <Button
        href={p.inboxUrl}
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
        Open the feedback inbox
      </Button>

      <Text style={{ fontSize: 11, color: "#5A6E74", marginTop: 24 }}>
        Sent to PEBL staff because a spotter commented on a clip. Notifications are
        capped per hour; anything above the cap is still waiting in the inbox.
      </Text>
    </EmailLayout>
  );
}
