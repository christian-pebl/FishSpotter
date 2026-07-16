import "next-auth";

declare module "next-auth" {
  interface User {
    id?: string;
    isGuest?: boolean;
  }
  interface Session {
    user: User & { id?: string; isGuest?: boolean };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    isGuest?: boolean;
  }
}
