import { db, now } from './db.js';

export function seedDemo() {
  const conn = db(); const timestamp = now();
  let user = conn.prepare("SELECT id FROM users WHERE role='child' ORDER BY id LIMIT 1").get();
  if (!user) {
    const inserted = conn.prepare("INSERT INTO users(role,timezone,created_at,updated_at) VALUES ('child','Asia/Shanghai',?,?)").run(timestamp, timestamp);
    user = { id: Number(inserted.lastInsertRowid) };
  }
  conn.prepare(`INSERT INTO child_profiles(user_id,nickname,birth_year,grade,current_level,daily_target_minutes,preferred_topics,created_at,updated_at)
    VALUES (?,'小Q体验账号',2018,2,'A',15,'["animals","family"]',?,?) ON CONFLICT(user_id) DO NOTHING`).run(user.id, timestamp, timestamp);
  for (const item of [
    ['demo:book:hello-animals', 'book', 'Hello Animals', 'A', 3, '["animals"]'],
    ['demo:scene:pet-shop', 'speaking_scene', 'At the Pet Shop', 'A', 5, '["animals"]']
  ]) conn.prepare(`INSERT INTO content_items(content_key,content_type,title,level,estimated_minutes,topic_tags,review_status,copyright_status,metadata,created_at,updated_at)
    VALUES (?,?,?,?,?,?,'approved','owned','{}',?,?) ON CONFLICT(content_key) DO NOTHING`).run(...item, timestamp, timestamp);
  const words = [['cat','/kæt/','猫','The cat is happy.','这只猫很开心。'],['dog','/dɒɡ/','狗','I see a dog.','我看到一只狗。'],['hello','/həˈləʊ/','你好','Hello, my friend!','你好，我的朋友！']];
  for (const word of words) {
    conn.prepare(`INSERT INTO words(lemma,phonics,meaning_zh,example_en,example_zh,level,created_at,updated_at) VALUES (?,?,?,?,?,'A',?,?) ON CONFLICT(lemma) DO NOTHING`).run(...word, timestamp, timestamp);
    const wordId = conn.prepare('SELECT id FROM words WHERE lemma=?').get(word[0]).id;
    conn.prepare(`INSERT INTO user_words(user_id,word_id,source_type,collected_at) VALUES (?,?,'seed',?) ON CONFLICT DO NOTHING`).run(user.id, wordId, timestamp);
    conn.prepare(`INSERT INTO word_memory_states(user_id,word_id,next_review_at,updated_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING`).run(user.id, wordId, timestamp, timestamp);
  }
  return { userId: user.id };
}

