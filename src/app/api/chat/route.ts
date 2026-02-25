import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { runAssistantTurn } from "@/lib/chat/assistant";

export const runtime = "nodejs";

const chatRequestSchema = z.object({
  message: z.string().min(1),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .max(12)
    .default([]),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Payload invalido.", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await runAssistantTurn({
      message: parsed.data.message,
      history: parsed.data.history,
      context: {
        userId: session.user.id,
        role: session.user.role,
        scopeCode: session.user.scopeCode,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro interno ao processar chat.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
