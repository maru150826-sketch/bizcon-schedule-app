const SUPABASE_URL = 'https://dgaveiimlslljluimqxn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JPpJW8RmeDVGESJtJatwbA_IH6PIXKE';

const APP_KEY = 'sampo-quest-main';
const SUGGESTION_LIMIT = 6;
const SUGGESTION_PER_DATE_LIMIT = 2;

const DEFAULT_GROUP = {
  app_key: APP_KEY,
  name: 'SAMPO QUEST ビジコンチーム',
  description: '空き時間を集めて、全員または多くの人が集まれる作業日時を決めるボード',
  purpose: '企画書・スライド・発表準備を進めるための予定調整'
};

const $ = (id) => document.getElementById(id);
const supabaseReady = SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('YOUR-PROJECT') && !SUPABASE_ANON_KEY.includes('YOUR_');
const client = supabaseReady ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const state = {
  group: null,
  members: [],
  availability: [],
  confirmed: [],
  currentMemberId: localStorage.getItem('sq_current_member_id') || '',
  editingAvailabilityId: '',
  selectedLocation: '',
  isLoading: false
};

function showLoading(show) { $('loading').classList.toggle('is-hidden', !show); }
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.remove('is-hidden');
  setTimeout(() => el.classList.add('is-hidden'), 2600);
}
function fail(error, fallback = 'エラーが発生しました') {
  console.error(error);
  toast(error?.message || fallback);
}
function normalizeLocation(location) {
  if (location === 'Zoom') return 'オンライン';
  return location || '未設定';
}
function memberName(id) {
  return state.members.find((m) => m.id === id)?.name || '不明';
}
function currentMember() {
  return state.members.find((m) => m.id === state.currentMemberId) || null;
}
function minutes(time) {
  const [h, m] = String(time).slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}
function timeFromMinutes(total) {
  const h = String(Math.floor(total / 60)).padStart(2, '0');
  const m = String(total % 60).padStart(2, '0');
  return `${h}:${m}`;
}
function formatDate(dateString) {
  const d = new Date(`${dateString}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}(${['日','月','火','水','木','金','土'][d.getDay()]})`;
}
function formatRange(item) {
  return `${formatDate(item.date)} ${String(item.start_time).slice(0,5)}〜${String(item.end_time).slice(0,5)}`;
}
function sortByDateTime(a, b) {
  return `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`);
}

function fillTimeSelects() {
  const selects = [$('availableStart'), $('availableEnd')];
  const options = [];
  for (let h = 7; h <= 23; h += 1) {
    for (const m of [0, 30]) {
      if (h === 23 && m === 30) continue;
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      options.push(`<option value="${value}">${value}</option>`);
    }
  }
  selects.forEach((select) => { select.innerHTML = options.join(''); });
  $('availableStart').value = '18:00';
  $('availableEnd').value = '21:00';
}

function bindEvents() {
  $('refreshButton').addEventListener('click', () => loadAll({ silent: false }));
  $('memberForm').addEventListener('submit', handleMemberSubmit);
  $('availabilityForm').addEventListener('submit', handleAvailabilitySubmit);
  $('cancelEditAvailability').addEventListener('click', cancelEditAvailability);
  $('minDurationSelect').addEventListener('change', render);

  $('locationPresetList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-location]');
    if (!button) return;
    state.selectedLocation = button.dataset.location;
    $('availableLocation').value = state.selectedLocation;
    renderLocationChips();
  });
}

async function init() {
  if (!supabaseReady) {
    $('setupNotice').classList.remove('is-hidden');
    return;
  }
  fillTimeSelects();
  bindEvents();
  await loadAll({ silent: false });
  setInterval(() => loadAll({ silent: true }), 120000);
}

document.addEventListener('DOMContentLoaded', init);

async function loadAll({ silent }) {
  if (state.isLoading) return;
  state.isLoading = true;
  if (!silent) showLoading(true);
  try {
    await ensureGroup();
    await Promise.all([loadMembers(), loadAvailability(), loadConfirmed()]);
    render();
  } catch (error) {
    fail(error, '読み込みに失敗しました');
  } finally {
    state.isLoading = false;
    showLoading(false);
  }
}

