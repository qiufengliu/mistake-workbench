import { describe, it, expect } from 'vitest';
import { createItem, filterItems, stats, reviewQueue, markReviewed, parseImport, mergeItems } from '../src/store.js';

describe('createItem', () => {
  it('builds a normalized item', () => {
    const it0 = createItem({ subject: '数学', question: ' 1+1=? ', cause: '粗心' });
    expect(it0.subject).toBe('数学');
    expect(it0.question).toBe('1+1=?');
    expect(it0.mastered).toBe(false);
    expect(it0.id).toBeTruthy();
  });

  it('rejects empty question with no image', () => {
    expect(() => createItem({ question: '  ' })).toThrow();
  });

  it('allows image-only item', () => {
    const it0 = createItem({ image: 'data:image/png;base64,xx' });
    expect(it0.image).toContain('data:image');
  });

  it('falls back unknown subject/cause to safe defaults', () => {
    const it0 = createItem({ question: 'q', subject: 'nope', cause: 'nope' });
    expect(it0.subject).toBe('其他');
    expect(it0.cause).toBe('');
  });
});

describe('filterItems', () => {
  const items = [
    createItem({ subject: '数学', question: '二次方程', cause: '方法不会', mastered: false }),
    createItem({ subject: '英语', question: '时态', cause: '粗心', mastered: true }),
  ];

  it('filters by subject', () => {
    expect(filterItems(items, { subject: '数学' })).toHaveLength(1);
  });

  it('filters by status', () => {
    expect(filterItems(items, { status: 'mastered' })).toHaveLength(1);
    expect(filterItems(items, { status: 'open' })).toHaveLength(1);
  });

  it('filters by keyword across fields', () => {
    expect(filterItems(items, { q: '时态' })).toHaveLength(1);
    expect(filterItems(items, { q: 'xyz' })).toHaveLength(0);
  });
});

describe('stats', () => {
  it('aggregates counts', () => {
    const items = [
      createItem({ subject: '数学', question: 'a', cause: '粗心', mastered: true }),
      createItem({ subject: '数学', question: 'b', cause: '粗心' }),
    ];
    const s = stats(items);
    expect(s.total).toBe(2);
    expect(s.mastered).toBe(1);
    expect(s.bySubject['数学']).toBe(2);
    expect(s.byCause['粗心']).toBe(2);
  });
});

describe('reviewQueue', () => {
  it('excludes mastered items and respects limit', () => {
    const items = [
      createItem({ question: 'a', mastered: true }),
      createItem({ question: 'b' }),
      createItem({ question: 'c' }),
    ];
    expect(reviewQueue(items, '', 1)).toHaveLength(1);
    expect(reviewQueue(items, '', 10)).toHaveLength(2);
  });

  it('prioritizes items with fewer reviews', () => {
    const a = { ...createItem({ question: 'a' }), reviewCount: 3 };
    const b = { ...createItem({ question: 'b' }), reviewCount: 0 };
    const q = reviewQueue([a, b], '', 10);
    expect(q[0].question).toBe('b');
  });
});

describe('markReviewed', () => {
  it('masters after 3 remembered reviews', () => {
    let it0 = createItem({ question: 'a' });
    it0 = markReviewed(it0, true);
    it0 = markReviewed(it0, true);
    expect(it0.mastered).toBe(false);
    it0 = markReviewed(it0, true);
    expect(it0.mastered).toBe(true);
    expect(it0.reviewCount).toBe(3);
  });

  it('un-masters on a forgotten review', () => {
    let it0 = { ...createItem({ question: 'a' }), mastered: true, reviewCount: 3 };
    it0 = markReviewed(it0, false);
    expect(it0.mastered).toBe(false);
  });
});

describe('import/export', () => {
  it('parses a valid export payload', () => {
    const items = [createItem({ question: 'a' })];
    const text = JSON.stringify({ version: 1, items });
    const parsed = parseImport(text);
    expect(parsed).toHaveLength(1);
  });

  it('rejects invalid json', () => {
    expect(() => parseImport('not json')).toThrow();
  });

  it('rejects payload without items array', () => {
    expect(() => parseImport(JSON.stringify({ foo: 1 }))).toThrow();
  });

  it('merges by id without duplicating', () => {
    const a = createItem({ question: 'a' });
    const merged = mergeItems([a], [{ ...a, mastered: true }]);
    expect(merged).toHaveLength(1);
    expect(merged[0].mastered).toBe(true);
  });
});
