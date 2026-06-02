const { request, app, resetDb, prisma } = require("./helpers");

describe("Leaderboard tests", () => {
  beforeEach(resetDb);

  it("returns top 5 users sorted by correct answers when there are more than 5 players", async () => {
    // Create a mock user who will be the owner of the questions
    const owner = await prisma.user.create({
      data: { email: "owner@test.io", name: "Owner", password: "pw" },
    });

    // Add 6 different questions to the database
    const questions = [];
    for (let i = 0; i < 6; i++) {
      const q = await prisma.questions.create({
        data: { question: `Q${i}`, answer: `A${i}`, userId: owner.id },
      });
      questions.push(q);
    }

    // Create 6 different players and progressively add correct answers to them
    // Player 1 = 1 correct, Player 2 = 2 correct... Player 6 = 6 correct answers
    for (let i = 1; i <= 6; i++) {
      const player = await prisma.user.create({
        data: {
          email: `player${i}@test.io`,
          name: `Player ${i}`,
          password: "pw",
        },
      });

      // Add 'i' number of correct answers (Play records) for each player
      for (let j = 0; j < i; j++) {
        await prisma.play.create({
          data: {
            userId: player.id,
            questionId: questions[j].id,
            isCorrect: true,
          },
        });
      }
    }

    // Make a request to the endpoint
    const res = await request(app).get("/api/leaderboard");

    expect(res.status).toBe(200);
    // Should return exactly 5 users even if there are 6 players
    expect(res.body.length).toBe(5);
    // Player 6, with the highest score (6 correct), should be in the first place (Sorting Test)
    expect(res.body[0].name).toBe("Player 6");
    expect(res.body[0].correctAnswers).toBe(6);
    // The 5th person on the list should be Player 2 (2 correct)
    expect(res.body[4].name).toBe("Player 2");
  });

  it("returns all available users or an empty array if there are fewer than 5 players", async () => {
    // When no games have been played in the database
    const emptyRes = await request(app).get("/api/leaderboard");
    expect(emptyRes.status).toBe(200);
    expect(emptyRes.body.length).toBe(0); // Çökmemeli, boş dizi dönmeli

    // When there are fewer than 5 players in the database
    const owner = await prisma.user.create({
      data: { email: "owner2@test.io", name: "Owner", password: "pw" },
    });
    const q = await prisma.questions.create({
      data: { question: "Q1", answer: "A1", userId: owner.id },
    });

    // Create only 3 players and add 1 correct answer to each
    for (let i = 1; i <= 3; i++) {
      const player = await prisma.user.create({
        data: { email: `p${i}@test.io`, name: `P${i}`, password: "pw" },
      });
      await prisma.play.create({
        data: { userId: player.id, questionId: q.id, isCorrect: true },
      });
    }

    const fewRes = await request(app).get("/api/leaderboard");

    expect(fewRes.status).toBe(200);
    // Should fetch only the existing ones (3 users) since there are fewer than 5
    expect(fewRes.body.length).toBe(3);
  });
});
