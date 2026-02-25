# Chatbot Corporativo (MVP)

Projeto inicial de chatbot com:

- Login por credenciais
- RBAC por role (`ADMIN` e `COORDENADOR`)
- Endpoint `/api/chat` integrado com OpenAI Responses API
- Tool controlada por permissao (`get_faturamento_total`)
- Consulta real em PostgreSQL (`fato.ffaturamento`)

## Stack

- Next.js 16 + TypeScript
- Auth.js (`next-auth` v5 beta)
- Prisma Client
- OpenAI Node SDK
- `pg` (PostgreSQL driver)

## Setup

1. Instale dependencias:

```bash
npm install
```

2. Configure variaveis de ambiente:

```bash
cp .env.example .env
```

3. Gere o Prisma Client:

```bash
npm run prisma:generate
```

4. Prepare o banco de desenvolvimento:

```bash
npm run db:bootstrap
```

5. Inicie o projeto:

```bash
npm run dev
```

## Rotas principais

- `/login`: tela de autenticacao
- `/chat`: tela principal do chatbot (protegida)
- `/api/chat`: endpoint backend do chat
- `/api/auth/[...nextauth]`: endpoints de autenticacao do Auth.js

## Banco de faturamento (PostgreSQL)

Variaveis de ambiente usadas para consultar `fato.ffaturamento`:

- `FAT_DB_HOST`
- `FAT_DB_PORT`
- `FAT_DB_NAME`
- `FAT_DB_USER`
- `FAT_DB_PASSWORD`
- `FAT_DB_MAX_CONNECTIONS`

Opcional:

- `FATURAMENTO_VALOR_COLUMN`: forca a coluna numerica usada no `SUM` do faturamento.

## Credenciais de exemplo

Os usuarios demo sao criados no bootstrap (`scripts/bootstrap-dev-db.ts`):

- `admin` / `Omega@123`
- `coordenador.cariri` / `Omega@123` (acesso restrito a `codfilial = 3`)

## Filtros suportados no chat (faturamento)

- Data unica (`date`, formato `YYYY-MM-DD`)
- Intervalo (`startDate` e `endDate`)
- `codfilial` (1, 3 ou 4)
- `codfornec` (codigo do fornecedor)
- Nome do fornecedor (`fornecedor`, com mapeamento inicial)

Sem filtro de data, a consulta usa o ano atual:

```sql
dtmov >= date_trunc('year', current_date)
AND dtmov < date_trunc('year', current_date) + interval '1 year'
```

## Arquivos chave

- `src/auth.ts`: configuracao de login/sessao/RBAC
- `src/app/api/chat/route.ts`: endpoint de chat autenticado
- `src/lib/chat/assistant.ts`: orquestracao do modelo + function calling
- `src/lib/chat/tools.ts`: catalogo de tools permitidas por role
- `src/lib/faturamento-db.ts`: conexao e consulta no PostgreSQL de faturamento
