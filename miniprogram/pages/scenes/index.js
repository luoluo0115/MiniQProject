// 口语场景选择
const { scenes } = require('../../data/content');

Page({
  data: { scenes },

  onPick(e) {
    const { key, unlocked } = e.currentTarget.dataset;
    if (!unlocked) { wx.showToast({ title: '再多练几关就能解锁啦 🔓', icon: 'none' }); return; }
    wx.navigateTo({ url: `/pages/ai/index?scene=${key}` });
  }
});
