const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "..", "public", "uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

function formatQuestion(question) {
  return {
    ...question,
    keywords: question.keywords.map((k) => k.name),
    userName: question.user?.name || null,
    solved: question.plays?.[0]?.isCorrect || false,
    user: undefined,
  };
}

// Apply authentication to ALL routes in this router
router.use(authenticate);

// GET api/questions, api/questions?keyword=http&page=1&limit=5
// List all questions
router.get("/", async (req, res) => {
  const { keyword } = req.query;

  const where = keyword ? { keywords: { some: { name: keyword } } } : {};

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 5));
  const skip = (page - 1) * limit;

  const [filteredQuestions, total] = await Promise.all([
    prisma.questions.findMany({
      where,
      include: {
        keywords: true,
        user: true,
        plays: {
          where: { userId: req.user.userId },
          select: { isCorrect: true },
        },
      },
      orderBy: { id: "asc" },
      skip,
      take: limit,
    }),
    prisma.questions.count({ where }),
  ]);

  res.json({
    data: filteredQuestions.map(formatQuestion),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

// GET /api/questions/:questionId
// Show a specific question
router.get("/:questionId", async (req, res) => {
  const questionId = Number(req.params.questionId);

  const question = await prisma.questions.findUnique({
    where: { id: questionId },
    include: {
      keywords: true,
      user: true,
      plays: {
        where: { userId: req.user.userId },
        select: { isCorrect: true },
      },
    },
  });

  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  res.json(formatQuestion(question));
});

// POST /api/questions
// Create a new question
router.post("/", upload.single("image"), async (req, res) => {
  const { question, answer, keywords } = req.body;

  if (!question || !answer) {
    return res
      .status(400)
      .json({ message: "question and answer are required" });
  }

  const keywordsArray =
    typeof keywords === "string"
      ? keywords
          .split(",")
          .map((k) => k.trim())
          .filter((k) => k !== "")
      : Array.isArray(keywords)
        ? keywords
        : [];

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const newQuestion = await prisma.questions.create({
    data: {
      question,
      answer,
      imageUrl,
      userId: req.user.userId,
      keywords: {
        connectOrCreate: keywordsArray.map((kw) => ({
          where: { name: kw },
          create: { name: kw },
        })),
      },
    },
    include: { keywords: true },
  });

  res.status(201).json(formatQuestion(newQuestion));
});

// PUT /questions/:questionId
// Edit a question
router.put(
  "/:questionId",
  isOwner,
  upload.single("image"),
  async (req, res) => {
    const questionId = Number(req.params.questionId);
    const { question, answer, keywords } = req.body;
    const existingQuestion = await prisma.questions.findUnique({
      where: { id: questionId },
    });

    if (!existingQuestion) {
      return res.status(404).json({ message: "Question not found" });
    }

    if (!question || !answer) {
      return res.json({ message: "question and content are required" });
    }

    const data = {
      question,
      answer,
      userId: req.user.userId,
    };

    if (req.file) {
      data.imageUrl = `/uploads/${req.file.filename}`;
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const keywordsArray =
      typeof keywords === "string"
        ? keywords
            .split(",")
            .map((k) => k.trim())
            .filter((k) => k !== "")
        : Array.isArray(keywords)
          ? keywords
          : [];

    const updatedQuestion = await prisma.questions.update({
      where: { id: questionId },
      data: {
        ...data,
        keywords: {
          set: [],
          connectOrCreate: keywordsArray.map((kw) => ({
            where: { name: kw },
            create: { name: kw },
          })),
        },
      },
      include: {
        keywords: true,
        user: true,
        plays: {
          where: { userId: req.user.userId },
          select: { isCorrect: true },
        },
      },
    });

    res.json(formatQuestion(updatedQuestion));
  },
);

// DELETE /api/questions/:questionId
// Delete a question
router.delete("/:questionId", isOwner, async (req, res) => {
  const questionId = Number(req.params.questionId);

  const question = await prisma.questions.findUnique({
    where: { id: questionId },
    include: {
      keywords: true,
      user: true,
      plays: {
        where: { userId: req.user.userId },
        select: { isCorrect: true },
      },
    },
  });

  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  await prisma.questions.delete({ where: { id: questionId } });

  res.json({
    message: "Question deleted successfully",
    post: formatQuestion(question),
  });
});

// POST /api/questions/:questionId/play
router.post("/:questionId/play", async (req, res) => {
  const questionId = Number(req.params.questionId);

  const question = await prisma.questions.findUnique({
    where: { id: questionId },
  });
  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  const { answer } = req.body;

  const isCorrect =
    question.answer.trim().toLowerCase() === answer.trim().toLowerCase();

  const play = await prisma.play.upsert({
    where: { userId_questionId: { userId: req.user.userId, questionId } },
    update: { isCorrect: isCorrect },
    create: { userId: req.user.userId, questionId, isCorrect: isCorrect },
  });

  res.status(201).json({
    id: play.id,
    correct: isCorrect,
    submittedAnswer: answer,
    correctAnswer: question.answer,
    createdAt: play.createdAt,
  });
});

module.exports = router;
