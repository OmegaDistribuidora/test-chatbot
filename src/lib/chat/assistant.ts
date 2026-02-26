import { Role } from "@prisma/client";

import { openai } from "@/lib/openai";

import { executeTool, listToolsForRole } from "./tools";

const TODAY_ISO = new Date().toISOString().slice(0, 10);

const SYSTEM_PROMPT = `
Voce e um assistente corporativo de BI.
Data atual de referencia: ${TODAY_ISO}.
Regras:
- Responda em portugues do Brasil.
- Seja direto e objetivo.
- Use as ferramentas sempre que o usuario pedir metrica, faturamento ou qualquer dado numerico.
- Nunca invente numeros.
- Se a role do usuario nao puder acessar um dado, diga claramente que nao possui permissao.
- Se faltar informacao para executar uma consulta, pergunte somente o essencial.
- Para consultar faturamento, use a tool get_faturamento_total.
- Converta datas para formato YYYY-MM-DD antes de chamar a tool.
- Se o usuario pedir um dia especifico (exemplo: "25 de fevereiro"), use o ano atual se ele nao informar o ano.
- Se o usuario citar fornecedor por nome, envie no campo "fornecedor". Se ele informar codigo, use "codfornec".
`;

const MAX_TOOL_ROUNDS = 4;

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

type AssistantContext = {
  userId: string;
  role: Role;
  scopeCode: string;
};

type RunAssistantParams = {
  message: string;
  history: ConversationMessage[];
  context: AssistantContext;
};

function mapHistoryToInput(history: ConversationMessage[]) {
  return history
    .filter(
      (item): item is ConversationMessage & { role: "user" } =>
        item.role === "user",
    )
    .map((item) => ({
      role: "user" as const,
      content: [
        {
          type: "input_text" as const,
          text: item.content,
        },
      ],
    }));
}

function readResponseText(response: unknown) {
  const maybeResponse = response as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (maybeResponse.output_text && maybeResponse.output_text.trim().length > 0) {
    return maybeResponse.output_text.trim();
  }

  const messageItem = maybeResponse.output?.find((item) => item.type === "message");
  const textItem = messageItem?.content?.find((item) => item.type === "output_text");
  if (textItem?.text) {
    return textItem.text.trim();
  }

  return "Nao consegui montar uma resposta agora. Tente novamente.";
}

function extractFunctionCalls(response: unknown) {
  const maybeResponse = response as {
    output?: Array<{
      type?: string;
      call_id?: string;
      name?: string;
      arguments?: string;
    }>;
  };

  return (maybeResponse.output ?? []).filter((item) => item.type === "function_call");
}

export async function runAssistantTurn({
  message,
  history,
  context,
}: RunAssistantParams) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      answer:
        "OPENAI_API_KEY nao configurada. Defina a chave para habilitar respostas do modelo.",
      toolCalls: [] as string[],
    };
  }

  const tools = listToolsForRole(context.role);
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  let response = await openai.responses.create({
    model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: SYSTEM_PROMPT }],
      },
      ...mapHistoryToInput(history),
      {
        role: "user",
        content: [{ type: "input_text", text: message }],
      },
    ],
    tools,
  });

  const toolCallsUsed: string[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const functionCalls = extractFunctionCalls(response);
    if (functionCalls.length === 0) {
      break;
    }

    const functionOutputs = await Promise.all(
      functionCalls.map(async (call) => {
        const result = await executeTool({
          toolName: call.name ?? "",
          argumentJson: call.arguments ?? "{}",
          context,
        });

        if (call.name) {
          toolCallsUsed.push(call.name);
        }

        return {
          type: "function_call_output" as const,
          call_id: call.call_id ?? "",
          output: JSON.stringify(result),
        };
      }),
    );

    response = await openai.responses.create({
      model,
      previous_response_id: response.id,
      input: functionOutputs,
      tools,
    });
  }

  return {
    answer: readResponseText(response),
    toolCalls: toolCallsUsed,
  };
}
