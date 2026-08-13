// 词豆 Wordlings · 共享 SVG 生成
// 同一只词豆，按 type 换配色 + 道具 + 表情；另含首页 Banner 场景插画。
// 供 <mascot> 组件与首页 hero 复用，避免逻辑重复。

const OUT = '#2B2F38';
let _mid = 0;

function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r + (255 - r) * amt);
  g = Math.round(g + (255 - g) * amt);
  b = Math.round(b + (255 - b) * amt);
  return '#' + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
}

function eyesFor(f) {
  if (f === 'wink') return `<path d="M35,52 Q42,46 49,52" fill="none" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/><path d="M51,52 Q58,46 65,52" fill="none" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/>`;
  if (f === 'sleepy') return `<path d="M36,52 Q42,55 48,52" fill="none" stroke="${OUT}" stroke-width="2.8" stroke-linecap="round"/><path d="M52,52 Q58,55 64,52" fill="none" stroke="${OUT}" stroke-width="2.8" stroke-linecap="round"/>`;
  const r = f === 'wow' ? 8.6 : 7.4, pr = f === 'wow' ? 4.4 : 3.7;
  return `<circle cx="42" cy="51" r="${r}" fill="#fff" stroke="${OUT}" stroke-width="2.2"/><circle cx="58" cy="51" r="${r}" fill="#fff" stroke="${OUT}" stroke-width="2.2"/>` +
    `<circle cx="43.4" cy="52" r="${pr}" fill="${OUT}"/><circle cx="59.4" cy="52" r="${pr}" fill="${OUT}"/>` +
    `<circle cx="41.8" cy="49.6" r="1.5" fill="#fff"/><circle cx="57.8" cy="49.6" r="1.5" fill="#fff"/>`;
}

function mouthFor(f) {
  if (f === 'wow') return `<ellipse cx="50" cy="66" rx="4.2" ry="5" fill="#7A2E39" stroke="${OUT}" stroke-width="2.2"/>`;
  if (f === 'wink') return `<path d="M43,63 Q50,71 57,63" fill="none" stroke="${OUT}" stroke-width="2.6" stroke-linecap="round"/>`;
  return `<path d="M45,64 Q50,69 55,64" fill="none" stroke="${OUT}" stroke-width="2.4" stroke-linecap="round"/>`;
}

// 返回词豆身体（不含外层 <svg>），可嵌进场景插画里
function mascotBody(color, acc, face) {
  const id = 'mg' + (_mid++);
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${lighten(color, .3)}"/><stop offset="1" stop-color="${color}"/></linearGradient></defs>` +
    `<ellipse cx="43" cy="88" rx="7.5" ry="4.5" fill="${color}" stroke="${OUT}" stroke-width="3"/>` +
    `<ellipse cx="57" cy="88" rx="7.5" ry="4.5" fill="${color}" stroke="${OUT}" stroke-width="3"/>` +
    `<circle cx="33" cy="24" r="6.5" fill="${color}" stroke="${OUT}" stroke-width="3"/>` +
    `<circle cx="67" cy="24" r="6.5" fill="${color}" stroke="${OUT}" stroke-width="3"/>` +
    `<rect x="29" y="24" width="42" height="63" rx="21" fill="url(#${id})" stroke="${OUT}" stroke-width="3.4"/>` +
    `<ellipse cx="50" cy="62" rx="13" ry="18" fill="#fff" opacity=".42"/>` +
    `<ellipse cx="40" cy="38" rx="9" ry="6" fill="#fff" opacity=".3" transform="rotate(-24 40 38)"/>` +
    `<circle cx="36" cy="60" r="4" fill="#FF7BA0" opacity=".55"/>` +
    `<circle cx="64" cy="60" r="4" fill="#FF7BA0" opacity=".55"/>` +
    eyesFor(face) + mouthFor(face) + (acc || '');
}

// type → 默认配色
const MAP = {
  read: '#4FB5F0', library: '#4FC378', vocab: '#A77BEA', ai: '#FF6FA5',
  ear: '#33C3D6', test: '#8A79EA', invite: '#2FBF9E',
  hero: '#FF9F45', me: '#FF6FA5', partner: '#FFB03B', cheer: '#4FC378', brand: '#FFF1E4'
};
// type → 默认表情（未指定 face 时）
const FACE = { vocab: 'wink', ear: 'wink', invite: 'wink', hero: 'wow', cheer: 'wow' };

