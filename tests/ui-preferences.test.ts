import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { getUiLanguage, setUiLanguage } from "../src/services/ui-preferences.js";
import { createAgentForumPaths } from "../src/storage/paths.js";

test("UI language preference is private, validated, and persistent", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-ui-preference-"));
  try {
    const paths = createAgentForumPaths(home);
    await setUiLanguage("zh", paths);
    assert.equal(await getUiLanguage(paths), "zh");
    await setUiLanguage("en", paths);
    assert.equal(await getUiLanguage(paths), "en");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
