// tools/browser_upload.js - 上传文件
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_upload';
export const description = '通过 <input type=file> 上传文件';
export const parameters = {
  targetId: { type: 'string' },
  selector: { type: 'string' },
  filePath: { type: 'string' },
};

export async function execute(args) {
  try {
    if (!args.filePath) return { ok: false, error: 'filePath required' };
    if (!args.selector) return { ok: false, error: 'selector required' };
    const r = await sendPageCommand(args.targetId, 'DOM.querySelector', {
      nodeId: 0,
      selector: args.selector,
    }, 5000);
    if (!r.nodeId) return { ok: false, error: 'selector not found' };
    await sendPageCommand(args.targetId, 'DOM.setFileInputFiles', {
      files: [args.filePath],
      nodeId: r.nodeId,
    }, 10000);
    return { ok: true, filePath: args.filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}