// daemon/format-generators/anthropic.js — Anthropic tools 格式
//
// 输出: [{name, description, input_schema: <JSON Schema>}]
// 给 Claude API 直连 / Anthropic SDK / claude-cli 用
export function generate(tools) {
  return tools.map((t) => {
    const props = {};
    const required = [];
    for (const [k, v] of Object.entries(t.parameters || {})) {
      const p = {};
      if (v.type === 'string') p.type = 'string';
      else if (v.type === 'number') p.type = 'number';
      else if (v.type === 'boolean') p.type = 'boolean';
      else if (v.type === 'array') p.type = 'array';
      else if (v.type === 'object') p.type = 'object';
      else p.type = 'string';
      if (v.enum) {
        p.type = 'string';
        p.enum = v.enum;
      }
      if (v.description) p.description = v.description;
      props[k] = p;
      if (v.required) required.push(k);
    }
    const input_schema = { type: 'object', properties: props };
    if (required.length > 0) input_schema.required = required;
    return {
      name: t.name,
      description: t.description,
      input_schema,
    };
  });
}
