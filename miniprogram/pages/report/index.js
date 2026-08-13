// 成长报告：拉取近 7 天 /api/dashboard/summary，聚合柱状图与指标
const api = require('../../utils/api');
const app = getApp();

const DAY = 24 * 3600 * 1000;
const WK = ['日', '一', '二', '三', '四', '五', '六'];

function fmt(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

Page({
  data: {
    streak: 0,
    metrics: [
      { emoji: '📖', k: '阅读会话', v: '0' },
      { emoji: '🎴', k: '复习单词', v: '0' },
      { emoji: '⏱️', k: '有效分钟', v: '0' }
    ],
    week: [],
    advice: '每天坚持 15 分钟，读一读、背一背、说一说，进步看得见！'
  },

  onLoad() {
    const now = Date.now();
    const dates = [];
    for (let i = 6; i >= 0; i--) dates.push(new Date(now - i * DAY));

    Promise.all(dates.map(d =>
      api.summary(app.globalData.userId, fmt(d)).catch(() => ({ effectiveMinutes: 0, sessionCount: 0, wordsReviewed: 0 }))
    )).then(list => {
      const maxMin = Math.max(10, ...list.map(s => s.effectiveMinutes || 0));
      const week = list.map((s, i) => ({
        date: fmt(dates[i]),
        day: WK[dates[i].getDay()],
        min: s.effectiveMinutes || 0,
        h: Math.max(8, Math.round((s.effectiveMinutes || 0) / maxMin * 200))
      }));
      // 连续天数：从最近一天往前数有效分钟>0
      let streak = 0;
      for (let i = week.length - 1; i >= 0; i--) { if (week[i].min > 0) streak++; else break; }
      const totalSessions = list.reduce((a, s) => a + (s.sessionCount || 0), 0);
      const totalWords = list.reduce((a, s) => a + (s.wordsReviewed || 0), 0);
      const totalMin = list.reduce((a, s) => a + (s.effectiveMinutes || 0), 0);

      this.setData({
        week, streak,
        metrics: [
          { emoji: '📖', k: '学习会话', v: String(totalSessions) },
          { emoji: '🎴', k: '复习单词', v: String(totalWords) },
          { emoji: '⏱️', k: '有效分钟', v: String(totalMin) }
        ],
        advice: buildAdvice(totalMin, totalWords, streak)
      });
    });
  }
});

function buildAdvice(min, words, streak) {
  if (min === 0) return '这周还没有学习记录哦，今天就和小Q开启第一次探险吧！🌱';
  if (streak >= 5) return `已经连续学习 ${streak} 天啦，太棒了！保持节奏，词野探险队为你骄傲 🏅`;
  if (words < 10) return '阅读做得不错～可以多花几分钟背背单词，记忆会更牢固哦 🎴';
  return `本周累计学习 ${min} 分钟、复习 ${words} 个单词，继续加油，明天见！🚀`;
}
