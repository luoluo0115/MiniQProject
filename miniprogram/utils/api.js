const app = () => getApp();

function request(path, options = {}) {
  return new Promise((resolve, reject) => wx.request({
    url: `${app().globalData.apiBase}${path}`,
    method: options.method || 'GET',
    data: options.data,
    timeout: 10000,
    success: ({ statusCode, data }) => statusCode >= 200 && statusCode < 300 ? resolve(data) : reject(new Error(data && data.error || `请求失败 ${statusCode}`)),
    fail: reject
  }));
}

module.exports = {
  todayPlan(userId) { return request(`/api/plans/today?userId=${userId}`); },
  dueWords(userId, limit = 20) { return request(`/api/words/due?userId=${userId}&limit=${limit}`); },
  reviewWord(wordId, payload) { return request(`/api/words/${wordId}/review`, { method: 'POST', data: payload }); },
  content(contentId) { return request(`/api/content/${contentId}`); },
  startSession(payload) { return request('/api/sessions/start', { method: 'POST', data: payload }); },
  finishSession(sessionId, payload) { return request(`/api/sessions/${encodeURIComponent(sessionId)}/finish`, { method: 'POST', data: payload }); },
  event(payload) { return request('/api/events', { method: 'POST', data: payload }); },
  summary(userId, date) { return request(`/api/dashboard/summary?userId=${userId}&date=${date}`); },
  exportUrl(userId) { return `${app().globalData.apiBase}/api/words/export.csv?userId=${userId}`; },
  printUrl(userId) { return `${app().globalData.apiBase}/api/words/print?userId=${userId}`; }
};
