import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const petsDir = path.join(root, "artifacts/api-server/public/pets");
const backupDir = path.join(petsDir, "_card_backups");

function isWhite(r, g, b) { return r > 242 && g > 242 && b > 242; }
function isYellow(r, g, b) { return r > 220 && g > 180 && b < 120; }
function isPageChrome(r, g, b) {
  if (isWhite(r, g, b)) return true;
  if (r > 215 && g > 200 && b > 175 && Math.abs(r - g) < 30 && b < r + 5) return true;
  if (r > 190 && g < 170 && b > 130 && r > g + 40) return true;
  return false;
}

async function loadRaw(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
function idx(w, x, y) { return (y * w + x) * 4; }

function findButtonY(data, w, h) {
  for (let y = h - 5; y >= Math.floor(h * 0.45); y--) {
    let yellow = 0;
    for (let x = Math.floor(w * 0.15); x < Math.floor(w * 0.85); x += 2) {
      const i = idx(w, x, y);
      if (isYellow(data[i], data[i + 1], data[i + 2])) yellow++;
    }
    if (yellow > 25) return y;
  }
  return -1;
}

function findCardX(data, w, sampleY) {
  let left = 0, right = w - 1;
  for (let x = 0; x < w; x++) {
    const i = idx(w, x, sampleY);
    if (isWhite(data[i], data[i + 1], data[i + 2])) { left = x; break; }
  }
  for (let x = w - 1; x >= 0; x--) {
    const i = idx(w, x, sampleY);
    if (isWhite(data[i], data[i + 1], data[i + 2])) { right = x; break; }
  }
  return { left: left + 42, right: right - 42 };
}

function contentBBox(data, w, xL, xR, yT, yB) {
  let x0 = w, y0 = 1e9, x1 = 0, y1 = 0, found = false;
  for (let y = yT; y < yB; y++) {
    for (let x = xL; x <= xR; x++) {
      const i = idx(w, x, y);
      if (!isPageChrome(data[i], data[i + 1], data[i + 2])) {
        found = true;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  if (!found) return null;
  const pad = 2;
  const left = Math.max(xL, x0 - pad);
  const top = Math.max(yT, y0 - pad);
  const right = Math.min(xR, x1 + pad);
  const bottom = Math.min(yB - 1, y1 + pad);
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

function punchEdgeChrome(buf, w, h) {
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p]) return;
    const i = p * 4;
    if (!isPageChrome(buf[i], buf[i + 1], buf[i + 2])) return;
    seen[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const i = p * 4;
    buf[i] = buf[i + 1] = buf[i + 2] = 0;
    buf[i + 3] = 255;
    const x = p % w, y = (p / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
}

async function processOne(name) {
  const src = path.join(backupDir, name);
  const dest = path.join(petsDir, name);
  const { data, w, h } = await loadRaw(src);
  const buttonY = findButtonY(data, w, h);
  // Fixed card layout ratio: art ends ~56% of the way to the price button
  const artBot = buttonY > 0 ? Math.floor(buttonY * 0.56) : Math.floor(h * 0.48);
  const sampleY = Math.min(h - 1, Math.max(0, Math.floor(artBot * 0.55)));
  const { left, right } = findCardX(data, w, sampleY);
  const artTop = Math.floor(artBot * 0.22); // skip ✓ Name header
  const box = contentBBox(data, w, left, right, artTop, artBot);
  if (!box || box.height < 80 || box.width < 80) {
    throw new Error(`bad bbox artBot=${artBot} btn=${buttonY} box=${JSON.stringify(box)}`);
  }

  const extracted = await sharp(src)
    .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const outData = Buffer.from(extracted.data);
  punchEdgeChrome(outData, box.width, box.height);

  const scale = Math.min(900 / box.width, 900 / box.height);
  const dw = Math.max(1, Math.round(box.width * scale));
  const dh = Math.max(1, Math.round(box.height * scale));
  const petPng = await sharp(outData, { raw: { width: box.width, height: box.height, channels: 4 } })
    .resize(dw, dh, { kernel: sharp.kernel.nearest })
    .png()
    .toBuffer();

  await sharp({ create: { width: 1024, height: 1024, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .composite([{ input: petPng, left: Math.floor((1024 - dw) / 2), top: Math.floor((1024 - dh) / 2) }])
    .png()
    .toFile(dest);

  console.log(`OK ${name}: ${box.width}x${box.height} artBot=${artBot} btn=${buttonY}`);
}

const names = fs.readdirSync(backupDir).filter((f) => f.endsWith(".png")).sort();
for (const name of names) {
  try { await processOne(name); }
  catch (err) { console.error(`FAIL ${name}:`, err.message); }
}
