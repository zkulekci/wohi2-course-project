const app = require("./app");
const PORT = process.env.PORT || 3000;
const prisma = require("./lib/prisma");
const logger = require("./lib/logger");

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, "server listening");
});

async function shutdown() {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

/*
app.listen(PORT, () => {
  const logger = require("./lib/logger");
  logger.info({ port: PORT }, "server listening");
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
*/
