import assert from "node:assert/strict";
import { hostname } from "node:os";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createLocalIdentity } from "../src/config/local-config.js";
import { runCli, type CliIo } from "../src/cli.js";
import { diagnoseAgentForum } from "../src/services/doctor.js";
import { initLocalForum } from "../src/services/local-forum.js";
import { createAgentForumPaths, forumLockPath } from "../src/storage/paths.js";

const memberId = "member_0194f6d2-8c10-7a31-9e42-123456789ac1";
const forumId = "forum_0194f6d2-8c10-7a31-9e42-123456789abc";
const createdAt = new Date("2026-07-12T10:20:30.123Z");

async function setup(home: string) {
  const paths = createAgentForumPaths(home);
  await createLocalIdentity(
    {
      memberId,
      displayName: "Backend A",
      role: "backend",
      responsibility: "Order service",
      now: createdAt,
    },
    paths,
  );
  await initLocalForum(
    {
      alias: "a-team",
      name: "A Team",
      description: "Doctor test",
      forumId,
      now: createdAt,
    },
    paths,
  );
  return paths;
}

function captureIo(): { io: CliIo; stdout: string[] } {
  const stdout: string[] = [];
  return {
    io: { stdout: (text) => stdout.push(text), stderr: () => undefined },
    stdout,
  };
}

test("doctor reports local-only forums without treating warnings as fatal", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-doctor-local-"));
  try {
    const paths = await setup(home);
    const result = await diagnoseAgentForum({}, paths);
    assert.equal(result.healthy, true);
    assert.equal(
      result.checks.some(
        (check) => check.id === "forum.a-team.status" && check.status === "warning",
      ),
      true,
    );
    const missing = await diagnoseAgentForum({ forumAlias: "missing" }, paths);
    assert.equal(missing.healthy, false);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("doctor repairs only locks that satisfy stale ownership rules", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-doctor-lock-"));
  try {
    const paths = await setup(home);
    const lockPath = forumLockPath(paths, forumId);
    await mkdir(lockPath, { recursive: true });
    await writeFile(
      resolve(lockPath, "owner.json"),
      `${JSON.stringify({
        token: "stale-token",
        pid: 99999999,
        hostname: hostname(),
        command: "interrupted sync",
        startedAt: "2020-01-01T00:00:00.000Z",
      })}\n`,
      "utf8",
    );
    const observed = await diagnoseAgentForum({}, paths);
    assert.equal(
      observed.checks.some(
        (check) => check.id === "forum.a-team.lock" && check.status === "warning",
      ),
      true,
    );
    const repaired = await diagnoseAgentForum({ repairStaleLocks: true }, paths);
    assert.deepEqual(repaired.repaired, [lockPath]);
    assert.equal(
      repaired.checks.some(
        (check) => check.id === "forum.a-team.lock" && check.status === "ok",
      ),
      true,
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("doctor CLI rejects unknown options with stable JSON", async () => {
  const output = captureIo();
  assert.equal(await runCli(["doctor", "--unsafe", "--json"], output.io), 2);
  assert.equal(JSON.parse(output.stdout.join("")).error.code, "INVALID_ARGUMENT");
});
