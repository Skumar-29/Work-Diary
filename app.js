const DAY_MS = 86400000;
const SLOT = 15;
const SLOTS_PER_DAY = 96;

const RULES = {
  BFM: {
    name: "BFM",
    windows: [
      {label:"6¼h", minutes:375, maxWork:360, rest:"15 min continuous rest"},
      {label:"9h", minutes:540, maxWork:510, rest:"30 min rest in 15-min blocks"},
      {label:"12h", minutes:720, maxWork:660, rest:"60 min rest in 15-min blocks"},
      {label:"24h", minutes:1440, maxWork:840, rest:"7h continuous stationary rest"},
    ],
    majorRest: 420
  },
  Standard: {
    name: "Standard",
    windows: [
      {label:"5½h", minutes:330, maxWork:315, rest:"15 min continuous rest"},
      {label:"8h", minutes:480, maxWork:450, rest:"30 min rest in 15-min blocks"},
      {label:"11h", minutes:660, maxWork:600, rest:"60 min rest in 15-min blocks"},
      {label:"24h", minutes:1440, maxWork:720, rest:"7h continuous stationary rest"},
    ],
    majorRest: 420
  },
  StandardTwoUp: {
    name: "Standard Two-up",
    windows: [
      {label:"24h", minutes:1440, maxWork:720, rest:"5h continuous rest/stationary rest or approved sleeper berth"},
      {label:"7 days", minutes:10080, maxWork:3600, rest:"24h continuous stationary rest, plus 24h rest in blocks of at least 7h"},
      {label:"14 days", minutes:20160, maxWork:7200, rest:"2 night rest breaks / consecutive night-rest requirements"}
    ],
    majorRest: 300,
    majorRestWindow: 1440,
    extraRestWindows: [
      {label:"10h continuous stationary rest in any 52h period", minutes:3120, required:600}
    ],
    max14Work: 7200,
    helperNote: "Standard two-up helper: treats Rest blocks as qualifying rest/sleeper time. Verify sleeper-berth and stationary-rest details in your official diary."
  },
  BFMTwoUp: {
    name: "BFM Two-up",
    windows: [
      {label:"24h", minutes:1440, maxWork:840, rest:"No more than 14h work"},
      {label:"7 days", minutes:10080, maxWork:4200, rest:"24h continuous stationary rest and 24h stationary rest in blocks of at least 7h"},
      {label:"14 days", minutes:20160, maxWork:8400, rest:"4 night rest breaks"}
    ],
    majorRest: 600,
    majorRestWindow: 4920,
    extraRestWindows: [
      {label:"24h continuous stationary rest in any 7 days", minutes:10080, required:1440}
    ],
    max14Work: 8400,
    helperNote: "BFM two-up helper: uses BFM two-up windows. Verify 82h/7d/14d and night-rest requirements against your official records."
  },
  AFM: {
    name: "AFM record-only",
    windows: [],
    majorRest: 0,
    helperNote: "AFM is record-only until your AFM certificate conditions are entered. The app will not safely calculate AFM fatigue limits."
  }
};

let state = {
  selectedDate: toKey(new Date()),
  scheme: "BFM",
  restAsStationary: true,
  slots: {},
  entries: [],
  activeTimer: null,
  profile: {
    driverName: "",
    licenceNumber: "",
    baseTimeZone: "NSW"
  },
  backupReminder: {
    frequency: "off",
    lastBackupAt: "",
    lastPromptDate: ""
  },
  dayDetails: {},
  bookSettings: {
    autoPageNumber: true,
    carryForwardTwoUp: true,
    firstPageDate: "",
    firstPageNumber: "",
    defaultWorkDiaryNo: "",
    defaultNumberPlate: "",
    defaultTwoUp: {
      enabled: false,
      twoUpDriverName: "",
      twoUpLicenceNumber: "",
      twoUpScheme: "BFM",
      twoUpBaseState: ""
    }
  },
  settingsHistory: [],
  ruleHistory: [],
  auditLog: []
};

const $ = id => document.getElementById(id);
let auditFocus = null;
function addAuditLog(action, details){
  if(!state.auditLog) state.auditLog = [];
  state.auditLog.unshift({
    at: new Date().toISOString(),
    date: state.selectedDate || toKey(new Date()),
    action,
    details: details || ""
  });
  if(state.auditLog.length > 250) state.auditLog = state.auditLog.slice(0,250);
}
function renderAuditLog(){
  const el = $("auditLogList");
  if(!el) return;
  const items = state.auditLog || [];
  if(!items.length){
    el.innerHTML = `<p class="hint">No audit log entries yet.</p>`;
    return;
  }
  el.innerHTML = items.slice(0,80).map(i => `
    <div class="auditLogItem">
      <strong>${escapeHtml(i.action || "")}</strong>
      <div>${escapeHtml(i.details || "")}</div>
      <small>${escapeHtml(new Date(i.at).toLocaleString("en-AU"))} • Page date ${escapeHtml(i.date || "")}</small>
    </div>`).join("");
}
function clearAuditLogOnly(){
  if(confirm("Clear audit log only? This does not delete diary pages.")){
    state.auditLog = [];
    save();
    renderAuditLog();
  }
}

