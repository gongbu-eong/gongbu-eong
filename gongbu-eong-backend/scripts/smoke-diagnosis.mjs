const backendUrl = process.env.BACKEND_URL || "http://localhost:4000";

async function main() {
  const questionsResponse = await fetch(`${backendUrl}/api/diagnosis/questions`, {
    headers: { Origin: "http://localhost:3000" },
  });
  const questionsBody = await questionsResponse.json();
  const answers = questionsBody.questions.map((question, index) => ({
    questionId: question.id,
    optionId: question.options[[3, 2, 4, 1][index % 4]].id,
  }));

  const resultResponse = await fetch(`${backendUrl}/api/diagnosis/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
    },
    body: JSON.stringify({
      anonymousId: "00000000-0000-4000-8000-000000000001",
      entrySource: "diagnosis",
      answers,
    }),
  });
  const resultBody = await resultResponse.json();

  console.log(JSON.stringify(resultBody, null, 2));

  if (!resultResponse.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
