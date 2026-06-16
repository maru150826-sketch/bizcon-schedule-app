// ============================================================
// SAMPO QUEST fixed-team scheduler v4
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

const AUTO_REFRESH_MS = 30000;
const sb = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  groupId: null,
  group: null,
  currentMember: null,
  members: [],
  slots: [],
  responses: [],
  notes: [],
  selectedTasks: [],
};

const $ = (id) => document.getElementById(id);
const els = {
  loading: $('loading'),
  toast: $('toast'),
  setupNotice: $('setupNotice'),
  groupSection: $('groupSection'),
  memberSection: $('memberSection'),
  bestSection: $('bestSection'),
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
  showToast.timer = setTimeout(() => els.toast.classList.add('is-hidden'), 3300);
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

function statusLabel(status) {
  if (status === 'available') return '参加できる';
  if (status === 'maybe') return '条件付き';
  if (status === 'unavailable') return '参加できない';
  return '未回答';
}

function statusClass(status) {
  return status ? `status-${status}` : 'status-none';
}

function setToday() {
  const dateInput = $('slotDate');
  if (!dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
}

function buildTimeOptions() {
  const start = $('slotStart');
  const end = $('slotEnd');
  const options = [];

  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 30]) {
      const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      const label = `${hour}:${String(minute).padStart(2, '0')}`;
      options.push(`<option value="${value}">${label}</option>`);
    }
  }

  start.innerHTML = options.join('');
  end.innerHTML = options.join('');
  start.value = '18:00';
  end.value = '21:00';
}

async function init() {
  if (!isConfigured()) {
    els.setupNotice.classList.remove('is-hidden');
    return;
  }

  bindEvents();
  buildTimeOptions();
  setToday();
  await loadOrCreateDefaultGroup();
  setInterval(() => loadAllAndRender(false), AUTO_REFRESH_MS);
}

function bindEvents() {
  els.memberForm.addEventListener('submit', joinMember);
  els.slotForm.addEventListener('submit', addSlot);
  els.notesForm.addEventListener('submit', saveNotes);
  $('refreshButton').addEventListener('click', () => loadAllAndRender(true));

  document.querySelectorAll('#taskPresetList .chip').forEach((button) => {
    button.addEventListener('click', () => toggleTask(button));
  });

  document.querySelectorAll('#locationPresetList .chip').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('#locationPresetList .chip').forEach((b) => b.classList.remove('is-active'));
      button.classList.add('is-active');
      $('slotLocation').value = button.dataset.location;
      $('selectedLocationText').textContent = button.dataset.location;
    });
  });
}

function toggleTask(button) {
  const task = button.dataset.task;
  button.classList.toggle('is-active');
  if (state.selectedTasks.includes(task)) {
    state.selectedTasks = state.selectedTasks.filter((item) => item !== task);
  } else {
    state.selectedTasks.push(task);
  }
  $('selectedTaskText').textContent = state.selectedTasks.length ? state.selectedTasks.join(' / ') : '未選択';
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
    await loadAllAndRender(false);
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
  await loadAllAndRender(false);
  setLoading(false);
}

