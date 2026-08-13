// 本地内容数据源 —— 补后端缺口
// 后端内容模型只有 PDF/媒体资源，没有句子级绘本正文、口语脚本、闯关题库。
// 这里维护「可读文本 / 口语脚本 / 图文题库 / 单词图鉴」结构化数据；
// 真实 API（计划/单词/会话/事件/统计/内容元数据）照常由 utils/api.js 调用。
//
// token 约定（供阅读器查词高亮）：
//   { t: '连接文本' }                                 普通文本，直接显示
//   { t: 'word', w: 1, hl: 'sky', mean: '...', ph: '音·节' }  可点查词

// ── 分级绘本 ──
const books = [
  {
    key: 'little-monkey-tree',
    title: "Little Monkey's Tree",
    level: 'AA',
    cover: '🐒',
    scene: '🐒🌳',
    topic: 'animals',
    minutes: 3,
    pages: [
      [
        { t: 'The ' },
        { t: 'little', w: 1, hl: 'amber', mean: 'adj. 小的', ph: 'lit·tle' },
        { t: ' ' },
        { t: 'monkey', w: 1, hl: 'sky', mean: 'n. 猴子', ph: 'mon·key' },
        { t: ' is here.' }
      ],
      [
        { t: 'It sees a ' },
        { t: 'tall', w: 1, hl: 'amber', mean: 'adj. 高的', ph: 'tall' },
        { t: ' ' },
        { t: 'tree', w: 1, hl: 'grass', mean: 'n. 树', ph: 'tree' },
        { t: '.' }
      ],
      [
        { t: 'The monkey starts ' },
        { t: 'climbing', w: 1, hl: 'amber', mean: 'v. 攀爬', ph: 'climb·ing' },
        { t: ' up.' }
      ],
      [
        { t: 'Up, up, up! It is so ' },
        { t: 'high', w: 1, hl: 'sky', mean: 'adj. 高的', ph: 'high' },
        { t: '!' }
      ],
      [
        { t: 'At the top, it finds a ' },
        { t: 'banana', w: 1, hl: 'sunny', mean: 'n. 香蕉', ph: 'ba·na·na' },
        { t: '.' }
      ],
      [
        { t: '"Yum!" says the ' },
        { t: 'happy', w: 1, hl: 'pinky', mean: 'adj. 开心的', ph: 'hap·py' },
        { t: ' monkey.' }
      ]
    ]
  },
  {
    key: 'hello-animals',
    title: 'Hello Animals',
    level: 'A',
    cover: '🐘',
    scene: '🐘🦒🦁',
    topic: 'animals',
    minutes: 3,
    pages: [
      [
        { t: 'Hello, ' },
        { t: 'elephant', w: 1, hl: 'sky', mean: 'n. 大象', ph: 'el·e·phant' },
        { t: '! You are ' },
        { t: 'big', w: 1, hl: 'amber', mean: 'adj. 大的', ph: 'big' },
        { t: '.' }
      ],
      [
        { t: 'Hello, ' },
        { t: 'giraffe', w: 1, hl: 'sunny', mean: 'n. 长颈鹿', ph: 'gi·raffe' },
        { t: '! You are ' },
        { t: 'tall', w: 1, hl: 'amber', mean: 'adj. 高的', ph: 'tall' },
        { t: '.' }
      ],
      [
        { t: 'Hello, ' },
        { t: 'lion', w: 1, hl: 'coral', mean: 'n. 狮子', ph: 'li·on' },
        { t: '! You are ' },
        { t: 'strong', w: 1, hl: 'grape', mean: 'adj. 强壮的', ph: 'strong' },
        { t: '.' }
      ],
      [
        { t: 'Hello, ' },
        { t: 'rabbit', w: 1, hl: 'pinky', mean: 'n. 兔子', ph: 'rab·bit' },
        { t: '! You are ' },
        { t: 'fast', w: 1, hl: 'sky', mean: 'adj. 快的', ph: 'fast' },
        { t: '.' }
      ],
      [
        { t: 'Goodbye, animals! See you ' },
        { t: 'soon', w: 1, hl: 'grass', mean: 'adv. 很快', ph: 'soon' },
        { t: '!' }
      ]
    ]
  },
  {
    key: 'my-green-garden',
    title: 'My Green Garden',
    level: 'B',
    cover: '🌷',
    scene: '🌷🐝🌱',
    topic: 'nature',
    minutes: 4,
    pages: [
      [
        { t: 'This is my ' },
        { t: 'garden', w: 1, hl: 'grass', mean: 'n. 花园', ph: 'gar·den' },
        { t: '. It is ' },
        { t: 'green', w: 1, hl: 'grass', mean: 'adj. 绿色的', ph: 'green' },
        { t: '.' }
      ],
      [
        { t: 'A little ' },
        { t: 'seed', w: 1, hl: 'amber', mean: 'n. 种子', ph: 'seed' },
        { t: ' grows into a ' },
        { t: 'flower', w: 1, hl: 'pinky', mean: 'n. 花', ph: 'flow·er' },
        { t: '.' }
      ],
      [
        { t: 'A busy ' },
        { t: 'bee', w: 1, hl: 'sunny', mean: 'n. 蜜蜂', ph: 'bee' },
        { t: ' comes to ' },
        { t: 'visit', w: 1, hl: 'sky', mean: 'v. 拜访', ph: 'vis·it' },
        { t: '.' }
      ],
      [
        { t: 'I give the plants some ' },
        { t: 'water', w: 1, hl: 'sky', mean: 'n. 水', ph: 'wa·ter' },
        { t: ' every day.' }
      ],
      [
        { t: 'My garden makes me very ' },
        { t: 'proud', w: 1, hl: 'grape', mean: 'adj. 自豪的', ph: 'proud' },
        { t: '.' }
      ]
    ]
  }
];

