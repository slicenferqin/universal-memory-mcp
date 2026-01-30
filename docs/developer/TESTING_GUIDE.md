# 测试指南：配置API Key并运行测试

## 步骤1: 获取API Key

### 选项A: ZhipuAI（智谱AI，国内推荐）

1. 访问 https://open.bigmodel.cn/usercenter/apikeys
2. 登录智谱AI账号
3. 点击 "创建API Key"
4. 复制API key

**费用**：

- embedding-3: 按tokens计费（详见官网）
- embedding-2: 按tokens计费
- 新用户可能有免费额度

### 选项B: Gemini（免费，国际）

1. 访问 https://ai.google.dev/
2. 点击 "Get API Key"
3. 创建新项目或选择现有项目
4. 复制API key

**免费额度**：1500 requests/day

**注意**：在中国大陆可能无法访问，建议使用ZhipuAI

### 选项C: OpenAI（付费，国际）

1. 访问 https://platform.openai.com/api-keys
2. 登录OpenAI账号
3. 点击 "Create new secret key"
4. 复制API key

**费用**：

- text-embedding-3-small: $0.02/1M tokens
- text-embedding-3-large: $0.13/1M tokens

## 步骤2: 配置环境变量

### 临时设置（当前session）

```bash
# 使用ZhipuAI（国内推荐）
export ZHIPUAI_API_KEY="your-api-key-here"

# 或使用Gemini（国际，免费）
export GEMINI_API_KEY="your-api-key-here"

# 或使用OpenAI（付费）
export OPENAI_API_KEY="your-api-key-here"
```

**优先级**：ZhipuAI > Gemini > OpenAI（工厂函数会按此顺序自动选择）

### 永久设置（推荐）

**Mac/Linux** - 添加到 `~/.bashrc` 或 `~/.zshrc`:

```bash
# ZhipuAI（国内）
echo 'export ZHIPUAI_API_KEY="your-api-key-here"' >> ~/.zshrc

# 或 Gemini（国际）
echo 'export GEMINI_API_KEY="your-api-key-here"' >> ~/.zshrc

source ~/.zshrc
```

**Windows** - 在系统环境变量中设置：

1. 搜索"环境变量"
2. 编辑用户变量
3. 新建变量：
   - `ZHIPUAI_API_KEY`（国内）
   - 或 `GEMINI_API_KEY`（国际）

## 步骤3: 验证配置

```bash
# 验证API key已设置
echo $ZHIPUAI_API_KEY  # 国内
# 或
echo $GEMINI_API_KEY   # 国际
# 或
echo $OPENAI_API_KEY   # 付费
```

## 步骤4: 运行测试

### 快速测试（5分钟）

```bash
# 1. 构建项目
cd packages/core && pnpm build

# 2. 测试Embedding Provider
node ../test-embedding.mjs

# 3. 测试VectorStore（需要先索引）
node ../test-vectorstore.mjs
```

### 完整测试（15分钟）

```bash
# 1. 索引你的对话（最近7天）
node test-indexing.mjs

# 2. 测试语义搜索
node test-enhanced-search.mjs

# 3. 运行性能基准测试
node test-benchmark.mjs

# 4. 运行质量测试
node test-recall.mjs
node test-quality.mjs

# 5. 运行集成测试
node test-integration.mjs
```

## 预期结果

### test-embedding.mjs

```
🧪 Testing Gemini Embedding Provider...
✅ Created provider: gemini
   Dimensions: 768

📝 Testing single embedding...
✅ Generated embedding: 768 dimensions
   Sample values: [0.1234, -0.5678, ...]

📝 Testing batch embedding...
✅ Generated 3 embeddings
   Dimensions: 768, 768, 768
```

### test-indexing.mjs

```
📅 Indexing conversations from last 7 days (3 files)
🔄 Processing conversations...
   ✅ Indexed conversation-1 (2 chunks)
   ✅ Indexed conversation-2 (1 chunk)

📊 Updated stats:
   Total documents: 5
   Total chunks: 12
   New chunks: 12
```

### test-benchmark.mjs

```
📊 Test 1: Embedding Generation
   ❌ No cache: 650ms (65.0ms per embedding)
   ✅ With cache (cold): 620ms (62.0ms per embedding)
   🚀 With cache (warm): 8ms (0.8ms per embedding)
   Cache stats: 90.0% hit rate

📊 Test 3: Vector Search Performance
   Semantic search (10 iterations):
   Total: 350ms
   Average: 35.0ms per search
   Throughput: 28.6 searches/second
```

## 故障排除

### 问题1: "API key not found"

**解决方案**：

```bash
# 确认环境变量已设置
echo $GEMINI_API_KEY

# 如果为空，重新设置
export GEMINI_API_KEY="your-key"
```

### 问题2: "No indexed documents found"

**解决方案**：

```bash
# 先运行索引
node test-indexing.mjs

# 检查索引是否成功
node test-vectorstore.mjs
```

### 问题3: API配额用完

**Gemini**: 查看用量 https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/metrics
**OpenAI**: 查看账单 https://platform.openai.com/account/usage

## 下一步

测试通过后，我们可以：

1. ✅ 验证所有功能正常
2. ✅ 检查性能指标
3. ✅ 评估搜索质量
4. 📝 发布v0.4.0