async function ensureGroup() {
  const { data, error } = await client
    .from('groups')
    .select('*')
    .eq('app_key', APP_KEY)
    .maybeSingle();
  if (error) throw error;
  if (data) {
    state.group = data;
    return;
  }
  const { data: created, error: insertError } = await client
    .from('groups')
    .insert(DEFAULT_GROUP)
    .select('*')
    .single();
  if (insertError) throw insertError;
  state.group = created;
}

async function loadMembers() {
  const { data, error } = await client
    .from('members')
    .select('*')
    .eq('group_id', state.group.id)
    .order('created_at', { ascending: true });
  if (error) throw error;
  state.members = data || [];
  if (state.currentMemberId && !state.members.some((m) => m.id === state.currentMemberId)) {
    state.currentMemberId = '';
    localStorage.removeItem('sq_current_member_id');
  }
}

async function loadAvailability() {
  const { data, error } = await client
    .from('availability_slots')
    .select('*')
    .eq('group_id', state.group.id)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) throw error;
  state.availability = data || [];
}

async function loadConfirmed() {
  const { data, error } = await client
    .from('time_slots')
    .select('*')
    .eq('group_id', state.group.id)
    .eq('is_confirmed', true)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) throw error;
  state.confirmed = data || [];
}

async function handleMemberSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const name = String(form.get('name') || '').trim();
  const role_memo = String(form.get('role_memo') || '').trim();
  if (!name) return toast('名前を入力してください');
  try {
    const { data, error } = await client
      .from('members')
      .upsert({ group_id: state.group.id, name, role_memo }, { onConflict: 'group_id,name' })
      .select('*')
      .single();
    if (error) throw error;
    state.currentMemberId = data.id;
    localStorage.setItem('sq_current_member_id', data.id);
    event.currentTarget.reset();
    await loadAll({ silent: true });
    toast(`${data.name}として選択しました`);
  } catch (error) {
    fail(error, '回答者の追加に失敗しました');
  }
}

async function selectMember(id) {
  state.currentMemberId = id;
  localStorage.setItem('sq_current_member_id', id);
  render();
  toast(`${memberName(id)}として回答します`);
}

async function deleteSelectedMember() {
  const m = currentMember();
  if (!m) return;
  if (!confirm(`${m.name}の回答者データと空き時間を削除しますか？`)) return;
  try {
    const { error } = await client.from('members').delete().eq('id', m.id);
    if (error) throw error;
    state.currentMemberId = '';
    localStorage.removeItem('sq_current_member_id');
    await loadAll({ silent: true });
    toast('回答者を削除しました');
  } catch (error) {
    fail(error, '回答者の削除に失敗しました');
  }
}

async function handleAvailabilitySubmit(event) {
  event.preventDefault();
  const m = currentMember();
  if (!m) return toast('先に自分の名前を選んでください');

  const form = new FormData(event.currentTarget);
  const payload = {
    group_id: state.group.id,
    member_id: m.id,
    date: form.get('date'),
    start_time: form.get('start_time'),
    end_time: form.get('end_time'),
    location: form.get('location'),
    memo: String(form.get('memo') || '').trim()
  };
  if (!payload.date || !payload.start_time || !payload.end_time || !payload.location) {
    return toast('日付・時間・場所を選んでください');
  }
  if (minutes(payload.end_time) <= minutes(payload.start_time)) {
    return toast('終了時間は開始時間より後にしてください');
  }

  try {
    if (state.editingAvailabilityId) {
      const { error } = await client
        .from('availability_slots')
        .update(payload)
        .eq('id', state.editingAvailabilityId)
        .eq('member_id', m.id);
      if (error) throw error;
      toast('空き時間を更新しました');
    } else {
      const { error } = await client.from('availability_slots').insert(payload);
      if (error) throw error;
      toast('空き時間を追加しました');
    }
    resetAvailabilityForm();
    await loadAll({ silent: true });
  } catch (error) {
    fail(error, '空き時間の保存に失敗しました');
  }
}

