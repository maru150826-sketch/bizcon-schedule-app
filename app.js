// ============================================================
// Supabase設定
// 1. Supabase Project Settings > API から Project URL と anon public key をコピー
// 2. 下の2つを書き換える
// 3. service_role key / secret key は絶対に入れない
// ============================================================
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
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
  loading: $('loading'),
  toast: $('toast'),
  setupNotice: $('setupNotice'),
  createGroupSection: $('createGroupSection'),
  groupSection: $('groupSection'),
  memberSection: $('memberSection'),
  confirmedSection: $('confirmedSection'),
  slotSection: $('slotSection'),
  candidateSection: $('candidateSection'),
  tableSection: $('tableSection'),
  notesSection: $('notesSection'),
  groupForm: $('groupForm'),
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
    SUPABASE_ANON_KEY &&
    SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY'
  );
}

function setLoading(isLoading) {
  els.loading.classList.toggle('is-hidden', !isLoading);
}

function showToast(message, type = 'info') {
  els.toast.textContent = message;
  els.toast.className = `toast ${type === 'error' ? 'error' : ''}`;
  els.toast.classList.remove('is-hidden');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.add('is-hidden'), 3600);
}

function fail(message, error) {
  console.error(message, error);
  const detail = error?.message ? `：${error.message}` : '';
  showToast(`${message}${detail}`, 'error');
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(`${dateString}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatTime(timeString) {
  return String(timeString || '').slice(0, 5);
}

function formatSlot(slot) {
  return `${formatDate(slot.date)} ${formatTime(slot.start_time)}〜${formatTime(slot.end_time)}`;
}

function statusToMark(status) {
  if (status === 'available') return '○';
  if (status === 'maybe') return '△';
  if (status === 'unavailable') return '×';
  return '未回答';
}

function statusClass(status) {
  return status || 'unanswered';
}

function getLocalMemberKey(groupId) {
  return `bizcon-scheduler-member-${groupId}`;
}

function getMyResponse(slotId) {
  if (!state.currentMember) return null;
  return state.responses.find((r) => r.member_id === state.currentMember.id && r.time_slot_id === slotId) || null;
}

function getSlotResponses(slotId) {
  return state.responses.filter((r) => r.time_slot_id === slotId);
}

function countStatuses(slotId) {
  const rows = getSlotResponses(slotId);
  return {
    available: rows.filter((r) => r.status === 'available').length,
    maybe: rows.filter((r) => r.status === 'maybe').length,
    unavailable: rows.filter((r) => r.status === 'unavailable').length,
  };
}

function getJudgements() {
  if (!state.slots.length) return new Map();
  const counts = state.slots.map((slot) => ({ slot, ...countStatuses(slot.id) }));
  const bestAvailable = Math.max(...counts.map((c) => c.available));
  const bestUnavailable = Math.min(...counts.filter((c) => c.available === bestAvailable).map((c) => c.unavailable));

  const map = new Map();
  counts.forEach((c) => {
    let label = '候補';
    let cls = 'candidate';
    if (c.available === bestAvailable && c.unavailable === bestUnavailable && c.available > 0) {
      label = '最有力';
      cls = 'best';
    } else if (c.unavailable >= Math.max(2, Math.ceil(state.members.length / 2))) {
      label = '微妙';
      cls = 'weak';
    } else if (c.available === 0 && c.maybe === 0) {
      label = '未回答';
      cls = '';
    }
    map.set(c.slot.id, { label, cls });
  });
  return map;
}

async function init() {
  if (!isConfigured()) {
    els.setupNotice.classList.remove('is-hidden');
    setLoading(false);
    return;
  }

  bindEvents();

  if (state.groupId) {
    await loadGroup();
  } else {
    setLoading(false);
  }
}

function bindEvents() {
  els.groupForm.addEventListener('submit', handleCreateGroup);
  els.memberForm.addEventListener('submit', handleJoinMember);
  els.slotForm.addEventListener('submit', handleCreateSlot);
  els.notesForm.addEventListener('submit', handleSaveNotes);
  $('copyUrlButton').addEventListener('click', copyShareUrl);
}

async function handleCreateGroup(event) {
  event.preventDefault();
  setLoading(true);
  try {
    const payload = {
      name: $('groupName').value.trim(),
      description: $('groupDescription').value.trim() || null,
      purpose: $('groupPurpose').value.trim() || null,
      admin_name: $('adminName').value.trim() || null,
    };
    const { data, error } = await sb.from('groups').insert(payload).select().single();
    if (error) throw error;
    const url = new URL(location.href);
    url.searchParams.set('group', data.id);
    history.pushState({}, '', url.toString());
    state.groupId = data.id;
    state.group = data;
    showToast('グループを作成しました。共有URLを送れます。');
    await loadGroup();
  } catch (error) {
    fail('グループ作成に失敗しました', error);
  } finally {
    setLoading(false);
  }
}

async function loadGroup() {
  setLoading(true);
  try {
    const { data: group, error: groupError } = await sb.from('groups').select('*').eq('id', state.groupId).single();
    if (groupError) throw groupError;
    state.group = group;

    const savedMemberId = localStorage.getItem(getLocalMemberKey(state.groupId));
    await refreshAll();
    if (savedMemberId) {
      state.currentMember = state.members.find((m) => m.id === savedMemberId) || null;
    }
    render();
  } catch (error) {
    fail('グループの読み込みに失敗しました。URLが正しいか確認してください', error);
  } finally {
    setLoading(false);
  }
}

async function refreshAll() {
  const [membersRes, slotsRes, responsesRes, notesRes] = await Promise.all([
    sb.from('members').select('*').eq('group_id', state.groupId).order('created_at'),
    sb.from('time_slots').select('*').eq('group_id', state.groupId).order('date').order('start_time'),
    sb.from('responses').select('*').eq('group_id', state.groupId),
    sb.from('meeting_notes').select('*').eq('group_id', state.groupId),
  ]);

  for (const result of [membersRes, slotsRes, responsesRes, notesRes]) {
    if (result.error) throw result.error;
  }
  state.members = membersRes.data || [];
  state.slots = slotsRes.data || [];
  state.responses = responsesRes.data || [];
  state.notes = notesRes.data || [];
}

function render() {
  const hasGroup = Boolean(state.group);
  els.createGroupSection.classList.toggle('is-hidden', hasGroup);
  els.groupSection.classList.toggle('is-hidden', !hasGroup);
  els.memberSection.classList.toggle('is-hidden', !hasGroup);
  els.slotSection.classList.toggle('is-hidden', !hasGroup);
  els.candidateSection.classList.toggle('is-hidden', !hasGroup);
  els.tableSection.classList.toggle('is-hidden', !hasGroup);

  if (!hasGroup) return;

  $('currentGroupName').textContent = state.group.name;
  $('currentGroupDescription').textContent = state.group.description || '';
  $('currentGroupPurpose').textContent = state.group.purpose || '';
  $('shareUrl').value = location.href;

  renderCurrentMember();
  renderConfirmed();
  renderCandidates();
  renderSummaryTable();
  renderNotesForm();
}

function renderCurrentMember() {
  const box = $('currentMemberBox');
  if (!state.currentMember) {
    box.classList.add('is-hidden');
    return;
  }
  box.classList.remove('is-hidden');
  box.textContent = `現在の回答者：${state.currentMember.name}${state.currentMember.role_memo ? `（${state.currentMember.role_memo}）` : ''}`;
}

async function handleJoinMember(event) {
  event.preventDefault();
  const name = $('memberName').value.trim();
  const roleMemo = $('memberRoleMemo').value.trim();
  if (!name) return;

  setLoading(true);
  try {
    const sameName = state.members.find((m) => m.name.trim() === name);
    if (sameName) {
      const useExisting = confirm(`「${name}」は既に参加しています。既存メンバーとして回答しますか？\nキャンセルするとメモだけ更新します。`);
      if (useExisting) {
        state.currentMember = sameName;
      } else {
        const { data, error } = await sb.from('members').update({ role_memo: roleMemo || null }).eq('id', sameName.id).select().single();
        if (error) throw error;
        state.currentMember = data;
      }
    } else {
      const { data, error } = await sb.from('members').insert({
        group_id: state.groupId,
        name,
        role_memo: roleMemo || null,
      }).select().single();
      if (error) throw error;
      state.currentMember = data;
    }
    localStorage.setItem(getLocalMemberKey(state.groupId), state.currentMember.id);
    await refreshAll();
    state.currentMember = state.members.find((m) => m.id === state.currentMember.id) || state.currentMember;
    showToast('メンバー情報を保存しました。');
    render();
  } catch (error) {
    fail('メンバー登録に失敗しました', error);
  } finally {
    setLoading(false);
  }
}

async function handleCreateSlot(event) {
  event.preventDefault();
  setLoading(true);
  try {
    const payload = {
      group_id: state.groupId,
      date: $('slotDate').value,
      start_time: $('slotStartTime').value,
      end_time: $('slotEndTime').value,
      task_title: $('slotTaskTitle').value.trim() || null,
      location: $('slotLocation').value.trim() || null,
      memo: $('slotMemo').value.trim() || null,
    };
    const { error } = await sb.from('time_slots').insert(payload);
    if (error) throw error;
    els.slotForm.reset();
    await refreshAll();
    showToast('候補日時を追加しました。');
    render();
  } catch (error) {
    fail('候補日時の追加に失敗しました', error);
  } finally {
    setLoading(false);
  }
}

function renderCandidates() {
  const judgements = getJudgements();
  if (!state.slots.length) {
    els.candidateList.innerHTML = '<div class="empty">まだ候補日時がありません。</div>';
    return;
  }

  els.candidateList.innerHTML = state.slots.map((slot) => {
    const counts = countStatuses(slot.id);
    const judgement = judgements.get(slot.id) || { label: '未回答', cls: '' };
    const myResponse = getMyResponse(slot.id);
    const confirmed = slot.is_confirmed ? '<span class="badge best">確定済み</span>' : `<button class="secondary" data-confirm-slot="${slot.id}" type="button">この日時で確定</button>`;
    return `
      <article class="slot-card">
        <div class="slot-top">
          <div>
            <h3>${escapeHtml(formatSlot(slot))}</h3>
            <p class="slot-meta">
              ${escapeHtml(slot.task_title || '作業内容未設定')}<br>
              場所：${escapeHtml(slot.location || '未設定')}<br>
              ${slot.memo ? `メモ：${escapeHtml(slot.memo)}` : ''}
            </p>
          </div>
          <div>${confirmed}</div>
        </div>
        <div>
          <span class="badge ${judgement.cls}">${escapeHtml(judgement.label)}</span>
          <span class="badge">○ ${counts.available}</span>
          <span class="badge">△ ${counts.maybe}</span>
          <span class="badge">× ${counts.unavailable}</span>
        </div>
        <form class="response-form" data-slot-id="${slot.id}">
          <label>参加可否
            <select class="status-select ${statusClass(myResponse?.status)}" ${state.currentMember ? '' : 'disabled'}>
              <option value="" ${!myResponse ? 'selected' : ''}>未回答</option>
              <option value="available" ${myResponse?.status === 'available' ? 'selected' : ''}>○ 参加できる</option>
              <option value="maybe" ${myResponse?.status === 'maybe' ? 'selected' : ''}>△ 条件付き</option>
              <option value="unavailable" ${myResponse?.status === 'unavailable' ? 'selected' : ''}>× 参加できない</option>
            </select>
          </label>
          <label>コメント
            <input class="response-comment" placeholder="19時からなら参加できます" value="${escapeHtml(myResponse?.comment || '')}" ${state.currentMember ? '' : 'disabled'} />
          </label>
          <button class="primary" type="submit" ${state.currentMember ? '' : 'disabled'}>保存</button>
        </form>
      </article>
    `;
  }).join('');

  document.querySelectorAll('.response-form').forEach((form) => {
    form.addEventListener('submit', handleSaveResponse);
  });
  document.querySelectorAll('[data-confirm-slot]').forEach((button) => {
    button.addEventListener('click', () => handleConfirmSlot(button.dataset.confirmSlot));
  });
}

async function handleSaveResponse(event) {
  event.preventDefault();
  if (!state.currentMember) {
    showToast('先にメンバー名を入力してください。', 'error');
    return;
  }

  const form = event.currentTarget;
  const slotId = form.dataset.slotId;
  const status = form.querySelector('.status-select').value;
  const comment = form.querySelector('.response-comment').value.trim();

  if (!status) {
    showToast('○△×のどれかを選んでください。', 'error');
    return;
  }

  setLoading(true);
  try {
    const existing = getMyResponse(slotId);
    if (existing) {
      const { error } = await sb.from('responses').update({
        status,
        comment: comment || null,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await sb.from('responses').insert({
        group_id: state.groupId,
        member_id: state.currentMember.id,
        time_slot_id: slotId,
        status,
        comment: comment || null,
      });
      if (error) throw error;
    }
    await refreshAll();
    showToast('回答を保存しました。');
    render();
  } catch (error) {
    fail('回答の保存に失敗しました', error);
  } finally {
    setLoading(false);
  }
}

async function handleConfirmSlot(slotId) {
  const ok = confirm('この日時で確定しますか？他の確定日時は解除されます。');
  if (!ok) return;
  setLoading(true);
  try {
    await sb.from('time_slots').update({ is_confirmed: false }).eq('group_id', state.groupId);
    const { error } = await sb.from('time_slots').update({ is_confirmed: true }).eq('id', slotId);
    if (error) throw error;
    await refreshAll();
    showToast('確定日時を登録しました。');
    render();
  } catch (error) {
    fail('確定日時の登録に失敗しました', error);
  } finally {
    setLoading(false);
  }
}

function renderConfirmed() {
  const slot = state.slots.find((s) => s.is_confirmed);
  els.confirmedSection.classList.toggle('is-hidden', !slot);
  if (!slot) return;

  const rows = getSlotResponses(slot.id);
  const availableNames = rows.filter((r) => r.status === 'available').map((r) => memberName(r.member_id));
  const maybeNames = rows.filter((r) => r.status === 'maybe').map((r) => memberName(r.member_id));

  $('confirmedContent').innerHTML = `
    <div class="confirmed-box">
      <div class="confirmed-grid">
        <div class="info-item"><strong>日付・時間</strong>${escapeHtml(formatSlot(slot))}</div>
        <div class="info-item"><strong>作業内容</strong>${escapeHtml(slot.task_title || '未設定')}</div>
        <div class="info-item"><strong>場所</strong>${escapeHtml(slot.location || '未設定')}</div>
        <div class="info-item"><strong>メモ</strong>${escapeHtml(slot.memo || 'なし')}</div>
        <div class="info-item"><strong>参加予定者</strong>${escapeHtml(availableNames.join('、') || 'なし')}</div>
        <div class="info-item"><strong>条件付き参加者</strong>${escapeHtml(maybeNames.join('、') || 'なし')}</div>
      </div>
    </div>
  `;
}

function memberName(memberId) {
  return state.members.find((m) => m.id === memberId)?.name || '不明';
}

function renderSummaryTable() {
  if (!state.slots.length) {
    els.summaryTable.innerHTML = '<tbody><tr><td class="empty">まだ候補日時がありません。</td></tr></tbody>';
    return;
  }

  const judgements = getJudgements();
  const headerMembers = state.members.map((m) => `<th>${escapeHtml(m.name)}</th>`).join('');
  const rows = state.slots.map((slot) => {
    const counts = countStatuses(slot.id);
    const judgement = judgements.get(slot.id) || { label: '未回答', cls: '' };
    const memberCells = state.members.map((member) => {
      const response = state.responses.find((r) => r.member_id === member.id && r.time_slot_id === slot.id);
      return `
        <td>
          <span class="mark ${statusClass(response?.status)}">${statusToMark(response?.status)}</span>
          ${response?.comment ? `<span class="comment">${escapeHtml(response.comment)}</span>` : ''}
        </td>
      `;
    }).join('');
    return `
      <tr>
        <td>${escapeHtml(formatSlot(slot))}</td>
        <td>${escapeHtml(slot.task_title || '-')}</td>
        <td>${escapeHtml(slot.location || '-')}</td>
        ${memberCells}
        <td class="count">${counts.available}</td>
        <td class="count">${counts.maybe}</td>
        <td class="count">${counts.unavailable}</td>
        <td><span class="badge ${judgement.cls}">${escapeHtml(judgement.label)}</span></td>
      </tr>
    `;
  }).join('');

  els.summaryTable.innerHTML = `
    <thead>
      <tr>
        <th>候補日時</th>
        <th>作業内容</th>
        <th>場所</th>
        ${headerMembers}
        <th>○人数</th>
        <th>△人数</th>
        <th>×人数</th>
        <th>判定</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  `;
}

function renderNotesForm() {
  const confirmedSlot = state.slots.find((s) => s.is_confirmed);
  els.notesSection.classList.toggle('is-hidden', !confirmedSlot);
  if (!confirmedSlot) return;
  const note = state.notes.find((n) => n.time_slot_id === confirmedSlot.id);
  $('noteTodo').value = note?.todo || '';
  $('noteDecisions').value = note?.decisions || '';
  $('noteHomework').value = note?.homework || '';
  $('noteMemo').value = note?.memo || '';
}

async function handleSaveNotes(event) {
  event.preventDefault();
  const confirmedSlot = state.slots.find((s) => s.is_confirmed);
  if (!confirmedSlot) return;

  setLoading(true);
  try {
    const existing = state.notes.find((n) => n.time_slot_id === confirmedSlot.id);
    const payload = {
      group_id: state.groupId,
      time_slot_id: confirmedSlot.id,
      todo: $('noteTodo').value.trim() || null,
      decisions: $('noteDecisions').value.trim() || null,
      homework: $('noteHomework').value.trim() || null,
      memo: $('noteMemo').value.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error } = await sb.from('meeting_notes').update(payload).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await sb.from('meeting_notes').insert(payload);
      if (error) throw error;
    }
    await refreshAll();
    showToast('進行管理メモを保存しました。');
    render();
  } catch (error) {
    fail('メモの保存に失敗しました', error);
  } finally {
    setLoading(false);
  }
}

async function copyShareUrl() {
  try {
    await navigator.clipboard.writeText($('shareUrl').value);
    showToast('共有URLをコピーしました。');
  } catch {
    $('shareUrl').select();
    document.execCommand('copy');
    showToast('共有URLをコピーしました。');
  }
}

init();
