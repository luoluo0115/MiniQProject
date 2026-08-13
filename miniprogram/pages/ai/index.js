// AI 口语角 · 场景对话陪练（脚本驱动 + 真实录音采集 + 模拟回复/纠错）
const api = require('../../utils/api');
const { sceneByKey, scenes } = require('../../data/content');
const app = getApp();

Page({
  data: {
    sceneTitle: '',
    sceneMeta: '',
    partner: 'Sam',
    messages: [],
    intoView: '',
    listening: false,
    hint: '',          // 当前轮的示范表达
    finishedFlow: false
  },

  onLoad(options) {
    const scene = sceneByKey(options.scene) || scenes[0];
    this.scene = scene;
    this.turnIndex = 0;
    this.userTurns = 0;
    this.startedAt = Date.now();
    this.sessionId = `speaking-${this.startedAt}-${Math.random().toString(36).slice(2, 8)}`;
    this.planTaskId = Number(options.taskId) || null;

    this.setData({
      sceneTitle: scene.title,
      sceneMeta: `场景：${scene.title} · CEFR ${scene.level}`,
      partner: scene.partner
    });
    // AI 开场
    this.pushAi(scene.turns[0].ai, scene.turns[0].hint);

    api.startSession({
      sessionId: this.sessionId, userId: app.globalData.userId,
      moduleType: 'speaking', planTaskId: this.planTaskId
    }).catch(() => {});

    this.initRecorder();
  },

  onUnload() {
    if (this.recorder) { try { this.recorder.stop(); } catch (e) {} }
    const total = this.scene.turns.length;
    api.finishSession(this.sessionId, {
      foregroundMs: Date.now() - this.startedAt,
      effectiveMs: Date.now() - this.startedAt,
      completionRate: Math.min(1, this.userTurns / total),
      completed: this.userTurns >= total,
      lastPosition: { turns: this.userTurns }
    }).catch(() => {});
  },

  initRecorder() {
    if (!wx.getRecorderManager) return;
    this.recorder = wx.getRecorderManager();
    this.recorder.onStop(() => this.onUserSpoke());
    this.recorder.onError(() => { this.setData({ listening: false }); wx.showToast({ title: '录音失败，检查麦克风权限', icon: 'none' }); });
  },

  pushAi(text, hint) {
    const msgs = this.data.messages.slice();
    msgs.push({ type: 'ai', text: `🤖 "${text}"` });
    this.setData({ messages: msgs, hint: hint || '', intoView: 'msg' + (msgs.length - 1) });
  },

  onMic() {
    if (this.data.finishedFlow) { wx.showToast({ title: '这个场景练完啦，换一个试试 👏', icon: 'none' }); return; }
    if (this.data.listening) { this.recorder && this.recorder.stop(); return; }
    if (!this.recorder) { this.onUserSpoke(); return; }
    wx.authorize({ scope: 'scope.record',
      success: () => { this.setData({ listening: true }); this.recorder.start({ duration: 8000, format: 'mp3', sampleRate: 16000, numberOfChannels: 1 }); },
      fail: () => { wx.showToast({ title: '需要麦克风权限才能对话哦', icon: 'none' }); this.onUserSpoke(); }
    });
  },

  // 用户说完（真实产品这里做 ASR + 评测）：用当前轮的示范表达作为「识别结果」
  onUserSpoke() {
    this.setData({ listening: false });
    const turn = this.scene.turns[this.turnIndex];
    const msgs = this.data.messages.slice();
    msgs.push({ type: 'user', text: `👦 "${turn.hint}"` });
    if (turn.correction) msgs.push({ type: 'tip', text: `💡 语法小助手：${turn.correction}` });
    this.userTurns += 1;

    api.event({
      userId: app.globalData.userId, sessionId: this.sessionId, planTaskId: this.planTaskId,
      eventType: 'speaking_turn', objectType: 'scene',
      metadata: { speakingTurns: this.userTurns, taskProgress: Math.min(1, this.userTurns / this.scene.turns.length), taskCompleted: this.userTurns >= this.scene.turns.length }
    }).catch(() => {});

    this.setData({ messages: msgs, intoView: 'msg' + (msgs.length - 1) });

    // 推进到下一轮 AI 台词
    const next = this.turnIndex + 1;
    if (next < this.scene.turns.length) {
      this.turnIndex = next;
      setTimeout(() => this.pushAi(this.scene.turns[next].ai, this.scene.turns[next].hint), 700);
    } else {
      setTimeout(() => {
        const m = this.data.messages.slice();
        m.push({ type: 'ai', text: '🤖 "Great job today! You spoke so well! 👏"' });
        this.setData({ messages: m, finishedFlow: true, hint: '', intoView: 'msg' + (m.length - 1) });
      }, 700);
    }
  }
});
