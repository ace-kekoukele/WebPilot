// scripts/build-app-icon.mjs — 把 build/icon.svg 渲染成 Windows/macOS 应用图标
// 输出: build/icon.png (512), build/icon-*.png (16/32/48/64/128/256/512), build/icon.ico (多分辨率)
//
// 用法: node scripts/build-app-icon.mjs
//
// 依赖: sharp (PNG) + png-to-ico (ICO)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, '..', 'build');
const svgPath = join(buildDir, 'icon.svg');

const svgBuf = readFileSync(svgPath);
const SIZES = [16, 32, 48, 64, 128, 256, 512];
const ICO_SIZES = [16, 32, 48, 64, 128, 256];

async function main() {
  // PNG 各分辨率 (electron-builder + 文档用)
  for (const size of SIZES) {
    const out = join(buildDir, `icon-${size}.png`);
    await sharp(svgBuf).resize(size, size, { fit: 'contain', background: { r: 250, g: 250, b: 249, alpha: 1 } }).png().toFile(out);
    console.log(`  ✓ icon-${size}.png`);
  }
  // 主 PNG 512
  const mainPng = join(buildDir, 'icon.png');
  await sharp(svgBuf).resize(512, 512, { fit: 'contain', background: { r: 250, g: 250, b: 249, alpha: 1 } }).png().toFile(mainPng);
  console.log('  ✓ icon.png (512)');

  // ICO (Windows .exe + 任务栏) — 多分辨率 16+32+48+64+128+256
  const pngBuffers = await Promise.all(
    ICO_SIZES.map((size) =>
      sharp(svgBuf)
        .resize(size, size, { fit: 'contain', background: { r: 250, g: 250, b: 249, alpha: 1 } })
        .png()
        .toBuffer()
    )
  );
  const icoBuf = await pngToIco(pngBuffers);
  const icoOut = join(buildDir, 'icon.ico');
  writeFileSync(icoOut, icoBuf);
  console.log(`  ✓ icon.ico (${ICO_SIZES.join('+')}, ${icoBuf.length}B)`);

  console.log('\n应用图标生成完成 ✓');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});