import { SUBJECTS, CAUSES, createItem, filterItems, stats, reviewQueue, markReviewed, serialize, parseImport, mergeItems } from './store.js';
import { compressImage, dataUrlBytes, isQuotaError } from './image.js';

const KEY = 'mistake-workbench:items:v1';
const FULL_MSG = '浏览器存储满了，保存失败。请先导出备份，再删掉一些带图片的错题。';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
// 保存成功返回 true；存储满时返回 false，不抛错。
const save = (items) => {
  try { localStorage.setItem(KEY, JSON.stringify(items)); return true; } catch (err) {
    if (isQuotaError(err)) return false;
    throw err;
  }
};
// 改动 items 后保存；失败就回滚到改动前，并提示。
function commit(next) {
  if (!save(next)) { alert(FULL_MSG); return false; }
  items = next; return true;
}

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
  if (i >= 0) commit(items.map((x, j) => (j === i ? markReviewed(x, remembered) : x)));
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
  let next;
  if (act === 'delete') {
    if (!confirm('删除这道错题？不可恢复。')) return;
    next = items.filter((x) => x.id !== id);
  } else if (act === 'toggle') {
    next = items.map((x) => (x.id === id ? { ...x, mastered: !x.mastered } : x));
  } else return;
  commit(next); renderList(); renderStats();
});

// add dialog
const dlg = $('#dlg'); const form = $('#form');
let pendingImage = '';
let imageBusy = false;
function setImage(dataUrl, msg = '') {
  pendingImage = dataUrl;
  $('#in-preview').src = dataUrl || '';
  $('#in-preview').hidden = !dataUrl;
  $('#in-clear-image').hidden = !dataUrl;
  $('#in-image-msg').textContent = msg;
}
$('#btn-add').addEventListener('click', () => {
  form.reset(); setImage(''); $('#form-err').textContent = '';
  $('#dlg-title').textContent = '添加错题';
  dlg.showModal();
});
$('#dlg-cancel').addEventListener('click', () => dlg.close());
async function onPick(input) {
  const f = input.files[0];
  input.value = ''; // 允许连续选同一张
  if (!f) return;
  imageBusy = true;
  $('#in-image-msg').textContent = '正在压缩图片…';
  try {
    const url = await compressImage(f);
    const kb = Math.round(dataUrlBytes(url) / 1024);
    setImage(url, `已压缩：${Math.round(f.size / 1024)} KB → ${kb} KB`);
  } catch (err) {
    setImage('', '图片读取失败：' + err.message);
  } finally { imageBusy = false; }
}
$('#in-camera').addEventListener('change', (e) => onPick(e.target));
$('#in-image').addEventListener('change', (e) => onPick(e.target));
$('#in-clear-image').addEventListener('click', () => setImage(''));
form.addEventListener('submit', (e) => {
  if (imageBusy) { e.preventDefault(); $('#form-err').textContent = '图片还在压缩，请稍等。'; return; }
  const fd = new FormData(form);
  try {
    const it = createItem({ ...Object.fromEntries(fd), image: pendingImage });
    if (!save([it, ...items])) {
      e.preventDefault(); // 不关对话框，内容不丢
      $('#form-err').textContent = FULL_MSG;
      return;
    }
    items = [it, ...items]; renderList(); renderStats();
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
    if (commit(mergeItems(items, incoming))) {
      renderList(); renderStats();
      alert(`导入了 ${incoming.length} 条错题。`);
    }
  } catch (err) { alert('导入失败：' + err.message); }
  $('#file-import').value = '';
});

renderList(); renderStats(); renderReviewIdle();
