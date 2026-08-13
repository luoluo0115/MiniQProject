// 设置（本地存储 + 写回 globalData）
const app = getApp();
const KEY = 'settings';
const LEVELS = ['AA', 'A', 'B', 'C', 'D'];
const GRADES = [1, 2, 3, 4, 5, 6];

Page({
  data: {
    level: 'AA',
    grade: 2,
    target: 15,
    remind: true,
    sound: true,
    cache: '0.0MB'
  },

  onLoad() {
    const s = wx.getStorageSync(KEY) || {};
    this.setData({
      level: s.level || app.globalData.level || 'AA',
      grade: s.grade || 2,
      target: s.target || 15,
      remind: s.remind !== undefined ? s.remind : true,
      sound: s.sound !== undefined ? s.sound : true,
      cache: '3.4MB'
    });
  },

  persist() {
    const { level, grade, target, remind, sound } = this.data;
    wx.setStorageSync(KEY, { level, grade, target, remind, sound });
    app.globalData.level = level;
  },

  pickLevel() {
    wx.showActionSheet({
      itemList: LEVELS.map(l => 'Level ' + l),
      success: r => { this.setData({ level: LEVELS[r.tapIndex] }); this.persist(); }
    });
  },

  pickGrade() {
    wx.showActionSheet({
      itemList: GRADES.map(g => g + ' 年级'),
      success: r => { this.setData({ grade: GRADES[r.tapIndex] }); this.persist(); }
    });
  },

  onTarget(e) { this.setData({ target: e.detail.value }); this.persist(); },
  toggleRemind(e) { this.setData({ remind: e.detail.value }); this.persist(); },
  toggleSound(e) { this.setData({ sound: e.detail.value }); this.persist(); },

  clearCache() {
    wx.showModal({
      title: '清理缓存', content: '确定清理本地缓存吗？（学习记录保存在云端，不受影响）',
      success: r => { if (r.confirm) { this.setData({ cache: '0.0MB' }); wx.showToast({ title: '已清理', icon: 'success' }); } }
    });
  },

  showPrivacy() { wx.showToast({ title: '隐私协议：仅收集学习数据用于个性化推荐', icon: 'none', duration: 2500 }); }
});
