# Universal Memory 技术选型报告

## 1. 三者对比分析

### 1.1 定义与定位

| 特性         | MCP (Model Context Protocol) | Skill                    | Plugin                  |
| ------------ | ---------------------------- | ------------------------ | ----------------------- |
| **本质**     | 工具协议扩展                 | 提示词模板               | 功能包分发机制          |
| **主要用途** | 提供工具给 AI 调用           | 指导 AI 行为/知识注入    | 打包技能/Agent/Hook/MCP |
| **通信方式** | stdio/HTTP/SSE               | 嵌入 Prompt              | 事件驱动                |
| **适用场景** | 数据查询、API 调用、文件操作 | 知识库、规范约束、工作流 | 分发功能、团队协作      |

### 1.2 能力矩阵

| 能力              | MCP                   | Skill             | Plugin          |
| ----------------- | --------------------- | ----------------- | --------------- |
| 提供工具 API      | ✅                    | ❌                | ✅ (通过 MCP)   |
| 注入知识          | ❌                    | ✅                | ✅ (通过 Skill) |
| 事件监听/响应     | ❌                    | ❌                | ✅              |
| 持久化存储        | ❌                    | ❌                | ✅ (可打包)     |
| 团队共享          | 部分 (MCP 配置可共享) | 部分 (项目 Skill) | ✅ (最佳)       |
| 动态行为 (运行时) | ✅                    | ❌ (静态)         | ✅              |
| 向后端服务通信    | ✅                    | ❌                | ✅              |

### 1.3 Claude Code vs OpenCode 兼容性

| 功能     | Claude Code              | OpenCode             |
| -------- | ------------------------ | -------------------- |
| MCP      | ✅ 完整支持              | ❌ 无对应概念        |
| Skill    | ✅ 完整支持              | ❌ 无对应概念        |
| Plugin   | ✅ 支持                  | ✅ 支持 (但机制不同) |
| Hooks    | ✅ 通过 Plugin 提供      | ✅ 原生支持          |
| 自动发现 | Skills 自动加载          | 插件自动加载         |
| 命名空间 | `plugin-name:skill-name` | 直接 `skill-name`    |

---

## 2. 长期记忆功能需求分析

### 2.1 核心功能拆解

| 功能模块         | 实现方式     | 推荐方案               |
| ---------------- | ------------ | ---------------------- |
| **保存记忆**     | 工具 API     | MCP (`memory_record`)  |
| **搜索记忆**     | 工具 API     | MCP (`memory_search`)  |
| **记忆分块**     | 后端逻辑     | MCP 内部处理           |
| **向量化**       | 后端逻辑     | MCP 内部处理           |
| **长期整理**     | 定期任务     | Hook + MCP             |
| **自动提醒保存** | 事件触发     | Hook (Stop/SessionEnd) |
| **AI 调用记忆**  | 模型自动触发 | MCP 工具 + Skill 描述  |

### 2.2 为什么需要多方案支持？

**核心矛盾**：Claude Code 和 OpenCode 不兼容同一套机制

| 维度     | Claude Code      | OpenCode              |
| -------- | ---------------- | --------------------- |
| 工具扩展 | MCP              | Plugin `tool` hook    |
| 自动触发 | Skill (描述匹配) | Plugin `session.idle` |
| 分发机制 | Plugin (打包)    | Plugin (npm/本地)     |
| 团队共享 | `.mcp.json`      | `opencode.json`       |

**结论**：需要 **双适配器架构**

---

## 3. 推荐架构方案

### 3.1 架构图

```
universal-memory-mcp/
├── packages/
│   ├── core/                      # 核心记忆引擎 (独立 npm 包)
│   │   ├── src/
│   │   ├── storage.ts           # 存储 (JSON/SQLite)
│   │   ├── chunker.ts           # 分块逻辑
│   │   ├── embedding.ts         # 向量化
│   │   ├── search.ts            # 搜索 (向量相似度)
│   │   └── index.ts             # MCP Server 实现
│   │   └── package.json
│   │
│   ├── claude-adapter/            # Claude Code 适配器
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── skills/
│   │   │   └── memory-assistant/
│   │   │       └── SKILL.md
│   │   ├── hooks/
│   │   │   └── hooks.json        # Stop hook 提醒
│   │   └── .mcp.json               # 引用 core MCP
│   │
│   └── opencode-adapter/          # OpenCode 适配器
│       ├── plugin.ts
│       ├── package.json
│       └── tsconfig.json
```

### 3.2 数据流

#### Claude Code 流程

```
用户提问
    ↓
Claude 分析上下文
    ↓
加载 memory-assistant Skill
    ↓
调用 MCP 工具: memory_search()
    ↓
MCP core 返回相关记忆
    ↓
Claude 结合记忆回答
    ↓
用户会话结束
    ↓
Stop Hook 触发
    ↓
检查是否调用 memory_record
    ↓
如果没有，提示 AI 保存
```

#### OpenCode 流程

```
用户提问
    ↓
Plugin `session.idle` 事件
    ↓
自动调用 memory_record (如果未调用)
    ↓
下次对话时
    ↓
Plugin `tool` hook 暴露 memory_search
    ↓
OpenCode AI 自动搜索记忆
```

---

## 4. 技术选型结论

### 4.1 核心原则

