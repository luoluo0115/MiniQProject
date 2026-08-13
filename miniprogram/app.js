// 小Q · 小学英语成长伙伴
App({
  globalData: {
    statusBarH: 20,
    level: 'A',
    userId: 1,
    // 真机调试时替换为已配置 HTTPS 业务域名；localhost 仅供开发者工具使用。
    apiBase: 'http://localhost:8787'
  },
  onLaunch() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.globalData.statusBarH = info.statusBarHeight || 20;
  }
});
