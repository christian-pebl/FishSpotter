import { Button, Text } from "@react-email/components";
import { EmailLayout } from "./_Layout";

export interface WeeklyDigestPayload {
  displayName: string;
  weeklyAnswers: number;
  weeklyCorrect: number;
  currentStreak: number;
  newSnippetCount: number;
  feedUrl: string;
  unsubscribeUrl: string;
}

export function WeeklyDigestEmail(p: WeeklyDigestPayload) {
  return (
    <EmailLayout preview={`Your PEBL FishSpotter week — ${p.weeklyAnswers} answers, ${p.currentStreak}-day streak`}>
      <Text style={{ fontSize: 22, fontWeight: 700, color: "#17252A", marginTop: 16 }}>
        Hi {p.displayName}, here&apos;s your week.
      </Text>
      <Text style={{ fontSize: 14, lineHeight: 1.55, color: "#17252A" }}>
        Answers this week: <strong>{p.weeklyAnswers}</strong> ({p.weeklyCorrect} correct).
        <br />
        Current streak: <strong>{p.currentStreak} day{p.currentStreak === 1 ? "" : "s"}</strong>.
        {p.newSnippetCount > 0 && (
          <>
            <br />
            New sightings on the feed: <strong>{p.newSnippetCount}</strong>.
          </>
        )}
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
        Back to the feed
      </Button>
      <Text style={{ fontSize: 11, color: "#5A6E74", marginTop: 24 }}>
        You&apos;re getting this because you opted into the weekly digest in your account settings.{" "}
        <a href={p.unsubscribeUrl} style={{ color: "#5A6E74", textDecoration: "underline" }}>
          One-click unsubscribe
        </a>
        .
      </Text>
    </EmailLayout>
  );
}
