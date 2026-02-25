"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Message = {
  role: "assistant" | "user";
  content: string;
};

type ChatWindowProps = {
  userRole: string;
};

export function ChatWindow({ userRole }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Pergunte sobre os dados de faturamento. Vou usar somente as ferramentas permitidas para o seu perfil.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const placeholder = useMemo(() => {
    if (userRole === "ADMIN") {
      return "Ex: qual o faturamento do dia 2026-02-25 na filial 3?";
    }
    return "Ex: qual o faturamento de hoje da minha filial?";
  }, [userRole]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setError(null);
    setLoading(true);
    setInput("");

    const history = messages.slice(-10);
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erro ao consultar o chatbot.");
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer ?? "Sem resposta." },
      ]);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Falha inesperada no chat.";
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Nao consegui responder agora. Tente novamente em instantes.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex h-[calc(100vh-10rem)] flex-col rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-sm text-slate-600">
          Role ativa: <span className="font-semibold text-slate-900">{userRole}</span>
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
              message.role === "user"
                ? "ml-auto bg-[#0f766e] text-white"
                : "bg-slate-100 text-slate-900"
            }`}
          >
            {message.content}
          </div>
        ))}
        {loading ? (
          <div className="max-w-[85%] rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
            Consultando...
          </div>
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={onSubmit} className="border-t border-slate-200 p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={placeholder}
            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-[#0f766e] focus:ring-2"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-[#0f766e] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0b5f59] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      </form>
    </section>
  );
}
