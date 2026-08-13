import { db, json, now } from './db.js';
import { dueWords } from './memory.js';

function localDate(timezone, date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function generateDailyPlan(userId, requestedDate) {
  const conn = db();
  const child = conn.prepare(`SELECT u.timezone,p.* FROM users u JOIN child_profiles p ON p.user_id=u.id WHERE u.id=?`).get(userId);
  if (!child) throw new Error('child not found');
  const planDate = requestedDate || localDate(child.timezone);
  const existing = conn.prepare('SELECT * FROM daily_plans WHERE user_id=? AND plan_date=?').get(userId, planDate);
  if (existing) return getDailyPlan(userId, planDate);

  const budget = child.daily_target_minutes;
  const tasks = [];
  const words = dueWords(userId, new Date(`${planDate}T23:59:59Z`).toISOString(), 20);
  if (words.length) tasks.push({ type: 'vocabulary', target: words.length, unit: 'words', minutes: Math.min(6, Math.max(3, Math.ceil(words.length / 4))), priority: 100, contentId: null, reason: `今天有${words.length}个单词到达最佳复习时间`, rule: { type: 'review_count', required: words.length } });

  const unfinished = conn.prepare(`SELECT c.id,c.title,p.progress_value,p.last_position FROM user_content_progress p
    JOIN content_items c ON c.id=p.content_id WHERE p.user_id=? AND c.content_type='book' AND p.status='in_progress'
    ORDER BY p.last_studied_at DESC LIMIT 1`).get(userId);
  const recommended = unfinished || conn.prepare(`SELECT id,title FROM content_items WHERE content_type='book' AND review_status='approved'
    AND (level=? OR level IS NULL) ORDER BY difficulty_score ASC, id ASC LIMIT 1`).get(child.current_level);
  if (recommended) tasks.push({ type: 'reading', target: 1, unit: 'book', minutes: 5, priority: unfinished ? 90 : 70, contentId: recommended.id, reason: unfinished ? `继续上次读到的《${recommended.title}》` : `匹配当前Level ${child.current_level}`, rule: { type: 'content_complete', contentId: recommended.id } });

  const speaking = conn.prepare(`SELECT id,title FROM content_items WHERE content_type='speaking_scene' AND review_status='approved'
    AND (level=? OR level IS NULL) ORDER BY id LIMIT 1`).get(child.current_level);
  if (speaking) tasks.push({ type: 'speaking', target: 5, unit: 'minutes', minutes: 5, priority: 50, contentId: speaking.id, reason: '用今天学到的词开口表达', rule: { type: 'either', effectiveMinutes: 5, speakingTurns: 8 } });

  let used = 0;
  const selected = tasks.sort((a, b) => b.priority - a.priority).filter(task => {
    if (used >= budget) return false;
    task.minutes = Math.min(task.minutes, Math.max(2, budget - used)); used += task.minutes; return true;
  });

  conn.exec('BEGIN IMMEDIATE');
  try {
    const result = conn.prepare(`INSERT INTO daily_plans
      (user_id,plan_date,timezone,target_minutes,planned_minutes,status,generation_reason,planner_version,generated_at)
      VALUES (?,?,?,?,?,'active',?,'rules-v1',?)`).run(userId, planDate, child.timezone, budget, used, JSON.stringify({ dueWords: words.length, level: child.current_level, hasReadingBreakpoint: Boolean(unfinished) }), now());
    for (const task of selected) conn.prepare(`INSERT INTO daily_plan_tasks
      (plan_id,task_type,content_id,target_value,target_unit,estimated_minutes,priority,status,recommendation_reason,completion_rule)
      VALUES (?,?,?,?,?,?,?,'pending',?,?)`).run(result.lastInsertRowid, task.type, task.contentId, task.target, task.unit, task.minutes, task.priority, task.reason, JSON.stringify(task.rule));
    conn.exec('COMMIT');
  } catch (error) { conn.exec('ROLLBACK'); throw error; }
  return getDailyPlan(userId, planDate);
}

export function getDailyPlan(userId, date) {
  const plan = db().prepare('SELECT * FROM daily_plans WHERE user_id=? AND plan_date=?').get(userId, date);
  if (!plan) return null;
  const tasks = db().prepare(`SELECT t.*,c.title AS content_title FROM daily_plan_tasks t LEFT JOIN content_items c ON c.id=t.content_id WHERE t.plan_id=? ORDER BY priority DESC`).all(plan.id);
  return { ...plan, generation_reason: json(plan.generation_reason, {}), tasks: tasks.map(t => ({ ...t, completion_rule: json(t.completion_rule, {}) })) };
}

export function updateTaskProgress(taskId, progress, completed = false) {
  const completedAt = completed ? now() : null;
  db().prepare(`UPDATE daily_plan_tasks SET progress_value=?,status=?,started_at=COALESCE(started_at,?),completed_at=COALESCE(completed_at,?) WHERE id=?`)
    .run(progress, completed ? 'completed' : 'in_progress', now(), completedAt, taskId);
}
