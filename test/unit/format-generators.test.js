// test/unit/format-generators.test.js — W1 Day 6 multi-format tool spec
import { test } from 'node:test';
import assert from 'node:assert/strict';

const SAMPLE_TOOLS = [
  {
    name: 'browser_navigate',
    description: '导航到 URL',
    parameters: {
      targetId: { type: 'string', description: 'tab id', required: true },
      url: { type: 'string', description: 'URL', required: true },
    },
  },
  {
    name: 'browser_action',
    description: '操作元素 (click/fill/type)',
    parameters: {
      targetId: { type: 'string', required: true },
      action: { type: 'string', enum: ['click', 'fill', 'type'], required: true },
      selector: { type: 'string', required: true },
      value: { type: 'string' },
    },
  },
];

test('OpenAI format converts to function calling shape', async () => {
  const openaiModule = await import('../../daemon/format-generators/openai.js');
  const out = openaiModule.generate(SAMPLE_TOOLS);
  assert.equal(out.length, 2);
  assert.equal(out[0].type, 'function');
  assert.equal(out[0].function.name, 'browser_navigate');
  assert.equal(out[0].function.parameters.type, 'object');
  assert.deepEqual(
    out[0].function.parameters.required,
    ['targetId', 'url'],
  );
  assert.equal(out[0].function.parameters.properties.targetId.type, 'string');
});

test('OpenAI handles empty required (omits field)', async () => {
  const openaiModule = await import('../../daemon/format-generators/openai.js');
  const out = openaiModule.generate([{
    name: 'ping', description: 'ping', parameters: { msg: { type: 'string' } },
  }]);
  assert.equal(out[0].function.parameters.required, undefined);
});

test('Anthropic format uses input_schema', async () => {
  const anthropicModule = await import('../../daemon/format-generators/anthropic.js');
  const out = anthropicModule.generate(SAMPLE_TOOLS);
  assert.equal(out[0].name, 'browser_navigate');
  assert.equal(out[0].input_schema.type, 'object');
  assert.deepEqual(out[0].input_schema.required, ['targetId', 'url']);
});

test('Gemini format wraps in functionDeclarations + uses STRING type', async () => {
  const geminiModule = await import('../../daemon/format-generators/gemini.js');
  const out = geminiModule.generate(SAMPLE_TOOLS);
  assert.ok(out.functionDeclarations);
  assert.equal(out.functionDeclarations.length, 2);
  assert.equal(out.functionDeclarations[0].parameters.properties.targetId.type, 'STRING');
});

test('OpenAPI returns valid spec with 4 paths', async () => {
  const openapiModule = await import('../../daemon/format-generators/openapi.js');
  const spec = openapiModule.generate(SAMPLE_TOOLS, { version: '4.0.0-test' });
  assert.equal(spec.openapi, '3.0.3');
  assert.ok(spec.paths['/api/health']);
  assert.ok(spec.paths['/api/tools/call']);
  assert.ok(spec.paths['/api/cdp/send']);
  assert.ok(spec.paths['/api/tools/list']);
  assert.equal(spec.info.version, '4.0.0-test');
});
