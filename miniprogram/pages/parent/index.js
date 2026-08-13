// 家长控制台
const api = require('../../utils/api');
const app = getApp();
Page({
  data: {
    eyeCare: true,
    dailyLimit: true,
    report: [
      { num: '7',   label: '阅读本数', cls: 'stat-grass' },
      { num: '86%', label: '背词准确', cls: 'stat-sunny' },
      { num: '42',  label: '对话轮次', cls: 'stat-pinky' }
    ]
  },

  onLoad() {
    const date = new Date().toISOString().slice(0, 10);
    api.summary(app.globalData.userId, date).then(summary => this.setData({ report: [
      { num: String(summary.effectiveMinutes || 0), label: '有效分钟', cls: 'stat-grass' },
      { num: String(summary.wordsReviewed || 0), label: '复习单词', cls: 'stat-sunny' },
      { num: `${summary.completed_tasks || 0}/${summary.total_tasks || 0}`, label: '完成任务', cls: 'stat-pinky' }
    ] })).catch(() => {});
  },

  toggleEye(e) {
    this.setData({ eyeCare: e.detail.value });
  },
  toggleLimit(e) {
    this.setData({ dailyLimit: e.detail.value });
  }
});
