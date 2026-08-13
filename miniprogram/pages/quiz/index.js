// 趣味闯关 · 图文匹配
Page({
  data: {
    combo: 5,
    step: 3,
    total: 5,
    percent: 60,
    q: { art: '🍎' },
    options: [
      { label: 'banana', ok: false, state: '' },
      { label: 'apple',  ok: true,  state: '' }
    ],
    locked: false,
    done: false
  },

  onAnswer(e) {
    if (this.data.locked) return;
    const i = Number(e.currentTarget.dataset.i);
    const opt = this.data.options[i];
    if (opt.ok) {
      this.setData({ [`options[${i}].state`]: 'right', locked: true, combo: this.data.combo + 1 });
      wx.showToast({ title: '🎉 答对了！连击 x' + (this.data.combo), icon: 'none' });
      setTimeout(() => this.setData({ done: true }), 800);
    } else {
      this.setData({ [`options[${i}].state`]: 'wrong' });
      wx.showToast({ title: '❌ 再试一次', icon: 'none' });
    }
  },

  backHome() {
    wx.reLaunch({ url: '/pages/home/index' });
  }
});
