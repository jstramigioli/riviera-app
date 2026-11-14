import fs from 'fs';
import path from 'path';

const EMOJI = /\p{Extended_Pictographic}/gu;

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (['node_modules', 'dist'].includes(e.name)) continue;
      walk(p, acc);
    } else if (/\.(jsx?|tsx?)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

let ui = 0;
const hits = [];
for (const f of walk('frontend/src')) {
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((l, i) => {
    if (/^\s*\/\//.test(l) || /^\s*\*/.test(l) || /^\s*\/\*/.test(l)) return;
    if (/\bconsole\.(log|warn|error|debug|info|trace)\b/.test(l)) return;
    if (EMOJI.test(l)) {
      EMOJI.lastIndex = 0;
      hits.push(`${f}:${i + 1}:${l.trim()}`);
      ui++;
    }
    EMOJI.lastIndex = 0;
  });
}
console.log(hits.join('\n'));
console.log('UI_EMOJI_COUNT', ui);
