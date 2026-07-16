// daemon/format-generators/presets.js — LLM 厂商预设 loader
// See §17 + presets.json (16 个国内/国外 presets: OpenAI / Anthropic / Gemini
// + DeepSeek / Kimi / 智谱 / Qwen / MiniMax (国内+国外) / Ollama)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let _presets = null;
export function loadPresets() {
  if (_presets) return _presets;
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const file = path.join(dir, 'presets.json');
  try {
    const raw = readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    _presets = (data.presets || []).filter((p) => !p._comment && !p.id.startsWith('_'));
    return _presets;
  } catch (e) {
    return [];
  }
}

export function getPreset(id) {
  return loadPresets().find((p) => p.id === id) || null;
}

export function listPresetsByRegion(region) {
  if (!region) return loadPresets();
  return loadPresets().filter((p) => (p.regions || []).includes(region) || (p.regions || []).includes('*'));
}
