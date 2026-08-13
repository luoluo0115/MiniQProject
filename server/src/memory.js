import { db, now } from './db.js';

const BASE_INTERVALS = [0, 1 / 144, 1, 2, 4, 7, 15, 30, 60, 120];
const GRADE_FACTOR = { 1: 0, 2: 0.65, 3: 1, 4: 1.5 };

export function reviewWord({ reviewUuid, userId, wordId, grade, responseMs = null, reviewMode = 'flashcard', reviewedAt = now() }) {
  if (![1, 2, 3, 4].includes(Number(grade))) throw new Error('grade must be 1..4');
  const conn = db();
  const duplicate = conn.prepare('SELECT * FROM word_review_logs WHERE review_uuid = ?').get(reviewUuid);
  if (duplicate) return { duplicate: true, nextIntervalDays: duplicate.next_interval };

  const current = conn.prepare('SELECT * FROM word_memory_states WHERE user_id=? AND word_id=?').get(userId, wordId) || {
    state: 'new', repetitions: 0, lapse_count: 0, stability: 0, difficulty: 5, current_interval_days: 0
  };
  const numericGrade = Number(grade);
  let repetitions = current.repetitions;
  let lapseCount = current.lapse_count;
  let difficulty = Math.min(10, Math.max(1, current.difficulty + (3 - numericGrade) * 0.35));
  let nextInterval;
  let state;

  if (numericGrade === 1) {
    repetitions = 0;
    lapseCount += 1;
    nextInterval = BASE_INTERVALS[1];
    state = 'relearning';
  } else {
    repetitions += 1;
    const base = BASE_INTERVALS[Math.min(repetitions + 1, BASE_INTERVALS.length - 1)];
    const difficultyFactor = Math.max(0.55, 1.35 - difficulty * 0.07);
    nextInterval = Math.max(0.5, base * GRADE_FACTOR[numericGrade] * difficultyFactor);
    state = repetitions >= 7 ? 'mastered' : repetitions <= 2 ? 'learning' : 'reviewing';
  }

  const nextReviewAt = new Date(new Date(reviewedAt).getTime() + nextInterval * 86400000).toISOString();
  const stability = Math.max(0.1, nextInterval * (1 + repetitions * 0.08));
  const algorithmVersion = 'ebbinghaus-v1';

  conn.exec('BEGIN IMMEDIATE');
  try {
    conn.prepare(`INSERT INTO word_review_logs
      (review_uuid,user_id,word_id,grade,reviewed_at,response_ms,review_mode,previous_interval,next_interval,algorithm_version,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(reviewUuid, userId, wordId, numericGrade, reviewedAt, responseMs, reviewMode, current.current_interval_days, nextInterval, algorithmVersion, now());
    conn.prepare(`INSERT INTO word_memory_states
      (user_id,word_id,state,repetitions,lapse_count,stability,difficulty,retrievability,current_interval_days,last_reviewed_at,next_review_at,last_grade,algorithm_version,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id,word_id) DO UPDATE SET
      state=excluded.state,repetitions=excluded.repetitions,lapse_count=excluded.lapse_count,stability=excluded.stability,
      difficulty=excluded.difficulty,retrievability=excluded.retrievability,current_interval_days=excluded.current_interval_days,
      last_reviewed_at=excluded.last_reviewed_at,next_review_at=excluded.next_review_at,last_grade=excluded.last_grade,
      algorithm_version=excluded.algorithm_version,updated_at=excluded.updated_at`).run(
        userId, wordId, state, repetitions, lapseCount, stability, difficulty, 1, nextInterval, reviewedAt, nextReviewAt, numericGrade, algorithmVersion, now()
      );
    conn.exec('COMMIT');
  } catch (error) {
    conn.exec('ROLLBACK'); throw error;
  }
  return { duplicate: false, state, repetitions, lapseCount, stability, difficulty, nextIntervalDays: nextInterval, nextReviewAt };
}

export function dueWords(userId, at = now(), limit = 20) {
  return db().prepare(`SELECT w.*,m.state,m.repetitions,m.current_interval_days,m.next_review_at,m.last_grade
    FROM word_memory_states m JOIN words w ON w.id=m.word_id
    WHERE m.user_id=? AND (m.next_review_at IS NULL OR m.next_review_at<=?)
    ORDER BY COALESCE(m.next_review_at,'1970-01-01') LIMIT ?`).all(userId, at, limit);
}
