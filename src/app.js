import { SUBJECTS, CAUSES, createItem, filterItems, stats, reviewQueue, markReviewed, serialize, parseImport, mergeItems } from './store.js';

const KEY = 'mistake-workbench:items:v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const save = (items) => localStorage.setItem(KEY, JSON.stringify(items));

let items = load();
let reviewing = null; // {queue, idx, item}

const $ = (sel) => document.querySelector(sel);
const fillOptions = (sel, values, withAll) => {
  const el = $(sel);
  el.innerHTML = (withAll ? [[  '', withAll]] : []).concat(values.map((v) => [v, v]))
    .map(([val, label]) => `<option value="${val}">${label}</option>`).join('');
};

fillOptions('#f-subject', SUBJECTS, '全部科目');
fillOptions('#f-cause', CAUSES, '全部错因');
fillOptions('#r-subject', SUBJECTS, '全部科目');
fillOptions('#in-subject', SUBJECTS);
fillOptions('#in-cause', CAUSES, '不填');

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function renderList() {
  const q = { subject: $('#f-subject').value, cause: $('#f-cause').value, status: $('#f-status').value, q: $('#f-q').value };
  const shown = filterItems(items, q);
  $('#empty').hidden = items.length > 0;
  $('#cards').innerHTML = shown.map((it) => `
    <li class="card ${it.mastered ? 'done' : ''}" data-id="${it.id}">
      <div class="meta">
        <span class="tag subject">${esc(it.subject)}</span>
        ${it.cause ? `<span class="tag">${esc(it.cause)}</span>` : ''}
        ${it.point ? `<span class="tag">${esc(it.point)}</span>` : ''}
        <span class="tag">${it.mastered ? '已掌握' : '未掌握'} · 复习${it.reviewCount}次</span>
      </div>
      <p class="q">${esc(it.question) || '(见图片)'}</p>
      ${it.image ? `<img src="${it.image}" alt="题目图片" loading="lazy">` : ''}
      <details>
        <summary>查看答案与解析</summary>
        ${it.wrongAnswer ? `<p class="row wrong"><b>我的答案：</b>${esc(it.wrongAnswer)}</p>` : ''}
        ${it.correctAnswer ? `<p class="row right"><b>正确答案：</b>${esc(it.correctAnswer)}</p>` : ''}
        ${it.analysis ? `<p class="row"><b>解析：</b>${esc(it.analysis)}</p>` : ''}
      </details>
      <div class="card-actions">
        <button data-act="toggle">${it.mastered ? '标记未掌握' : '标记已掌握'}</button>
        <button data-act="delete">删除</button>
      </div>
    </li>`).join('');
}

function renderStats() {
  const s = stats(items);
  const bar = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) =>
    `<div class="bar"><span class="label">${esc(k)}</span><i style="width:${Math.max(4, v / Math.max(1, s.total) * 200)}px"></i><span>${v}</span></div>`).join('') || '<p class="muted">暂无数据</p>';
  $('#stats-box').innerHTML = `
    <div class="stat-grid">
      <div class="stat"><b>${s.total}</b>总错题</div>
      <div class="stat"><b>${s.open}</b>未掌握</div>
      <div class="stat"><b>${s.mastered}</b>已掌握</div>
    </div>
    <h3>按科目</h3>${bar(s.bySubject)}
    <h3>按错因</h3>${bar(s.byCause)}`;
}

function renderReviewIdle() {
  $('#review-box').innerHTML = '<p class="muted">选科目后点“开始复习”，一题一题过。</p>';
}

