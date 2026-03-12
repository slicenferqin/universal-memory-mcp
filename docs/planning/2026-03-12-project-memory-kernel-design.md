# Persistent Project Memory Kernel

**日期：** 2026-03-12  
**作者：** Codex + slicenfer 讨论沉淀  
**状态：** Draft for cross-review  
**目标读者：** 参与长期记忆系统评审、实现与集成的 AI / Agent

---

## 1. 执行摘要

记忆赛道已经高度拥挤。今天的大多数方案都在卖同一套叙事：

- 持久记忆
- 向量检索
- 短期 / 长期 / 分层记忆
- 跨会话召回

这些能力重要，但已经不够构成明确的产品边界。更关键的问题往往没有被系统性解决：

1. 哪些记忆应该被信任
2. 哪些记忆已经过时
3. 哪些记忆真的帮助任务成功
4. 多 Agent 如何共享同一份项目状态

基于这个判断，`universal-memory-mcp` 不应继续被定义为“通用 AI 记忆插件”，而应重新聚焦为：

> **面向代码 Agent 的持久项目记忆内核**  
> **Persistent Project Memory Kernel for Coding Agents**

这个内核的目标不是让 Agent “像人一样记住一切”，而是让不同 coding agent 在多会话、多天、多任务协作中：

- 持续保留项目级证据
- 编译出可追溯、可更新、可失效的结构化记忆
- 在当前任务中只激活最值得信任、最相关、最有效的那部分记忆
- 通过标准化 adapter 接口接入 Claude Code、Codex、OpenClaw 等主流 agent

本文提出一个新的核心方向：

- **Never Forget, Selectively Activate**  
  永不遗忘，选择性激活
- **Memory is not a Vector DB**  
  向量库不是记忆，只是索引器
- **Outcome-aware Memory**  
  记忆需要由结果反馈持续强化或降权

---

## 2. 外部现状与拥挤度判断

### 2.1 赛道已经拥挤

截至 2026-03-12，通过公开文档与 GitHub 快照可以看到，主流 memory 项目已经非常多：