async function loadAllAndRender(showMessage = false) {
  try {
    if (showMessage) setLoading(true);
    await loadAll();
    render();
    if (showMessage) showToast('最新状況を読み込みました');
  } catch (error) {
    fail('データの読み込みに失敗しました', error);
  } finally {
    if (showMessage) setLoading(false);
  }
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
  for (const section of [els.groupSection, els.memberSection, els.bestSection, els.confirmedSection, els.slotSection, els.candidateSection, els.tableSection]) {
    section.classList.remove('is-hidden');
  }

  $('groupName').textContent = state.group.name;
  $('groupDescription').textContent = state.group.description || '';
  $('groupPurpose').textContent = state.group.purpose || '';

  renderMembers();
  renderBest();
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
    currentBox.classList.remove('is-hidden');
    currentBox.innerHTML = 'まだ回答者が選ばれていません。先に自分の名前を入力してください。';
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

  if (!name) {
    setLoading(false);
    return showToast('名前を入力してください', 'error');
  }

  const existing = state.members.find((member) => member.name === name);
  if (existing) {
    if (role_memo && role_memo !== existing.role_memo) {
      const updated = await sb.from('members').update({ role_memo }).eq('id', existing.id);
      if (updated.error) {
        setLoading(false);
        return fail('メンバー情報の更新に失敗しました', updated.error);
      }
    }
    localStorage.setItem(`member:${DEFAULT_GROUP_KEY}`, existing.id);
    await loadAllAndRender(false);
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
  event.currentTarget.reset();
  await loadAllAndRender(false);
  setLoading(false);
  showToast('メンバーとして参加しました');
}

async function addSlot(event) {
  event.preventDefault();

  const form = new FormData(event.currentTarget);
  const date = form.get('date');
  const start_time = form.get('start_time');
  const end_time = form.get('end_time');
  const location = form.get('location');
  const taskExtra = form.get('task_extra')?.trim();
  const memo = form.get('memo')?.trim();

  if (!date) return showToast('日付を選んでください', 'error');
  if (!start_time || !end_time) return showToast('開始時間と終了時間を選んでください', 'error');
  if (start_time >= end_time) return showToast('終了時間は開始時間より後にしてください', 'error');
  if (!state.selectedTasks.length && !taskExtra) return showToast('作業内容を1つ以上選ぶか、作業内容メモを入力してください', 'error');
  if (!location) return showToast('場所を選んでください', 'error');

  const taskTitle = [state.selectedTasks.join(' / '), taskExtra].filter(Boolean).join('：');
  const payload = {
    group_id: state.groupId,
    date,
    start_time,
    end_time,
    task_title: taskTitle,
    location,
    memo,
  };

  setLoading(true);
  const { error } = await sb.from('time_slots').insert(payload);

  if (error) {
    setLoading(false);
    return fail('候補日時の追加に失敗しました', error);
  }

  event.currentTarget.reset();
  clearCandidateInput();
  buildTimeOptions();
  setToday();
  await loadAllAndRender(false);
  setLoading(false);
  showToast('候補日時を追加しました');
}

function clearCandidateInput() {
  state.selectedTasks = [];
  document.querySelectorAll('.chip').forEach((button) => button.classList.remove('is-active'));
  $('selectedTaskText').textContent = '未選択';
  $('selectedLocationText').textContent = '未選択';
  $('slotLocation').value = '';
}

function slotResponses(slotId) {
  return state.responses.filter((response) => response.time_slot_id === slotId);
}

function counts(slotId) {
  const rows = slotResponses(slotId);
  return {
    available: rows.filter((response) => response.status === 'available').length,
    maybe: rows.filter((response) => response.status === 'maybe').length,
    unavailable: rows.filter((response) => response.status === 'unavailable').length,
    answered: rows.length,
    total: state.members.length,
  };
}

function slotScore(slot) {
  const c = counts(slot.id);
  return {
    fit: c.available + c.maybe,
    available: c.available,
    maybe: c.maybe,
    unavailable: c.unavailable,
    answered: c.answered,
  };
}

function bestSlot() {
  if (!state.slots.length) return null;
  return [...state.slots].sort((a, b) => {
    const sa = slotScore(a);
    const sbScore = slotScore(b);
    return (sbScore.fit - sa.fit)
      || (sbScore.available - sa.available)
      || (sa.unavailable - sbScore.unavailable)
      || (sbScore.answered - sa.answered)
      || (new Date(`${a.date}T${a.start_time}`) - new Date(`${b.date}T${b.start_time}`));
  })[0];
}

function judge(slot) {
  const c = counts(slot.id);
  const best = bestSlot();
  if (slot.is_confirmed) return '確定';
  if (best?.id === slot.id && c.available + c.maybe > 0) return '最有力';
  if (c.unavailable >= Math.max(1, Math.ceil(Math.max(state.members.length, 1) / 2))) return '微妙';
  if (c.available + c.maybe > 0) return '候補';
  return '未回答';
}

function memberResponse(memberId, slotId) {
  return state.responses.find((item) => item.member_id === memberId && item.time_slot_id === slotId);
}

function answeredMembers(slotId) {
  return state.members.filter((member) => memberResponse(member.id, slotId));
}

function unansweredMembers(slotId) {
  return state.members.filter((member) => !memberResponse(member.id, slotId));
}

function latestResponseName(slotId) {
  const latest = [...slotResponses(slotId)]
    .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))[0];
  if (!latest) return 'まだ回答なし';
  const member = state.members.find((item) => item.id === latest.member_id);
  return `${member?.name || '不明'} が最後に回答`;
}

