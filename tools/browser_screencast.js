// tools/browser_screencast.js — 页面录屏（v4.0.4 修复版）
import { sendPageCommand } from '../lib/cdp/index.js';
import { on, off } from '../lib/cdp/transport.js';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

let _running = false;
let _outputDir = null;
let _frameCount = 0;
let _activeHandlers = []; // { event, handler }

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export const name = 'browser_screencast';
export const description = '页面录屏: 启动/停止/状态 (v4.0.4 修复版)';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  action: { type: 'string', description: 'start/stop/status' },
  outputDir: { type: 'string', description: '输出目录' },
  format: { type: 'string', description: 'jpeg/png（默认 jpeg）' },
  quality: { type: 'number', description: '质量 0-100（默认 80）' },
  everyNthFrame: { type: 'number', description: '每 N 帧取 1（默认 1）' },
};

export async function execute(args) {
  try {
    if (args.action === 'start') {
      if (!args.targetId) return { ok: false, error: 'targetId required' };
      if (!args.outputDir) return { ok: false, error: 'outputDir required' };

      ensureDir(args.outputDir);
      _outputDir = args.outputDir;
      _frameCount = 0;
      _running = true;

      await sendPageCommand(args.targetId, 'Page.enable', {}, 3000).catch(() => {});

      // 注册帧处理函数
      const frameHandler = (params) => {
        if (!_running) return;
        const { data, metadata } = params;
        if (!data) return;

        // 解码 base64 帧数据并写入文件
        const buffer = Buffer.from(data, 'base64');
        const ext = args.format || 'jpeg';
        const filename = `frame_${String(_frameCount).padStart(6, '0')}.${ext}`;
        const filepath = path.join(_outputDir, filename);
        writeFileSync(filepath, buffer);

        // 记录 metadata
        if (metadata) {
          const metaFile = path.join(_outputDir, 'frames-meta.jsonl');
          const line = JSON.stringify({ filename, ...metadata }) + '\n';
          writeFileSync(metaFile, line, { flag: existsSync(metaFile) ? 'a' : 'w' });
        }
        _frameCount++;
      };

      on('Page.screencastFrame', frameHandler);
      _activeHandlers.push({ event: 'Page.screencastFrame', handler: frameHandler });

      await sendPageCommand(args.targetId, 'Page.startScreencast', {
        format: args.format || 'jpeg',
        quality: args.quality || 80,
        everyNthFrame: args.everyNthFrame || 1,
        maxWidth: 1920,
        maxHeight: 1080,
      }, 5000);

      return { ok: true, outputDir: _outputDir, format: args.format || 'jpeg', listening: true };
    }

    if (args.action === 'stop') {
      if (!args.targetId) return { ok: false, error: 'targetId required' };

      _running = false;

      for (const { event, handler } of _activeHandlers) {
        off(event, handler);
      }
      _activeHandlers = [];

      await sendPageCommand(args.targetId, 'Page.stopScreencast', {}, 5000).catch(() => {});

      const fc = _frameCount;
      const dir = _outputDir;
      _frameCount = 0;
      _outputDir = null;

      return { ok: true, frameCount: fc, outputDir: dir };
    }

    if (args.action === 'status') {
      return { ok: true, running: _running, frameCount: _frameCount, outputDir: _outputDir };
    }

    return { ok: false, error: 'action: start/stop/status' };
  } catch (err) {
    _running = false;
    return { ok: false, error: err.message };
  }
}
