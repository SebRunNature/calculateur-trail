'use strict';

/* ==========================================================================
   CONSTANTS
   ========================================================================== */
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DAY_MINUTES = 24 * 60;
const SLOT_MIN = 5;
const PX_PER_MIN = 1.5;
const HOUR_PX = 60 * PX_PER_MIN;
const STORAGE_KEY = 'planningToniData_v1';

/* ==========================================================================
   HELPERS
   ========================================================================== */
function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function snap5(min) { return Math.round(min / SLOT_MIN) * SLOT_MIN; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function minutesToLabel(m) {
  m = Math.round(m);
  const h = Math.floor(m / 60), mm = m % 60;
  return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}
function labelToMinutes(hhmm) {
  const parts = String(hhmm || '0:0').split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}
function formatNumber(v) {
  if (v == null || isNaN(v)) return '—';
  const r = Math.round(v * 100) / 100;
  return String(r);
}
function formatPace(v) {
  if (v == null || isNaN(v) || !isFinite(v)) return '—';
  let minutes = Math.floor(v);
  let seconds = Math.round((v - minutes) * 60);
  if (seconds === 60) { minutes += 1; seconds = 0; }
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
}
function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
function escapeCsv(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }

/* ==========================================================================
   SEED DATA
   ========================================================================== */
function buildSeedFieldLibrary() {
  return [
    { id: 'f_distance', label: 'Distance', kind: 'number', unit: 'km' },
    { id: 'f_duree', label: 'Durée', kind: 'duration', unit: 'min' },
    { id: 'f_bpm_moy', label: 'BPM moyen', kind: 'number', unit: 'bpm' },
    { id: 'f_bpm_max', label: 'BPM max', kind: 'number', unit: 'bpm' },
    { id: 'f_type_entrainement', label: "Type d'entraînement", kind: 'select', options: ['Endurance', 'Fractionné', 'Récupération', 'Côtes', 'Compétition'] },
    { id: 'f_nutrition', label: 'Nutrition', kind: 'text' },
    { id: 'f_liquide', label: 'Liquide consommé', kind: 'number', unit: 'mL' },
    { id: 'f_matiere', label: 'Matière', kind: 'select', options: ['Maths', 'Français', 'Histoire-Géo', 'Sciences', 'Langues', 'Autre'] },
    { id: 'f_type_seance', label: 'Type de séance', kind: 'select', options: ['Technique', 'Combat', 'Cardio', 'Compétition'] },
  ];
}
function buildSeedActivities() {
  return [
    { id: 'act_reveil', name: 'Réveil', color: '#ffb648', simple: true, fieldIds: [], pace: null },
    { id: 'act_petitdej', name: 'Petit-déjeuner', color: '#ffd166', simple: true, fieldIds: [], pace: null },
    { id: 'act_ecole', name: 'École', color: '#4f8fef', simple: true, fieldIds: [], pace: null },
    { id: 'act_devoirs', name: 'Devoirs', color: '#7c5cff', simple: false, fieldIds: ['f_duree', 'f_matiere'], pace: null },
    { id: 'act_sport', name: 'Sport', color: '#29b26a', simple: false, fieldIds: ['f_duree'], pace: null },
    { id: 'act_velo', name: 'Vélo', color: '#06aed5', simple: false, fieldIds: ['f_distance', 'f_duree'], pace: null },
    { id: 'act_course', name: 'Course à pied', color: '#f45b69', simple: false,
      fieldIds: ['f_distance', 'f_duree', 'f_bpm_moy', 'f_bpm_max', 'f_type_entrainement', 'f_nutrition', 'f_liquide'],
      pace: { distanceFieldId: 'f_distance', durationFieldId: 'f_duree' } },
    { id: 'act_kravmaga', name: 'Krav Maga', color: '#ee6c4d', simple: false, fieldIds: ['f_duree', 'f_type_seance'], pace: null },
    { id: 'act_plongee', name: 'Plongée', color: '#118ab2', simple: false, fieldIds: ['f_duree'], pace: null },
    { id: 'act_diner', name: 'Dîner', color: '#f4a259', simple: true, fieldIds: [], pace: null },
    { id: 'act_repos', name: 'Repos', color: '#adb5bd', simple: true, fieldIds: [], pace: null },
    { id: 'act_libre', name: 'Libre', color: '#8ecae6', simple: true, fieldIds: [], pace: null },
  ];
}
function buildDefaultState() {
  return {
    fieldLibrary: buildSeedFieldLibrary(),
    activities: buildSeedActivities(),
    archivedActivities: [],
    weekTemplate: [],
    currentWeek: { weekIndex: 1, items: [] },
    favorites: [],
    statHistory: {},
  };
}

/* ==========================================================================
   STATE / PERSISTENCE
   ========================================================================== */
let state = null;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = JSON.parse(raw);
      if (!state.archivedActivities) state.archivedActivities = [];
      if (!state.statHistory) state.statHistory = {};
      if (!state.favorites) state.favorites = [];
      return;
    }
  } catch (e) { console.warn('Lecture localStorage impossible, réinitialisation.', e); }
  state = buildDefaultState();
  save();
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { console.error('Sauvegarde impossible', e); alert("Impossible d'enregistrer les données (stockage plein ?)."); }
}

/* ==========================================================================
   LOOKUPS
   ========================================================================== */
function getField(id) { return state.fieldLibrary.find(f => f.id === id); }
function getActivityById(id) {
  return state.activities.find(a => a.id === id) || state.archivedActivities.find(a => a.id === id) ||
    { id, name: '(activité supprimée)', color: '#999999', simple: true, fieldIds: [], pace: null };
}
function getAllActivitiesForStats() {
  const map = new Map();
  [...state.activities, ...state.archivedActivities].forEach(a => { if (!map.has(a.id)) map.set(a.id, a); });
  return [...map.values()];
}
function pushOccurrence(activityId, day, start, duration, templateId) {
  const item = { id: uid('occ_'), templateId: templateId || null, activityId, day, start, duration, status: null, values: {}, notes: '' };
  state.currentWeek.items.push(item);
  return item;
}

/* ==========================================================================
   DOM REFS
   ========================================================================== */
