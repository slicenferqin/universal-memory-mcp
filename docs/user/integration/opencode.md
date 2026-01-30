# OpenCode Integration

OpenCode 支持插件系统（plugins），可以在客户端侧订阅会话/消息事件，从而做到“确定性采集”（不依赖模型是否调用 MCP 工具）。

本项目提供了一个 project-level OpenCode 插件：在 `session.idle` 事件触发时，把最后一轮 user/assistant 写入 universal-memory 的 daily 流水，并标记 `Client: opencode`。

## 启用插件（项目级）

将插件文件放到你的项目目录：

- `<your-project>/.opencode/plugins/universal-memory.mjs`

然后重启 OpenCode。

## 启用插件（npm，全局）

OpenCode 支持在配置中通过 npm 包名启用插件（`plugin` 数组）。本仓库提供了一个 npm 形态的插件包 `@slicenferqin/opencode-universal-memory`，安装后会在 postinstall 中尝试自动将自身写入你的全局 OpenCode 配置（默认 `~/.config/opencode/opencode.json` 或 `opencode.jsonc`）。

注意：安装时会先创建一份 `.bak.<timestamp>` 备份，然后再写入配置。若你的配置文件包含复杂 JSONC 语法或写保护，可能需要手动添加。

## 启用插件（全局）

也可以放到全局插件目录（对所有项目生效）：

- macOS/Linux: `~/.config/opencode/plugins/universal-memory.mjs`

## 记忆落盘位置

默认写入：

- `~/.ai_memory/daily/YYYY-MM-DD.md`

可通过环境变量指定路径：

- `MEMORY_PATH=/custom/path`
- 或 `AI_MEMORY_PATH=/custom/path`

## Recorder 命令的解析顺序

插件内部会按如下顺序尝试写入：

1. `UNIVERSAL_MEMORY_RECORD_COMMAND`（可选，用于自定义命令）
2. `universal-memory-record --json`（若已全局安装）
3. `npx -y --package universal-memory-mcp universal-memory-record --json`
4. 若在仓库开发环境：回退到 `node <repo>/packages/mcp-server/dist/record.js --json`

其中 `UNIVERSAL_MEMORY_RECORD_COMMAND` 可配合 `UNIVERSAL_MEMORY_RECORD_ARGS` 使用：

```bash
export UNIVERSAL_MEMORY_RECORD_COMMAND=node
export UNIVERSAL_MEMORY_RECORD_ARGS="/abs/path/to/record.js --json"
```

## 自动写全局配置（npm 包）

`@slicenferqin/opencode-universal-memory` 的 postinstall 支持两个环境变量：

- `OPENCODE_CONFIG_PATH`：指定要写入的 opencode 配置文件路径（用于非默认目录）
- `OPENCODE_PLUGIN_AUTOINSTALL=0`：禁用自动写入（只安装包，不改配置）

## 故障排查

- 没有写入：检查 OpenCode 是否加载了插件目录，并查看 OpenCode 日志。
- 写入命令找不到：确保系统有 `npx`，或全局安装 `universal-memory-mcp`，或设置 `UNIVERSAL_MEMORY_RECORD_COMMAND` 指向可用 recorder。