function renderBest() {
  const slot = bestSlot();
  if (!slot) {
    $('bestBox').className = 'empty';
    $('bestBox').textContent = 'まだ候補日時がありません。';
    return;
  }

  const c = counts(slot.id);
  $('bestBox').className = 'small-box';
  $('bestBox').innerHTML = `<b>${jpDate(slot.date)} ${hm(slot.start_time)}〜${hm(slot.end_time)}</b><br>
    作業内容：${esc(slot.task_title || '未設定')}<br>
    場所：${esc(slot.location || '未設定')}<br>
    集計：○ ${c.available} / △ ${c.maybe} / × ${c.unavailable} / 未回答 ${Math.max(c.total - c.answered, 0)}<br>
    判定：<b>${judge(slot)}</b>`;
}

function renderCandidates() {
  if (!state.slots.length) {
    els.candidateList.innerHTML = '<div class="empty">まだ候補日時がありません。</div>';
    return;
  }

  els.candidateList.innerHTML = state.slots.map((slot) => {
    const myResponse = state.currentMember ? memberResponse(state.currentMember.id, slot.id) : null;
    const c = counts(slot.id);
    const unanswered = unansweredMembers(slot.id);
    const memberVotes = state.members.length
      ? state.members.map((member) => {
          const response = memberResponse(member.id, slot.id);
          return `<div class="vote-row">
            <span class="status-badge ${statusClass(response?.status)}">${statusMark(response?.status)}</span>
            <div>
              <div class="vote-name">${esc(member.name)} <span class="muted">${statusLabel(response?.status)}</span></div>
              ${response?.comment ? `<div class="vote-comment">${esc(response.comment)}</div>` : ''}
            </div>
          </div>`;
        }).join('')
      : '<div class="empty">まだメンバーがいません。</div>';

    return `<article class="slot-card ${slot.is_confirmed ? 'confirmed' : ''}">
      <div class="slot-top">
        <div>
          <div class="slot-time">${jpDate(slot.date)} ${hm(slot.start_time)}〜${hm(slot.end_time)}</div>
          <div class="slot-meta">作業内容：${esc(slot.task_title || '未設定')}<br>場所：${esc(slot.location || '未設定')}${slot.memo ? `<br>メモ：${esc(slot.memo)}` : ''}</div>
        </div>
        <div class="judge">${judge(slot)}</div>
      </div>

      <div class="count-row">
        <div class="count-box"><b>${c.available}</b><span>○ 参加</span></div>
        <div class="count-box"><b>${c.maybe}</b><span>△ 条件付き</span></div>
        <div class="count-box"><b>${c.unavailable}</b><span>× 不可</span></div>
        <div class="count-box"><b>${c.answered}/${c.total}</b><span>回答済み</span></div>
      </div>

      <div class="unanswered-box">${latestResponseName(slot.id)} / 未回答：${esc(unanswered.map((m) => m.name).join('、') || 'なし')}</div>

      <div class="response-row">
        <div>
          <label>あなたの回答</label>
          <div class="mark-buttons" data-slot="${slot.id}">
            <button type="button" class="mark-button ${myResponse?.status === 'available' ? 'is-active' : ''}" data-status="available" ${!state.currentMember ? 'disabled' : ''}>○</button>
            <button type="button" class="mark-button ${myResponse?.status === 'maybe' ? 'is-active' : ''}" data-status="maybe" ${!state.currentMember ? 'disabled' : ''}>△</button>
            <button type="button" class="mark-button ${myResponse?.status === 'unavailable' ? 'is-active' : ''}" data-status="unavailable" ${!state.currentMember ? 'disabled' : ''}>×</button>
          </div>
        </div>
        <label>コメント 任意
          <input data-slot="${slot.id}" class="comment-input" value="${esc(myResponse?.comment || '')}" placeholder="例：19時からなら参加できます" ${!state.currentMember ? 'disabled' : ''} />
        </label>
        <button type="button" class="secondary save-comment" data-slot="${slot.id}" ${!state.currentMember ? 'disabled' : ''}>コメント保存</button>
      </div>

      <div class="vote-list">
        <b>他の人の投票状況</b>
        ${memberVotes}
      </div>

      <button type="button" class="primary confirm-slot" data-slot="${slot.id}" style="margin-top:12px;">この日程で確定</button>
    </article>`;
  }).join('');

  document.querySelectorAll('.mark-button').forEach((button) => button.addEventListener('click', autoSaveStatus));
  document.querySelectorAll('.save-comment').forEach((button) => button.addEventListener('click', saveComment));
  document.querySelectorAll('.confirm-slot').forEach((button) => button.addEventListener('click', confirmSlot));
}

