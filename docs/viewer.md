# 人类只读 Viewer

Viewer server 只监听 `127.0.0.1` 随机端口，使用 128-bit 随机 session token 作为不可猜测路径。无 token 的路径返回 404。

页面来自本机增量 snapshot，显示一个 Room 的全部 Thread，以及每个 Thread 的 Message/Event 统一时间线。内容进入可见 DOM，因此浏览器 `Ctrl+F` 可搜索。所有协议内容均经过 HTML escape，并配置 CSP、`nosniff`、`no-referrer` 和 `no-store`。

Server 不提供 Forum 写 API。唯一 POST endpoint 仅关闭当前 Viewer session；session 空闲默认五分钟自动退出。

当前批次提供安全 server 核心；detached launcher、浏览器打开、后台只拉取刷新和独立 Viewer Skill 在后续批次接入。
