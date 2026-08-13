// 家长控制台（周报接 summary；开关本地持久化 wx.setStorageSync）
const api = require('../../utils/api');
const app = getApp();

const KEY = 'parentControls';

function today() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

Page({
  data: {
    eyeCare: true,
    dailyLimit: true,
    report: [
      { num: '0', label: '有效分钟', cls: 'stat-grass' },
      { num: '0', label: '复习单词', cls: 'stat-sunny' },
      { num: '0/0', label: '完成任务', cls: 'stat-pinky' }
    ]
  },

  onLoad() {
    const saved = wx.getStorageSync(KEY) || {};
    this.setData({
      eyeCare: saved.eyeCare !== undefined ? saved.eyeCare : true,
      dailyLimit: saved.dailyLimit !== undefined ? saved.dailyLimit : true
    });
    api.summary(app.globalData.userId, today()).then(s => this.setData({
      report: [
        { num: String(s.effectiveMinutes || 0), label: '有效分钟', cls: 'stat-grass' },
        { num: String(s.wordsReviewed || 0), label: '复习单词', cls: 'stat-sunny' },
        { num: `${s.completed_tasks || 0}/${s.total_tasks || 0}`, label: '完成任务', cls: 'stat-pinky' }
      ]
    })).catch(() => {});
  },

  persist() {
    wx.setStorageSync(KEY, { eyeCare: this.data.eyeCare, dailyLimit: this.data.dailyLimit });
  },

  toggleEye(e) { this.setData({ eyeCare: e.detail.value }); this.persist(); },
  toggleLimit(e) { this.setData({ dailyLimit: e.detail.value }); this.persist(); },

  openReport() { wx.navigateTo({ url: '/pages/report/index' }); }
});
