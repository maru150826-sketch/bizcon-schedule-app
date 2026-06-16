// ============================================================
// SAMPO QUEST fixed-team scheduler v8 lightweight
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

const AUTO_REFRESH_MS = 120000;
const ACTIVE_MEMBER_KEY = `active-member:${DEFAULT_GROUP_KEY}`;
const DEVICE_TOKEN_KEY = `device-token:${DEFAULT_GROUP_KEY}`;
const sb = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  groupId: null,
  group: null,
  currentMember: null,
  members: [],
  slots: [],
  responses: [],
  notes: [],
  noteSlotId: null,
  selectedTasks: [],
  deviceToken: null,
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

function displayLocation(location) {
  return location === 'Zoom' ? 'オンライン' : location;
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

function getDeviceToken() {
  let token = localStorage.getItem(DEVICE_TOKEN_KEY);
  if (!token) {
    token = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
  }
  return token;
}

function canDeleteCurrentMember() {
  return Boolean(state.currentMember);
}

function canDeleteSlot(slot) {
  if (!state.currentMember || !slot) return false;
  if (slot.created_by_member_id) return slot.created_by_member_id === state.currentMember.id;
  return true; // 旧版で作った候補は作成者不明のため、チーム内で削除可能にする
}

function slotCreatorName(slot) {
  const creator = state.members.find((member) => member.id === slot.created_by_member_id);
  if (creator) return creator.name;
  if (!slot.created_by_member_id && !slot.created_by_token) return '不明（旧データ）';
  return '不明';
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

  state.deviceToken = getDeviceToken();
  bindEvents();
  buildTimeOptions();
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

  const savedMemberId = localStorage.getItem(ACTIVE_MEMBER_KEY) || localStorage.getItem(`member:${DEFAULT_GROUP_KEY}`);
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
  currentBox.classList.remove('is-hidden');

  if (state.currentMember) {
    currentBox.innerHTML = `
      <div>現在は <b>${esc(state.currentMember.name)}</b> として操作中${state.currentMember.role_memo ? ` / ${esc(state.currentMember.role_memo)}` : ''}</div>
      <div class="current-actions">
        <button id="deleteCurrentMemberButton" type="button" class="danger small-danger">この回答者データを削除</button>
      </div>
      <p class="hint">スマホでもPCでも、下の一覧から自分の名前を選べば同じ回答者として投票できます。ログインなしなので、チーム内の誰でも名前を選べる前提です。</p>
    `;
    $('deleteCurrentMemberButton')?.addEventListener('click', deleteCurrentMember);
  } else {
    currentBox.innerHTML = 'まだ回答者が選ばれていません。既存の名前を選ぶか、新しく名前を追加してください。';
  }

  $('memberList').innerHTML = state.members.length
    ? state.members.map((member) => `
        <button type="button" class="member-select ${state.currentMember?.id === member.id ? 'is-current' : ''}" data-member="${member.id}">
          <span>${esc(member.name)}</span>
          ${member.role_memo ? `<small>${esc(member.role_memo)}</small>` : ''}
          ${state.currentMember?.id === member.id ? '<b>選択中</b>' : '<b>この人として使う</b>'}
        </button>
      `).join('')
    : '<div class="empty">まだメンバーがいません。</div>';

  document.querySelectorAll('.member-select').forEach((button) => {
    button.addEventListener('click', selectMember);
  });
}

function selectMember(event) {
  const memberId = event.currentTarget.dataset.member;
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return showToast('メンバーが見つかりません', 'error');
  localStorage.setItem(ACTIVE_MEMBER_KEY, member.id);
  localStorage.setItem(`member:${DEFAULT_GROUP_KEY}`, member.id);
  state.currentMember = member;
  render();
  showToast(`${member.name} として操作します`);
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
    const patch = {};
    if (role_memo && role_memo !== existing.role_memo) patch.role_memo = role_memo;
    if (!existing.owner_token) patch.owner_token = state.deviceToken;
    if (Object.keys(patch).length) {
      const updated = await sb.from('members').update(patch).eq('id', existing.id);
      if (updated.error) {
        setLoading(false);
        return fail('メンバー情報の更新に失敗しました', updated.error);
      }
    }
    localStorage.setItem(ACTIVE_MEMBER_KEY, existing.id);
    localStorage.setItem(`member:${DEFAULT_GROUP_KEY}`, existing.id);
    await loadAllAndRender(false);
    setLoading(false);
    showToast('既存メンバーとして参加しました');
    return;
  }

  const { data, error } = await sb
    .from('members')
    .insert({ group_id: state.groupId, name, role_memo, owner_token: state.deviceToken })
    .select()
    .single();

  if (error) {
    setLoading(false);
    return fail('メンバー登録に失敗しました', error);
  }

  localStorage.setItem(ACTIVE_MEMBER_KEY, data.id);
  localStorage.setItem(`member:${DEFAULT_GROUP_KEY}`, data.id);
  event.currentTarget.reset();
  await loadAllAndRender(false);
  setLoading(false);
  showToast('メンバーとして参加しました');
}

