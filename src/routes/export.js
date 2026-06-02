const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");

// Apply authentication middleware
router.use(authenticate);

// GET /api/export
// Export all personal data for the logged-in user
router.get("/", async (req, res) => {
  const userId = req.user.userId;

  // Fetch user profile, their created questions, and their play history in one query
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      questions: {
        select: {
          id: true,
          question: true,
          answer: true,
          imageUrl: true,
          keywords: { select: { name: true } },
        },
      },
      plays: {
        select: {
          questionId: true,
          isCorrect: true,
          createdAt: true,
          questions: { select: { question: true } },
        },
      },
    },
  });

  res.json(userData);
});

module.exports = router;
