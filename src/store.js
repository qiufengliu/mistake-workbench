// 纯逻辑：不碰 DOM，方便测试。
export const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '其他'];
export const CAUSES = ['粗心', '概念不清', '方法不会', '计算错误', '审题错误', '没复习到'];

let counter = 0;
export function newId() {
  counter += 1;
  return `m${Date.now().toString(36)}${counter}${Math.random().toString(36).slice(2, 6)}`;
}

export function createItem(input, now = new Date()) {
  const question = String(input.question || '').trim();
  if (!question && !input.image) throw new Error('请填写题目或上传图片');
  return {
    id: input.id || newId(),
    subject: SUBJECTS.includes(input.subject) ? input.subject : '其他',
    question,
    image: input.image || '',
    wrongAnswer: String(input.wrongAnswer || '').trim(),
    correctAnswer: String(input.correctAnswer || '').trim(),
    analysis: String(input.analysis || '').trim(),
    cause: CAUSES.includes(input.cause) ? input.cause : '',
    point: String(input.point || '').trim(),
    mastered: Boolean(input.mastered),
    reviewCount: Number(input.reviewCount) || 0,
    createdAt: input.createdAt || now.toISOString(),
    lastReviewedAt: input.lastReviewedAt || '',
  };
}

export function filterItems(items, { subject = '', status = '', cause = '', q = '' } = {}) {
  const kw = q.trim().toLowerCase();
  return items.filter((it) => {
    if (subject && it.subject !== subject) return false;
    if (cause && it.cause !== cause) return false;
    if (status === 'open' && it.mastered) return false;
    if (status === 'mastered' && !it.mastered) return false;
    if (kw) {
      const hay = [it.question, it.wrongAnswer, it.correctAnswer, it.analysis, it.point].join(' ').toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}

export function stats(items) {
  const bySubject = {};
  const byCause = {};
  let mastered = 0;
  for (const it of items) {
    bySubject[it.subject] = (bySubject[it.subject] || 0) + 1;
    if (it.cause) byCause[it.cause] = (byCause[it.cause] || 0) + 1;
    if (it.mastered) mastered += 1;
  }
  return { total: items.length, mastered, open: items.length - mastered, bySubject, byCause };
}

// 复习队列：只取未掌握的；复习次数少、很久没看的排前面。
export function reviewQueue(items, subject = '', limit = 10) {
  return items
    .filter((it) => !it.mastered && (!subject || it.subject === subject))
    .sort((a, b) => a.reviewCount - b.reviewCount || (a.lastReviewedAt || '').localeCompare(b.lastReviewedAt || ''))
    .slice(0, limit);
}

export function markReviewed(item, remembered, now = new Date()) {
  const reviewCount = item.reviewCount + 1;
  return {
    ...item,
    reviewCount,
    lastReviewedAt: now.toISOString(),
    // 连续答对 3 次视为掌握；答错则取消掌握。
    mastered: remembered ? item.mastered || reviewCount >= 3 : false,
  };
}

export function serialize(items) {
  return JSON.stringify({ version: 1, items }, null, 2);
}

export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('文件不是有效的 JSON');
  }
  const list = Array.isArray(data) ? data : data && data.items;
  if (!Array.isArray(list)) throw new Error('文件里没有错题数据');
  return list.map((x) => createItem(x));
}

export function mergeItems(existing, incoming) {
  const map = new Map(existing.map((x) => [x.id, x]));
  for (const it of incoming) map.set(it.id, it);
  return [...map.values()];
}
