"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/auth";

export type LoginFormState = {
  error?: string;
};

export async function loginAction(
  _previousState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const login = String(formData.get("login") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", {
      login,
      password,
      redirectTo: "/chat",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Credenciais invalidas." };
    }

    throw error;
  }
}
