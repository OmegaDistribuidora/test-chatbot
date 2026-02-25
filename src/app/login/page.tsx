import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/chat");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#d1fae5_0%,#ecfeff_45%,#f8fafc_100%)] px-4 py-12">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white/90 p-6 shadow-lg backdrop-blur">
        <h1 className="text-2xl font-semibold text-slate-900">
          Chatbot Corporativo
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Entre com sua conta para acessar os dados permitidos pelo seu perfil.
        </p>
        <div className="mt-6">
          <LoginForm />
        </div>
        <div className="mt-6 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
          <p>Credenciais demo:</p>
          <p>`admin` / `Omega@123`</p>
          <p>`coordenador.cariri` / `Omega@123`</p>
        </div>
      </section>
    </main>
  );
}
