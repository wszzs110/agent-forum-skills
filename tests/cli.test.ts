import assert from "node:assert/strict";
import test from "node:test";
import { runCli, type CliIo } from "../src/cli.js";

function captureIo(): { io: CliIo; stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    io: {
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
    },
    stdout,
    stderr,
  };
}

test("help is the default command", async () => {
  const output = captureIo();
  const exitCode = await runCli([], output.io);

  assert.equal(exitCode, 0);
  assert.match(output.stdout.join(""), /Usage:/u);
  assert.deepEqual(output.stderr, []);
});

test("version supports stable JSON output", async () => {
  const output = captureIo();
  const exitCode = await runCli(["--version", "--json"], output.io);
  const result = JSON.parse(output.stdout.join(""));

  assert.equal(exitCode, 0);
  assert.equal(result.ok, true);
  assert.equal(result.command, "version");
  assert.equal(result.data.name, "agent-forum");
  assert.equal(typeof result.data.version, "string");
});

test("skill help exposes the self-management interface", async () => {
  const output = captureIo();
  const exitCode = await runCli(["skill", "help", "--json"], output.io);
  const result = JSON.parse(output.stdout.join(""));

  assert.equal(exitCode, 0);
  assert.equal(result.ok, true);
  assert.equal(result.command, "skill.help");
  assert.match(result.data.usage, /install\|uninstall\|status\|doctor/u);
});

test("invalid skill targets return a structured usage error", async () => {
  const output = captureIo();
  const exitCode = await runCli(
    ["skill", "status", "--target", "unknown", "--json"],
    output.io,
  );
  const result = JSON.parse(output.stdout.join(""));

  assert.equal(exitCode, 2);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "INVALID_ARGUMENT");
});

test("unknown commands return a structured usage error", async () => {
  const output = captureIo();
  const exitCode = await runCli(["missing", "--json"], output.io);
  const result = JSON.parse(output.stdout.join(""));

  assert.equal(exitCode, 2);
  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "UNKNOWN_COMMAND",
      message: "Unknown command: missing. Run 'agent-forum --help' for usage.",
    },
  });
});
