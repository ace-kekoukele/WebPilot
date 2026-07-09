// tools/browser_security.js - 安全状态查询 (Chrome 150 Security 域)
import { sendPageCommand, sendCommand } from '../lib/cdp/index.js';

export const name = 'browser_security';
export const description = '安全状态查询: HTTPS/证书/不安全内容 (Chrome 150 Security 域)';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  action: { type: 'string', description: 'state/explain/certificate' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    if (!args.action) return { ok: false, error: 'action required (state/explain/certificate)' };

    await sendPageCommand(args.targetId, 'Security.enable', {}, 3000).catch(() => {});

    if (args.action === 'state') {
      const r = await sendPageCommand(args.targetId, 'Security.getSecurityState', {}, 5000);
      return { ok: true, securityState: r, explanation: r.explanations || [] };
    }

    if (args.action === 'explain') {
      // 解释当前安全状态为何如此 (e.g. mixed content, insecure form)
      const r = await sendPageCommand(args.targetId, 'Security.getSecurityState', {}, 5000);
      return {
        ok: true,
        summary: r.summary || r.securityState,
        explanations: r.explanations || [],
      };
    }

    if (args.action === 'certificate') {
      // 浏览器级: 拿 URL 的证书信息
      return { ok: false, error: 'certificate 需要 URL 参数 (TODO: 用 Network.getCertificate)' };
    }

    return { ok: false, error: `unknown action: ${args.action}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}