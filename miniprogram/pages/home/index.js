// 小Q首页
const { buildHero } = require('../../utils/svg');
const api = require('../../utils/api');
const app = getApp();

Page({
  data: {
    statusBarH: 20,
    level: 'AA',
    heroSrc: '',
    // 圆形图标九宫格（type 对应 mascot 组件 / 招牌道具；page 有值则跳转）
    grid: [
      { type: 'read',    label: '阅读打卡', page: '/pages/library/index', tip: '' },
      { type: 'library', label: '绘本馆',   page: '/pages/library/index', tip: '' },
      { type: 'vocab',   label: '背单词',   page: '/pages/vocab/index',  tip: '' },
      { type: 'ai',      label: 'AI口语角', page: '/pages/scenes/index', tip: '' },
      { type: 'ear',     label: '磨耳朵',   page: '/pages/listening/index', tip: '' },
      { type: 'test',    label: '英语测评', tip: '📝 英语测评：AI 定级测试' },
      { type: 'invite',  label: '邀请好友', tip: '👬 邀请好友得双倍奖学金' }
    ],
    // 今日学习计划
    plans: [
      { icon: '📖', text: '学习 1 本绘本',        coin: 40, page: '/pages/reader/index' },
      { icon: '🎴', text: '艾宾浩斯背单词 1 组',   coin: 20, page: '/pages/vocab/index' },
      { icon: '🗣️', text: 'AI 口语对话 1 段',      coin: 15 }
    ],
    // 功能卡片横滑
    cards: [
      { emoji: '🎙️', label: '配音挑战',     cls: 'card-green' },
      { emoji: '📇', label: 'YKP单词神器',   cls: 'card-blue' },
      { emoji: '🌍', label: '国家地理分级', cls: 'card-orange' }
    ]
  },

  onLoad() {
    this.setData({
      statusBarH: app.globalData.statusBarH,
      level: app.globalData.level,
      heroSrc: buildHero()
    });
    this.loadTodayPlan();
  },

  loadTodayPlan() {
    api.todayPlan(app.globalData.userId).then(({ plan }) => {
      const labels = { vocabulary: ['🎴', '艾宾浩斯复习'], reading: ['📖', '分级阅读'], speaking: ['🗣️', 'AI 口语对话'] };
      const pages = { vocabulary: '/pages/vocab/index', reading: '/pages/reader/index', speaking: '/pages/ai/index' };
      this.setData({ plans: plan.tasks.map(task => ({
        icon: (labels[task.task_type] || ['✨'])[0],
        text: `${(labels[task.task_type] || ['', task.task_type])[1]} ${task.target_value}${task.target_unit}`,
        reason: task.recommendation_reason,
        coin: Math.max(10, task.estimated_minutes * 5),
        page: pages[task.task_type] ? `${pages[task.task_type]}?contentId=${task.content_id || ''}&taskId=${task.id}` : ''
      })) });
    }).catch(() => wx.showToast({ title: '当前展示离线计划', icon: 'none' }));
  },

  onGridTap(e) {
    const { page, tip } = e.currentTarget.dataset;
    if (page) { wx.navigateTo({ url: page }); return; }
    wx.showToast({ title: tip, icon: 'none', duration: 2000 });
  },

  onPlanTap(e) {
    const { page, text } = e.currentTarget.dataset;
    if (page) { wx.navigateTo({ url: page }); return; }
    wx.showToast({ title: '开始「' + text + '」', icon: 'none' });
  },

  onStartLearn() {
    const first = (this.data.plans || []).find(p => p.page);
    if (first) { wx.navigateTo({ url: first.page }); return; }
    wx.reLaunch({ url: '/pages/study/index' });
  },

  onCardTap(e) {
    wx.showToast({ title: e.currentTarget.dataset.label, icon: 'none' });
  },

  onToggleLevel() {
    const next = this.data.level === 'AA' ? 'A' : 'AA';
    app.globalData.level = next;
    this.setData({ level: next });
    wx.showToast({ title: '已切换 · Level ' + next, icon: 'none' });
  },

  onBrandTap() {
    wx.showToast({ title: '🎒 品牌专区：正版 IP 好物', icon: 'none' });
  }
});
