// tools/browser_screencast.js - Page screencast (1.6.0)
import { sendPageCommand, ensureBridge } from '../lib/cdp/index.js';
import { writeFileSync, mkdirSync } from 'node:fs';

let _running = false;
let _outputDir = null;
let _frameCount = 0;

export const name = 'browser_screencast';
export const description = 'Page screencast: start/stop/status';
export const parameters = {
  targetId: { type: 'string' },
  action: { type: 'string', description: 'start/stop/status' },
  outputDir: { type: 'string' },
  format: { type: 'string', description: 'jpeg/png (default jpeg)' },
  everyNthFrame: { type: 'number' },
};

export async function execute(args) {
  try {
    if (args.action === 'start') {
      if (!args.targetId) return { ok: false, error: 'targetId required' };
      if (!args.outputDir) return { ok: false, error: 'outputDir required' };
      mkdirSync(args.outputDir, { recursive: true });
      _outputDir = args.outputDir;
      _frameCount = 0;
      _running = true;
      await sendPageCommand(args.targetId, 'Page.enable', {}, 3000).catch(() => {});
      await sendPageCommand(args.targetId, 'Page.startScreencast', {
        format: args.format || 'jpeg',
        everyNthFrame: args.everyNthFrame || 1,
        quality: 80,
      }, 5000);
      return { ok: true, outputDir: args.outputDir, format: args.format || 'jpeg' };
    }
    if (args.action === 'stop') {
      if (!args.targetId) return { ok: false, error: 'targetId required' };
      await sendPageCommand(args.targetId, 'Page.stopScreencast', {}, 5000).catch(() => {});
      _running = false;
      const fc = _frameCount;
      _frameCount = 0;
      return { ok: true, frameCount: fc, outputDir: _outputDir };
    }
    if (args.action === 'status') {
      return { ok: true, running: _running, frameCount: _frameCount, outputDir: _outputDir };
    }
    return { ok: false, error: 'action: start/stop/status' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export const _screencast_internal = { _running, _frameCount, _outputDir, writeFileSync };