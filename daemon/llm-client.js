// daemon/llm-client.js — 真正的 LLM 流式客户端 (无 SDK)
// 直接 fetch + ReadableStream 解析各家 SSE 格式
// 支持: OpenAI / Anthropic / Gemini (国内外) + Ollama (本地) + 任何 OpenAI 兼容
//
// v4.0: 取代 W3 的 stub LLM chat. 流式 SSE parser 手写 (Server-Sent Events)

import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

// ──── API Key 加密 (本机安全存储) ───────────────────────────────
// 用 Node.js crypto + OS 特征派生 AES-256-GCM 密钥
// 加密后格式: base64(iv:ciphertext:authTag) — 完整密文
import { existsSync, readFileSync, writeFileSync, mkdirSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { getConfigDir } from './config.js';

// 派生密钥: 用用户名+机器名做 HKDF-like 拉伸
let _derivedKey = null;
function getDerivedKey() {
  if (_derivedKey) return _derivedKey;
  const userInfo = `${process.env.USERNAME || 'user'}-${process.env.COMPUTERNAME || 'host'}-webpilot-v4`;
  _derivedKey = createHash('sha256').update(userInfo).digest(); // 32 bytes
  return _derivedKey;
}

// 标记: 加密字段的前缀 (明文改密文时写这个标记,用于迁移检测)
const ENCRYPTED_PREFIX = '__wp_enc:';
// 标记: 空/null key
const EMPTY_MARKER = '__wp_empty__';

function encryptApiKey(plain) {
  if (!plain) return EMPTY_MARKER;
  const iv = randomBytes(12); // 96-bit IV for GCM
  const key = getDerivedKey();
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return ENCRYPTED_PREFIX + Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decryptApiKey(encrypted) {
  if (!encrypted) return '';
  if (encrypted === EMPTY_MARKER) return '';
  if (!encrypted.startsWith(ENCRYPTED_PREFIX)) {
    // 旧明文 — 直接返回 (向后兼容)
    return encrypted;
  }
  try {
    const data = Buffer.from(encrypted.slice(ENCRYPTED_PREFIX.length), 'base64');
    const iv = data.slice(0, 12);
    const authTag = data.slice(12, 28);
    const ciphertext = data.slice(28);
    const key = getDerivedKey();
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  } catch {
    return ''; // 解密失败返回空(会触发重新输入 key)
  }
}

// ──── 配置加载: 从 ~/.webpilot/llm-providers.json 读 ────────────
// 格式: { activeId: "openai-international", providers: [{ id, name, baseUrl, apiKey, model, type }] }
// apiKey 在文件里是加密存储的,loadLLMConfig 返回解密后明文供内存使用

function configFile() { return path.join(getConfigDir(), 'llm-providers.json'); }

let _config = null;
export function loadLLMConfig() {
  if (_config) return _config;
  try {
    const p = configFile();
    if (existsSync(p)) {
      const raw = JSON.parse(readFileSync(p, 'utf8'));
      // 解密所有 provider 的 apiKey (向后兼容明文)
      _config = {
        ...raw,
        providers: (raw.providers || []).map((prov) => ({
          ...prov,
          apiKey: decryptApiKey(prov._encryptedKey || prov.apiKey),
          _encryptedKey: prov._encryptedKey || prov.apiKey, // 保留密文用于保存
        })),
      };
    } else {
      _config = { activeId: null, providers: [] };
    }
  } catch { _config = { activeId: null, providers: [] }; }
  return _config;
}

export function saveLLMConfig(cfg) {
  _config = cfg;
  try { mkdirSync(getConfigDir(), { recursive: true }); } catch {}
  // 写文件时: apiKey 字段为空字符串(不在磁盘留明文),_encryptedKey 存密文
  const toSave = {
    ...cfg,
    providers: (cfg.providers || []).map((prov) => {
      const plain = prov.apiKey || '';
      const encrypted = plain ? encryptApiKey(plain) : encryptApiKey('');
      return { ...prov, apiKey: '', _encryptedKey: encrypted };
    }),
  };
  writeFileSync(configFile(), JSON.stringify(toSave, null, 2));
}
export function getActiveProvider() {
  const cfg = loadLLMConfig();
  return cfg.providers.find((p) => p.id === cfg.activeId) || cfg.providers[0] || null;
}
export function listProviders() {
  return loadLLMConfig().providers;
}

// ──── 流式 chat 主接口 ─────────────────────────────────────────
// 返回 async iterable: { content?, toolCall?, done? }
// 调用方 for await 逐 chunk 渲染

export async function* streamChat({ messages, tools = [], onActivity }) {
  const provider = getActiveProvider();
  if (!provider) throw new Error('未配置 LLM provider. 去设置 -> 💬 LLM API 添加 key.');
  if (!provider.apiKey) throw new Error(`provider "${provider.name}" 缺 apiKey. 去设置填.`);

  // 工具 schema 转换 (WebPilot format → 各家格式)
  const toolsPayload = provider.type === 'anthropic'
    ? tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }))
    : provider.type === 'gemini'
      ? { functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }
      : tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));

  let res;
  if (provider.type === 'anthropic') {
    res = await fetch(provider.baseUrl + '/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: provider.maxTokens || 4096,
        messages: messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content })),
        system: messages.find((m) => m.role === 'system')?.content,
        tools: toolsPayload.length ? toolsPayload : undefined,
        stream: true,
      }),
    });
  } else if (provider.type === 'gemini') {
    const url = `${provider.baseUrl}/models/${provider.model}:streamGenerateContent?alt=sse&key=${provider.apiKey}`;
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        systemInstruction: messages.find((m) => m.role === 'system') ? { parts: [{ text: messages.find((m) => m.role === 'system').content }] } : undefined,
        tools: toolsPayload.length ? { functionDeclarations: toolsPayload.functionDeclarations } : undefined,
      }),
    });
  } else {
    // OpenAI 兼容 (包括 DeepSeek / Kimi / MiniMax / Ollama)
    res = await fetch(provider.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        tools: toolsPayload.length ? toolsPayload : undefined,
        stream: true,
        temperature: provider.temperature ?? 0.7,
      }),
    });
  }

  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch {}
    throw new Error(`LLM ${res.status}: ${body.slice(0, 200)}`);
  }
  if (!res.body) throw new Error('LLM 返回无 body');

  // SSE parser (各家略不同 — 用 type 做分发)
  let buffer = '';
  let pendingToolCalls = [];   // 累积待发到 UI 的 tool_call

  for await (const rawLine of sseLines(res.body)) {
    const line = rawLine.startsWith('data:') ? rawLine.slice(5).trim() : rawLine.trim();
    if (!line || line === '[DONE]') continue;
    let json;
    try { json = JSON.parse(line); } catch { continue; }

    if (provider.type === 'anthropic') {
      // event: message_start / content_block_start / content_block_delta / content_block_stop / message_delta / message_stop
      const type = json.type;
      if (type === 'content_block_delta' && json.delta?.type === 'text_delta') {
        yield { content: json.delta.text };
      } else if (type === 'content_block_start' && json.content_block?.type === 'tool_use') {
        pendingToolCalls.push({ id: json.content_block.id, name: json.content_block.name, args: '', rawInput: json.content_block.input || {} });
      } else if (type === 'content_block_delta' && json.delta?.type === 'input_json_delta') {
        const tc = pendingToolCalls[pendingToolCalls.length - 1];
        if (tc) tc.args = (tc.args || '') + json.delta.partial_json;
      } else if (type === 'content_block_stop') {
        const tc = pendingToolCalls[pendingToolCalls.length - 1];
        if (tc && tc.args && tc.args.startsWith('{')) {
          try { tc.args = JSON.parse(tc.args); } catch {}
          yield { toolCall: { id: tc.id, name: tc.name, args: tc.args } };
          pendingToolCalls.pop();
        }
      } else if (type === 'message_stop') {
        yield { done: true };
        return;
      }
    } else if (provider.type === 'gemini') {
      // { candidates: [{ content: { parts: [{ text }] } }] }
      const parts = json.candidates?.[0]?.content?.parts || [];
      for (const p of parts) {
        if (p.text) yield { content: p.text };
        if (p.functionCall) {
          yield { toolCall: { name: p.functionCall.name, args: p.functionCall.args || {} } };
        }
      }
    } else {
      // OpenAI 兼容: choices[].delta.content / .tool_calls
      const delta = json.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.content) yield { content: delta.content };
      if (delta.tool_calls) {
        for (const t of delta.tool_calls) {
          // Streamed tool_calls — 累积
          if (!pendingToolCalls[t.index]) pendingToolCalls[t.index] = { id: t.id, name: '', args: '' };
          const cur = pendingToolCalls[t.index];
          if (t.id) cur.id = t.id;
          if (t.function?.name) cur.name = t.function.name;
          if (t.function?.arguments) cur.args = (cur.args || '') + t.function.arguments;
        }
      }
      if (json.choices?.[0]?.finish_reason === 'tool_calls') {
        for (const t of pendingToolCalls) {
          let args = {};
          try { args = t.args ? JSON.parse(t.args) : {}; } catch {}
          yield { toolCall: { id: t.id, name: t.name, args } };
        }
        pendingToolCalls = [];
      }
      if (json.choices?.[0]?.finish_reason === 'stop' && !pendingToolCalls.length) {
        yield { done: true };
        return;
      }
    }
  }
  yield { done: true };
}