const gg = (s) => `<g stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">${s}</g>`;
// type → 招牌道具
const ACC = {
  read: gg(`<path d="M37,67 Q43.5,63 50,67 L50,80 Q43.5,76 37,80 Z" fill="#EAF4FF"/><path d="M63,67 Q56.5,63 50,67 L50,80 Q56.5,76 63,80 Z" fill="#ffffff"/>`),
  library: gg(`<rect x="37" y="15" width="26" height="7" rx="2" fill="#FF8B6B"/><rect x="40" y="8" width="22" height="7" rx="2" fill="#FFD166"/><rect x="37" y="1" width="18" height="7" rx="2" fill="#7FC8F0"/>`),
  vocab: `<g stroke="${OUT}" stroke-width="2.2" stroke-linejoin="round"><rect x="38" y="63" width="24" height="19" rx="3" fill="#fff"/></g><text x="50" y="77" font-size="12" font-weight="800" text-anchor="middle" fill="${OUT}" font-family="sans-serif">Aa</text>`,
  ai: gg(`<rect x="55" y="52" width="22" height="16" rx="7" fill="#fff"/><path d="M60,68 l-3,6 l7,-3 z" fill="#fff"/>`) + `<circle cx="61" cy="60" r="1.5" fill="${OUT}"/><circle cx="66" cy="60" r="1.5" fill="${OUT}"/><circle cx="71" cy="60" r="1.5" fill="${OUT}"/>`,
  ear: `<path d="M31,50 Q31,20 50,20 Q69,20 69,50" fill="none" stroke="${OUT}" stroke-width="3.2" stroke-linecap="round"/><rect x="26" y="46" width="10" height="16" rx="5" fill="#fff" stroke="${OUT}" stroke-width="2.6"/><rect x="64" y="46" width="10" height="16" rx="5" fill="#fff" stroke="${OUT}" stroke-width="2.6"/>`,
  test: `<g transform="rotate(20 50 70)" stroke="${OUT}" stroke-width="2.2" stroke-linejoin="round"><rect x="46" y="56" width="8" height="20" rx="1.5" fill="#FFD166"/><rect x="46" y="56" width="8" height="5" rx="1.5" fill="#FF9BB3"/><path d="M46,76 L54,76 L50,84 Z" fill="#2B2F38"/></g>`,
  invite: `<path d="M50,9 C46,3 38,6 42,14 C44,18 50,22 50,22 C50,22 56,18 58,14 C62,6 54,3 50,9 Z" fill="#FF7BA0" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>`,
  me: `<path d="M40,20 L44,12 L50,17 L56,12 L60,20 Z" fill="#FFD166" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="50" cy="10.5" r="2.2" fill="#FF7BA0"/>`,
  partner: `<path d="M31,50 Q31,20 50,20 Q69,20 69,50" fill="none" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/><rect x="26" y="46" width="10" height="15" rx="5" fill="#fff" stroke="${OUT}" stroke-width="2.4"/><path d="M65,53 q6,2 6,8" fill="none" stroke="${OUT}" stroke-width="2.4" stroke-linecap="round"/>`,
  cheer: `<path d="M50,6 l2.4,5 5.4,.6 -4,3.7 1.1,5.3 -4.9,-2.8 -4.9,2.8 1.1,-5.3 -4,-3.7 5.4,-.6 Z" fill="#FFD166" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>`,
  none: ''
};

// 小程序 <image> 对 base64 形式的 SVG dataURI 兼容性最好（内容为纯 ASCII）
const _B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64encode(str) {
  let out = '';
  for (let i = 0; i < str.length; i += 3) {
    const c1 = str.charCodeAt(i);
    const c2 = str.charCodeAt(i + 1);
    const c3 = str.charCodeAt(i + 2);
    const e1 = c1 >> 2;
    const e2 = ((c1 & 3) << 4) | (c2 >> 4);
    let e3 = ((c2 & 15) << 2) | (c3 >> 6);
    let e4 = c3 & 63;
    if (isNaN(c2)) { e3 = e4 = 64; }
    else if (isNaN(c3)) { e4 = 64; }
    out += _B64[e1] + _B64[e2] + (e3 === 64 ? '=' : _B64[e3]) + (e4 === 64 ? '=' : _B64[e4]);
  }
  return out;
}

