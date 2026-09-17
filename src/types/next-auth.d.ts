import "next-auth";

// `ageBand` is an AgeBand from src/lib/age.ts, or "unknown" when the account
// has not declared one yet (AgeCheck asks). Typed as string here so the
// declaration file stays free of app imports.
declare module "next-auth" {
  interface User {
    id?: string;
    isGuest?: boolean;
    ageBand?: string;
  }
  interface Session {
    user: User & { id?: string; isGuest?: boolean; ageBand?: string };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    isGuest?: boolean;
    ageBand?: string;
  }
}