// ──── SSE line stream (for await) ──────────────────────────────
async function* sseLines(readable) {
  const reader = readable.getReader();
  const decoder = new TextDecoder('utf-8');
  let leftover = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      leftover += decoder.decode(value, { stream: true });
      // Anthropic / OpenAI SSE 分隔是 \r?\n\r?\n  (event 之间)
      // Gemini 也是
      let idx;
      while ((idx = leftover.indexOf('\n\n')) !== -1 || (idx = leftover.indexOf('\r\n\r\n')) !== -1) {
        const sep = leftover.startsWith('\r\n\r\n', idx) ? 4 : 2;
        const block = leftover.slice(0, idx);
        leftover = leftover.slice(idx + sep);
        // 一个 event 含多行 (event: ... + data: ...)
        for (const ln of block.split(/\r?\n/)) {
          if (ln.startsWith('data:') || ln) yield ln;
        }
      }
    }
    if (leftover) for (const ln of leftover.split(/\r?\n/)) yield ln;
  } finally { reader.releaseLock(); }
}

// ──── 执行单个工具调用 (给 LLM 调) ──────────────────────────
export async function executeToolCall(toolName, toolArgs) {
  const mod = await import('../lib/tool-loader.js');
  try {
    const fn = mod.callTool;   // (name, args) => result
    return { ok: true, result: await fn(toolName, toolArgs || {}) };
  } catch (e) { return { ok: false, error: e.message }; }
}
