import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createLocalIdentity, loadLocalConfig, saveLocalConfig } from "../src/config/local-config.js";
import { addIdentityAttention, listIdentityAttention, recoverIdentity, removeIdentityAttention } from "../src/services/identity-attention.js";
import { ServiceError } from "../src/services/errors.js";
import { initLocalForum } from "../src/services/local-forum.js";
import { createAgentForumPaths } from "../src/storage/paths.js";

const memberA = "member_0194f6d2-8c10-7a31-9e42-123456789ac1";
const memberB = "member_0194f6d2-8c10-7a31-9e42-123456789ac2";
const forumId = "forum_0194f6d2-8c10-7a31-9e42-123456789abc";

async function setup(home: string) {
  const paths = createAgentForumPaths(home);
  await createLocalIdentity({ memberId: memberA, displayName: "Zhang San", role: "backend", responsibility: "Order service" }, paths);
  await initLocalForum({ alias: "a-team", name: "A Team", description: "Identity attention fixture", forumId }, paths);
  await createLocalIdentity({ memberId: memberB, displayName: "Wang Wu", role: "frontend", responsibility: "Checkout UI", setDefault: true }, paths);
  return paths;
}

test("identity recover restores existing remote memberId without publishing", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-recover-"));
  try {
    const paths = await setup(home);
    const before = await loadLocalConfig(paths);
    await saveLocalConfig(paths, { ...before, defaultIdentityId: null, identities: before.identities.filter((identity) => identity.memberId !== memberA) });
    const recovered = await recoverIdentity({ forumAlias: "a-team", memberId: memberA, setDefault: true }, paths);
    assert.equal(recovered.action, "recovered");
    assert.equal(recovered.identity.memberId, memberA);
    assert.equal(recovered.identity.displayName, "Zhang San");
    assert.equal((await loadLocalConfig(paths)).defaultIdentityId, memberA);
    assert.equal((await recoverIdentity({ forumAlias: "a-team", memberId: memberA }, paths)).action, "unchanged");
  } finally { await rm(home, { recursive: true, force: true }); }
});

test("delegation attention requires expiry and is local/removable", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-attention-"));
  try {
    const paths = await setup(home);
    await assert.rejects(addIdentityAttention({ forumAlias: "a-team", ownerMemberId: memberB, subjectMemberId: memberA, mode: "delegation", reason: "Temporary coverage" }, paths), (error: unknown) => error instanceof ServiceError && error.code === "ATTENTION_EXPIRY_REQUIRED");
    const added = await addIdentityAttention({ forumAlias: "a-team", ownerMemberId: memberB, subjectMemberId: memberA, mode: "delegation", reason: "Temporary coverage", expiresAt: new Date(Date.now() + 60_000).toISOString() }, paths);
    assert.equal(added.action, "added");
    assert.equal((await listIdentityAttention({ forumAlias: "a-team", ownerMemberId: memberB }, paths)).links[0]?.active, true);
    assert.equal((await removeIdentityAttention({ forumAlias: "a-team", ownerMemberId: memberB, subjectMemberId: memberA }, paths)).removed, true);
    assert.equal((await listIdentityAttention({ forumAlias: "a-team", ownerMemberId: memberB }, paths)).links.length, 0);
  } finally { await rm(home, { recursive: true, force: true }); }
});