const $ = (id) => document.getElementById(id);
const weekBadge = $('weekBadge');
const activityList = $('activityList');
const activitySearch = $('activitySearch');
const timeGutter = $('timeGutter');
const weekGrid = $('weekGrid');
const favoritesPanel = $('favoritesPanel');

const choiceModal = $('choiceModal');
const choiceModalText = $('choiceModalText');
const choiceApplyTemplate = $('choiceApplyTemplate');
const choiceApplyOnce = $('choiceApplyOnce');
const choiceCancel = $('choiceCancel');

const editPopover = $('editPopover');
const popDay = $('popDay');
const popStart = $('popStart');
const popDuration = $('popDuration');
const popSave = $('popSave');
const popDuplicate = $('popDuplicate');
const popCopyTo = $('popCopyTo');
const popDelete = $('popDelete');

const copyDayModal = $('copyDayModal');
const copyDayPicker = $('copyDayPicker');
const copyDayCancel = $('copyDayCancel');

const detailModal = $('detailModal');
const detailTitle = $('detailTitle');
const detailClose = $('detailClose');
const detailStatusOk = $('detailStatusOk');
const detailStatusKo = $('detailStatusKo');
const detailStatusClear = $('detailStatusClear');
const detailFields = $('detailFields');
const detailNotes = $('detailNotes');
const detailSave = $('detailSave');

const activityModal = $('activityModal');
const activityModalTitle = $('activityModalTitle');
const activityModalClose = $('activityModalClose');
const actName = $('actName');
const actColor = $('actColor');
const actSimple = $('actSimple');
const actFieldsSection = $('actFieldsSection');
const actFieldsList = $('actFieldsList');
const fieldLibrarySelect = $('fieldLibrarySelect');
const btnAttachField = $('btnAttachField');
const newFieldLabel = $('newFieldLabel');
const newFieldKind = $('newFieldKind');
const newFieldUnit = $('newFieldUnit');
const newFieldOptions = $('newFieldOptions');
const btnCreateField = $('btnCreateField');
const actPaceEnable = $('actPaceEnable');
const actPaceConfig = $('actPaceConfig');
const actPaceDistanceField = $('actPaceDistanceField');
const actPaceDurationField = $('actPaceDurationField');
const activityDelete = $('activityDelete');
const activitySave = $('activitySave');

const allStatsModal = $('allStatsModal');
const allStatsClose = $('allStatsClose');
const allStatsList = $('allStatsList');
const statDetailModal = $('statDetailModal');
const statDetailClose = $('statDetailClose');
const statDetailTitle = $('statDetailTitle');
const statDetailBody = $('statDetailBody');

const printArea = $('printArea');

function showModal(el) { el.classList.remove('hidden'); }
function hideModal(el) { el.classList.add('hidden'); }

/* ==========================================================================
   STRUCTURAL CHANGE (template vs this-week-only) FLOW
   ========================================================================== */
let pendingChange = null;
function requestStructuralChange(desc, handlers) {
  pendingChange = handlers;
  choiceModalText.textContent = desc;
  showModal(choiceModal);
}
choiceApplyTemplate.addEventListener('click', () => {
  if (pendingChange) pendingChange.applyTemplate();
  pendingChange = null;
  hideModal(choiceModal);
  save(); checkAutoAdvance(); renderAll();
});
choiceApplyOnce.addEventListener('click', () => {
  if (pendingChange) pendingChange.applyWeekOnly();
  pendingChange = null;
  hideModal(choiceModal);
  save(); checkAutoAdvance(); renderAll();
});
choiceCancel.addEventListener('click', () => {
  pendingChange = null;
  hideModal(choiceModal);
  renderAll();
});
choiceModal.addEventListener('mousedown', (e) => { if (e.target === choiceModal) choiceCancel.click(); });

function moveOrResizeHandlers(item, newDay, newStart, newDuration) {
  return {
    applyTemplate() {
      item.day = newDay; item.start = newStart; item.duration = newDuration;
      if (item.templateId) {
        const tb = state.weekTemplate.find(t => t.id === item.templateId);
        if (tb) { tb.day = newDay; tb.start = newStart; tb.duration = newDuration; }
      } else {
        const tb = { id: uid('tpl_'), activityId: item.activityId, day: newDay, start: newStart, duration: newDuration };
        state.weekTemplate.push(tb);
        item.templateId = tb.id;
      }
    },
    applyWeekOnly() { item.day = newDay; item.start = newStart; item.duration = newDuration; }
  };
}
function createHandlers(activityId, day, start, duration) {
  return {
    applyTemplate() {
      const tb = { id: uid('tpl_'), activityId, day, start, duration };
      state.weekTemplate.push(tb);
      pushOccurrence(activityId, day, start, duration, tb.id);
    },
    applyWeekOnly() { pushOccurrence(activityId, day, start, duration, null); }
  };
}
function deleteHandlers(item) {
  return {
    applyTemplate() {
      state.currentWeek.items = state.currentWeek.items.filter(i => i.id !== item.id);
      if (item.templateId) state.weekTemplate = state.weekTemplate.filter(t => t.id !== item.templateId);
    },
    applyWeekOnly() {
      state.currentWeek.items = state.currentWeek.items.filter(i => i.id !== item.id);
    }
  };
}

/* ==========================================================================
   WEEK ROLLOVER
   ========================================================================== */
function checkAutoAdvance() {
  const items = state.currentWeek.items;
  if (items.length > 0 && items.every(i => i.status != null)) startNewWeek();
}
function generateWeekFromTemplate(weekIndex) {
  return {
    weekIndex,
    items: state.weekTemplate.map(tb => ({
      id: uid('occ_'), templateId: tb.id, activityId: tb.activityId,
      day: tb.day, start: tb.start, duration: tb.duration,
      status: null, values: {}, notes: ''
    }))
  };
}
function archiveFavoriteStats() {
  const catalog = buildStatCatalog();
  state.favorites.forEach(key => {
    const stat = catalog.find(s => s.key === key);
    if (!stat) return;
    const value = stat.compute();
    if (!state.statHistory[key]) state.statHistory[key] = [];
    state.statHistory[key].push({
      weekIndex: state.currentWeek.weekIndex, date: todayISO(),
      value, display: stat.format(value), label: stat.label
    });
  });
}
function startNewWeek() {
  archiveFavoriteStats();
  state.currentWeek = generateWeekFromTemplate(state.currentWeek.weekIndex + 1);
  save();
  renderAll();
}
$('btnNewWeek').addEventListener('click', () => {
  if (confirm('Démarrer une nouvelle semaine vierge maintenant ? Les activités non traitées de la semaine en cours ne seront pas conservées (sauf statistiques favorites).')) {
    startNewWeek();
  }
});

