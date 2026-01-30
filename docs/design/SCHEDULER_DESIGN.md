# 调度机制设计说明

## 🎯 核心改进

用户的反馈完全正确！原设计有以下问题：

- ❌ Weekly (7天) 才做 L1→L2 整合 - **太慢了！**
- ❌ 不符合人类记忆规律（人类每天睡觉时都在整理记忆）

## ✅ 改进后的设计

### **Daily (每天) - 做所有事情 🌙**

就像人类每天睡觉时整理记忆一样：

```typescript
private async runDailyTask(): Promise<void> {
  // 1️⃣ L0 → L1: 提取昨天的对话
  await scanDailyLogs({ days: 1 })
  await extractWithClaudeCLI(conversations, { model: 'haiku' })
  await updateLongTermMemory()
  // 输出: long_term/decisions.md, facts.md, profile.md, ...

  // 2️⃣ L1 → L2: 整合到 L2 摘要（每天！）
  await consolidateSummaries({ model: 'sonnet' })
  // 输出: long_term/profile-summary.md, knowledge-summary.md

  // 3️⃣ 向量化所有内容
  await pipeline.indexLongTermFiles()
}
```

**效果**：

- ✅ 用户今天聊了天，明天就能在 L2 摘要中看到
- ✅ L2 摘要始终是最新的
- ✅ 符合"每天整理记忆"的规律

### **Weekly (每周) - 深度优化 📅**

由于 Daily 已经做了核心的 L1→L2，Weekly 现在是可选的"优化"任务：

```typescript
private async runWeeklyTask(): Promise<void> {
  // 使用更高质量的模型重新整合
  await consolidateSummaries({ model: 'opus' })
  // opus 会重新组织 L2 摘要，提高质量

  // TODO: 清理过时/重复的内容
  // TODO: 生成周报
}
```

**作用**：

- ✅ 深度优化 L2 摘要质量
- ✅ 清理和去重
- ✅ 类似"周末反思时间"

### **Monthly (每月) - 归档 🗄️**

```typescript
private async runMonthlyTask(): Promise<void> {
  // 归档旧内容到冷存储
  await archiveManager.archive({
    archiveDailyAfter: 7,      // 7 天前的 daily/
    archiveLongTermAfter: 30,  // 30 天前的 long_term/
  })
}
```

---

## 📅 时间线示例

假设今天是 **2026-01-30**：

```
2026-01-30 00:00  🌙 Daily Task 运行
                  ├─ [L0→L1] 提取 2026-01-29 的对话
                  │  decisions.md: "选择了 TypeScript"
                  │  facts.md: "项目使用 React + Node.js"
                  │
                  ├─ [L1→L2] 整合到 L2（重点！）
                  │  knowledge-summary.md: "技术栈：TypeScript + React..."
                  │  profile-summary.md: "全栈开发者，偏好 TypeScript..."
                  │
                  └─ [Index] 向量化

2026-01-30 09:00  👤 用户搜索 "技术栈"
                  → 返回 L2 摘要: "TypeScript + React" ✅

                  ↓

2026-01-31 00:00  🌙 Daily Task 再次运行
                  ├─ [L0→L1] 提取 2026-01-30 的对话
                  │  decisions.md: "添加了 Docker 支持"
                  │
                  ├─ [L1→L2] 整合到 L2
                  │  knowledge-summary.md: 更新为 "TypeScript + React + Docker"
                  │
                  └─ [Index] 向量化

2026-01-31 09:00  👤 用户搜索 "技术栈"
                  → 返回更新的信息: "TypeScript + React + Docker" ✅

                  ↓

2026-02-06 00:00  📅 Weekly Task 运行
                  └─ [Deep Consolidation] 使用 opus 重新整合
                     knowledge-summary.md: 更高质量、更结构化的摘要

                  ↓

2026-02-29 00:00  🗄️ Monthly Task 运行
                  └─ [Archive] 归档旧内容
                     daily/2026-01-20.md → archive/daily/2026-01-20.md
```

---

## 🔄 对比总结

| 操作            | 旧设计     | 新设计     | 改进             |
| --------------- | ---------- | ---------- | ---------------- |
| **L0 → L1**     | Daily ✅   | Daily ✅   | 保持             |
| **L1 → L2**     | Weekly ❌  | Daily ✅   | ✅ **7天 → 1天** |
| **深度优化**    | 无         | Weekly ✅  | ✅ 新增          |
| **归档**        | Monthly ✅ | Monthly ✅ | 保持             |
| **L2 更新频率** | 7 天       | 1 天       | ✅ **快 7 倍！** |

---

## 💡 核心思想

**就像人类记忆一样**：

- 🌙 **每天晚上**：整理短期记忆 → 长期记忆（海马体 → 新皮层）
- 📅 **每周周末**：深度反思和优化
- 🗄️ **每月月末**：清理和归档

而不是：

- ❌ 一周才整理一次记忆
- ❌ 一个月才清理一次

---

## 🚀 使用建议

### 生产环境配置

```typescript
const scheduler = new LifecycleScheduler({
  storagePath: '~/.ai_memory',

  // Daily: 每天运行（核心功能）
  dailyInterval: 24 * 60 * 60 * 1000, // 24 小时
  extractionModel: 'haiku', // L0→L1 快速提取
  consolidationModel: 'sonnet', // L1→L2 平衡质量和速度

  // Weekly: 深度优化（可选）
  weeklyInterval: 7 * 24 * 60 * 60 * 1000, // 7 天

  // Monthly: 归档
  monthlyInterval: 30 * 24 * 60 * 60 * 1000, // 30 天

  indexingPipeline: pipeline, // 自动向量化
})

scheduler.start()
```

### 开发/测试配置（快速验证）

```typescript
const scheduler = new LifecycleScheduler({
  storagePath: '~/.ai_memory_test',

  // 快速测试：1 分钟运行一次
  dailyInterval: 60 * 1000,
  weeklyInterval: 5 * 60 * 1000,
  monthlyInterval: 10 * 60 * 1000,
})
```

---

## ✅ 验收标准

- ✅ Daily Task 包含 L0 → L1 和 L1 → L2
- ✅ L2 摘要每天更新（而不是 7 天）
- ✅ 用户今天聊天，明天就能在 L2 中看到
- ✅ Weekly Task 是可选的"深度优化"
- ✅ Monthly Task 负责归档
- ✅ 符合人类记忆规律

---

**总结**：Daily Task 现在是"一站式"记忆整理，就像人类每天睡觉时的记忆整合！🎉
