# Universal Memory MCP - 自动化配置实施计划

## 目标

用户只需执行 `npm install -g universal-memory-mcp`，即可完成所有配置，实现开箱即用。

## 当前状态（v0.2.3）

### ✅ 已完成

1. **MCP Server 自动配置**
   - 位置：`packages/mcp-server/scripts/postinstall.js`
   - 功能：自动添加 MCP server 配置到 `~/.claude/settings.json`
   - 配置内容：
     ```json
     {
       "mcpServers": {
         "universal-memory": {
           "command": "npx",
           "args": ["-y", "universal-memory-mcp"]
         }
       }
     }
     ```

2. **Memory Assistant Skill 自动安装**
   - 位置：同上 postinstall.js
   - 功能：自动创建 `~/.claude/skills/memory-assistant/SKILL.md`
   - 内容：引导 AI 自动调用 memory_search/record/update_long_term

3. **CLI 工具**
   - `universal-memory-mcp`：MCP server 主程序
   - `universal-memory-record`：记录对话的 CLI 工具

4. **备份机制**
   - 修改配置前自动备份
   - 幂等性：重复安装不会重复配置

### ❌ 未完成

1. **Claude Code 安装检查**
   - 需要检查 `~/.claude/` 目录是否存在
   - 如果不存在，给出友好提示

2. **Stop Hook 自动配置**
   - 创建 `~/.claude/hooks/` 目录
   - 安装 Stop hook 脚本到 `~/.claude/hooks/universal-memory-stop-hook.mjs`
   - 添加 Stop hook 配置到 `~/.claude/settings.json`

3. **Stop Hook 脚本打包**
   - 当前脚本在用户本地手动创建
   - 需要将脚本打包到 npm 包中，postinstall 时自动复制

## 实施方案

### 1. Claude Code 安装检查

**位置**：`packages/mcp-server/scripts/postinstall.js` 开头

**实现**：
```javascript
function checkClaudeCodeInstalled() {
  const claudeDir = path.join(os.homedir(), '.claude');

  if (!fs.existsSync(claudeDir)) {
    console.log('\n⚠️  Claude Code not detected!\n');
    console.log('Please install Claude Code first:');
    console.log('  https://code.claude.com/\n');
    console.log('After installing Claude Code, run:');
    console.log('  npm install -g universal-memory-mcp\n');
    process.exit(0); // 不报错，静默退出
  }

  return true;
}
```

**调用时机**：main() 函数最开始

### 2. Stop Hook 脚本准备

**新增文件**：`packages/mcp-server/scripts/universal-memory-stop-hook.mjs`

**内容**：将当前工作的 `/Users/slicenfer/.claude/hooks/universal-memory-stop-hook.mjs` 复制过来

**修改点**：
- 移除调试日志（或改为可选的环境变量控制）
- 确保脚本是独立的，不依赖外部路径

**package.json 修改**：
```json
{
  "files": [
    "dist",
    "scripts",  // 包含 postinstall.js 和 stop-hook 脚本
    "README.md"
  ]
}
```

### 3. Stop Hook 自动安装

**位置**：`packages/mcp-server/scripts/postinstall.js` 新增函数

**实现**：
```javascript
/**
 * Install Stop hook script
 */
function installStopHook() {
  console.log('\n🪝 Installing Stop hook...');

  const hooksDir = path.join(os.homedir(), '.claude', 'hooks');
  const hookScriptPath = path.join(hooksDir, 'universal-memory-stop-hook.mjs');

  // Create hooks directory if not exists
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
    console.log('  Created hooks directory');
  }

  // Copy hook script from package
  const sourceScript = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    'universal-memory-stop-hook.mjs'
  );

  // Check if hook already exists
  if (fs.existsSync(hookScriptPath)) {
    const existingContent = fs.readFileSync(hookScriptPath, 'utf-8');
    const newContent = fs.readFileSync(sourceScript, 'utf-8');

    if (existingContent === newContent) {
      console.log('  Stop hook already installed (same version)');
      return false;
    }

    // Backup existing hook
    const backupPath = `${hookScriptPath}.backup.${Date.now()}`;
    fs.copyFileSync(hookScriptPath, backupPath);
    console.log(`  Backed up existing hook to: ${backupPath}`);
  }

  fs.copyFileSync(sourceScript, hookScriptPath);
  fs.chmodSync(hookScriptPath, 0o755); // Make executable
  console.log('  Stop hook installed successfully');
  return true;
}
```