function svgToUri(svg) {
  return 'data:image/svg+xml;base64,' + b64encode(svg);
}

// 生成单只词豆的 dataURI
function buildMascot(type, faceOverride, colorOverride) {
  const color = colorOverride || MAP[type] || '#FF6FA5';
  const face = faceOverride || FACE[type] || 'happy';
  const acc = ACC[type] || '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${mascotBody(color, acc, face)}</svg>`;
  return svgToUri(svg);
}

// 首页 Banner：一整幅词野探险场景（复用小豆），返回 dataURI
function buildHero() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 188">` +
    `<defs><linearGradient id="hsky" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#FFE0AE"/><stop offset=".52" stop-color="#FFC6DD"/><stop offset="1" stop-color="#CFEEFF"/></linearGradient></defs>` +
    `<rect width="340" height="188" fill="url(#hsky)"/>` +
    `<circle cx="288" cy="40" r="24" fill="#FFD98A"/><circle cx="288" cy="40" r="15" fill="#FFEBBE"/>` +
    `<g fill="#ffffff" opacity=".92"><ellipse cx="72" cy="40" rx="26" ry="13"/><ellipse cx="98" cy="35" rx="17" ry="10"/><ellipse cx="238" cy="66" rx="21" ry="10"/><ellipse cx="221" cy="63" rx="13" ry="8"/></g>` +
    `<g font-family="sans-serif" font-weight="800">` +
    `<g transform="rotate(-12 152 40)"><rect x="140" y="28" width="24" height="24" rx="7" fill="#FF6FA5" stroke="#2B2F38" stroke-width="2.4"/><text x="152" y="46" font-size="16" text-anchor="middle" fill="#fff">A</text></g>` +
    `<g transform="rotate(11 191 33)"><rect x="181" y="22" width="21" height="21" rx="6" fill="#4FB5F0" stroke="#2B2F38" stroke-width="2.4"/><text x="191.5" y="38" font-size="14" text-anchor="middle" fill="#fff">B</text></g>` +
    `<g transform="rotate(-7 119 63)"><rect x="110" y="54" width="19" height="19" rx="6" fill="#4FC378" stroke="#2B2F38" stroke-width="2.4"/><text x="119.5" y="68" font-size="12.5" text-anchor="middle" fill="#fff">C</text></g>` +
    `</g>` +
    `<g fill="#FFF3B0" stroke="#2B2F38" stroke-width="1.1" stroke-linejoin="round">` +
    `<path d="M252,28 l2,4 4,.5 -3,3 .8,4 -3.8,-2 -3.8,2 .8,-4 -3,-3 4,-.5 Z"/>` +
    `<path d="M58,72 l1.6,3.4 3.6,.4 -2.6,2.5 .7,3.6 -3.3,-1.8 -3.3,1.8 .7,-3.6 -2.6,-2.5 3.6,-.4 Z"/>` +
    `</g>` +
    `<path d="M0,138 Q80,106 170,130 Q260,150 340,118 L340,188 L0,188 Z" fill="#9BE0A0"/>` +
    `<path d="M0,160 Q110,136 210,158 Q290,174 340,148 L340,188 L0,188 Z" fill="#5FC46F"/>` +
    `<path d="M34,186 Q120,166 176,174 Q250,184 300,162" fill="none" stroke="#FFF3D6" stroke-width="10" stroke-linecap="round"/>` +
    `<path d="M34,186 Q120,166 176,174 Q250,184 300,162" fill="none" stroke="#EFC079" stroke-width="10" stroke-linecap="round" stroke-dasharray="1 16"/>` +
    `<g stroke="#2B2F38" stroke-width="2.4" stroke-linejoin="round"><rect x="292" y="118" width="7" height="20" rx="2" fill="#C88A4A"/><circle cx="295.5" cy="114" r="16" fill="#49B86A"/></g>` +
    `<g stroke="#2B2F38" stroke-width="2.4"><circle cx="22" cy="150" r="11" fill="#57C77A"/></g>` +
    `<g transform="translate(214,102) scale(.58)">${mascotBody('#FF6FA5', ACC.invite, 'wink')}</g>` +
    `<g transform="translate(26,84) scale(.86)">${mascotBody(MAP.hero, ACC.read, 'happy')}</g>` +
    `</svg>`;
  return svgToUri(svg);
}

module.exports = { MAP, FACE, ACC, buildMascot, buildHero, mascotBody, svgToUri };
