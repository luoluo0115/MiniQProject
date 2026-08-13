// 我的 · 探险家档案
Page({
  data: {
    profile: { level: 7, coin: 1351, streak: 6 },
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

  openShop() {
    wx.showToast({ title: '🛒 会员商城：装扮 / 补签卡 / 图鉴', icon: 'none' });
  },

  openParent() {
    wx.showModal({
      title: '👨‍👩‍👧 进入家长控制台',
      content: '请解答验证题：8 × 7 = ?',
      editable: true,
      placeholderText: '请输入答案',
      success: (res) => {
        if (!res.confirm) return;
        if ((res.content || '').trim() === '56') {
          wx.navigateTo({ url: '/pages/parent/index' });
        } else {
          wx.showToast({ title: '❌ 验证错误', icon: 'none' });
        }
      }
    });
  }
});
