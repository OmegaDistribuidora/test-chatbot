import { Role } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
      scopeCode: string;
    };
  }

  interface User {
    role: Role;
    scopeCode: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    scopeCode?: string;
  }
}
