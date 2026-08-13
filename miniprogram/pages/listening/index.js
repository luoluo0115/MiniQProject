// 磨耳朵 · 听力训练（逐句播放模拟；逐句/盲听/循环三模式）
const api = require('../../utils/api');
const { listening } = require('../../data/content');
const app = getApp();

Page({
  data: {
    tracks: listening,
    trackIndex: 0,
    track: listening[0],
    cursor: 0,
    playing: false,
    mode: 'sentence',
    modes: [
      { key: 'sentence', label: '逐句跟读' },
      { key: 'blind', label: '盲听' },
      { key: 'loop', label: '循环播放' }
    ]
  },

  onLoad() {
    this.startedAt = Date.now();
    this.sessionId = `listening-${this.startedAt}-${Math.random().toString(36).slice(2, 8)}`;
    api.startSession({ sessionId: this.sessionId, userId: app.globalData.userId, moduleType: 'listening' }).catch(() => {});
  },

  onUnload() {
    this.stop();
    api.finishSession(this.sessionId, {
      foregroundMs: Date.now() - this.startedAt, effectiveMs: Date.now() - this.startedAt,
      completionRate: 1, completed: true
    }).catch(() => {});
  },

  onPickTrack(e) {
    const i = Number(e.currentTarget.dataset.i);
    this.stop();
    this.setData({ trackIndex: i, track: this.data.tracks[i], cursor: 0, playing: false });
  },

  onMode(e) { this.setData({ mode: e.currentTarget.dataset.key }); },

  togglePlay() { this.data.playing ? this.stop() : this.play(); },

  play() {
    this.setData({ playing: true });
    // 模拟逐句播放：每句停留 2.4s 自动推进
    this.timer = setInterval(() => {
      const total = this.data.track.lines.length;
      let next = this.data.cursor + 1;
      if (next >= total) {
        if (this.data.mode === 'loop') { next = 0; }
        else { this.stop(); return; }
      }
      this.setData({ cursor: next });
    }, 2400);
  },

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.setData({ playing: false });
  }
});
