import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

const TEAL = "#3AAFA9";
const NAVY = "#17252A";
const MUTED = "#5A6E74";

export function EmailLayout({
  preview,
  children,
}: {
  preview: string;
  children: ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: "#eef9f8",
          fontFamily:
            "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
        }}
      >
        <Container style={{ maxWidth: 560, margin: "32px auto", padding: 24 }}>
          <Section
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 28,
              padding: "28px 28px 20px",
              boxShadow: "0 18px 40px rgba(23,37,42,0.08)",
            }}
          >
            <Text
              style={{
                margin: 0,
                color: TEAL,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              PEBL FishSpotter
            </Text>
            {children}
          </Section>
          <Hr style={{ border: "none", height: 24 }} />
          <Text style={{ margin: 0, fontSize: 11, color: MUTED, textAlign: "center" }}>
            Plant Ecology Beyond Land (PEBL) CIC · Company no. 12076622 ·
            <br />
            <a
              href="https://pebl-cic.co.uk"
              style={{ color: NAVY, textDecoration: "underline" }}
            >
              pebl-cic.co.uk
            </a>
            {" · "}
            <a
              href="mailto:hello@pebl-cic.co.uk"
              style={{ color: NAVY, textDecoration: "underline" }}
            >
              hello@pebl-cic.co.uk
            </a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
