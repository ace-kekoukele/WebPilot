// tools/browser_animation.js - 动画控制 (Chrome 150 Animation 域)
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_animation';
export const description = 'CSS 动画控制: 播放/暂停/速度/查询';
export const parameters = {
  targetId: { type: 'string' },
  action: { type: 'string', description: 'list/play/pause/setSpeed' },
  animationId: { type: 'string', description: 'animation ID (从 list 拿)' },
  speed: { type: 'number', description: '播放速度倍率 (0.5 = 半速, 2 = 双倍)' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    if (!args.action) return { ok: false, error: 'action required (list/play/pause/setSpeed)' };

    await sendPageCommand(args.targetId, 'Animation.enable', {}, 3000).catch(() => {});

    if (args.action === 'list') {
      // 查询当前页面所有活跃动画
      const r = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
        expression: `(() => {
          const all = document.getAnimations ? document.getAnimations() : [];
          return all.map(a => ({
            id: String(a.id || a.playbackRate || Math.random()),
            name: a.animationName || (a.effect && a.effect.target && a.effect.target.tagName) || 'unknown',
            state: a.playState,
            currentTime: a.currentTime,
            duration: a.effect && a.effect.getTiming ? a.effect.getTiming().duration : null,
          }));
        })()`,
        returnByValue: true,
      }, 5000);
      return { ok: true, animations: r.result.value, count: r.result.value.length };
    }

    if (args.action === 'play' || args.action === 'pause') {
      const r = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
        expression: `(() => {
          const all = document.getAnimations ? document.getAnimations() : [];
          all.forEach(a => a.${args.action}());
          return all.length;
        })()`,
        returnByValue: true,
      }, 5000);
      return { ok: true, action: args.action, count: r.result.value };
    }

    if (args.action === 'setSpeed') {
      const speed = parseFloat(args.speed) || 1;
      const r = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
        expression: `(() => {
          const all = document.getAnimations ? document.getAnimations() : [];
          all.forEach(a => a.playbackRate = ${speed});
          return all.length;
        })()`,
        returnByValue: true,
      }, 5000);
      return { ok: true, speed, appliedTo: r.result.value };
    }

    return { ok: false, error: `unknown action: ${args.action}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}