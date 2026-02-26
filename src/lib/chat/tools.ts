import { Role } from "@prisma/client";
import { z } from "zod";

import { queryFaturamentoTotal } from "@/lib/faturamento-db";

export type ChatToolContext = {
  role: Role;
  scopeCode: string;
  userId: string;
};

type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  allowedRoles: Role[];
  execute: (args: unknown, context: ChatToolContext) => Promise<unknown>;
};

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const allowedFiliais = new Set([1, 3, 4]);

const fornecedorMap: Record<string, number[]> = {
  bombril: [117],
  marata: [967],
  jde: [1968],
  mili: [3609],
  "bom principio": [6212],
  realeza: [1481],
  panasonic: [1630],
  "mat inset": [4750],
  assim: [4698],
  "q-odor": [3930],
  florence: [5514],
  ourolux: [4714],
  "stella doro": [6154],
  ccm: [5537],
  gallo: [5569],
  albany: [4701],
  elgin: [5687],
  bauducco: [5348],
};

const intFilterSchema = z.union([
  z.coerce.number().int().positive(),
  z.array(z.coerce.number().int().positive()).nonempty(),
]);

const faturamentoArgsSchema = z
  .object({
    date: z.string().regex(ISO_DATE_REGEX).optional(),
    startDate: z.string().regex(ISO_DATE_REGEX).optional(),
    endDate: z.string().regex(ISO_DATE_REGEX).optional(),
    codfilial: intFilterSchema.optional(),
    codfornec: intFilterSchema.optional(),
    fornecedor: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.date && (value.startDate || value.endDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use date ou startDate/endDate, nao os dois juntos.",
        path: ["date"],
      });
    }
  });

function normalizeText(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toIntArray(value: z.infer<typeof intFilterSchema> | undefined) {
  if (value === undefined) {
    return undefined;
  }

  return Array.isArray(value) ? value : [value];
}

function resolveFornecedorCodes(fornecedor: string) {
  const normalized = normalizeText(fornecedor);
  return fornecedorMap[normalized];
}

function validateFiliais(codfilial: number[] | undefined) {
  if (!codfilial) {
    return;
  }

  const invalid = codfilial.filter((item) => !allowedFiliais.has(item));
  if (invalid.length > 0) {
    throw new Error(
      `codfilial invalido: ${invalid.join(", ")}. Valores aceitos: 1, 3, 4.`,
    );
  }
}

function parseScopeFiliais(scopeCode: string) {
  const normalized = scopeCode.trim().toLowerCase();
  if (!normalized || normalized === "*" || normalized === "all") {
    return undefined;
  }

  const fromScope = normalized
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item));

  if (fromScope.length === 0) {
    throw new Error("Escopo de filial invalido para o usuario.");
  }

  validateFiliais(fromScope);
  return Array.from(new Set(fromScope));
}

function applyRoleFilialScope(
  context: ChatToolContext,
  requestedFiliais: number[] | undefined,
) {
  if (context.role === Role.ADMIN) {
    return requestedFiliais;
  }

  const allowedFromScope = parseScopeFiliais(context.scopeCode);
  if (!allowedFromScope) {
    throw new Error("Usuario sem escopo de filial configurado.");
  }

  if (!requestedFiliais || requestedFiliais.length === 0) {
    return allowedFromScope;
  }

  const denied = requestedFiliais.filter(
    (filial) => !allowedFromScope.includes(filial),
  );

  if (denied.length > 0) {
    throw new Error(
      `Sem permissao para filial ${denied.join(", ")}. Seu escopo permitido: ${allowedFromScope.join(", ")}.`,
    );
  }

  return requestedFiliais;
}

function formatPeriodLabel(args: z.infer<typeof faturamentoArgsSchema>) {
  if (args.date) {
    return args.date;
  }

  if (args.startDate || args.endDate) {
    const start = args.startDate ?? args.endDate ?? "";
    const end = args.endDate ?? args.startDate ?? "";
    return `${start} ate ${end}`;
  }

  return "ano atual";
}

const toolDefinitions: ToolDefinition[] = [
  {
    name: "get_faturamento_total",
    description:
      "Retorna o faturamento total da tabela fato.ffaturamento. Filtros opcionais: data, intervalo de datas, codfilial (1,3,4), codfornec e nome do fornecedor.",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description:
            "Data unica no formato YYYY-MM-DD. Exemplo: 2026-02-25.",
        },
        startDate: {
          type: "string",
          description: "Data inicial no formato YYYY-MM-DD.",
        },
        endDate: {
          type: "string",
          description: "Data final no formato YYYY-MM-DD.",
        },
        codfilial: {
          type: "array",
          items: { type: "integer" },
          description:
            "Lista de filiais (aceita 1, 3 ou 4). Para uma filial unica, envie lista com um item, ex: [3].",
        },
        codfornec: {
          type: "array",
          items: { type: "integer" },
          description:
            "Lista de codigos de fornecedor. Para um unico codigo, envie lista com um item, ex: [117].",
        },
        fornecedor: {
          type: "string",
          description:
            "Nome do fornecedor para mapear codfornec. Exemplos: Bombril, Marata, Jde, Mili, Bauducco.",
        },
      },
      required: [],
      additionalProperties: false,
    },
    allowedRoles: [Role.ADMIN, Role.COORDENADOR],
    async execute(rawArgs, context) {
      const args = faturamentoArgsSchema.parse(rawArgs);
      const requestedFiliais = toIntArray(args.codfilial);
      validateFiliais(requestedFiliais);
      const codfilial = applyRoleFilialScope(context, requestedFiliais);

      let codfornec = toIntArray(args.codfornec);
      if (args.fornecedor && !codfornec) {
        codfornec = resolveFornecedorCodes(args.fornecedor);
        if (!codfornec || codfornec.length === 0) {
          throw new Error(
            `Fornecedor '${args.fornecedor}' nao encontrado no mapeamento inicial.`,
          );
        }
      }

      const result = await queryFaturamentoTotal({
        date: args.date,
        startDate: args.startDate,
        endDate: args.endDate,
        codfilial,
        codfornec,
      });

      return {
        role: context.role,
        filtros: {
          periodo: formatPeriodLabel(args),
          codfilial: codfilial ?? "todos",
          codfornec: codfornec ?? "todos",
          fornecedor: args.fornecedor ?? null,
        },
        totalFaturamento: result.totalFaturamento,
        totalRegistros: result.totalRegistros,
        dataMin: result.dataMin,
        dataMax: result.dataMax,
        colunaValorUsada: result.valorColumn,
        currency: "BRL",
      };
    },
  },
];

export function listToolsForRole(role: Role) {
  const tools = toolDefinitions.filter((tool) => tool.allowedRoles.includes(role));

  return tools.map((tool) => ({
    type: "function" as const,
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    strict: true,
  }));
}

export async function executeTool({
  toolName,
  argumentJson,
  context,
}: {
  toolName: string;
  argumentJson: string;
  context: ChatToolContext;
}) {
  const tool = toolDefinitions.find((item) => item.name === toolName);

  if (!tool) {
    return { error: `Ferramenta ${toolName} nao encontrada.` };
  }

  if (!tool.allowedRoles.includes(context.role)) {
    return {
      error: `A role ${context.role} nao possui permissao para ${toolName}.`,
    };
  }

  try {
    const parsedArgs = argumentJson ? JSON.parse(argumentJson) : {};
    return await tool.execute(parsedArgs, context);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao executar ferramenta.";
    return { error: message };
  }
}
