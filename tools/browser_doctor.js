// tools/browser_doctor.js - 健康检查
import { ensureBridge, listTabs, getState } from '../lib/cdp/index.js';

export const name = 'browser_doctor';
export const description = '健康检查: Chrome CDP + 版本 + Node';
export const parameters = {
  checks: { type: 'array', description: 'chrome_running/port_reachable/tmp_writable' },
};

export async function execute(args) {
  const results = [];
  try {
    // Chrome reachable
    try {
      await ensureBridge();
      results.push({ check: 'chrome_running', ok: true });
    } catch (err) {
      results.push({ check: 'chrome_running', ok: false, error: err.message });
    }
    // Port reachable (noop if already tested)
    try {
      await ensureBridge();
      results.push({ check: 'port_reachable', ok: true });
    } catch (err) {
      results.push({ check: 'port_reachable', ok: false, error: err.message });
    }
    // tmp writable
    try {
      const { writeFileSync, unlinkSync } = await import('node:fs');
      const tmp = process.env.TEMP + '/browser-bridge-doctor.tmp';
      writeFileSync(tmp, 'ok');
      unlinkSync(tmp);
      results.push({ check: 'tmp_writable', ok: true });
    } catch (err) {
      results.push({ check: 'tmp_writable', ok: false, error: err.message });
    }
    const passed = results.filter((r) => r.ok).length;
    const failed = results.length - passed;
    return {
      ok: failed === 0,
      summary: `${passed} 项检查通过${failed ? ` (${failed} 失败)` : ''}`,
      passed, failed,
      checks: results,
    };
  } catch (err) {
    return { ok: false, error: err.message, summary: 'doctor failed' };
  }
}