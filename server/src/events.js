import crypto from 'node:crypto';
import { db, now } from './db.js';
import { updateTaskProgress } from './planner.js';

export function recordEvent(event) {
  const conn = db();
  const eventUuid = event.eventUuid || crypto.randomUUID();
  const prior = conn.prepare('SELECT * FROM learning_events WHERE event_uuid=?').get(eventUuid);
  if (prior) return { duplicate: true, event: prior };
  const occurredAt = event.occurredAt || now();
  const result = conn.prepare(`INSERT INTO learning_events
    (event_uuid,user_id,session_id,plan_task_id,event_type,object_type,object_id,occurred_at,duration_ms,result,score,metadata,client_platform,client_version,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(eventUuid,event.userId,event.sessionId||null,event.planTaskId||null,event.eventType,event.objectType,event.objectId||null,occurredAt,event.durationMs||0,event.result||null,event.score??null,JSON.stringify(event.metadata||{}),event.clientPlatform||null,event.clientVersion||null,now());

  if (event.planTaskId && event.metadata?.taskProgress != null) updateTaskProgress(event.planTaskId, event.metadata.taskProgress, Boolean(event.metadata.taskCompleted));
  return { duplicate: false, event: conn.prepare('SELECT * FROM learning_events WHERE id=?').get(result.lastInsertRowid) };
}