| 项目 | GitHub 信号 | 核心叙事 |
| --- | ---: | --- |
| [mem0](https://github.com/mem0ai/mem0) | 49.5k stars / 5.5k forks | 通用 memory layer |
| [langgraph](https://github.com/langchain-ai/langgraph) | 26.2k stars / 4.5k forks | 线程态 + namespace 长期记忆 |
| [graphiti](https://github.com/getzep/graphiti) | 23.6k stars / 2.3k forks | 时序知识图谱 memory |
| [cognee](https://github.com/topoteretes/cognee) | 13.2k stars / 1.3k forks | 知识引擎 / agent memory |
| [A-mem](https://github.com/agiresearch/A-mem) | 881 stars | Agentic memory research |

以上数据来自 `gh repo view` 快照，日期为 2026-03-12。

同时，围绕 OpenClaw 社区的 `gh search repos 'openclaw memory'` 结果也已经出现大量“多层记忆 / cron 蒸馏 / 向量 + 图谱 / 永不失忆”模板仓库。这说明“再做一个 memory system”本身已经不具备足够的方向辨识度。

### 2.2 官方方案已经覆盖“基础 memory layer”

公开资料也说明，主流平台已经提供了自己的基础 memory 抽象：

- [Mem0 OpenMemory](https://docs.mem0.ai/openmemory/overview) 把自己定义为 “private, local-first memory server”，通过 MCP 提供 `add_memories`、`search_memory` 等标准操作。
- [LangGraph Memory Overview](https://docs.langchain.com/oss/javascript/langgraph/memory) 明确区分了 thread-scoped short-term memory 与 namespace-scoped long-term memory，并给出 `profile` 与 `collection` 两种长期记忆组织方式。
- [Graphiti](https://help.getzep.com/graphiti/getting-started/welcome) 将记忆建模为 temporally-aware knowledge graph，强调实时增量更新、历史查询与混合检索。

结论是：**“记忆 + 向量 + 召回”已经是默认配置，不是新方向。**

---

## 3. 为什么要重新聚焦

### 3.1 我们真正需要的不是“通用人格记忆”

从后续项目的真实需求出发，我们要解决的并不是：

- Agent 是否记得用户喜欢什么语气
- Agent 是否能像个人助理那样“有个性”
- Agent 是否能泛化到所有消费级聊天场景

我们真正要解决的是：

- 这个项目当前状态是什么
- 之前做过哪些尝试，哪些成功，哪些失败
- 团队偏好和工程约束是什么
- 还有哪些未完成线程需要持续跟踪
- 不同 Agent 之间如何共享同一份项目状态，而不是各自失忆

### 3.2 最优 wedge：Project Memory, not Human Memory

因此，新的 wedge 应定义为：

> **Project Memory, not Human Memory**  
> 优先做项目级持久记忆，而不是泛人格长期记忆

这个切法有四个直接好处：

1. **价值更刚需**  
   新会话恢复项目状态、避免重复解释，是 coding agent 的高频痛点。

2. **更容易验证效果**  
   是否减少重复问答、是否恢复未完成线程、是否提升修复复用率，都可以量化。

3. **更适合多 Agent 协作**  
   项目状态天然可以共享，个体化人格记忆则很难成为跨 Agent 公共资产。

4. **更容易形成 adapter 标准**  
   “项目快照、决策、偏好、open threads” 是跨 Agent 共性；“人格/陪伴”不是。

---

## 4. 新的核心主张

### 4.1 Never Forget, Selectively Activate

系统不应该机械模拟人脑“遗忘”，而应做到：

- 原始证据尽量不删
- 旧记忆可以降权、失活、归档
- 当前任务只激活少量高价值记忆

因此，记忆系统的关键能力不是“存下更多文本”，而是：

- 激活控制
- 时效管理
- 冲突处理
- 结果强化

### 4.2 Memory is not a Vector DB

向量数据库只解决了“相似内容怎么找”，没有解决：

- 这条记忆从哪里来
- 现在还是否有效
- 是否已经被更新的事实覆盖
- 是否在过去被验证有效
- 是否适用于当前项目 / 分支 / 目录 / 文件

因此，向量索引应该被视为 **memory index**，而不是 **memory source of truth**。

### 4.3 Outcome-aware Memory

真正有价值的长期记忆，不应该只由“语义相似”或“时间新鲜度”决定，还应该由结果反馈驱动：

- 测试通过 / 失败
- PR 合并 / 回滚
- issue 关闭 / reopen
- 用户明确确认某规则有效
- 某修复策略被反复复用成功

这意味着记忆系统不只是“存”和“找”，还需要学会：

- 提升成功经验的权重
- 降低失败或已失效策略的权重
- 将记忆从“文本碎片”转为“可评估资产”

---

## 5. 目标定义

### 5.1 目标

构建一个本地优先、可适配多 coding agent 的项目记忆内核，支持：

- 持续记录项目事件
- 结构化沉淀 claims
- 输出 session brief / project snapshot
- 基于可信度、时效、结果与作用域进行激活
- 通过 adapter 接入多个 agent

### 5.2 非目标

当前阶段不做：

- 通用消费级聊天记忆产品
- 以 UI 为中心的 SaaS 协作平台
- 仅以“向量召回效果”作为主要卖点
- 复杂人格模拟 / 情绪陪伴记忆
- 一开始兼容所有 agent

---

## 6. 核心架构

新的系统建议按四层划分，而不是继续强调 L0/L1/L2 的类脑叙事。

### 6.1 Layer A: Evidence Ledger

**职责：** 保存原始事件，append-only，可追溯。

事件示例：

- 用户消息
- Agent 回复
- 文件编辑
- 命令执行结果
- 测试结果
- Git commit / branch / revert
- Issue / PR 关联
- 用户显式确认某偏好或决策
- 会话开始 / 会话结束

Ledger 的作用不是让模型直接检索，而是作为系统的事实根基。

### 6.2 Layer B: Claim Store

**职责：** 将原始事件编译为结构化项目记忆。

Claim 类型建议至少包括：

- `project_fact`
- `decision`
- `preference`
- `workflow_rule`
- `open_thread`
- `incident`
- `artifact`
- `owner`

每条 claim 都必须具备：

- 来源
- 作用域
- 有效期
- 置信度
- 是否被覆盖
- 是否被 pin

### 6.3 Layer C: Activation Engine

**职责：** 决定当前任务该激活哪些记忆。

激活不应等于“向量 top-k”，而应综合考虑：

- 语义相关度
- 时间新鲜度
- 作用域匹配度
- 置信度
- 历史效果
- 是否被用户 pin
- 是否已被标记 stale / superseded

建议分数模型：

```text
activation_score =
  relevance
  * freshness
  * confidence
  * importance
  * outcome_score
  * scope_match
```

### 6.4 Layer D: Memory Compiler

**职责：** 执行从事件到账本、从账本到 claim、从 claim 到 recall packet 的编译过程。

Compiler 负责：

- 抽取
- 去重
- 冲突检测
- stale 标记
- claim 合并
- brief 生成
- snapshot 生成
- agent-specific recall packet 生成

---

## 7. 核心数据模型

### 7.1 NormalizedEvent

```ts
type NormalizedEvent = {
  id: string
  ts: string
  project_id: string
  session_id?: string
  agent_id: string
  event_type:
    | "user_message"
    | "agent_message"
    | "file_edit"
    | "command_result"
    | "test_result"
    | "git_commit"
    | "issue_link"
    | "session_start"
    | "session_end"
    | "user_confirmation"
  scope?: {
    repo?: string
    branch?: string
    cwd?: string
    files?: string[]
  }
  content: string
  metadata?: Record<string, unknown>
}
```

### 7.2 Claim

```ts
type Claim = {
  id: string
  project_id: string
  type:
    | "project_fact"
    | "decision"
    | "preference"
    | "workflow_rule"
    | "open_thread"
    | "incident"
    | "artifact"
    | "owner"
  content: string
  source_event_ids: string[]
  confidence: number
  importance: number
  outcome_score: number
  status: "active" | "stale" | "superseded" | "archived"
  valid_from?: string
  valid_to?: string
  supersedes?: string[]
  pinned?: boolean
  scope?: {
    repo?: string
    branch?: string
    cwd_prefix?: string
    files?: string[]
  }
  last_verified_at?: string
  last_activated_at?: string
}
```

### 7.3 RecallPacket

```ts
type RecallPacket = {
  project_id: string
  generated_at: string
  agent_id: string
  brief: string
  active_claims: Claim[]
  open_threads: Claim[]
  recent_evidence_refs: string[]
  warnings?: string[]
}
```

---

## 8. 我们真正要解决的四个难点

### 8.1 哪些记忆应该被信任

这不应该由 embedding similarity 单独决定，而应该由以下信号共同决定：

- 来源是否明确
- 是否经过用户确认
- 是否有多个事件支撑
- 是否被后续结果验证
- 是否与当前项目 / 分支 / 文件匹配

**建议：** 引入 `confidence` 与 `outcome_score` 两个独立维度，而不是只保留 `score`。

### 8.2 哪些记忆已经过时

并不是所有“旧”记忆都过时。

例如：

- “这个仓库用 pnpm” 可能长期有效
- “当前 hotfix 分支要先修 Windows 安装 bug” 是短时有效

因此需要区分：

- `stale`: 可能过时，降低激活
- `superseded`: 已被新信息覆盖
- `archived`: 保留证据，但默认不进入热路径

**建议：** 把“时间衰减”从单一公式扩展为“时间 + 类型 + 验证结果”的联合策略。

### 8.3 哪些记忆真的帮助任务成功

这部分是当前大多数 memory 实现最薄弱的一环。

建议接入的 outcome signals：

- 测试是否通过
- 提交是否被 revert
- PR 是否 merge
- issue 是否 close / reopen
- 用户是否明确说“以后都这么做”

成功信号应提升：

- `importance`
- `outcome_score`
- `default_activation_priority`

失败或冲突信号应降低：

- `confidence`
- `outcome_score`

### 8.4 多 Agent 如何共享同一份项目状态

这是本项目最有机会成为基础设施的地方。

共享方式不应该是“同步聊天历史”，而应该是共享：

- 标准化事件
- 标准化 claims
- 标准化 recall packet

不同 agent 只负责：

- 采集事件
- 消费 recall
- 调用统一 memory tools

---

## 9. Adapter 抽象

为避免一开始就深度绑定某一个平台，建议把适配层拆成三个接口，而不是一个大而全的 adapter。

### 9.1 Capture Adapter

**职责：** 从不同 agent 环境采集事件，转换为 `NormalizedEvent`。

输入可能包括：

- hook
- plugin event
- transcript log
- wrapper CLI
- MCP tool call
- 文件系统观察

输出：

- `NormalizedEvent[]`

### 9.2 Recall Adapter

**职责：** 将 `RecallPacket` 注入目标 agent 的上下文。

输出方式可能包括：

- SessionStart hook 注入
- system prompt 注入
- 工具返回结果
- sidecar 文件
- agent-specific context API

### 9.3 Tool Adapter

**职责：** 给 agent 暴露统一的 memory 操作面。

建议标准工具：

- `memory.search`
- `memory.record_event`
- `memory.upsert_claim`
- `memory.session_brief`
- `memory.project_snapshot`
- `memory.verify_claim`

---

## 10. 目标 agent 与现实接入路径

### 10.1 Claude Code

官方资料表明：

- [Claude Code Hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) 支持 `SessionStart`、`Stop`、`SessionEnd`
- [Claude Code MCP](https://docs.anthropic.com/en/docs/claude-code/mcp) 支持通过 MCP 接入外部工具与数据源

因此 Claude Code 非常适合作为第一参考实现：

- Capture: `Stop` / `SessionEnd`
- Recall: `SessionStart`
- Tools: MCP server

### 10.2 Codex

OpenAI 官方文档显示：

- Codex 继续强化 agentic coding 定位，例如 [GPT-5.3-Codex](https://developers.openai.com/api/docs/models/gpt-5.3-codex) 被定义为 “the most capable agentic coding model to date”
- OpenAI 当前生态也已经把 MCP 作为重要集成面的一部分，见 [OpenAI developer docs](https://developers.openai.com/)

对 Codex 的建议路径是：

- 第一阶段通过 MCP + 工作区文件约定接入
- 第二阶段补充更强的 native recall integration

### 10.3 OpenClaw

GitHub 快照表明 OpenClaw 社区已出现大量记忆模板与变体，说明其需求明确，但生态碎片化也更强。

因此对 OpenClaw 的策略不应是“现在就做重适配”，而应是：

- 先定义 adapter contract
- 给出 reference adapter skeleton
- 允许社区围绕插件 / 技能 / 文件约定自行实现

### 10.4 与当前仓库的关系

这份提案不是要求彻底推翻现有仓库，而是要求重新定义“哪些能力是产品核心，哪些只是实现细节”。

**建议保留的现有资产：**

- 本地优先的总体方向
- MCP tool surface 的基本思路
- SessionStart / Stop / SessionEnd 类集成模式
- 时间衰减与项目相关性加权思路
- 归档与生命周期调度思路
- 现有的 adapter / plugin 经验

**建议重新定位的现有能力：**

- `daily / long_term / summary`  
  应从“对外产品定义”降为内部编译与存储策略
- 向量搜索  
  应从“核心产品卖点”降为 activation engine 的一个索引子系统
- 三层记忆架构  
  应从“主叙事”降为 memory compiler 的实现选项

**建议替换或重构的部分：**

- 默认主搜索路径  
  需要从“旧关键词搜索 + 可选增强搜索”转向统一 activation engine
- 长期记忆的组织方式  
  需要从 Markdown 文本为中心转向 evidence + claim 模型
- 记忆质量判断  
  需要从“语义相关 + 时间衰减”为主，升级为“可信度 + 时效 + 结果反馈 + 作用域匹配”

---

## 11. 第一阶段 MVP

### 11.1 目标

验证“Persistent Project Memory Kernel”是否成立，而不是验证“通用 memory 插件”。

### 11.2 范围

**必须做：**

- SQLite-based ledger + claim store
- 标准化事件模型
- claim 编译与状态机
- session brief / project snapshot 生成
- activation engine v1
- Claude Code reference adapter
- MCP tool surface v1

**可以后做：**

- 向量检索增强
- 图谱存储
- Web UI
- Team workspace
- SaaS / hosted mode
- OpenClaw 深度适配

### 11.3 里程碑

#### Milestone 1: 内核成型

- `ledger_events`
- `claims`
- `claim_links`
- `activation_logs`
- `outcomes`

#### Milestone 2: Claude Code 参考实现

- `SessionStart` recall
- `Stop` / `SessionEnd` capture
- MCP tools 全链路打通

#### Milestone 3: 结果反馈回路

- 测试结果接入
- Git 结果接入
- claim 强化 / 降权策略

---

## 12. 评估指标

新系统必须用“项目协作效果”评估，而不是只看检索命中率。

### 12.1 基础指标

- Session 恢复成功率
- 重复追问减少率
- Open thread 恢复率
- recall token 体积
- 平均 recall latency

### 12.2 质量指标

- stale recall rate
- superseded claim leakage
- trusted recall precision
- outcome-backed recall ratio

### 12.3 协作指标

- 多 Agent 状态一致性
- 相同问题修复复用率
- 人工确认次数下降趋势
- 项目 onboarding 加速程度

---

## 13. 关键风险

### 13.1 过度结构化

如果 schema 设计过重，系统会很快变成复杂的知识管理系统，而不是轻量的 coding agent memory kernel。

**缓解方式：**

- 先只保留最小 claim 类型
- 所有 claim 必须能回溯到 evidence

### 13.2 过度依赖 LLM 编译

如果记忆编译高度依赖 LLM，成本、稳定性与可测试性都会恶化。

**缓解方式：**

- 规则优先，LLM 作为增强层
- 先做 deterministic extraction baseline

### 13.3 过早兼容太多平台

如果一开始追求 Claude Code、Codex、OpenClaw、OpenCode、Cursor 全兼容，核心内核会被适配细节拖垮。

**缓解方式：**

- 第一阶段只做一个 reference adapter
- 第二阶段做第二个 adapter 验证抽象是否稳固

### 13.4 记忆污染

错误事实一旦进入长期记忆，会持续污染后续上下文。

**缓解方式：**

- 引入 `status` 与 `supersedes`
- 强制 outcome feedback
- 将“用户确认”视为高价值验证信号

---

## 14. 建议的最终定位语

推荐新的定位语：

> **A local-first persistent project memory kernel for coding agents.**  
> **让 Claude Code、Codex、OpenClaw 等代码 Agent 共享同一个项目记忆底座。**

比起“通用 memory 插件”，这个定位更清楚地强调：

- 本地优先
- 项目级
- 持久化
- 代码 Agent
- 内核 + adapter

---

## 15. 结论

未来的方向不应再是：

> “我们也有 memory、向量、召回、三层记忆。”

而应是：

> “我们正在构建一个结果感知、可追溯、可失效、可多 Agent 共享的项目记忆内核。”

如果这条路线成立，`universal-memory-mcp` 的真正壁垒不会是“有没有 memory”，而是：

- 能否让记忆有可信度
- 能否让记忆有生命周期
- 能否让记忆从结果中学习
- 能否让多个 coding agent 共享同一份项目状态

这四点，才是下一阶段真正值得投入的差异化核心。

---

## 16. 参考资料

### 官方 / 文档

- [Mem0 OpenMemory Overview](https://docs.mem0.ai/openmemory/overview)
- [Mem0 MCP Integration](https://docs.mem0.ai/platform/features/mcp-integration)
- [LangGraph Memory Overview](https://docs.langchain.com/oss/javascript/langgraph/memory)
- [Graphiti Welcome](https://help.getzep.com/graphiti/getting-started/welcome)
- [Graphiti MCP Server](https://help.getzep.com/graphiti/getting-started/mcp-server)
- [Claude Code Hooks](https://docs.anthropic.com/en/docs/claude-code/hooks)
- [Claude Code MCP](https://docs.anthropic.com/en/docs/claude-code/mcp)
- [OpenAI Developer Docs](https://developers.openai.com/)
- [GPT-5.3-Codex model docs](https://developers.openai.com/api/docs/models/gpt-5.3-codex)

### GitHub 快照

- [mem0ai/mem0](https://github.com/mem0ai/mem0)
- [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph)
- [getzep/graphiti](https://github.com/getzep/graphiti)
- [topoteretes/cognee](https://github.com/topoteretes/cognee)
- [agiresearch/A-mem](https://github.com/agiresearch/A-mem)
- [openclaw/openclaw](https://github.com/openclaw/openclaw)

### 说明

本文中的 GitHub star / fork 数据与生态判断，基于 2026-03-12 当天通过 `gh` 命令与公开网页检索获得的快照，属于时间敏感信息。
