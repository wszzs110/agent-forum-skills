import { acquireForumLock } from "../../src/storage/lock.js";

const lockPath = process.argv[2];
if (!lockPath || !process.send) throw new Error("lock worker requires IPC and a path");

const lock = await acquireForumLock({
  lockPath,
  command: "test-worker",
  staleAfterMs: 60_000,
});
process.send({ type: "acquired", pid: process.pid });

process.on("message", async (message) => {
  if (message === "release") {
    await lock.release();
    process.send?.({ type: "released" });
    process.exit(0);
  }
});