function renderReviewCard() {
  const it = reviewing.item;
  $('#review-box').innerHTML = `
    <p class="muted">第 ${reviewing.idx + 1} / ${reviewing.queue.length} 题</p>
    <p class="q">${esc(it.question) || '(见图片)'}</p>
    ${it.image ? `<img src="${it.image}" alt="题目图片">` : ''}
    <details id="rv-ans"><summary>看答案</summary>
      ${it.correctAnswer ? `<p class="row right"><b>正确答案：</b>${esc(it.correctAnswer)}</p>` : ''}
      ${it.analysis ? `<p class="row"><b>解析：</b>${esc(it.analysis)}</p>` : ''}
    </details>
    <div class="btns">
      <button data-rv="no">我又错了</button>
      <button data-rv="yes" class="primary">我记住了</button>
    </div>`;
}

function nextReview(remembered) {
  const i = items.findIndex((x) => x.id === reviewing.item.id);
  if (i >= 0) { items[i] = markReviewed(items[i], remembered); save(items); }
  reviewing.idx += 1;
  if (reviewing.idx >= reviewing.queue.length) { reviewing = null; renderReviewIdle(); renderList(); renderStats(); return; }
  reviewing.item = reviewing.queue[reviewing.idx];
  renderReviewCard();
}

// tabs
document.querySelectorAll('.tab').forEach((btn) => btn.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
  for (const id of ['list', 'review', 'stats']) $(`#tab-${id}`).hidden = `tab-${id}` !== `tab-${btn.dataset.tab}`;
}));

['#f-q', '#f-subject', '#f-cause', '#f-status'].forEach((sel) => $(sel).addEventListener('input', renderList));

$('#r-start').addEventListener('click', () => {
  const q = reviewQueue(items, $('#r-subject').value, 20);
  if (!q.length) { $('#review-box').innerHTML = '<p class="muted">这个范围里没有要复习的题，都掌握了！</p>'; return; }
  reviewing = { queue: q, idx: 0, item: q[0] };
  renderReviewCard();
});

$('#review-box').addEventListener('click', (e) => {
  const act = e.target.dataset.rv;
  if (act) nextReview(act === 'yes');
});

$('#cards').addEventListener('click', (e) => {
  const li = e.target.closest('.card');
  if (!li) return;
  const id = li.dataset.id;
  const act = e.target.dataset.act;
  if (act === 'delete') {
    if (!confirm('删除这道错题？不可恢复。')) return;
    items = items.filter((x) => x.id !== id);
  } else if (act === 'toggle') {
    items = items.map((x) => (x.id === id ? { ...x, mastered: !x.mastered } : x));
  } else return;
  save(items); renderList(); renderStats();
});

// add dialog
const dlg = $('#dlg'); const form = $('#form');
let pendingImage = '';
$('#btn-add').addEventListener('click', () => {
  form.reset(); pendingImage = ''; $('#in-preview').hidden = true; $('#form-err').textContent = '';
  $('#dlg-title').textContent = '添加错题';
  dlg.showModal();
});
$('#dlg-cancel').addEventListener('click', () => dlg.close());
$('#in-image').addEventListener('change', async () => {
  const f = $('#in-image').files[0];
  if (!f) return;
  pendingImage = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
  $('#in-preview').src = pendingImage; $('#in-preview').hidden = false;
});
form.addEventListener('submit', (e) => {
  const fd = new FormData(form);
  try {
    const it = createItem({ ...Object.fromEntries(fd), image: pendingImage });
    items = [it, ...items]; save(items); renderList(); renderStats();
  } catch (err) {
    e.preventDefault();
    $('#form-err').textContent = err.message;
  }
});

// export / import
$('#btn-export').addEventListener('click', () => {
  const blob = new Blob([serialize(items)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mistakes-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$('#file-import').addEventListener('change', async () => {
  const f = $('#file-import').files[0];
  if (!f) return;
  try {
    const incoming = parseImport(await f.text());
    items = mergeItems(items, incoming); save(items); renderList(); renderStats();
    alert(`导入了 ${incoming.length} 条错题。`);
  } catch (err) { alert('导入失败：' + err.message); }
  $('#file-import').value = '';
});

renderList(); renderStats(); renderReviewIdle();