async function addSlot(event) {
  event.preventDefault();

  if (!state.currentMember) return showToast('先に自分の名前を選んでください', 'error');

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
    created_by_member_id: state.currentMember.id,
    created_by_token: state.deviceToken,
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
    場所：${esc(displayLocation(slot.location) || '未設定')}<br>
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
          <div class="slot-meta">作業内容：${esc(slot.task_title || '未設定')}<br>場所：${esc(displayLocation(slot.location) || '未設定')}<br>追加した人：${esc(slotCreatorName(slot))}${slot.memo ? `<br>メモ：${esc(slot.memo)}` : ''}</div>
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

      <div class="slot-actions">
        <button type="button" class="primary confirm-slot" data-slot="${slot.id}">${slot.is_confirmed ? '確定を外す' : 'この日程で確定'}</button>
        ${canDeleteSlot(slot) ? `<button type="button" class="danger delete-slot" data-slot="${slot.id}">この候補日を削除</button>` : `<button type="button" class="danger delete-slot" disabled>自分が追加した候補のみ削除可</button>`}
      </div>
    </article>`;
  }).join('');

  document.querySelectorAll('.mark-button').forEach((button) => button.addEventListener('click', autoSaveStatus));
  document.querySelectorAll('.save-comment').forEach((button) => button.addEventListener('click', saveComment));
  document.querySelectorAll('.confirm-slot').forEach((button) => button.addEventListener('click', confirmSlot));
  document.querySelectorAll('.delete-slot').forEach((button) => button.addEventListener('click', deleteSlot));
}

async function autoSaveStatus(event) {
  if (!state.currentMember) return showToast('先に自分の名前を選んでください', 'error');

  const button = event.currentTarget;
  const slotId = button.closest('.mark-buttons').dataset.slot;
  const status = button.dataset.status;
  const comment = document.querySelector(`.comment-input[data-slot="${slotId}"]`)?.value.trim() || '';

  await upsertResponse(slotId, status, comment, '回答を保存しました');
}

async function saveComment(event) {
  if (!state.currentMember) return showToast('先に自分の名前を選んでください', 'error');

  const slotId = event.currentTarget.dataset.slot;
  const existing = memberResponse(state.currentMember.id, slotId);
  if (!existing) return showToast('先に○△×を押してください', 'error');

  const comment = document.querySelector(`.comment-input[data-slot="${slotId}"]`)?.value.trim() || '';
  await upsertResponse(slotId, existing.status, comment, 'コメントを保存しました');
}

async function upsertResponse(slotId, status, comment, successMessage) {
  const existing = memberResponse(state.currentMember.id, slotId);
  const previousResponses = state.responses.map((response) => ({ ...response }));
  const now = new Date().toISOString();
  const payload = {
    group_id: state.groupId,
    member_id: state.currentMember.id,
    time_slot_id: slotId,
    status,
    comment,
    updated_at: now,
  };

  let localId = null;
  if (existing) {
    Object.assign(existing, payload);
  } else {
    localId = `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    state.responses.push({ id: localId, ...payload });
  }

  render();
  showToast('保存中...');

  const result = existing
    ? await sb.from('responses').update(payload).eq('id', existing.id).select().single()
    : await sb.from('responses').insert(payload).select().single();

  if (result.error) {
    state.responses = previousResponses;
    render();
    return fail('回答保存に失敗しました', result.error);
  }

  if (!existing && localId) {
    state.responses = state.responses.map((response) => response.id === localId ? result.data : response);
  } else if (existing && result.data) {
    state.responses = state.responses.map((response) => response.id === existing.id ? result.data : response);
  }

  render();
  showToast(successMessage);
}