| 原则         | 说明                                        |
| ------------ | ------------------------------------------- |
| **职责分离** | Core MCP 负责记忆逻辑，Adapter 负责平台集成 |
| **最小依赖** | MCP 作为独立包，可单独使用                  |
| **渐进增强** | 优先 MCP，后加适配器                        |

### 4.2 选型矩阵

| 层级              | 推荐方案                     | 理由                   |
| ----------------- | ---------------------------- | ---------------------- |
| **存储层**        | JSON/SQLite                  | MCP 内部实现，跨平台   |
| **向量化**        | OpenAI Embedding API         | MCP 内部调用，外部依赖 |
| **搜索**          | 余弦相似度                   | MCP 内部计算           |
| **Claude 集成**   | MCP + Skill + Hook           | 完整支持，最佳体验     |
| **OpenCode 集成** | Plugin (tool + session.idle) | 原生支持，事件驱动     |
| **分发**          | Monorepo (pnpm)              | 多包管理，版本同步     |

### 4.3 MCP vs Skill vs Plugin 使用决策

```
场景 1: 提供可调用的工具
→ 使用 MCP

场景 2: 改变 AI 行为/注入知识
→ 使用 Skill

场景 3: 监听事件/自动化流程
→ 使用 Hook (Claude) 或 Plugin event (OpenCode)

场景 4: 打包分享
→ 使用 Plugin

场景 5: 临时快速实验
→ 使用 .claude/skills/ (项目级)
```

---

## 5. 最佳实践建议

### 5.1 MCP 最佳实践

1. **工具命名**: 清晰、具名化 (`memory_search` vs `search`)
2. **工具描述**: 包含触发关键词 (`"when user asks about past conversations"`)
3. **参数简化**: 最少必要参数
4. **错误处理**: 友好错误消息
5. **性能优化**: 增量更新、惰性加载

### 5.2 Skill 最佳实践

1. **描述精准**: 避免 "do everything"，聚焦具体场景
2. **前置条件**: 明确何时激活 (`"when user mentions past work"`)
3. **引用工具**: 在 Skill 中说明何时调用 MCP 工具
4. **长度控制**: `< 500 行`，详细内容移到 supporting files
5. **变量使用**: 正确使用 `$ARGUMENTS`、`${CLAUDE_SESSION_ID}`

### 5.3 Hook 最佳实践

1. **非侵入式**: Hook 不应阻塞主流程
2. **幂等性**: 重复运行结果一致
3. **日志记录**: 调试关键步骤
4. **权限最小化**: 只请求必要权限
5. **失败降级**: Hook 失败不影响主功能

### 5.4 Plugin 最佳实践

1. **单一职责**: 每个 Plugin 做一件事
2. **向后兼容**: 版本升级不破坏现有配置
3. **文档完整**: README、CHANGELOG、示例
4. **测试覆盖**: 多场景验证
5. **持续集成**: 自动化测试和发布

---

## 6. 风险与权衡

### 6.1 当前方案 (MCP-only) vs 完整方案

| 维度           | MCP-only          | 完整方案   |
| -------------- | ----------------- | ---------- |
| **功能完整度** | ⭐⭐⭐            | ⭐⭐⭐⭐⭐ |
| **用户体验**   | 需手动配置        | 自动安装   |
| **跨平台**     | ❌ 仅 Claude Code | ✅ 双平台  |
| **维护成本**   | 低                | 中高       |
| **代码复用**   | 低                | 高         |

### 6.2 推荐实施路径

**Phase 1 (当前)**: MCP 核心功能

- ✅ `memory_search`
- ✅ `memory_record`
- ✅ 基础存储和搜索

**Phase 2**: Claude Code 适配器

- ⬜ Skill (`memory-assistant`)
- ⬜ Stop Hook (提醒保存)
- ⬜ `.mcp.json` 打包

**Phase 3**: OpenCode 适配器

- ⬜ Plugin 实现
- ⬜ `session.idle` 自动保存
- ⬜ `tool` hook 暴露工具

**Phase 4**: 高级功能

- ⬜ 向量化优化
- ⬜ 自动整理
- ⬜ 记忆去重

---

## 7. 最终建议

### 7.1 短期 (1-2 周)

**目标**: MCP 核心可用

1. 完善现有 MCP 实现
2. 添加基础测试
3. 发布到 npm

### 7.2 中期 (1-2 月)

**目标**: Claude Code 完整体验

1. 实现 Claude Code Plugin
2. 发布到 Claude Marketplace
3. 用户文档和示例

### 7.3 长期 (2-3 月)

**目标**: 多平台支持

1. 实现 OpenCode Plugin
2. 高级记忆功能 (向量化、整理)
3. 社区生态建设

---

## 附录：快速参考

### A. MCP 工具定义示例

```typescript
{
  name: "memory_search",
  description: "Search past conversations and decisions. Use when user asks about previous work, decisions, or context.",
  inputSchema: {
    query: {
      type: "string",
      description: "Search query"
    }
  }
}
```

### B. Skill Frontmatter 示例

```yaml
---
name: memory-assistant
description: Helps AI use memory tools for long-term context retention
---

ALWAYS use memory tools:
1. Call memory_search BEFORE answering questions about past work
2. Call memory_record AFTER meaningful conversations
3. Use memory_update_long_term for important decisions

This is MANDATORY for all conversations with substance.
```

### C. Hook 配置示例

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Check if memory_record was called. If not and conversation was meaningful, remind to save.",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```
