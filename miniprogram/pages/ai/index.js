// AI 口语角 · 场景对话陪练
const api = require('../../utils/api');
const app = getApp();
Page({
  data: {
    scene: '场景：At the Zoo · CEFR A1',
    messages: [
      { type: 'ai',   text: '🤖 "Welcome to the zoo! Look, I see a big lion. Do you like lions or pandas?"' },
      { type: 'user', text: '👦 "I likes pandas, it are cute."' },
      { type: 'tip',  text: '💡 语法小助手：你说的 "I likes pandas" → 试试 "I like pandas, they are cute."' }
    ],
    intoView: 'msg2',
    listening: false,
    // 模拟的下一句用户回复
    _replies: [
      '👦 "I want to see the elephants!"',
      '👦 "The monkey is so funny!"',
      '👦 "Can we feed the rabbits?"'
    ],
    _ri: 0
  },

  onLoad(options) {
    this.contentId = Number(options.contentId) || null;
    this.planTaskId = Number(options.taskId) || null;
    this.startedAt = Date.now();
    this.sessionId = `speaking-${this.startedAt}-${Math.random().toString(36).slice(2, 8)}`;
    api.startSession({ sessionId: this.sessionId, userId: app.globalData.userId, moduleType: 'speaking', contentId: this.contentId, planTaskId: this.planTaskId }).catch(() => {});
  },

  onUnload() {
    const turns = this.data.messages.filter(message => message.type === 'user').length;
    api.finishSession(this.sessionId, { foregroundMs: Date.now() - this.startedAt, effectiveMs: Date.now() - this.startedAt, completionRate: Math.min(1, turns / 8), completed: turns >= 8, lastPosition: { turns } }).catch(() => {});
  },

  onMic() {
    if (this.data.listening) return;
    this.setData({ listening: true });
    setTimeout(() => {
      const msgs = this.data.messages.slice();
      const ri = this.data._ri % this.data._replies.length;
      msgs.push({ type: 'user', text: this.data._replies[ri] });
      this.setData({
        messages: msgs,
        _ri: this.data._ri + 1,
        listening: false,
        intoView: 'msg' + (msgs.length - 1)
      });
      api.event({ userId: app.globalData.userId, sessionId: this.sessionId, planTaskId: this.planTaskId, eventType: 'speaking_turn', objectType: 'content', objectId: this.contentId, metadata: { speakingTurns: ri + 1, taskProgress: Math.min(1, (ri + 1) / 8), taskCompleted: ri + 1 >= 8 } }).catch(() => {});
    }, 1100);
  }
});
