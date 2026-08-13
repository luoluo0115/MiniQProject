import crypto from 'node:crypto';
import { db, now } from './db.js';
import { updateTaskProgress } from './planner.js';

export function startSession({ sessionId = crypto.randomUUID(), userId, moduleType, contentId = null, planTaskId = null, startedAt = now() }) {
  const conn = db();
  const existing = conn.prepare('SELECT * FROM learning_sessions WHERE id=?').get(sessionId);
  if (existing) return { duplicate: true, session: existing };
  conn.prepare(`INSERT INTO learning_sessions
    (id,user_id,module_type,content_id,plan_task_id,started_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(sessionId, userId, moduleType, contentId, planTaskId, startedAt, startedAt, startedAt);
  if (planTaskId) updateTaskProgress(planTaskId, 0, false);
  return { duplicate: false, session: conn.prepare('SELECT * FROM learning_sessions WHERE id=?').get(sessionId) };
}

export function finishSession(sessionId, { foregroundMs = 0, effectiveMs = 0, completionRate = 0, completed = false, finalScore = null, exitReason = null, lastPosition = {}, endedAt = now() }) {
  const conn = db();
  const session = conn.prepare('SELECT * FROM learning_sessions WHERE id=?').get(sessionId);
  if (!session) { const error = new Error('session not found'); error.status = 404; throw error; }
  if (session.ended_at) return { duplicate: true, session };
  const rate = Math.min(1, Math.max(0, Number(completionRate)));
  conn.exec('BEGIN IMMEDIATE');
  try {
    conn.prepare(`UPDATE learning_sessions SET ended_at=?,foreground_ms=?,effective_ms=?,completed=?,completion_rate=?,final_score=?,exit_reason=?,updated_at=? WHERE id=?`)
      .run(endedAt, foregroundMs, effectiveMs, completed ? 1 : 0, rate, finalScore, exitReason, endedAt, sessionId);
    if (session.content_id) conn.prepare(`INSERT INTO user_content_progress
      (user_id,content_id,status,progress_value,last_position,best_score,attempt_count,effective_ms,first_started_at,last_studied_at,completed_at)
      VALUES (?,?,?,?,?,?,1,?,?,?,?)
      ON CONFLICT(user_id,content_id) DO UPDATE SET status=excluded.status,progress_value=MAX(progress_value,excluded.progress_value),
      last_position=excluded.last_position,best_score=MAX(COALESCE(best_score,0),COALESCE(excluded.best_score,0)),attempt_count=attempt_count+1,
      effective_ms=effective_ms+excluded.effective_ms,last_studied_at=excluded.last_studied_at,completed_at=COALESCE(completed_at,excluded.completed_at)`)
      .run(session.user_id, session.content_id, completed ? 'completed' : 'in_progress', rate, JSON.stringify(lastPosition), finalScore, effectiveMs, session.started_at, endedAt, completed ? endedAt : null);
    if (session.plan_task_id) updateTaskProgress(session.plan_task_id, rate, completed);
    conn.exec('COMMIT');
  } catch (error) { conn.exec('ROLLBACK'); throw error; }
  return { duplicate: false, session: conn.prepare('SELECT * FROM learning_sessions WHERE id=?').get(sessionId) };
}

export function learningSummary(userId, date) {
  const start = `${date}T00:00:00.000Z`; const end = `${date}T23:59:59.999Z`;
  const conn = db();
  const sessions = conn.prepare(`SELECT COALESCE(SUM(effective_ms),0) effective_ms,COUNT(*) session_count,
    COALESCE(SUM(completed),0) completed_sessions FROM learning_sessions WHERE user_id=? AND started_at BETWEEN ? AND ?`).get(userId, start, end);
  const reviews = conn.prepare(`SELECT COUNT(*) reviewed,COUNT(DISTINCT word_id) unique_words FROM word_review_logs WHERE user_id=? AND reviewed_at BETWEEN ? AND ?`).get(userId, start, end);
  const plan = conn.prepare(`SELECT p.target_minutes,p.planned_minutes,COUNT(CASE WHEN t.status='completed' THEN 1 END) completed_tasks,COUNT(t.id) total_tasks
    FROM daily_plans p LEFT JOIN daily_plan_tasks t ON t.plan_id=p.id WHERE p.user_id=? AND p.plan_date=? GROUP BY p.id`).get(userId, date) || {};
  return { date, effectiveMinutes: Math.round(Number(sessions.effective_ms) / 60000), sessionCount: sessions.session_count, completedSessions: sessions.completed_sessions, wordsReviewed: reviews.reviewed, uniqueWords: reviews.unique_words, ...plan };
}