### 4. Stop Hook 配置添加

**位置**：`packages/mcp-server/scripts/postinstall.js` 新增函数

**实现**：
```javascript
/**
 * Configure Stop hook in Claude settings
 */
function configureStopHook() {
  console.log('\n⚙️  Configuring Stop hook...');

  let settings = readJsonFile(CLAUDE_SETTINGS_PATH) || {};

  // Initialize hooks if not exists
  if (!settings.hooks) {
    settings.hooks = {};
  }

  // Initialize Stop hook array if not exists
  if (!settings.hooks.Stop) {
    settings.hooks.Stop = [];
  }

  // Check if our hook is already configured
  const hookCommand = 'node ~/.claude/hooks/universal-memory-stop-hook.mjs';
  const alreadyConfigured = settings.hooks.Stop.some(entry =>
    entry.hooks?.some(hook =>
      hook.type === 'command' && hook.command.includes('universal-memory-stop-hook')
    )
  );

  if (alreadyConfigured) {
    console.log('  Stop hook already configured');
    return false;
  }

  // Add Stop hook configuration
  settings.hooks.Stop.push({
    hooks: [
      {
        type: 'command',
        command: hookCommand
      }
    ]
  });

  writeJsonFile(CLAUDE_SETTINGS_PATH, settings);
  console.log('  Stop hook configured successfully');
  return true;
}
```

### 5. 更新 main() 函数

**修改**：`packages/mcp-server/scripts/postinstall.js` 的 main()

```javascript
function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         Universal Memory MCP - Setup                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Check Claude Code installation
  if (!checkClaudeCodeInstalled()) {
    return;
  }

  let needsRestart = false;

  try {
    // 1. Configure MCP server
    const mcpConfigured = configureMcpServer();
    if (mcpConfigured) needsRestart = true;

    // 2. Install skill
    const skillInstalled = installSkill();
    if (skillInstalled) needsRestart = true;

    // 3. Install Stop hook script
    const hookInstalled = installStopHook();
    if (hookInstalled) needsRestart = true;

    // 4. Configure Stop hook
    const hookConfigured = configureStopHook();
    if (hookConfigured) needsRestart = true;

    // Summary
    console.log('\n' + '═'.repeat(60));

    if (needsRestart) {
      console.log('\n✅ Setup complete!\n');
      console.log('⚠️  IMPORTANT: Please restart Claude Code to enable all features.\n');
      console.log('After restart, Claude will automatically:');
      console.log('  • Search past conversations when you reference them');
      console.log('  • Record EVERY conversation automatically (via Stop hook)');
      console.log('  • Remember your preferences and decisions\n');
    } else {
      console.log('\n✅ Already configured! No changes needed.\n');
    }

    console.log('📁 Configuration locations:');
    console.log(`   MCP config: ${CLAUDE_SETTINGS_PATH}`);
    console.log(`   Skill: ${path.join(CLAUDE_SKILLS_PATH, 'memory-assistant', 'SKILL.md')}`);
    console.log(`   Stop hook: ${path.join(os.homedir(), '.claude', 'hooks', 'universal-memory-stop-hook.mjs')}`);
    console.log(`   Memory storage: ${path.join(os.homedir(), '.ai_memory')}\n`);

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('\nPlease configure manually. See README for instructions.');
    process.exit(1);
  }
}
```

## 文件清单

### 需要修改的文件

1. **packages/mcp-server/scripts/postinstall.js**
   - 添加 `checkClaudeCodeInstalled()`
   - 添加 `installStopHook()`
   - 添加 `configureStopHook()`
   - 修改 `main()` 函数

### 需要新增的文件

1. **packages/mcp-server/scripts/universal-memory-stop-hook.mjs**
   - 从当前工作版本复制
   - 清理调试日志（可选保留环境变量控制）

### 需要确认的文件

