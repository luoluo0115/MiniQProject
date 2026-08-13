import { config } from './config.js';
import { db } from './db.js';

export async function createRealtimeCall({ userId, sceneId, sdp }) {
  if (!config.openaiApiKey) {
    const error = new Error('OPENAI_API_KEY is not configured'); error.status = 503; throw error;
  }
  const child = db().prepare('SELECT nickname,current_level FROM child_profiles WHERE user_id=?').get(userId);
  if (!child) { const error = new Error('child not found'); error.status = 404; throw error; }
  const scene = sceneId ? db().prepare(`SELECT title,metadata FROM content_items WHERE id=? AND content_type='speaking_scene' AND review_status='approved'`).get(sceneId) : null;
  const session = {
    type: 'realtime', model: config.realtimeModel,
    instructions: `你是小Q英语口语伙伴。学习者昵称是${child.nickname || '小朋友'}，当前级别${child.current_level}。使用短句、慢语速和积极反馈；一次只问一个问题；不索取住址、学校、电话等个人信息。${scene ? `本次场景：${scene.title}。` : ''}`,
    output_modalities: ['audio'], audio: { output: { voice: 'marin' } }
  };
  const form = new FormData();
  form.set('sdp', sdp);
  form.set('session', JSON.stringify(session));
  const response = await fetch('https://api.openai.com/v1/realtime/calls', {
    method: 'POST', headers: { Authorization: `Bearer ${config.openaiApiKey}` }, body: form
  });
  const body = await response.text();
  if (!response.ok) { const error = new Error(`Realtime API ${response.status}: ${body}`); error.status = 502; throw error; }
  return body;
}

