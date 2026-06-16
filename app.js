// ============================================================
// SAMPO QUEST fixed-team scheduler
// GitHub Pages用。secret key / service_role key は絶対に入れないでください。
// ============================================================
const SUPABASE_URL = 'https://dgaveiimlslljluimqxn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JPpJW8RmeDVGESJtJatwbA_IH6PIXKE';

const DEFAULT_GROUP_KEY = 'sampo-quest-main';
const DEFAULT_GROUP = {
  app_key: DEFAULT_GROUP_KEY,
  name: 'SAMPO QUEST ビジコンチーム',
  description: '観光クロスオーバーコンテストに向けた作業予定調整',
  purpose: '全員が集まれる日時を決めて、企画書・スライド・発表準備を進める',
  admin_name: '田丸',
};

const sb = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  groupId: null,
  group: null,
  currentMember: null,
  members: [],
  slots: [],
  responses: [],
  notes: [],
};

const $ = (id) => document.getElementById(id);
const els = {
  loading: $('loading'),
  toast: $('toast'),
  setupNotice: $('setupNotice'),
  groupSection: $('groupSection'),
  memberSection: $('memberSection'),
  confirmedSection: $('confirmedSection'),
  slotSection: $('slotSection'),
  candidateSection: $('candidateSection'),
  tableSection: $('tableSection'),
  notesSection: $('notesSection'),
  memberForm: $('memberForm'),
  slotForm: $('slotForm'),
  notesForm: $('notesForm'),
  candidateList: $('candidateList'),
  summaryTable: $('summaryTable'),
};

function isConfigured() {
  return Boolean(
    sb &&
    SUPABASE_URL.startsWith('https://') &&
    !SUPABASE_URL.includes('YOUR-PROJECT') &&
    SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY'
  );
}

function setLoading(value) {
  els.loading.classList.toggle('is-hidden', !value);
}