/* ==========================================================================
   RENDER: ACTIVITY LIST (left sidebar)
   ========================================================================== */
function renderActivityList() {
  const filter = (activitySearch.value || '').trim().toLowerCase();
  const sorted = [...state.activities].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  activityList.innerHTML = '';
  sorted.filter(a => a.name.toLowerCase().includes(filter)).forEach(act => {
    const li = document.createElement('li');
    li.className = 'activity-item';
    li.draggable = true;
    li.innerHTML = `<span class="swatch" style="background:${act.color}"></span><span>${act.name}</span><span class="edit-dot" title="Modifier">✏️</span>`;
    li.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', act.id);
      e.dataTransfer.effectAllowed = 'copy';
    });
    li.querySelector('.edit-dot').addEventListener('click', (e) => {
      e.stopPropagation();
      openActivityModal(act.id);
    });
    activityList.appendChild(li);
  });
}
activitySearch.addEventListener('input', renderActivityList);
$('btnNewActivity').addEventListener('click', () => openActivityModal(null));

/* ==========================================================================
   RENDER: WEEK GRID (center)
   ========================================================================== */
function renderGrid() {
  weekBadge.textContent = `Semaine #${state.currentWeek.weekIndex}`;
  weekGrid.innerHTML = '<div class="grid-corner"></div>';
  weekGrid.style.setProperty('--hour-px', HOUR_PX + 'px');

  DAYS.forEach((d) => {
    const h = document.createElement('div');
    h.className = 'day-header';
    h.textContent = d;
    weekGrid.appendChild(h);
  });

  const gutter = document.createElement('div');
  gutter.className = 'time-gutter';
  gutter.style.height = (DAY_MINUTES * PX_PER_MIN) + 'px';
  for (let h = 0; h <= 24; h++) {
    const lbl = document.createElement('div');
    lbl.className = 'time-label';
    lbl.style.top = (h * HOUR_PX) + 'px';
    lbl.textContent = String(h).padStart(2, '0') + ':00';
    gutter.appendChild(lbl);
  }
  weekGrid.appendChild(gutter);

  const columns = [];
  for (let d = 0; d < 7; d++) {
    const col = document.createElement('div');
    col.className = 'day-column';
    col.dataset.day = String(d);
    col.style.height = (DAY_MINUTES * PX_PER_MIN) + 'px';
    col.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const actId = e.dataTransfer.getData('text/plain');
      if (!actId) return;
      const rect = col.getBoundingClientRect();
      const y = e.clientY - rect.top;
      let start = snap5(y / PX_PER_MIN);
      start = clamp(start, 0, DAY_MINUTES - 30);
      const act = getActivityById(actId);
      requestStructuralChange(`Placer « ${act.name} » le ${DAYS[d]} à ${minutesToLabel(start)}.`, createHandlers(actId, d, start, 30));
    });
    weekGrid.appendChild(col);
    columns.push(col);
  }

  state.currentWeek.items.forEach(item => {
    const col = columns[item.day];
    if (!col) return;
    col.appendChild(buildBlockEl(item));
  });
}

function buildBlockEl(item) {
  const act = getActivityById(item.activityId);
  const el = document.createElement('div');
  el.className = 'block';
  if (item.status === 'done') el.classList.add('is-done');
  if (item.status === 'cancelled') el.classList.add('is-cancelled');
  el.style.top = (item.start * PX_PER_MIN) + 'px';
  el.style.height = Math.max(item.duration * PX_PER_MIN, 16) + 'px';
  el.style.background = act.color;
  el.dataset.itemId = item.id;

  el.innerHTML = `
    <div class="block-top-row">
      <div class="block-buttons">
        <button class="status-mini status-ok-btn ${item.status === 'done' ? 'active-ok' : ''}" title="Réalisée">✓</button>
        <button class="status-mini status-ko-btn ${item.status === 'cancelled' ? 'active-ko' : ''}" title="Annulée">✕</button>
      </div>
      <button class="block-menu" title="Options">⋯</button>
    </div>
    <div class="block-title">${act.name}</div>
    <div class="block-time">${minutesToLabel(item.start)}–${minutesToLabel(item.start + item.duration)}</div>
    <div class="resize-handle"></div>
  `;

  el.querySelector('.status-ok-btn').addEventListener('mousedown', e => e.stopPropagation());
  el.querySelector('.status-ko-btn').addEventListener('mousedown', e => e.stopPropagation());
  el.querySelector('.block-menu').addEventListener('mousedown', e => e.stopPropagation());

  el.querySelector('.status-ok-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    item.status = item.status === 'done' ? null : 'done';
    save(); checkAutoAdvance(); renderAll();
  });
  el.querySelector('.status-ko-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    item.status = item.status === 'cancelled' ? null : 'cancelled';
    save(); checkAutoAdvance(); renderAll();
  });
  el.querySelector('.block-menu').addEventListener('click', (e) => {
    e.stopPropagation();
    openEditPopover(item, el);
  });
  el.querySelector('.resize-handle').addEventListener('mousedown', (e) => onResizeMouseDown(e, item, el));
  el.addEventListener('mousedown', (e) => onBlockMouseDown(e, item, el));

  return el;
}