// ── AI 口语场景（脚本模拟）──
// turns：AI 台词逐条推进；userHints 为示范表达；correction 为温和纠错示例。
const scenes = [
  {
    key: 'at-the-zoo',
    title: 'At the Zoo',
    partner: 'Sam',
    cover: '🦁',
    level: 'A1',
    minutes: 5,
    unlocked: true,
    desc: '和 Sam 一起逛动物园，说说你看到的动物。',
    turns: [
      { ai: 'Hi! Welcome to the zoo. What animal do you want to see first?', hint: 'I want to see the lions.' },
      { ai: 'Great choice! The lions are over there. What color are they?', hint: 'They are yellow and brown.' },
      { ai: 'Yes! And they are very strong. Can you roar like a lion?', hint: 'Roar! Roar!', correction: '试试完整句："A lion says roar!"' },
      { ai: 'Haha, awesome roar! Which animal should we visit next?', hint: 'Let\'s go to the monkeys!' }
    ]
  },
  {
    key: 'at-a-restaurant',
    title: 'At a Restaurant',
    partner: 'Sam',
    cover: '🍽️',
    level: 'A1',
    minutes: 5,
    unlocked: true,
    desc: '在餐厅点一份你最爱的食物。',
    turns: [
      { ai: 'Good evening! Here is the menu. What would you like to eat?', hint: 'I would like a pizza, please.' },
      { ai: 'Yummy! Anything to drink?', hint: 'Some orange juice, please.' },
      { ai: 'Perfect. Would you like a small or large size?', hint: 'A large one, please.' },
      { ai: 'Coming right up! Enjoy your meal!', hint: 'Thank you very much!' }
    ]
  },
  {
    key: 'my-school-day',
    title: 'My School Day',
    partner: 'Sam',
    cover: '🎒',
    level: 'A1',
    minutes: 6,
    unlocked: true,
    desc: '聊聊你在学校的一天。',
    turns: [
      { ai: 'Hello! How do you go to school every day?', hint: 'I go to school by bus.' },
      { ai: 'Nice! What is your favorite subject?', hint: 'My favorite subject is English.' },
      { ai: 'Cool! What do you do after school?', hint: 'I play football with my friends.' },
      { ai: 'Sounds fun! Have a great day at school!', hint: 'You too, Sam!' }
    ]
  },
  {
    key: 'asking-the-way',
    title: 'Asking the Way',
    partner: 'Sam',
    cover: '🗺️',
    level: 'A2',
    minutes: 6,
    unlocked: false,
    desc: '在城市里问路，找到图书馆。',
    turns: [
      { ai: 'Excuse me, do you need some help?', hint: 'Yes, where is the library?' }
    ]
  }
];

