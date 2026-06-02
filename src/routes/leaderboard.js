const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");

// GET /api/leaderboard
// Returns the top 5 users with the most correct answers
router.get("/", async (req, res) => {
  const topScores = await prisma.play.groupBy({
    by: ["userId"],
    where: { isCorrect: true },
    _count: { isCorrect: true },
    orderBy: {
      _count: { isCorrect: "desc" },
    },
    take: 5,
  });

  if (topScores.length === 0) {
    return res.json([]);
  }

  const userIds = topScores.map((score) => score.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });

  const leaderboard = topScores.map((score) => {
    const user = users.find((u) => u.id === score.userId);
    return {
      userId: score.userId,
      name: user ? user.name : "Unknown Player",
      correctAnswers: score._count.isCorrect,
    };
  });

  res.json(leaderboard);
});

module.exports = router;
