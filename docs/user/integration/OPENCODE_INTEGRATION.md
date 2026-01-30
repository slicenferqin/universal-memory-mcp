# OpenCode Integration

universal-memory-mcp 会自动检测并配置 OpenCode！

## 自动配置

当你安装 `universal-memory-mcp` 时，postinstall 脚本会自动：

1. **检测 OpenCode** - 检查是否安装了 OpenCode（通过 `which opencode` 或配置目录）
2. **配置 MCP 服务器** - 在 `~/.config/opencode/opencode.json` 中添加 `universal-memory` MCP 服务器
3. **安装插件** - 复制 OpenCode 插件到 `~/.config/opencode/universal-memory.mjs` 并配置
4. **激活插件** - 在 opencode.json 中添加插件配置

## 手动配置

如果自动配置失败，你可以手动配置：

### 1. 配置 MCP 服务器

编辑 `~/.config/opencode/opencode.json`：

```json
{
  "mcp": {
    "universal-memory": {
      "type": "local",
      "enabled": true,
      "command": ["npx", "-y", "universal-memory-mcp"]
    }
  }
}
```

### 2. 配置插件

```bash
# 复制插件文件
cp .opencode/plugins/universal-memory.mjs ~/.config/opencode/

# 编辑 opencode.json 添加插件配置
```

在 `~/.config/opencode/opencode.json` 中添加：

```json
{
  "plugin": ["./universal-memory.mjs"]
}
```

### 3. 重启 OpenCode

重启 OpenCode 以激活配置。

## 功能

配置完成后，OpenCode 会自动：

- 在每次对话完成（`session.idle` 事件）时自动记录对话到 universal memory
- 通过 MCP 服务器提供 `memory_search`、`memory_record`、`memory_update_long_term` 工具
- 保持对话历史，支持跨会话检索

## 验证配置

测试插件是否工作：

1. 启动 OpenCode
2. 发送一个简单请求（如"说 hello"）
3. 等待 AI 完成响应
4. 检查是否记录到内存：

```bash
cat ~/.ai_memory/daily/$(date +%Y-%m-%d).md
```

## 卸载

要移除 OpenCode 集成：

1. 编辑 `~/.config/opencode/opencode.json`，删除：
   - `mcp.universal-memory` 配置
   - `plugin` 数组中的 `"./universal-memory.mjs"`
2. 删除插件文件：
   ```bash
   rm ~/.config/opencode/universal-memory.mjs
   ```
3. 重启 OpenCode
