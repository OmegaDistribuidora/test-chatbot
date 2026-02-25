import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";

import { ChatWindow } from "./chat-window";

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(140deg,#ecfeff_0%,#f8fafc_45%,#f1f5f9_100%)] px-4 py-6">
      <section className="mx-auto w-full max-w-4xl">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Chatbot de Dados
            </h1>
            <p className="text-sm text-slate-600">
              {session.user.name} ({session.user.email}) - escopo {session.user.scopeCode}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              Sair
            </button>
          </form>
        </header>

        <ChatWindow userRole={session.user.role} />
      </section>
    </main>
  );
}
