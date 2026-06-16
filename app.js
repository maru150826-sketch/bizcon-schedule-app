// ============================================================
// Supabase設定済み版
// GitHub Pagesにそのまま上げ直してください。
// secret key / service_role key は絶対に入れないでください。
// ============================================================
const SUPABASE_URL = 'https://dgaveiimlslljluimqxn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JPpJW8RmeDVGESJtJatwbA_IH6PIXKE';

const sb = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  groupId: new URLSearchParams(location.search).get('group'),
  group: null,
  currentMember: null,
  members: [],
  slots: [],
  responses: [],
  notes: [],
};

const $ = (id) => document.getElementById(id);
const els = {
  loading: $('loading'), toast: $('toast'), setupNotice: $('setupNotice'),
  createGroupSection: $('createGroupSection'), groupSection: $('groupSection'), memberSection: $('memberSection'),
  confirmedSection: $('confirmedSection'), slotSection: $('slotSection'), candidateSection: $('candidateSection'),
  tableSection: $('tableSection'), notesSection: $('notesSection'), groupForm: $('groupForm'), memberForm: $('memberForm'),
  slotForm: $('slotForm'), notesForm: $('notesForm'), candidateList: $('candidateList'), summaryTable: $('summaryTable'),
};

function isConfigured() {
  return Boolean(sb && SUPABASE_URL.startsWith('https://') && !SUPABASE_URL.includes('YOUR-PROJECT') && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY');
}
function setLoading(v) { els.loading.classList.toggle('is-hidden', !v); }
function showToast(message, type = 'info') {
  els.toast.textContent = message;
  els.toast.className = `toast ${type === 'error' ? 'error' : ''}`;
  els.toast.classList.remove('is-hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.add('is-hidden'), 3800);
}
function fail(message, error) {
  console.error(message, error);
  showToast(`${message}${error?.message ? '：' + error.message : ''}`, 'error');
}
function esc(v = '') {
  return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}
function jpDate(date) {
  if (!date) return '';
  const d = new Date(`${date}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function hm(t) { return String(t || '').slice(0,5); }
function statusMark(status) {
  if (status === 'available') return '○';
  if (status === 'maybe') return '△';
  if (status === 'unavailable') return '×';
  return '未';
}
function statusClass(status) {
  return status ? `status-${status}` : 'status-none';
}
function currentUrl() {
  const base = location.href.split('?')[0];
  return `${base}?group=${state.groupId}`;
}

async function init() {
  if (!isConfigured()) {
    els.setupNotice.classList.remove('is-hidden');
    return;
  }
  bindEvents();
  if (state.groupId) await loadGroup();
}
function bindEvents() {
  els.groupForm.addEventListener('submit', createGroup);
  els.memberForm.addEventListener('submit', joinMember);
  els.slotForm.addEventListener('submit', addSlot);
  els.notesForm.addEventListener('submit', saveNotes);
  $('copyUrlBtn')?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(currentUrl());
    showToast('共有URLをコピーしました');
  });
}

async function createGroup(e) {
  e.preventDefault(); setLoading(true);
  const f = new FormData(e.currentTarget);
  const payload = {
    name: f.get('name')?.trim(), description: f.get('description')?.trim(),
    purpose: f.get('purpose')?.trim(), admin_name: f.get('admin_name')?.trim(),
  };
  const { data, error } = await sb.from('groups').insert(payload).select().single();
  setLoading(false);
  if (error) return fail('グループ作成に失敗しました', error);
  location.href = `${location.href.split('?')[0]}?group=${data.id}`;
}

async function loadGroup() {
  setLoading(true);
  const { data, error } = await sb.from('groups').select('*').eq('id', state.groupId).single();
  if (error) { setLoading(false); return fail('グループ読み込みに失敗しました', error); }
  state.group = data;
  await loadAll();
  setLoading(false);
  render();
}
async function loadAll() {
  const [members, slots, responses, notes] = await Promise.all([
    sb.from('members').select('*').eq('group_id', state.groupId).order('created_at'),
    sb.from('time_slots').select('*').eq('group_id', state.groupId).order('date').order('start_time'),
    sb.from('responses').select('*').eq('group_id', state.groupId),
    sb.from('meeting_notes').select('*').eq('group_id', state.groupId),
  ]);
  for (const r of [members, slots, responses, notes]) if (r.error) throw r.error;
  state.members = members.data || [];
  state.slots = slots.data || [];
  state.responses = responses.data || [];
  state.notes = notes.data || [];
  const saved = localStorage.getItem(`member:${state.groupId}`);
  state.currentMember = state.members.find(m => m.id === saved) || null;
}
function render() {
  els.createGroupSection.classList.add('is-hidden');
  for (const el of [els.groupSection, els.memberSection, els.confirmedSection, els.slotSection, els.candidateSection, els.tableSection]) el.classList.remove('is-hidden');
  $('groupName').textContent = state.group.name;
  $('groupDescription').textContent = state.group.description || '';
  $('groupPurpose').textContent = state.group.purpose || '';
  $('shareUrl').textContent = currentUrl();
  renderMembers(); renderConfirmed(); renderCandidates(); renderTable(); renderNotes();
}
function renderMembers() {
  const box = $('currentMemberBox');
  if (state.currentMember) {
    box.classList.remove('is-hidden');
    box.innerHTML = `現在の回答者：<b>${esc(state.currentMember.name)}</b>${state.currentMember.role_memo ? ` / ${esc(state.currentMember.role_memo)}` : ''}`;
  } else box.classList.add('is-hidden');
  $('memberList').innerHTML = state.members.length ? state.members.map(m => `<span class="pill">${esc(m.name)}${m.role_memo ? `：${esc(m.role_memo)}` : ''}</span>`).join('') : '<div class="empty">まだメンバーがいません。</div>';
}
async function joinMember(e) {
  e.preventDefault(); setLoading(true);
  const f = new FormData(e.currentTarget);
  const name = f.get('name')?.trim(); const role_memo = f.get('role_memo')?.trim();
  const existing = state.members.find(m => m.name === name);
  if (existing) {
    if (role_memo && role_memo !== existing.role_memo) await sb.from('members').update({ role_memo }).eq('id', existing.id);
    localStorage.setItem(`member:${state.groupId}`, existing.id);
    await loadAll(); setLoading(false); render(); showToast('既存メンバーとして参加しました'); return;
  }
  const { data, error } = await sb.from('members').insert({ group_id: state.groupId, name, role_memo }).select().single();
  if (error) { setLoading(false); return fail('メンバー登録に失敗しました', error); }
  localStorage.setItem(`member:${state.groupId}`, data.id);
  await loadAll(); setLoading(false); render(); showToast('メンバーとして参加しました');
}
async function addSlot(e) {
  e.preventDefault(); setLoading(true);
  const f = new FormData(e.currentTarget);
  const payload = { group_id: state.groupId, date: f.get('date'), start_time: f.get('start_time'), end_time: f.get('end_time'), task_title: f.get('task_title')?.trim(), location: f.get('location')?.trim(), memo: f.get('memo')?.trim() };
  const { error } = await sb.from('time_slots').insert(payload);
  if (error) { setLoading(false); return fail('候補日時の追加に失敗しました', error); }
  e.currentTarget.reset(); await loadAll(); setLoading(false); render(); showToast('候補日時を追加しました');
}
function counts(slotId) {
  const rows = state.responses.filter(r => r.time_slot_id === slotId);
  return { available: rows.filter(r => r.status === 'available').length, maybe: rows.filter(r => r.status === 'maybe').length, unavailable: rows.filter(r => r.status === 'unavailable').length };
}
function bestSlotId() {
  if (!state.slots.length) return null;
  return [...state.slots].sort((a,b) => {
    const ca = counts(a.id), cb = counts(b.id);
    return (cb.available - ca.available) || (ca.unavailable - cb.unavailable) || (cb.maybe - ca.maybe);
  })[0]?.id;
}
function judge(slot) {
  const c = counts(slot.id);
  if (slot.id === bestSlotId() && (c.available > 0 || c.maybe > 0)) return '最有力';
  if (c.unavailable >= Math.max(1, Math.ceil(state.members.length / 2))) return '微妙';
  if (c.available + c.maybe > 0) return '候補';
  return '未回答';
}
function renderCandidates() {
  if (!state.slots.length) { els.candidateList.innerHTML = '<div class="empty">まだ候補日時がありません。</div>'; return; }
  els.candidateList.innerHTML = state.slots.map(slot => {
    const my = state.currentMember ? state.responses.find(r => r.time_slot_id === slot.id && r.member_id === state.currentMember.id) : null;
    const c = counts(slot.id);
    return `<article class="slot-card ${slot.is_confirmed ? 'confirmed' : ''}">
      <div class="slot-top">
        <div><div class="slot-time">${jpDate(slot.date)} ${hm(slot.start_time)}〜${hm(slot.end_time)}</div>
        <div class="slot-meta">作業内容：${esc(slot.task_title || '未設定')}<br>場所：${esc(slot.location || '未設定')}<br>メモ：${esc(slot.memo || '')}</div></div>
        <div class="judge">${slot.is_confirmed ? '確定' : judge(slot)}</div>
      </div>
      <div class="slot-meta">○ ${c.available} / △ ${c.maybe} / × ${c.unavailable}</div>
      <div class="response-row">
        <label>参加可否
          <select data-slot="${slot.id}" class="status-input" ${!state.currentMember ? 'disabled' : ''}>
            <option value="">未回答</option>
            <option value="available" ${my?.status === 'available' ? 'selected' : ''}>○ 参加できる</option>
            <option value="maybe" ${my?.status === 'maybe' ? 'selected' : ''}>△ 条件付き</option>
            <option value="unavailable" ${my?.status === 'unavailable' ? 'selected' : ''}>× 参加できない</option>
          </select>
        </label>
        <label>コメント
          <input data-slot="${slot.id}" class="comment-input" value="${esc(my?.comment || '')}" placeholder="例：19時からなら参加できます" ${!state.currentMember ? 'disabled' : ''} />
        </label>
        <button type="button" class="secondary save-response" data-slot="${slot.id}" ${!state.currentMember ? 'disabled' : ''}>回答保存</button>
      </div>
      <button type="button" class="primary confirm-slot" data-slot="${slot.id}" style="margin-top:12px;">この日時で確定</button>
    </article>`;
  }).join('');
  document.querySelectorAll('.save-response').forEach(b => b.addEventListener('click', saveResponse));
  document.querySelectorAll('.confirm-slot').forEach(b => b.addEventListener('click', confirmSlot));
}
async function saveResponse(e) {
  if (!state.currentMember) return showToast('先にメンバーとして参加してください', 'error');
  const slotId = e.currentTarget.dataset.slot;
  const status = document.querySelector(`.status-input[data-slot="${slotId}"]`).value;
  const comment = document.querySelector(`.comment-input[data-slot="${slotId}"]`).value.trim();
  if (!status) return showToast('○△×を選択してください', 'error');
  setLoading(true);
  const existing = state.responses.find(r => r.member_id === state.currentMember.id && r.time_slot_id === slotId);
  const payload = { group_id: state.groupId, member_id: state.currentMember.id, time_slot_id: slotId, status, comment, updated_at: new Date().toISOString() };
  const { error } = existing ? await sb.from('responses').update(payload).eq('id', existing.id) : await sb.from('responses').insert(payload);
  if (error) { setLoading(false); return fail('回答保存に失敗しました', error); }
  await loadAll(); setLoading(false); render(); showToast('回答を保存しました');
}
async function confirmSlot(e) {
  const slotId = e.currentTarget.dataset.slot; setLoading(true);
  const a = await sb.from('time_slots').update({ is_confirmed: false }).eq('group_id', state.groupId);
  const b = await sb.from('time_slots').update({ is_confirmed: true }).eq('id', slotId);
  if (a.error || b.error) { setLoading(false); return fail('確定日時の保存に失敗しました', a.error || b.error); }
  await loadAll(); setLoading(false); render(); showToast('日時を確定しました');
}
function renderConfirmed() {
  const slot = state.slots.find(s => s.is_confirmed);
  if (!slot) { $('confirmedBox').className = 'empty'; $('confirmedBox').textContent = 'まだ確定した作業予定はありません。'; return; }
  const avail = state.responses.filter(r => r.time_slot_id === slot.id && r.status === 'available').map(r => state.members.find(m => m.id === r.member_id)?.name).filter(Boolean);
  const maybe = state.responses.filter(r => r.time_slot_id === slot.id && r.status === 'maybe').map(r => state.members.find(m => m.id === r.member_id)?.name).filter(Boolean);
  $('confirmedBox').className = 'small-box confirmed';
  $('confirmedBox').innerHTML = `<b>${jpDate(slot.date)} ${hm(slot.start_time)}〜${hm(slot.end_time)}</b><br>作業内容：${esc(slot.task_title || '未設定')}<br>場所：${esc(slot.location || '未設定')}<br>参加予定者：${esc(avail.join('、') || 'なし')}<br>条件付き参加者：${esc(maybe.join('、') || 'なし')}<br>メモ：${esc(slot.memo || '')}`;
}
function renderTable() {
  if (!state.slots.length) { els.summaryTable.innerHTML = '<tr><td>まだ候補日時がありません。</td></tr>'; return; }
  const head = `<tr><th>候補日時</th><th>作業内容</th><th>場所</th>${state.members.map(m => `<th>${esc(m.name)}</th>`).join('')}<th>○人数</th><th>△人数</th><th>×人数</th><th>判定</th></tr>`;
  const body = state.slots.map(slot => {
    const c = counts(slot.id);
    const memberCells = state.members.map(m => {
      const r = state.responses.find(x => x.member_id === m.id && x.time_slot_id === slot.id);
      return `<td><span class="status-badge ${statusClass(r?.status)}">${statusMark(r?.status)}</span>${r?.comment ? `<br><small>${esc(r.comment)}</small>` : ''}</td>`;
    }).join('');
    return `<tr><td>${jpDate(slot.date)} ${hm(slot.start_time)}〜${hm(slot.end_time)}</td><td>${esc(slot.task_title || '')}</td><td>${esc(slot.location || '')}</td>${memberCells}<td>${c.available}</td><td>${c.maybe}</td><td>${c.unavailable}</td><td class="judge">${slot.is_confirmed ? '確定' : judge(slot)}</td></tr>`;
  }).join('');
  els.summaryTable.innerHTML = head + body;
}
function renderNotes() {
  const slot = state.slots.find(s => s.is_confirmed);
  els.notesSection.classList.toggle('is-hidden', !slot);
  if (!slot) return;
  const note = state.notes.find(n => n.time_slot_id === slot.id);
  els.notesForm.todo.value = note?.todo || '';
  els.notesForm.decisions.value = note?.decisions || '';
  els.notesForm.homework.value = note?.homework || '';
  els.notesForm.memo.value = note?.memo || '';
}
async function saveNotes(e) {
  e.preventDefault();
  const slot = state.slots.find(s => s.is_confirmed);
  if (!slot) return showToast('先に日時を確定してください', 'error');
  setLoading(true);
  const f = new FormData(e.currentTarget);
  const existing = state.notes.find(n => n.time_slot_id === slot.id);
  const payload = { group_id: state.groupId, time_slot_id: slot.id, todo: f.get('todo'), decisions: f.get('decisions'), homework: f.get('homework'), memo: f.get('memo'), updated_at: new Date().toISOString() };
  const { error } = existing ? await sb.from('meeting_notes').update(payload).eq('id', existing.id) : await sb.from('meeting_notes').insert(payload);
  if (error) { setLoading(false); return fail('メモ保存に失敗しました', error); }
  await loadAll(); setLoading(false); render(); showToast('メモを保存しました');
}

init().catch(err => fail('初期化に失敗しました', err));
