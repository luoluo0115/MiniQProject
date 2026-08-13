// 绘本馆：本地 books 为主，尝试用 /api/content 的书目补充/校准标题
const api = require('../../utils/api');
const { books } = require('../../data/content');
const app = getApp();

const TONES = ['sky', 'grape', 'grass', 'coral', 'sunny', 'pinky'];

Page({
  data: {
    levels: ['all', 'AA', 'A', 'B', 'C'],
    level: 'all',
    all: [],
    filtered: [],
    resume: { title: "Little Monkey's Tree", page: 3, cover: '🐒', key: 'little-monkey-tree' }
  },

  onLoad() {
    const list = books.map((b, i) => ({ ...b, tone: TONES[i % TONES.length] }));
    this.setData({ all: list });
    this.applyFilter('all');
    // 后端若有更多已发布书目，合并进列表（仅追加本地未覆盖的 book 类型）
    api.contentList('approved', 50).then(({ items }) => {
      const have = new Set(list.map(b => b.title.toLowerCase()));
      const extra = (items || [])
        .filter(it => it.content_type === 'book' && !have.has((it.title || '').toLowerCase()))
        .map((it, i) => ({
          key: `remote-${it.id}`,
          title: it.title,
          level: it.level || 'A',
          cover: '📘',
          minutes: it.estimated_minutes || 3,
          contentId: it.id,
          tone: TONES[(list.length + i) % TONES.length]
        }));
      if (extra.length) {
        const merged = list.concat(extra);
        this.setData({ all: merged });
        this.applyFilter(this.data.level);
      }
    }).catch(() => {});
  },

  onLevel(e) {
    this.applyFilter(e.currentTarget.dataset.lv);
  },

  applyFilter(level) {
    const filtered = level === 'all' ? this.data.all : this.data.all.filter(b => b.level === level);
    this.setData({ level, filtered });
  },

  onOpen(e) {
    const key = e.currentTarget.dataset.key;
    const book = this.data.all.find(b => b.key === key);
    const q = book && book.contentId ? `contentId=${book.contentId}` : `book=${key}`;
    wx.navigateTo({ url: `/pages/reader/index?${q}` });
  }
});
