// daemon/format-generators/openai.js — OpenAI function calling 格式
//
// 输出: [{type:'function',function:{name,description,parameters:'strict JSON Schema'}}]
// 给 GPT custom GPTs / Assistants API / 任何 OpenAI-compatible API 用
//
// v4.0: 这是覆盖最广的格式 (DeepSeek / Kimi / Qwen / 智谱 / Ollama 都用这个)

export function generate(tools) {
  return tools.map((t) => {
    // tools 内 properties 字段是 {type, description, required, enum}
    const parameters = {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    };
    for (const [k, v] of Object.entries(t.parameters || {})) {
      const prop = {};
      if (v.type === 'string') prop.type = 'string';
      else if (v.type === 'number') prop.type = 'number';
      else if (v.type === 'boolean') prop.type = 'boolean';
      else if (v.type === 'array') prop.type = 'array';
      else if (v.type === 'object') prop.type = 'object';
      else prop.type = 'string';
      if (v.enum) {
        prop.type = 'string';
        prop.enum = v.enum;
      }
      if (v.description) prop.description = v.description;
      parameters.properties[k] = prop;
      if (v.required) parameters.required.push(k);
    }
    if (parameters.required.length === 0) {
      // OpenAI 不允许空 required 数组, 移除这个字段
      delete parameters.required;
    }
    return {
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters,
      },
    };
  });
}
