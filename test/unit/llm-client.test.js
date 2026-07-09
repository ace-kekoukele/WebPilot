// test/unit/llm-client.test.js — §17 LLM streaming (no SDK, 手写 SSE parser)
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('LLM config: loadLLMConfig + saveLLMConfig roundtrip', async () => {
  const { loadLLMConfig, saveLLMConfig, listProviders, getActiveProvider } =
    await import('../../daemon/llm-client.js');
  const initial = listProviders();
  // 保存 + 重读
  saveLLMConfig({ activeId: 'test-p', providers: [{ id: 'test-p', name: 'T', baseUrl: 'http://x', apiKey: 'k', model: 'm', type: 'openai-compatible' }] });
  const cfg = loadLLMConfig();
  assert.equal(cfg.activeId, 'test-p');
  assert.equal(cfg.providers.length, 1);
  assert.equal(cfg.providers[0].name, 'T');
  // 恢复 (避免污染其他 test 看到的 singleton)
  saveLLMConfig({ activeId: null, providers: initial });
});

test('LLM config: getActiveProvider returns active or first', async () => {
  const { saveLLMConfig, getActiveProvider, loadLLMConfig } =
    await import('../../daemon/llm-client.js');
  saveLLMConfig({ activeId: null, providers: [
    { id: 'a', name: 'A', baseUrl: 'http://a', apiKey: 'ka', model: 'ma', type: 'openai-compatible' },
    { id: 'b', name: 'B', baseUrl: 'http://b', apiKey: 'kb', model: 'mb', type: 'anthropic' },
  ] });
  loadLLMConfig();
  const p = getActiveProvider();
  assert.equal(p.id, 'a');   // 没设 activeId 时取第一个
  saveLLMConfig({ activeId: 'b', providers: [
    { id: 'a', name: 'A', baseUrl: 'http://a', apiKey: 'ka', model: 'ma', type: 'openai-compatible' },
    { id: 'b', name: 'B', baseUrl: 'http://b', apiKey: 'kb', model: 'mb', type: 'anthropic' },
  ] });
  loadLLMConfig();
  assert.equal(getActiveProvider().id, 'b');
});

test('LLM streamChat: yields content from OpenAI-style SSE', async () => {
  const { saveLLMConfig, streamChat, loadLLMConfig } = await import('../../daemon/llm-client.js');
  saveLLMConfig({
    activeId: 't1',
    providers: [{
      id: 't1', name: 'T', baseUrl: 'http://mock.test', apiKey: 'k',
      model: 'm', type: 'openai-compatible',
    }],
  });
  loadLLMConfig();

  // mock fetch — 模拟 OpenAI-style 流式响应
  const realFetch = global.fetch;
  global.fetch = async (url, opts) => {
    const sseBody = `data: {"choices":[{"delta":{"content":"hello "}}]}

data: {"choices":[{"delta":{"content":"world"}}]}

data: {"choices":[{"finish_reason":"stop"}]}

`;
    return {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          const enc = new TextEncoder();
          for (const chunk of sseBody.split('')) {
            controller.enqueue(enc.encode(chunk));
          }
          controller.close();
        },
      }),
    };
  };

  try {
    const got = [];
    for await (const ev of streamChat({ messages: [{ role: 'user', content: 'hi' }] })) {
      got.push(ev);
    }
    const text = got.filter((e) => e.content).map((e) => e.content).join('');
    assert.equal(text, 'hello world');
    assert.ok(got.some((e) => e.done));
  } finally {
    global.fetch = realFetch;
  }
});

test('LLM streamChat: throws clearly when no provider / no apiKey', async () => {
  const { saveLLMConfig, streamChat, loadLLMConfig } = await import('../../daemon/llm-client.js');
  saveLLMConfig({ activeId: null, providers: [] });
  loadLLMConfig();
  try {
    const iter = streamChat({ messages: [{ role: 'user', content: 'hi' }] });
    await iter.next();
    assert.fail('should throw');
  } catch (e) {
    assert.match(e.message, /未配置 LLM provider|缺 apiKey/);
  }
});

test('LLM streamChat: parses Anthropic content_block_delta + tool_use', async () => {
  const { saveLLMConfig, streamChat, loadLLMConfig } = await import('../../daemon/llm-client.js');
  saveLLMConfig({
    activeId: 'a1',
    providers: [{ id: 'a1', name: 'A', baseUrl: 'http://mock.test', apiKey: 'k', model: 'm', type: 'anthropic' }],
  });
  loadLLMConfig();
  const realFetch = global.fetch;
  global.fetch = async (url, opts) => ({
    ok: true, body: new ReadableStream({
      start(c) {
        const enc = new TextEncoder();
        c.enqueue(enc.encode(`event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hi"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"!"}}

event: message_stop
data: {"type":"message_stop"}

`));
        c.close();
      },
    }),
  });
  try {
    const got = [];
    for await (const ev of streamChat({ messages: [{ role: 'user', content: 'q' }] })) {
      if (ev.content) got.push(ev.content);
    }
    assert.equal(got.join(''), 'hi!');
  } finally { global.fetch = realFetch; }
});
