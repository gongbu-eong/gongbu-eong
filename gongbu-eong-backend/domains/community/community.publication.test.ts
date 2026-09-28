import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";

test("public community APIs never expose scheduled content before publication", async (t) => {
  // This in-memory database cannot connect to DATABASE_URL or the real community.
  const database = new PGlite();
  const query = (sql: string, values?: unknown[]) => database.query(sql, values);
  globalThis.postgresPool = {
    query, on() {}, connect: async () => ({ query, release() {} }),
  } as unknown as Pool;
  const repository = await import("./community.repository");
  await database.exec(`
    CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), community_nickname text,
      nickname text, display_name text, profile_status_message text, profile_avatar_key text, profile_background_color text);
    CREATE TABLE diagnosis_runs (id uuid PRIMARY KEY, user_id uuid, completed_at timestamptz);
    CREATE TABLE personality_types (id uuid PRIMARY KEY, name text);
    CREATE TABLE diagnosis_results (id uuid PRIMARY KEY, diagnosis_run_id uuid, user_id uuid, personality_type_id uuid, created_at timestamptz);
    CREATE TABLE community_posts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users,
      category text DEFAULT '자유·잡담', title text DEFAULT 'title', content text DEFAULT 'content', image_data_url text,
      view_count integer DEFAULT 0, status text DEFAULT 'active', created_at timestamptz DEFAULT NOW(), updated_at timestamptz DEFAULT NOW(), deleted_at timestamptz);
    CREATE TABLE community_comments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), post_id uuid REFERENCES community_posts,
      user_id uuid REFERENCES users, parent_comment_id uuid REFERENCES community_comments, content text DEFAULT 'comment',
      status text DEFAULT 'active', created_at timestamptz DEFAULT NOW(), updated_at timestamptz DEFAULT NOW(), deleted_at timestamptz);
    CREATE TABLE community_post_reactions (post_id uuid, user_id uuid, reaction_type text, created_at timestamptz DEFAULT NOW(), PRIMARY KEY(post_id,user_id,reaction_type));
    CREATE TABLE community_comment_reactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), comment_id uuid, user_id uuid,
      reaction_type text, created_at timestamptz DEFAULT NOW(), updated_at timestamptz DEFAULT NOW(), UNIQUE(comment_id,user_id));
    CREATE TABLE community_post_attachments (id uuid PRIMARY KEY, post_id uuid, file_name text, mime_type text,
      file_size_bytes integer, file_data_url text, sort_order integer, created_at timestamptz DEFAULT NOW());
    CREATE TABLE community_reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, target_type text,
      target_id uuid, reason text, reason_code text, target_snapshot jsonb, status text, updated_at timestamptz,
      UNIQUE(user_id,target_type,target_id));
  `);
  const id = async (sql: string, values: unknown[] = []) => (await database.query<{ id: string }>(sql, values)).rows[0].id;
  const user = await id("INSERT INTO users (community_nickname) VALUES ('tester') RETURNING id");
  const other = await id("INSERT INTO users (community_nickname) VALUES ('other') RETURNING id");
  const live = await id("INSERT INTO community_posts (user_id, created_at) VALUES ($1, NOW() - interval '1 hour') RETURNING id", [user]);
  const future = await id("INSERT INTO community_posts (user_id, title, created_at) VALUES ($1, 'future secret', NOW() + interval '1 day') RETURNING id", [user]);
  const root = await id("INSERT INTO community_comments (post_id,user_id,created_at) VALUES ($1,$2,NOW() - interval '30 minutes') RETURNING id", [live, user]);
  const pending = await id("INSERT INTO community_comments (post_id,user_id,created_at) VALUES ($1,$2,NOW() + interval '1 day') RETURNING id", [live, user]);
  const reply = await id("INSERT INTO community_comments (post_id,user_id,parent_comment_id,created_at) VALUES ($1,$2,$3,NOW() - interval '10 minutes') RETURNING id", [live, user, root]);
  const earlyReply = await id("INSERT INTO community_comments (post_id,user_id,parent_comment_id,created_at) VALUES ($1,$2,$3,NOW() - interval '10 minutes') RETURNING id", [live, user, pending]);
  const hiddenPostComment = await id("INSERT INTO community_comments (post_id,user_id,created_at) VALUES ($1,$2,NOW() - interval '1 hour') RETURNING id", [future, user]);
  await database.query("INSERT INTO community_post_reactions (post_id,user_id,reaction_type,created_at) VALUES ($1,$2,'recommend',NOW() + interval '1 day'),($1,$2,'scrap',NOW() + interval '1 day'),($3,$2,'scrap',NOW())", [live, user, future]);
  await database.query("INSERT INTO community_comment_reactions (comment_id,user_id,reaction_type,created_at) VALUES ($1,$2,'like',NOW() + interval '1 day')", [root, user]);
  try {
    await t.test("list totals, search, ranking, direct detail and activity omit future records", async () => {
      for (const sort of ["latest", "popular"] as const) {
        const list = await repository.listCommunityPosts({ limit: 20, offset: 0, sort, userId: user });
        assert.equal(list.total, 1);
        assert.deepEqual(list.items.map((post) => post.id), [live]);
        assert.equal(list.items[0].commentCount, 2);
        assert.equal(list.items[0].recommendCount, 0);
        assert.equal(list.items[0].isScrapped, false);
      }
      assert.equal((await repository.listCommunityPosts({ query: "future secret", limit: 20, offset: 0 })).total, 0);
      assert.equal(await repository.findCommunityPostById(future, user), null);
      for (const period of ["today", "week"] as const) {
        assert.ok((await repository.listPopularCommunityPosts(user, period)).every((post) => post.id !== future));
      }
      assert.equal(await repository.getCommunityPostListPage(live, 1), 1);
      const activity = await repository.listCommunityActivity(user);
      assert.deepEqual(activity.posts.map((post) => post.id), [live]);
      assert.deepEqual(new Set(activity.comments.map((comment) => comment.id)), new Set([root, reply]));
      assert.equal(activity.scraps.length, 0);
      const comments = await repository.listCommunityComments(live, user);
      assert.equal(comments.length, 1);
      assert.equal(comments[0].id, root);
      assert.equal(comments[0].likeCount, 0);
      assert.equal(comments[0].myReaction, null);
      assert.deepEqual(comments[0].replies.map((comment) => comment.id), [reply]);
      assert.deepEqual(await repository.listCommunityComments(future, user), []);
    });
    await t.test("guessed IDs cannot edit, delete, view, react, comment or report unpublished content", async () => {
      await repository.increaseCommunityPostView(future);
      assert.equal((await database.query<{ view_count: number }>("SELECT view_count FROM community_posts WHERE id=$1", [future])).rows[0].view_count, 0);
      assert.equal(await repository.updateCommunityPost(user, future, { category: "자유·잡담", title: "edit", content: "edit" }), false);
      assert.equal(await repository.deleteCommunityPost(user, future), false);
      assert.equal(await repository.setCommunityReaction(other, future, "recommend", true), null);
      assert.equal(await repository.createCommunityComment(other, future, "no"), null);
      assert.equal(await repository.createCommunityComment(other, live, "no", pending), null);
      for (const comment of [pending, earlyReply, hiddenPostComment]) {
        assert.equal(await repository.updateCommunityComment(user, comment, "no"), null);
        assert.equal(await repository.deleteCommunityComment(user, comment), null);
        assert.equal(await repository.setCommunityCommentReaction(other, comment, "like"), null);
        await assert.rejects(repository.createCommunityReport(other, "comment", comment, "기타"), { name: "NotFoundError" });
      }
      await assert.rejects(repository.createCommunityReport(other, "post", future, "기타"), { name: "NotFoundError" });
      assert.equal((await database.query("SELECT * FROM community_reports")).rows.length, 0);
    });
    await t.test("live interactions still work and deleted parents preserve published replies", async () => {
      await repository.increaseCommunityPostView(live);
      assert.equal((await repository.setCommunityReaction(other, live, "recommend", true))?.recommendCount, 1);
      assert.equal((await repository.setCommunityCommentReaction(other, root, "like"))?.likeCount, 1);
      // A real action overrides an old manually scheduled reaction immediately.
      assert.equal((await repository.setCommunityReaction(user, live, "recommend", true))?.recommendCount, 2);
      assert.equal((await repository.setCommunityCommentReaction(user, root, "like"))?.likeCount, 2);
      assert.ok(await repository.createCommunityComment(other, live, "new response", root));
      await repository.createCommunityReport(other, "post", live, "기타");
      assert.equal((await database.query("SELECT * FROM community_reports")).rows.length, 1);
      await repository.deleteCommunityComment(user, root);
      const comments = await repository.listCommunityComments(live, user);
      assert.ok(comments[0].replies.some((comment) => comment.id === reply));
      assert.ok(!comments.some((comment) => comment.id === pending));
    });
    await t.test("records appear at their timestamp, without another cron or a cache refresh", async () => {
      await database.query("UPDATE community_posts SET created_at = NOW() WHERE id = $1", [future]);
      assert.ok(await repository.findCommunityPostById(future));
      await database.query("UPDATE community_comments SET created_at = NOW() WHERE id = $1", [pending]);
      const comments = await repository.listCommunityComments(live, user);
      assert.ok(comments.some((comment) => comment.id === pending));
      assert.equal((await repository.listCommunityPosts({ limit: 20, offset: 0 })).total, 2);
    });
  } finally {
    await database.close();
    globalThis.postgresPool = undefined;
  }
});