// ── 图文匹配闯关题库 ──
const quizzes = [
  { emoji: '🍎', answer: 'apple', options: ['banana', 'apple'] },
  { emoji: '🐘', answer: 'elephant', options: ['elephant', 'tiger'] },
  { emoji: '🌳', answer: 'tree', options: ['tree', 'flower'] },
  { emoji: '🚌', answer: 'bus', options: ['car', 'bus'] },
  { emoji: '🌧️', answer: 'rain', options: ['rain', 'sun'] }
];

// ── 单词图鉴主题（掌握度示例；真实待复习词从 /api/words/due 拉取叠加）──
const wordbook = {
  themes: [
    { key: 'all', label: '全部' },
    { key: 'animals', label: '动物' },
    { key: 'nature', label: '自然' },
    { key: 'life', label: '生活' }
  ],
  words: [
    { word: 'cat', emoji: '🐱', theme: 'animals', mastery: 90, state: 'mastered' },
    { word: 'dog', emoji: '🐶', theme: 'animals', mastery: 88, state: 'mastered' },
    { word: 'elephant', emoji: '🐘', theme: 'animals', mastery: 67, state: 'learning' },
    { word: 'lion', emoji: '🦁', theme: 'animals', mastery: 45, state: 'learning' },
    { word: 'tree', emoji: '🌳', theme: 'nature', mastery: 72, state: 'learning' },
    { word: 'flower', emoji: '🌷', theme: 'nature', mastery: 55, state: 'learning' },
    { word: 'bee', emoji: '🐝', theme: 'nature', mastery: 35, state: 'new' },
    { word: 'water', emoji: '💧', theme: 'nature', mastery: 80, state: 'mastered' },
    { word: 'bus', emoji: '🚌', theme: 'life', mastery: 60, state: 'learning' },
    { word: 'hello', emoji: '👋', theme: 'life', mastery: 95, state: 'mastered' },
    { word: 'pizza', emoji: '🍕', theme: 'life', mastery: 40, state: 'new' },
    { word: 'school', emoji: '🏫', theme: 'life', mastery: 50, state: 'learning' }
  ]
};

// ── 磨耳朵听力素材（双语逐句）──
const listening = [
  {
    key: 'morning-routine',
    title: 'My Morning',
    cover: '🌅',
    level: 'A',
    lines: [
      { en: 'I wake up at seven.', zh: '我七点起床。' },
      { en: 'I brush my teeth.', zh: '我刷牙。' },
      { en: 'I eat breakfast with my family.', zh: '我和家人吃早餐。' },
      { en: 'Then I go to school.', zh: '然后我去上学。' }
    ]
  },
  {
    key: 'weather-today',
    title: 'The Weather',
    cover: '⛅',
    level: 'A',
    lines: [
      { en: 'Today is sunny and warm.', zh: '今天阳光明媚，很温暖。' },
      { en: 'The sky is blue.', zh: '天空是蓝色的。' },
      { en: 'Let us go to the park!', zh: '我们去公园吧！' }
    ]
  }
];

function bookByKey(key) { return books.find(b => b.key === key); }
function sceneByKey(key) { return scenes.find(s => s.key === key); }

module.exports = { books, scenes, quizzes, wordbook, listening, bookByKey, sceneByKey };