function onBlockMouseDown(e, item, blockEl) {
  if (e.target.closest('.resize-handle') || e.target.closest('.status-mini') || e.target.closest('.block-menu')) return;
  e.preventDefault();
  const startX = e.clientX, startY = e.clientY;
  const origDay = item.day, origStart = item.start;
  let moved = false;
  const colRects = [...document.querySelectorAll('.day-column')].map(c => ({ el: c, day: +c.dataset.day, rect: c.getBoundingClientRect() }));

  function onMove(ev) {
    const dx = ev.clientX - startX, dy = ev.clientY - startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
    if (!moved) return;
    blockEl.classList.add('dragging');
    let col = colRects.find(c => ev.clientX >= c.rect.left && ev.clientX < c.rect.right);
    if (!col) col = ev.clientX < colRects[0].rect.left ? colRects[0] : colRects[colRects.length - 1];
    const deltaMin = dy / PX_PER_MIN;
    let newStart = snap5(origStart + deltaMin);
    newStart = clamp(newStart, 0, DAY_MINUTES - item.duration);
    blockEl.style.top = (newStart * PX_PER_MIN) + 'px';
    if (col.el !== blockEl.parentElement) col.el.appendChild(blockEl);
    blockEl.dataset.pendingDay = String(col.day);
    blockEl.dataset.pendingStart = String(newStart);
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    blockEl.classList.remove('dragging');
    if (!moved) { handleBlockClick(item); return; }
    const newDay = blockEl.dataset.pendingDay !== undefined ? +blockEl.dataset.pendingDay : origDay;
    const newStart = blockEl.dataset.pendingStart !== undefined ? +blockEl.dataset.pendingStart : origStart;
    if (newDay === origDay && newStart === origStart) { renderAll(); return; }
    const act = getActivityById(item.activityId);
    requestStructuralChange(`Déplacer « ${act.name} » vers ${DAYS[newDay]} ${minutesToLabel(newStart)}.`,
      moveOrResizeHandlers(item, newDay, newStart, item.duration));
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function onResizeMouseDown(e, item, blockEl) {
  e.stopPropagation(); e.preventDefault();
  const startY = e.clientY;
  const origDuration = item.duration;
  let moved = false;
  function onMove(ev) {
    const dy = ev.clientY - startY;
    if (Math.abs(dy) > 2) moved = true;
    if (!moved) return;
    let newDuration = snap5(origDuration + dy / PX_PER_MIN);
    newDuration = clamp(newDuration, 5, DAY_MINUTES - item.start);
    blockEl.style.height = Math.max(newDuration * PX_PER_MIN, 16) + 'px';
    blockEl.dataset.pendingDuration = String(newDuration);
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (!moved) return;
    const newDuration = blockEl.dataset.pendingDuration !== undefined ? +blockEl.dataset.pendingDuration : origDuration;
    if (newDuration === origDuration) return;
    const act = getActivityById(item.activityId);
    requestStructuralChange(`Modifier la durée de « ${act.name} » à ${newDuration} min.`,
      moveOrResizeHandlers(item, item.day, item.start, newDuration));
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function handleBlockClick(item) {
  const act = getActivityById(item.activityId);
  if (!act.simple) openDetailModal(item);
}

/* ==========================================================================
   EDIT POPOVER (structural: day / start / duration / duplicate / copy / delete)
   ========================================================================== */
let popoverItem = null;
function openEditPopover(item, blockEl) {
  popoverItem = item;
  popDay.innerHTML = DAYS.map((d, i) => `<option value="${i}" ${i === item.day ? 'selected' : ''}>${d}</option>`).join('');
  popStart.value = minutesToLabel(item.start);
  popDuration.value = item.duration;
  const rect = blockEl.getBoundingClientRect();
  editPopover.style.left = (rect.right + 8 + window.scrollX) + 'px';
  editPopover.style.top = (rect.top + window.scrollY) + 'px';
  showModal(editPopover);
  editPopover.classList.remove('hidden');
}
document.addEventListener('mousedown', (e) => {
  if (!editPopover.classList.contains('hidden') && !editPopover.contains(e.target) && !e.target.closest('.block-menu')) {
    hideModal(editPopover);
  }
});
popSave.addEventListener('click', () => {
  const item = popoverItem; if (!item) return;
  const newDay = +popDay.value;
  const newStart = clamp(snap5(labelToMinutes(popStart.value)), 0, DAY_MINUTES - 5);
  const newDuration = clamp(snap5(+popDuration.value || 5), 5, DAY_MINUTES - newStart);
  hideModal(editPopover);
  if (newDay === item.day && newStart === item.start && newDuration === item.duration) return;
  const act = getActivityById(item.activityId);
  requestStructuralChange(`Modifier « ${act.name} » (${DAYS[newDay]} ${minutesToLabel(newStart)}, ${newDuration} min).`,
    moveOrResizeHandlers(item, newDay, newStart, newDuration));
});
popDuplicate.addEventListener('click', () => {
  const item = popoverItem; if (!item) return;
  hideModal(editPopover);
  let newStart = snap5(item.start + item.duration);
  if (newStart + item.duration > DAY_MINUTES) newStart = clamp(DAY_MINUTES - item.duration, 0, DAY_MINUTES);
  const act = getActivityById(item.activityId);
  requestStructuralChange(`Dupliquer « ${act.name} » le ${DAYS[item.day]}.`, createHandlers(item.activityId, item.day, newStart, item.duration));
});
popCopyTo.addEventListener('click', () => {
  hideModal(editPopover);
  copyDayPicker.innerHTML = '';
  DAYS.forEach((d, i) => {
    const btn = document.createElement('button');
    btn.textContent = d;
    btn.addEventListener('click', () => {
      hideModal(copyDayModal);
      const item = popoverItem; if (!item) return;
      const act = getActivityById(item.activityId);
      requestStructuralChange(`Copier « ${act.name} » vers ${d}.`, createHandlers(item.activityId, i, item.start, item.duration));
    });
    copyDayPicker.appendChild(btn);
  });
  showModal(copyDayModal);
});
copyDayCancel.addEventListener('click', () => hideModal(copyDayModal));
copyDayModal.addEventListener('mousedown', (e) => { if (e.target === copyDayModal) hideModal(copyDayModal); });
popDelete.addEventListener('click', () => {
  const item = popoverItem; if (!item) return;
  hideModal(editPopover);
  const act = getActivityById(item.activityId);
  requestStructuralChange(`Supprimer « ${act.name} » (${DAYS[item.day]} ${minutesToLabel(item.start)}).`, deleteHandlers(item));
});

/* ==========================================================================
   DETAIL MODAL (per-occurrence: status / fields / notes)
   ========================================================================== */
let detailItem = null;
function openDetailModal(item) {
  detailItem = item;
  const act = getActivityById(item.activityId);
  detailTitle.textContent = `${act.name} — ${DAYS[item.day]} ${minutesToLabel(item.start)}–${minutesToLabel(item.start + item.duration)}`;
  refreshDetailStatusButtons();
  detailFields.innerHTML = '';
  const fieldInputs = {};
  act.fieldIds.forEach(fid => {
    const f = getField(fid);
    if (!f) return;
    const wrap = document.createElement('label');
    wrap.className = 'field-block';
    const unit = f.unit ? ` (${f.unit})` : '';
    let inputHtml = '';
    const currentVal = item.values && item.values[fid] != null ? item.values[fid] : '';
    if (f.kind === 'select') {
      inputHtml = `<select data-field="${fid}"><option value="">—</option>${(f.options || []).map(o => `<option value="${o}" ${o === currentVal ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    } else if (f.kind === 'text') {
      inputHtml = `<input type="text" data-field="${fid}" value="${(currentVal || '').toString().replace(/"/g, '&quot;')}">`;
    } else {
      inputHtml = `<input type="number" step="any" data-field="${fid}" value="${currentVal}">`;
    }
    wrap.innerHTML = `${f.label}${unit}${inputHtml}`;
    detailFields.appendChild(wrap);
    fieldInputs[fid] = wrap.querySelector('[data-field]');
  });
  if (act.pace) {
    const paceWrap = document.createElement('div');
    paceWrap.className = 'field-block';
    paceWrap.innerHTML = `Allure (auto) <span id="pacePreview" style="font-weight:700;font-size:15px;color:#3a6fd1;">—</span>`;
    detailFields.appendChild(paceWrap);
    const preview = paceWrap.querySelector('#pacePreview');
    const distInput = fieldInputs[act.pace.distanceFieldId];
    const durInput = fieldInputs[act.pace.durationFieldId];
    function updatePreview() {
      const d = parseFloat(distInput ? distInput.value : NaN);
      const t = parseFloat(durInput ? durInput.value : NaN);
      preview.textContent = (d > 0 && !isNaN(t)) ? formatPace(t / d) : '—';
    }
    if (distInput) distInput.addEventListener('input', updatePreview);
    if (durInput) durInput.addEventListener('input', updatePreview);
    updatePreview();
  }
  detailNotes.value = item.notes || '';
  showModal(detailModal);
}
function refreshDetailStatusButtons() {
  detailStatusOk.classList.toggle('is-active', detailItem.status === 'done');
  detailStatusKo.classList.toggle('is-active', detailItem.status === 'cancelled');
}
detailStatusOk.addEventListener('click', () => { detailItem.status = detailItem.status === 'done' ? null : 'done'; refreshDetailStatusButtons(); });
detailStatusKo.addEventListener('click', () => { detailItem.status = detailItem.status === 'cancelled' ? null : 'cancelled'; refreshDetailStatusButtons(); });
detailStatusClear.addEventListener('click', () => { detailItem.status = null; refreshDetailStatusButtons(); });
function commitDetail() {
  if (!detailItem) return;
  const act = getActivityById(detailItem.activityId);
  const values = {};
  act.fieldIds.forEach(fid => {
    const input = detailFields.querySelector(`[data-field="${fid}"]`);
    if (!input) return;
    values[fid] = input.value === '' ? null : input.value;
  });
  detailItem.values = values;
  detailItem.notes = detailNotes.value;
  hideModal(detailModal);
  save();
  checkAutoAdvance();
  renderAll();
}
detailSave.addEventListener('click', commitDetail);
detailClose.addEventListener('click', commitDetail);
detailModal.addEventListener('mousedown', (e) => { if (e.target === detailModal) commitDetail(); });

/* ==========================================================================
   ACTIVITY DEFINITION MODAL (create / edit / delete)
   ========================================================================== */
let draftActivity = null;
let editingActivityId = null;

function openActivityModal(editId) {
  editingActivityId = editId;
  draftActivity = editId ? deepClone(getActivityById(editId)) : { id: null, name: '', color: '#4f8fef', simple: false, fieldIds: [], pace: null };
  actName.value = draftActivity.name;
  actColor.value = draftActivity.color || '#4f8fef';
  actSimple.checked = !!draftActivity.simple;
  actPaceEnable.checked = !!draftActivity.pace;
  toggleFieldsSectionVisibility();
  togglePaceConfigVisibility();
  renderFieldLibrarySelect();
  renderAttachedFieldsList();
  renderPaceFieldSelects();
  activityDelete.style.display = editId ? '' : 'none';
  activityModalTitle.textContent = editId ? 'Modifier une activité' : 'Nouvelle activité';
  showModal(activityModal);
}
function toggleFieldsSectionVisibility() { actFieldsSection.style.display = actSimple.checked ? 'none' : ''; }
function togglePaceConfigVisibility() { actPaceConfig.classList.toggle('hidden', !actPaceEnable.checked); }
actSimple.addEventListener('change', toggleFieldsSectionVisibility);
actPaceEnable.addEventListener('change', () => {
  if (actPaceEnable.checked) {
    const hasNumber = draftActivity.fieldIds.some(fid => getField(fid) && getField(fid).kind === 'number');
    const hasDuration = draftActivity.fieldIds.some(fid => getField(fid) && getField(fid).kind === 'duration');
    if (!hasNumber || !hasDuration) {
      alert('Ajoutez au moins un champ "Nombre" (distance) et un champ "Durée" à cette activité avant d\'activer le calcul automatique.');
      actPaceEnable.checked = false;
      return;
    }
  }
  togglePaceConfigVisibility();
  renderPaceFieldSelects();
});

function renderFieldLibrarySelect() {
  const sorted = [...state.fieldLibrary].sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  fieldLibrarySelect.innerHTML = sorted.map(f => `<option value="${f.id}">${f.label}${f.unit ? ' (' + f.unit + ')' : ''} — ${kindLabel(f.kind)}</option>`).join('');
}
function kindLabel(kind) {
  return { number: 'nombre', duration: 'durée', text: 'texte', select: 'liste' }[kind] || kind;
}
function renderAttachedFieldsList() {
  actFieldsList.innerHTML = '';
  draftActivity.fieldIds.forEach(fid => {
    const f = getField(fid);
    if (!f) return;
    const li = document.createElement('li');
    li.innerHTML = `<span>${f.label}${f.unit ? ' (' + f.unit + ')' : ''}</span><button title="Retirer">✕</button>`;
    li.querySelector('button').addEventListener('click', () => {
      draftActivity.fieldIds = draftActivity.fieldIds.filter(x => x !== fid);
      if (draftActivity.pace && (draftActivity.pace.distanceFieldId === fid || draftActivity.pace.durationFieldId === fid)) {
        draftActivity.pace = null; actPaceEnable.checked = false; togglePaceConfigVisibility();
      }
      renderAttachedFieldsList(); renderPaceFieldSelects();
    });
    actFieldsList.appendChild(li);
  });
}
btnAttachField.addEventListener('click', () => {
  const fid = fieldLibrarySelect.value;
  if (fid && !draftActivity.fieldIds.includes(fid)) draftActivity.fieldIds.push(fid);
  renderAttachedFieldsList(); renderPaceFieldSelects();
});
btnCreateField.addEventListener('click', () => {
  const label = newFieldLabel.value.trim();
  if (!label) { alert('Le nom du champ est requis.'); return; }
  const kind = newFieldKind.value;
  const unit = newFieldUnit.value.trim();
  const options = kind === 'select' ? newFieldOptions.value.split(',').map(s => s.trim()).filter(Boolean) : undefined;
  const field = { id: uid('f_'), label, kind, unit: unit || undefined, options };
  state.fieldLibrary.push(field);
  save();
  draftActivity.fieldIds.push(field.id);
  newFieldLabel.value = ''; newFieldUnit.value = ''; newFieldOptions.value = '';
  renderFieldLibrarySelect(); renderAttachedFieldsList(); renderPaceFieldSelects();
});
function renderPaceFieldSelects() {
  const numberFields = draftActivity.fieldIds.map(getField).filter(f => f && f.kind === 'number');
  const durationFields = draftActivity.fieldIds.map(getField).filter(f => f && f.kind === 'duration');
  actPaceDistanceField.innerHTML = numberFields.map(f => `<option value="${f.id}">${f.label}</option>`).join('');
  actPaceDurationField.innerHTML = durationFields.map(f => `<option value="${f.id}">${f.label}</option>`).join('');
  if (draftActivity.pace) {
    actPaceDistanceField.value = draftActivity.pace.distanceFieldId;
    actPaceDurationField.value = draftActivity.pace.durationFieldId;
  }
}
activitySave.addEventListener('click', () => {
  const name = actName.value.trim();
  if (!name) { alert('Le nom est requis.'); return; }
  draftActivity.name = name;
  draftActivity.color = actColor.value;
  draftActivity.simple = actSimple.checked;
  if (draftActivity.simple) {
    draftActivity.fieldIds = []; draftActivity.pace = null;
  } else if (actPaceEnable.checked) {
    const distId = actPaceDistanceField.value, durId = actPaceDurationField.value;
    if (!distId || !durId) { alert("Sélectionnez les deux champs pour le calcul d'allure."); return; }
    draftActivity.pace = { distanceFieldId: distId, durationFieldId: durId };
  } else {
    draftActivity.pace = null;
  }
  if (editingActivityId) {
    const idx = state.activities.findIndex(a => a.id === editingActivityId);
    state.activities[idx] = draftActivity;
  } else {
    draftActivity.id = uid('act_');
    state.activities.push(draftActivity);
  }
  save();
  hideModal(activityModal);
  renderAll();
});
activityDelete.addEventListener('click', () => {
  if (!editingActivityId) return;
  if (!confirm("Supprimer cette activité de la liste ? Les occurrences déjà enregistrées (semaine en cours, semaine type) seront conservées.")) return;
  const idx = state.activities.findIndex(a => a.id === editingActivityId);
  if (idx >= 0) {
    const [removed] = state.activities.splice(idx, 1);
    state.archivedActivities.push(removed);
  }
  save();
  hideModal(activityModal);
  renderAll();
});
activityModalClose.addEventListener('click', () => hideModal(activityModal));
activityModal.addEventListener('mousedown', (e) => { if (e.target === activityModal) hideModal(activityModal); });

/* ==========================================================================
   STATISTICS ENGINE
   ========================================================================== */
function countDone(activityId) {
  return state.currentWeek.items.filter(i => i.activityId === activityId && i.status === 'done').length;
}
function fieldValuesFor(activityId, fieldId) {
  return state.currentWeek.items
    .filter(i => i.activityId === activityId && i.status === 'done' && i.values && i.values[fieldId] != null && i.values[fieldId] !== '')
    .map(i => parseFloat(i.values[fieldId]))
    .filter(v => !isNaN(v));
}
function sumField(activityId, fieldId) {
  const vals = fieldValuesFor(activityId, fieldId);
  return vals.reduce((s, v) => s + v, 0);
}
function avgField(activityId, fieldId) {
  const vals = fieldValuesFor(activityId, fieldId);
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
}
function computePace(act) {
  const totalDist = sumField(act.id, act.pace.distanceFieldId);
  const totalDur = sumField(act.id, act.pace.durationFieldId);
  if (totalDist <= 0) return null;
  return totalDur / totalDist;
}
function buildStatCatalog() {
  const catalog = [];
  catalog.push({ key: 'global_done', label: 'Activités réalisées (semaine)', activityId: null, compute: () => state.currentWeek.items.filter(i => i.status === 'done').length, format: v => String(v) });
  catalog.push({ key: 'global_cancelled', label: 'Activités annulées (semaine)', activityId: null, compute: () => state.currentWeek.items.filter(i => i.status === 'cancelled').length, format: v => String(v) });
  getAllActivitiesForStats().forEach(act => {
    catalog.push({ key: `count_${act.id}`, label: `Séances réalisées – ${act.name}`, activityId: act.id, compute: () => countDone(act.id), format: v => String(v) });
    if (act.simple) return;
    (act.fieldIds || []).forEach(fid => {
      const f = getField(fid);
      if (!f || (f.kind !== 'number' && f.kind !== 'duration')) return;
      const unitSuffix = f.unit ? ' ' + f.unit : '';
      catalog.push({ key: `sum_${act.id}_${fid}`, label: `Total ${f.label} – ${act.name}`, activityId: act.id, compute: () => sumField(act.id, fid), format: v => formatNumber(v) + unitSuffix });
      catalog.push({ key: `avg_${act.id}_${fid}`, label: `Moyenne ${f.label} – ${act.name}`, activityId: act.id, compute: () => avgField(act.id, fid), format: v => formatNumber(v) + unitSuffix });
    });
    if (act.pace) {
      catalog.push({ key: `pace_${act.id}`, label: `Allure moyenne – ${act.name}`, activityId: act.id, compute: () => computePace(act), format: v => formatPace(v) });
    }
  });
  return catalog;
}

/* ==========================================================================
   RENDER: FAVORITES DASHBOARD (right sidebar)
   ========================================================================== */
function renderFavorites() {
  const catalog = buildStatCatalog();
  favoritesPanel.innerHTML = '';
  if (state.favorites.length === 0) {
    favoritesPanel.innerHTML = '<div class="fav-empty">Aucune statistique favorite.<br>Utilisez « Toutes les stats » pour en choisir jusqu\'à 3 ⭐.</div>';
    return;
  }
  state.favorites.forEach(key => {
    const stat = catalog.find(s => s.key === key);
    if (!stat) return;
    const value = stat.compute();
    const history = (state.statHistory[key] || []).slice(-5);
    const card = document.createElement('div');
    card.className = 'fav-card';
    card.innerHTML = `
      <div class="fav-label"><span>${stat.label}</span><span>⭐</span></div>
      <div class="fav-value">${stat.format(value)}</div>
      <div class="fav-history">${history.map(h => `<span>S${h.weekIndex}: ${h.display}</span>`).join('') || '<span>Pas encore d\'historique</span>'}</div>
    `;
    card.addEventListener('click', () => openStatDetail(key));
    favoritesPanel.appendChild(card);
  });
}

/* ==========================================================================
   ALL-STATS MODAL & STAT DETAIL MODAL
   ========================================================================== */
$('btnAllStats').addEventListener('click', () => {
  renderAllStatsList();
  showModal(allStatsModal);
});
allStatsClose.addEventListener('click', () => hideModal(allStatsModal));
allStatsModal.addEventListener('mousedown', (e) => { if (e.target === allStatsModal) hideModal(allStatsModal); });

function renderAllStatsList() {
  const catalog = buildStatCatalog();
  allStatsList.innerHTML = '';
  catalog.forEach(stat => {
    const li = document.createElement('li');
    const isFav = state.favorites.includes(stat.key);
    const value = stat.compute();
    li.innerHTML = `
      <div class="stat-row-left">
        <button class="stat-star ${isFav ? 'active' : ''}">★</button>
        <span class="stat-name">${stat.label}</span>
      </div>
      <span class="stat-value">${stat.format(value)}</span>
    `;
    li.querySelector('.stat-star').addEventListener('click', () => toggleFavorite(stat.key));
    li.querySelector('.stat-name').addEventListener('click', () => openStatDetail(stat.key));
    allStatsList.appendChild(li);
  });
}
function toggleFavorite(key) {
  if (state.favorites.includes(key)) {
    state.favorites = state.favorites.filter(k => k !== key);
  } else {
    if (state.favorites.length >= 3) { alert('Maximum 3 statistiques favorites. Retirez-en une avant d\'en ajouter une nouvelle.'); return; }
    state.favorites.push(key);
  }
  save();
  renderAllStatsList();
  renderFavorites();
}
function openStatDetail(key) {
  const catalog = buildStatCatalog();
  const stat = catalog.find(s => s.key === key);
  if (!stat) return;
  statDetailTitle.textContent = stat.label;
  const value = stat.compute();
  let html = `<div class="fav-value" style="font-size:30px;">${stat.format(value)}</div>`;

  if (stat.activityId) {
    const act = getActivityById(stat.activityId);
    if (act.pace) {
      const totalDist = sumField(act.id, act.pace.distanceFieldId);
      const totalDur = sumField(act.id, act.pace.durationFieldId);
      const sessions = countDone(act.id);
      html += `<table style="width:100%;font-size:13.5px;margin-top:10px;border-collapse:collapse;">
        <tr><td>Séances réalisées</td><td style="text-align:right;font-weight:700;">${sessions}</td></tr>
        <tr><td>Distance totale</td><td style="text-align:right;font-weight:700;">${formatNumber(totalDist)} km</td></tr>
        <tr><td>Durée totale</td><td style="text-align:right;font-weight:700;">${formatNumber(totalDur)} min</td></tr>
        <tr><td>Allure moyenne</td><td style="text-align:right;font-weight:700;">${totalDist > 0 ? formatPace(totalDur / totalDist) : '—'}</td></tr>
      </table>`;
    }
  }

  const hist = state.statHistory[key];
  if (hist && hist.length) {
    html += `<h4 style="margin-top:14px;">Historique</h4><table style="width:100%;font-size:13px;border-collapse:collapse;">
      <tr><th style="text-align:left;">Semaine</th><th style="text-align:left;">Date</th><th style="text-align:right;">Valeur</th></tr>
      ${hist.map(h => `<tr><td>#${h.weekIndex}</td><td>${h.date}</td><td style="text-align:right;">${h.display}</td></tr>`).join('')}
    </table>`;
  } else {
    html += `<p class="hint" style="margin-top:14px;">Favorisez cette statistique (⭐) pour suivre son évolution semaine après semaine.</p>`;
  }
  statDetailBody.innerHTML = html;
  showModal(statDetailModal);
}
statDetailClose.addEventListener('click', () => hideModal(statDetailModal));
statDetailModal.addEventListener('mousedown', (e) => { if (e.target === statDetailModal) hideModal(statDetailModal); });

/* ==========================================================================
   CSV EXPORT / IMPORT
   ========================================================================== */
const CSV_COLUMNS = ['kind', 'day', 'activityId', 'activityName', 'start', 'duration', 'status', 'notes', 'fieldsJson', 'weekIndex', 'statKey', 'statLabel', 'date', 'value'];

function buildCsv() {
  const rows = [CSV_COLUMNS];
  state.currentWeek.items.forEach(item => {
    const act = getActivityById(item.activityId);
    rows.push([
      'occurrence', DAYS[item.day], item.activityId, act.name, minutesToLabel(item.start), item.duration,
      item.status || '', item.notes || '', JSON.stringify(item.values || {}), state.currentWeek.weekIndex,
      '', '', '', ''
    ]);
  });
  Object.entries(state.statHistory).forEach(([statKey, entries]) => {
    entries.forEach(h => {
      rows.push(['favorite_history', '', '', '', '', '', '', '', '', h.weekIndex, statKey, h.label, h.date, h.value]);
    });
  });
  return '﻿' + rows.map(r => r.map(escapeCsv).join(',')).join('\r\n');
}
$('btnExport').addEventListener('click', () => {
  const csv = buildCsv();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `planning-toni-semaine-${state.currentWeek.weekIndex}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* skip */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
}
$('btnImport').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      let text = reader.result;
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      const rows = parseCsv(text);
      if (rows.length < 1) throw new Error('Fichier vide.');
      const header = rows[0];
      const idx = {}; header.forEach((h, i) => idx[h] = i);
      const dataRows = rows.slice(1);
      if (!confirm('Importer ce fichier va remplacer la semaine en cours et l\'historique des favoris. Continuer ?')) return;

      let maxWeekIndex = state.currentWeek.weekIndex;
      const newItems = [];
      const newHistory = {};
      dataRows.forEach(r => {
        const kind = r[idx.kind];
        if (kind === 'occurrence') {
          const dayIdx = DAYS.indexOf(r[idx.day]);
          const activityId = r[idx.activityId];
          const activityName = r[idx.activityName];
          if (!getActivityById(activityId) || (!state.activities.find(a => a.id === activityId) && !state.archivedActivities.find(a => a.id === activityId))) {
            state.archivedActivities.push({ id: activityId, name: activityName || activityId, color: '#999999', simple: true, fieldIds: [], pace: null });
          }
          let values = {};
          try { values = JSON.parse(r[idx.fieldsJson] || '{}'); } catch (e2) { values = {}; }
          const wIdx = parseInt(r[idx.weekIndex], 10) || state.currentWeek.weekIndex;
          maxWeekIndex = Math.max(maxWeekIndex, wIdx);
          newItems.push({
            id: uid('occ_'), templateId: null, activityId,
            day: dayIdx >= 0 ? dayIdx : 0,
            start: labelToMinutes(r[idx.start]),
            duration: parseInt(r[idx.duration], 10) || 30,
            status: r[idx.status] || null,
            values, notes: r[idx.notes] || ''
          });
        } else if (kind === 'favorite_history') {
          const statKey = r[idx.statKey];
          if (!statKey) return;
          if (!newHistory[statKey]) newHistory[statKey] = [];
          newHistory[statKey].push({
            weekIndex: parseInt(r[idx.weekIndex], 10) || 0,
            date: r[idx.date] || todayISO(),
            value: parseFloat(r[idx.value]),
            display: r[idx.value],
            label: r[idx.statLabel] || statKey
          });
        }
      });
      state.currentWeek = { weekIndex: maxWeekIndex, items: newItems };
      state.statHistory = newHistory;
      save();
      renderAll();
      alert('Import terminé.');
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'import : " + err.message);
    } finally {
      e.target.value = '';
    }
  };
  reader.readAsText(file, 'utf-8');
});

/* ==========================================================================
   PRINT
   ========================================================================== */
function buildPrintArea() {
  const wrap = document.createElement('div');
  wrap.className = 'print-week';
  wrap.innerHTML = `<h1>Planning — Semaine #${state.currentWeek.weekIndex}</h1>`;
  for (let d = 0; d < 7; d++) {
    const dayItems = state.currentWeek.items.filter(i => i.day === d).sort((a, b) => a.start - b.start);
    const dayDiv = document.createElement('div');
    dayDiv.className = 'print-day';
    let rowsHtml = '';
    if (dayItems.length === 0) {
      rowsHtml = '<tr><td colspan="4" style="color:#999;">Aucune activité</td></tr>';
    } else {
      rowsHtml = dayItems.map(item => {
        const act = getActivityById(item.activityId);
        const statusHtml = item.status === 'done' ? '<span class="print-status-ok">Réalisée ✓</span>'
          : item.status === 'cancelled' ? '<span class="print-status-ko">Annulée ✕</span>'
          : '<span class="print-status-none">—</span>';
        const fieldParts = (act.fieldIds || []).map(fid => {
          const f = getField(fid);
          const v = item.values && item.values[fid];
          if (!f || v == null || v === '') return null;
          return `${f.label}: ${v}${f.unit ? ' ' + f.unit : ''}`;
        }).filter(Boolean);
        if (item.notes) fieldParts.push('Notes: ' + item.notes);
        return `<tr>
          <td>${minutesToLabel(item.start)}–${minutesToLabel(item.start + item.duration)}</td>
          <td>${act.name}</td>
          <td>${statusHtml}</td>
          <td>${fieldParts.join(' • ')}</td>
        </tr>`;
      }).join('');
    }
    dayDiv.innerHTML = `<h2>${DAYS[d]}</h2><table><tr><th>Horaire</th><th>Activité</th><th>Statut</th><th>Détails</th></tr>${rowsHtml}</table>`;
    wrap.appendChild(dayDiv);
  }
  printArea.innerHTML = '';
  printArea.appendChild(wrap);
}
$('btnPrint').addEventListener('click', () => { buildPrintArea(); window.print(); });

/* ==========================================================================
   MASTER RENDER
   ========================================================================== */
function renderAll() {
  renderActivityList();
  renderGrid();
  renderFavorites();
}

/* ==========================================================================
   INIT
   ========================================================================== */
load();
renderAll();
