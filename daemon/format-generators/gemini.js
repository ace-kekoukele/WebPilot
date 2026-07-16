// daemon/format-generators/gemini.js — Gemini function declarations 格式
//
// 输出: [{functionDeclarations: [{name, description, parameters: <Schema>}]}]
// 给 Google Gemini API (GenerativeLanguage / Vertex) 用
export function generate(tools) {
  const functionDeclarations = tools.map((t) => {
    const properties = {};
    const required = [];
    for (const [k, v] of Object.entries(t.parameters || {})) {
      const p = {};
      if (v.type === 'string') p.type = 'STRING';
      else if (v.type === 'number') p.type = 'NUMBER';
      else if (v.type === 'boolean') p.type = 'BOOLEAN';
      else if (v.type === 'array') { p.type = 'ARRAY'; p.items = { type: 'STRING' }; }
      else if (v.type === 'object') p.type = 'OBJECT';
      else p.type = 'STRING';
      if (v.enum) {
        p.type = 'STRING';
        p.enum = v.enum;
      }
      if (v.description) p.description = v.description;
      properties[k] = p;
      if (v.required) required.push(k);
    }
    const parameters = { type: 'OBJECT', properties };
    if (required.length > 0) parameters.required = required;
    return {
      name: t.name,
      description: t.description,
      parameters,
    };
  });
  // Gemini expects {functionDeclarations: [...]}, but sometimes a flat array — return object form
  return { functionDeclarations };
}
