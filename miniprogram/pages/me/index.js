// 我的 · 探险家档案（Tab 页；统计由 /api/dashboard/summary 派生）
const api = require('../../utils/api');
const app = getApp();

function today() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

Page({
  data: {
    statusBarH: 20,
    profile: { level: 7, coin: 1351, streak: 6 },
    stats: [
      { k: '今日分钟', v: '0' },
      { k: '复习单词', v: '0' },
      { k: '完成任务', v: '0' }
    ],
    badges: [
      { emoji: '🐒', label: '攀树家',  cls: 'bg-grass' },
      { emoji: '🍎', label: '采集家',  cls: 'bg-amber' },
      { emoji: '🔥', label: '7天坚持', cls: 'bg-rose' },
      { emoji: '🎧', label: '顺风耳',  cls: 'bg-sky' },
      { emoji: '🗣️', label: '未解锁',  lock: true },
      { emoji: '📚', label: '未解锁',  lock: true },
      { emoji: '🏔️', label: '未解锁',  lock: true },
      { emoji: '👑', label: '未解锁',  lock: true }
    ]
  },

  onShow() {
    this.setData({ statusBarH: app.globalData.statusBarH });
    this.loadSummary();
  },

  loadSummary() {
    api.summary(app.globalData.userId, today()).then(s => {
      this.setData({
        stats: [
          { k: '今日分钟', v: String(s.effectiveMinutes || 0) },
          { k: '复习单词', v: String(s.wordsReviewed || 0) },
          { k: '完成任务', v: `${s.completed_tasks || 0}/${s.total_tasks || 0}` }
        ]
      });
    }).catch(() => {});
  },

  openShop() { wx.showToast({ title: '🛒 会员商城：装扮 / 补签卡 / 图鉴', icon: 'none' }); },
  openReport() { wx.navigateTo({ url: '/pages/report/index' }); },
  openSettings() { wx.navigateTo({ url: '/pages/settings/index' }); },

  openParent() {
    wx.showModal({
      title: '👨‍👩‍👧 进入家长控制台',
      content: '请解答验证题：8 × 7 = ?',
      editable: true,
      placeholderText: '请输入答案',
      success: (res) => {
        if (!res.confirm) return;
        if ((res.content || '').trim() === '56') wx.navigateTo({ url: '/pages/parent/index' });
        else wx.showToast({ title: '❌ 验证错误', icon: 'none' });
      }
    });
  }
});
