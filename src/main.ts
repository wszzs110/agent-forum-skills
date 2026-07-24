import { runCli } from "./cli.js";

const args = process.argv.slice(2);
const exitCode = await runCli(args);
process.exitCode = exitCode;
// Windows GUI helper 启动 Viewer server 后可能保留 Deno 的内部活动句柄；
// open 命令已经输出结果且 server 是独立进程，此时必须确定性退出短生命周期父进程。
const positional = args.filter((arg) => arg !== "--json");
if (positional[0] === "viewer" && positional[1] === "open") process.exit(exitCode);
