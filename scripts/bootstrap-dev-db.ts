import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function ensureTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'COORDENADOR',
      "scopeCode" TEXT NOT NULL DEFAULT 'default',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DailyRevenue" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "scopeCode" TEXT NOT NULL,
      "product" TEXT NOT NULL,
      "amount" REAL NOT NULL,
      "date" DATETIME NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "DailyRevenue_scopeCode_product_date_idx"
    ON "DailyRevenue" ("scopeCode", "product", "date");
  `);
}

async function seedData() {
  const defaultPassword = await bcrypt.hash("Omega@123", 10);

  await prisma.user.deleteMany({
    where: {
      email: {
        in: ["supervisor@empresa.com", "analista@empresa.com"],
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "admin" },
    update: {
      name: "Administrador",
      passwordHash: defaultPassword,
      role: Role.ADMIN,
      scopeCode: "*",
    },
    create: {
      id: "user-admin",
      email: "admin",
      name: "Administrador",
      passwordHash: defaultPassword,
      role: Role.ADMIN,
      scopeCode: "*",
    },
  });

  await prisma.user.upsert({
    where: { email: "coordenador.cariri" },
    update: {
      name: "Coordenador Cariri",
      passwordHash: defaultPassword,
      role: Role.COORDENADOR,
      scopeCode: "3",
    },
    create: {
      id: "user-coordenador-cariri",
      email: "coordenador.cariri",
      name: "Coordenador Cariri",
      passwordHash: defaultPassword,
      role: Role.COORDENADOR,
      scopeCode: "3",
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.dailyRevenue.upsert({
    where: { id: "rev-bombril-today" },
    update: {
      scopeCode: "loja-sp",
      product: "bombril",
      amount: 12450.3,
      date: today,
    },
    create: {
      id: "rev-bombril-today",
      scopeCode: "loja-sp",
      product: "bombril",
      amount: 12450.3,
      date: today,
    },
  });

  await prisma.dailyRevenue.upsert({
    where: { id: "rev-esponja-today" },
    update: {
      scopeCode: "loja-sp",
      product: "esponja",
      amount: 3020.15,
      date: today,
    },
    create: {
      id: "rev-esponja-today",
      scopeCode: "loja-sp",
      product: "esponja",
      amount: 3020.15,
      date: today,
    },
  });
}

async function main() {
  await ensureTables();
  await seedData();
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Banco de desenvolvimento preparado com sucesso.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
