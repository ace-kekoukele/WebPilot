// daemon/format-generators/openapi.js — OpenAPI 3.0 规范
//
// 给任何 REST 客户端 / Postman / Insomnia / Swagger UI / 其他 HTTP 工具用
// `GET /api/openapi.json` (from http-api.js) 返回这个
export const OPENAPI_VERSION = '3.0.3';

export function generate(tools, options = {}) {
  const {
    title = 'WebPilot API',
    description = '通用 Chrome DevTools Protocol 桥。78 工具覆盖页面操控、网络、JS 调试、堆、WebSocket。',
    version = '4.0.0',
    servers = [{ url: 'http://127.0.0.1:9224', description: '默认 HTTP REST API' }],
  } = options;

  return {
    openapi: OPENAPI_VERSION,
    info: { title, description, version },
    servers,
    paths: {
      '/api/health': {
        get: {
          operationId: 'health',
          summary: '健康检查',
          tags: ['meta'],
          responses: { '200': { description: 'ok' } },
        },
      },
      '/api/tools/list': {
        get: {
          operationId: 'toolsList',
          summary: '列出所有工具',
          tags: ['meta'],
          responses: { '200': { description: '工具列表' } },
        },
      },
      '/api/tools/call': {
        post: {
          operationId: 'toolCall',
          summary: '调用工具',
          tags: ['meta'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ToolCallRequest' },
              },
            },
          },
          responses: { '200': { description: '结果' }, '400': { description: '参数错' } },
        },
      },
      '/api/cdp/send': {
        post: {
          operationId: 'cdpSend',
          summary: '直接发送 CDP 命令',
          tags: ['cdp'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CdpSendRequest' },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        ToolCallRequest: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', description: '工具名' },
            args: { type: 'object', description: '工具入参对象' },
          },
        },
        CdpSendRequest: {
          type: 'object',
          required: ['method'],
          properties: {
            method: { type: 'string', description: 'CDP method, e.g. Page.navigate' },
            params: { type: 'object', description: 'CDP params' },
            targetId: { type: 'string', description: 'tab targetId (browser-level 不用填)' },
          },
        },
      },
    },
    tags: tools.length > 0 ? [{ name: 'tools', description: `${tools.length} tools via /api/cdp/send` }] : [],
  };
}