function pad(n){ return String(n).padStart(2,"0"); }
function toKey(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function fromKey(k){ const [y,m,d]=k.split("-").map(Number); return new Date(y,m-1,d); }
function addDays(key, n){ const d=fromKey(key); d.setDate(d.getDate()+n); return toKey(d); }
function fmtDateLong(key){
  return fromKey(key).toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
}
function fmtHM(totalMins){
  totalMins = ((totalMins % 1440) + 1440) % 1440;
  return `${pad(Math.floor(totalMins/60))}:${pad(totalMins%60)}`;
}
function timeToMins(t){
  const [h,m] = t.split(":").map(Number);
  return h*60+m;
}
function minsToHoursText(mins){
  const h = mins/60;
  return `${Number.isInteger(h) ? h : h.toFixed(2).replace(/\.00$/,"")} Hours`;
}
function getDaySlots(key){
  if(!state.slots[key]) state.slots[key] = Array(SLOTS_PER_DAY).fill(undefined);
  return state.slots[key];
}
function getSlot(key, idx){
  const arr = state.slots[key];
  return arr && arr[idx] ? arr[idx] : "rest";
}
function setSlot(key, idx, val){
  getDaySlots(key)[idx] = val;
}
function minuteAbs(key, slotIndex){
  return fromKey(key).getTime() + slotIndex*SLOT*60000;
}
function absToKeySlot(abs){
  const d = new Date(abs);
  const key = toKey(d);
  const mins = d.getHours()*60 + d.getMinutes();
  return {key, slot: Math.floor(mins / SLOT)};
}
function ensureProfile(){
  if(!state.profile) state.profile = {};
  if(!state.profile.driverName) state.profile.driverName = "";
  if(!state.profile.licenceNumber) state.profile.licenceNumber = "";
  if(!state.profile.baseTimeZone) state.profile.baseTimeZone = "Local phone time";
}
function ensureDayDetailsContainer(){
  if(!state.dayDetails || typeof state.dayDetails !== "object") state.dayDetails = {};
}
function ensureBookSettings(){
  if(!state.bookSettings || typeof state.bookSettings !== "object") state.bookSettings = {};
  if(state.bookSettings.autoPageNumber === undefined) state.bookSettings.autoPageNumber = true;
  if(state.bookSettings.carryForwardTwoUp === undefined) state.bookSettings.carryForwardTwoUp = true;
  if(!state.bookSettings.firstPageDate) state.bookSettings.firstPageDate = state.selectedDate || toKey(new Date());
  if(state.bookSettings.firstPageNumber === undefined) state.bookSettings.firstPageNumber = "";
  if(state.bookSettings.defaultWorkDiaryNo === undefined) state.bookSettings.defaultWorkDiaryNo = "";
  if(state.bookSettings.defaultNumberPlate === undefined) state.bookSettings.defaultNumberPlate = "";
  if(!state.bookSettings.defaultTwoUp || typeof state.bookSettings.defaultTwoUp !== "object"){
    state.bookSettings.defaultTwoUp = {enabled:false, twoUpDriverName:"", twoUpLicenceNumber:"", twoUpScheme:"BFM", twoUpBaseState:""};
  }
  const t = state.bookSettings.defaultTwoUp;
  if(t.enabled === undefined) t.enabled = false;
  if(t.twoUpDriverName === undefined) t.twoUpDriverName = "";
  if(t.twoUpLicenceNumber === undefined) t.twoUpLicenceNumber = "";
  if(t.twoUpScheme === undefined) t.twoUpScheme = "BFM";
  if(t.twoUpBaseState === undefined) t.twoUpBaseState = "";
}

function ensureSettingsHistory(){
  if(!Array.isArray(state.settingsHistory)) state.settingsHistory = [];
  ensureBookSettings();
  ensureProfile();
  if(!state.settingsHistory.length){
    state.settingsHistory.push({
      effectiveDate: state.bookSettings.firstPageDate || state.selectedDate || toKey(new Date()),
      driverName: state.profile.driverName || "",
      licenceNumber: state.profile.licenceNumber || "",
      baseTimeZone: state.profile.baseTimeZone || "NSW",
      defaultWorkDiaryNo: state.bookSettings.defaultWorkDiaryNo || "",
      defaultNumberPlate: state.bookSettings.defaultNumberPlate || "",
      defaultTwoUp: {...(state.bookSettings.defaultTwoUp || {})}
    });
  }
}
function currentSettingsRecordForDate(key){
  ensureSettingsHistory();
  const sorted = [...state.settingsHistory].sort((a,b)=>String(a.effectiveDate).localeCompare(String(b.effectiveDate)));
  let chosen = sorted[0];
  for(const rec of sorted){
    if(rec.effectiveDate && rec.effectiveDate <= key) chosen = rec;
  }
  return chosen || {};
}
function saveSettingsRecord(effectiveDate){
  ensureSettingsHistory();
  const rec = {
    effectiveDate: effectiveDate || state.selectedDate || toKey(new Date()),
    driverName: state.profile.driverName || "",
    licenceNumber: state.profile.licenceNumber || "",
    baseTimeZone: state.profile.baseTimeZone || "NSW",
    defaultWorkDiaryNo: state.bookSettings.defaultWorkDiaryNo || "",
    defaultNumberPlate: state.bookSettings.defaultNumberPlate || "",
    defaultTwoUp: {...(state.bookSettings.defaultTwoUp || {})}
  };
  const idx = state.settingsHistory.findIndex(x => x.effectiveDate === rec.effectiveDate);
  if(idx >= 0) state.settingsHistory[idx] = rec;
  else state.settingsHistory.push(rec);
  state.settingsHistory.sort((a,b)=>String(a.effectiveDate).localeCompare(String(b.effectiveDate)));
}
function updateFutureDailyDetailsFromEffectiveDate(effectiveDate){
  ensureDayDetailsContainer();
  Object.keys(state.dayDetails || {}).forEach(key => {
    if(key >= effectiveDate){
      applyAutoDefaultsToDay(key);
    }
  });
}

function defaultDayDetail(){
  return {
    workDiaryNo: "",
    workDiaryNoManual: false,
    driverNameSnapshot: "",
    licenceNumberSnapshot: "",
    baseStateSnapshot: "",
    numberPlateManual: false,
    pageNo: "",
    numberPlate: "",
    dailyCheckTime: "",
    comments: "",
    fitForDuty: false,
    ruleScheme: "",
    driverMode: "",
    ruleManual: false,
    twoUpEnabled: false,
    twoUpManual: false,
    twoUpDriverName: "",
    twoUpLicenceNumber: "",
    twoUpScheme: "BFM",
    twoUpBaseState: "",
    changeRows: []
  };
}
function ensureDayDetail(key){
  ensureDayDetailsContainer();
  if(!state.dayDetails[key]) state.dayDetails[key] = defaultDayDetail();
  const d = state.dayDetails[key];
  const defs = defaultDayDetail();
  Object.keys(defs).forEach(k => {
    if(d[k] === undefined) d[k] = defs[k];
  });
  if(!Array.isArray(d.changeRows)) d.changeRows = [];
  return d;
}

function ensureRuleHistory(){
  if(!Array.isArray(state.ruleHistory)) state.ruleHistory = [];
  if(!state.ruleHistory.length){
    const detail = ensureDayDetail(state.selectedDate);
    state.ruleHistory.push({
      effectiveDate: state.selectedDate || toKey(new Date()),
      scheme: state.scheme || "BFM",
      mode: detail.twoUpEnabled ? "twoUp" : "solo",
      coDriverScheme: detail.twoUpScheme || ""
    });
  }
  state.ruleHistory.forEach(r => {
    if(!r.effectiveDate) r.effectiveDate = state.selectedDate || toKey(new Date());
    if(!r.scheme) r.scheme = state.scheme || "BFM";
    if(!r.mode) r.mode = "solo";
    if(r.coDriverScheme === undefined) r.coDriverScheme = "";
  });
  state.ruleHistory.sort((a,b)=>String(a.effectiveDate).localeCompare(String(b.effectiveDate)));
}
function ruleRecordForDate(key){
  ensureRuleHistory();
  let chosen = state.ruleHistory[0];
  for(const rec of state.ruleHistory){
    if(rec.effectiveDate <= key) chosen = rec;
  }
  return chosen || {scheme:state.scheme || "BFM", mode:"solo", coDriverScheme:""};
}
function applyRuleRecordToDay(key){
  ensureRuleHistory();
  const rec = ruleRecordForDate(key);
  const detail = ensureDayDetail(key);
  if(!detail.ruleManual){
    detail.ruleScheme = rec.scheme;
    detail.driverMode = rec.mode;
    detail.twoUpEnabled = rec.mode === "twoUp";
    if(rec.mode === "twoUp"){
      detail.twoUpScheme = rec.coDriverScheme || detail.twoUpScheme || "Standard";
    }
  }
  return detail;
}
function selectedDayIsTwoUp(){
  const d = ensureDayDetail(state.selectedDate);
  return (d.driverMode || (d.twoUpEnabled ? "twoUp" : "solo")) === "twoUp" || !!d.twoUpEnabled;
}
function schemeForDate(key){
  const d = ensureDayDetail(key);
  return d.ruleScheme || ruleRecordForDate(key).scheme || state.scheme || "BFM";
}
function modeForDate(key){
  const d = ensureDayDetail(key);
  return d.driverMode || (d.twoUpEnabled ? "twoUp" : "solo") || ruleRecordForDate(key).mode || "solo";
}
function activeRuleKeyForDate(key){
  const scheme = schemeForDate(key);
  const mode = modeForDate(key);
  if(mode === "twoUp"){
    if(scheme === "BFM") return "BFMTwoUp";
    if(scheme === "Standard") return "StandardTwoUp";
  }
  return scheme;
}
function activeRuleKey(){
  return activeRuleKeyForDate(state.selectedDate);
}
function activeRulesForDate(key){
  return RULES[activeRuleKeyForDate(key)] || RULES[schemeForDate(key)] || RULES.BFM;
}
function activeRules(){
  return activeRulesForDate(state.selectedDate);
}
function activeSchemeLabelForDate(key){
  const rules = activeRulesForDate(key);
  return rules.name || schemeForDate(key);
}
function activeSchemeLabel(){
  return activeSchemeLabelForDate(state.selectedDate);
}
function twoUpRuleWarningHtml(){
  if(!selectedDayIsTwoUp()) return "";
  return `<div class="twoUpRuleNote"><strong>Two-up helper mode:</strong> ${escapeHtml(activeRules().helperNote || "Verify two-up requirements against your official diary and NHVR rules.")}</div>`;
}

function save(){
  ensureProfile();
  ensureBackupReminder();
  ensureDayDetailsContainer();
  ensureBookSettings();
  ensureSettingsHistory();
  ensureRuleHistory();
  if(!Array.isArray(state.auditLog)) state.auditLog=[];
  localStorage.setItem("truckDiaryPWA", JSON.stringify(state));
}
function load(){
  const raw = localStorage.getItem("truckDiaryPWA");
  if(raw){
    try{ state = {...state, ...JSON.parse(raw)}; }catch(e){}
  }
  ensureProfile();
  ensureBackupReminder();
  ensureDayDetailsContainer();
  ensureBookSettings();
  ensureSettingsHistory();
  ensureRuleHistory();
  if(!Array.isArray(state.auditLog)) state.auditLog=[];
}
function isWork(key, idx){ return getSlot(key, idx) === "work"; }
function isRestType(type){ return type === "rest"; }
function restTypeForSlot(key, idx){
  const detail = ensureDayDetail(key);
  const rows = syncChangeRowsForDay(key);
  const mins = idx*SLOT;
  let current = null;
  for(const r of rows){
    const rm = timeToMins(r.time);
    if(rm <= mins) current = r;
    else break;
  }
  if(current && current.activity === "rest") return current.restType || "";
  return "";
}
function isStationary(key, idx){
  const t = getSlot(key, idx);
  if(t !== "rest") return false;
  const rt = restTypeForSlot(key, idx);
  if(rt) return ["stationary","sleeper","night","24h"].includes(rt);
  return !!state.restAsStationary;
}
function countWorkBetween(endAbs, windowMins){
  let count = 0;
  const startAbs = endAbs - windowMins*60000;
  for(let t=startAbs; t<endAbs; t+=SLOT*60000){
    const {key, slot} = absToKeySlot(t);
    if(isWork(key, slot)) count += SLOT;
  }
  return count;
}
function maxContinuousStationary(endAbs, windowMins){
  let best=0, cur=0;
  const startAbs = endAbs - windowMins*60000;
  for(let t=startAbs; t<endAbs; t+=SLOT*60000){
    const {key, slot} = absToKeySlot(t);
    if(isStationary(key, slot)){ cur += SLOT; best = Math.max(best, cur); }
    else cur = 0;
  }
  return best;
}
function slotBreaches(key, idx){
  if(!isWork(key,idx)) return false;
  const endAbs = minuteAbs(key, idx+1);
  return activeRules().windows.some(r => countWorkBetween(endAbs, r.minutes) > r.maxWork);
}
function activityLabel(a){
  if(a === "work") return "Work / Driving";
  return "Rest";
}
function escapeHtml(s){
  return String(s || "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function segmentsForDay(key){
  const segs = [];
  let cur = getSlot(key,0);
  let start = 0;
  for(let i=1;i<=SLOTS_PER_DAY;i++){
    const val = i<SLOTS_PER_DAY ? getSlot(key,i) : null;
    if(val !== cur){
      segs.push({startMins:start*SLOT, endMins:i*SLOT, activity:cur});
      cur = val;
      start = i;
    }
  }
  return segs;
}
function warningsText(){
  return checkDayWarnings().map(w => w.text).join(" | ");
}

function renderGrid(){
  const grid = $("diaryGrid");
  grid.innerHTML = "";
  const sections = [
    {start:0, labels:["midnight","1am","2am","3am","4am","5am"]},
    {start:6, labels:["6am","7am","8am","9am","10am","11am"]},
    {start:12, labels:["noon","1pm","2pm","3pm","4pm","5pm"]},
    {start:18, labels:["6pm","7pm","8pm","9pm","10pm","11pm"]}
  ];
  const rows = [
    {label:"Work", action:"work"},
    {label:"Rest", action:"rest"}
  ];

  for(const sec of sections){
    const block = document.createElement("div");
    block.className = "block";
    const blank = document.createElement("div");
    blank.className = "hourLabel blank";
    block.appendChild(blank);
    sec.labels.forEach(l=>{
      const el = document.createElement("div");
      el.className = "hourLabel";
      el.style.gridColumn = `span 4`;
      el.textContent = l;
      block.appendChild(el);
    });

    rows.forEach(row=>{
      const label = document.createElement("div");
      label.className = "rowLabel";
      label.textContent = row.label;
      block.appendChild(label);

      for(let i=0;i<24;i++){
        const slotIndex = sec.start*4 + i;
        const cell = document.createElement("button");
        cell.className = "slot";
        const t = getSlot(state.selectedDate, slotIndex);

        if(row.action === "work"){
          if(t === "work") cell.classList.add(slotBreaches(state.selectedDate, slotIndex) ? "bad" : "work");
          else cell.classList.add("empty");
        } else {
          if(t === "rest") cell.classList.add("rest");
          else cell.classList.add("empty");
        }

        if((i+1)%4===0) cell.classList.add("thick");
        cell.title = `${fmtHM(slotIndex*15)} ${row.label}`;
        cell.dataset.slot = slotIndex;
        cell.dataset.row = row.action;
        if(auditFocus && auditFocus.date === state.selectedDate && auditFocus.type === "slot" && Array.isArray(auditFocus.slots) && auditFocus.slots.includes(slotIndex)){
          cell.classList.add("auditFocus");
        }
        block.appendChild(cell);
      }
    });
    grid.appendChild(block);
  }
}

function addEntryRecord(startKey, startMins, endKey, endMins, activity, note){
  state.entries.push({
    id: Date.now()+"-"+Math.random().toString(16).slice(2),
    start: `${startKey} ${fmtHM(startMins)}`,
    end: `${endKey} ${fmtHM(endMins)}`,
    activity,
    note: note || ""
  });
  if(state.entries.length > 1000) state.entries = state.entries.slice(-1000);
}

function actionFromCell(el){
  const cell = el && el.closest ? el.closest(".slot[data-slot]") : null;
  if(!cell) return null;
  return cell.dataset.row || "rest";
}
function paintSlotByElement(el, forcedAction=null){
  const cell = el && el.closest ? el.closest(".slot[data-slot]") : null;
  if(!cell) return false;
  const idx = Number(cell.dataset.slot);
  if(Number.isNaN(idx)) return false;
  const val = forcedAction || actionFromCell(cell) || "rest";
  const arr = getDaySlots(state.selectedDate);
  if(arr[idx] !== val){
    arr[idx] = val;
    cell.classList.add("dragPreview");
    return true;
  }
  return false;
}

function setupSwipePainting(){
  const grid = $("diaryGrid");
  let touchCandidate = false;
  let painting = false;
  let scrollMode = false;
  let changed = false;
  let startX = 0;
  let startY = 0;
  let startSlot = null;
  let lastSlot = null;
  let startAction = "rest";
  const THRESHOLD = 10;

  function beginCandidate(target, point){
    const cell = target && target.closest ? target.closest(".slot[data-slot]") : null;
    if(!cell) return false;
    touchCandidate = true;
    painting = false;
    scrollMode = false;
    changed = false;
    startX = point.clientX;
    startY = point.clientY;
    startSlot = Number(cell.dataset.slot);
    lastSlot = startSlot;
    startAction = actionFromCell(cell) || "rest";
    return true;
  }

  function start(e){
    const point = e.touches ? e.touches[0] : e;
    beginCandidate(e.target, point);
  }

  function paintSingle(slotIdx, noteText){
    const arr = getDaySlots(state.selectedDate);
    arr[slotIdx] = startAction;
    addEntryRecord(state.selectedDate, slotIdx*SLOT, state.selectedDate, (slotIdx+1)*SLOT, startAction, noteText || "Tap fill");
    save();
    renderAll();
  }

  function paintRangeTo(slotIdx){
    const from = Math.min(lastSlot, slotIdx);
    const to = Math.max(lastSlot, slotIdx);
    for(let i = from; i <= to; i++){
      const slotEl = grid.querySelector(`.slot[data-slot="${i}"][data-row="${startAction}"]`);
      paintSlotByElement(slotEl, startAction);
    }
    lastSlot = slotIdx;
  }

  function move(e){
    if(!touchCandidate && !painting) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - startX;
    const dy = point.clientY - startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if(!painting && !scrollMode){
      if(absX < THRESHOLD && absY < THRESHOLD){
        return;
      }
      if(absX > absY * 1.2){
        painting = true;
        touchCandidate = false;
        grid.classList.add("painting");
        const startEl = grid.querySelector(`.slot[data-slot="${startSlot}"][data-row="${startAction}"]`);
        paintSlotByElement(startEl, startAction);
        changed = true;
      } else if(absY > absX){
        scrollMode = true;
        touchCandidate = false;
        return;
      } else {
        return;
      }
    }

    if(!painting) return;
    const el = document.elementFromPoint(point.clientX, point.clientY);
    const cell = el && el.closest ? el.closest(".slot[data-slot]") : null;
    if(!cell) return;
    const idx = Number(cell.dataset.slot);
    if(Number.isNaN(idx)) return;
    if(idx !== lastSlot){
      paintRangeTo(idx);
      changed = true;
    }
    e.preventDefault();
  }

  function end(){
    if(touchCandidate && !painting && !scrollMode && startSlot !== null){
      paintSingle(startSlot, "Single tap fill");
      touchCandidate = false;
      startSlot = null;
      lastSlot = null;
      return;
    }

    if(painting){
      grid.classList.remove("painting");
      document.querySelectorAll(".slot.dragPreview").forEach(x => x.classList.remove("dragPreview"));
      if(changed && startSlot !== null && lastSlot !== null){
        const a = Math.min(startSlot, lastSlot);
        const b = Math.max(startSlot, lastSlot);
        addEntryRecord(state.selectedDate, a*SLOT, state.selectedDate, (b+1)*SLOT, startAction, "Horizontal swipe fill");
        save();
        renderAll();
      }
    }
    touchCandidate = false;
    painting = false;
    scrollMode = false;
    changed = false;
    startSlot = null;
    lastSlot = null;
  }

  grid.addEventListener("touchstart", start, {passive:true});
  grid.addEventListener("touchmove", move, {passive:false});
  grid.addEventListener("touchend", end);
  grid.addEventListener("touchcancel", end);

  grid.addEventListener("mousedown", (e)=>beginCandidate(e.target, e));
  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", end);
}

function addEntryFromForm(){
  const sd=$("startDate").value, ed=$("endDate").value, st=$("startTime").value, et=$("endTime").value;
  const activity=$("activity").value, note=$("note").value.trim();
  if(!sd || !ed || !st || !et){ alert("Please enter start and end date/time."); return; }
  const start = new Date(`${sd}T${st}:00`);
  const end = new Date(`${ed}T${et}:00`);
  if(isNaN(start) || isNaN(end) || end <= start){ alert("End date/time must be after start date/time. For midnight use next date and 00:00."); return; }
  if(start.getMinutes()%15 || end.getMinutes()%15){ alert("Please use 15-minute blocks: 00, 15, 30, 45."); return; }
  for(let t=start.getTime(); t<end.getTime(); t+=SLOT*60000){
    const {key, slot} = absToKeySlot(t);
    setSlot(key, slot, activity);
  }
  addEntryRecord(sd, timeToMins(st), ed, timeToMins(et), activity, note);
  state.selectedDate = sd;
  $("note").value = "";
  save();
  renderAll();
}

function totalsForDay(){
  let work=0, rest=0;
  for(let i=0;i<SLOTS_PER_DAY;i++){
    if(isWork(state.selectedDate,i)) work+=SLOT; else rest+=SLOT;
  }
  return {work, rest};
}
function checkDayWarnings(){
  const warns=[];
  const rules = activeRules();
  let anyBreach=false;
  for(let i=0;i<SLOTS_PER_DAY;i++) if(slotBreaches(state.selectedDate,i)) anyBreach=true;
  if(anyBreach) warns.push({type:"bad", text:`Possible ${rules.name} rule breach found. Red blocks show work time that may exceed selected limits.`});
  const selectedEndAbs = fromKey(state.selectedDate).getTime() + DAY_MS;
  const majorWindow = rules.majorRestWindow || 1440;
  const major = maxContinuousStationary(selectedEndAbs, majorWindow);
  if(rules.majorRest && major < rules.majorRest){
    warns.push({type:"warn", text:`${rules.name}: no ${rules.majorRest/60}h continuous rest block found in the last ${majorWindow/60}h window ending on this day.`});
  }
  (rules.extraRestWindows || []).forEach(req => {
    const best = maxContinuousStationary(selectedEndAbs, req.minutes);
    if(best < req.required){
      warns.push({type:"warn", text:`${rules.name}: ${req.label} not found in saved blocks ending on this day.`});
    }
  });
  if(selectedDayIsTwoUp()){
    const missing = twoUpMissingDetails();
    if(missing.length){
      warns.push({type:"warn", text:`Two-up is selected but missing: ${missing.join(", ")}.`});
    }
    warns.push({type:"warn", text:"Two-up helper mode is active. Rest/sleeper berth and night-rest requirements should be verified against your official work diary/EWD."});
  }
  if(!warns.length) warns.push({type:"ok", text:`No daily rolling-window warning found for ${rules.name}.`});
  return warns;
}
function renderAlerts(){
  const a=$("alerts"); a.innerHTML="";
  checkDayWarnings().forEach(w=>{
    const el=document.createElement("div");
    el.className=`alert ${w.type}`;
    el.textContent=w.text;
    a.appendChild(el);
  });
}
function renderRuleCards(){
  const div=$("ruleCards"); div.innerHTML=twoUpRuleWarningHtml();
  const startAbs = fromKey(state.selectedDate).getTime();
  const endAbs = startAbs + DAY_MS;
  if(!activeRules().windows.length){ div.innerHTML += `<div class="alert warn">No fixed rule windows configured for this mode. Enter AFM conditions or select Standard/BFM.</div>`; return; }
  activeRules().windows.forEach(r=>{
    let max=0;
    for(let t=startAbs+SLOT*60000; t<=endAbs; t+=SLOT*60000){
      max=Math.max(max, countWorkBetween(t, r.minutes));
    }
    const bad = max > r.maxWork;
    const card=document.createElement("div");
    card.className=`rule ${bad?"bad":""}`;
    const pct=Math.min(100, (max/r.maxWork)*100);
    card.innerHTML = `<h3>${r.label} window</h3>
      <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
      <p>${Math.floor(max/60)}h ${max%60}m / max ${Math.floor(r.maxWork/60)}h ${r.maxWork%60}m</p>
      <p>${r.rest}</p>`;
    div.appendChild(card);
  });
}
function findLastWorkSlotAbs(){
  let best = null;
  const center = fromKey(state.selectedDate).getTime();
  for(let t=center-DAY_MS; t<center+DAY_MS; t+=SLOT*60000){
    const {key,slot}=absToKeySlot(t);
    if(isWork(key,slot)) best=t;
  }
  return best;
}
function lastQualifyingRestEndAbs(beforeAbs){
  let cur=0, lastEnd=null;
  for(let t=beforeAbs - 36*60*60000; t<beforeAbs; t+=SLOT*60000){
    const {key,slot}=absToKeySlot(t);
    if(isRestType(getSlot(key,slot))){
      cur+=SLOT;
      if(cur>=15) lastEnd=t+SLOT*60000;
    } else {
      cur=0;
    }
  }
  return lastEnd;
}
function renderNextBreak(){
  const box=$("nextBreak");
  const lastWork = findLastWorkSlotAbs();
  if(lastWork===null){ box.textContent="No work entered for this day."; return; }
  const afterLastWork = lastWork + SLOT*60000;
  const restEnd = lastQualifyingRestEndAbs(afterLastWork) || (afterLastWork - 6*60*60000);
  let work=0;
  for(let t=restEnd; t<afterLastWork; t+=SLOT*60000){
    const {key,slot}=absToKeySlot(t);
    if(isWork(key,slot)) work+=SLOT;
  }
  const firstRule = activeRules().windows[0];
  if(!firstRule){ box.textContent="No work-limit window is configured for this rule mode. Check AFM conditions/rule history."; return; }
  const remain = Math.max(0, firstRule.maxWork - work);
  const latest = restEnd + firstRule.maxWork*60000;
  const latestD = new Date(latest);
  box.innerHTML = remain>0
    ? `After your last 15-minute rest, you have about <strong>${Math.floor(remain/60)}h ${remain%60}m</strong> work left before another 15-minute rest is due. Latest rest start: <strong>${pad(latestD.getHours())}:${pad(latestD.getMinutes())}</strong>.`
    : `<strong>Take 15 minutes rest now before more work.</strong>`;
}



function allKnownDiaryDates(){
  const set = new Set();
  Object.keys(state.slots || {}).forEach(k => set.add(k));
  Object.keys(state.dayDetails || {}).forEach(k => set.add(k));
  state.entries.forEach(e => {
    if(e.start) set.add(String(e.start).slice(0,10));
    if(e.end) set.add(String(e.end).slice(0,10));
  });
  set.add(state.selectedDate);
  return [...set].filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
}
function pageNoForDate(key){
  const d = ensureDayDetail(key);
  return d.pageNo || calculatedPageNumberForDate(key) || "No page no";
}

function breachDetailForSlot(key, idx){
  const oldDate = state.selectedDate;
  state.selectedDate = key;
  const endAbs = minuteAbs(key, idx+1);
  let found = null;
  for(const r of activeRules().windows){
    const work = countWorkBetween(endAbs, r.minutes);
    if(work > r.maxWork){
      found = {rule:r, work, excess:work-r.maxWork};
      break;
    }
  }
  state.selectedDate = oldDate;
  return found;
}
function roundUp15(mins){
  return Math.ceil(Math.max(0, mins)/15)*15;
}
function suggestRuleFixForSlots(key, badSlots){
  if(!badSlots || !badSlots.length){
    return "Review Work/Rest blocks for this page and surrounding pages.";
  }
  const first = badSlots[0];
  const details = breachDetailForSlot(key, first);
  const time = fmtHM((first+1)*SLOT);
  if(!details){
    return `Review the work block around ${time}. Check if it should be Rest, or if a rest break is missing earlier.`;
  }
  const r = details.rule;
  const excess = roundUp15(details.excess);
  return `First issue is around ${time}: saved work is ${formatMinsShort(details.work)} in the ${r.label} window, about ${formatMinsShort(details.excess)} over the helper limit. Possible fix: review the ${r.label} period before ${time}; change at least ${formatMinsShort(excess)} of any incorrectly marked Work to Rest, or move/add a qualifying rest break earlier. Also check the previous page if this rolling window crosses midnight.`;
}
function fieldFix(fieldName){
  return `Open the highlighted field, enter the correct ${fieldName}, then save the selected page only. If the change should apply to future pages, use Settings with the correct effective date.`;
}

function auditDate(key){
  const oldDate = state.selectedDate;
  state.selectedDate = key;
  applyAutoDefaultsToDay(key);
  const detail = ensureDayDetail(key);
  const errors = [];
  const add = (severity, title, message, focus, suggestion) => {
    errors.push({
      id: `${key}-${errors.length}-${Date.now()}`,
      date: key,
      pageNo: pageNoForDate(key),
      severity,
      title,
      message,
      focus: focus || {type:"page"},
      suggestion: suggestion || "Open this page, review the highlighted item, then compare with your paper diary before changing anything."
    });
  };

  if(!detail.driverNameSnapshot && !(state.profile && state.profile.driverName)) add("error","Missing driver name","Driver name is empty for this page.",{type:"field", field:"pageDriverName"},fieldFix("driver name"));
  if(!detail.licenceNumberSnapshot && !(state.profile && state.profile.licenceNumber)) add("error","Missing licence number","Licence number is empty for this page.",{type:"field", field:"pageLicenceNumber"},fieldFix("licence number"));
  if(!detail.baseStateSnapshot && !(state.profile && state.profile.baseTimeZone)) add("error","Missing base state","Base state/time zone is empty for this page.",{type:"field", field:"pageBaseState"},"Choose the correct base state for this selected page. If your base changed from a date onward, update Settings with the correct effective date.");
  if(!detail.pageNo) add("warn","Missing page number","Page number is empty or not calculated.",{type:"field", field:"pagePageNo"},"Check Work diary book setup. Add first page date and first page number, or manually enter page number for this selected page.");
  if(!detail.workDiaryNo) add("warn","Missing work diary number","Work diary number is empty.",{type:"field", field:"pageWorkDiaryNo"},"Enter the work diary number for this page, or add it as a default in Settings so future pages fill automatically.");
  if(!detail.numberPlate) add("warn","Missing truck rego","Truck rego / number plate is empty.",{type:"field", field:"pageNumberPlate"},"Enter the truck rego for this selected page. If this truck continues from this date, update Default number plate with the correct effective date.");
  if(!detail.fitForDuty) add("info","Fit for Duty not ticked","Fit for Duty is not ticked on this page.",{type:"field", field:"sheetFitForDuty"},"If you were fit for duty for this page, tick Fit for Duty. If not, leave it unticked and keep accurate records.");
  const confidence = complianceIssuesForDate(key);
  confidence.blockers.forEach(b => add("error","Cannot safely calculate",b,{type:"section", section:"complianceConfidence"},"Fix the missing setup information before relying on due-break or fatigue advice."));
  confidence.issues.filter(x => x.includes("Rest type")).slice(0,3).forEach(x => add("warn","Missing rest type",x,{type:"section", section:"changeDetailsEditor"},"Select Rest / Stationary rest / Sleeper berth / Night rest so major rest and two-up checks can be safer."));

  if(detail.twoUpEnabled){
    if(!detail.twoUpDriverName) add("warn","Missing two-up driver name","Two-up is selected but driver name is empty.",{type:"field", field:"sheetTwoUpDriverName"},"Enter the two-up driver name, or untick two-up if you were not working two-up on this page.");
    if(!detail.twoUpLicenceNumber) add("warn","Missing two-up licence number","Two-up is selected but licence number is empty.",{type:"field", field:"sheetTwoUpLicenceNumber"},"Enter the two-up driver licence number, or untick two-up if not applicable.");
    if(!detail.twoUpScheme) add("warn","Missing two-up scheme","Two-up is selected but work/rest scheme is empty.",{type:"field", field:"sheetTwoUpScheme"},"Select the correct two-up scheme. If unsure, verify your work option/accreditation before relying on the helper calculation.");
  }

  const badSlots = [];
  for(let i=0;i<SLOTS_PER_DAY;i++){
    if(slotBreaches(key,i)) badSlots.push(i);
  }
  if(badSlots.length){
    add("error","Possible work/rest rule breach",`There are ${badSlots.length} red 15-minute work block(s) that may exceed ${activeSchemeLabel()} limits.`,{type:"slot", slots:badSlots},suggestRuleFixForSlots(key,badSlots));
  }

  // Work/rest change rows: locations are important for matching paper diary.
  const changes = syncChangeRowsForDay(key);
  const missingLocation = changes.filter(r => !r.location && !r.note);
  if(changes.length > 1 && missingLocation.length){
    add("warn","Missing work/rest change locations",`${missingLocation.length} change row(s) have no location/note.`,{type:"section", section:"changeDetailsEditor"},"Add the town/suburb/rest area or a note for each work/rest change so the PDF matches your paper diary.");
  }

  const t = totalsForDay();
  if(t.work === 0){
    add("info","No work recorded","This page has no Work blocks recorded.",{type:"slot", slots:[]},"If this was a rest day, no action is needed. If you worked, add the correct Work blocks and locations.");
  }

  state.selectedDate = oldDate;
  return errors;
}

function maxContinuousRestInRange(startAbs, endAbs){
  let best = 0, cur = 0;
  for(let t=startAbs; t<endAbs; t+=SLOT*60000){
    if(activityAtAbs(t) !== "work"){
      cur += SLOT;
      best = Math.max(best, cur);
    } else {
      cur = 0;
    }
  }
  return best;
}
function auditRuleTransitions(){
  ensureRuleHistory();
  const items = [];
  const sorted = [...state.ruleHistory].sort((a,b)=>String(a.effectiveDate).localeCompare(String(b.effectiveDate)));
  for(let i=1;i<sorted.length;i++){
    const prev = sorted[i-1];
    const cur = sorted[i];
    const key = cur.effectiveDate;
    const pageNo = pageNoForDate(key);
    const add = (severity,title,message,suggestion) => items.push({
      id:`rule-transition-${key}-${i}`,
      date:key,
      pageNo,
      severity,
      title,
      message,
      focus:{type:"section", section:"ruleHistoryList"},
      suggestion
    });

    if(prev.scheme === "BFM" && cur.scheme === "Standard"){
      const endAbs = fromKey(key).getTime();
      const best48 = maxContinuousRestInRange(endAbs - 7*DAY_MS, endAbs);
      if(best48 < 48*60){
        add("warn",
          "BFM to Standard change needs verification",
          "You changed from BFM to Standard, but the app did not find a 48h continuous rest before the effective date.",
          "Verify that you were compliant with Standard Hours at the change time, or that you had 48 continuous hours rest before starting Standard. Add the missing rest blocks if your paper diary shows them.");
      }
    }
    if(prev.mode !== cur.mode){
      add("info",
        "Solo/two-up mode changed",
        `Driver mode changed from ${prev.mode === "twoUp" ? "two-up" : "solo"} to ${cur.mode === "twoUp" ? "two-up" : "solo"}.`,
        "Check that the correct mode is saved from this date and that co-driver details are complete if two-up is selected.");
    }
    if(cur.mode === "twoUp" && !cur.coDriverScheme){
      add("warn",
        "Two-up co-driver option missing",
        "Two-up mode is selected in rule history but co-driver work option is empty.",
        "Set the co-driver option to Standard, BFM or AFM for this effective-date rule record.");
    }
  }
  return items;
}
function buildAuditErrors(){
  const dates = allKnownDiaryDates();
  let all = [];
  dates.forEach(k => { all = all.concat(auditDate(k)); });
  all = all.concat(auditRuleTransitions());
  const rank = {error:0, warn:1, info:2};
  all.sort((a,b) => (rank[a.severity]-rank[b.severity]) || String(b.date).localeCompare(String(a.date)));
  return all;
}
function renderAuditList(){
  const holder = $("drivingAuditList");
  const summary = $("auditSummary");
  if(!holder || !summary) return;
  const errors = buildAuditErrors();
  const counts = {
    error: errors.filter(e=>e.severity==="error").length,
    warn: errors.filter(e=>e.severity==="warn").length,
    info: errors.filter(e=>e.severity==="info").length
  };
  summary.innerHTML = `
    <div class="sumBox"><strong>${counts.error}</strong><span>Errors</span></div>
    <div class="sumBox"><strong>${counts.warn}</strong><span>Warnings</span></div>
    <div class="sumBox"><strong>${counts.info}</strong><span>Notes</span></div>`;
  if(!errors.length){
    holder.innerHTML = `<div class="alert ok">No diary errors found in saved pages.</div>`;
    return;
  }
  holder.innerHTML = errors.slice(0,60).map((e,idx)=>`
    <button class="auditItem ${e.severity}" data-audit-index="${idx}">
      <strong>${escapeHtml(e.title)}</strong>
      <span>${escapeHtml(e.message)}</span>
      <small>Date: ${escapeHtml(fmtDateLong(e.date))} • Page: ${escapeHtml(e.pageNo)}</small>
      <div class="suggestion"><strong>Possible fix:</strong> ${escapeHtml(e.suggestion)}</div>
    </button>`).join("");
  holder.querySelectorAll("[data-audit-index]").forEach(btn=>{
    btn.onclick = () => openAuditError(errors[Number(btn.dataset.auditIndex)]);
  });
}
function switchToTab(tabId){
  document.querySelectorAll(".tabbar button").forEach(b=>b.classList.toggle("active", b.dataset.tab === tabId));
  document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("active", s.id === tabId));
  const btn = document.querySelector(`.tabbar button[data-tab="${tabId}"]`);
  if(btn && $("screenTitle")) $("screenTitle").textContent = btn.querySelector("span").textContent;
}
function clearAuditHighlights(){
  document.querySelectorAll(".auditField").forEach(el=>el.classList.remove("auditField"));
  document.querySelectorAll(".auditFocusBox").forEach(el=>el.classList.remove("auditFocusBox"));
}
function renderAuditFixPanel(){
  const panel = $("auditFixPanel");
  if(!panel) return;
  if(!auditFocus || auditFocus.date !== state.selectedDate || !auditFocus.title){
    panel.classList.remove("active");
    panel.innerHTML = "";
    return;
  }
  panel.classList.add("active");
  panel.innerHTML = `
    <h3>${escapeHtml(auditFocus.title)}</h3>
    <p><strong>Page/date:</strong> ${escapeHtml(fmtDateLong(auditFocus.date))} • Page ${escapeHtml(auditFocus.pageNo || "")}</p>
    <p><strong>Mistake:</strong> ${escapeHtml(auditFocus.message || "")}</p>
    <p><strong>Possible fix:</strong> ${escapeHtml(auditFocus.suggestion || "")}</p>
    <div class="fixActions">
      <button onclick="auditFocus=null;renderAuditFixPanel();clearAuditHighlights();">Done / hide</button>
      <button class="secondary" onclick="switchToTab('drivingScreen');renderAuditList();">Back to errors</button>
    </div>`;
}
function openAuditError(err){
  if(!err) return;
  auditFocus = {date: err.date, title: err.title, message: err.message, suggestion: err.suggestion, pageNo: err.pageNo, ...(err.focus || {})};
  state.selectedDate = err.date;
  save();
  renderAll();
  renderAuditFixPanel();
  switchToTab("diaryScreen");
  setTimeout(()=>{
    clearAuditHighlights();
    if(auditFocus.type === "field" && auditFocus.field){
      const el = $(auditFocus.field);
      if(el){
        el.classList.add("auditField");
        el.scrollIntoView({behavior:"smooth", block:"center"});
        try{ el.focus({preventScroll:true}); }catch(e){}
      }
    } else if(auditFocus.type === "section" && auditFocus.section){
      const el = $(auditFocus.section);
      if(el){
        el.classList.add("auditFocusBox");
        el.scrollIntoView({behavior:"smooth", block:"center"});
      }
    } else {
      const grid = $("diaryGrid");
      if(grid){
        grid.classList.add("auditFocusBox");
        grid.scrollIntoView({behavior:"smooth", block:"center"});
      }
    }
    alert(`Opened ${fmtDateLong(err.date)} page ${err.pageNo}: ${err.title}\n\nPossible fix: ${err.suggestion}`);
  }, 250);
}

function renderTodayAdvice(){
  const el = $("todayAdvice");
  if(!el) return;
  const warns = checkDayWarnings();
  el.innerHTML = warns.map(w => `<p>${w.text}</p>`).join("");
}
function renderTimer(){
  const s=$("liveStatus"), since=$("liveSince");
  if(!s || !since) return;
  if(!state.activeTimer){
    s.textContent="No active timer";
    since.textContent="";
    return;
  }
  const start=new Date(state.activeTimer.startISO);
  const mins=Math.max(0, Math.floor((Date.now()-start.getTime())/60000));
  s.textContent = state.activeTimer.activity==="work" ? "Working / Driving" : "Resting";
  since.textContent = `Started ${start.toLocaleString("en-AU")} — ${Math.floor(mins/60)}h ${mins%60}m so far`;
}


function baseStateShort(){
  const detail = ensureDayDetail(state.selectedDate);
  const t = detail.baseStateSnapshot || state.profile.baseTimeZone || "NSW";
  const allowed = ["ACT","NSW","NT","QLD","SA","TAS","VIC","WA"];
  if(allowed.includes(t)) return t;
  if(String(t).startsWith("Queensland")) return "QLD";
  if(String(t).startsWith("South Australia")) return "SA";
  if(String(t).startsWith("Northern Territory")) return "NT";
  if(String(t).startsWith("Western Australia")) return "WA";
  if(String(t).startsWith("NSW")) return "NSW";
  return "NSW";
}
function dayNameLetters(){
  return ["S","M","T","W","T","F","S"];
}
function formatDisplayDateShort(key){
  const d = fromKey(key);
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
}
function syncChangeRowsForDay(key){
  const detail = ensureDayDetail(key);
  const existing = Array.isArray(detail.changeRows) ? detail.changeRows : [];
  const keep = {};
  existing.forEach(r => { keep[`${r.time}|${r.activity}`] = r; });
  const segs = segmentsForDay(key);
  detail.changeRows = segs.map(seg => {
    const time = fmtHM(seg.startMins);
    const prev = keep[`${time}|${seg.activity}`] || {};
    return {
      time,
      activity: seg.activity,
      odometer: prev.odometer || "",
      location: prev.location || "",
      note: prev.note || "",
      restType: prev.restType || (seg.activity === "rest" ? "" : "work")
    };
  });
  return detail.changeRows;
}
function renderChangeDetailsEditor(){
  const holder = $("changeDetailsEditor");
  if(!holder) return;
  const rows = syncChangeRowsForDay(state.selectedDate);
  if(!rows.length){
    holder.innerHTML = "<p class=\"hint\">No work/rest changes yet.</p>";
    return;
  }
  const htmlRows = rows.map((r, i) => `
    <tr>
      <td class="readonlyCell">${escapeHtml(r.time)}</td>
      <td class="readonlyCell">${escapeHtml(activityLabel(r.activity))}</td>
      <td><input data-change-index="${i}" data-change-field="odometer" value="${escapeHtml(r.odometer)}" placeholder="Optional"></td>
      <td><input data-change-index="${i}" data-change-field="location" value="${escapeHtml(r.location)}" placeholder="Town / suburb / rest area"></td>
      <td>
        ${r.activity === "rest" ? `
          <select class="restTypeSelect" data-change-index="${i}" data-change-field="restType">
            <option value="" ${!r.restType ? "selected" : ""}>Select rest type</option>
            <option value="rest" ${r.restType==="rest" ? "selected" : ""}>Rest</option>
            <option value="stationary" ${r.restType==="stationary" ? "selected" : ""}>Stationary rest</option>
            <option value="sleeper" ${r.restType==="sleeper" ? "selected" : ""}>Sleeper berth rest</option>
            <option value="night" ${r.restType==="night" ? "selected" : ""}>Night rest</option>
            <option value="24h" ${r.restType==="24h" ? "selected" : ""}>24h rest</option>
          </select>` : `<span class="readonlyCell">Work</span>`}
      </td>
      <td><input data-change-index="${i}" data-change-field="note" value="${escapeHtml(r.note)}" placeholder="Optional"></td>
    </tr>`).join("");
  holder.innerHTML = `
    <table class="changeTable">
      <thead><tr><th>Time</th><th>Activity</th><th>Odometer</th><th>Location</th><th>Rest type</th><th>Note</th></tr></thead>
      <tbody>${htmlRows}</tbody>
    </table>`;
}

function svgText(x, y, text, size=12, fill="#111", weight="400", extra=""){
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" font-family="Arial, Helvetica, sans-serif" ${extra}>${escapeHtml(text || "")}</text>`;
}
function svgRect(x, y, w, h, fill="none", stroke="#111", sw=1, extra=""){
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`;
}
function svgLine(x1, y1, x2, y2, stroke="#111", sw=1, extra=""){
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`;
}
function svgCheckbox(x, y, label, checked=false, size=13){
  return `${svgRect(x,y,size,size,"#fff","#111",1)}${checked ? svgText(x+2,y+size-2,"X",size+1,"#1439d6","700") : ""}${svgText(x+size+4,y+size-2,label,11,"#111","400")}`;
}
function svgBoxedLetters(x, y, letters, active, boxW=25, boxH=24, fontSize=12){
  return letters.map((l,i)=>{
    const bx = x + i*boxW;
    const on = Array.isArray(active) ? active.includes(l) : active === l || active === i;
    return `${svgRect(bx,y,boxW,boxH,"#fff","#111",1)}${on ? svgText(bx+boxW/2,y+17,l,fontSize,"#1439d6","700",'text-anchor="middle"') : svgText(bx+boxW/2,y+17,l,fontSize,"#111","400",'text-anchor="middle"')}`;
  }).join("");
}

function buildPaperGraphSvg(key){
  const width = 980;
  const left = 70;
  const topY = 26;
  const restY = 84;
  const bottomY = 100;
  const right = width - 16;
  const slotW = (right - left) / 96;
  const labels = [];
  for(let h=0; h<=24; h++){
    const x = left + h*4*slotW;
    labels.push(`<line x1="${x}" y1="${topY-4}" x2="${x}" y2="${bottomY}" stroke="#333" stroke-width="${h===0 || h===24 ? 1.4 : 1}" />`);
    if(h < 24){
      const n = h === 0 ? 12 : (h > 12 ? h-12 : h);
      labels.push(`<text x="${x+1}" y="14" font-size="10">${n}</text>`);
      labels.push(`<text x="${x+1}" y="${bottomY+14}" font-size="10">${n}</text>`);
    }
  }
  for(let i=0;i<=96;i++){
    const x = left + i*slotW;
    labels.push(`<line x1="${x}" y1="${topY-4}" x2="${x}" y2="${topY+8}" stroke="#777" stroke-width="0.6" />`);
    labels.push(`<line x1="${x}" y1="${restY+6}" x2="${x}" y2="${bottomY}" stroke="#777" stroke-width="0.6" />`);
  }
  const lines = [
    `<line x1="${left}" y1="${topY}" x2="${right}" y2="${topY}" stroke="#333" stroke-width="1.2"/>`,
    `<line x1="${left}" y1="${restY}" x2="${right}" y2="${restY}" stroke="#333" stroke-width="1.2"/>`,
    `<line x1="${left}" y1="${bottomY}" x2="${right}" y2="${bottomY}" stroke="#333" stroke-width="1.2"/>`,
    `<text x="4" y="${topY+3}" font-size="12">My Work</text>`,
    `<text x="22" y="${restY+3}" font-size="12">Rest</text>`
  ];
  const getY = (slotIndex) => getSlot(key, slotIndex) === "work" ? topY : restY;
  let d = `M ${left} ${getY(0)}`;
  for(let i=0;i<96;i++){
    const y = getY(i);
    const nextY = i < 95 ? getY(i+1) : y;
    const xEnd = left + (i+1)*slotW;
    d += ` L ${xEnd} ${y}`;
    if(i < 95 && nextY !== y) d += ` L ${xEnd} ${nextY}`;
  }
  return `<svg viewBox="0 0 ${width} 120" width="100%" height="120" role="img" aria-label="Work diary line graph">
    <rect x="0" y="0" width="${width}" height="120" fill="white"/>
    ${labels.join("")}
    ${lines.join("")}
    <path d="${d}" fill="none" stroke="#1a38d9" stroke-width="2.4"/>
  </svg>`;
}
function buildPaperSheetHtml(){
  ensureProfile();
  const key = state.selectedDate;
  const detail = ensureDayDetail(key);
  const changeRows = syncChangeRowsForDay(key);
  const totals = totalsForDay();
  const d = fromKey(key);
  const dayIdx = d.getDay();
  const base = baseStateShort();
  const workDiaryNo = detail.workDiaryNo || "";
  const pageNo = detail.pageNo || "";
  const driver = detail.driverNameSnapshot || state.profile.driverName || "";
  const licence = detail.licenceNumberSnapshot || state.profile.licenceNumber || "";
  const plate = detail.numberPlate || "";
  const dateStr = formatDisplayDateShort(key);
  const currentScheme = schemeForDate(key);
  const isBFM = currentScheme === "BFM";
  const isStandard = currentScheme === "Standard";
  const isAFM = currentScheme === "AFM";

  const W = 1024, H = 768;
  const x0 = 148, x1 = 914;
  const slotW = (x1-x0)/96;
  const workY = 548;
  const restY = 606;
  const graphBottom = 632;

  const gridLines = [];
  // Activity detail section vertical lines.
  for(let i=0;i<=24;i++){
    const x = x0 + i*4*slotW;
    gridLines.push(svgLine(x,250,x,491,"#111",1));
  }
  for(let i=0;i<=96;i++){
    const x = x0 + i*slotW;
    const major = i%4===0;
    gridLines.push(svgLine(x,492,x,510,major ? "#111" : "#777",major ? 1 : .6));
    gridLines.push(svgLine(x,530,x,628,major ? "#111" : "#777",major ? 1 : .6));
  }

  const topNums = [];
  for(let h=0; h<24; h++){
    const x = x0 + h*4*slotW + 2;
    const n = h === 0 ? "12" : (h > 12 ? String(h-12) : String(h));
    topNums.push(svgText(x,510,n,18,"#111","400"));
    topNums.push(svgText(x,648,n,18,"#111","400"));
  }
  topNums.push(svgText(x1-10,510,"12",18,"#111","400"));
  topNums.push(svgText(x1-10,648,"12",18,"#111","400"));

  // Blue step line for work/rest.
  const getY = (slotIndex) => getSlot(key, slotIndex) === "work" ? workY : restY;
  let lineD = `M ${x0} ${getY(0)}`;
  for(let i=0;i<96;i++){
    const y = getY(i);
    const nextY = i < 95 ? getY(i+1) : y;
    const xEnd = x0 + (i+1)*slotW;
    lineD += ` L ${xEnd} ${y}`;
    if(i < 95 && nextY !== y) lineD += ` L ${xEnd} ${nextY}`;
  }

  // Change-row details in vertical style like diary book.
  const changeText = [];
  changeRows.slice(0,20).forEach(r => {
    const mins = timeToMins(r.time);
    const x = x0 + (mins/15)*slotW + 12;
    if(r.odometer) changeText.push(`<text transform="translate(${x},333) rotate(-90)" font-size="13" fill="#1439d6" font-weight="700" font-family="Arial">${escapeHtml(r.odometer)}</text>`);
    const loc = r.location || r.note || "";
    if(loc) changeText.push(`<text transform="translate(${x},458) rotate(-90)" font-size="13" fill="#1439d6" font-weight="700" font-family="Arial">${escapeHtml(loc)}</text>`);
  });

  const stateBoxes = svgBoxedLetters(386,128,["ACT","NSW","NT","QLD","SA","TAS","VIC","WA"],base,38,25,11);
  const dayBoxes = svgBoxedLetters(522,84,["S","M","T","W","T","F","S"],dayIdx,26,28,12);

  const twoUpScheme = detail.twoUpScheme || "BFM";
  const twoUpState = detail.twoUpBaseState || "";
  const twoUpStates = svgBoxedLetters(805,704,["ACT","NSW","NT","QLD","SA","TAS","VIC","WA"],twoUpState,28,25,10);

  const workRestOptions =
    svgCheckbox(680,86,"Standard",isStandard) +
    svgCheckbox(752,86,"Standard Bus",false) +
    svgCheckbox(680,116,"BFM",isBFM) +
    svgCheckbox(752,116,"AFM",isAFM) +
    svgCheckbox(680,145,"Fit for Duty",!!detail.fitForDuty);

  const twoUpCheck =
    svgCheckbox(815,685,"Standard",detail.twoUpEnabled && twoUpScheme==="Standard",12) +
    svgCheckbox(884,685,"BFM",detail.twoUpEnabled && twoUpScheme==="BFM",12) +
    svgCheckbox(934,685,"AFM",detail.twoUpEnabled && twoUpScheme==="AFM",12);

  const comments = (detail.comments || "").split("\n").slice(0,4).map((line,i)=>svgText(72,188+i*14,line,11,"#111","400")).join("");

  const svg = `
  <svg class="realDiarySvg" viewBox="0 0 ${W} ${H}" width="100%" height="auto" role="img" aria-label="National Work Diary Daily Sheet">
    <rect x="0" y="0" width="${W}" height="${H}" fill="white"/>
    ${svgText(512,28,"NATIONAL WORK DIARY DAILY SHEET",18,"#111","700",'text-anchor="middle"')}
    ${svgText(680,64,"WORK DIARY NO.",11,"#111","700")}
    ${svgText(795,66,workDiaryNo,18,"#111","700")}
    ${svgText(935,66,pageNo,18,"#d82626","700")}

    <rect x="18" y="48" width="988" height="25" fill="#555"/>
    ${svgText(512,66,"DRIVER INDENTIFICATION",16,"#fff","700",'text-anchor="middle"')}

    ${svgText(28,89,"Driver's Name:",11,"#111","400")}
    ${svgRect(28,92,336,35)}
    ${svgText(196,116,driver,18,"#1439d6","700",'text-anchor="middle"')}

    ${svgText(373,89,"Date:",11,"#111","400")}
    ${svgRect(373,92,132,35)}
    ${svgText(439,117,dateStr,18,"#1439d6","700",'text-anchor="middle"')}

    ${svgText(520,81,"Day of the Week:",11,"#111","400")}
    ${dayBoxes}

    ${svgText(678,81,"Work/Rest Option",11,"#111","400")}
    ${workRestOptions}

    ${svgText(852,81,"Time of daily check (if required):",10,"#111","400")}
    ${svgRect(852,92,154,35)}
    ${svgText(929,116,detail.dailyCheckTime || "",16,"#1439d6","700",'text-anchor="middle"')}

    ${svgText(28,123,"License No:",10,"#111","400")}
    ${svgRect(28,128,174,35)}
    ${svgText(115,152,licence,18,"#1439d6","700",'text-anchor="middle"')}

    ${svgText(210,123,"Number Plate:",10,"#111","400")}
    ${svgRect(210,128,174,35)}
    ${svgText(297,152,plate,18,"#1439d6","700",'text-anchor="middle"')}

    ${svgText(388,123,"Time Zone: State/Territory (Driver Base)",10,"#111","400")}
    ${stateBoxes}

    ${svgRect(18,172,42,455,"#555","#555")}
    <text transform="translate(48,400) rotate(-90)" font-size="20" fill="#fff" font-weight="700" font-family="Arial">DETAILS OF ACTIVITIES FOR THIS DAY</text>

    ${svgRect(60,172,946,455)}
    ${svgLine(60,250,1006,250)}
    ${svgLine(60,336,914,336)}
    ${svgLine(60,462,914,462)}
    ${svgLine(60,492,914,492)}
    ${svgLine(60,520,1006,520)}
    ${svgLine(60,575,1006,575)}
    ${svgLine(60,628,1006,628)}
    ${svgLine(148,172,148,628)}
    ${svgLine(914,250,914,628)}

    ${svgText(64,190,"Number Plate",12)}
    ${svgText(64,204,"Change and",12)}
    ${svgText(64,218,"Comments",12)}
    ${svgText(64,232,"(optional)",11)}
    ${comments}

    ${svgText(64,292,"Odometer",12)}
    ${svgText(64,306,"Reading",12)}

    ${svgText(64,372,"Name of",12)}
    ${svgText(64,388,"Location at",12)}
    ${svgText(64,404,"Work and",12)}
    ${svgText(64,420,"Rest Change",12)}
    ${svgText(64,436,"(e.g. rest area,",10)}
    ${svgText(64,448,"truck stop,",10)}
    ${svgText(64,460,"suburb or town)",10)}

    ${svgText(64,482,"Two-up",12)}
    ${svgText(64,558,"My Work",12)}
    ${svgText(64,611,"Rest",12)}
    ${svgText(922,285,"Space for you to",9)}
    ${svgText(922,298,"your work and rest hours",9)}
    ${svgText(922,311,"(optional)",9)}

    ${gridLines.join("")}
    ${topNums.join("")}
    ${changeText.join("")}
    <path d="${lineD}" fill="none" stroke="#1439d6" stroke-width="2.2"/>

    ${svgText(922,516,"All drivers:",8)}
    ${svgText(922,528,"calculate totals",8)}
    ${svgText(936,548,"Total Work:",11,"#111","700")}
    ${svgText(960,575,`${Math.floor(totals.work/60)}h ${totals.work%60}m`,18,"#1439d6","700",'text-anchor="middle"')}
    ${svgText(938,601,"Total Rest:",11,"#111","700")}
    ${svgText(960,626,`${Math.floor(totals.rest/60)}h ${totals.rest%60}m`,18,"#1439d6","700",'text-anchor="middle"')}

    ${svgText(18,663,"Driver Signature:",12)}
    ${svgText(18,693,"To the best of my knowledge and belief the information I have recorded on this",9)}
    ${svgText(18,706,"daily sheet is true and correct",9)}
    ${svgRect(18,718,330,40)}

    <rect x="380" y="642" width="626" height="25" fill="#555"/>
    ${svgText(693,661,"TWO-UP DRIVER'S IDENTIFICATION",16,"#fff","700",'text-anchor="middle"')}

    ${svgText(380,682,"Two-up Driver Name:",11)}
    ${svgRect(380,686,230,32)}
    ${svgText(495,708,detail.twoUpEnabled ? detail.twoUpDriverName || "" : "",14,"#1439d6","700",'text-anchor="middle"')}

    ${svgText(630,682,"Two-up Driver's License No:",11)}
    ${svgRect(630,686,170,32)}
    ${svgText(715,708,detail.twoUpEnabled ? detail.twoUpLicenceNumber || "" : "",14,"#1439d6","700",'text-anchor="middle"')}

    ${svgText(815,682,"Two-up Driver",11)}
    ${twoUpCheck}

    ${svgText(380,733,"Two-up Driver's Work Diary & Page No:",11)}
    ${svgRect(380,737,250,28)}

    ${svgText(644,733,"Two-up Driver's License issued:",11)}
    ${twoUpStates}

    ${svgText(815,733,"Two-up Driver Signature:",11)}
    ${svgRect(815,737,190,28)}
  </svg>`;

  return `<div class="paperSheet realBookSheet">${svg}</div>`;
}
function renderGraphPreviewOnly(){
  const holder = $("paperSheetPreview");
  if(!holder) return;
  holder.innerHTML = buildPaperSheetHtml();
}

function renderPageOverrideForm(){
  const form = $("pageOverrideForm");
  if(!form) return;
  const detail = ensureDayDetail(state.selectedDate);
  const unlocked = $("unlockPageEdit") ? $("unlockPageEdit").checked : false;
  const setVal = (id, value) => { const el=$(id); if(el) el.value = value || ""; };
  setVal("pageDriverName", detail.driverNameSnapshot || state.profile.driverName || "");
  setVal("pageLicenceNumber", detail.licenceNumberSnapshot || state.profile.licenceNumber || "");
  setVal("pageBaseState", detail.baseStateSnapshot || state.profile.baseTimeZone || "NSW");
  setVal("pageWorkDiaryNo", detail.workDiaryNo || "");
  setVal("pagePageNo", detail.pageNo || "");
  setVal("pageNumberPlate", detail.numberPlate || "");

  form.classList.toggle("disabled", !unlocked);
  document.querySelectorAll("[data-page-override]").forEach(el => {
    el.disabled = !unlocked;
  });
  if($("saveSelectedPageOnly")) $("saveSelectedPageOnly").disabled = !unlocked;
}
function saveSelectedPageOnly(){
  const detail = ensureDayDetail(state.selectedDate);
  if(!($("unlockPageEdit") && $("unlockPageEdit").checked)){
    alert("Please tick Unlock selected page details for editing first.");
    return;
  }
  if(!confirm(`Save changes to ${state.selectedDate} only? This will not change any other page.`)){
    return;
  }
  detail.driverNameSnapshot = $("pageDriverName").value.trim();
  detail.licenceNumberSnapshot = $("pageLicenceNumber").value.trim();
  detail.baseStateSnapshot = $("pageBaseState").value;
  detail.workDiaryNo = $("pageWorkDiaryNo").value.trim();
  detail.pageNo = $("pagePageNo").value.trim();
  detail.numberPlate = $("pageNumberPlate").value.trim();

  detail.workDiaryNoManual = true;
  detail.pageNoManual = true;
  detail.numberPlateManual = true;
  detail.selectedPageManual = true;

  save();
  if($("unlockPageEdit")) $("unlockPageEdit").checked = false;
  renderAll();
  addAuditLog("Selected page edited", `Updated selected page only: ${state.selectedDate}`); save(); alert("Selected page updated only.");
}
function restoreSelectedPageDefaults(){
  const detail = ensureDayDetail(state.selectedDate);
  if(!confirm(`Restore ${state.selectedDate} from saved defaults/effective-date history? This changes this selected page only.`)){
    return;
  }
  detail.driverNameSnapshot = "";
  detail.licenceNumberSnapshot = "";
  detail.baseStateSnapshot = "";
  detail.workDiaryNoManual = false;
  detail.pageNoManual = false;
  detail.numberPlateManual = false;
  detail.selectedPageManual = false;
  applyAutoDefaultsToDay(state.selectedDate);
  save();
  if($("unlockPageEdit")) $("unlockPageEdit").checked = false;
  renderAll();
  addAuditLog("Selected page restored", `Restored selected page from defaults: ${state.selectedDate}`); save(); alert("Selected page restored from defaults.");
}

function renderGraphForm(){
  const detail = ensureDayDetail(state.selectedDate);
  const setVal = (id, value) => { const el=$(id); if(el && el.value !== String(value ?? "")) el.value = value ?? ""; };
  const setChk = (id, value) => { const el=$(id); if(el) el.checked = !!value; };
  setVal("sheetWorkDiaryNo", detail.workDiaryNo);
  setVal("sheetPageNo", detail.pageNo);
  setVal("sheetNumberPlate", detail.numberPlate);
  setVal("sheetDailyCheckTime", detail.dailyCheckTime);
  const comments = $("sheetComments"); if(comments && comments.value !== String(detail.comments || "")) comments.value = detail.comments || "";
  setChk("sheetFitForDuty", detail.fitForDuty);
  setChk("sheetTwoUpEnabled", detail.twoUpEnabled);
  setVal("sheetTwoUpDriverName", detail.twoUpDriverName);
  setVal("sheetTwoUpLicenceNumber", detail.twoUpLicenceNumber);
  setVal("sheetTwoUpScheme", detail.twoUpScheme || "BFM");
  setVal("sheetTwoUpBaseState", detail.twoUpBaseState);
}
function updateDayDetailFromGraphForm(){
  const detail = ensureDayDetail(state.selectedDate);
  document.querySelectorAll("[data-day-detail]").forEach(el => {
    const key = el.dataset.dayDetail;
    detail[key] = el.type === "checkbox" ? !!el.checked : el.value;
  });
  const calcPage = calculatedPageNumberForDate(state.selectedDate);
  detail.pageNoManual = !!(detail.pageNo && detail.pageNo !== calcPage);
  save();
  renderAlerts();
  renderRuleCards();
  renderNextBreak();
  renderStatistics();
  renderGraphPreviewOnly();
}
function handleChangeDetailsInput(e){
  const target = e.target;
  if(!target || !target.dataset) return;
  const idx = Number(target.dataset.changeIndex);
  const field = target.dataset.changeField;
  if(Number.isNaN(idx) || !field) return;
  const detail = ensureDayDetail(state.selectedDate);
  syncChangeRowsForDay(state.selectedDate);
  if(!detail.changeRows[idx]) return;
  detail.changeRows[idx][field] = target.value;
  save();
  renderGraphPreviewOnly();
}
function renderGraphSummaryOnly(){
  const segs = segmentsForDay(state.selectedDate);
  const rows = segs.map(s => `<tr><td>${fmtHM(s.startMins)}</td><td>${s.endMins>=1440 ? "24:00" : fmtHM(s.endMins)}</td><td>${activityLabel(s.activity)}</td><td>${Math.floor((s.endMins-s.startMins)/60)}h ${(s.endMins-s.startMins)%60}m</td></tr>`).join("");
  $("graphSummaryTable").innerHTML = `
    <table class="graphTable">
      <thead><tr><th>Start</th><th>End</th><th>Activity</th><th>Duration</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}


function dateDiffDays(fromKeyStr, toKeyStr){
  const a = fromKey(fromKeyStr);
  const b = fromKey(toKeyStr);
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}
function calculatedPageNumberForDate(key){
  ensureBookSettings();
  if(!state.bookSettings.autoPageNumber) return "";
  const first = parseInt(state.bookSettings.firstPageNumber, 10);
  if(!first || !state.bookSettings.firstPageDate) return "";
  return String(first + dateDiffDays(state.bookSettings.firstPageDate, key));
}
function applyAutoDefaultsToDay(key){
  ensureBookSettings();
  ensureSettingsHistory();
  applyRuleRecordToDay(key);
  const rec = currentSettingsRecordForDate(key);
  const detail = ensureDayDetail(key);

  if(!detail.driverNameSnapshot) detail.driverNameSnapshot = rec.driverName || state.profile.driverName || "";
  if(!detail.licenceNumberSnapshot) detail.licenceNumberSnapshot = rec.licenceNumber || state.profile.licenceNumber || "";
  if(!detail.baseStateSnapshot) detail.baseStateSnapshot = rec.baseTimeZone || state.profile.baseTimeZone || "NSW";

  if((rec.defaultWorkDiaryNo || state.bookSettings.defaultWorkDiaryNo) && !detail.workDiaryNoManual){
    detail.workDiaryNo = rec.defaultWorkDiaryNo || state.bookSettings.defaultWorkDiaryNo || "";
  }
  if((rec.defaultNumberPlate || state.bookSettings.defaultNumberPlate) && !detail.numberPlateManual){
    detail.numberPlate = rec.defaultNumberPlate || state.bookSettings.defaultNumberPlate || "";
  }
  if(state.bookSettings.autoPageNumber){
    const calc = calculatedPageNumberForDate(key);
    if(calc && !detail.pageNoManual){
      detail.pageNo = calc;
    }
  }
  if(state.bookSettings.carryForwardTwoUp && !detail.twoUpManual){
    const t = rec.defaultTwoUp || state.bookSettings.defaultTwoUp || {};
    detail.twoUpEnabled = !!t.enabled;
    detail.twoUpDriverName = t.twoUpDriverName || "";
    detail.twoUpLicenceNumber = t.twoUpLicenceNumber || "";
    detail.twoUpScheme = t.twoUpScheme || "BFM";
    detail.twoUpBaseState = t.twoUpBaseState || "";
  }
  return detail;
}

function saveRuleRecordFromSelectedDay(){
  ensureRuleHistory();
  const detail = ensureDayDetail(state.selectedDate);
  const rec = {
    effectiveDate: state.selectedDate,
    scheme: detail.ruleScheme || state.scheme || "BFM",
    mode: detail.twoUpEnabled ? "twoUp" : "solo",
    coDriverScheme: detail.twoUpEnabled ? (detail.twoUpScheme || "") : ""
  };
  const idx = state.ruleHistory.findIndex(x => x.effectiveDate === rec.effectiveDate);
  if(idx >= 0) state.ruleHistory[idx] = rec;
  else state.ruleHistory.push(rec);
  state.ruleHistory.sort((a,b)=>String(a.effectiveDate).localeCompare(String(b.effectiveDate)));
}
function updateTwoUpCarryForwardFromDay(){
  ensureBookSettings();
  const detail = ensureDayDetail(state.selectedDate);
  detail.twoUpManual = true;
  if(!state.bookSettings.carryForwardTwoUp) return;
  state.bookSettings.defaultTwoUp = {
    enabled: !!detail.twoUpEnabled,
    twoUpDriverName: detail.twoUpDriverName || "",
    twoUpLicenceNumber: detail.twoUpLicenceNumber || "",
    twoUpScheme: detail.twoUpScheme || "BFM",
    twoUpBaseState: detail.twoUpBaseState || ""
  };
  saveSettingsRecord(state.selectedDate);
  saveRuleRecordFromSelectedDay();
}
function twoUpMissingDetails(){
  const d = ensureDayDetail(state.selectedDate);
  if(!d.twoUpEnabled) return [];
  const missing = [];
  if(!d.twoUpDriverName) missing.push("two-up driver name");
  if(!d.twoUpLicenceNumber) missing.push("two-up licence number");
  if(!d.twoUpScheme) missing.push("two-up scheme");
  return missing;
}


function renderRuleHistorySettings(){
  ensureRuleHistory();
  const rec = ruleRecordForDate(state.selectedDate);
  if($("ruleEffectiveDate")) $("ruleEffectiveDate").value = $("ruleEffectiveDate").value || state.selectedDate || toKey(new Date());
  if($("ruleMyScheme")) $("ruleMyScheme").value = rec.scheme || state.scheme || "BFM";
  if($("ruleDriverMode")) $("ruleDriverMode").value = rec.mode || "solo";
  if($("ruleCoDriverScheme")) $("ruleCoDriverScheme").value = rec.coDriverScheme || "";
  const list = $("ruleHistoryList");
  if(list){
    list.innerHTML = [...state.ruleHistory].sort((a,b)=>String(b.effectiveDate).localeCompare(String(a.effectiveDate))).map(r => `
      <div class="historyItem">
        <strong>From ${escapeHtml(r.effectiveDate)}</strong>
        <span class="modeBadge">${escapeHtml(r.scheme || "")}</span>
        <span class="modeBadge">${escapeHtml(r.mode === "twoUp" ? "Two-up" : "Solo")}</span>
        ${r.mode === "twoUp" ? `<span class="modeBadge">Co-driver: ${escapeHtml(r.coDriverScheme || "Not set")}</span>` : ""}
      </div>`).join("");
  }
}
function saveRuleHistorySetting(){
  ensureRuleHistory();
  const effectiveDate = $("ruleEffectiveDate").value || state.selectedDate || toKey(new Date());
  const rec = {
    effectiveDate,
    scheme: $("ruleMyScheme").value,
    mode: $("ruleDriverMode").value,
    coDriverScheme: $("ruleDriverMode").value === "twoUp" ? $("ruleCoDriverScheme").value || "Standard" : ""
  };
  const idx = state.ruleHistory.findIndex(x => x.effectiveDate === effectiveDate);
  if(idx >= 0) state.ruleHistory[idx] = rec;
  else state.ruleHistory.push(rec);
  state.ruleHistory.sort((a,b)=>String(a.effectiveDate).localeCompare(String(b.effectiveDate)));
  state.scheme = rec.scheme;
  Object.keys(state.dayDetails || {}).forEach(key => {
    if(key >= effectiveDate){
      const d = ensureDayDetail(key);
      if(!d.ruleManual){
        d.ruleScheme = rec.scheme;
        d.driverMode = rec.mode;
        d.twoUpEnabled = rec.mode === "twoUp";
        if(rec.mode === "twoUp") d.twoUpScheme = rec.coDriverScheme || d.twoUpScheme || "Standard";
      }
    }
  });
  if(state.selectedDate >= effectiveDate){
    const d = ensureDayDetail(state.selectedDate);
    if(!d.ruleManual){
      d.ruleScheme = rec.scheme;
      d.driverMode = rec.mode;
      d.twoUpEnabled = rec.mode === "twoUp";
      if(rec.mode === "twoUp") d.twoUpScheme = rec.coDriverScheme || d.twoUpScheme || "Standard";
    }
  }
  save();
  renderAll();
  addAuditLog("Work option changed", `From ${effectiveDate}: ${rec.scheme} ${rec.mode}${rec.coDriverScheme ? ", co-driver "+rec.coDriverScheme : ""}`); save(); alert(`Work option saved from ${effectiveDate}. Previous pages stay unchanged.`);
}
function renderBookSettings(){
  ensureBookSettings();
  const set = state.bookSettings;
  if($("autoPageNumber")) $("autoPageNumber").checked = !!set.autoPageNumber;
  if($("carryForwardTwoUp")) $("carryForwardTwoUp").checked = !!set.carryForwardTwoUp;
  if($("firstPageDate")) $("firstPageDate").value = set.firstPageDate || state.selectedDate;
  if($("firstPageNumber")) $("firstPageNumber").value = set.firstPageNumber || "";
  if($("defaultWorkDiaryNo")) $("defaultWorkDiaryNo").value = set.defaultWorkDiaryNo || "";
  if($("defaultNumberPlate")) $("defaultNumberPlate").value = set.defaultNumberPlate || "";
}
function saveBookSettings(){
  ensureBookSettings();
  state.bookSettings.autoPageNumber = $("autoPageNumber").checked;
  state.bookSettings.carryForwardTwoUp = $("carryForwardTwoUp").checked;
  state.bookSettings.firstPageDate = $("firstPageDate").value || state.selectedDate;
  state.bookSettings.firstPageNumber = $("firstPageNumber").value.trim();
  state.bookSettings.defaultWorkDiaryNo = $("defaultWorkDiaryNo").value.trim();
  state.bookSettings.defaultNumberPlate = $("defaultNumberPlate").value.trim();
  const effectiveDate = $("settingsEffectiveDate") ? $("settingsEffectiveDate").value || state.selectedDate : state.selectedDate;
  saveSettingsRecord(effectiveDate);
  updateFutureDailyDetailsFromEffectiveDate(effectiveDate);

  // Recalculate page numbers for days that have not been manually overridden.
  Object.keys(state.dayDetails || {}).forEach(key => {
    const d = ensureDayDetail(key);
    if(state.bookSettings.autoPageNumber && !d.pageNoManual){
      const calc = calculatedPageNumberForDate(key);
      if(calc) d.pageNo = calc;
    }
    if(state.bookSettings.defaultWorkDiaryNo && !d.workDiaryNo) d.workDiaryNo = state.bookSettings.defaultWorkDiaryNo;
    if(state.bookSettings.defaultNumberPlate && !d.numberPlate) d.numberPlate = state.bookSettings.defaultNumberPlate;
  });

  if(state.bookSettings.carryForwardTwoUp){
    const d = ensureDayDetail(state.selectedDate);
    if(d.twoUpManual || d.twoUpEnabled){
      updateTwoUpCarryForwardFromDay();
    }
  }
  saveSettingsRecord(effectiveDate);
  updateFutureDailyDetailsFromEffectiveDate(effectiveDate);
  save();
  renderAll();
  addAuditLog("Book setup changed", `Effective from ${effectiveDate}`); save(); alert(`Work diary book setup saved from ${effectiveDate}. Previous pages stay unchanged.`);
}

function renderGraphPage(){
  ensureProfile();
  applyAutoDefaultsToDay(state.selectedDate);
  renderGraphForm();
  renderPageOverrideForm();
  renderChangeDetailsEditor();
  renderGraphPreviewOnly();
  renderGraphSummaryOnly();
}


function makeLocalDateTimeValue(d){
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function parseStatsAsOf(){
  const input = $("statsAsOf");
  if(input && input.value){
    const d = new Date(input.value);
    if(!isNaN(d)) return d;
  }
  return new Date();
}
function setStatsAsOfNow(){
  const input = $("statsAsOf");
  if(input) input.value = makeLocalDateTimeValue(new Date());
  renderStatistics();
}
function activityAtAbs(abs){
  const {key, slot} = absToKeySlot(abs);
  if(slot < 0 || slot >= SLOTS_PER_DAY) return "rest";
  return getSlot(key, slot);
}
function countWorkBetweenAbs(startAbs, endAbs){
  let total = 0;
  for(let t=startAbs; t<endAbs; t+=SLOT*60000){
    if(activityAtAbs(t) === "work") total += SLOT;
  }
  return total;
}
function countRestBetweenAbs(startAbs, endAbs){
  let total = 0;
  for(let t=startAbs; t<endAbs; t+=SLOT*60000){
    if(activityAtAbs(t) !== "work") total += SLOT;
  }
  return total;
}
function continuousRestBeforeAbs(endAbs){
  let total = 0;
  for(let t=endAbs-SLOT*60000; t>=endAbs-48*60*60000; t-=SLOT*60000){
    if(activityAtAbs(t) !== "work") total += SLOT;
    else break;
  }
  return total;
}
function continuousWorkBeforeAbs(endAbs){
  let total = 0;
  for(let t=endAbs-SLOT*60000; t>=endAbs-48*60*60000; t-=SLOT*60000){
    if(activityAtAbs(t) === "work") total += SLOT;
    else break;
  }
  return total;
}
function findLastFinishedDrivingAbs(asOfAbs){
  let seenRest = false;
  for(let t=asOfAbs-SLOT*60000; t>=asOfAbs-30*DAY_MS; t-=SLOT*60000){
    const act = activityAtAbs(t);
    if(act !== "work") seenRest = true;
    if(seenRest && act === "work") return t + SLOT*60000;
  }
  return null;
}
function findLastMajorRestEndAbs(asOfAbs, majorMins){
  let cur = 0;
  for(let t=asOfAbs-SLOT*60000; t>=asOfAbs-21*DAY_MS; t-=SLOT*60000){
    if(activityAtAbs(t) !== "work"){
      cur += SLOT;
      if(cur >= majorMins){
        return t + cur*60000;
      }
    } else {
      cur = 0;
    }
  }
  return null;
}
function findNextRequiredRestDue(asOfAbs){
  const oldStatsDate = state.selectedDate;
  state.selectedDate = toKey(asOf);
  const scheme = activeRules();
  let earliest = null;
  let reason = "";
  for(const r of scheme.windows){
    let work = countWorkBetweenAbs(asOfAbs - r.minutes*60000, asOfAbs);
    if(work >= r.maxWork){
      return {dueAbs: asOfAbs, reason: `${r.label} work limit reached`};
    }
    let projected = 0;
    for(let t=asOfAbs; t<asOfAbs + 36*60*60000; t+=SLOT*60000){
      const w = countWorkBetweenAbs(t - r.minutes*60000, t) + projected;
      if(w >= r.maxWork){
        if(earliest === null || t < earliest){
          earliest = t;
          reason = `${r.label} limit`;
        }
        break;
      }
      projected += SLOT;
    }
  }
  return {dueAbs: earliest, reason};
}
function calculateCanDriveMinutes(asOfAbs){
  const oldSelectedForCanDrive = state.selectedDate;
  state.selectedDate = absToKeySlot(asOfAbs).key;
  const scheme = activeRules();
  let can = 24*60;
  let limiting = "No limit found in current saved history";
  for(const r of scheme.windows){
    const workNow = countWorkBetweenAbs(asOfAbs - r.minutes*60000, asOfAbs);
    const rem = Math.max(0, r.maxWork - workNow);
    if(rem < can){
      can = rem;
      limiting = `${r.label} window`;
    }
  }
  state.selectedDate = oldSelectedForCanDrive;
  return {minutes: can, reason: limiting};
}
function formatDateTimeForStats(abs){
  if(abs === null || abs === undefined) return "Not found";
  const d = new Date(abs);
  return d.toLocaleDateString("en-AU",{weekday:"short", day:"numeric", month:"short", year:"numeric"}) + " " +
    d.toLocaleTimeString("en-AU",{hour:"numeric", minute:"2-digit"});
}
function formatMinsShort(mins){
  mins = Math.max(0, Math.round(mins));
  const h = Math.floor(mins/60);
  const m = mins%60;
  if(h && m) return `${h}h ${m}m`;
  if(h) return `${h}h`;
  return `${m}m`;
}

function hasAFMInRuleHistoryForDate(key){
  const rec = ruleRecordForDate(key);
  return rec.scheme === "AFM" || rec.coDriverScheme === "AFM";
}
function complianceIssuesForDate(key){
  applyAutoDefaultsToDay(key);
  const detail = ensureDayDetail(key);
  const issues = [];
  const blockers = [];

  if(hasAFMInRuleHistoryForDate(key)){
    blockers.push("AFM is selected. AFM certificate conditions are not entered, so the app cannot safely calculate AFM fatigue limits.");
  }
  if(!detail.driverNameSnapshot && !state.profile.driverName) issues.push("Driver name missing.");
  if(!detail.licenceNumberSnapshot && !state.profile.licenceNumber) issues.push("Licence number missing.");
  if(!detail.baseStateSnapshot && !state.profile.baseTimeZone) issues.push("Base state missing.");
  if(!detail.numberPlate) issues.push("Truck rego / number plate missing.");
  if(!detail.pageNo) issues.push("Page number missing.");

  if(selectedDayIsTwoUp()){
    if(!detail.twoUpDriverName) issues.push("Two-up driver name missing.");
    if(!detail.twoUpLicenceNumber) issues.push("Two-up driver licence missing.");
    if(!detail.twoUpScheme) issues.push("Two-up driver option missing.");
  }

  const rows = syncChangeRowsForDay(key);
  rows.forEach(r => {
    if(r.activity === "rest" && !r.restType){
      issues.push(`Rest type missing at ${r.time}.`);
    }
    if(!r.location && !r.note && rows.length > 1){
      issues.push(`Location/note missing at ${r.time}.`);
    }
  });

  const rec = ruleRecordForDate(key);
  if(!rec || !rec.effectiveDate) issues.push("Rule history missing for this date.");

  return {blockers, issues};
}
function renderComplianceConfidence(){
  const box = $("complianceConfidence");
  if(!box) return;
  const key = state.selectedDate;
  const data = complianceIssuesForDate(key);
  let cls = "safe";
  let title = "Safe to calculate helper checks";
  if(data.blockers.length){
    cls = "blocked";
    title = "Cannot safely calculate";
  } else if(data.issues.length){
    cls = "warning";
    title = "Can calculate with caution";
  }
  box.className = `confidenceBox ${cls}`;
  const list = data.blockers.concat(data.issues).slice(0,12).map(x => `<li>${escapeHtml(x)}</li>`).join("");
  box.innerHTML = `
    <h3>${escapeHtml(title)}</h3>
    <p><strong>Date:</strong> ${escapeHtml(fmtDateLong(key))} • <strong>Mode:</strong> ${escapeHtml(activeSchemeLabel())}</p>
    ${list ? `<ul>${list}</ul>` : `<p>No missing critical information found for this selected page.</p>`}
    <p class="safeCalcNote">If this panel says Cannot safely calculate, do not rely on due-break advice until the missing information is fixed.</p>`;
}

function renderStatistics(){
  const asOf = parseStatsAsOf();
  const asOfAbs = asOf.getTime();
  const scheme = activeRules();
  const input = $("statsAsOf");
  if(input && !input.value) input.value = makeLocalDateTimeValue(asOf);

  const can = calculateCanDriveMinutes(asOfAbs);
  const canCard = $("canDriveCard");
  if(canCard){
    canCard.className = "canDriveCard " + (can.minutes <= 0 ? "bad" : can.minutes <= 30 ? "warn" : "ok");
    canCard.innerHTML = `
      <p class="big">${can.minutes > 0 ? `You can work about ${formatMinsShort(can.minutes)}` : "Rest required now"}</p>
      <p class="sub">Limiting rule: ${escapeHtml(can.reason)}. Based on saved diary blocks up to ${escapeHtml(formatDateTimeForStats(asOfAbs))}.</p>
      ${selectedDayIsTwoUp() ? twoUpRuleWarningHtml() : ""}`;
  }

  const limitCards = $("statsLimitCards");
  if(limitCards){
    limitCards.innerHTML = scheme.windows.map(r => {
      const work = countWorkBetweenAbs(asOfAbs - r.minutes*60000, asOfAbs);
      const rem = Math.max(0, r.maxWork - work);
      const pct = Math.min(100, (work/r.maxWork)*100);
      const bad = work >= r.maxWork;
      return `<div class="statLimit ${bad ? "bad" : ""}">
        <h3><span>${escapeHtml(r.label)} window</span><span>${formatMinsShort(work)} / ${formatMinsShort(r.maxWork)}</span></h3>
        <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
        <p>Remaining: <strong>${formatMinsShort(rem)}</strong> • Required rest: ${escapeHtml(r.rest)}</p>
      </div>`;
    }).join("");
  }

  const restSinceBreak = continuousRestBeforeAbs(asOfAbs);
  const workSinceBreak = continuousWorkBeforeAbs(asOfAbs);
  const lastMajor = findLastMajorRestEndAbs(asOfAbs, scheme.majorRest);
  const workSinceMajor = lastMajor ? countWorkBetweenAbs(lastMajor, asOfAbs) : countWorkBetweenAbs(asOfAbs-DAY_MS, asOfAbs);
  const next7HrDue = lastMajor ? lastMajor + 24*60*60000 : null;
  const next24Due = lastMajor ? lastMajor + 14*DAY_MS : null;  // helper estimate only
  const nextRestDue = findNextRequiredRestDue(asOfAbs);

  const breaks = $("statsBreaksDue");
  if(breaks){
    breaks.innerHTML = `
      <div class="statRow"><strong>Work since last break</strong><span>${formatMinsShort(workSinceBreak)}</span></div>
      <div class="statRow"><strong>Rest since break</strong><span>${formatMinsShort(restSinceBreak)}</span></div>
      <div class="statRow"><strong>Next short rest due</strong><span>${formatDateTimeForStats(nextRestDue.dueAbs)}<small>${escapeHtml(nextRestDue.reason || "Estimated from rolling windows")}</small></span></div>
      <div class="statRow"><strong>Next 7h major rest due</strong><span>${formatDateTimeForStats(next7HrDue)}<small>Helper estimate from last 7h rest block</small></span></div>
      <div class="statRow"><strong>Next 24h break due</strong><span>${formatDateTimeForStats(next24Due)}<small>Approximate long-cycle helper; verify with full legal records</small></span></div>`;
  }

  const work7 = countWorkBetweenAbs(asOfAbs - 7*DAY_MS, asOfAbs);
  const work14 = countWorkBetweenAbs(asOfAbs - 14*DAY_MS, asOfAbs);
  const bfm14Limit = activeRules().max14Work || 144*60; // helper display only
  const longRange = $("statsLongRange");
  if(longRange){
    longRange.innerHTML = `
      <div class="statRow"><strong>Last 24h work</strong><span>${formatMinsShort(countWorkBetweenAbs(asOfAbs-DAY_MS, asOfAbs))}</span></div>
      <div class="statRow"><strong>Last 7 days work</strong><span>${formatMinsShort(work7)}</span></div>
      <div class="statRow"><strong>Last 14 days work</strong><span>${formatMinsShort(work14)}</span></div>
      <div class="statRow"><strong>14-day helper remaining</strong><span>${formatMinsShort(Math.max(0, bfm14Limit-work14))}<small>Uses a simple 144h/14d helper cap; verify against your official record and work option</small></span></div>
      <div class="statRow"><strong>Night/long hours week</strong><span>Coming later<small>Needs exact night/rest history rules and complete records</small></span></div>`;
  }

  const lastFinished = findLastFinishedDrivingAbs(asOfAbs);
  const lastBox = $("statsLastDriving");
  if(lastBox){
    lastBox.innerHTML = lastFinished ? `Last finished driving<br>${escapeHtml(formatDateTimeForStats(lastFinished))}` : "No finished driving found in saved history.";
  }
  state.selectedDate = oldStatsDate;
}

function renderDate(){
  $("dateText").textContent=fmtDateLong(state.selectedDate);
  $("datePicker").value=state.selectedDate;
  $("schemeName").textContent=activeSchemeLabel();
  $("schemeSelect").value=schemeForDate(state.selectedDate);
  $("restAsStationary").checked=!!state.restAsStationary;
  if($("startDate")) $("startDate").value=state.selectedDate;
  if($("endDate")) $("endDate").value=state.selectedDate;
}
function renderTotals(){
  const t=totalsForDay();
  $("totalWork").textContent=minsToHoursText(t.work);
  $("totalRest").textContent=minsToHoursText(t.rest);
}
function renderDriverSettings(){
  ensureProfile();
  $("driverName").value = state.profile.driverName || "";
  $("licenceNumber").value = state.profile.licenceNumber || "";
  $("baseTimeZone").value = state.profile.baseTimeZone || "Local phone time";
}
function renderAll(){
  renderDate();
  renderAlerts();
  renderGrid();
  renderTotals();
  renderRuleCards();
  renderNextBreak();
  renderTodayAdvice();
  renderTimer();
  renderGraphPage();
  renderStatistics();
  renderAuditList();
  renderComplianceConfidence();
  renderAuditFixPanel();
  renderDriverSettings();
  renderBackupReminderSettings();
  renderAuditLog();
}

function loadBFMSample(){
  const d = state.selectedDate;
  const next = addDays(d,1);
  state.slots[d]=Array(SLOTS_PER_DAY).fill("rest");
  state.slots[next]=Array(SLOTS_PER_DAY).fill("rest");
  for(let i=72;i<96;i++) setSlot(d,i,"work");
  for(let i=1;i<11;i++) setSlot(next,i,"work");
  for(let i=12;i<22;i++) setSlot(next,i,"work");
  for(let i=24;i<36;i++) setSlot(next,i,"work");
  state.entries.push({id:Date.now()+"sample2", start:`${d} 18:00`, end:`${next} 00:00`, activity:"work", note:"Sample BFM work"});
  state.entries.push({id:Date.now()+"sample3", start:`${next} 00:00`, end:`${next} 00:15`, activity:"rest", note:"Sample rest"});
  save(); renderAll();
}
function clearSelectedDay(){
  if(confirm("Clear all blocks for selected day?")){
    state.slots[state.selectedDate]=Array(SLOTS_PER_DAY).fill("rest");
    const detail = ensureDayDetail(state.selectedDate);
    detail.changeRows = [];
    save(); renderAll();
  }
}
function clearAll(){
  if(confirm("Clear all saved diary data from this phone/browser?")){
    localStorage.removeItem("truckDiaryPWA");
    state.slots={}; state.entries=[]; state.activeTimer=null;
    state.profile={driverName:"", licenceNumber:"", baseTimeZone:"NSW"};
    state.backupReminder={frequency:"off", lastBackupAt:"", lastPromptDate:""};
    state.dayDetails={};
    state.bookSettings={autoPageNumber:true, carryForwardTwoUp:true, firstPageDate:state.selectedDate || toKey(new Date()), firstPageNumber:"", defaultWorkDiaryNo:"", defaultNumberPlate:"", defaultTwoUp:{enabled:false, twoUpDriverName:"", twoUpLicenceNumber:"", twoUpScheme:"BFM", twoUpBaseState:""}};
    state.settingsHistory=[];
    state.ruleHistory=[];
    save(); renderAll();
  }
}
function exportCsv(){
  ensureProfile();
  const rows=[["driver_name","licence_number","base_time","scheme","selected_date","start","end","activity","note"]];
  state.entries.forEach(e=>rows.push([
    state.profile.driverName || "",
    state.profile.licenceNumber || "",
    state.profile.baseTimeZone || "Local phone time",
    state.scheme,
    state.selectedDate,
    e.start,
    e.end,
    activityLabel(e.activity || ""),
    e.note || ""
  ]));
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=`truck-work-diary-${state.selectedDate}.csv`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportPdf(){
  ensureProfile();
  ensureDayDetail(state.selectedDate);
  renderGraphPage();
  const preview = $("paperSheetPreview").innerHTML;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Work Diary ${state.selectedDate}</title>
  <style>
    @page{size:A4 landscape;margin:5mm}
    html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif}
    .wrap{width:100%;margin:0 auto;background:#fff}
    .pdfBtns{display:flex;gap:8px;padding:8px 10px}
    .pdfBtns button{padding:10px 12px;border:0;border-radius:10px;background:#2c6d5e;color:white;font-weight:800}
    .pdfBtns button+button{background:#eee;color:#111}
    .paperSheet,.realBookSheet{border:0!important;border-radius:0!important;padding:0!important;background:#fff!important;box-shadow:none!important}
    .realDiarySvg{display:block;width:100%;height:auto;background:#fff}
    @media print{.pdfBtns{display:none}.wrap{width:100%}.realDiarySvg{width:100%;height:auto}}
  </style></head><body>
    <div class="wrap">
      <div class="pdfBtns"><button onclick="window.print()">Print / Save as PDF</button><button onclick="if(window.opener){window.close()}else{history.back()}">Close / Back to app</button></div>
      ${preview}
    </div>
    <script>setTimeout(()=>window.print(), 500)<\/script>
  </body></html>`;
  const w = window.open("", "_blank");
  if(!w){
    alert("Popup blocked. Please allow popups, then try PDF export again.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}


function ensureBackupReminder(){
  if(!state.backupReminder) state.backupReminder = {};
  if(!state.backupReminder.frequency) state.backupReminder.frequency = "off";
  if(!state.backupReminder.lastBackupAt) state.backupReminder.lastBackupAt = "";
  if(!state.backupReminder.lastPromptDate) state.backupReminder.lastPromptDate = "";
}
function daysSinceBackup(){
  ensureBackupReminder();
  if(!state.backupReminder.lastBackupAt) return 9999;
  const last = new Date(state.backupReminder.lastBackupAt);
  if(isNaN(last)) return 9999;
  return Math.floor((Date.now() - last.getTime()) / DAY_MS);
}
function backupReminderDue(){
  ensureBackupReminder();
  const freq = state.backupReminder.frequency;
  if(freq === "off") return false;
  const days = daysSinceBackup();
  if(freq === "daily") return days >= 1;
  if(freq === "weekly") return days >= 7;
  return false;
}
function renderBackupReminderSettings(){
  ensureBackupReminder();
  const select = $("backupReminderFrequency");
  const status = $("backupReminderStatus");
  if(!select || !status) return;
  select.value = state.backupReminder.frequency || "off";
  if(state.backupReminder.frequency === "off"){
    status.textContent = "Backup reminder: Off";
  } else if(state.backupReminder.lastBackupAt){
    const last = new Date(state.backupReminder.lastBackupAt).toLocaleString("en-AU");
    status.textContent = `Backup reminder: ${state.backupReminder.frequency}. Last JSON backup: ${last}`;
  } else {
    status.textContent = `Backup reminder: ${state.backupReminder.frequency}. No JSON backup recorded yet.`;
  }
}
function saveBackupReminderSetting(){
  ensureBackupReminder();
  state.backupReminder.frequency = $("backupReminderFrequency").value;
  save();
  renderBackupReminderSettings();
}
function maybeShowBackupReminder(){
  ensureBackupReminder();
  if(!backupReminderDue()) return;
  const today = toKey(new Date());
  if(state.backupReminder.lastPromptDate === today) return;
  state.backupReminder.lastPromptDate = today;
  save();
  setTimeout(()=>{
    if(confirm("Backup reminder: your JSON backup is due. Share / Save Backup JSON now?")){
      shareJsonBackup();
    }
  }, 700);
}


function buildJsonBackup(){
  ensureProfile();
  ensureBackupReminder();
  return {
    app: "Truck Work Diary Checker",
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    selectedDate: state.selectedDate,
    scheme: state.scheme,
    restAsStationary: state.restAsStationary,
    slots: state.slots || {},
    entries: state.entries || [],
    profile: state.profile || {},
    dayDetails: state.dayDetails || {},
    bookSettings: state.bookSettings || {},
    settingsHistory: state.settingsHistory || [],
    ruleHistory: state.ruleHistory || [],
    auditLog: state.auditLog || [],
    backupReminder: state.backupReminder || {},
    note: "Personal backup file for restoring this app data. Keep this file private."
  };
}
function backupFilename(){
  return `truck-work-diary-backup-${state.selectedDate}.json`;
}
function markJsonBackupDone(){
  ensureBackupReminder();
  state.backupReminder.lastBackupAt = new Date().toISOString();
  save();
  renderBackupReminderSettings();
}
async function shareJsonBackup(){
  const backup = buildJsonBackup();
  backup.backupReminder.lastBackupAt = new Date().toISOString();
  const json = JSON.stringify(backup, null, 2);
  const file = new File([json], backupFilename(), {type:"application/json"});
  try{
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({
        files:[file],
        title:"Truck Work Diary Backup",
        text:"Save this JSON backup somewhere safe."
      });
      state.backupReminder.lastBackupAt = backup.backupReminder.lastBackupAt;
      save();
      renderBackupReminderSettings();
    } else {
      alert("Share / Save is not supported on this browser. The normal download backup will start instead.");
      exportJsonBackup();
    }
  }catch(e){
    if(e && (e.name === "AbortError" || e.name === "NotAllowedError")){
      return;
    }
    alert("Share / Save failed. The normal download backup will start instead.");
    exportJsonBackup();
  }
}

function exportJsonBackup(){
  const backup = buildJsonBackup();
  markJsonBackupDone();
  backup.backupReminder = state.backupReminder;
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFilename();
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

function importJsonBackupFromFile(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const backup = JSON.parse(reader.result);
      if(!backup || backup.app !== "Truck Work Diary Checker"){
        alert("This does not look like a valid Truck Work Diary backup file.");
        return;
      }
      if(!confirm("Import this backup? This will replace the app data currently saved on this phone.")){
        return;
      }
      state.selectedDate = backup.selectedDate || toKey(new Date());
      state.scheme = backup.scheme || "BFM";
      state.restAsStationary = backup.restAsStationary !== undefined ? !!backup.restAsStationary : true;
      state.slots = backup.slots || {};
      state.entries = Array.isArray(backup.entries) ? backup.entries : [];
      state.activeTimer = null;
      state.profile = backup.profile || {driverName:"", licenceNumber:"", baseTimeZone:"NSW"};
      state.dayDetails = backup.dayDetails || {};
      state.bookSettings = backup.bookSettings || state.bookSettings || {};
      state.settingsHistory = backup.settingsHistory || [];
      state.ruleHistory = backup.ruleHistory || [];
      state.auditLog = backup.auditLog || [];
      state.backupReminder = backup.backupReminder || state.backupReminder || {frequency:"off", lastBackupAt:"", lastPromptDate:""};
      ensureProfile();
      ensureBackupReminder();
      ensureDayDetailsContainer();
      ensureBookSettings();
      save();
      renderAll();
      addAuditLog("JSON backup imported", "Backup imported and replaced local app data."); save(); alert("Backup imported successfully.");
    }catch(e){
      alert("Could not import backup. Please select a valid JSON backup file.");
    }finally{
      const input = $("jsonImportFile");
      if(input) input.value = "";
    }
  };
  reader.readAsText(file);
}

function saveDriverSettings(){
  ensureProfile();
  state.profile.driverName = $("driverName").value.trim();
  state.profile.licenceNumber = $("licenceNumber").value.trim();
  state.profile.baseTimeZone = $("baseTimeZone").value;
  const effectiveDate = $("settingsEffectiveDate") ? $("settingsEffectiveDate").value || state.selectedDate : state.selectedDate;
  saveSettingsRecord(effectiveDate);
  updateFutureDailyDetailsFromEffectiveDate(effectiveDate);
  save();
  renderAll();
  addAuditLog("Driver/base details changed", `Effective from ${effectiveDate}`); save(); alert(`Driver/base details saved from ${effectiveDate}. Previous pages stay unchanged.`);
}


function startTimer(activity){
  if(state.activeTimer && !confirm("Stop current timer and start a new one?")) return;
  state.activeTimer={activity, startISO:new Date().toISOString()};
  save();
  renderAll();
}
function stopTimer(){
  if(!state.activeTimer){
    alert("No active timer.");
    return;
  }
  const start=new Date(state.activeTimer.startISO);
  const end=new Date();
  const roundedStart = new Date(Math.floor(start.getTime()/(SLOT*60000))*(SLOT*60000));
  const roundedEnd = new Date(Math.ceil(end.getTime()/(SLOT*60000))*(SLOT*60000));
  for(let t=roundedStart.getTime(); t<roundedEnd.getTime(); t+=SLOT*60000){
    const {key,slot}=absToKeySlot(t);
    setSlot(key,slot,state.activeTimer.activity);
  }
  addEntryRecord(
    toKey(roundedStart),
    roundedStart.getHours()*60+roundedStart.getMinutes(),
    toKey(roundedEnd),
    roundedEnd.getHours()*60+roundedEnd.getMinutes(),
    state.activeTimer.activity,
    "Live timer"
  );
  state.selectedDate=toKey(roundedStart);
  state.activeTimer=null;
  save();
  renderAll();
}

function setup(){
  load();
  $("prevDay").onclick=()=>{state.selectedDate=addDays(state.selectedDate,-1);save();renderAll();}
  $("nextDay").onclick=()=>{state.selectedDate=addDays(state.selectedDate,1);save();renderAll();}
  $("todayBtn").onclick=()=>{state.selectedDate=toKey(new Date());save();renderAll();}
  $("dateText").onclick=()=>$("datePicker").showPicker ? $("datePicker").showPicker() : $("datePicker").click();
  $("datePicker").onchange=e=>{state.selectedDate=e.target.value;save();renderAll();}
  if($("addEntry")) $("addEntry").onclick=addEntryFromForm;
  if($("quickBFM")) $("quickBFM").onclick=loadBFMSample;
  $("schemeSelect").onchange=e=>{
    state.scheme=e.target.value;
    if($("ruleMyScheme")) $("ruleMyScheme").value = e.target.value;
    save();
    renderAll();
  }
  $("restAsStationary").onchange=e=>{state.restAsStationary=e.target.checked;save();renderAll();}
  if($("saveRuleHistory")) $("saveRuleHistory").onclick=saveRuleHistorySetting;
  $("exportCsv").onclick=exportCsv;
  $("exportPdf").onclick=exportPdf;
  $("exportJsonBackup").onclick=exportJsonBackup;
  $("shareJsonBackup").onclick=shareJsonBackup;
  $("importJsonBackup").onclick=()=>$("jsonImportFile").click();
  $("jsonImportFile").onchange=e=>importJsonBackupFromFile(e.target.files[0]);
  $("backupReminderFrequency").onchange=saveBackupReminderSetting;
  $("statsNowBtn").onclick=setStatsAsOfNow;
  $("statsAsOf").onchange=renderStatistics;
  $("saveDriverSettings").onclick=saveDriverSettings;
  if($("unlockPageEdit")) $("unlockPageEdit").onchange=renderPageOverrideForm;
  if($("saveSelectedPageOnly")) $("saveSelectedPageOnly").onclick=saveSelectedPageOnly;
  if($("restoreSelectedPageDefaults")) $("restoreSelectedPageDefaults").onclick=restoreSelectedPageDefaults;
  $("saveBookSettings").onclick=saveBookSettings;
  if($("graphDetailsForm")){
    $("graphDetailsForm").addEventListener("input", updateDayDetailFromGraphForm);
    $("graphDetailsForm").addEventListener("change", updateDayDetailFromGraphForm);
  }
  if($("changeDetailsEditor")) $("changeDetailsEditor").addEventListener("input", handleChangeDetailsInput);
  $("clearDay").onclick=clearSelectedDay;
  $("clearAll").onclick=clearAll;
  if($("clearAuditLog")) $("clearAuditLog").onclick=clearAuditLogOnly;
  $("startWorkBtn").onclick=()=>startTimer("work");
  $("startRestBtn").onclick=()=>startTimer("rest");
  $("stopTimerBtn").onclick=stopTimer;

  document.querySelectorAll(".tabbar button").forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll(".tabbar button").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
      $(btn.dataset.tab).classList.add("active");
      $("screenTitle").textContent = btn.querySelector("span").textContent;
      if(btn.dataset.tab === "graphScreen"){
        renderGraphPage();
      }
      if(btn.dataset.tab === "statsScreen"){
        renderStatistics();
      }
      if(btn.dataset.tab === "drivingScreen"){
        renderAuditList();
      }
      renderTimer();
    };
  });

  setupSwipePainting();
  if($("statsAsOf")) $("statsAsOf").value = makeLocalDateTimeValue(new Date());
  setInterval(renderTimer, 30000);
  setInterval(()=>{ $("fakeTime").textContent=new Date().toLocaleTimeString("en-AU",{hour:"numeric",minute:"2-digit"}); }, 30000);
  renderAll();
  maybeShowBackupReminder();
}

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js").catch(()=>{}));
}
setup();
