import { Button, Text } from "@react-email/components";
import { EmailLayout } from "./_Layout";

export interface StreakNudgePayload {
  displayName: string;
  currentStreak: number;
  feedUrl: string;
  unsubscribeUrl: string;
}

export function StreakNudgeEmail(p: StreakNudgePayload) {
  return (
    <EmailLayout preview={`Your ${p.currentStreak}-day streak is in danger`}>
      <Text style={{ fontSize: 22, fontWeight: 700, color: "#17252A", marginTop: 16 }}>
        Hi {p.displayName}, your streak is on the line.
      </Text>
      <Text style={{ fontSize: 14, lineHeight: 1.55, color: "#17252A" }}>
        You&apos;re on a <strong>{p.currentStreak}-day</strong> spotting streak. One identification today keeps it alive.
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
        Log a sighting
      </Button>
      <Text style={{ fontSize: 11, color: "#5A6E74", marginTop: 24 }}>
        Streak nudges sit under the same digest opt-in.{" "}
        <a href={p.unsubscribeUrl} style={{ color: "#5A6E74", textDecoration: "underline" }}>
          One-click unsubscribe
        </a>
        .
      </Text>
    </EmailLayout>
  );
}