function showToast(message, type = 'info') {
  els.toast.textContent = message;
  els.toast.className = `toast ${type === 'error' ? 'error' : ''}`;
  els.toast.classList.remove('is-hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.add('is-hidden'), 3800);
}

function fail(message, error) {
  console.error(message, error);
  const detail = error?.message ? `：${error.message}` : '';
  showToast(`${message}${detail}`, 'error');
}

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function jpDate(date) {
  if (!date) return '';
  const d = new Date(`${date}T00:00:00`);
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${weekday})`;
}

function hm(time) {
  return String(time || '').slice(0, 5);
}

function statusMark(status) {
  if (status === 'available') return '○';
  if (status === 'maybe') return '△';
  if (status === 'unavailable') return '×';
  return '未';
}

function statusClass(status) {
  return status ? `status-${status}` : 'status-none';
}

function setToday() {
  const dateInput = $('slotDate');
  if (!dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
}

async function init() {
  if (!isConfigured()) {
    els.setupNotice.classList.remove('is-hidden');
    return;
  }

  bindEvents();
  setToday();
  await loadOrCreateDefaultGroup();
}

function bindEvents() {
  els.memberForm.addEventListener('submit', joinMember);
  els.slotForm.addEventListener('submit', addSlot);
  els.notesForm.addEventListener('submit', saveNotes);

  document.querySelectorAll('#timePresetList .chip').forEach((button) => {
    button.addEventListener('click', () => {
      selectChip('#timePresetList .chip', button);
      $('slotStart').value = button.dataset.start;
      $('slotEnd').value = button.dataset.end;
      $('selectedTimeText').textContent = `${button.dataset.start}〜${button.dataset.end}`;
    });
  });

  document.querySelectorAll('#taskPresetList .chip').forEach((button) => {
    button.addEventListener('click', () => {
      selectChip('#taskPresetList .chip', button);
      $('slotTask').value = button.dataset.task;
      $('selectedTaskText').textContent = button.dataset.task;
    });
  });

  document.querySelectorAll('#locationPresetList .chip').forEach((button) => {
    button.addEventListener('click', () => {
      selectChip('#locationPresetList .chip', button);
      $('slotLocation').value = button.dataset.location;
      $('selectedLocationText').textContent = button.dataset.location;
    });
  });
}

function selectChip(selector, activeButton) {
  document.querySelectorAll(selector).forEach((button) => button.classList.remove('is-active'));
  activeButton.classList.add('is-active');
}

async function loadOrCreateDefaultGroup() {
  setLoading(true);

  const { data, error } = await sb
    .from('groups')
    .select('*')
    .eq('app_key', DEFAULT_GROUP_KEY)
    .maybeSingle();

  if (error) {
    setLoading(false);
    return fail('固定チームの読み込みに失敗しました。supabase-schema.sqlを再実行してください', error);
  }

  if (data) {
    state.group = data;
    state.groupId = data.id;
    await loadAllAndRender();
    setLoading(false);
    return;
  }

  const created = await sb.from('groups').insert(DEFAULT_GROUP).select().single();
  if (created.error) {
    setLoading(false);
    return fail('固定チームの作成に失敗しました', created.error);
  }

  state.group = created.data;
  state.groupId = created.data.id;
  await loadAllAndRender();
  setLoading(false);
}

async function loadAllAndRender() {
  await loadAll();
  render();
}

async function loadAll() {
  const [members, slots, responses, notes] = await Promise.all([
    sb.from('members').select('*').eq('group_id', state.groupId).order('created_at'),
    sb.from('time_slots').select('*').eq('group_id', state.groupId).order('date').order('start_time'),
    sb.from('responses').select('*').eq('group_id', state.groupId),
    sb.from('meeting_notes').select('*').eq('group_id', state.groupId),
  ]);

  for (const result of [members, slots, responses, notes]) {
    if (result.error) throw result.error;
  }

  state.members = members.data || [];
  state.slots = slots.data || [];
  state.responses = responses.data || [];
  state.notes = notes.data || [];

  const savedMemberId = localStorage.getItem(`member:${DEFAULT_GROUP_KEY}`);
  state.currentMember = state.members.find((member) => member.id === savedMemberId) || null;
}

function render() {
  for (const section of [els.groupSection, els.memberSection, els.confirmedSection, els.slotSection, els.candidateSection, els.tableSection]) {
    section.classList.remove('is-hidden');
  }

  $('groupName').textContent = state.group.name;
  $('groupDescription').textContent = state.group.description || '';
  $('groupPurpose').textContent = state.group.purpose || '';

  renderMembers();
  renderConfirmed();
  renderCandidates();
  renderTable();
  renderNotes();
}

function renderMembers() {
  const currentBox = $('currentMemberBox');
  if (state.currentMember) {
    currentBox.classList.remove('is-hidden');
    currentBox.innerHTML = `現在の回答者：<b>${esc(state.currentMember.name)}</b>${state.currentMember.role_memo ? ` / ${esc(state.currentMember.role_memo)}` : ''}`;
  } else {
    currentBox.classList.add('is-hidden');
  }

  $('memberList').innerHTML = state.members.length
    ? state.members.map((member) => `<span class="pill">${esc(member.name)}${member.role_memo ? `：${esc(member.role_memo)}` : ''}</span>`).join('')
    : '<div class="empty">まだメンバーがいません。</div>';
}

async function joinMember(event) {
  event.preventDefault();
  setLoading(true);

  const form = new FormData(event.currentTarget);
  const name = form.get('name')?.trim();
  const role_memo = form.get('role_memo')?.trim();

  const existing = state.members.find((member) => member.name === name);
  if (existing) {
    if (role_memo && role_memo !== existing.role_memo) {
      await sb.from('members').update({ role_memo }).eq('id', existing.id);
    }
    localStorage.setItem(`member:${DEFAULT_GROUP_KEY}`, existing.id);
    await loadAllAndRender();
    setLoading(false);
    showToast('既存メンバーとして参加しました');
    return;
  }

  const { data, error } = await sb
    .from('members')
    .insert({ group_id: state.groupId, name, role_memo })
    .select()
    .single();

  if (error) {
    setLoading(false);
    return fail('メンバー登録に失敗しました', error);
  }

  localStorage.setItem(`member:${DEFAULT_GROUP_KEY}`, data.id);
  await loadAllAndRender();
  setLoading(false);
  showToast('メンバーとして参加しました');
}

async function addSlot(event) {
  event.preventDefault();

  const form = new FormData(event.currentTarget);
  const date = form.get('date');
  const start_time = form.get('start_time');
  const end_time = form.get('end_time');

  if (!date) return showToast('日付を選んでください', 'error');
  if (!start_time || !end_time) return showToast('時間帯を選んでください', 'error');

  const payload = {
    group_id: state.groupId,
    date,
    start_time,
    end_time,
    task_title: form.get('task_title')?.trim(),
    location: form.get('location')?.trim(),
    memo: form.get('memo')?.trim(),
  };

  setLoading(true);
  const { error } = await sb.from('time_slots').insert(payload);

  if (error) {
    setLoading(false);
    return fail('候補日時の追加に失敗しました', error);
  }

  event.currentTarget.reset();
  clearPresetUi();
  setToday();
  await loadAllAndRender();
  setLoading(false);
  showToast('候補日時を追加しました');
}

function clearPresetUi() {
  document.querySelectorAll('.chip').forEach((button) => button.classList.remove('is-active'));
  $('selectedTimeText').textContent = '未選択';
  $('selectedTaskText').textContent = '未選択';
  $('selectedLocationText').textContent = '未選択';
}

function counts(slotId) {
  const rows = state.responses.filter((response) => response.time_slot_id === slotId);
  return {
    available: rows.filter((response) => response.status === 'available').length,
    maybe: rows.filter((response) => response.status === 'maybe').length,
    unavailable: rows.filter((response) => response.status === 'unavailable').length,
  };
}

function bestSlotId() {
  if (!state.slots.length) return null;
  return [...state.slots].sort((a, b) => {
    const ca = counts(a.id);
    const cb = counts(b.id);
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
  if (!state.slots.length) {
    els.candidateList.innerHTML = '<div class="empty">まだ候補日時がありません。</div>';
    return;
  }

  els.candidateList.innerHTML = state.slots.map((slot) => {
    const myResponse = state.currentMember
      ? state.responses.find((response) => response.time_slot_id === slot.id && response.member_id === state.currentMember.id)
      : null;
    const c = counts(slot.id);

    return `<article class="slot-card ${slot.is_confirmed ? 'confirmed' : ''}">
      <div class="slot-top">
        <div>
          <div class="slot-time">${jpDate(slot.date)} ${hm(slot.start_time)}〜${hm(slot.end_time)}</div>
          <div class="slot-meta">作業内容：${esc(slot.task_title || '未設定')}<br>場所：${esc(slot.location || '未設定')}<br>メモ：${esc(slot.memo || '')}</div>
        </div>
        <div class="judge">${slot.is_confirmed ? '確定' : judge(slot)}</div>
      </div>
      <div class="slot-meta">○ ${c.available} / △ ${c.maybe} / × ${c.unavailable}</div>
      <div class="response-row">
        <div class="mark-buttons" data-slot="${slot.id}">
          <button type="button" class="mark-button ${myResponse?.status === 'available' ? 'is-active' : ''}" data-status="available" ${!state.currentMember ? 'disabled' : ''}>○</button>
          <button type="button" class="mark-button ${myResponse?.status === 'maybe' ? 'is-active' : ''}" data-status="maybe" ${!state.currentMember ? 'disabled' : ''}>△</button>
          <button type="button" class="mark-button ${myResponse?.status === 'unavailable' ? 'is-active' : ''}" data-status="unavailable" ${!state.currentMember ? 'disabled' : ''}>×</button>
        </div>
        <label>コメント
          <input data-slot="${slot.id}" class="comment-input" value="${esc(myResponse?.comment || '')}" placeholder="例：19時からなら参加できます" ${!state.currentMember ? 'disabled' : ''} />
        </label>
        <button type="button" class="secondary save-response" data-slot="${slot.id}" ${!state.currentMember ? 'disabled' : ''}>保存</button>
      </div>
      <button type="button" class="primary confirm-slot" data-slot="${slot.id}" style="margin-top:12px;">この日時で確定</button>
    </article>`;
  }).join('');

  document.querySelectorAll('.mark-button').forEach((button) => button.addEventListener('click', selectStatusButton));
  document.querySelectorAll('.save-response').forEach((button) => button.addEventListener('click', saveResponse));
  document.querySelectorAll('.confirm-slot').forEach((button) => button.addEventListener('click', confirmSlot));
}

function selectStatusButton(event) {
  const button = event.currentTarget;
  const parent = button.closest('.mark-buttons');
  parent.querySelectorAll('.mark-button').forEach((b) => b.classList.remove('is-active'));
  button.classList.add('is-active');
  parent.dataset.status = button.dataset.status;
}

async function saveResponse(event) {
  if (!state.currentMember) return showToast('先にメンバーとして参加してください', 'error');

  const slotId = event.currentTarget.dataset.slot;
  const buttonGroup = document.querySelector(`.mark-buttons[data-slot="${slotId}"]`);
  const selected = buttonGroup.dataset.status || buttonGroup.querySelector('.mark-button.is-active')?.dataset.status;
  const comment = document.querySelector(`.comment-input[data-slot="${slotId}"]`).value.trim();

  if (!selected) return showToast('○△×を選択してください', 'error');

  setLoading(true);
  const existing = state.responses.find((response) => response.member_id === state.currentMember.id && response.time_slot_id === slotId);
  const payload = {
    group_id: state.groupId,
    member_id: state.currentMember.id,
    time_slot_id: slotId,
    status: selected,
    comment,
    updated_at: new Date().toISOString(),
  };

  const result = existing
    ? await sb.from('responses').update(payload).eq('id', existing.id)
    : await sb.from('responses').insert(payload);

  if (result.error) {
    setLoading(false);
    return fail('回答保存に失敗しました', result.error);
  }

  await loadAllAndRender();
  setLoading(false);
  showToast('回答を保存しました');
}

async function confirmSlot(event) {
  const slotId = event.currentTarget.dataset.slot;
  setLoading(true);

  const reset = await sb.from('time_slots').update({ is_confirmed: false }).eq('group_id', state.groupId);
  const confirm = await sb.from('time_slots').update({ is_confirmed: true }).eq('id', slotId);

  if (reset.error || confirm.error) {
    setLoading(false);
    return fail('確定日時の保存に失敗しました', reset.error || confirm.error);
  }

  await loadAllAndRender();
  setLoading(false);
  showToast('日時を確定しました');
}

function renderConfirmed() {
  const slot = state.slots.find((item) => item.is_confirmed);

  if (!slot) {
    $('confirmedBox').className = 'empty';
    $('confirmedBox').textContent = 'まだ確定した作業予定はありません。';
    return;
  }

  const availableMembers = state.responses
    .filter((response) => response.time_slot_id === slot.id && response.status === 'available')
    .map((response) => state.members.find((member) => member.id === response.member_id)?.name)
    .filter(Boolean);

  const maybeMembers = state.responses
    .filter((response) => response.time_slot_id === slot.id && response.status === 'maybe')
    .map((response) => state.members.find((member) => member.id === response.member_id)?.name)
    .filter(Boolean);

  $('confirmedBox').className = 'small-box confirmed';
  $('confirmedBox').innerHTML = `<b>${jpDate(slot.date)} ${hm(slot.start_time)}〜${hm(slot.end_time)}</b><br>作業内容：${esc(slot.task_title || '未設定')}<br>場所：${esc(slot.location || '未設定')}<br>参加予定者：${esc(availableMembers.join('、') || 'なし')}<br>条件付き参加者：${esc(maybeMembers.join('、') || 'なし')}<br>メモ：${esc(slot.memo || '')}`;
}

function renderTable() {
  if (!state.slots.length) {
    els.summaryTable.innerHTML = '<tr><td>まだ候補日時がありません。</td></tr>';
    return;
  }

  const head = `<tr><th>候補日時</th><th>作業内容</th><th>場所</th>${state.members.map((member) => `<th>${esc(member.name)}</th>`).join('')}<th>○人数</th><th>△人数</th><th>×人数</th><th>判定</th></tr>`;
  const body = state.slots.map((slot) => {
    const c = counts(slot.id);
    const memberCells = state.members.map((member) => {
      const response = state.responses.find((item) => item.member_id === member.id && item.time_slot_id === slot.id);
      return `<td><span class="status-badge ${statusClass(response?.status)}">${statusMark(response?.status)}</span>${response?.comment ? `<br><small>${esc(response.comment)}</small>` : ''}</td>`;
    }).join('');

    return `<tr><td>${jpDate(slot.date)} ${hm(slot.start_time)}〜${hm(slot.end_time)}</td><td>${esc(slot.task_title || '')}</td><td>${esc(slot.location || '')}</td>${memberCells}<td>${c.available}</td><td>${c.maybe}</td><td>${c.unavailable}</td><td class="judge">${slot.is_confirmed ? '確定' : judge(slot)}</td></tr>`;
  }).join('');

  els.summaryTable.innerHTML = head + body;
}

function renderNotes() {
  const slot = state.slots.find((item) => item.is_confirmed);
  els.notesSection.classList.toggle('is-hidden', !slot);
  if (!slot) return;

  const note = state.notes.find((item) => item.time_slot_id === slot.id);
  els.notesForm.todo.value = note?.todo || '';
  els.notesForm.decisions.value = note?.decisions || '';
  els.notesForm.homework.value = note?.homework || '';
  els.notesForm.memo.value = note?.memo || '';
}

async function saveNotes(event) {
  event.preventDefault();

  const slot = state.slots.find((item) => item.is_confirmed);
  if (!slot) return showToast('先に日時を確定してください', 'error');

  setLoading(true);
  const form = new FormData(event.currentTarget);
  const existing = state.notes.find((note) => note.time_slot_id === slot.id);
  const payload = {
    group_id: state.groupId,
    time_slot_id: slot.id,
    todo: form.get('todo'),
    decisions: form.get('decisions'),
    homework: form.get('homework'),
    memo: form.get('memo'),
    updated_at: new Date().toISOString(),
  };

  const result = existing
    ? await sb.from('meeting_notes').update(payload).eq('id', existing.id)
    : await sb.from('meeting_notes').insert(payload);

  if (result.error) {
    setLoading(false);
    return fail('メモ保存に失敗しました', result.error);
  }

  await loadAllAndRender();
  setLoading(false);
  showToast('メモを保存しました');
}

init().catch((error) => fail('初期化に失敗しました', error));
