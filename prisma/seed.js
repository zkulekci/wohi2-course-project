const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

const seedQuestions = [
  {
    id: 1,
    question: "What is the capital of Finland?",
    answer: "Helsinki",
    keywords: ["finland", "capital", "helsinki"]
  },
  {
    id: 2,
    question: "Which planet is known as the 'Red Planet'?",
    answer: "Mars",
    keywords: ["planet", "mars"]
  },
  {
    id: 3,
    question: "What is the largest planet in our solar system?",
    answer: "Jupiter",
    keywords: ["planet", "jupiter"]
  },
  {
    id: 4,
    question: "What is the capital of Japan?",
    answer: "Tokyo",
    keywords: ["japan", "capital", "tokyo"]
  },
  {
    id: 5,
    question: "What are the two official languages of Finland?",
    answer: "Finnish and Swedish",
    keywords: ["languages", "finland"]
  },
];

async function main() {
  await prisma.questions.deleteMany();
  await prisma.keyword.deleteMany();
  await prisma.user.deleteMany();

  // Create a default user
  const hashedPassword = await bcrypt.hash("1234", 10);
  const user = await prisma.user.create({
    data: {
      email: "admin@example.com",
      password: hashedPassword,
      name: "Admin User",
    },
  });

  console.log("Created user:", user.email);

  for (const question of seedQuestions) {
    await prisma.questions.create({
      data: {
        question: question.question,
        answer: question.answer,
        userId: user.id,
        keywords: {
          connectOrCreate: question.keywords.map((kw) => ({
            where: { name: kw },
            create: { name: kw },
          })),
        },
      },
    });
  }

  console.log("Seed data inserted successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