async function deleteSlot(event) {
  if (!state.currentMember) return showToast('先に自分の名前を選んでください', 'error');

  const slotId = event.currentTarget.dataset.slot;
  const slot = state.slots.find((item) => item.id === slotId);
  if (!slot) return showToast('候補日が見つかりません', 'error');
  if (!canDeleteSlot(slot)) return showToast('自分が追加した候補日だけ削除できます', 'error');

  const ok = window.confirm(`${jpDate(slot.date)} ${hm(slot.start_time)}〜${hm(slot.end_time)} を削除しますか？\nこの候補日に入っている全員の○△×回答も消えます。`);
  if (!ok) return;

  setLoading(true);
  const { data, error } = await sb.rpc('delete_time_slot_by_selection', {
    p_time_slot_id: slotId,
    p_member_id: state.currentMember.id,
  });

  if (error) {
    setLoading(false);
    return fail('候補日の削除に失敗しました。supabase-schema.sqlを再実行してください', error);
  }

  await loadAllAndRender(false);
  setLoading(false);
  if (Number(data || 0) > 0) showToast('候補日を削除しました');
  else showToast('削除できませんでした。自分が追加した候補日か確認してください', 'error');
}

async function deleteCurrentMember() {
  if (!state.currentMember) return showToast('削除する回答者が選ばれていません', 'error');

  const ok = window.confirm(`${state.currentMember.name} の回答者データを削除しますか？\nこの人の○△×回答もすべて消えます。`);
  if (!ok) return;

  setLoading(true);
  const memberId = state.currentMember.id;
  const { data, error } = await sb.rpc('delete_member_by_selection', {
    p_member_id: memberId,
  });

  if (error) {
    setLoading(false);
    return fail('回答者の削除に失敗しました。supabase-schema.sqlを再実行してください', error);
  }

  if (Number(data || 0) > 0) {
    localStorage.removeItem(ACTIVE_MEMBER_KEY);
    localStorage.removeItem(`member:${DEFAULT_GROUP_KEY}`);
    state.currentMember = null;
    await loadAllAndRender(false);
    setLoading(false);
    showToast('回答者データを削除しました');
  } else {
    setLoading(false);
    showToast('削除できませんでした。ページを更新して確認してください', 'error');
  }
}

async function confirmSlot(event) {
  const slotId = event.currentTarget.dataset.slot;
  const slot = state.slots.find((item) => item.id === slotId);
  if (!slot) return showToast('候補日が見つかりません', 'error');

  const c = counts(slotId);
  const nextValue = !slot.is_confirmed;
  const message = nextValue
    ? `${jpDate(slot.date)} ${hm(slot.start_time)}〜${hm(slot.end_time)} を確定しますか？\n○+△=${c.available + c.maybe}人 / ×=${c.unavailable}人`
    : `${jpDate(slot.date)} ${hm(slot.start_time)}〜${hm(slot.end_time)} の確定を外しますか？`;

  const ok = window.confirm(message);
  if (!ok) return;

  const previousSlots = state.slots.map((item) => ({ ...item }));
  state.slots = state.slots.map((item) => item.id === slotId ? { ...item, is_confirmed: nextValue } : item);
  render();
  showToast('保存中...');

  const { error } = await sb.from('time_slots').update({ is_confirmed: nextValue }).eq('id', slotId);

  if (error) {
    state.slots = previousSlots;
    render();
    return fail('確定状態の保存に失敗しました', error);
  }

  showToast(nextValue ? '日時を確定しました' : '確定を外しました');
}

