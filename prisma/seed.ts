import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
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
      email: "coordenador.cariri",
      name: "Coordenador Cariri",
      passwordHash: defaultPassword,
      role: Role.COORDENADOR,
      scopeCode: "3",
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.dailyRevenue.deleteMany({
    where: {
      scopeCode: "loja-sp",
      date: today,
    },
  });

  await prisma.dailyRevenue.createMany({
    data: [
      {
        scopeCode: "loja-sp",
        product: "bombril",
        amount: 12450.3,
        date: today,
      },
      {
        scopeCode: "loja-sp",
        product: "esponja",
        amount: 3020.15,
        date: today,
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
