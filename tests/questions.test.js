const bcrypt = require("bcrypt");
const {
  resetDb,
  registerAndLogin,
  request,
  app,
  prisma,
  createQuestions,
} = require("./helpers");

describe("questions tests", () => {
  beforeEach(resetDb);
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/questions");
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown question", async () => {
    const token = await registerAndLogin("q_test@test.io", "Q Tester");
    const res = await request(app)
      .get("/api/questions/99999")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Question not found");
  });

  it("returns 400 for invalid question body", async () => {
    const token = await registerAndLogin("q_test@test.io", "Q Tester");
    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({ question: " " });
    expect(res.status).toBe(400);
  });

  it("returns 403 when editing someone else's question", async () => {
    const aliceToken = await registerAndLogin("alice@test.io", "Alice");
    const question = await createQuestions(aliceToken, {
      question: "Alice's original question",
    });

    const bobToken = await registerAndLogin("bob@test.io", "Bob");
    const res = await request(app)
      .put(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${bobToken}`)
      .send({ question: "Bob's question", answer: "Bob's answer" });

    expect(res.status).toBe(403);

    const after = await prisma.questions.findUnique({
      where: { id: question.id },
    });
    expect(after.question).toBe("Alice's original question"); // unchanged
  });

  it("creates a new question successfully", async () => {
    const token = await registerAndLogin("q_test@test.io", "Q Tester");
    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "What is 2+2?",
        answer: "4",
        keywords: "math, addition",
      });

    expect(res.status).toBe(201);
    expect(res.body.question).toBe("What is 2+2?");
    expect(res.body.keywords).toContain("math");
  });

  it("returns a list of questions", async () => {
    const token = await registerAndLogin("list_test@test.io", "Lister");
    await createQuestions(token, { question: "Q1", answer: "A1" });
    await createQuestions(token, { question: "Q2", answer: "A2" });

    const res = await request(app)
      .get("/api/questions")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
    expect(res.body.page).toBe(1);
  });

  it("updates own question successfully", async () => {
    const token = await registerAndLogin("put_test@test.io", "Putter");
    const question = await createQuestions(token, {
      question: "Old Q",
      answer: "Old A",
    });

    const res = await request(app)
      .put(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "New Q", answer: "New A" });

    expect(res.status).toBe(200);
    expect(res.body.question).toBe("New Q");

    const inDb = await prisma.questions.findUnique({
      where: { id: question.id },
    });
    expect(inDb.question).toBe("New Q");
  });

  it("deletes own question successfully", async () => {
    const token = await registerAndLogin("del_test@test.io", "Deleter");
    const question = await createQuestions(token, {
      question: "To be deleted",
      answer: "A",
    });

    const res = await request(app)
      .delete(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Question deleted successfully");

    const inDb = await prisma.questions.findUnique({
      where: { id: question.id },
    });
    expect(inDb).toBeNull();
  });

  it("plays a question and returns correct boolean", async () => {
    const token = await registerAndLogin("play_test@test.io", "Player");
    const question = await createQuestions(token, {
      question: "Capital of Finland?",
      answer: "Helsinki",
    });

    const correctRes = await request(app)
      .post(`/api/questions/${question.id}/play`)
      .set("Authorization", `Bearer ${token}`)
      .send({ answer: "  hElSiNkI " });

    expect(correctRes.status).toBe(201);
    expect(correctRes.body.correct).toBe(true);

    const wrongRes = await request(app)
      .post(`/api/questions/${question.id}/play`)
      .set("Authorization", `Bearer ${token}`)
      .send({ answer: "Joensuu" });

    expect(wrongRes.status).toBe(201);
    expect(wrongRes.body.correct).toBe(false);
  });
});
