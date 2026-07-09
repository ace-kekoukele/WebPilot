// test/unit/mcp-server-schema.test.js — 测试 paramsToZod 转换 (间接通过 tool 注册)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startHttpApi } from '../../lib/http-api.js';

let server;
let baseUrl;

test('mcp-server: HTTP API 启动后, /api/tools/list 含 inputSchema', async () => {
  server = await startHttpApi({ port: 0, host: '127.0.0.1' });
  baseUrl = `http://127.0.0.1:${server.port}`;
  const r = await fetch(`${baseUrl}/api/tools/list`);
  const body = await r.json();
  // 抽样: browser_storage 应有 inputSchema
  const storage = body.tools.find(t => t.name === 'browser_storage');
  assert.ok(storage, 'browser_storage 存在');
  assert.ok(storage.parameters, 'parameters 字段保留');
  assert.ok(storage.parameters.targetId, 'targetId 参数定义在');
});

test('mcp-server: SDK client 连上后, tool inputSchema 是 zod 转换的真 schema', async () => {
  // 启动一个真 MCP server (而不是 http-api)
  const { startMcpServer } = await import('../../lib/mcp-server.js');
  const mcp = await startMcpServer({ port: 0, host: '127.0.0.1' });
  try {
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${mcp.port}/mcp`));
    const client = new Client({ name: 'test', version: '1' }, { capabilities: {} });
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.ok(tools.length >= 40, `tool count = ${tools.length}`);
    const storage = tools.find(t => t.name === 'browser_storage');
    assert.ok(storage, 'browser_storage 工具存在');
    assert.ok(storage.inputSchema, 'inputSchema 字段');
    assert.equal(storage.inputSchema.type, 'object', 'schema type 是 object');
    assert.ok(storage.inputSchema.properties, '有 properties');
    assert.ok(storage.inputSchema.properties.targetId, 'targetId property 存在');
    await client.close();
  } finally {
    await mcp.close();
  }
  await server.close();
});

test('mcp-server: SDK client 调工具, 缺 targetId → tool 层自己报 ok:false', async () => {
  const { startMcpServer } = await import('../../lib/mcp-server.js');
  const mcp = await startMcpServer({ port: 0, host: '127.0.0.1' });
  // 等 server 真正 listen
  await new Promise(r => setTimeout(r, 100));
  try {
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${mcp.port}/mcp`));
    const client = new Client({ name: 'test', version: '1' }, { capabilities: {} });
    await client.connect(transport);
    const r = await client.callTool({ name: 'browser_navigate', arguments: { url: 'https://example.com' } });
    const txt = r.content?.[0]?.text || '';
    assert.match(txt, /targetId|required/i);
    await client.close();
  } finally {
    await mcp.close();
  }
});