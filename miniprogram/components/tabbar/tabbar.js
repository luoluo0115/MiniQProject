// 共享底部 Tab 组件。active 传入当前页 key；点击用 reLaunch 切主页面，避免页面栈堆叠。
Component({
  properties: {
    active: { type: String, value: 'home' }
  },
  data: {
    tabs: [
      { key: 'home',  label: '首页', ico: '🏠', url: '/pages/home/index' },
      { key: 'study', label: '学习', ico: '📚', url: '/pages/study/index' },
      { key: 'quiz',  label: '闯关', ico: '🎮', url: '/pages/quiz/index' },
      { key: 'me',    label: '我的', ico: '👤', url: '/pages/me/index' }
    ]
  },
  methods: {
    onTap(e) {
      const { key, url } = e.currentTarget.dataset;
      if (key === this.properties.active) return;
      wx.reLaunch({ url });
    }
  }
});