async function autoSaveStatus(event) {
  if (!state.currentMember) return showToast('先にメンバーとして参加してください', 'error');

  const button = event.currentTarget;
  const slotId = button.closest('.mark-buttons').dataset.slot;
  const status = button.dataset.status;
  const comment = document.querySelector(`.comment-input[data-slot="${slotId}"]`)?.value.trim() || '';

  await upsertResponse(slotId, status, comment, '回答を保存しました');
}

async function saveComment(event) {
  if (!state.currentMember) return showToast('先にメンバーとして参加してください', 'error');

  const slotId = event.currentTarget.dataset.slot;
  const existing = memberResponse(state.currentMember.id, slotId);
  if (!existing) return showToast('先に○△×を押してください', 'error');

  const comment = document.querySelector(`.comment-input[data-slot="${slotId}"]`)?.value.trim() || '';
  await upsertResponse(slotId, existing.status, comment, 'コメントを保存しました');
}

async function upsertResponse(slotId, status, comment, successMessage) {
  setLoading(true);
  const existing = memberResponse(state.currentMember.id, slotId);
  const payload = {
    group_id: state.groupId,
    member_id: state.currentMember.id,
    time_slot_id: slotId,
    status,
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

  await loadAllAndRender(false);
  setLoading(false);
  showToast(successMessage);
}

async function confirmSlot(event) {
  const slotId = event.currentTarget.dataset.slot;
  const slot = state.slots.find((item) => item.id === slotId);
  const c = counts(slotId);

  const ok = window.confirm(`${jpDate(slot.date)} ${hm(slot.start_time)}〜${hm(slot.end_time)} を確定しますか？\n○+△=${c.available + c.maybe}人 / ×=${c.unavailable}人`);
  if (!ok) return;

  setLoading(true);
  const reset = await sb.from('time_slots').update({ is_confirmed: false }).eq('group_id', state.groupId);
  const confirm = await sb.from('time_slots').update({ is_confirmed: true }).eq('id', slotId);

  if (reset.error || confirm.error) {
    setLoading(false);
    return fail('確定日時の保存に失敗しました', reset.error || confirm.error);
  }

  await loadAllAndRender(false);
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
  $('confirmedBox').innerHTML = `<b>${jpDate(slot.date)} ${hm(slot.start_time)}〜${hm(slot.end_time)}</b><br>
    作業内容：${esc(slot.task_title || '未設定')}<br>
    場所：${esc(slot.location || '未設定')}<br>
    参加予定者：${esc(availableMembers.join('、') || 'なし')}<br>
    条件付き参加者：${esc(maybeMembers.join('、') || 'なし')}<br>
    メモ：${esc(slot.memo || '')}`;
}

function renderTable() {
  if (!state.slots.length) {
    els.summaryTable.innerHTML = '<tr><td>まだ候補日時がありません。</td></tr>';
    return;
  }

  const head = `<tr><th>候補日時</th><th>作業内容</th><th>場所</th>${state.members.map((member) => `<th>${esc(member.name)}</th>`).join('')}<th>○+△</th><th>○人数</th><th>△人数</th><th>×人数</th><th>未回答</th><th>判定</th></tr>`;
  const body = state.slots.map((slot) => {
    const c = counts(slot.id);
    const memberCells = state.members.map((member) => {
      const response = memberResponse(member.id, slot.id);
      return `<td><span class="status-badge ${statusClass(response?.status)}">${statusMark(response?.status)}</span>${response?.comment ? `<br><small>${esc(response.comment)}</small>` : ''}</td>`;
    }).join('');

    const unanswered = Math.max(c.total - c.answered, 0);
    return `<tr><td>${jpDate(slot.date)} ${hm(slot.start_time)}〜${hm(slot.end_time)}</td><td>${esc(slot.task_title || '')}</td><td>${esc(slot.location || '')}</td>${memberCells}<td>${c.available + c.maybe}</td><td>${c.available}</td><td>${c.maybe}</td><td>${c.unavailable}</td><td>${unanswered}</td><td class="judge">${judge(slot)}</td></tr>`;
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

  await loadAllAndRender(false);
  setLoading(false);
  showToast('メモを保存しました');
}

init().catch((error) => fail('初期化に失敗しました', error));