1. **packages/mcp-server/package.json**
   - 确认 `files` 字段包含 `scripts` 目录

## 测试计划

### 1. 全新安装测试

```bash
# 1. 清理现有配置
rm -rf ~/.claude/hooks/universal-memory-stop-hook.mjs
# 编辑 ~/.claude/settings.json，移除 Stop hook 配置

# 2. 全局安装
npm install -g universal-memory-mcp

# 3. 验证
ls -la ~/.claude/hooks/universal-memory-stop-hook.mjs
cat ~/.claude/settings.json | jq '.hooks.Stop'
cat ~/.claude/settings.json | jq '.mcpServers["universal-memory"]'
ls -la ~/.claude/skills/memory-assistant/SKILL.md

# 4. 重启 Claude Code 并测试对话
# 检查 ~/.ai_memory/daily/ 是否自动保存记忆
```

### 2. 重复安装测试

```bash
# 再次安装，应该显示 "Already configured"
npm install -g universal-memory-mcp
```

### 3. 升级测试

```bash
# 修改 Stop hook 脚本内容
# 重新安装，应该备份旧版本并安装新版本
npm install -g universal-memory-mcp
```

### 4. 无 Claude Code 测试

```bash
# 临时重命名 .claude 目录
mv ~/.claude ~/.claude.backup

# 安装应该给出友好提示
npm install -g universal-memory-mcp

# 恢复
mv ~/.claude.backup ~/.claude
```

## 发布流程

1. **开发分支**
   ```bash
   git checkout -b feat/auto-stop-hook
   ```

2. **实现功能**
   - 按照上述方案修改代码
   - 本地测试通过

3. **更新版本号**
   ```bash
   # packages/mcp-server/package.json
   # 0.2.3 -> 0.3.0 (新增 Stop hook 自动配置)
   ```

4. **更新 CHANGELOG**
   ```markdown
   ## [0.3.0] - 2026-01-29

   ### Added
   - 自动安装和配置 Stop hook，实现对话自动保存
   - Claude Code 安装检查
   - 完整的开箱即用体验

   ### Changed
   - 优化 postinstall 输出信息
   ```

5. **构建和发布**
   ```bash
   pnpm build
   cd packages/mcp-server
   npm publish
   ```

6. **验证发布**
   ```bash
   npm install -g universal-memory-mcp@0.3.0
   # 测试全流程
   ```

## 风险和注意事项

### 1. 权限问题
- Stop hook 脚本需要可执行权限：`chmod +x`
- 确保 postinstall 有权限写入 `~/.claude/` 目录

### 2. 兼容性
- 确保 Stop hook 脚本在不同 Node.js 版本下都能运行
- 测试 macOS、Linux、Windows（如果支持）

### 3. 错误处理
- 如果配置失败，不应该阻止 npm 安装
- 给出清晰的错误信息和手动配置指引

### 4. 幂等性
- 多次安装不应该产生重复配置
- 升级时应该正确替换旧版本

### 5. 调试日志
- Stop hook 的调试日志应该可选（环境变量控制）
- 生产环境默认关闭调试日志

## 后续优化（可选）

1. **健康检查命令**
   ```bash
   universal-memory-mcp --check
   # 检查所有配置是否正确
   ```

2. **卸载脚本**
   ```bash
   npm uninstall -g universal-memory-mcp
   # 自动清理配置（可选）
   ```

3. **配置管理命令**
   ```bash
   universal-memory-mcp --enable-debug   # 开启调试日志
   universal-memory-mcp --disable-debug  # 关闭调试日志
   ```

## 时间估算

- 实现代码：1-2 小时
- 测试验证：30 分钟
- 文档更新：30 分钟
- 发布流程：15 分钟

**总计**：约 2-3 小时

## 确认清单

- [ ] 代码实现完成
- [ ] 本地测试通过（全新安装、重复安装、升级）
- [ ] 无 Claude Code 场景测试通过
- [ ] 版本号更新
- [ ] CHANGELOG 更新
- [ ] README 更新（如需要）
- [ ] 构建成功
- [ ] 发布到 npm
- [ ] 验证发布版本可用
- [ ] 通知同事测试
