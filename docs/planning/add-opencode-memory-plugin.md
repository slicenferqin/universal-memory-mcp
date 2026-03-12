## 目标

- 为 OpenCode 增加一个 project-level plugin：在会话完成或空闲时自动把最后一轮 user/assistant 写入 universal-memory 的 daily 流水，带上 `client=opencode`。

## 设计要点

- **触发点**：优先用 `session.idle` 作为一次性触发，避免 `message.updated` 多次触发导致重复写入。OpenCode 插件体系支持订阅 `session.idle` 等事件。
- **数据来源**：在插件里维护 per-session 状态，使用以 `session_id` 为 key 的 `Map`，记录最近一次 user 文本与 assistant 文本。
- **去重**：为每个 session 保存 `lastRecordedHash`，例如 `user + assistant` 的 hash，或保存最后一次 assistant message id，确保只写一次。
- **写入方式**：插件通过 shell 执行 recorder：
  - 首选 `universal-memory-record --json`
  - fallback `npx -y --package universal-memory-mcp universal-memory-record --json`
- **落盘字段**：payload 中固定 `client: "opencode"`；补齐 `project`、`session_id`、`working_directory`；存储路径由 `MEMORY_PATH` 或 `AI_MEMORY_PATH` 控制。

## 需要新增或修改的文件

- 新增 `.opencode/plugins/universal-memory.ts`：OpenCode plugin，订阅事件并写入 recorder。
- 新增 `.opencode/README.md` 或 `docs` 段落：说明如何启用插件，包括放置位置、重启 opencode、环境变量。
- 可选新增 `.opencode/package.json`：只有在需要额外依赖时才添加，当前方案尽量零依赖。

## 实现步骤

1. 研究 OpenCode plugin 事件 payload，最少用到 `event.type`、`event.session_id` 与消息内容字段，并实现健壮的字段抽取函数。
2. 编写 plugin：
   - 在 `event` hook 中监听 `message.updated`，更新内存里的 `lastUser` 和 `lastAssistant`
   - 监听 `session.idle`，触发一次写入
3. 写入逻辑：构造 `{ user_message, ai_response, client: "opencode", project, session_id, working_directory }`，调用 recorder；失败时只打日志警告，不阻塞会话。
4. 添加本地验证脚本或说明：如何在没有真正 opencode 的情况下用模拟事件对象跑一次 plugin handler。
5. 运行 `pnpm -r build`，确认不影响现有构建，并补充 opencode 启用说明。

## 验证方式

- 手动验证：在启用插件的 opencode session 中完成一轮对话，检查 `~/.ai_memory/daily/YYYY-MM-DD.md` 是否出现 `Client: opencode` 记录。
- 仓库内验证：提供一个 Node 脚本模拟事件序列 `message.updated -> session.idle`，并断言 recorder 被调用。

## 约束与注意

- 插件运行在 OpenCode 侧，不应做向量化或索引等重任务，只做采集与触发。
- 避免把完整长输出无上限写入：对 user/assistant 文本做长度截断，和现有 stop hook 保持一致。