function renderConfirmed() {
  const confirmedSlots = state.slots.filter((item) => item.is_confirmed);

  if (!confirmedSlots.length) {
    $('confirmedBox').className = 'empty';
    $('confirmedBox').textContent = 'まだ確定した作業予定はありません。';
    return;
  }

  $('confirmedBox').className = 'confirmed-list';
  $('confirmedBox').innerHTML = confirmedSlots.map((slot) => {
    const availableMembers = state.responses
      .filter((response) => response.time_slot_id === slot.id && response.status === 'available')
      .map((response) => state.members.find((member) => member.id === response.member_id)?.name)
      .filter(Boolean);

    const maybeMembers = state.responses
      .filter((response) => response.time_slot_id === slot.id && response.status === 'maybe')
      .map((response) => state.members.find((member) => member.id === response.member_id)?.name)
      .filter(Boolean);

    return `<div class="small-box confirmed confirmed-item">
      <b>${jpDate(slot.date)} ${hm(slot.start_time)}〜${hm(slot.end_time)}</b><br>
      作業内容：${esc(slot.task_title || '未設定')}<br>
      場所：${esc(displayLocation(slot.location) || '未設定')}<br>
      参加予定者：${esc(availableMembers.join('、') || 'なし')}<br>
      条件付き参加者：${esc(maybeMembers.join('、') || 'なし')}<br>
      メモ：${esc(slot.memo || '')}
      <div class="confirmed-actions">
        <button type="button" class="secondary edit-note-target" data-slot="${slot.id}">この日のメモを編集</button>
        <button type="button" class="danger confirm-slot" data-slot="${slot.id}">確定を外す</button>
      </div>
    </div>`;
  }).join('');

  document.querySelectorAll('#confirmedBox .confirm-slot').forEach((button) => button.addEventListener('click', confirmSlot));
  document.querySelectorAll('#confirmedBox .edit-note-target').forEach((button) => button.addEventListener('click', (event) => {
    state.noteSlotId = event.currentTarget.dataset.slot;
    renderNotes();
    $('notesSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
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
    return `<tr><td>${jpDate(slot.date)} ${hm(slot.start_time)}〜${hm(slot.end_time)}</td><td>${esc(slot.task_title || '')}</td><td>${esc(displayLocation(slot.location) || '')}</td>${memberCells}<td>${c.available + c.maybe}</td><td>${c.available}</td><td>${c.maybe}</td><td>${c.unavailable}</td><td>${unanswered}</td><td class="judge">${judge(slot)}</td></tr>`;
  }).join('');

  els.summaryTable.innerHTML = head + body;
}

function confirmedSlots() {
  return state.slots.filter((item) => item.is_confirmed);
}

function currentNoteSlot() {
  const slots = confirmedSlots();
  if (!slots.length) return null;
  if (!state.noteSlotId || !slots.some((slot) => slot.id === state.noteSlotId)) {
    state.noteSlotId = slots[0].id;
  }
  return slots.find((slot) => slot.id === state.noteSlotId) || slots[0];
}

function ensureNoteSlotPicker() {
  let box = $('noteSlotPickerBox');
  if (box) return box;
  box = document.createElement('div');
  box.id = 'noteSlotPickerBox';
  box.className = 'note-picker-box full';
  els.notesForm.parentNode.insertBefore(box, els.notesForm);
  return box;
}

function renderNotes() {
  const slots = confirmedSlots();
  els.notesSection.classList.toggle('is-hidden', !slots.length);
  if (!slots.length) return;

  const slot = currentNoteSlot();
  const picker = ensureNoteSlotPicker();
  picker.innerHTML = `<label>メモ対象の確定日
    <select id="noteSlotPicker">
      ${slots.map((item) => `<option value="${item.id}" ${item.id === slot.id ? 'selected' : ''}>${jpDate(item.date)} ${hm(item.start_time)}〜${hm(item.end_time)} / ${esc(item.task_title || '作業')}</option>`).join('')}
    </select>
  </label>`;
  $('noteSlotPicker')?.addEventListener('change', (event) => {
    state.noteSlotId = event.target.value;
    renderNotes();
  });

  const note = state.notes.find((item) => item.time_slot_id === slot.id);
  els.notesForm.todo.value = note?.todo || '';
  els.notesForm.decisions.value = note?.decisions || '';
  els.notesForm.homework.value = note?.homework || '';
  els.notesForm.memo.value = note?.memo || '';
}

async function saveNotes(event) {
  event.preventDefault();

  const slot = currentNoteSlot();
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