function editAvailability(id) {
  const item = state.availability.find((a) => a.id === id);
  if (!item) return;
  if (item.member_id !== state.currentMemberId) return toast('編集するには、その回答者を選んでください');
  state.editingAvailabilityId = id;
  $('availableDate').value = item.date;
  $('availableStart').value = String(item.start_time).slice(0,5);
  $('availableEnd').value = String(item.end_time).slice(0,5);
  state.selectedLocation = normalizeLocation(item.location);
  $('availableLocation').value = state.selectedLocation;
  $('availableMemo').value = item.memo || '';
  $('availabilitySubmit').textContent = '編集内容を保存';
  $('cancelEditAvailability').classList.remove('is-hidden');
  renderLocationChips();
  $('availabilitySection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelEditAvailability() { resetAvailabilityForm(); }
function resetAvailabilityForm() {
  state.editingAvailabilityId = '';
  $('availabilityForm').reset();
  $('availableStart').value = '18:00';
  $('availableEnd').value = '21:00';
  state.selectedLocation = '';
  $('availableLocation').value = '';
  $('availabilitySubmit').textContent = '空き時間を追加';
  $('cancelEditAvailability').classList.add('is-hidden');
  renderLocationChips();
}

async function deleteAvailability(id) {
  const item = state.availability.find((a) => a.id === id);
  if (!item) return;
  if (item.member_id !== state.currentMemberId) return toast('削除するには、その回答者を選んでください');
  if (!confirm(`${formatRange(item)} の空き時間を削除しますか？`)) return;
  try {
    const { error } = await client
      .from('availability_slots')
      .delete()
      .eq('id', id)
      .eq('member_id', state.currentMemberId);
    if (error) throw error;
    await loadAll({ silent: true });
    toast('空き時間を削除しました');
  } catch (error) {
    fail(error, '削除に失敗しました');
  }
}

function memberAvailableFor(memberId, date, start, end, location) {
  return state.availability.some((slot) => {
    if (slot.member_id !== memberId || slot.date !== date) return false;
    const slotLocation = normalizeLocation(slot.location);
    const locationOK = slotLocation === 'どちらでも' || slotLocation === location;
    if (!locationOK) return false;
    return minutes(slot.start_time) <= start && minutes(slot.end_time) >= end;
  });
}

function buildSuggestions() {
  const minDuration = Number($('minDurationSelect')?.value || 90);
  const dates = [...new Set(state.availability.map((a) => a.date))].sort();
  const locations = ['オンライン', '大学'];
  const rawBlocks = [];

  for (const date of dates) {
    const daySlots = state.availability.filter((a) => a.date === date);
    if (!daySlots.length) continue;

    const minStart = Math.min(...daySlots.map((a) => minutes(a.start_time)));
    const maxEnd = Math.max(...daySlots.map((a) => minutes(a.end_time)));

    for (const location of locations) {
      let blockStart = null;
      let currentKey = '';
      let currentIds = [];

      for (let start = minStart; start + 30 <= maxEnd; start += 30) {
        const end = start + 30;
        const ids = state.members
          .filter((m) => memberAvailableFor(m.id, date, start, end, location))
          .map((m) => m.id)
          .sort();
        const key = ids.join(',');

        if (key !== currentKey) {
          pushSuggestionBlock(rawBlocks, date, blockStart, start, location, currentIds, minDuration);
          blockStart = ids.length ? start : null;
          currentKey = key;
          currentIds = ids;
        }
      }
      pushSuggestionBlock(rawBlocks, date, blockStart, maxEnd, location, currentIds, minDuration);
    }
  }

  const merged = mergeSameTimeLocationOptions(rawBlocks);
  merged.sort(sortSuggestions);
  return curateSuggestions(merged);
}

function pushSuggestionBlock(list, date, start, end, location, availableIds, minDuration) {
  if (start === null || !availableIds.length) return;
  const duration = end - start;
  if (duration < minDuration) return;
  const missingIds = state.members.map((m) => m.id).filter((id) => !availableIds.includes(id));
  list.push({
    date,
    start_time: timeFromMinutes(start),
    end_time: timeFromMinutes(end),
    location,
    availableIds: [...availableIds],
    missingIds,
    duration,
    score: availableIds.length * 10000 - missingIds.length * 1000 + duration
  });
}

function mergeSameTimeLocationOptions(blocks) {
  const byKey = new Map();
  for (const item of blocks) {
    const key = `${item.date}-${item.start_time}-${item.end_time}-${item.availableIds.join(',')}`;
    if (!byKey.has(key)) {
      byKey.set(key, { ...item, locations: [item.location] });
      continue;
    }
    const existing = byKey.get(key);
    existing.locations.push(item.location);
    existing.location = 'どちらでも';
  }
  return [...byKey.values()];
}

function sortSuggestions(a, b) {
  if (b.availableIds.length !== a.availableIds.length) return b.availableIds.length - a.availableIds.length;
  if (a.missingIds.length !== b.missingIds.length) return a.missingIds.length - b.missingIds.length;
  if (b.duration !== a.duration) return b.duration - a.duration;
  return `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`);
}

function curateSuggestions(suggestions) {
  const selected = [];
  const perDateCount = new Map();

  for (const item of suggestions) {
    const dateCount = perDateCount.get(item.date) || 0;
    if (dateCount >= SUGGESTION_PER_DATE_LIMIT) continue;
    if (selected.some((chosen) => isSimilarSuggestion(chosen, item))) continue;

    selected.push(item);
    perDateCount.set(item.date, dateCount + 1);
    if (selected.length >= SUGGESTION_LIMIT) break;
  }

  if (selected.length < Math.min(SUGGESTION_LIMIT, suggestions.length)) {
    for (const item of suggestions) {
      if (selected.includes(item)) continue;
      if (selected.some((chosen) => isNearDuplicateSuggestion(chosen, item))) continue;
      selected.push(item);
      if (selected.length >= SUGGESTION_LIMIT) break;
    }
  }

  return selected.sort(sortByDateTime);
}

function isSimilarSuggestion(a, b) {
  if (a.date !== b.date) return false;
  if (a.location !== b.location && a.location !== 'どちらでも' && b.location !== 'どちらでも') return false;
  const overlap = Math.min(minutes(a.end_time), minutes(b.end_time)) - Math.max(minutes(a.start_time), minutes(b.start_time));
  if (overlap <= 0) return false;
  const shared = a.availableIds.filter((id) => b.availableIds.includes(id)).length;
  const smaller = Math.min(a.availableIds.length, b.availableIds.length);
  return smaller > 0 && shared / smaller >= 0.8;
}

function isNearDuplicateSuggestion(a, b) {
  if (a.date !== b.date) return false;
  const overlap = Math.min(minutes(a.end_time), minutes(b.end_time)) - Math.max(minutes(a.start_time), minutes(b.start_time));
  return overlap >= Math.min(a.duration, b.duration) * 0.75;
}

async function confirmSuggestion(index) {
  const suggestion = buildSuggestions()[index];
  if (!suggestion) return;
  const m = currentMember();
  if (!m) return toast('先に自分の名前を選んでください');

  const exists = state.confirmed.some((slot) =>
    slot.date === suggestion.date &&
    String(slot.start_time).slice(0,5) === suggestion.start_time &&
    String(slot.end_time).slice(0,5) === suggestion.end_time &&
    normalizeLocation(slot.location) === suggestion.location
  );
  if (exists) return toast('この日程はすでに確定済みです');

  const names = suggestion.availableIds.map(memberName).join('、');
  try {
    const { error } = await client.from('time_slots').insert({
      group_id: state.group.id,
      date: suggestion.date,
      start_time: suggestion.start_time,
      end_time: suggestion.end_time,
      task_title: '作業会',
      location: suggestion.location,
      memo: `空き時間から自動提案。参加可能：${names}`,
      is_confirmed: true,
      created_by_member_id: m.id
    });
    if (error) throw error;
    await loadAll({ silent: true });
    toast('日程を確定しました');
  } catch (error) {
    fail(error, '確定に失敗しました');
  }
}

async function unconfirmSlot(id) {
  if (!confirm('この日程の確定を外しますか？')) return;
  try {
    const { error } = await client.from('time_slots').update({ is_confirmed: false }).eq('id', id);
    if (error) throw error;
    await loadAll({ silent: true });
    toast('確定を外しました');
  } catch (error) {
    fail(error, '確定解除に失敗しました');
  }
}

function render() {
  ['groupSection','memberSection','availabilitySection','suggestionSection','confirmedSection','availabilityListSection','matrixSection']
    .forEach((id) => $(id).classList.remove('is-hidden'));
  renderGroup();
  renderMembers();
  renderCurrentMember();
  renderLocationChips();
  renderSuggestions();
  renderConfirmed();
  renderAvailabilityList();
  renderMatrix();
}

function renderGroup() {
  $('groupName').textContent = state.group?.name || 'SAMPO QUEST ビジコンチーム';
  $('groupDescription').textContent = state.group?.description || '';
}

function renderMembers() {
  const box = $('memberList');
  if (!state.members.length) {
    box.innerHTML = '<div class="empty">まだ回答者がいません。最初に自分の名前を追加してください。</div>';
    return;
  }
  box.innerHTML = state.members.map((m) => `
    <button type="button" class="member-chip ${m.id === state.currentMemberId ? 'is-current' : ''}" onclick="selectMember('${m.id}')">
      ${escapeHtml(m.name)}${m.role_memo ? ` / ${escapeHtml(m.role_memo)}` : ''}
    </button>
  `).join('');
}

function renderCurrentMember() {
  const box = $('currentMemberBox');
  const m = currentMember();
  if (!m) {
    box.classList.remove('is-hidden');
    box.innerHTML = '<b>未選択</b><br>先に自分の名前を選んでください。選ぶと空き時間の追加・編集ができます。';
    return;
  }
  box.classList.remove('is-hidden');
  box.innerHTML = `
    <b>現在：${escapeHtml(m.name)}として入力中</b>
    ${m.role_memo ? `<div class="muted">${escapeHtml(m.role_memo)}</div>` : ''}
    <div class="action-row" style="margin-top:10px">
      <button type="button" class="danger" onclick="deleteSelectedMember()">この回答者を削除</button>
    </div>
  `;
}

function renderLocationChips() {
  document.querySelectorAll('.location-chip').forEach((button) => {
    button.classList.toggle('is-selected', button.dataset.location === state.selectedLocation);
  });
  $('selectedLocationText').textContent = state.selectedLocation || '未選択';
}

function renderSuggestions() {
  const box = $('suggestionList');
  if (!state.members.length) {
    box.innerHTML = '<div class="empty">回答者を追加すると、提案を計算できます。</div>';
    return;
  }
  if (!state.availability.length) {
    box.innerHTML = '<div class="empty">まだ空き時間が入力されていません。</div>';
    return;
  }
  const suggestions = buildSuggestions();
  if (!suggestions.length) {
    box.innerHTML = '<div class="empty">指定した作業時間で重なる日時がありません。必要な作業時間を短くするか、空き時間を追加してください。</div>';
    return;
  }

  box.innerHTML = suggestions.map((s, index) => {
    const all = s.availableIds.length === state.members.length;
    const enough = s.availableIds.length >= Math.max(2, Math.ceil(state.members.length * 0.75));
    const label = all ? '全員OK' : enough ? 'かなり有力' : '一部参加';
    return `
      <article class="candidate-card">
        <div class="card-top">
          <div>
            <h3 class="date-title">${formatDate(s.date)} ${s.start_time}〜${s.end_time}</h3>
            <div class="meta-line">場所：${escapeHtml(s.location)} / ${s.duration}分</div>
          </div>
          <div class="badge-row">
            <span class="badge ${all ? 'good' : enough ? 'maybe' : ''}">${label}</span>
            <span class="badge good">OK ${s.availableIds.length}/${state.members.length}</span>
            <span class="badge bad">不可 ${s.missingIds.length}</span>
          </div>
        </div>
        <div class="people-box">
          <div><b>参加できる人：</b>${s.availableIds.map(memberName).join('、') || 'なし'}</div>
          <div><b>この時間は厳しい人：</b>${s.missingIds.map(memberName).join('、') || 'なし'}</div>
        </div>
        <div class="action-row">
          <button type="button" class="primary" onclick="confirmSuggestion(${index})">この時間で確定</button>
        </div>
      </article>
    `;
  }).join('');
}

function renderConfirmed() {
  const box = $('confirmedBox');
  if (!state.confirmed.length) {
    box.className = 'empty';
    box.innerHTML = 'まだ確定した作業予定はありません。';
    return;
  }
  box.className = 'candidate-list';
  box.innerHTML = state.confirmed.slice().sort(sortByDateTime).map((slot) => `
    <article class="confirmed-card">
      <div class="card-top">
        <div>
          <h3 class="date-title">${formatRange(slot)}</h3>
          <div class="meta-line">場所：${escapeHtml(normalizeLocation(slot.location))} / 作業内容：${escapeHtml(slot.task_title || '作業会')}</div>
          ${slot.memo ? `<div class="meta-line">${escapeHtml(slot.memo)}</div>` : ''}
        </div>
        <span class="badge good">確定済み</span>
      </div>
      <div class="action-row">
        <button type="button" class="secondary" onclick="unconfirmSlot('${slot.id}')">確定を外す</button>
      </div>
    </article>
  `).join('');
}

function renderAvailabilityList() {
  const box = $('availabilityList');
  if (!state.availability.length) {
    box.innerHTML = '<div class="empty">まだ空き時間が入力されていません。</div>';
    return;
  }
  const grouped = [...state.availability].sort(sortByDateTime);
  box.innerHTML = grouped.map((a) => {
    const mine = a.member_id === state.currentMemberId;
    return `
      <article class="availability-card">
        <div class="card-top">
          <div>
            <h3 class="date-title">${formatRange(a)}</h3>
            <div class="meta-line">${escapeHtml(memberName(a.member_id))} / 場所：${escapeHtml(normalizeLocation(a.location))}</div>
            ${a.memo ? `<div class="meta-line">メモ：${escapeHtml(a.memo)}</div>` : ''}
          </div>
          ${mine ? '<span class="badge good">自分</span>' : ''}
        </div>
        ${mine ? `
          <div class="action-row">
            <button type="button" class="secondary" onclick="editAvailability('${a.id}')">編集</button>
            <button type="button" class="danger" onclick="deleteAvailability('${a.id}')">削除</button>
          </div>
        ` : ''}
      </article>
    `;
  }).join('');
}

function renderMatrix() {
  const table = $('availabilityMatrix');
  if (!state.members.length || !state.availability.length) {
    table.innerHTML = '<tr><td class="empty">日付ごとの入力状況はまだありません。</td></tr>';
    return;
  }
  const dates = [...new Set(state.availability.map((a) => a.date))].sort();
  const head = `<tr><th>日付</th>${state.members.map((m) => `<th>${escapeHtml(m.name)}</th>`).join('')}</tr>`;
  const rows = dates.map((date) => {
    const cells = state.members.map((m) => {
      const slots = state.availability
        .filter((a) => a.date === date && a.member_id === m.id)
        .sort(sortByDateTime)
        .map((a) => `${String(a.start_time).slice(0,5)}〜${String(a.end_time).slice(0,5)} ${normalizeLocation(a.location)}`);
      return `<td>${slots.length ? slots.map(escapeHtml).join('<br>') : '<span class="muted">未入力</span>'}</td>`;
    }).join('');
    return `<tr><td><b>${formatDate(date)}</b></td>${cells}</tr>`;
  }).join('');
  table.innerHTML = head + rows;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

window.selectMember = selectMember;
window.deleteSelectedMember = deleteSelectedMember;
window.editAvailability = editAvailability;
window.deleteAvailability = deleteAvailability;
window.confirmSuggestion = confirmSuggestion;
window.unconfirmSlot = unconfirmSlot;
