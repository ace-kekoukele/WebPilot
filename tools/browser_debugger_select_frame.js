// tools/browser_debugger_select_frame.js
// 在调试器中切换当前帧（frame），用于调试 iframe 内代码
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_debugger_select_frame';
export const description = '切换调试器当前帧，用于调试 iframe / 子 frame 中的代码';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  frameId: { type: 'string', description: '目标 frame.id（从 Page.frameNavigated 事件或 Page.getFrameTree 获取）' },
  maxDepth: { type: 'number', description: 'AsyncCallStack 最大深度，默认 4' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };

    // 设置 async call stack 深度
    const depth = args.maxDepth ?? 4;
    const depthResult = await sendPageCommand(args.targetId, 'Debugger.setAsyncCallStackDepth', {
      maxDepth: depth,
    }, 3000);

    // 如果指定了 frameId，获取 frame tree 并定位指定 frame
    let frameInfo = null;
    if (args.frameId) {
      const frameTree = await sendPageCommand(args.targetId, 'Page.getFrameTree', {}, 5000);
      // 递归查找目标 frame
      const findFrame = (node) => {
        if (node.frame?.id === args.frameId) return node.frame;
        for (const child of node.childFrames || []) {
          const found = findFrame(child);
          if (found) return found;
        }
        return null;
      };
      frameInfo = findFrame(frameTree.frameTree);
      if (!frameInfo) {
        return { ok: false, error: `frame not found: ${args.frameId}`, availableFrames: _listAllFrames(frameTree.frameTree) };
      }
    }

    return {
      ok: true,
      asyncCallStackDepth: depth,
      selectedFrame: frameInfo || null,
      frameId: args.frameId || null,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// 递归列出所有 frame
function _listAllFrames(node, result = []) {
  result.push({ id: node.frame?.id, url: node.frame?.url, name: node.frame?.name });
  for (const child of node.childFrames || []) {
    _listAllFrames(child, result);
  }
  return result;
}