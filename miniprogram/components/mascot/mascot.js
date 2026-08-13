// 词豆 Wordlings · 统一吉祥物组件
// 同一只词豆，按 type 换配色 + 道具 + 表情；SVG 生成逻辑在 utils/svg.js 复用。
const { buildMascot } = require('../../utils/svg');

Component({
  properties: {
    // 角色类型：read/library/vocab/ai/ear/test/invite/hero/me/partner/cheer/brand
    type: { type: String, value: 'hero', observer: '_render' },
    // 表情覆盖：happy/wink/wow/sleepy（留空则用该 type 的默认表情）
    face: { type: String, value: '', observer: '_render' },
    // 配色覆盖：留空则用该 type 的默认色
    color: { type: String, value: '', observer: '_render' }
  },
  data: { src: '' },
  lifetimes: {
    attached() { this._render(); }
  },
  methods: {
    _render() {
      const { type, face, color } = this.properties;
      this.setData({ src: buildMascot(type, face, color) });
    }
  }
});
