/**
 * Retrieval Module - 记忆召回模块
 *
 * 提供三种召回时机：
 * 1. 会话启动召回（Session Start）
 * 2. 推理前召回（Pre-Inference）
 * 3. 动态召回（Dynamic）
 */

export {
  retrieveOnSessionStart,
  type SessionStartContext,
  type SessionStartOptions,
} from './session-start.js'

// TODO: Phase 2 - 推理前召回
// export { retrieveBeforeInference, type PreInferenceContext } from './pre-inference.js';

// TODO: Phase 3 - 动态召回
// export { retrieveDynamic, type DynamicContext } from './dynamic.js';
