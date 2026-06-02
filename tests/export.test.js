const {
  request,
  app,
  resetDb,
  registerAndLogin,
  createQuestions,
} = require("./helpers");

describe("Data Export tests", () => {
  beforeEach(resetDb);

  it("exports all user data correctly including profile, created questions, and play history", async () => {
    const token = await registerAndLogin("export@test.io", "Export User");

    // Create a question to simulate user activity
    const q = await createQuestions(token, {
      question: "Export Q",
      answer: "Export A",
    });

    // Play the question
    await request(app)
      .post(`/api/questions/${q.id}/play`)
      .set("Authorization", `Bearer ${token}`)
      .send({ answer: "Export A" });

    // Fetch exported data
    const res = await request(app)
      .get("/api/export")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);

    // Verify profile data
    expect(res.body.email).toBe("export@test.io");
    expect(res.body.name).toBe("Export User");

    // Verify created questions data
    expect(res.body.questions.length).toBe(1);
    expect(res.body.questions[0].question).toBe("Export Q");

    // Verify play history data
    expect(res.body.plays.length).toBe(1);
    expect(res.body.plays[0].isCorrect).toBe(true);
    expect(res.body.plays[0].questions.question).toBe("Export Q");
  });
});
