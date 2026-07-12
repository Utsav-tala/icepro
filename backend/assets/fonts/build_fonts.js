const fs = require('fs');
const https = require('https');
const css = fs.readFileSync('gf.css', 'utf8');

// Split into @font-face blocks
const blocks = css.split('@font-face').slice(1).map(b => '@font-face' + b.split('}')[0] + '}');

const get = (url) => new Promise((res, rej) => {
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120' } }, r => {
    const chunks = [];
    r.on('data', c => chunks.push(c));
    r.on('end', () => res(Buffer.concat(chunks)));
  }).on('error', rej);
});

(async () => {
  let out = '';
  let kept = 0, totalBytes = 0;
  for (const block of blocks) {
    // Keep only the latin subset (unicode-range containing U+0000)
    const range = (block.match(/unicode-range:\s*([^;]+);/) || [])[1] || '';
    if (!/U\+0000/.test(range)) continue;
    const fam = (block.match(/font-family:\s*'([^']+)'/) || [])[1];
    const wght = (block.match(/font-weight:\s*(\d+)/) || [])[1];
    const url = (block.match(/url\((https:[^)]+\.woff2)\)/) || [])[1];
    if (!url) continue;
    const buf = await get(url);
    totalBytes += buf.length;
    const dataUri = `data:font/woff2;base64,${buf.toString('base64')}`;
    out += `@font-face{font-family:'${fam}';font-style:normal;font-weight:${wght};font-display:swap;src:url(${dataUri}) format('woff2');}\n`;
    kept++;
    console.log(`  ${fam} ${wght}  ${(buf.length/1024).toFixed(1)}KB`);
  }
  fs.writeFileSync('../fonts.css', out);
  console.log(`\nKept ${kept} font weights, ${(totalBytes/1024).toFixed(1)}KB raw → fonts.css (${(fs.statSync('../fonts.css').size/1024).toFixed(1)}KB base64)`);
})();
