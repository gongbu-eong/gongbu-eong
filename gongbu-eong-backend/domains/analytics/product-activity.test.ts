import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";

test("AI activity is persisted before completion, for members and anonymous visitors", async (t) => {
  const database = new PGlite();
  globalThis.postgresPool = { query: (sql: string, values: unknown[]) => database.query(sql, values), on() {} } as unknown as Pool;
  const { beginProductActivity } = await import("./product-activity");
  const attributionColumns = (prefix: string) => [
    ...["source", "medium", "campaign", "content", "term", "gclid", "fbclid", "landing_url", "landing_path", "referrer"].map((key) => `${prefix}_${key} text`),
    `${prefix}_seen_at timestamptz`, `${prefix}_raw_payload jsonb`,
  ].join(",");
  await database.exec(`
    CREATE TABLE user_attributions (user_id uuid, ${attributionColumns("first")}, ${attributionColumns("last")});
    CREATE TABLE product_events (id uuid DEFAULT gen_random_uuid(), user_id uuid, anonymous_id uuid, event_type text,
      event_source text, diagnosis_run_id uuid, diagnosis_result_id uuid, properties jsonb,
      ${attributionColumns("first")}, ${attributionColumns("current")});
  `);
  const anonymousId = "11111111-1111-4111-8111-111111111111";
  const userId = "22222222-2222-4222-8222-222222222222";
  const request = new Request("http://localhost/api/coaching", {
    headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1", "user-agent": "test-browser" },
  });
  const rows = async () => (await database.query<{ event_type: string; event_source: string; user_id: string | null; anonymous_id: string; properties: Record<string, unknown> }>("SELECT * FROM product_events")).rows;
  try {
    await t.test("resume start exists before AI finishes and success retains actor and correlation", async () => {
      const activity = await beginProductActivity({ request, userId, anonymousId, screen: "resume_coaching",
        startEvent: "coaching_start", completeEvent: "coaching_complete", failureEvent: "coaching_failed" });
      assert.deepEqual((await rows()).map((row) => row.event_type), ["coaching_start"]);
      await activity.complete({ result_id: "result-1", request_id: "request-1" });
      const [start, complete] = await rows();
      assert.equal(complete.event_type, "coaching_complete");
      assert.equal(complete.event_source, "server");
      assert.equal(complete.user_id, userId);
      assert.equal(complete.anonymous_id, anonymousId);
      assert.equal(complete.properties.action_id, start.properties.action_id);
      assert.equal(complete.properties.ip_address, "203.0.113.10");
      assert.equal(complete.properties.path, "/ai-tools/coaching");
      assert.ok(Number(complete.properties.duration_ms) >= 0);
    });
    await t.test("interview stages record failures without inventing success or including answer content", async () => {
      for (const stage of ["", "_answer", "_complete"]) {
        await database.exec("DELETE FROM product_events");
        const activity = await beginProductActivity({ request, anonymousId, screen: "interview_coaching",
          startEvent: `interview_coaching${stage}_start`, completeEvent: `interview_coaching${stage}_done`, failureEvent: `interview_coaching${stage}_failed`,
          properties: { interview_session_id: "interview-1" } });
        await activity.fail();
        const recorded = await rows();
        assert.equal(recorded.length, 2);
        assert.equal(recorded[1].event_type, `interview_coaching${stage}_failed`);
        assert.equal(recorded[1].user_id, null);
        assert.equal(recorded[1].anonymous_id, anonymousId);
        assert.equal(recorded[1].properties.path, "/ai-tools/interview-coaching");
        assert.equal(recorded[1].properties.interview_session_id, "interview-1");
        assert.equal(recorded[1].properties.session_id, undefined);
        assert.equal(recorded[1].properties.answer, undefined);
        assert.equal(recorded[1].properties.input_text, undefined);
      }
    });
    await t.test("analytics failure never changes coaching's outcome", async () => {
      await database.exec("DROP TABLE product_events");
      const errorLog = t.mock.method(console, "error", () => {});
      const activity = await beginProductActivity({ request, anonymousId, screen: "resume_coaching",
        startEvent: "coaching_start", completeEvent: "coaching_complete", failureEvent: "coaching_failed" });
      await activity.complete();
      await activity.fail();
      assert.equal(errorLog.mock.callCount(), 3);
    });
  } finally {
    await database.close();
  }
});
