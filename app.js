const APP_SCHEMA_VERSION = 28;
const APP_BUILD_NAME = "required-rest-highlight-fix";
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
  auditLog: [],
  dismissedAudit: {},
  vehicles: [],
  savedDrivers: [],
  registrySettings: {autoSaveFromDiary:true},
  uiSettings: {locationPickerEnabled:true},
  diaryBooks: [],
  calculationHistory: {startDate:"", mode:"noWorkBeforeStart"},
  shortBreakSettings: {mode:"smart", maxMinutes:60}
};

const $ = id => document.getElementById(id);
let auditFocus = null;

let toastTimer = null;
function showToast(message="Saved"){
  const el = $("toastMessage");
  if(!el){
    console.log(message);
    return;
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.classList.remove("show"), 1400);
}


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


function enforceUppercaseOnly(e){
  const el = e.target;
  if(!el || !el.dataset || el.dataset.uppercaseOnly !== "true") return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const upper = String(el.value || "").toUpperCase();
  if(el.value !== upper){
    el.value = upper;
    try{ el.setSelectionRange(start, end); }catch(err){}
  }
}

function enforceNumericOnly(e){
  const el = e.target;
  if(!el || !el.dataset || el.dataset.numericOnly !== "true") return;
  if(el.dataset.pageNumberOnly === "true") return;
  const cleaned = String(el.value || "").replace(/\D+/g, "");
  if(el.value !== cleaned) el.value = cleaned;
}


function cleanPageNumberTyping(value){
  return String(value || "").replace(/[^\d ]+/g, "").replace(/ {2,}/g, " ");
}
function cleanPageNumberInput(value){
  return String(value || "").replace(/[^\d ]+/g, "").replace(/\s+/g, " ").trim();
}
function pageNumberDigits(value){
  return String(value || "").replace(/\D+/g, "");
}
function samePageNumber(a,b){
  const ad = pageNumberDigits(a);
  const bd = pageNumberDigits(b);
  if(ad && bd) return ad === bd;
  return cleanPageNumberInput(a) === cleanPageNumberInput(b);
}
function formatPageNumberLikeTemplate(value, template){
  const digits = pageNumberDigits(value);
  const tpl = cleanPageNumberInput(template);
  if(!digits || !tpl.includes(" ")) return digits;
  const lengths = tpl.split(" ").map(part => pageNumberDigits(part).length).filter(Boolean);
  if(lengths.length < 2) return digits;
  const groups = [];
  let pos = digits.length;
  for(let i=lengths.length-1; i>=1; i--){
    const len = lengths[i];
    const start = Math.max(0, pos - len);
    groups.unshift(digits.slice(start, pos));
    pos = start;
  }
  groups.unshift(digits.slice(0, pos));
  return groups.filter(Boolean).join(" ");
}

function cleanWorkDiaryNoTyping(value){
  return String(value || "").toUpperCase().replace(/[^A-Z0-9 ]+/g, "").replace(/ {2,}/g, " ");
}
function cleanWorkDiaryNoInput(value){
  return cleanWorkDiaryNoTyping(value).replace(/\s+/g, " ").trim();
}
function enforceWorkDiaryNoOnly(e){
  const el = e.target;
  if(!el || !el.dataset || el.dataset.workDiaryNo !== "true") return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const cleaned = cleanWorkDiaryNoTyping(el.value);
  if(el.value !== cleaned){
    el.value = cleaned;
    try{ el.setSelectionRange(Math.min(start, cleaned.length), Math.min(end, cleaned.length)); }catch(err){}
  }
}

function enforcePageNumberOnly(e){
  const el = e.target;
  if(!el || !el.dataset || el.dataset.pageNumberOnly !== "true") return;
  const start = el.selectionStart;
  const cleaned = cleanPageNumberTyping(el.value);
  if(el.value !== cleaned){
    el.value = cleaned;
    try{ el.setSelectionRange(Math.min(start, cleaned.length), Math.min(start, cleaned.length)); }catch(err){}
  }
}



function ensureDismissedAudit(){
  if(!state.dismissedAudit || typeof state.dismissedAudit !== "object") state.dismissedAudit = {};
}
function auditIgnoreKey(kind, date, extra){
  return `${kind}|${date}|${extra || ""}`;
}
function isAuditDismissed(kind, date, extra){
  ensureDismissedAudit();
  ensureRegistries();
  ensureUiSettings();
  return !!state.dismissedAudit[auditIgnoreKey(kind,date,extra)];
}
function dismissOptionalAudit(kind, date, extra, label){
  ensureDismissedAudit();
  const key = auditIgnoreKey(kind,date,extra);
  state.dismissedAudit[key] = {
    kind,
    date,
    extra: extra || "",
    label: label || "Optional audit item",
    at: new Date().toISOString()
  };
  addAuditLog("Audit item marked not required", `${date}: ${label || kind}`);
  save();
  renderAuditList();
  renderAuditLog();
}
function restoreOptionalAudit(key){
  ensureDismissedAudit();
  delete state.dismissedAudit[key];
  addAuditLog("Optional audit item restored", key);
  save();
  renderAuditList();
  renderAuditLog();
}
function dismissedOptionalAuditHtml(){
  ensureDismissedAudit();
  const items = Object.entries(state.dismissedAudit || {}).slice(0,30);
  if(!items.length) return "";
  return `<div class="dismissedAuditBox"><strong>Optional items marked Not required:</strong><br>
    ${items.map(([k,v])=>`${escapeHtml(v.date || "")}: ${escapeHtml(v.label || v.kind || "")} <button type="button" onclick="restoreOptionalAudit('${escapeHtml(k)}')">Show again</button>`).join("<br>")}
  </div>`;
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
  if(typeof isPageCancelledOrSkipped === "function" && isPageCancelledOrSkipped(key)){
    return;
  }
  getDaySlots(key)[idx] = val;
  if(val === "work") ensureDayDetail(key).usePage = true;
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
  if(!state.profile.baseTimeZone || state.profile.baseTimeZone === "Local phone time") state.profile.baseTimeZone = "NSW";
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
  recomputeAutoPageNumbers();
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
    pageStatus: "active",
    pageStatusReason: "",
    usePage: false,
    usePageManual: false,
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


function safeClone(obj){
  try{return JSON.parse(JSON.stringify(obj || {}));}catch(e){return {};}
}
function normalizeDayDetailForMigration(d){
  const base = defaultDayDetail();
  const out = {...base, ...(d || {})};
  if(!Array.isArray(out.changeRows)) out.changeRows = [];
  out.pageStatus = out.pageStatus || "active";
  out.pageStatusReason = out.pageStatusReason || "";
  out.pageNo = cleanPageNumberInput(out.pageNo);
  out.workDiaryNo = cleanWorkDiaryNoInput(out.workDiaryNo);
  out.twoUpScheme = out.twoUpScheme || "BFM";
  out.numberPlate = (out.numberPlate || "").toUpperCase();
  out.twoUpLicenceNumber = (out.twoUpLicenceNumber || "").replace(/\D+/g, "");
  out.licenceNumberSnapshot = (out.licenceNumberSnapshot || "").replace(/\D+/g, "");
  out.changeRows = out.changeRows.map(r => ({
    time: r.time || "",
    activity: r.activity || "rest",
    noDetails: !!r.noDetails,
    autoNoDetails: !!r.autoNoDetails,
    autoReason: r.autoReason || "",
    odometer: String(r.odometer || "").replace(/\D+/g, ""),
    location: r.location || "",
    note: r.note || "",
    restType: r.restType || (r.activity === "work" ? "work" : "")
  }));
  return out;
}
function migrateImportedBackup(backup){
  const b = safeClone(backup);
  const migrated = {
    selectedDate: b.selectedDate || toKey(new Date()),
    scheme: b.scheme || "BFM",
    restAsStationary: b.restAsStationary !== undefined ? !!b.restAsStationary : true,
    slots: b.slots && typeof b.slots === "object" ? b.slots : {},
    entries: Array.isArray(b.entries) ? b.entries : [],
    profile: b.profile || {},
    dayDetails: b.dayDetails && typeof b.dayDetails === "object" ? b.dayDetails : {},
    bookSettings: b.bookSettings || {},
    settingsHistory: Array.isArray(b.settingsHistory) ? b.settingsHistory : [],
    ruleHistory: Array.isArray(b.ruleHistory) ? b.ruleHistory : [],
    auditLog: Array.isArray(b.auditLog) ? b.auditLog : [],
    dismissedAudit: b.dismissedAudit && typeof b.dismissedAudit === "object" ? b.dismissedAudit : {},
    vehicles: Array.isArray(b.vehicles) ? b.vehicles : [],
    savedDrivers: Array.isArray(b.savedDrivers) ? b.savedDrivers : [],
    registrySettings: b.registrySettings && typeof b.registrySettings === "object" ? b.registrySettings : {autoSaveFromDiary:true},
    uiSettings: b.uiSettings && typeof b.uiSettings === "object" ? b.uiSettings : {locationPickerEnabled:true},
    diaryBooks: Array.isArray(b.diaryBooks) ? b.diaryBooks : [],
    calculationHistory: b.calculationHistory && typeof b.calculationHistory === "object" ? b.calculationHistory : {},
    shortBreakSettings: b.shortBreakSettings && typeof b.shortBreakSettings === "object" ? b.shortBreakSettings : {mode:"smart", maxMinutes:60},
    backupReminder: b.backupReminder || {},
    schemaVersion: b.schemaVersion || b.backupVersion || 1
  };

  Object.keys(migrated.slots).forEach(key => {
    const arr = Array.isArray(migrated.slots[key]) ? migrated.slots[key] : [];
    migrated.slots[key] = Array.from({length:SLOTS_PER_DAY}, (_,i) => arr[i] === "work" ? "work" : "rest");
  });

  Object.keys(migrated.dayDetails).forEach(key => {
    migrated.dayDetails[key] = normalizeDayDetailForMigration(migrated.dayDetails[key]);
  });

  migrated.profile.driverName = migrated.profile.driverName || "";
  migrated.profile.licenceNumber = (migrated.profile.licenceNumber || "").replace(/\D+/g, "");
  migrated.profile.baseTimeZone = migrated.profile.baseTimeZone || "NSW";
  migrated.bookSettings = {
    autoPageNumber: migrated.bookSettings.autoPageNumber !== undefined ? !!migrated.bookSettings.autoPageNumber : true,
    carryForwardTwoUp: migrated.bookSettings.carryForwardTwoUp !== undefined ? !!migrated.bookSettings.carryForwardTwoUp : true,
    firstPageDate: migrated.bookSettings.firstPageDate || migrated.selectedDate,
    firstPageNumber: migrated.bookSettings.firstPageNumber || "",
    defaultWorkDiaryNo: cleanWorkDiaryNoInput(migrated.bookSettings.defaultWorkDiaryNo || ""),
    defaultNumberPlate: (migrated.bookSettings.defaultNumberPlate || "").toUpperCase(),
    defaultTwoUp: migrated.bookSettings.defaultTwoUp || {enabled:false, twoUpDriverName:"", twoUpLicenceNumber:"", twoUpScheme:"BFM", twoUpBaseState:""}
  };
  migrated.bookSettings.defaultTwoUp.twoUpLicenceNumber = (migrated.bookSettings.defaultTwoUp.twoUpLicenceNumber || "").replace(/\D+/g, "");
  migrated.diaryBooks = migrated.diaryBooks.map(normalizeDiaryBook);
  migrated.calculationHistory = migrated.calculationHistory && typeof migrated.calculationHistory === "object" ? migrated.calculationHistory : {};
  migrated.calculationHistory.startDate = migrated.calculationHistory.startDate || migrated.bookSettings.firstPageDate || migrated.selectedDate;
  migrated.calculationHistory.mode = ["noWorkBeforeStart","unknown","imported"].includes(migrated.calculationHistory.mode) ? migrated.calculationHistory.mode : "noWorkBeforeStart";
  migrated.shortBreakSettings = migrated.shortBreakSettings && typeof migrated.shortBreakSettings === "object" ? migrated.shortBreakSettings : {mode:"smart", maxMinutes:60};
  migrated.shortBreakSettings.mode = ["manual","smart","strict"].includes(migrated.shortBreakSettings.mode) ? migrated.shortBreakSettings.mode : "smart";
  migrated.shortBreakSettings.maxMinutes = [15,30,45,60].includes(Number(migrated.shortBreakSettings.maxMinutes)) ? Number(migrated.shortBreakSettings.maxMinutes) : 60;
  migrated.backupReminder.frequency = migrated.backupReminder.frequency || "off";
  migrated.backupReminder.lastBackupAt = migrated.backupReminder.lastBackupAt || "";
  migrated.backupReminder.lastPromptDate = migrated.backupReminder.lastPromptDate || "";
  return migrated;
}
function migrateCurrentState(){
  const migrated = migrateImportedBackup(state || {});
  state = {...state, ...migrated};
  ensureProfile();
  ensureBackupReminder();
  ensureDayDetailsContainer();
  ensureBookSettings();
  ensureDiaryBooks();
  ensureCalculationHistory();
  if(typeof ensureSettingsHistory === "function") ensureSettingsHistory();
  if(typeof ensureRuleHistory === "function") ensureRuleHistory();
  if(!Array.isArray(state.auditLog)) state.auditLog = [];
  state.schemaVersion = APP_SCHEMA_VERSION;
}
function checkDataHealth(){
  migrateCurrentState();
  save();
  const status = $("dataHealthStatus");
  const dates = Object.keys(state.slots || {}).length;
  const detailDates = Object.keys(state.dayDetails || {}).length;
  const msg = `Data OK. Schema v${APP_SCHEMA_VERSION}. Saved block days: ${dates}. Detail pages: ${detailDates}. Older backups will be migrated on import.`;
  if(status) status.textContent = msg;
  alert(msg);
}




function ensureUiSettings(){
  if(!state.uiSettings || typeof state.uiSettings !== "object") state.uiSettings = {};
  if(state.uiSettings.locationPickerEnabled === undefined) state.uiSettings.locationPickerEnabled = true;
}
function renderUiSettings(){
  ensureUiSettings();
  if($("locationPickerEnabled")) $("locationPickerEnabled").checked = !!state.uiSettings.locationPickerEnabled;
  document.body.classList.toggle("location-picker-off", !state.uiSettings.locationPickerEnabled);
}
function toggleLocationPickerEnabled(){
  ensureUiSettings();
  state.uiSettings.locationPickerEnabled = !!$("locationPickerEnabled").checked;
  save();
  renderUiSettings();
  if(typeof showToast === "function") showToast("Saved");
}

function ensureRegistries(){
  if(!Array.isArray(state.vehicles)) state.vehicles = [];
  if(!Array.isArray(state.savedDrivers)) state.savedDrivers = [];
}
function makeId(prefix){
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
}
let editingVehicleId = null;
let editingDriverId = null;

function activeVehicleRecords(){
  ensureRegistries();
  return state.vehicles.filter(v => !v.deleted).sort((a,b)=>String(a.rego||"").localeCompare(String(b.rego||"")));
}
function activeSavedDriverRecords(){
  ensureRegistries();
  return state.savedDrivers.filter(d => !d.deleted).sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));
}
function renderVehicleDriverRegistry(){
  ensureRegistries();
  ensureRegistrySettings();
  if($("autoSaveRegistryFromDiary")) $("autoSaveRegistryFromDiary").checked = !!state.registrySettings.autoSaveFromDiary;
  const vehicleList = $("vehicleList");
  if(vehicleList){
    const vehicles = activeVehicleRecords();
    vehicleList.innerHTML = vehicles.length ? vehicles.map(v => `
      <button class="registryItem" data-edit-vehicle="${escapeHtml(v.id)}">
        <span>
          <strong>${escapeHtml(v.rego || "No rego")}</strong>
          <small>${escapeHtml([v.name, v.company, v.state].filter(Boolean).join(" • ") || "Vehicle details")}</small>${v.firstSeenDate || v.lastSeenDate ? `<small class="autoSavedMeta">Seen: ${escapeHtml(v.firstSeenDate || "?")} to ${escapeHtml(v.lastSeenDate || v.firstSeenDate || "?")}</small>` : ""}
        </span>
        <span class="registryChevron">›</span>
      </button>`).join("") : `<p class="hint">No vehicles saved yet. Tap + Vehicle.</p>`;
    vehicleList.querySelectorAll("[data-edit-vehicle]").forEach(btn=>{
      btn.onclick = () => openVehicleEditor(btn.dataset.editVehicle);
    });
  }
  const driverList = $("savedDriverList");
  if(driverList){
    const drivers = activeSavedDriverRecords();
    driverList.innerHTML = drivers.length ? drivers.map(d => `
      <button class="registryItem" data-edit-driver="${escapeHtml(d.id)}">
        <span>
          <strong>${escapeHtml(d.name || "No name")}</strong>
          <small>${escapeHtml([d.role === "twoUp" ? "Two-up driving partner" : d.role === "main" ? "Main driver information" : "Driver", d.scheme, d.licence ? "Licence "+d.licence : "", d.licenceState].filter(Boolean).join(" • "))}</small>${d.firstSeenDate || d.lastSeenDate ? `<small class="autoSavedMeta">Seen: ${escapeHtml(d.firstSeenDate || "?")} to ${escapeHtml(d.lastSeenDate || d.firstSeenDate || "?")}</small>` : ""}
        </span>
        <span class="registryChevron">›</span>
      </button>`).join("") : `<p class="hint">No drivers saved yet. Tap + Driver.</p>`;
    driverList.querySelectorAll("[data-edit-driver]").forEach(btn=>{
      btn.onclick = () => openSavedDriverEditor(btn.dataset.editDriver);
    });
  }
}
function openVehicleEditor(id=null){
  ensureRegistries();
  editingVehicleId = id;
  const v = id ? state.vehicles.find(x=>x.id===id) : null;
  $("vehicleEditTitle").textContent = id ? "Edit vehicle" : "Add vehicle";
  $("vehicleRego").value = (v && v.rego || "").toUpperCase();
  $("vehicleName").value = v && v.name || "";
  $("vehicleCompany").value = v && v.company || "";
  $("vehicleState").value = v && v.state || "";
  $("vehicleStartDate").value = v && v.startDate || state.selectedDate || "";
  $("vehicleEndDate").value = v && v.endDate || "";
  $("vehicleNotes").value = v && v.notes || "";
  $("deleteVehicleBtn").style.display = id ? "" : "none";
  $("vehicleEditCard").hidden = false;
  $("vehicleEditCard").scrollIntoView({behavior:"smooth", block:"start"});
}
function closeVehicleEditor(){
  editingVehicleId = null;
  if($("vehicleEditCard")) $("vehicleEditCard").hidden = true;
}
function saveVehicleRecord(){
  ensureRegistries();
  const rec = {
    id: editingVehicleId || makeId("veh"),
    rego: $("vehicleRego").value.trim().toUpperCase(),
    name: $("vehicleName").value.trim(),
    company: $("vehicleCompany").value.trim(),
    state: $("vehicleState").value,
    startDate: $("vehicleStartDate").value,
    endDate: $("vehicleEndDate").value,
    notes: $("vehicleNotes").value.trim(),
    updatedAt: new Date().toISOString()
  };
  if(!rec.rego){
    alert("Please enter vehicle rego.");
    return;
  }
  const idx = state.vehicles.findIndex(x=>x.id===rec.id);
  if(idx >= 0) state.vehicles[idx] = {...state.vehicles[idx], ...rec};
  else state.vehicles.push(rec);
  addAuditLog("Vehicle saved", rec.rego);
  save();
  renderVehicleDriverRegistry();
  closeVehicleEditor();
  if(typeof showToast === "function") showToast("Saved");
}
function applyVehicleToCurrentPage(){
  ensureRegistries();
  const rego = $("vehicleRego").value.trim().toUpperCase();
  if(!rego){
    alert("Please enter vehicle rego first.");
    return;
  }
  const detail = ensureDayDetail(state.selectedDate);
  detail.numberPlate = rego;
  detail.numberPlateManual = true;
  addAuditLog("Vehicle applied to page", `${state.selectedDate}: ${rego}`);
  save();
  renderAll();
  closeVehicleEditor();
  if(typeof showToast === "function") showToast("Vehicle applied");
}
function deleteVehicleRecord(){
  if(!editingVehicleId) return;
  const v = state.vehicles.find(x=>x.id===editingVehicleId);
  if(!v) return;
  if(confirm(`Delete vehicle ${v.rego || ""}?`)){
    v.deleted = true;
    v.updatedAt = new Date().toISOString();
    addAuditLog("Vehicle deleted", v.rego || editingVehicleId);
    save();
    renderVehicleDriverRegistry();
    closeVehicleEditor();
    if(typeof showToast === "function") showToast("Deleted");
  }
}

function openSavedDriverEditor(id=null){
  ensureRegistries();
  editingDriverId = id;
  const d = id ? state.savedDrivers.find(x=>x.id===id) : null;
  $("driverEditTitle").textContent = id ? "Edit driver" : "Add driver";
  $("savedDriverName").value = d && d.name || "";
  $("savedDriverLicence").value = d && d.licence || "";
  $("savedDriverState").value = d && d.licenceState || "";
  $("savedDriverScheme").value = d && d.scheme || "Standard";
  $("savedDriverAccred").value = d && d.accreditationNo || "";
  $("savedDriverRole").value = d && d.role || "twoUp";
  $("savedDriverStartDate").value = d && d.startDate || state.selectedDate || "";
  $("savedDriverEndDate").value = d && d.endDate || "";
  $("savedDriverNotes").value = d && d.notes || "";
  $("deleteSavedDriverBtn").style.display = id ? "" : "none";
  $("driverEditCard").hidden = false;
  $("driverEditCard").scrollIntoView({behavior:"smooth", block:"start"});
}
function closeSavedDriverEditor(){
  editingDriverId = null;
  if($("driverEditCard")) $("driverEditCard").hidden = true;
}
function saveSavedDriverRecord(){
  ensureRegistries();
  const rec = {
    id: editingDriverId || makeId("drv"),
    name: $("savedDriverName").value.trim(),
    licence: $("savedDriverLicence").value.replace(/\D+/g, ""),
    licenceState: $("savedDriverState").value,
    scheme: $("savedDriverScheme").value || "Standard",
    accreditationNo: $("savedDriverAccred").value.trim(),
    role: $("savedDriverRole").value || "twoUp",
    startDate: $("savedDriverStartDate").value,
    endDate: $("savedDriverEndDate").value,
    notes: $("savedDriverNotes").value.trim(),
    updatedAt: new Date().toISOString()
  };
  if(!rec.name){
    alert("Please enter driver name.");
    return;
  }
  const idx = state.savedDrivers.findIndex(x=>x.id===rec.id);
  if(idx >= 0) state.savedDrivers[idx] = {...state.savedDrivers[idx], ...rec};
  else state.savedDrivers.push(rec);
  addAuditLog("Driver saved", rec.name);
  save();
  renderVehicleDriverRegistry();
  closeSavedDriverEditor();
  if(typeof showToast === "function") showToast("Saved");
}
function applySavedDriverAsTwoUp(){
  ensureRegistries();
  const name = $("savedDriverName").value.trim();
  if(!name){
    alert("Please enter driver name first.");
    return;
  }
  const detail = ensureDayDetail(state.selectedDate);
  detail.twoUpEnabled = true;
  detail.driverMode = "twoUp";
  detail.twoUpDriverName = name;
  detail.twoUpLicenceNumber = $("savedDriverLicence").value.replace(/\D+/g, "");
  detail.twoUpBaseState = $("savedDriverState").value || detail.twoUpBaseState || detail.baseStateSnapshot || "";
  detail.twoUpScheme = $("savedDriverScheme").value || "Standard";
  detail.twoUpManual = true;
  addAuditLog("Two-up driver applied to page", `${state.selectedDate}: ${name}`);
  save();
  renderAll();
  closeSavedDriverEditor();
  if(typeof showToast === "function") showToast("Two-up driver applied");
}
function deleteSavedDriverRecord(){
  if(!editingDriverId) return;
  const d = state.savedDrivers.find(x=>x.id===editingDriverId);
  if(!d) return;
  if(confirm(`Delete driver ${d.name || ""}?`)){
    d.deleted = true;
    d.updatedAt = new Date().toISOString();
    addAuditLog("Driver deleted", d.name || editingDriverId);
    save();
    renderVehicleDriverRegistry();
    closeSavedDriverEditor();
    if(typeof showToast === "function") showToast("Deleted");
  }
}

function ensureRegistrySettings(){
  if(!state.registrySettings || typeof state.registrySettings !== "object"){
    state.registrySettings = {autoSaveFromDiary:true};
  }
  if(state.registrySettings.autoSaveFromDiary === undefined){
    state.registrySettings.autoSaveFromDiary = true;
  }
}
function normaliseDriverKey(name, licence){
  const lic = String(licence || "").replace(/\D+/g, "");
  if(lic) return `lic:${lic}`;
  return `name:${String(name || "").trim().toLowerCase().replace(/\s+/g," ")}`;
}
function upsertVehicleFromDiary(detail, key){
  ensureRegistries();
  const rego = String(detail.numberPlate || "").trim().toUpperCase();
  if(!rego) return false;
  let v = state.vehicles.find(x => !x.deleted && String(x.rego || "").toUpperCase() === rego);
  if(!v){
    v = {
      id: makeId("veh"),
      rego,
      name: "",
      company: "",
      state: "",
      startDate: key,
      endDate: "",
      firstSeenDate: key,
      lastSeenDate: key,
      notes: "Auto-saved from diary page.",
      autoSaved: true,
      updatedAt: new Date().toISOString()
    };
    state.vehicles.push(v);
    addAuditLog("Vehicle auto-saved from diary", `${key}: ${rego}`);
    return true;
  }
  let changed = false;
  if(!v.firstSeenDate || key < v.firstSeenDate){ v.firstSeenDate = key; changed = true; }
  if(!v.lastSeenDate || key > v.lastSeenDate){ v.lastSeenDate = key; changed = true; }
  if(!v.startDate){ v.startDate = key; changed = true; }
  if(!v.notes){ v.notes = "Auto-saved from diary page."; changed = true; }
  if(changed) v.updatedAt = new Date().toISOString();
  return changed;
}
function upsertTwoUpDriverFromDiary(detail, key){
  ensureRegistries();
  if(!detail.twoUpEnabled) return false;
  const name = String(detail.twoUpDriverName || "").trim();
  const licence = String(detail.twoUpLicenceNumber || "").replace(/\D+/g, "");
  if(!name && !licence) return false;
  const keyVal = normaliseDriverKey(name, licence);
  let d = state.savedDrivers.find(x => {
    if(x.deleted) return false;
    return normaliseDriverKey(x.name, x.licence) === keyVal ||
      (licence && String(x.licence || "").replace(/\D+/g, "") === licence);
  });
  if(!d){
    d = {
      id: makeId("drv"),
      name,
      licence,
      licenceState: detail.twoUpBaseState || "",
      scheme: detail.twoUpScheme || "Standard",
      accreditationNo: "",
      role: "twoUp",
      startDate: key,
      endDate: "",
      firstSeenDate: key,
      lastSeenDate: key,
      notes: "Auto-saved from diary page.",
      autoSaved: true,
      updatedAt: new Date().toISOString()
    };
    state.savedDrivers.push(d);
    addAuditLog("Two-up driver auto-saved from diary", `${key}: ${name || licence}`);
    return true;
  }
  let changed = false;
  // Only fill missing details so manual registry edits stay protected.
  if(!d.name && name){ d.name = name; changed = true; }
  if(!d.licence && licence){ d.licence = licence; changed = true; }
  if(!d.licenceState && detail.twoUpBaseState){ d.licenceState = detail.twoUpBaseState; changed = true; }
  if(!d.scheme && detail.twoUpScheme){ d.scheme = detail.twoUpScheme; changed = true; }
  if(!d.role){ d.role = "twoUp"; changed = true; }
  if(!d.firstSeenDate || key < d.firstSeenDate){ d.firstSeenDate = key; changed = true; }
  if(!d.lastSeenDate || key > d.lastSeenDate){ d.lastSeenDate = key; changed = true; }
  if(!d.startDate){ d.startDate = key; changed = true; }
  if(!d.notes){ d.notes = "Auto-saved from diary page."; changed = true; }
  if(changed) d.updatedAt = new Date().toISOString();
  return changed;
}
function autoSaveRegistryFromDiaryPage(key=state.selectedDate){
  ensureRegistrySettings();
  if(!state.registrySettings.autoSaveFromDiary) return false;
  const detail = ensureDayDetail(key);
  let changed = false;
  changed = upsertVehicleFromDiary(detail, key) || changed;
  changed = upsertTwoUpDriverFromDiary(detail, key) || changed;
  return changed;
}
function toggleAutoSaveRegistryFromDiary(){
  ensureRegistrySettings();
  state.registrySettings.autoSaveFromDiary = !!$("autoSaveRegistryFromDiary").checked;
  save();
  if(typeof showToast === "function") showToast("Saved");
}


function setupVehicleDriverRegistryButtons(){
  if($("autoSaveRegistryFromDiary")) $("autoSaveRegistryFromDiary").onchange = toggleAutoSaveRegistryFromDiary;
  if($("addVehicleBtn")) $("addVehicleBtn").onclick = () => openVehicleEditor();
  if($("addSavedDriverBtn")) $("addSavedDriverBtn").onclick = () => openSavedDriverEditor();
  if($("saveVehicleBtn")) $("saveVehicleBtn").onclick = saveVehicleRecord;
  if($("applyVehicleBtn")) $("applyVehicleBtn").onclick = applyVehicleToCurrentPage;
  if($("cancelVehicleBtn")) $("cancelVehicleBtn").onclick = closeVehicleEditor;
  if($("deleteVehicleBtn")) $("deleteVehicleBtn").onclick = deleteVehicleRecord;
  if($("saveSavedDriverBtn")) $("saveSavedDriverBtn").onclick = saveSavedDriverRecord;
  if($("applyTwoUpDriverBtn")) $("applyTwoUpDriverBtn").onclick = applySavedDriverAsTwoUp;
  if($("cancelSavedDriverBtn")) $("cancelSavedDriverBtn").onclick = closeSavedDriverEditor;
  if($("deleteSavedDriverBtn")) $("deleteSavedDriverBtn").onclick = deleteSavedDriverRecord;
}


function save(){
  ensureProfile();
  ensureBackupReminder();
  ensureDayDetailsContainer();
  ensureBookSettings();
  ensureSettingsHistory();
  ensureRuleHistory();
  if(!Array.isArray(state.auditLog)) state.auditLog=[];
  ensureDismissedAudit();
  state.schemaVersion = APP_SCHEMA_VERSION;
  localStorage.setItem("truckDiaryPWA", JSON.stringify(state));
}
let saveSoonTimer = null;
function saveSoon(){
  clearTimeout(saveSoonTimer);
  saveSoonTimer = setTimeout(() => {
    saveSoonTimer = null;
    save();
  }, 350);
}
function flushSaveSoon(){
  if(saveSoonTimer){
    clearTimeout(saveSoonTimer);
    saveSoonTimer = null;
    save();
  }
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
  migrateCurrentState();
}
function isWork(key, idx){ return getSlot(key, idx) === "work"; }
function isRestType(type){ return type === "rest"; }
function restTypeForSlot(key, idx, seen=new Set()){
  if(getSlot(key, idx) !== "rest") return "";
  const guardKey = `${key}:${idx}`;
  if(seen.has(guardKey)) return "";
  seen.add(guardKey);
  const rows = syncChangeRowsForDay(key);
  const mins = idx*SLOT;
  let current = null;
  for(const r of rows){
    const rm = timeToMins(r.time);
    if(rm <= mins) current = r;
    else break;
  }
  if(current && current.activity === "rest"){
    if(typeof isAutoContinuationRow === "function" && isAutoContinuationRow(current)){
      const prevKey = previousDateKey(key);
      if(!hasExplicitDiaryDataForDate(prevKey)) return "";
      if(typeof calculationHistoryStartAbs === "function" && fromKey(prevKey).getTime() < calculationHistoryStartAbs()) return "";
      return restTypeForSlot(prevKey, SLOTS_PER_DAY - 1, seen);
    }
    return current.restType || "";
  }
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
  return nhvrBreachesForDate(key).some(f => f.focus && Array.isArray(f.focus.slots) && f.focus.slots.includes(idx) && f.severity === "error");
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


function breachSlotSetForGrid(key){
  const set = new Set();
  try{
    if(typeof dayHasAnyWork === "function" && !dayHasAnyWork(key)) return set;
    const findings = typeof nhvrBreachesForDate === "function" ? nhvrBreachesForDate(key) : [];
    findings.forEach(f=>{
      if((f.severity || "error") !== "error") return;
      if(f.focus && Array.isArray(f.focus.slots)){
        f.focus.slots.forEach(s => {
          const n = Number(s);
          if(!Number.isNaN(n)) set.add(n);
        });
      }
    });
  }catch(err){
    console.warn("Breach highlight skipped", err);
  }
  return set;
}

function renderGrid(){
  const grid = $("diaryGrid");
  grid.innerHTML = "";
  const breachSlots = breachSlotSetForGrid(state.selectedDate);
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
          if(t === "work") cell.classList.add(breachSlots.has(slotIndex) ? "bad" : "work");
          else cell.classList.add("empty");
        } else {
          if(t === "rest") cell.classList.add("rest");
          else cell.classList.add("empty");
        }

        if((i+1)%4===0) cell.classList.add("thick");
        cell.title = `${fmtHM(slotIndex*15)} ${row.label}`;
        cell.dataset.slot = slotIndex;
        cell.dataset.row = row.action;
        if(isPageCancelledOrSkipped(state.selectedDate)){
          cell.disabled = true;
          cell.classList.add("locked");
        }
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
    if(val === "work"){ const d = ensureDayDetail(state.selectedDate); d.usePage = true; if(d.usePageManual === undefined) d.usePageManual = false; }
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
  let originalSlots = new Map();
  let paintedSlots = new Set();
  const THRESHOLD = 10;

  function beginCandidate(target, point){
    if(isPageCancelledOrSkipped(state.selectedDate)){
      alert("This page is marked cancelled/skipped. Change Page status back to Active before editing Work/Rest blocks.");
      return false;
    }
    const cell = target && target.closest ? target.closest(".slot[data-slot]") : null;
    if(!cell) return false;
    touchCandidate = true;
    painting = false;
    scrollMode = false;
    changed = false;
    originalSlots = new Map();
    paintedSlots = new Set();
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

  function rememberOriginal(idx){
    const arr = getDaySlots(state.selectedDate);
    if(!originalSlots.has(idx)) originalSlots.set(idx, arr[idx]);
  }

  function updateSlotVisual(idx){
    const val = getDaySlots(state.selectedDate)[idx];
    document.querySelectorAll(`.slot[data-slot="${idx}"]`).forEach(cell=>{
      const row = cell.dataset.row;
      cell.classList.toggle("work", row === "work" && val === "work");
      cell.classList.toggle("rest", row === "rest" && val === "rest");
      cell.classList.toggle("empty", row !== val);
      cell.classList.toggle("dragPreview", paintedSlots.has(idx));
    });
  }

  function setSlotDuringPaint(idx, val){
    const arr = getDaySlots(state.selectedDate);
    rememberOriginal(idx);
    if(arr[idx] !== val){
      arr[idx] = val;
      changed = true;
      if(val === "work"){ const d = ensureDayDetail(state.selectedDate); d.usePage = true; if(d.usePageManual === undefined) d.usePageManual = false; }
    }
    paintedSlots.add(idx);
    updateSlotVisual(idx);
  }

  function restoreSlotDuringPaint(idx){
    if(!originalSlots.has(idx)) return;
    const arr = getDaySlots(state.selectedDate);
    const original = originalSlots.get(idx);
    if(arr[idx] !== original){
      arr[idx] = original;
      changed = true;
    }
    paintedSlots.delete(idx);
    updateSlotVisual(idx);
  }

  function paintSingle(slotIdx, noteText){
    if(isPageCancelledOrSkipped(state.selectedDate)){
      alert("This page is marked cancelled/skipped. Change Page status back to Active before editing Work/Rest blocks.");
      return;
    }
    const arr = getDaySlots(state.selectedDate);
    arr[slotIdx] = startAction;
    if(startAction === "work") ensureDayDetail(state.selectedDate).usePage = true;
    addEntryRecord(state.selectedDate, slotIdx*SLOT, state.selectedDate, (slotIdx+1)*SLOT, startAction, noteText || "Tap fill");
    saveSoon();
    renderDiaryFast();
  }

  function paintRangeFromStartTo(slotIdx){
    const a = Math.min(startSlot, slotIdx);
    const b = Math.max(startSlot, slotIdx);
    // Restore slots that were painted during this swipe but are no longer inside current range.
    Array.from(paintedSlots).forEach(idx=>{
      if(idx < a || idx > b) restoreSlotDuringPaint(idx);
    });
    for(let i = a; i <= b; i++){
      setSlotDuringPaint(i, startAction);
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
        paintRangeFromStartTo(startSlot);
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
      paintRangeFromStartTo(idx);
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
        saveSoon();
        renderDiaryFast();
      }
    }
    touchCandidate = false;
    painting = false;
    scrollMode = false;
    changed = false;
    startSlot = null;
    lastSlot = null;
    originalSlots = new Map();
    paintedSlots = new Set();
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
  if(isPageCancelledOrSkipped(state.selectedDate)){
    return [{type:"warn", text:`This page is marked ${pageStatusLabel(state.selectedDate)}. Do not use this page for break/fatigue advice.`}];
  }
  if(selectedDayIsTwoUp()){
    const missing = twoUpMissingDetails();
    if(missing.length){
      warns.push({type:"warn", text:`Two-up is selected but missing: ${missing.join(", ")}.`});
    }
  }
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
  const div=$("ruleCards");
  if(!div) return;
  div.innerHTML = twoUpRuleWarningHtml() + nhvrRuleCardsForDate(state.selectedDate);
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
  if(!box) return;
  const now = new Date();
  const asOfAbs = now.getTime();
  const status = nhvrCanWorkStatus(asOfAbs);
  if(status.minutes <= 0){
    box.innerHTML = `<strong>Rest required now.</strong> Limiting rule: ${escapeHtml(status.reason)}.`;
  } else if(status.minutes >= 24*60){
    box.innerHTML = `No active counted window found in saved history. Check that your previous rest/work blocks are entered.`;
  } else {
    const latest = asOfAbs + status.minutes*60000;
    box.innerHTML = `Estimated work remaining: <strong>${formatMinsShort(status.minutes)}</strong>. Limiting rule: <strong>${escapeHtml(status.reason)}</strong>. Latest work-limit time if you keep working: <strong>${escapeHtml(formatDateTimeForStats(latest))}</strong>.`;
  }
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



function earliestRecordedDiaryDate(){
  const dates = new Set();
  Object.keys(state.slots || {}).forEach(k => dates.add(k));
  Object.keys(state.dayDetails || {}).forEach(k => dates.add(k));
  (state.entries || []).forEach(e => {
    if(e.start) dates.add(String(e.start).slice(0,10));
    if(e.end) dates.add(String(e.end).slice(0,10));
  });
  if(state.bookSettings && state.bookSettings.firstPageDate) dates.add(state.bookSettings.firstPageDate);
  if(Array.isArray(state.diaryBooks) && state.diaryBooks.length){
    state.diaryBooks.forEach(b => { if(b.startDate) dates.add(b.startDate); });
  }
  const sorted = [...dates].filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  return sorted[0] || state.selectedDate || toKey(new Date());
}
function ensureCalculationHistory(){
  if(!state.calculationHistory || typeof state.calculationHistory !== "object"){
    state.calculationHistory = {startDate:"", mode:"noWorkBeforeStart"};
  }
  if(!state.calculationHistory.startDate){
    state.calculationHistory.startDate = earliestRecordedDiaryDate();
  }
  if(!["noWorkBeforeStart","unknown","imported"].includes(state.calculationHistory.mode)){
    state.calculationHistory.mode = "noWorkBeforeStart";
  }
}
function calculationHistoryStartAbs(){
  ensureCalculationHistory();
  const key = state.calculationHistory.startDate || earliestRecordedDiaryDate();
  return fromKey(key).getTime();
}
function calculationHistoryMode(){
  ensureCalculationHistory();
  return state.calculationHistory.mode || "noWorkBeforeStart";
}
function longPeriodRestCheckIsDue(winEnd, dayEnd){
  // Work-limit breaches can be known immediately, but a 7d/14d rest/night-rest requirement
  // should not be shown as a breach before that full period has actually ended.
  return winEnd <= dayEnd;
}
function shouldSkipLongRestCheckForMissingHistory(startAbs){
  const histStart = calculationHistoryStartAbs();
  const mode = calculationHistoryMode();
  return startAbs < histStart && mode === "noWorkBeforeStart";
}
function missingHistoryFinding(key, rule, profile, startAbs){
  return nhvrFinding(
    "warn",
    key,
    `${rule.label} previous history needed`,
    `${profile.name}: ${rule.label} period starts before the app's calculation history start date. The app cannot confirm this long-period rest check from saved data only.`,
    [],
    `Set Calculation History to “No work / full rest” only if that is true, or import/add earlier diary pages before relying on this ${rule.label} check.`,
    startAbs
  );
}
function renderCalculationHistorySettings(){
  ensureCalculationHistory();
  if($("calculationHistoryStartDate")) $("calculationHistoryStartDate").value = state.calculationHistory.startDate || earliestRecordedDiaryDate();
  if($("calculationHistoryMode")) $("calculationHistoryMode").value = state.calculationHistory.mode || "noWorkBeforeStart";
}
function saveCalculationHistorySettings(){
  ensureCalculationHistory();
  state.calculationHistory.startDate = $("calculationHistoryStartDate") ? $("calculationHistoryStartDate").value || earliestRecordedDiaryDate() : earliestRecordedDiaryDate();
  state.calculationHistory.mode = $("calculationHistoryMode") ? $("calculationHistoryMode").value || "noWorkBeforeStart" : "noWorkBeforeStart";
  addAuditLog("Calculation history changed", `Start ${state.calculationHistory.startDate}; before start: ${state.calculationHistory.mode}`);
  save();
  refreshCurrentPageData({forceDefaults:false});
  renderAll();
  showToast("Saved");
}

const NHVR_ENGINE_VERSION = "NHVR Work Diary Guide v1.3 counting engine";

function nhvrProfileForDate(key){
  const rk = activeRuleKeyForDate(key);
  if(rk === "AFM") return {key:"AFM", name:"AFM record-only", afm:true, short:[], periods:[]};
  if(rk === "StandardTwoUp") return {
    key:rk, name:"Standard two-up",
    short:[{label:"5½h", minutes:330, maxWork:315, rest:"15 min continuous rest"},{label:"8h", minutes:480, maxWork:450, rest:"30 min rest in 15-min blocks"},{label:"11h", minutes:660, maxWork:600, rest:"60 min rest in 15-min blocks"}],
    anchor24:{label:"5h stationary/sleeper rest", mins:300, kind:"stationaryOrSleeper"},
    periods:[{label:"24h", minutes:1440, maxWork:720, restCheck:{mins:300, kind:"stationaryOrSleeper", label:"5h stationary or approved sleeper-berth rest"}},
             {label:"52h", minutes:3120, maxWork:null, restCheck:{mins:600, kind:"stationary", label:"10h continuous stationary rest"}},
             {label:"7d", minutes:10080, maxWork:3600, restCheck:{mins:1440, kind:"stationary", label:"24h continuous stationary rest"}},
             {label:"14d", minutes:20160, maxWork:7200, nightRest:{count:2, consecutive:true, label:"2 night rests and 2 consecutive night rests"}}]
  };
  if(rk === "BFMTwoUp") return {
    key:rk, name:"BFM two-up",
    short:[],
    anchor24:{label:"any rest break", mins:15, kind:"anyRest"},
    periods:[{label:"24h", minutes:1440, maxWork:840, restCheck:null},
             {label:"82h", minutes:4920, maxWork:null, restCheck:{mins:600, kind:"stationary", label:"10h continuous stationary rest"}},
             {label:"7d", minutes:10080, maxWork:4200, restCheck:{mins:1440, kind:"stationary", label:"24h continuous stationary rest"}},
             {label:"14d", minutes:20160, maxWork:8400, nightRest:{count:4, consecutive:false, label:"4 night rests"}}]
  };
  if(rk === "BFM") return {
    key:rk, name:"BFM solo",
    short:[{label:"6¼h", minutes:375, maxWork:360, rest:"15 min continuous rest"},{label:"9h", minutes:540, maxWork:510, rest:"30 min rest in 15-min blocks"},{label:"12h", minutes:720, maxWork:660, rest:"60 min rest in 15-min blocks"}],
    anchor24:{label:"7h stationary rest", mins:420, kind:"stationary", note:"Split rest break support is not automatic; use expert review if relying on a 6h split rest."},
    periods:[{label:"24h", minutes:1440, maxWork:840, restCheck:{mins:420, kind:"stationary", label:"7h continuous stationary rest"}},
             {label:"7d long/night", minutes:10080, maxLongNight:2160, longNight:true, note:"Long/night helper uses base-time diary blocks."},
             {label:"14d", minutes:20160, maxWork:8640, restCheck:{mins:1440, kind:"stationary", label:"24h continuous stationary rest"}, nightRest:{count:2, consecutive:true, label:"2 night rests and 2 consecutive night rests"}}]
  };
  return {
    key:"Standard", name:"Standard solo",
    short:[{label:"5½h", minutes:330, maxWork:315, rest:"15 min continuous rest"},{label:"8h", minutes:480, maxWork:450, rest:"30 min rest in 15-min blocks"},{label:"11h", minutes:660, maxWork:600, rest:"60 min rest in 15-min blocks"}],
    anchor24:{label:"7h stationary rest", mins:420, kind:"stationary"},
    periods:[{label:"24h", minutes:1440, maxWork:720, restCheck:{mins:420, kind:"stationary", label:"7h continuous stationary rest"}},
             {label:"7d", minutes:10080, maxWork:4320, restCheck:{mins:1440, kind:"stationary", label:"24h continuous stationary rest"}},
             {label:"14d", minutes:20160, maxWork:8640, nightRest:{count:2, consecutive:true, label:"2 night rests and 2 consecutive night rests"}}]
  };
}

function nhvrSlotFlagsAtAbs(abs){
  const {key, slot} = absToKeySlot(abs);
  const rest = activityAtAbs(abs) !== "work";
  const rt = rest ? restTypeForSlot(key, slot) : "work";
  const stationary = rest && (isStationary(key, slot) || rt === "stationary" || rt === "night" || rt === "24h");
  const sleeper = rest && rt === "sleeper";
  return {key, slot, rest, rt, stationary, sleeper, stationaryOrSleeper: stationary || sleeper};
}
function nhvrPredicateForKind(kind){
  if(kind === "anyRest") return abs => nhvrSlotFlagsAtAbs(abs).rest;
  if(kind === "stationaryOrSleeper") return abs => nhvrSlotFlagsAtAbs(abs).stationaryOrSleeper;
  return abs => nhvrSlotFlagsAtAbs(abs).stationary;
}
function nhvrMaxContinuousBetween(startAbs, endAbs, predicate){
  let best = 0, cur = 0;
  for(let t=startAbs; t<endAbs; t+=SLOT*60000){
    if(predicate(t)){ cur += SLOT; best = Math.max(best, cur); }
    else cur = 0;
  }
  return best;
}
function nhvrFindRestPeriods(startAbs, endAbs){
  const periods = [];
  let active = null;
  for(let t=startAbs; t<endAbs; t+=SLOT*60000){
    const f = nhvrSlotFlagsAtAbs(t);
    if(f.rest){
      if(!active) active = {startAbs:t, endAbs:t, minutes:0, bestStationary:0, bestStationaryOrSleeper:0, curStationary:0, curStationaryOrSleeper:0};
      active.minutes += SLOT;
      active.endAbs = t + SLOT*60000;
      if(f.stationary){ active.curStationary += SLOT; active.bestStationary = Math.max(active.bestStationary, active.curStationary); }
      else active.curStationary = 0;
      if(f.stationaryOrSleeper){ active.curStationaryOrSleeper += SLOT; active.bestStationaryOrSleeper = Math.max(active.bestStationaryOrSleeper, active.curStationaryOrSleeper); }
      else active.curStationaryOrSleeper = 0;
    } else if(active){
      periods.push(active); active = null;
    }
  }
  if(active) periods.push(active);
  return periods;
}
function nhvrRestPeriodQualifies(period, req){
  if(!period || !req) return false;
  if(req.kind === "anyRest") return period.minutes >= (req.mins || 15);
  if(req.kind === "stationaryOrSleeper") return period.bestStationaryOrSleeper >= req.mins;
  return period.bestStationary >= req.mins;
}
function nhvrRestBreakEnds(startAbs, endAbs){
  return nhvrFindRestPeriods(startAbs, endAbs).filter(p => p.minutes >= 15).map(p => ({abs:p.endAbs, period:p}));
}
function nhvrAnchorEndsForPeriod(profile, startAbs, endAbs, periodRule){
  const restEnds = nhvrRestBreakEnds(startAbs, endAbs);
  if(periodRule && periodRule.label === "24h" && profile.anchor24){
    return restEnds.filter(e => nhvrRestPeriodQualifies(e.period, profile.anchor24));
  }
  if(periodRule && periodRule.label === "52h"){
    return restEnds.filter(e => nhvrRestPeriodQualifies(e.period, {mins:300, kind:"stationaryOrSleeper"}));
  }
  if(periodRule && periodRule.label === "82h"){
    return restEnds.filter(e => e.period.minutes >= 15);
  }
  if(periodRule && (periodRule.label === "7d" || periodRule.label === "7d long/night")){
    return restEnds.filter(e => nhvrRestPeriodQualifies(e.period, {mins:1440, kind:"stationary"}) || nhvrRestPeriodQualifies(e.period, profile.anchor24 || {mins:420, kind:"stationary"}));
  }
  if(periodRule && periodRule.label === "14d"){
    return restEnds.filter(e => nhvrIsNightRestPeriod(e.period) || nhvrRestPeriodQualifies(e.period, {mins:1440, kind:"stationary"}) || nhvrRestPeriodQualifies(e.period, profile.anchor24 || {mins:420, kind:"stationary"}));
  }
  return restEnds;
}
function nhvrWorkBetween(startAbs, endAbs){ return countWorkBetweenAbs(startAbs, endAbs); }
function nhvrLongNightWorkBetween(startAbs, endAbs){
  let total = 0;
  const dayExtra = {};
  for(let t=startAbs; t<endAbs; t+=SLOT*60000){
    if(activityAtAbs(t) === "work"){
      const d = new Date(t);
      const h = d.getHours();
      if(h < 6) total += SLOT;
      const k = toKey(d);
      dayExtra[k] = (dayExtra[k] || 0) + SLOT;
    }
  }
  Object.values(dayExtra).forEach(m => { if(m > 720) total += (m - 720); });
  return total;
}
function nhvrIsNightRestPeriod(period){
  if(!period) return false;
  if(period.bestStationary >= 1440) return true;
  const startKey = toKey(new Date(period.startAbs - DAY_MS));
  const endKey = toKey(new Date(period.endAbs));
  for(let key=startKey; key<=endKey; key=addDays(key,1)){
    const ns = fromKey(key).getTime() + 22*60*60000;
    const ne = fromKey(addDays(key,1)).getTime() + 8*60*60000;
    const s = Math.max(ns, period.startAbs);
    const e = Math.min(ne, period.endAbs);
    if(e > s && nhvrMaxContinuousBetween(s,e,nhvrPredicateForKind("stationary")) >= 420) return true;
  }
  return false;
}
function nhvrNightRestDates(startAbs, endAbs){
  const dates = new Set();
  nhvrFindRestPeriods(startAbs, endAbs).forEach(p => {
    if(nhvrIsNightRestPeriod(p)) dates.add(toKey(new Date(p.endAbs - 60000)));
  });
  return [...dates].sort();
}
function nhvrHasConsecutiveDates(dates){
  const set = new Set(dates);
  return dates.some(d => set.has(addDays(d,1)));
}
function nhvrSlotsInDateWindow(key, startAbs, endAbs){
  const slots = [];
  const ds = fromKey(key).getTime();
  for(let i=0;i<SLOTS_PER_DAY;i++){
    const s = ds + i*SLOT*60000;
    if(s >= startAbs && s < endAbs && getSlot(key,i) === "work") slots.push(i);
  }
  return slots;
}
function nhvrFinding(severity, key, title, message, slots, suggestion, anchorAbs){
  return {severity, title, message, focus:{type:"slot", slots:slots || []}, suggestion, anchorAbs};
}

function nhvrOverLimitSlotsForDate(key, startAbs, endAbs, maxWork, counterFn){
  const slots = [];
  let work = 0;
  let firstAbs = null;
  const counter = counterFn || ((abs) => activityAtAbs(abs) === "work" ? SLOT : 0);
  for(let t=startAbs; t<endAbs; t+=SLOT*60000){
    const add = counter(t);
    if(add > 0){
      work += add;
      if(work > maxWork){
        const ks = absToKeySlot(t);
        if(ks.key === key){
          slots.push(ks.slot);
          if(firstAbs === null) firstAbs = t;
        }
      }
    }
  }
  return {slots, firstAbs, work};
}
function nhvrFirstRedTimeText(key, slots){
  if(!slots || !slots.length) return "";
  const s = Math.min(...slots);
  return fmtHM(s*SLOT);
}
function nhvrPreciseFixSuggestion(rule, profile, key, slots, startAbs, winEnd, work){
  const first = nhvrFirstRedTimeText(key, slots);
  const restText = rule.rest || (rule.restCheck ? rule.restCheck.label : "a qualifying rest break");
  if(first){
    return `First red block starts at ${first}. That is where this helper calculation first exceeds the ${rule.label} limit. Before continuing from that block, change incorrect Work to Rest or insert/move ${restText}. Count starts from ${formatDateTimeForStats(startAbs)} and this window ends ${formatDateTimeForStats(winEnd)}.`;
  }
  return `This ${rule.label} window is over the helper limit, but the first over-limit block is on another page. Check the period from ${formatDateTimeForStats(startAbs)} to ${formatDateTimeForStats(winEnd)} and add/move the required rest.`;
}
function nhvrLongNightSlotCounter(abs){
  if(activityAtAbs(abs) !== "work") return 0;
  const d = new Date(abs);
  const h = d.getHours();
  if(h < 6) return SLOT;
  // Extra long work above 12h in a single day is handled in detailed audit text,
  // but red grid highlighting stays conservative and only marks midnight-6am night work.
  return 0;
}




function nhvrRequiredRestMinutesForRule(rule){
  // rule.rest text is used in current engine. Parse the minimum qualifying rest.
  const txt = String(rule && (rule.rest || rule.label || "") || "").toLowerCase();
  const nums = [...txt.matchAll(/(\d+)\s*(?:min|minute|minutes|m\b)/g)].map(m => Number(m[1])).filter(Boolean);
  if(nums.length) return Math.max(...nums);
  const hourNums = [...txt.matchAll(/(\d+)\s*(?:h|hr|hour|hours)/g)].map(m => Number(m[1])*60).filter(Boolean);
  if(hourNums.length) return Math.max(...hourNums);
  // Safe fallback for short-rest rules.
  return 15;
}
function nhvrRestRequirementLabel(mins){
  if(mins % 60 === 0) return `${mins/60} hour${mins===60 ? "" : "s"}`;
  return `${mins} minutes`;
}
function nhvrSlotsFromAbsRangeForKey(key, startAbs, durationMins){
  const slots = [];
  const total = Math.max(1, Math.ceil(durationMins / SLOT));
  for(let i=0; i<total; i++){
    const t = startAbs + i*SLOT*60000;
    const ks = absToKeySlot(t);
    if(ks.key === key && ks.slot >= 0 && ks.slot < SLOTS_PER_DAY){
      slots.push(ks.slot);
    }
  }
  return slots;
}
function nhvrFirstWorkSlotAfterDue(key, dueAbs, dayEnd){
  for(let t=dueAbs; t<dayEnd; t+=SLOT*60000){
    if(activityAtAbs(t) === "work"){
      const ks = absToKeySlot(t);
      if(ks.key === key) return {abs:t, slot:ks.slot};
    }
  }
  return null;
}
function nhvrRequiredRestSlotsForDate(key, dueAbs, requiredRestMins){
  const dayStart = fromKey(key).getTime();
  const dayEnd = dayStart + DAY_MS;
  const first = nhvrFirstWorkSlotAfterDue(key, dueAbs, dayEnd);
  if(!first) return [];
  return nhvrSlotsFromAbsRangeForKey(key, first.abs, requiredRestMins);
}
function nhvrRequiredRestFocus(key, dueAbs, requiredRestMins){
  const slots = nhvrRequiredRestSlotsForDate(key, dueAbs, requiredRestMins);
  const first = slots.length ? fmtHM(Math.min(...slots)*SLOT) : "";
  return {slots, firstTime:first, requiredRestMins};
}
function nhvrRequiredRestSuggestion(rule, key, dueAbs, requiredRestMins, slots){
  const label = nhvrRestRequirementLabel(requiredRestMins);
  const first = slots && slots.length ? fmtHM(Math.min(...slots)*SLOT) : formatDateTimeForStats(dueAbs);
  return `Break/rest is due from ${first}. To fix this rule, change ${Math.ceil(requiredRestMins/SLOT)} block(s) to Rest here (${label}). Only these required-rest blocks are marked red so you can see exactly where to fix it.`;
}
function nhvrRequiredRestFinding(severity, key, title, message, rule, dueAbs, anchorAbs){
  const req = nhvrRequiredRestMinutesForRule(rule);
  const focus = nhvrRequiredRestFocus(key, dueAbs, req);
  return nhvrFinding(
    severity,
    key,
    title,
    message,
    focus.slots,
    nhvrRequiredRestSuggestion(rule, key, dueAbs, req, focus.slots),
    anchorAbs || dueAbs
  );
}


function nhvrRollingShortWindowFindings(key, profile, rule, dayStart, dayEnd){
  const findings = [];
  const seenDue = new Set();
  const windowMins = rule.minutes;
  const stepMs = SLOT * 60000;
  const requiredRestMins = nhvrRequiredRestMinutesForRule(rule);

  // Rolling window ending inside this day. When work exceeds the limit,
  // mark only the required rest blocks from the first illegal work block.
  for(let endAbs = dayStart + stepMs; endAbs <= dayEnd; endAbs += stepMs){
    const startAbs = endAbs - windowMins * 60000;
    const work = nhvrWorkBetween(startAbs, endAbs);
    if(work > rule.maxWork){
      // The first illegal point is the work block that pushes the rolling window over limit.
      const dueAbs = endAbs - stepMs;
      const ks = absToKeySlot(dueAbs);
      if(ks.key !== key) continue;
      const dueKey = `${rule.label}|${ks.slot}|${requiredRestMins}`;
      if(seenDue.has(dueKey)) continue;
      seenDue.add(dueKey);

      const focus = nhvrRequiredRestFocus(key, dueAbs, requiredRestMins);
      if(!focus.slots.length) continue;

      findings.push(nhvrFinding(
        "error",
        key,
        `${rule.label} break due`,
        `${profile.name}: ${formatMinsShort(work)} work in a rolling ${rule.label} period ending ${formatDateTimeForStats(endAbs)}. Limit is ${formatMinsShort(rule.maxWork)}. Required rest: ${nhvrRestRequirementLabel(requiredRestMins)}.`,
        focus.slots,
        nhvrRequiredRestSuggestion(rule, key, dueAbs, requiredRestMins, focus.slots),
        startAbs
      ));

      // Once this rule marks the first required rest on this page, do not paint every later work block.
      break;
    }
  }
  return findings;
}

function nhvrAddRollingShortRestChecks(key, profile, dayStart, dayEnd, addFinding){
  if(!profile || !Array.isArray(profile.short)) return;
  profile.short.forEach(rule => {
    nhvrRollingShortWindowFindings(key, profile, rule, dayStart, dayEnd).forEach(addFinding);
  });
}


function nhvrBreachesForDate(key){
  const profile = nhvrProfileForDate(key);
  if(profile.afm) return [nhvrFinding("error", key, "AFM conditions required", "AFM is selected. Enter your operator's AFM certificate limits before using fatigue calculations.", [], "Use AFM as record-only until the exact AFM certificate conditions are entered.")];
  const dayStart = fromKey(key).getTime();
  const dayEnd = dayStart + DAY_MS;
  ensureCalculationHistory();
  const historyMode = calculationHistoryMode();
  const lookback = 30*DAY_MS;
  const scanStart = dayStart - lookback;
  const findings = [];
  const seen = new Set();
  const addFinding = (f) => {
    const k = `${f.title}|${Math.round((f.anchorAbs||0)/60000)}|${f.message}|${(f.focus && f.focus.slots || []).join(",")}`;
    if(seen.has(k)) return;
    seen.add(k); findings.push(f);
  };
  const restEnds = nhvrRestBreakEnds(scanStart, dayEnd + 15*DAY_MS);

  // Rolling short-rest checks catch continuous work even if there is no saved prior rest anchor.
  nhvrAddRollingShortRestChecks(key, profile, dayStart, dayEnd, addFinding);

  // Short-rest rules: count forward from the end of every rest break for periods under 24h.
  // Red highlights now mark only the over-limit work blocks, not the full counted period.
  profile.short.forEach(rule => {
    restEnds.forEach(e => {
      const s = e.abs, winEnd = s + rule.minutes*60000;
      if(winEnd <= dayStart || s >= dayEnd) return;
      const work = nhvrWorkBetween(s, winEnd);
      if(work > rule.maxWork){
        const dueAbs = nhvrFirstWorkSlotAfterDue(key, s + rule.maxWork*60000, Math.min(winEnd, dayEnd));
        if(dueAbs){
          addFinding(nhvrRequiredRestFinding(
            "error",
            key,
            `${rule.label} break due`,
            `${profile.name}: ${formatMinsShort(work)} work in the ${rule.label} period starting ${formatDateTimeForStats(s)}. Limit is ${formatMinsShort(rule.maxWork)}.`,
            rule,
            dueAbs.abs,
            s
          ));
        }
      }
    });
  });

  // 24h and longer rules: count from the end of relevant major rest breaks.
  // For work-limit breaches, red highlights start where the limit is first exceeded.
  profile.periods.forEach(rule => {
    const anchors = nhvrAnchorEndsForPeriod(profile, scanStart, dayEnd, rule);
    anchors.forEach(e => {
      const s = e.abs, winEnd = s + rule.minutes*60000;
      if(winEnd <= dayStart || s >= dayEnd) return;

      if(rule.maxWork !== null && rule.maxWork !== undefined){
        const work = nhvrWorkBetween(s, winEnd);
        if(work > rule.maxWork){
          const dueAbs = nhvrFirstWorkSlotAfterDue(key, s + rule.maxWork*60000, Math.min(winEnd, dayEnd));
          if(dueAbs){
            const reqRule = rule.restCheck ? {...rule, rest: rule.restCheck.label} : rule;
            addFinding(nhvrRequiredRestFinding(
              "error",
              key,
              `${rule.label} rest due`,
              `${profile.name}: ${formatMinsShort(work)} work in the ${rule.label} period starting ${formatDateTimeForStats(s)}. Limit is ${formatMinsShort(rule.maxWork)}.`,
              reqRule,
              dueAbs.abs,
              s
            ));
          }
        }
      }

      if(rule.restCheck){
        if(!longPeriodRestCheckIsDue(winEnd, dayEnd)){
          // The period is still open. Do not show a false breach before the driver has had the full period to take the required rest.
        } else if(shouldSkipLongRestCheckForMissingHistory(s)){
          // Before the app history start is explicitly treated as no work/full rest, so do not create a missing-history false warning.
        } else if(s < calculationHistoryStartAbs() && historyMode === "unknown"){
          addFinding(missingHistoryFinding(key, rule, profile, s));
        } else {
          const got = nhvrMaxContinuousBetween(s, winEnd, nhvrPredicateForKind(rule.restCheck.kind));
          if(got < rule.restCheck.mins){
            // Do not colour the whole 24h/7d/14d window red for a missing major-rest requirement.
            // The audit item explains the missing rest; work-limit breaches still colour exact blocks separately.
            addFinding(nhvrFinding(
              "error",
              key,
              `${rule.label} rest requirement missing`,
              `${profile.name}: ${rule.label} period from ${formatDateTimeForStats(s)} needs ${rule.restCheck.label}; found ${formatMinsShort(got)} continuous qualifying rest.`,
              [],
              `Select the correct Rest Type for qualifying rest blocks or add the required rest inside this ${rule.label} period. This check is shown in audit instead of colouring the whole work period red.`,
              s
            ));
          }
        }
      }

      if(rule.nightRest){
        if(!longPeriodRestCheckIsDue(winEnd, dayEnd)){
          // The 7/14 day period has not finished yet, so a missing night-rest finding would be premature.
        } else if(shouldSkipLongRestCheckForMissingHistory(s)){
          // Before app history start is explicitly treated as no work/full rest.
        } else if(s < calculationHistoryStartAbs() && historyMode === "unknown"){
          addFinding(missingHistoryFinding(key, rule, profile, s));
        } else {
          const nights = nhvrNightRestDates(s, winEnd);
          if(nights.length < rule.nightRest.count || (rule.nightRest.consecutive && !nhvrHasConsecutiveDates(nights))){
            addFinding(nhvrFinding("warn", key, `${rule.label} night rest check`, `${profile.name}: ${rule.label} period from ${formatDateTimeForStats(s)} needs ${rule.nightRest.label}; found ${nights.length} night rest(s).`, [], `Check night rests using your base time zone. A 24h stationary rest can count as a night rest.`, s));
          }
        }
      }

      if(rule.longNight){
        const ln = nhvrLongNightWorkBetween(s, winEnd);
        if(ln > rule.maxLongNight){
          const precise = nhvrOverLimitSlotsForDate(key, s, winEnd, rule.maxLongNight, nhvrLongNightSlotCounter);
          addFinding(nhvrFinding("warn", key, `${rule.label} long/night work limit`, `${profile.name}: ${formatMinsShort(ln)} long/night work in the ${rule.label} period from ${formatDateTimeForStats(s)}. Limit is ${formatMinsShort(rule.maxLongNight)}.`, precise.slots, `Red blocks show the midnight-6am work blocks that push the helper over the long/night limit. Also review work above 12h in any 24h period.`, s));
        }
      }
    });
  });
  return nhvrCompressFindingsToRequiredRestBlocks(key, findings).slice(0, 12);
}

function nhvrCompressFindingsToRequiredRestBlocks(key, findings){
  // Final safety: do not allow a whole long work sequence to paint red.
  // Red means "put required rest here", not "all later work is wrong".
  return (findings || []).map(f => {
    if(!f || !f.focus || !Array.isArray(f.focus.slots)) return f;
    const slots = [...new Set(f.focus.slots.map(Number).filter(n => !Number.isNaN(n)))].sort((a,b)=>a-b);
    if(slots.length <= 2) return {...f, focus:{...(f.focus||{}), slots}};
    const text = `${f.title || ""} ${f.message || ""} ${f.fix || ""}`.toLowerCase();
    let required = 0;
    if(text.includes("7 hour") || text.includes("7-hour")) required = 28;
    else if(text.includes("24 hour") || text.includes("24-hour")) required = 96;
    else if(text.includes("30 min") || text.includes("30 minute")) required = 2;
    else if(text.includes("15 min") || text.includes("15 minute")) required = 1;
    else if(text.includes("break due") || text.includes("rest due")) required = Math.min(slots.length, 2);
    if(required > 0 && slots.length > required){
      return {...f, focus:{...(f.focus||{}), slots:slots.slice(0, required)}};
    }
    return {...f, focus:{...(f.focus||{}), slots}};
  });
}


function nhvrActiveWindows(asOfAbs){
  const key = absToKeySlot(asOfAbs).key;
  const profile = nhvrProfileForDate(key);
  if(profile.afm) return [];
  const scanStart = asOfAbs - 30*DAY_MS;
  const restEnds = nhvrRestBreakEnds(scanStart, asOfAbs);
  const windows = [];
  profile.short.forEach(rule => {
    const s = asOfAbs - rule.minutes*60000;
    const work = nhvrWorkBetween(s, asOfAbs);
    windows.push({label:`${rule.label} rolling`, startAbs:s, endAbs:asOfAbs, maxWork:rule.maxWork, work, rest:rule.rest, type:"short"});
    restEnds.forEach(e => {
      const rs = e.abs, end = rs + rule.minutes*60000;
      if(rs <= asOfAbs && asOfAbs < end){
        const anchoredWork = nhvrWorkBetween(rs, asOfAbs);
        windows.push({label:rule.label, startAbs:rs, endAbs:end, maxWork:rule.maxWork, work:anchoredWork, rest:rule.rest, type:"short"});
      }
    });
  });
  profile.periods.forEach(rule => {
    const anchors = nhvrAnchorEndsForPeriod(profile, scanStart, asOfAbs, rule);
    anchors.forEach(e => {
      const s = e.abs, end = s + rule.minutes*60000;
      if(s <= asOfAbs && asOfAbs < end){
        const work = rule.longNight ? nhvrLongNightWorkBetween(s, asOfAbs) : nhvrWorkBetween(s, asOfAbs);
        const maxWork = rule.longNight ? rule.maxLongNight : rule.maxWork;
        windows.push({label:rule.label, startAbs:s, endAbs:end, maxWork, work, rest: rule.restCheck ? rule.restCheck.label : (rule.nightRest ? rule.nightRest.label : "Work limit only"), type:"period"});
      }
    });
  });
  return windows.filter(w => w.maxWork !== null && w.maxWork !== undefined).sort((a,b)=>a.endAbs-b.endAbs);
}
function nhvrCanWorkStatus(asOfAbs){
  const key = absToKeySlot(asOfAbs).key;
  const profile = nhvrProfileForDate(key);
  if(profile.afm) return {minutes:0, reason:"AFM record-only: enter certificate conditions", windows:[]};
  const windows = nhvrActiveWindows(asOfAbs);
  if(!windows.length) return {minutes:24*60, reason:"No active counted window found in saved history", windows:[]};
  let can = 24*60, reason = "";
  windows.forEach(w => {
    const rem = Math.max(0, w.maxWork - w.work);
    if(rem < can){ can = rem; reason = `${w.label} window ending ${formatDateTimeForStats(w.endAbs)}`; }
  });
  return {minutes:can, reason, windows};
}

function nhvrEngineSelfTest(){
  const backup = safeClone(state);
  const results = [];
  try{
    const run = (name, scheme, workSlots, expectBreach) => {
      const key = "2026-06-18";
      state.selectedDate = key;
      state.scheme = scheme;
      state.ruleHistory = [{effectiveDate:key, scheme, mode:"solo", coDriverScheme:""}];
      state.slots = {}; state.dayDetails = {}; state.entries = [];
      state.calculationHistory = {startDate:key, mode:"noWorkBeforeStart"};
      for(let i=0;i<workSlots;i++) setSlot(key, i, "work");
      const findings = nhvrBreachesForDate(key).filter(f => (f.severity || "error") === "error");
      const ok = expectBreach ? findings.length > 0 : findings.length === 0;
      results.push({name, ok, count:findings.length, titles:findings.map(f=>f.title).slice(0,4)});
    };
    run("Standard solo 10h continuous should breach", "Standard", 40, true);
    run("BFM solo 10h continuous should breach short-rest", "BFM", 40, true);
    run("Standard solo 4h continuous should not breach", "Standard", 16, false);
  }finally{
    state = {...state, ...backup};
  }
  return results;
}
function nhvrRuleCardsForDate(key){
  const profile = nhvrProfileForDate(key);
  const dayStart = fromKey(key).getTime();
  const dayEnd = dayStart + DAY_MS;
  if(profile.afm) return `<div class="alert warn">AFM is selected. Enter AFM certificate conditions before relying on fatigue calculations.</div>`;
  const findings = nhvrBreachesForDate(key);
  const active = nhvrActiveWindows(dayEnd - SLOT*60000).slice(0,8);
  let html = `<span class="engineBadge">${escapeHtml(NHVR_ENGINE_VERSION)}</span><span class="engineBadge">${escapeHtml(profile.name)}</span>`;
  if(findings.length){
    html += findings.slice(0,4).map(f=>`<div class="rule bad"><h3>${escapeHtml(f.title)}</h3><p>${escapeHtml(f.message)}</p><p>${escapeHtml(f.suggestion)}</p></div>`).join("");
  } else {
    html += `<div class="rule"><h3>No NHVR helper breach found on this page</h3><p>Uses rest-break anchored counting for short, 24h and longer periods.</p></div>`;
  }
  if(active.length){
    html += active.map(w=>{
      const pct = Math.min(100, (w.work/w.maxWork)*100);
      return `<div class="rule ${w.work>w.maxWork ? "bad" : ""}"><h3>${escapeHtml(w.label)} active window</h3><div class="bar"><div class="fill" style="width:${pct}%"></div></div><p>${formatMinsShort(w.work)} / max ${formatMinsShort(w.maxWork)}</p><p class="anchorNote">From ${escapeHtml(formatDateTimeForStats(w.startAbs))} to ${escapeHtml(formatDateTimeForStats(w.endAbs))}</p></div>`;
    }).join("");
  }
  return html;
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

  if(isPageCancelledOrSkipped(key)){
    add("info","Page is marked cancelled/skipped",`${pageStatusLabel(key)}${detail.pageStatusReason ? ": " + detail.pageStatusReason : ""}`,{type:"field", field:"sheetPageStatus"},"No fatigue calculation is applied to this marked page. Make sure the paper book also clearly shows the page was crossed out/cancelled or skipped, and use the correct next page number on the next usable page.");
    state.selectedDate = oldDate;
    return errors;
  }

  if(!pageUsesBookPage(key)){
    state.selectedDate = oldDate;
    return errors;
  }


  if(!detail.driverNameSnapshot && !(state.profile && state.profile.driverName)) add("error","Missing driver name","Driver name is empty for this page.",{type:"field", field:"pageDriverName"},fieldFix("driver name"));
  if(!detail.licenceNumberSnapshot && !(state.profile && state.profile.licenceNumber)) add("error","Missing licence number","Licence number is empty for this page.",{type:"field", field:"pageLicenceNumber"},fieldFix("licence number"));
  if(!detail.baseStateSnapshot && !(state.profile && state.profile.baseTimeZone)) add("error","Missing base state","Base state/time zone is empty for this page.",{type:"field", field:"pageBaseState"},"Choose the correct base state for this selected page. If your base changed from a date onward, update Settings with the correct effective date.");
  if(!detail.pageNo) add("warn","Missing page number","Page number is empty or not calculated.",{type:"field", field:"pagePageNo"},"Check Work diary book setup. Add first page date and first page number, or manually enter page number for this selected page.");
  if(!detail.workDiaryNo) add("warn","Missing work diary number","Work diary number is empty.",{type:"field", field:"pageWorkDiaryNo"},"Enter the work diary number for this page, or add it as a default in Settings so future pages fill automatically.");
  if(!detail.numberPlate) add("warn","Missing truck rego","Truck rego / number plate is empty.",{type:"field", field:"pageNumberPlate"},"Enter the truck rego for this selected page. If this truck continues from this date, update Default number plate with the correct effective date.");
  if(!detail.fitForDuty && !isAuditDismissed("fit_for_duty", key, "fit")){
    const beforeLen = errors.length;
    add("info","Fit for Duty not ticked","Fit for Duty is not ticked on this page.",{type:"field", field:"sheetFitForDuty"},"If this is not required for this page, tap Skip. If you were fit for duty and want it shown on the sheet, tick Fit for Duty.");
    errors[beforeLen].optionalDismiss = {kind:"fit_for_duty", date:key, extra:"fit", label:"Fit for Duty not ticked"};
  }
  const confidence = complianceIssuesForDate(key);
  confidence.blockers.forEach(b => add("error","Cannot safely calculate",b,{type:"section", section:"complianceConfidence"},"Fix the missing setup information before relying on due-break or fatigue advice."));
  confidence.issues.filter(x => x.includes("Rest type")).slice(0,3).forEach(x => add("warn","Missing rest type",x,{type:"section", section:"changeDetailsEditor"},"Select Rest / Stationary rest / Sleeper berth / Night rest so major rest and two-up checks can be safer."));

  if(detail.twoUpEnabled){
    if(!detail.twoUpDriverName) add("warn","Missing two-up driver name","Two-up is selected but driver name is empty.",{type:"field", field:"sheetTwoUpDriverName"},"Enter the two-up driver name, or untick two-up if you were not working two-up on this page.");
    if(!detail.twoUpLicenceNumber) add("warn","Missing two-up licence number","Two-up is selected but licence number is empty.",{type:"field", field:"sheetTwoUpLicenceNumber"},"Enter the two-up driver licence number, or untick two-up if not applicable.");
    if(!detail.twoUpScheme) add("warn","Missing two-up scheme","Two-up is selected but work/rest scheme is empty.",{type:"field", field:"sheetTwoUpScheme"},"Select the correct two-up scheme. If unsure, verify your work option/accreditation before relying on the helper calculation.");
  }

  const nhvrFindings = nhvrBreachesForDate(key);
  nhvrFindings.forEach(f => {
    add(f.severity || "error", f.title, f.message, f.focus || {type:"slot", slots:[]}, f.suggestion);
  });

  // Work/rest change rows: locations are important for matching paper diary.
  const changes = syncChangeRowsForDay(key);
  const detailRowsRequired = changes.filter(r => !rowDetailsNotRequired(r));
  const missingLocation = detailRowsRequired.filter(r => !r.location && !r.note);
  if(changes.length > 1 && missingLocation.length){
    const locKey = missingLocation.map(r => r.time).join(",");
    if(!isAuditDismissed("missing_location", key, locKey)){
      const beforeLen = errors.length;
      add("warn","Missing work/rest change locations",`${missingLocation.length} required-detail row(s) have no location/note.`,{type:"section", section:"changeDetailsEditor"},"Add the town/suburb/rest area or a note, or tick N/D only if odometer/location are genuinely not required for that row.");
      errors[beforeLen].optionalDismiss = {kind:"missing_location", date:key, extra:locKey, label:"Missing work/rest change locations"};
    }
  }

  const missingOdometer = detailRowsRequired.filter(r => !r.odometer);
  if(changes.length > 1 && missingOdometer.length){
    const odoKey = missingOdometer.map(r => r.time).join(",");
    if(!isAuditDismissed("missing_odometer", key, odoKey)){
      const beforeLen = errors.length;
      add("warn","Missing odometer readings",`${missingOdometer.length} required-detail row(s) have no odometer reading.`,{type:"section", section:"changeDetailsEditor"},"Enter odometer readings, or tick N/D only if odometer/location are genuinely not required for that row.");
      errors[beforeLen].optionalDismiss = {kind:"missing_odometer", date:key, extra:odoKey, label:"Missing odometer readings"};
    }
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
  holder.innerHTML = errors.slice(0,60).map((e,idx)=>{
    const opt = e.optionalDismiss ? `<button type="button" class="auditOptionalBtn" data-audit-dismiss="${idx}">Skip</button>` : "";
    return `
    <div class="auditItem ${e.severity}" data-audit-card="${idx}">
      <strong>${escapeHtml(e.title)}</strong>
      <span>${escapeHtml(e.message)}</span>
      <small>Date: ${escapeHtml(fmtDateLong(e.date))} • Page: ${escapeHtml(e.pageNo)}</small>
      <div class="suggestion"><strong>Possible fix:</strong> ${escapeHtml(e.suggestion)}</div>
      <div class="auditActions">
        <button type="button" class="auditOpenBtn" data-audit-index="${idx}">Open error</button>
        ${opt}
      </div>
    </div>`}).join("") + dismissedOptionalAuditHtml();
  holder.querySelectorAll("[data-audit-index]").forEach(btn=>{
    btn.onclick = () => openAuditError(errors[Number(btn.dataset.auditIndex)]);
  });
  holder.querySelectorAll("[data-audit-dismiss]").forEach(btn=>{
    btn.onclick = () => {
      const e = errors[Number(btn.dataset.auditDismiss)];
      if(e && e.optionalDismiss){
        dismissOptionalAudit(e.optionalDismiss.kind, e.optionalDismiss.date, e.optionalDismiss.extra, e.optionalDismiss.label);
      }
    };
  });
  bindAuditListDelegation(errors);
}

function bindAuditListDelegation(errors){
  const holder = $("drivingAuditList");
  if(!holder) return;
  holder.onclick = (ev)=>{
    const openBtn = ev.target.closest ? ev.target.closest("[data-audit-index]") : null;
    const dismissBtn = ev.target.closest ? ev.target.closest("[data-audit-dismiss]") : null;
    if(openBtn){
      ev.preventDefault();
      const e = errors[Number(openBtn.dataset.auditIndex)];
      openAuditError(e);
    } else if(dismissBtn){
      ev.preventDefault();
      const e = errors[Number(dismissBtn.dataset.auditDismiss)];
      if(e && e.optionalDismiss){
        dismissOptionalAudit(e.optionalDismiss.kind, e.optionalDismiss.date, e.optionalDismiss.extra, e.optionalDismiss.label);
      }
    }
  };
}

function safeSwitchTab(tabId){
  const target = $(tabId);
  if(!target) return;
  document.querySelectorAll(".tabbar button").forEach(b=>b.classList.toggle("active", b.dataset.tab === tabId));
  document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("active", s.id === tabId));
  const btn = document.querySelector(`.tabbar button[data-tab="${tabId}"]`);
  if(btn && $("screenTitle")) $("screenTitle").textContent = btn.querySelector("span").textContent;
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
  try{ renderAll(); }catch(e){ console.error("Render after audit open failed", e); }
  safeSwitchTab("diaryScreen");
  renderAuditFixPanel();
  setTimeout(()=>{
    clearAuditHighlights();
    let target = null;
    if(auditFocus.type === "field" && auditFocus.field){
      target = $(auditFocus.field);
      if(target){
        target.classList.add("auditField");
        try{ target.focus({preventScroll:true}); }catch(e){}
      }
    } else if(auditFocus.type === "section" && auditFocus.section){
      target = $(auditFocus.section);
      if(target) target.classList.add("auditFocusBox");
    } else {
      target = $("diaryGrid");
      if(target) target.classList.add("auditFocusBox");
    }
    if(target && target.scrollIntoView){
      target.scrollIntoView({behavior:"smooth", block:"center"});
    }
  }, 300);
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


function ensureShortBreakSettings(){
  if(!state.shortBreakSettings || typeof state.shortBreakSettings !== "object") state.shortBreakSettings = {mode:"smart", maxMinutes:60};
  if(!["manual","smart","strict"].includes(state.shortBreakSettings.mode)) state.shortBreakSettings.mode = "smart";
  const mins = Number(state.shortBreakSettings.maxMinutes || 60);
  state.shortBreakSettings.maxMinutes = [15,30,45,60].includes(mins) ? mins : 60;
}
function renderShortBreakSettings(){
  ensureShortBreakSettings();
  if($("shortBreakDetailMode")) $("shortBreakDetailMode").value = state.shortBreakSettings.mode;
  if($("shortBreakMaxMinutes")) $("shortBreakMaxMinutes").value = String(state.shortBreakSettings.maxMinutes);
}
function saveShortBreakSettings(){
  ensureShortBreakSettings();
  state.shortBreakSettings.mode = $("shortBreakDetailMode") ? $("shortBreakDetailMode").value : "smart";
  state.shortBreakSettings.maxMinutes = $("shortBreakMaxMinutes") ? Number($("shortBreakMaxMinutes").value || 60) : 60;
  addAuditLog("Short break details changed", `${state.shortBreakSettings.mode}; max ${state.shortBreakSettings.maxMinutes} minutes`);
  rebuildDerivedDiaryData();
  save();
  renderAll();
  if(typeof showToast === "function") showToast("Saved");
}

function compactChangeActivityLabel(a){
  return a === "work" ? "Work" : "Rest";
}

function hasExplicitDiaryDataForDate(key){
  if(!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  if(state.slots && Array.isArray(state.slots[key])) return true;
  if(state.dayDetails && state.dayDetails[key]) return true;
  if(Array.isArray(state.entries)){
    return state.entries.some(e => String(e.start || "").slice(0,10) === key || String(e.end || "").slice(0,10) === key);
  }
  return false;
}
function previousDateKey(key){
  return addDays(key, -1);
}
function isMidnightContinuationSegment(key, seg){
  if(!seg || seg.startMins !== 0) return false;
  const prevKey = previousDateKey(key);
  if(!hasExplicitDiaryDataForDate(prevKey)) return false;
  if(typeof calculationHistoryStartAbs === "function" && fromKey(prevKey).getTime() < calculationHistoryStartAbs()) return false;
  const prevLast = getSlot(prevKey, SLOTS_PER_DAY - 1);
  const curFirst = getSlot(key, 0);
  if(prevLast !== curFirst || curFirst !== seg.activity) return false;
  // Avoid treating a completely blank all-rest day as a continuation.
  if(curFirst === "rest" && !dayHasAnyWork(prevKey) && !dayHasAnyWork(key)) return false;
  return true;
}
function rowDetailsNotRequired(row){
  return !!(row && (row.noDetails || row.autoNoDetails));
}

function isAutoContinuationRow(row){
  return !!(row && row.autoNoDetails && row.autoReason === "continuation");
}
function isAutoShortReturnRow(row){
  return !!(row && row.autoNoDetails && row.autoReason === "shortBreakReturn");
}
function isShortRestBetweenWork(key, seg, segs){
  ensureShortBreakSettings();
  if(state.shortBreakSettings.mode === "strict" || state.shortBreakSettings.mode === "manual") return false;
  if(!seg || seg.activity !== "rest") return false;
  const idx = segs.indexOf(seg);
  const prev = segs[idx-1];
  const next = segs[idx+1];
  if(!prev || !next || prev.activity !== "work" || next.activity !== "work") return false;
  const dur = Math.max(0, seg.endMins - seg.startMins);
  return dur > 0 && dur <= Number(state.shortBreakSettings.maxMinutes || 60);
}
function isReturnToWorkAfterShortRest(key, seg, segs){
  ensureShortBreakSettings();
  if(state.shortBreakSettings.mode !== "smart") return false;
  if(!seg || seg.activity !== "work") return false;
  const idx = segs.indexOf(seg);
  const prev = segs[idx-1];
  const beforePrev = segs[idx-2];
  if(!prev || !beforePrev) return false;
  if(prev.activity !== "rest" || beforePrev.activity !== "work") return false;
  const dur = Math.max(0, prev.endMins - prev.startMins);
  return dur > 0 && dur <= Number(state.shortBreakSettings.maxMinutes || 60);
}

function rowDetailsLockLabel(row){
  if(row && row.autoNoDetails) return "Auto continuation";
  return "N/D";
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
    const continuation = isMidnightContinuationSegment(key, seg);
    const shortRest = isShortRestBetweenWork(key, seg, segs);
    const returnAfterShortRest = isReturnToWorkAfterShortRest(key, seg, segs);
    let autoNoDetails = false;
    let autoReason = "";
    if(continuation){
      autoNoDetails = true;
      autoReason = "continuation";
    }else if(returnAfterShortRest){
      autoNoDetails = true;
      autoReason = "shortBreakReturn";
    }
    const noDetails = autoNoDetails || !!prev.noDetails;
    let restType = prev.restType || (seg.activity === "rest" ? "" : "work");
    if(continuation){
      restType = "";
    }else if(shortRest && !prev.restType){
      restType = "rest";
    }else if(seg.activity === "work"){
      restType = "work";
    }
    return {
      time,
      activity: seg.activity,
      noDetails,
      autoNoDetails,
      autoReason,
      odometer: noDetails ? "" : (prev.odometer || ""),
      location: noDetails ? "" : (prev.location || ""),
      note: prev.note || (continuation ? "Continuation from previous day" : (returnAfterShortRest ? "Return after short break" : "")),
      restType
    };
  });
  return detail.changeRows;
}

function compactNHVRPlaceFromAddress(data){
  const addr = data && data.address ? data.address : {};
  const named = (data && data.name) ? String(data.name).trim() : "";
  const type = data && data.type ? String(data.type).toLowerCase() : "";
  const cls = data && data.class ? String(data.class).toLowerCase() : "";

  const poiTypes = ["fuel","service_station","rest_area","parking","truck_stop","services"];
  const looksLikeUsefulStop = named && (
    poiTypes.includes(type) ||
    poiTypes.includes(cls) ||
    /fuel|service|truck|rest|road house|roadhouse|bp|caltex|ampol|shell|mobil|liberty|united/i.test(named)
  );
  if(looksLikeUsefulStop) return named;

  const suburb = addr.suburb || addr.city_district || addr.neighbourhood;
  const town = addr.town || addr.city || addr.village || addr.hamlet || addr.locality || addr.municipality;
  if(suburb) return suburb;
  if(town) return town;

  const road = addr.road || addr.highway || addr.state_district || "";
  const near = addr.county || addr.region || addr.state || "";
  if(road && near) return `${road} near ${near}`;
  if(road) return road;
  if(near) return near;

  if(data && data.display_name){
    return String(data.display_name).split(",").slice(0,2).join(",").trim();
  }
  return "";
}

function compactNHVRPlaceFromBigDataCloud(data){
  if(!data) return "";
  const locality = data.locality || data.city || data.principalSubdivision || "";
  const localityInfo = data.localityInfo || {};
  const localities = Array.isArray(localityInfo.informative) ? localityInfo.informative : [];
  const useful = localities.find(x => x && x.name && /suburb|locality|town|village|city/i.test(String(x.description || x.order || "")));
  if(useful && useful.name) return useful.name;
  return locality;
}
function reverseGeocodeNHVR(lat, lon){
  const nominatim = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1&extratags=1&namedetails=1`;
  const bigData = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`;
  return fetch(nominatim, {headers: {"Accept": "application/json"}})
    .then(r => {
      if(!r.ok) throw new Error("Primary lookup failed");
      return r.json();
    })
    .then(data => compactNHVRPlaceFromAddress(data))
    .then(place => {
      if(place) return place;
      throw new Error("No primary place name");
    })
    .catch(() => fetch(bigData, {headers: {"Accept": "application/json"}})
      .then(r => {
        if(!r.ok) throw new Error("Backup lookup failed");
        return r.json();
      })
      .then(data => compactNHVRPlaceFromBigDataCloud(data)));
}

function getCurrentNHVRLocation(){
  return new Promise((resolve, reject) => {
    if(!navigator.geolocation){
      reject(new Error("Location is not supported on this device/browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const {latitude, longitude, accuracy} = pos.coords;
        reverseGeocodeNHVR(latitude, longitude)
          .then(place => {
            if(place) resolve({place, accuracy});
            else reject(new Error("Could not find a suitable suburb/town/rest-area name. Please type manually."));
          })
          .catch(err => reject(err));
      },
      err => {
        let msg = "Location permission was not allowed. On iPhone: Settings > Privacy & Security > Location Services > Safari Websites > While Using. Also check Safari website settings for this app.";
        if(err && err.code === 2) msg = "Current location is unavailable. Please check GPS/data and try again.";
        if(err && err.code === 3) msg = "Location request timed out. Please try again or type manually.";
        reject(new Error(msg));
      },
      {enableHighAccuracy:true, timeout:12000, maximumAge:60000}
    );
  });
}

function setChangeRowLocationFromCurrent(index, btn){
  const detail = ensureDayDetail(state.selectedDate);
  if(!detail.changeRows || !detail.changeRows[index]) return;
  if(rowDetailsNotRequired(detail.changeRows[index])){
    if(typeof showToast === "function") showToast("Details not required");
    return;
  }
  const oldText = btn ? btn.textContent : "";
  if(btn){
    btn.disabled = true;
    btn.textContent = "…";
  }
  getCurrentNHVRLocation()
    .then(({place, accuracy}) => {
      detail.changeRows[index].location = place;
      addAuditLog("Location filled from current position", `${state.selectedDate}: ${place}${accuracy ? " ("+Math.round(accuracy)+"m accuracy)" : ""}`);
      save();
      renderAll();
      showToast ? showToast("Location added") : alert("Location added");
    })
    .catch(err => {
      alert((err && err.message) ? err.message : "Could not get location. Please type manually.");
    })
    .finally(() => {
      if(btn){
        btn.disabled = false;
        btn.textContent = oldText || "📍";
      }
    });
}



function ensureChangeDetailsVisible(){
  const editor = $("changeDetailsEditor");
  if(editor){
    editor.hidden = false;
    editor.style.display = "block";
    editor.style.visibility = "visible";
    editor.style.opacity = "1";
  }
}

function renderChangeDetailsEditor(){
  ensureChangeDetailsVisible();
  const holder = $("changeDetailsEditor");
  if(!holder) return;
  const rows = syncChangeRowsForDay(state.selectedDate);
  if(!rows.length){
    holder.innerHTML = `<p class="hint">No work/rest changes yet.</p>`;
    return;
  }
  const htmlRows = rows.map((r, i) => {
    const locked = rowDetailsNotRequired(r);
    const continuation = isAutoContinuationRow(r);
    const returnShort = isAutoShortReturnRow(r);
    const disabled = locked ? "disabled" : "";
    const lockTitle = continuation ? "Continuation from previous day — not a new details/rest-type row" :
      (returnShort ? "Return to work after short break — odometer/location not required" :
      "Tick if odometer/location are not required for this row");
    let restCell = "";
    if(continuation){
      restCell = `<span class="continuationBadge">Continuation</span>`;
    }else if(r.activity === "rest"){
      restCell = `
          <select class="restTypeSelect" data-change-index="${i}" data-change-field="restType">
            <option value="" ${!r.restType ? "selected" : ""}>Select rest type</option>
            <option value="rest" ${r.restType==="rest" ? "selected" : ""}>Rest</option>
            <option value="stationary" ${r.restType==="stationary" ? "selected" : ""}>Stationary rest</option>
            <option value="sleeper" ${r.restType==="sleeper" ? "selected" : ""}>Sleeper berth rest</option>
            <option value="night" ${r.restType==="night" ? "selected" : ""}>Night rest</option>
            <option value="24h" ${r.restType==="24h" ? "selected" : ""}>24h rest</option>
          </select>${r.restType === "rest" ? `<span class="shortBreakBadge">Rest</span>` : ""}`;
    }else{
      restCell = `<span class="readonlyCell">Work</span>`;
    }
    return `
    <tr class="${locked ? "detailsLockedRow" : ""} ${continuation ? "continuationRow" : ""}">
      <td class="ndCell" title="${escapeHtml(lockTitle)}">
        <input type="checkbox" class="ndCheck" data-change-index="${i}" data-change-field="noDetails" ${r.noDetails ? "checked" : ""} ${r.autoNoDetails ? "disabled" : ""}>
      </td>
      <td class="readonlyCell timeCell">${escapeHtml(r.time)}</td>
      <td class="readonlyCell activityCell">${escapeHtml(compactChangeActivityLabel(r.activity))}</td>
      <td><input data-change-index="${i}" data-change-field="odometer" inputmode="numeric" pattern="[0-9]*" data-numeric-only="true" value="${locked ? "" : escapeHtml(r.odometer)}" placeholder="${locked ? "N/D" : "Odometer"}" ${disabled}></td>
      <td>
        <div class="locPickerWrap">
          <input data-change-index="${i}" data-change-field="location" value="${locked ? "" : escapeHtml(r.location)}" placeholder="${locked ? "N/D" : "Suburb/town/rest area"}" ${disabled}>
          <button type="button" class="locBtn" data-location-index="${i}" title="Use current location" ${disabled}>📍</button>
        </div>
      </td>
      <td>${restCell}</td>
      <td><input data-change-index="${i}" data-change-field="note" value="${escapeHtml(r.note)}" placeholder="${continuation ? "Continuation" : (locked ? "Reason optional" : "Optional")}"></td>
    </tr>`;
  }).join("");
  holder.innerHTML = `
    <table class="changeTable">
      <thead><tr><th>N/D</th><th>Time</th><th>Activity</th><th>Odometer</th><th>Location</th><th>Rest type</th><th>Note</th></tr></thead>
      <tbody>${htmlRows}</tbody>
    </table>`;
  ensureChangeDetailsVisible();
}

function svgText(x, y, text, size=12, fill="#111", weight="400", extra=""){
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" font-family="Arial, Helvetica, sans-serif" ${extra}>${escapeHtml(text || "")}</text>`;
}
function wrapSvgTextLines(text, maxChars=74, maxLines=4){
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if(!raw) return [];
  const words = raw.split(" ");
  const lines = [];
  let line = "";
  words.forEach(w=>{
    if((line + " " + w).trim().length <= maxChars){
      line = (line + " " + w).trim();
    }else{
      if(line) lines.push(line);
      line = w;
    }
  });
  if(line) lines.push(line);
  if(lines.length > maxLines){
    const kept = lines.slice(0, maxLines);
    kept[maxLines-1] = kept[maxLines-1].slice(0, Math.max(0, maxChars-1)).replace(/\s+$/,"") + "…";
    return kept;
  }
  return lines;
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
    return `${svgRect(bx,y,boxW,boxH,"#fff","#111",1)}${svgText(bx+boxW/2,y+17,l,fontSize,"#111","400",'text-anchor="middle"')}${on ? svgText(bx+boxW/2-4,y+boxH-3,"X",fontSize+4,"#1439d6","700") : ""}`;
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

function selectedPageStatus(key=state.selectedDate){
  const d = ensureDayDetail(key);
  return d.pageStatus || "active";
}
function isPageCancelledOrSkipped(key=state.selectedDate){
  const s = selectedPageStatus(key);
  return s === "cancelled" || s === "skipped";
}
function pageStatusLabel(key=state.selectedDate){
  const s = selectedPageStatus(key);
  if(s === "cancelled") return "CANCELLED / VOID PAGE";
  if(s === "skipped") return "SKIPPED / UNUSED PAGE";
  return "ACTIVE PAGE";
}
function renderPageStatusBanner(){
  const alerts = $("alerts");
  if(!alerts) return "";
  return "";
}

function buildPaperSheetHtml(){
  ensureProfile();
  const key = state.selectedDate;
  applyAutoDefaultsToDay(key);
  const detail = ensureDayDetail(key);
  const pageStatus = detail.pageStatus || "active";
  const pageStatusText = pageStatusLabel(key);
  const pageStatusReason = detail.pageStatusReason || "";
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

  const W = 1120, H = 732;
  const dark = "#555";
  const blue = "#1439d6";
  const red = "#d82626";

  const sectionX = 28;
  const sectionY = 178;
  const sectionW = 1064;
  const sectionH = 410;
  const verticalW = 44;
  const labelW = 105;
  const gridX = sectionX + verticalW + labelW;
  const gridRight = 986;
  const sideRight = 1092;
  const slotW = (gridRight - gridX) / 96;

  const commentBottom = 246;
  const odoBottom = 332;
  const locBottom = 432;
  const twoUpBottom = 455;
  const numberBottom = 480;
  const workBottom = 535;
  const restBottom = 588;

  const workY = 508;
  const restY = 561;

  const gridLines = [];
  for(let i=0;i<=24;i++){
    const x = gridX + i*4*slotW;
    gridLines.push(svgLine(x,commentBottom,x,numberBottom,"#111",1));
  }
  for(let i=0;i<=96;i++){
    const x = gridX + i*slotW;
    const major = i%4===0;
    gridLines.push(svgLine(x,numberBottom,x,restBottom,major ? "#111" : "#777",major ? 1 : .55));
  }

  const hourNums = [];
  for(let h=0; h<=24; h++){
    const x = gridX + h*4*slotW;
    const n = h === 0 || h === 24 ? "12" : (h > 12 ? String(h-12) : String(h));
    hourNums.push(svgText(x,476,n,14,"#111","400",'text-anchor="middle"'));
    hourNums.push(svgText(x,606,n,14,"#111","400",'text-anchor="middle"'));
  }

  const getY = (slotIndex) => getSlot(key, slotIndex) === "work" ? workY : restY;
  let lineD = `M ${gridX} ${getY(0)}`;
  for(let i=0;i<96;i++){
    const y = getY(i);
    const nextY = i < 95 ? getY(i+1) : y;
    const xEnd = gridX + (i+1)*slotW;
    lineD += ` L ${xEnd} ${y}`;
    if(i < 95 && nextY !== y) lineD += ` L ${xEnd} ${nextY}`;
  }

  const changeText = [];
  changeRows.slice(0,22).forEach(r => {
    if(rowDetailsNotRequired(r)) return;
    const mins = timeToMins(r.time);
    const x = gridX + (mins/15)*slotW + 9;
    if(r.odometer){
      changeText.push(`<text transform="translate(${x},318) rotate(-90)" font-size="12" fill="${blue}" font-weight="700" font-family="Arial">${escapeHtml(r.odometer)}</text>`);
    }
    const loc = r.location || r.note || "";
    if(loc){
      changeText.push(`<text transform="translate(${x},420) rotate(-90)" font-size="12" fill="${blue}" font-weight="700" font-family="Arial">${escapeHtml(loc)}</text>`);
    }
  });

  const stateBoxes = svgBoxedLetters(382,134,["ACT","NSW","NT","QLD","SA","TAS","VIC","WA"],base,38,24,10);
  const dayBoxes = svgBoxedLetters(520,86,["S","M","T","W","T","F","S"],dayIdx,25,25,11);
  const twoUpScheme = detail.twoUpScheme || "BFM";
  const twoUpState = detail.twoUpBaseState || "";
  const twoUpStates = svgBoxedLetters(665,697,["ACT","NSW","NT","QLD","SA","TAS","VIC","WA"],twoUpState,30,24,9);

  const workRestOptions =
    svgCheckbox(700,86,"Standard",isStandard,12) +
    svgCheckbox(778,86,"Standard Bus",false,12) +
    svgCheckbox(700,112,"BFM",isBFM,12) +
    svgCheckbox(778,112,"AFM",isAFM,12) +
    svgCheckbox(700,138,"Fit for Duty",!!detail.fitForDuty,12);

  const twoUpCheck =
    svgCheckbox(880,661,"Standard",detail.twoUpEnabled && twoUpScheme==="Standard",12) +
    svgCheckbox(950,661,"BFM",detail.twoUpEnabled && twoUpScheme==="BFM",12) +
    svgCheckbox(1000,661,"AFM",detail.twoUpEnabled && twoUpScheme==="AFM",12);

  const comments = wrapSvgTextLines(detail.comments || "", 74, 4).map((line,i)=>svgText(gridX+8,194+i*13,line,10,blue,"700")).join("");

  const svg = `
  <svg class="realDiarySvg" viewBox="0 0 ${W} ${H}" width="100%" height="auto" role="img" aria-label="National Work Diary Daily Sheet">
    <rect x="0" y="0" width="${W}" height="${H}" fill="white"/>

    ${svgText(560,28,"NATIONAL WORK DIARY DAILY SHEET",17,"#111","700",'text-anchor="middle"')}
    ${svgText(790,39,"WORK DIARY NO.",10,"#111","700")}
    ${svgText(925,39,workDiaryNo,18,"#111","700")}
    ${svgText(990,39,pageNo,18,red,"700")}

    <rect x="28" y="50" width="1064" height="24" fill="${dark}"/>
    ${svgText(560,67,"DRIVER IDENTIFICATION",15,"#fff","700",'text-anchor="middle"')}

    ${svgText(34,88,"Driver's Name:",9)}
    ${svgRect(34,92,348,26)}
    ${svgText(208,109,driver,16,blue,"700",'text-anchor="middle"')}

    ${svgText(392,88,"Date:",9)}
    ${svgRect(392,92,126,26)}
    ${svgText(455,109,dateStr,15,blue,"700",'text-anchor="middle"')}

    ${svgText(522,82,"Day of the Week:",9)}
    ${dayBoxes}

    ${svgText(700,82,"Driver",9)}
    ${workRestOptions}

    ${svgText(888,82,"Time of daily check (if required):",8)}
    ${svgRect(888,92,192,26)}
    ${svgText(984,109,detail.dailyCheckTime || "",14,blue,"700",'text-anchor="middle"')}

    ${svgText(34,130,"License No:",9)}
    ${svgRect(34,134,178,28)}
    ${svgText(123,153,licence,15,blue,"700",'text-anchor="middle"')}

    ${svgText(225,130,"Number Plate:",9)}
    ${svgRect(225,134,145,28)}
    ${svgText(297,153,plate,15,blue,"700",'text-anchor="middle"')}

    ${svgText(382,130,"Time Zone: State/Territory (Driver Base)",9)}
    ${stateBoxes}

    ${svgRect(sectionX,sectionY,verticalW,sectionH,dark,dark)}
    <text transform="translate(${sectionX+28},${sectionY+sectionH/2}) rotate(-90)" font-size="17" fill="#fff" font-weight="700" font-family="Arial" text-anchor="middle">DETAILS OF ACTIVITIES FOR THIS DAY</text>

    ${svgRect(sectionX+verticalW,sectionY,sectionW-verticalW,sectionH)}
    ${svgLine(sectionX+verticalW,commentBottom,sideRight,commentBottom)}
    ${svgLine(sectionX+verticalW,odoBottom,gridRight,odoBottom)}
    ${svgLine(sectionX+verticalW,locBottom,gridRight,locBottom)}
    ${svgLine(sectionX+verticalW,twoUpBottom,gridRight,twoUpBottom)}
    ${svgLine(sectionX+verticalW,numberBottom,sideRight,numberBottom)}
    ${svgLine(sectionX+verticalW,workBottom,sideRight,workBottom)}
    ${svgLine(sectionX+verticalW,restBottom,sideRight,restBottom)}
    ${svgLine(gridX,sectionY,gridX,restBottom)}
    ${svgLine(gridRight,commentBottom,gridRight,restBottom)}
    ${svgLine(1018,numberBottom,1018,restBottom)}

    ${svgText(78,192,"Number Plate",10)}
    ${svgText(78,205,"Change and",10)}
    ${svgText(78,218,"Comments",10)}
    ${svgText(78,231,"(optional)",8)}
    ${comments}

    ${svgText(78,290,"Odometer",10)}
    ${svgText(78,304,"Reading",10)}

    ${svgText(78,362,"Name of",10)}
    ${svgText(78,376,"Location at",10)}
    ${svgText(78,390,"Work and",10)}
    ${svgText(78,404,"Rest Change",10)}
    ${svgText(78,418,"(suburb/town)",8)}

    ${svgText(78,448,"Two-up",10)}
    ${svgText(78,507,"My Work",10)}
    ${svgText(78,561,"My Rest",10)}

    ${svgText(998,288,"Space for your",8)}
    ${svgText(998,300,"work/rest hours",8)}
    ${svgText(998,312,"(optional)",8)}

    ${gridLines.join("")}
    ${hourNums.join("")}
    ${changeText.join("")}
    <path d="${lineD}" fill="none" stroke="${blue}" stroke-width="2.2"/>

    ${svgText(1028,456,"All drivers:",8)}
    ${svgText(1028,467,"calculate totals",8)}
    ${svgText(1052,494,"Total Work:",10,"#111","700",'text-anchor="middle"')}
    ${svgText(1052,518,`${Math.floor(totals.work/60)}h ${totals.work%60}m`,17,blue,"700",'text-anchor="middle"')}
    ${svgText(1052,545,"Total Rest:",10,"#111","700",'text-anchor="middle"')}
    ${svgText(1052,570,`${Math.floor(totals.rest/60)}h ${totals.rest%60}m`,17,blue,"700",'text-anchor="middle"')}

    ${svgText(32,612,"Driver Signature:",10)}
    ${svgText(32,639,"To the best of my knowledge and belief the information I have recorded on this",8)}
    ${svgText(32,651,"daily sheet is true and correct",8)}
    ${svgRect(32,662,350,34)}

    <rect x="405" y="610" width="688" height="24" fill="${dark}"/>
    ${svgText(749,627,"TWO-UP DRIVER'S IDENTIFICATION",15,"#fff","700",'text-anchor="middle"')}

    ${svgText(405,648,"Two-up Driver's Name:",9)}
    ${svgRect(405,653,220,28)}
    ${svgText(515,672,detail.twoUpEnabled ? detail.twoUpDriverName || "" : "",13,blue,"700",'text-anchor="middle"')}

    ${svgText(645,648,"Two-up Driver's License No:",9)}
    ${svgRect(645,653,210,28)}
    ${svgText(750,672,detail.twoUpEnabled ? detail.twoUpLicenceNumber || "" : "",13,blue,"700",'text-anchor="middle"')}

    ${svgText(880,648,"Two-up Driver",9)}
    ${twoUpCheck}

    ${svgText(405,692,"Two-up Driver's Work Diary & Page No:",9)}
    ${svgRect(405,697,220,26)}

    ${svgText(665,692,"Two-up Driver's License issued:",9)}
    ${twoUpStates}

    ${svgText(930,692,"Two-up Driver Signature:",9)}
    ${svgRect(930,697,163,26)}

    ${pageStatus !== "active" ? `<text x="560" y="400" font-size="70" fill="rgba(210,0,0,.22)" font-weight="900" font-family="Arial" text-anchor="middle" transform="rotate(-20 560 400)">${escapeHtml(pageStatusText)}</text>` : ""}
    ${pageStatus !== "active" ? svgText(560,435,pageStatusReason,16,red,"700",'text-anchor="middle"') : ""}
  </svg>`;

  const banner = pageStatus !== "active" ? `<div class="statusBanner ${pageStatus === "skipped" ? "skipped" : ""}">${escapeHtml(pageStatusText)}${pageStatusReason ? ": " + escapeHtml(pageStatusReason) : ""}</div>` : "";
  return `<div class="paperSheet realBookSheet">${banner}${svg}</div>`;
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
  setVal("pageLicenceNumber", (detail.licenceNumberSnapshot || state.profile.licenceNumber || "").replace(/\D+/g, ""));
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
  detail.licenceNumberSnapshot = $("pageLicenceNumber").value.replace(/\D+/g, "");
  detail.baseStateSnapshot = $("pageBaseState").value;
  detail.workDiaryNo = cleanWorkDiaryNoInput($("pageWorkDiaryNo").value);
  detail.pageNo = cleanPageNumberInput($("pagePageNo").value);
  detail.numberPlate = $("pageNumberPlate").value.trim().toUpperCase();

  detail.workDiaryNoManual = true;
  detail.pageNoManual = true;
  detail.numberPlateManual = true;
  detail.selectedPageManual = true;

  save();
  if($("unlockPageEdit")) $("unlockPageEdit").checked = false;
  renderAll();
  addAuditLog("Selected page edited", `Updated selected page only: ${state.selectedDate}`); save(); showToast("Saved");
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
  addAuditLog("Selected page restored", `Restored selected page from defaults: ${state.selectedDate}`); save(); showToast("Restored");
}

function renderGraphForm(){
  const detail = ensureDayDetail(state.selectedDate);
  const setVal = (id, value) => { const el=$(id); if(el && el.value !== String(value ?? "")) el.value = value ?? ""; };
  const setChk = (id, value) => { const el=$(id); if(el) el.checked = !!value; };
  setVal("sheetWorkDiaryNo", detail.workDiaryNo);
  setVal("sheetPageNo", detail.pageNo);
  setVal("sheetPageStatus", detail.pageStatus || "active");
  setVal("sheetPageStatusReason", detail.pageStatusReason || "");
  setChk("sheetUsePage", !!detail.usePage);
  setVal("sheetNumberPlate", detail.numberPlate);
  setVal("sheetDailyCheckTime", detail.dailyCheckTime);
  const comments = $("sheetComments"); if(comments && comments.value !== String(detail.comments || "")) comments.value = detail.comments || "";
  setChk("sheetFitForDuty", detail.fitForDuty);
  setChk("sheetTwoUpEnabled", detail.twoUpEnabled);
  setVal("sheetTwoUpDriverName", detail.twoUpDriverName);
  setVal("sheetTwoUpLicenceNumber", (detail.twoUpLicenceNumber || "").replace(/\D+/g, ""));
  setVal("sheetTwoUpScheme", detail.twoUpScheme || "BFM");
  setVal("sheetTwoUpBaseState", detail.twoUpBaseState);
}
function updateDayDetailFromGraphForm(e){
  const detail = ensureDayDetail(state.selectedDate);
  const oldPageStatus = detail.pageStatus || "active";
  const oldUsePage = !!detail.usePage;
  document.querySelectorAll("[data-day-detail]").forEach(el => {
    const key = el.dataset.dayDetail;
    detail[key] = el.type === "checkbox" ? !!el.checked : el.value;
  });
  if(e && e.target && e.target.id === "sheetUsePage"){
    detail.usePageManual = true;
  }else if(detail.usePage !== oldUsePage && $("sheetUsePage") && document.activeElement === $("sheetUsePage")){
    detail.usePageManual = true;
  }
  detail.numberPlate = (detail.numberPlate || "").toUpperCase();
  detail.twoUpLicenceNumber = (detail.twoUpLicenceNumber || "").replace(/\D+/g, "");
  detail.pageNo = cleanPageNumberInput(detail.pageNo);
  detail.workDiaryNo = cleanWorkDiaryNoInput(detail.workDiaryNo);
  if((detail.pageStatus || "active") !== oldPageStatus){
    addAuditLog("Page status changed", `${state.selectedDate}: ${oldPageStatus} -> ${detail.pageStatus || "active"}. ${detail.pageStatusReason || ""}`);
  }
  const calcPage = calculatedPageNumberForDate(state.selectedDate);
  detail.pageNoManual = !!(pageNumberDigits(detail.pageNo) && !samePageNumber(detail.pageNo, calcPage));
  recomputeAutoPageNumbers();
  saveSoon();
  renderDiaryFast();
  const active = document.querySelector(".screen.active");
  if(active && active.id === "drivingScreen") renderAuditList();
}

function saveDailySheetDetails(){
  updateDayDetailFromGraphForm();
  autoSaveRegistryFromDiaryPage(state.selectedDate);
  rebuildDerivedDiaryData();
  flushSaveSoon();
  save();
  renderDiaryFast();
  const active = document.querySelector(".screen.active");
  if(active && active.id === "drivingScreen") renderAuditList();
  if(typeof showToast === "function") showToast("Saved");
}

function handleChangeDetailsInput(e){
  const target = e.target;
  if(!target || !target.dataset) return;
  const idx = Number(target.dataset.changeIndex);
  const field = target.dataset.changeField;
  if(Number.isNaN(idx) || !field) return;
  const detail = ensureDayDetail(state.selectedDate);
  if(!Array.isArray(detail.changeRows)) detail.changeRows = [];
  if(!detail.changeRows[idx]) return;

  if(field === "noDetails"){
    detail.changeRows[idx].noDetails = !!target.checked;
    if(detail.changeRows[idx].noDetails){
      detail.changeRows[idx].odometer = "";
      detail.changeRows[idx].location = "";
    }
    saveSoon();
    renderChangeDetailsEditor();
    return;
  }

  if(rowDetailsNotRequired(detail.changeRows[idx]) && (field === "odometer" || field === "location")){
    target.value = "";
    return;
  }

  detail.changeRows[idx][field] = target.type === "checkbox" ? !!target.checked : target.value;
  saveSoon();
  ensureChangeDetailsVisible();
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
function dayHasAnyWork(key){
  const arr = (state.slots && Array.isArray(state.slots[key])) ? state.slots[key] : [];
  if(arr.some(v => v === "work")) return true;
  return (state.entries || []).some(e => (e.activity === "work") && (String(e.start || "").slice(0,10) === key || String(e.end || "").slice(0,10) === key));
}

function bookId(){
  return `book_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
}
function normalizeDiaryBook(b){
  return {
    id: b && b.id || bookId(),
    diaryNo: cleanWorkDiaryNoInput(b && (b.diaryNo || b.defaultWorkDiaryNo) || ""),
    firstPageNumber: cleanPageNumberInput(b && (b.firstPageNumber || b.firstPageNo) || ""),
    startDate: b && (b.startDate || b.firstPageDate) || state.selectedDate || toKey(new Date()),
    endDate: b && b.endDate || "",
    lastPageNumber: cleanPageNumberInput(b && b.lastPageNumber || ""),
    status: b && b.status === "closed" ? "closed" : "active",
    notes: b && b.notes || "",
    createdAt: b && b.createdAt || new Date().toISOString(),
    updatedAt: b && b.updatedAt || new Date().toISOString()
  };
}
function ensureDiaryBooks(){
  if(!Array.isArray(state.diaryBooks)) state.diaryBooks = [];
  ensureBookSettings();
  if(!state.diaryBooks.length){
    const startDate = state.bookSettings.firstPageDate || state.selectedDate || toKey(new Date());
    state.diaryBooks.push(normalizeDiaryBook({
      diaryNo: state.bookSettings.defaultWorkDiaryNo || "",
      firstPageNumber: state.bookSettings.firstPageNumber || "",
      startDate,
      status: "active",
      notes: "Created from existing book setup."
    }));
  }else{
    state.diaryBooks = state.diaryBooks.map(normalizeDiaryBook);
  }
  state.diaryBooks.sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate)));
}
function diaryBookForDate(key){
  ensureDiaryBooks();
  let chosen = null;
  for(const b of state.diaryBooks){
    if(b.startDate && b.startDate <= key) chosen = b;
  }
  return chosen || state.diaryBooks[0] || null;
}
function activeDiaryBook(){
  ensureDiaryBooks();
  const active = [...state.diaryBooks].reverse().find(b => b.status !== "closed");
  return active || diaryBookForDate(state.selectedDate);
}
function syncBookSettingsFromBook(book){
  if(!book) return;
  ensureBookSettings();
  state.bookSettings.firstPageDate = book.startDate || state.bookSettings.firstPageDate || state.selectedDate;
  state.bookSettings.firstPageNumber = cleanPageNumberInput(book.firstPageNumber || state.bookSettings.firstPageNumber || "");
  state.bookSettings.defaultWorkDiaryNo = cleanWorkDiaryNoInput(book.diaryNo || state.bookSettings.defaultWorkDiaryNo || "");
}
function usedBookPageDatesUpToInBook(key, book){
  const firstDate = book && book.startDate || state.bookSettings.firstPageDate || key;
  const endDate = book && book.endDate || key;
  const dates = new Set();
  Object.keys(state.dayDetails || {}).forEach(d => dates.add(d));
  Object.keys(state.slots || {}).forEach(d => dates.add(d));
  (state.entries || []).forEach(e => {
    if(e.start) dates.add(String(e.start).slice(0,10));
    if(e.end) dates.add(String(e.end).slice(0,10));
  });
  dates.add(key);
  return [...dates].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= firstDate && d <= key && (!book || !book.endDate || d <= endDate) && pageUsesBookPage(d)).sort();
}
function renderDiaryBookHistory(){
  ensureDiaryBooks();
  const list = $("bookHistoryList");
  if(!list) return;

  const formatDMY = (key) => {
    if(!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return "";
    const [y,m,d] = key.split("-");
    return `${d}/${m}/${y}`;
  };

  const books = [...state.diaryBooks].sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate)));
  const rows = books.map((b, i) => {
    const bookTitle = b.status === "closed" ? `Book ${i+1}` : `Book ${i+1} - Active`;
    const closedLine = b.endDate ? `<small><b>Closed:</b> ${escapeHtml(formatDMY(b.endDate))}</small>` : "";
    const lastPageLine = b.lastPageNumber ? `<small><b>Last page:</b> ${escapeHtml(b.lastPageNumber)}</small>` : "";
    const notes = b.notes ? `<small><b>Notes:</b> ${escapeHtml(b.notes)}</small>` : "";
    return `<div class="bookHistoryItem">
      <strong>${escapeHtml(bookTitle)}</strong>
      <small><b>Starts:</b> ${escapeHtml(formatDMY(b.startDate))}</small>
      <small><b>First page:</b> ${escapeHtml(b.firstPageNumber || "not set")}</small>
      ${closedLine}
      ${lastPageLine}
      ${notes}
    </div>`;
  }).join("");

  list.innerHTML = rows || `<p class="hint">No diary books recorded yet.</p>`;
  if($("closeBookDate")) $("closeBookDate").value = $("closeBookDate").value || state.selectedDate;
  if($("newBookStartDate")) $("newBookStartDate").value = $("newBookStartDate").value || state.selectedDate;
}
function closeCurrentDiaryBook(){
  ensureDiaryBooks();
  const closeDate = $("closeBookDate") ? $("closeBookDate").value || state.selectedDate : state.selectedDate;
  const book = diaryBookForDate(closeDate) || activeDiaryBook();
  if(!book){ alert("No diary book found to close."); return; }
  if(!confirm(`Close diary book ${book.diaryNo || ""} on ${closeDate}?`)) return;
  book.endDate = closeDate;
  book.lastPageNumber = cleanPageNumberInput($("closeBookLastPage") ? $("closeBookLastPage").value : "");
  book.notes = ($("closeBookNotes") ? $("closeBookNotes").value.trim() : "") || book.notes || "";
  book.status = "closed";
  book.updatedAt = new Date().toISOString();
  addAuditLog("Diary book closed", `${book.diaryNo || ""} closed on ${closeDate}${book.lastPageNumber ? " at page "+book.lastPageNumber : ""}`);
  save();
  renderBookSettings();
  recomputeAutoPageNumbers();
  refreshCurrentPageData({forceDefaults:false});
  showToast("Book closed");
}
function startNewDiaryBook(){
  ensureDiaryBooks();
  const startDate = $("newBookStartDate") ? $("newBookStartDate").value || state.selectedDate : state.selectedDate;
  const diaryNo = cleanWorkDiaryNoInput($("newBookDiaryNo") ? $("newBookDiaryNo").value : "");
  const firstPage = cleanPageNumberInput($("newBookFirstPageNo") ? $("newBookFirstPageNo").value : "");
  const notes = $("newBookNotes") ? $("newBookNotes").value.trim() : "";
  if(!startDate || !firstPage){ alert("Please enter the new book start date and first page number."); return; }
  const prevDay = addDays(startDate, -1);
  state.diaryBooks.forEach(b => {
    if(b.status !== "closed" && b.startDate < startDate){
      b.endDate = b.endDate || prevDay;
      b.status = "closed";
      b.updatedAt = new Date().toISOString();
    }
  });
  const existingIdx = state.diaryBooks.findIndex(b => b.startDate === startDate);
  const rec = normalizeDiaryBook({
    id: existingIdx >= 0 ? state.diaryBooks[existingIdx].id : bookId(),
    diaryNo,
    firstPageNumber: firstPage,
    startDate,
    endDate: "",
    status: "active",
    notes,
    createdAt: existingIdx >= 0 ? state.diaryBooks[existingIdx].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  if(existingIdx >= 0) state.diaryBooks[existingIdx] = rec;
  else state.diaryBooks.push(rec);
  state.diaryBooks.sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate)));
  syncBookSettingsFromBook(rec);
  saveSettingsRecord(startDate);
  recomputeAutoPageNumbers();
  updateFutureDailyDetailsFromEffectiveDate(startDate);
  addAuditLog("New diary book started", `${diaryNo || "No diary no"} starts ${startDate} at page ${firstPage}`);
  save();
  renderBookSettings();
  refreshCurrentPageData({forceDefaults:false});
  showToast("New book started");
}

function pageUsesBookPage(key){
  const d = ensureDayDetail(key);
  const status = d.pageStatus || "active";
  if(status === "cancelled" || status === "skipped") return true;
  if(d.usePage) return true;
  if(dayHasAnyWork(key)) return true;
  if(d.pageNoManual && d.pageNo) return true;
  return false;
}
function usedBookPageDatesUpTo(key){
  const book = diaryBookForDate(key);
  return usedBookPageDatesUpToInBook(key, book);
}
function calculatedPageNumberForDate(key){
  ensureBookSettings();
  ensureDiaryBooks();
  if(!state.bookSettings.autoPageNumber) return "";
  const book = diaryBookForDate(key);
  if(!book) return "";
  if(book.endDate && key > book.endDate) return "";
  const firstDigits = pageNumberDigits(book.firstPageNumber || state.bookSettings.firstPageNumber);
  const first = Number(firstDigits);
  if(!first || !book.startDate) return "";
  if(!pageUsesBookPage(key)) return "";
  const usedDates = usedBookPageDatesUpToInBook(key, book);
  const index = usedDates.indexOf(key);
  if(index < 0) return "";
  return formatPageNumberLikeTemplate(String(first + index), book.firstPageNumber || state.bookSettings.firstPageNumber);
}


function repairStaleAutoPageState(){
  const dates = allKnownDiaryDates();
  dates.forEach(k => {
    const d = ensureDayDetail(k);
    const status = d.pageStatus || "active";
    const hasWork = dayHasAnyWork(k);
    if(status === "active" && !hasWork && !d.usePageManual && !d.pageNoManual){
      d.usePage = false;
      d.pageNo = "";
    }
  });
}
function rebuildDerivedDiaryData(){
  if(typeof flushSaveSoon === "function") flushSaveSoon();
  allKnownDiaryDates().forEach(k => {
    applyAutoDefaultsToDay(k);
    syncChangeRowsForDay(k);
  });
  repairStaleAutoPageState();
  recomputeAutoPageNumbers();
  allKnownDiaryDates().forEach(k => syncChangeRowsForDay(k));
}

function recomputeAutoPageNumbers(){
  ensureBookSettings();
  if(!state.bookSettings.autoPageNumber) return;
  if(typeof repairStaleAutoPageState === "function") repairStaleAutoPageState();
  const dates = new Set();
  Object.keys(state.dayDetails || {}).forEach(d => dates.add(d));
  Object.keys(state.slots || {}).forEach(d => dates.add(d));
  (state.entries || []).forEach(e => {
    if(e.start) dates.add(String(e.start).slice(0,10));
    if(e.end) dates.add(String(e.end).slice(0,10));
  });
  [...dates].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().forEach(d => {
    const detail = ensureDayDetail(d);
    if(!detail.pageNoManual){
      detail.pageNo = calculatedPageNumberForDate(d) || "";
    }
  });
}

function applyAutoDefaultsToDay(key){
  ensureBookSettings();
  ensureSettingsHistory();
  ensureRuleHistory();

  const rec = currentSettingsRecordForDate(key);
  const rule = ruleRecordForDate(key);
  const detail = ensureDayDetail(key);

  // Effective-date driver/base defaults carry forward unless this page was manually edited.
  if(!detail.selectedPageManual){
    detail.driverNameSnapshot = rec.driverName || state.profile.driverName || "";
    detail.licenceNumberSnapshot = (rec.licenceNumber || state.profile.licenceNumber || "").replace(/\D+/g, "");
    detail.baseStateSnapshot = rec.baseTimeZone || state.profile.baseTimeZone || detail.baseStateSnapshot || "NSW";
  }

  // Effective-date work option/rule carries forward unless this page was manually edited.
  if(!detail.ruleManual){
    detail.ruleScheme = rule.scheme || state.scheme || "BFM";
    detail.driverMode = rule.mode || "solo";
    detail.twoUpEnabled = detail.driverMode === "twoUp";
    if(detail.twoUpEnabled){
      detail.twoUpScheme = rule.coDriverScheme || detail.twoUpScheme || "Standard";
    }
  }

  // Effective-date book/truck defaults carry forward unless field is manually overridden.
  if(!detail.workDiaryNoManual){
    const book = diaryBookForDate(key);
    detail.workDiaryNo = (book && book.diaryNo) || rec.defaultWorkDiaryNo || state.bookSettings.defaultWorkDiaryNo || "";
  }
  if(!detail.numberPlateManual){
    detail.numberPlate = (rec.defaultNumberPlate || state.bookSettings.defaultNumberPlate || "").toUpperCase();
  }

  if(state.bookSettings.autoPageNumber && !detail.pageNoManual){
    detail.pageNo = calculatedPageNumberForDate(key) || "";
  }

  // Two-up defaults only fill extra two-up identity fields; they do not override solo/two-up rule history.
  if(detail.twoUpEnabled && state.bookSettings.carryForwardTwoUp && !detail.twoUpManual){
    const t = rec.defaultTwoUp || state.bookSettings.defaultTwoUp || {};
    detail.twoUpDriverName = t.twoUpDriverName || detail.twoUpDriverName || "";
    detail.twoUpLicenceNumber = (t.twoUpLicenceNumber || detail.twoUpLicenceNumber || "").replace(/\D+/g, "");
    detail.twoUpScheme = rule.coDriverScheme || t.twoUpScheme || detail.twoUpScheme || "Standard";
    detail.twoUpBaseState = t.twoUpBaseState || detail.twoUpBaseState || detail.baseStateSnapshot || "";
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
    twoUpLicenceNumber: (detail.twoUpLicenceNumber || "").replace(/\D+/g, ""),
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
    scheme: $("ruleMyScheme").value || state.scheme || "BFM",
    mode: $("ruleDriverMode").value || "solo",
    coDriverScheme: $("ruleDriverMode").value === "twoUp" ? ($("ruleCoDriverScheme").value || "Standard") : ""
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
  applyAutoDefaultsToDay(state.selectedDate);
  addAuditLog("Work option changed", `From ${effectiveDate}: ${rec.scheme} ${rec.mode}${rec.coDriverScheme ? ", co-driver "+rec.coDriverScheme : ""}`);
  save();
  refreshCurrentPageData({forceDefaults:false});
  renderAll();
  showToast("Saved");
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
  renderDiaryBookHistory();
}
function saveBookSettings(){
  ensureBookSettings();
  const effectiveDate = $("settingsEffectiveDate") ? $("settingsEffectiveDate").value || state.selectedDate : state.selectedDate;
  state.bookSettings.autoPageNumber = $("autoPageNumber").checked;
  state.bookSettings.carryForwardTwoUp = $("carryForwardTwoUp").checked;
  state.bookSettings.firstPageDate = $("firstPageDate").value || state.selectedDate;
  state.bookSettings.firstPageNumber = cleanPageNumberInput($("firstPageNumber").value);
  state.bookSettings.defaultWorkDiaryNo = cleanWorkDiaryNoInput($("defaultWorkDiaryNo").value);
  state.bookSettings.defaultNumberPlate = $("defaultNumberPlate").value.trim().toUpperCase();
  ensureDiaryBooks();
  const bookStart = state.bookSettings.firstPageDate || effectiveDate;
  let book = state.diaryBooks.find(b => b.startDate === bookStart);
  if(!book){
    book = normalizeDiaryBook({diaryNo: state.bookSettings.defaultWorkDiaryNo, firstPageNumber: state.bookSettings.firstPageNumber, startDate: bookStart, status:"active", notes:"Created from book setup."});
    state.diaryBooks.push(book);
  }
  book.diaryNo = cleanWorkDiaryNoInput(state.bookSettings.defaultWorkDiaryNo);
  book.firstPageNumber = cleanPageNumberInput(state.bookSettings.firstPageNumber);
  book.startDate = bookStart;
  if(book.status !== "closed") book.status = "active";
  book.updatedAt = new Date().toISOString();
  state.diaryBooks.sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate)));
  saveSettingsRecord(effectiveDate);
  updateFutureDailyDetailsFromEffectiveDate(effectiveDate);
  applyAutoDefaultsToDay(state.selectedDate);
  addAuditLog("Book setup changed", `Effective from ${effectiveDate}`);
  save();
  refreshCurrentPageData({forceDefaults:false});
  renderAll();
  showToast("Saved");
}


function refreshCurrentPageData(opts={}){
  const key = state.selectedDate;
  flushSaveSoon && flushSaveSoon();
  ensureProfile();
  ensureBookSettings && ensureBookSettings();
  if(typeof ensureSettingsHistorySafe === "function") ensureSettingsHistorySafe();
  if(typeof ensureRuleHistory === "function") ensureRuleHistory();

  const detail = ensureDayDetail(key);

  if(opts.forceDefaults){
    detail.selectedPageManual = false;
    detail.workDiaryNoManual = false;
    detail.numberPlateManual = false;
    detail.ruleManual = false;
    detail.twoUpManual = false;
    detail.pageNoManual = false;
  }

  applyAutoDefaultsToDay(key);
  if(typeof syncChangeRowsForDay === "function") syncChangeRowsForDay(key);
  if(typeof rebuildDerivedDiaryData === "function") rebuildDerivedDiaryData();
  else if(typeof recomputeAutoPageNumbers === "function") recomputeAutoPageNumbers();
  applyAutoDefaultsToDay(key);
  save();

  renderDate();
  renderGrid();
  renderTotals();
  if(typeof renderGraphPage === "function"){
    const active = document.querySelector(".screen.active");
    if(active && active.id === "graphScreen") renderGraphPage();
  }
  if(typeof renderDriverSettings === "function"){
    const active = document.querySelector(".screen.active");
    if(active && active.id === "settingsScreen") renderDriverSettings();
  }
  if(typeof renderVehicleDriverRegistry === "function"){
    const active = document.querySelector(".screen.active");
    if(active && active.id === "vehiclesScreen") renderVehicleDriverRegistry();
  }
}

function refreshGraphPageOnly(){
  refreshCurrentPageData({forceDefaults:false});
  if(typeof showToast === "function") showToast("Refreshed");
}

function reapplyCurrentDefaultsToPage(){
  if(confirm("Re-apply current defaults to this page? This will update driver/base/truck/work-option defaults on this page unless you edit them again.")){
    refreshCurrentPageData({forceDefaults:true});
    if(typeof showToast === "function") showToast("Defaults applied");
  }
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
  const status = nhvrCanWorkStatus(asOfAbs);
  if(status.minutes <= 0) return {dueAbs: asOfAbs, reason: status.reason || "Work limit reached"};
  if(status.minutes >= 24*60) return {dueAbs: null, reason: "No active counted window found"};
  return {dueAbs: asOfAbs + status.minutes*60000, reason: status.reason};
}
function calculateCanDriveMinutes(asOfAbs){
  const status = nhvrCanWorkStatus(asOfAbs);
  return {minutes: status.minutes, reason: status.reason, windows: status.windows};
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
  if(isPageCancelledOrSkipped(key)){
    issues.push(`Marked cancelled/skipped page: ${pageStatusLabel(key)}. No break advice should be used for this page.`);
    return {blockers, issues};
  }

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
    if(r.activity === "rest" && !r.restType && !isAutoContinuationRow(r)){
      issues.push(`Rest type missing at ${r.time}.`);
    }
    if(!rowDetailsNotRequired(r) && !r.location && !r.note && rows.length > 1){
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
  const oldStatsDate = state.selectedDate;
  state.selectedDate = absToKeySlot(asOfAbs).key;
  const profile = nhvrProfileForDate(state.selectedDate);
  const input = $("statsAsOf");
  if(input && !input.value) input.value = makeLocalDateTimeValue(asOf);

  const status = nhvrCanWorkStatus(asOfAbs);
  const canCard = $("canDriveCard");
  if(canCard){
    canCard.className = "canDriveCard " + (status.minutes <= 0 ? "bad" : status.minutes <= 30 ? "warn" : "ok");
    canCard.innerHTML = `
      <p class="big">${status.minutes > 0 ? `You can work about ${formatMinsShort(status.minutes)}` : "Rest required now"}</p>
      <p class="sub">Limiting rule: ${escapeHtml(status.reason)}. Based on saved diary blocks up to ${escapeHtml(formatDateTimeForStats(asOfAbs))}.</p>
      <span class="engineBadge">${escapeHtml(NHVR_ENGINE_VERSION)}</span><span class="engineBadge">${escapeHtml(profile.name)}</span>
      ${selectedDayIsTwoUp() ? twoUpRuleWarningHtml() : ""}`;
  }
  const note = $("nhvrEngineNote");
  if(note) note.textContent = "Counts from rest-break ends. 24h+ periods stay active until their full end time; a later major rest does not reset an earlier 24h period.";

  const limitCards = $("statsLimitCards");
  if(limitCards){
    const active = status.windows || [];
    if(!active.length){
      limitCards.innerHTML = `<div class="statLimit"><h3><span>No active counted windows</span></h3><p>Enter earlier work/rest blocks if this looks wrong.</p></div>`;
    } else {
      limitCards.innerHTML = active.slice(0,10).map(w => {
        const rem = Math.max(0, w.maxWork - w.work);
        const pct = Math.min(100, (w.work/w.maxWork)*100);
        const bad = w.work >= w.maxWork;
        return `<div class="statLimit ${bad ? "bad" : ""}">
          <h3><span>${escapeHtml(w.label)} window</span><span>${formatMinsShort(w.work)} / ${formatMinsShort(w.maxWork)}</span></h3>
          <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
          <p>Remaining: <strong>${formatMinsShort(rem)}</strong> • Required/rest rule: ${escapeHtml(w.rest || "Check work option table")}</p>
          <p class="anchorNote">Counted from ${escapeHtml(formatDateTimeForStats(w.startAbs))} until ${escapeHtml(formatDateTimeForStats(w.endAbs))}</p>
        </div>`;
      }).join("");
    }
  }

  const restSinceBreak = continuousRestBeforeAbs(asOfAbs);
  const workSinceBreak = continuousWorkBeforeAbs(asOfAbs);
  const nextRestDue = findNextRequiredRestDue(asOfAbs);
  const breaks = $("statsBreaksDue");
  if(breaks){
    const active24 = (status.windows || []).filter(w => w.label === "24h").sort((a,b)=>a.endAbs-b.endAbs)[0];
    breaks.innerHTML = `
      <div class="statRow"><strong>Work since last break</strong><span>${formatMinsShort(workSinceBreak)}</span></div>
      <div class="statRow"><strong>Rest since break</strong><span>${formatMinsShort(restSinceBreak)}</span></div>
      <div class="statRow"><strong>Next rest / stop-work due</strong><span>${formatDateTimeForStats(nextRestDue.dueAbs)}<small>${escapeHtml(nextRestDue.reason || "Estimated from NHVR counted windows")}</small></span></div>
      <div class="statRow"><strong>Current 24h period ends</strong><span>${active24 ? formatDateTimeForStats(active24.endAbs) : "Not found"}<small>${active24 ? "This 24h count does not reset early if another major rest occurs inside it." : "Enter previous major rest/work blocks if needed."}</small></span></div>`;
  }

  const work7 = countWorkBetweenAbs(asOfAbs - 7*DAY_MS, asOfAbs);
  const work14 = countWorkBetweenAbs(asOfAbs - 14*DAY_MS, asOfAbs);
  const nights14 = nhvrNightRestDates(asOfAbs - 14*DAY_MS, asOfAbs);
  const longRange = $("statsLongRange");
  if(longRange){
    longRange.innerHTML = `
      <div class="statRow"><strong>Last 24h work</strong><span>${formatMinsShort(countWorkBetweenAbs(asOfAbs-DAY_MS, asOfAbs))}</span></div>
      <div class="statRow"><strong>Last 7 days work</strong><span>${formatMinsShort(work7)}</span></div>
      <div class="statRow"><strong>Last 14 days work</strong><span>${formatMinsShort(work14)}</span></div>
      <div class="statRow"><strong>Night rests found in last 14 days</strong><span>${nights14.length}<small>${escapeHtml(nights14.join(", ") || "None found")}</small></span></div>`;
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
  if($("schemeSelect")) $("schemeSelect").value=schemeForDate(state.selectedDate);
  $("restAsStationary").checked=!!state.restAsStationary;
  if($("startDate")) $("startDate").value=state.selectedDate;
  if($("endDate")) $("endDate").value=state.selectedDate;
}
function renderTotals(){
  const t=totalsForDay();
  $("totalWork").textContent=minsToHoursText(t.work);
  $("totalRest").textContent=minsToHoursText(t.rest);
}
function renderAlertsFast(){
  const a = $("alerts");
  if(!a) return;
  a.innerHTML = "";
  if(isPageCancelledOrSkipped(state.selectedDate)){
    const el=document.createElement("div");
    el.className="alert warn";
    el.textContent=`This page is marked ${pageStatusLabel(state.selectedDate)}. Do not use this page for break/fatigue advice.`;
    a.appendChild(el);
  } else if(selectedDayIsTwoUp()){
    const missing = twoUpMissingDetails();
    if(missing.length){
      const el=document.createElement("div");
      el.className="alert warn";
      el.textContent=`Two-up is selected but missing: ${missing.join(", ")}.`;
      a.appendChild(el);
    }
  }
}
function renderDiaryFast(){
  renderUiSettings();
  renderDate();
  renderGrid();
  renderTotals();
  renderTimer();
  renderAlertsFast();
}

function renderDriverSettings(){
  ensureProfile();
  ensureSettingsHistory();
  ensureBookSettings();
  ensureRuleHistory();
  const rec = currentSettingsRecordForDate(state.selectedDate);
  const rule = ruleRecordForDate(state.selectedDate);
  if($("driverName")) $("driverName").value = rec.driverName || state.profile.driverName || "";
  if($("licenceNumber")) $("licenceNumber").value = (rec.licenceNumber || state.profile.licenceNumber || "").replace(/\D+/g, "");
  if($("baseTimeZone")) $("baseTimeZone").value = state.profile.baseTimeZone || "NSW";
  if($("settingsEffectiveDate")) $("settingsEffectiveDate").value = $("settingsEffectiveDate").value || state.selectedDate;
  if($("schemeSelect")) $("schemeSelect").value = rule.scheme || state.scheme || "BFM";
  renderBookSettings();
  renderRuleHistorySettings();
  renderCalculationHistorySettings();
  renderShortBreakSettings();
}
function renderAll(){
  renderDate();
  renderGrid();
  renderTotals();
  renderTimer();
  renderAlertsFast();

  const active = document.querySelector(".screen.active");
  const activeId = active ? active.id : "diaryScreen";

  if(activeId === "graphScreen") renderGraphPage();
  if(activeId === "statsScreen"){
    renderRuleCards();
    renderNextBreak();
    renderTodayAdvice();
    renderStatistics();
    renderComplianceConfidence();
  }
  if(activeId === "drivingScreen"){
    renderRuleCards();
    renderNextBreak();
    renderTodayAdvice();
    renderAuditList();
    renderComplianceConfidence();
    renderAuditFixPanel();
  }
  if(activeId === "vehiclesScreen") renderVehicleDriverRegistry();
  if(activeId === "settingsScreen"){
    renderDriverSettings();
    renderDiaryBookHistory();
    renderBackupReminderSettings();
    renderAuditLog();
  }
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
    detail.usePage = false;
    detail.usePageManual = false;
    if(!detail.pageNoManual) detail.pageNo = "";
    rebuildDerivedDiaryData();
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
    state.diaryBooks=[];
    state.calculationHistory={startDate:state.selectedDate || toKey(new Date()), mode:"noWorkBeforeStart"};
    state.shortBreakSettings={mode:"smart", maxMinutes:60};
    save(); renderAll();
  }
}
function exportCsv(){
  ensureProfile();
  const rows=[["driver_name","licence_number","base_time","scheme","selected_date","start","end","activity","note"]];
  state.entries.forEach(e=>rows.push([
    state.profile.driverName || "",
    state.profile.licenceNumber || "",
    state.profile.baseTimeZone || "NSW",
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
    @page{size:A4 landscape;margin:3mm}
    html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif}
    .wrap{width:100%;margin:0 auto;background:#fff}
    .pdfBtns{display:flex;gap:8px;padding:8px 10px}
    .pdfBtns button{padding:10px 12px;border:0;border-radius:10px;background:#2c6d5e;color:white;font-weight:800}
    .pdfBtns button+button{background:#eee;color:#111}
    .paperSheet,.realBookSheet{border:0!important;border-radius:0!important;padding:0!important;background:#fff!important;box-shadow:none!important}
    .realDiarySvg{display:block;width:100%;height:auto;background:#fff;max-height:184mm}
    @media print{.pdfBtns{display:none}.wrap{width:100%}.realDiarySvg{width:100%;height:auto;max-height:184mm}}
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
    schemaVersion: APP_SCHEMA_VERSION,
    appBuild: APP_BUILD_NAME,
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
    dismissedAudit: state.dismissedAudit || {},
    vehicles: state.vehicles || [],
    savedDrivers: state.savedDrivers || [],
    registrySettings: state.registrySettings || {autoSaveFromDiary:true},
    uiSettings: state.uiSettings || {locationPickerEnabled:true},
    diaryBooks: state.diaryBooks || [],
    calculationHistory: state.calculationHistory || {startDate:"", mode:"noWorkBeforeStart"},
    shortBreakSettings: state.shortBreakSettings || {mode:"smart", maxMinutes:60},
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
      const migrated = migrateImportedBackup(backup);
      state.selectedDate = migrated.selectedDate || toKey(new Date());
      state.scheme = migrated.scheme || "BFM";
      state.restAsStationary = migrated.restAsStationary !== undefined ? !!migrated.restAsStationary : true;
      state.slots = migrated.slots || {};
      state.entries = Array.isArray(migrated.entries) ? migrated.entries : [];
      state.activeTimer = null;
      state.profile = migrated.profile || {driverName:"", licenceNumber:"", baseTimeZone:"NSW"};
      state.dayDetails = migrated.dayDetails || {};
      state.bookSettings = migrated.bookSettings || state.bookSettings || {};
      state.settingsHistory = migrated.settingsHistory || [];
      state.ruleHistory = migrated.ruleHistory || [];
      state.auditLog = migrated.auditLog || [];
      state.dismissedAudit = migrated.dismissedAudit || {};
      state.vehicles = migrated.vehicles || [];
      state.savedDrivers = migrated.savedDrivers || [];
      state.registrySettings = migrated.registrySettings || {autoSaveFromDiary:true};
      state.uiSettings = migrated.uiSettings || {locationPickerEnabled:true};
      state.diaryBooks = migrated.diaryBooks || [];
      state.calculationHistory = migrated.calculationHistory || {};
      state.shortBreakSettings = migrated.shortBreakSettings || {mode:"smart", maxMinutes:60};
      state.backupReminder = migrated.backupReminder || state.backupReminder || {frequency:"off", lastBackupAt:"", lastPromptDate:""};
      state.schemaVersion = APP_SCHEMA_VERSION;
      ensureProfile();
      ensureBackupReminder();
      ensureDayDetailsContainer();
      ensureBookSettings();
      ensureDiaryBooks();
      save();
      renderAll();
      addAuditLog("Backup imported and migrated", `Backup schema ${backup.schemaVersion || backup.backupVersion || "old"} imported into schema ${APP_SCHEMA_VERSION}.`); save(); alert("Backup imported successfully.");
    }catch(e){
      alert("Could not import backup. Please select a valid JSON backup file.");
    }finally{
      const input = $("jsonImportFile");
      if(input) input.value = "";
    }
  };
  reader.readAsText(file);
}


function ensureSettingsHistorySafe(){
  if(!Array.isArray(state.settingsHistory)) state.settingsHistory = [];
}
function saveSettingsRecordSafe(effectiveDate){
  ensureSettingsHistorySafe();
  const rec = {
    effectiveDate,
    driverName: state.profile.driverName || "",
    licenceNumber: (state.profile.licenceNumber || "").replace(/\D+/g,""),
    baseTimeZone: state.profile.baseTimeZone || "NSW",
    defaultWorkDiaryNo: state.bookSettings && state.bookSettings.defaultWorkDiaryNo || "",
    defaultNumberPlate: state.bookSettings && state.bookSettings.defaultNumberPlate || "",
    defaultTwoUp: state.bookSettings && state.bookSettings.defaultTwoUp || {}
  };
  const idx = state.settingsHistory.findIndex(x => x.effectiveDate === effectiveDate);
  if(idx >= 0) state.settingsHistory[idx] = {...state.settingsHistory[idx], ...rec};
  else state.settingsHistory.push(rec);
  state.settingsHistory.sort((a,b)=>String(a.effectiveDate).localeCompare(String(b.effectiveDate)));
}
function driverSettingsRecordForDateFixed(key){
  ensureSettingsHistorySafe();
  const fallback = {
    driverName: state.profile.driverName || "",
    licenceNumber: state.profile.licenceNumber || "",
    baseTimeZone: state.profile.baseTimeZone || "NSW",
    defaultWorkDiaryNo: state.bookSettings && state.bookSettings.defaultWorkDiaryNo || "",
    defaultNumberPlate: state.bookSettings && state.bookSettings.defaultNumberPlate || "",
    defaultTwoUp: state.bookSettings && state.bookSettings.defaultTwoUp || {}
  };
  let found = null;
  state.settingsHistory.forEach(r=>{
    if(r && r.effectiveDate && r.effectiveDate <= key) found = r;
  });
  return found ? {...fallback, ...found} : fallback;
}

function saveDriverSettings(){
  ensureProfile();
  ensureBookSettings();
  const effectiveDate = $("settingsEffectiveDate") && $("settingsEffectiveDate").value || state.selectedDate || toKey(new Date());
  state.profile.driverName = $("driverName").value.trim();
  state.profile.licenceNumber = $("licenceNumber").value.replace(/\D+/g, "");
  state.profile.baseTimeZone = $("baseTimeZone").value || "NSW";

  saveSettingsRecordSafe(effectiveDate);

  Object.keys(state.dayDetails || {}).forEach(key => {
    if(key >= effectiveDate){
      const d = ensureDayDetail(key);
      if(!d.selectedPageManual){
        d.driverNameSnapshot = state.profile.driverName;
        d.licenceNumberSnapshot = state.profile.licenceNumber;
        d.baseStateSnapshot = state.profile.baseTimeZone;
      }
    }
  });

  applyAutoDefaultsToDay(state.selectedDate);
  addAuditLog("Driver/base details changed", `Effective from ${effectiveDate}`);
  save();
  refreshCurrentPageData({forceDefaults:false});
  renderDriverSettings();
  renderDate();
  renderGrid();
  renderTotals();
  if(typeof renderGraphPreviewOnly === "function"){
    const active = document.querySelector(".screen.active");
    if(active && active.id === "graphScreen") renderGraphPreviewOnly();
  }
  if(typeof showToast === "function") showToast("Saved");
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
  recomputeAutoPageNumbers();
  save();
  renderAll();
}


function collectKnownDiaryDates(){
  const dates = new Set();
  Object.keys(state.dayDetails || {}).forEach(k => dates.add(k));
  Object.keys(state.slots || {}).forEach(k => dates.add(k));
  (state.entries || []).forEach(e => {
    if(e.start) dates.add(String(e.start).slice(0,10));
    if(e.end) dates.add(String(e.end).slice(0,10));
  });
  dates.add(state.selectedDate);
  return [...dates].filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
}
function goToDiaryDate(key, message="Opened"){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(key)){
    alert("Please select a valid date.");
    return;
  }
  state.selectedDate = key;
  applyAutoDefaultsToDay(key);
  if(typeof refreshCurrentPageData === "function"){
    refreshCurrentPageData({forceDefaults:false});
  }else{
    saveSoon();
    renderDiaryFast();
  }
  const active = document.querySelector(".screen.active");
  if(active && active.id === "graphScreen" && typeof renderGraphPage === "function") renderGraphPage();
  if($("jumpDateInput")) $("jumpDateInput").value = key;
  if($("jumpStatus")) $("jumpStatus").textContent = `${message}: ${fmtDateLong(key)} • Page ${pageNoForDate(key)}`;
  closeFindModal();
  if(typeof showToast === "function") showToast(message);
}


function openFindModal(){
  const modal = $("findModal");
  if(!modal) return;
  if($("jumpDateInput")) $("jumpDateInput").value = state.selectedDate || toKey(new Date());
  if($("jumpStatus")) $("jumpStatus").textContent = "";
  modal.hidden = false;
  modal.classList.add("show");
  setTimeout(()=>{ if($("jumpPageInput")) $("jumpPageInput").focus(); }, 80);
}
function closeFindModal(){
  const modal = $("findModal");
  if(!modal) return;
  modal.classList.remove("show");
  modal.hidden = true;
}
function bindFindModalControls(){
  const openBtn = $("openFindModalBtn");
  const closeBtn = $("closeFindModalBtn");
  const modal = $("findModal");
  const dateBtn = $("jumpDateBtn");
  const pageBtn = $("jumpPageBtn");
  const pageInput = $("jumpPageInput");

  if(openBtn) openBtn.onclick = (e)=>{ e.preventDefault(); openFindModal(); };
  if(closeBtn) closeBtn.onclick = (e)=>{ e.preventDefault(); closeFindModal(); };
  if(modal) modal.onclick = (e)=>{ if(e.target === modal) closeFindModal(); };
  if(dateBtn) dateBtn.onclick = (e)=>{ e.preventDefault(); jumpToDateValue(); };
  if(pageBtn) pageBtn.onclick = (e)=>{ e.preventDefault(); jumpToPageNumberValue(); };
  if(pageInput && !pageInput.dataset.enterBound){
    pageInput.dataset.enterBound = "true";
    pageInput.addEventListener("keydown", (e)=>{ if(e.key === "Enter"){ e.preventDefault(); jumpToPageNumberValue(); } });
  }
}


function jumpToDateValue(){
  const key = $("jumpDateInput") ? $("jumpDateInput").value : "";
  goToDiaryDate(key, "Opened date");
}
function findDateByPageNumber(pageNo){
  const target = cleanPageNumberInput(pageNo);
  if(!target) return null;
  if(typeof recomputeAutoPageNumbers === "function") recomputeAutoPageNumbers();
  const dates = collectKnownDiaryDates();
  for(const key of dates){
    const d = ensureDayDetail(key);
    const stored = d.pageNo || "";
    const calc = calculatedPageNumberForDate(key) || "";
    if((stored && samePageNumber(stored, target)) || (calc && samePageNumber(calc, target))){
      return {key, stored: stored || calc};
    }
  }
  return null;
}
function jumpToPageNumberValue(){
  const raw = $("jumpPageInput") ? $("jumpPageInput").value : "";
  const page = cleanPageNumberInput(raw);
  if($("jumpPageInput")) $("jumpPageInput").value = page;
  if(!page){
    alert("Please enter a page number.");
    return;
  }
  const found = findDateByPageNumber(page);
  if(found){
    goToDiaryDate(found.key, `Page ${found.stored || page} opened`);
  }else{
    const msg = `Page ${page} not found in saved diary records.`;
    if($("jumpStatus")) $("jumpStatus").textContent = msg;
    alert(msg);
  }
}



function quickRefreshCurrentScreen(){
  try{
    rebuildDerivedDiaryData();
    save();
    const active = document.querySelector(".screen.active");
    const activeId = active ? active.id : "diaryScreen";
    renderDate();
    if(activeId === "diaryScreen"){
      renderDiaryFast();
    } else if(activeId === "drivingScreen"){
      renderRuleCards();
      renderNextBreak();
      renderTodayAdvice();
      renderAuditList();
      renderComplianceConfidence();
      renderAuditFixPanel();
    } else if(activeId === "statsScreen"){
      renderRuleCards();
      renderNextBreak();
      renderTodayAdvice();
      renderStatistics();
      renderComplianceConfidence();
    } else if(activeId === "graphScreen"){
      renderGraphPage();
    } else if(activeId === "vehiclesScreen"){
      renderVehicleDriverRegistry();
    } else if(activeId === "settingsScreen"){
      renderDriverSettings();
      renderBackupReminderSettings();
      renderAuditLog();
    } else {
      renderAll();
    }
    if(typeof showToast === "function") showToast("Refreshed");
  }catch(err){
    console.error("Refresh failed", err);
    try{ renderAll(); }catch(e){}
  }
}


function nhvrSelfTestRequiredRestHighlights(){
  const key = state.selectedDate || toKey(new Date());
  const old = JSON.stringify({slots: state.slots[key], detail: state.dayDetails[key]});
  state.slots[key] = Array(SLOTS_PER_DAY).fill("rest");
  for(let i=0;i<40;i++) state.slots[key][i] = "work"; // 10 hours continuous
  const res = nhvrBreachesForDate(key).map(f => ({title:f.title, slots:f.focus && f.focus.slots, message:f.message, fix:f.fix}));
  try{
    const parsed = JSON.parse(old);
    if(parsed.slots) state.slots[key] = parsed.slots; else delete state.slots[key];
    if(parsed.detail) state.dayDetails[key] = parsed.detail;
  }catch(e){}
  return res;
}


function setup(){
  bindFindModalControls();
  if($("openFindModalBtn")) $("openFindModalBtn").onclick = openFindModal;
  if($("quickRefreshBtn")) $("quickRefreshBtn").onclick = quickRefreshCurrentScreen;
  if($("closeFindModalBtn")) $("closeFindModalBtn").onclick = closeFindModal;
  if($("findModal")) $("findModal").onclick = (e)=>{ if(e.target === $("findModal")) closeFindModal(); };
  if($("jumpDateBtn")) $("jumpDateBtn").onclick = jumpToDateValue;
  if($("jumpPageBtn")) $("jumpPageBtn").onclick = jumpToPageNumberValue;
  if($("jumpPageInput")) $("jumpPageInput").addEventListener("keydown", (e)=>{ if(e.key === "Enter") jumpToPageNumberValue(); });
  if($("refreshGraphPageBtn")) $("refreshGraphPageBtn").onclick = refreshGraphPageOnly;
  if($("refreshGraphDefaultsBtn")) $("refreshGraphDefaultsBtn").onclick = reapplyCurrentDefaultsToPage;
  if($("locationPickerEnabled")) $("locationPickerEnabled").onchange = toggleLocationPickerEnabled;
  document.addEventListener("visibilitychange", () => { if(document.hidden) flushSaveSoon(); });
  window.addEventListener("pagehide", flushSaveSoon);
  setupVehicleDriverRegistryButtons();
  document.addEventListener("input", enforceNumericOnly);
  document.addEventListener("input", enforcePageNumberOnly);
  document.addEventListener("input", enforceUppercaseOnly);
  document.addEventListener("input", enforceWorkDiaryNoOnly);
  load();
  $("prevDay").onclick=()=>{state.selectedDate=addDays(state.selectedDate,-1);saveSoon();renderDiaryFast();}
  $("nextDay").onclick=()=>{state.selectedDate=addDays(state.selectedDate,1);saveSoon();renderDiaryFast();}
  if($("todayBtn")) $("todayBtn").onclick=()=>{state.selectedDate=toKey(new Date());saveSoon();renderDiaryFast();}
  $("dateText").onclick=()=>$("datePicker").showPicker ? $("datePicker").showPicker() : $("datePicker").click();
  $("datePicker").onchange=e=>{state.selectedDate=e.target.value;saveSoon();renderDiaryFast();}
  if($("addEntry")) $("addEntry").onclick=addEntryFromForm;
  if($("quickBFM")) $("quickBFM").onclick=loadBFMSample;
  $("schemeSelect").onchange=e=>{
    state.scheme=e.target.value;
    if($("ruleEffectiveDate")) $("ruleEffectiveDate").value = state.selectedDate;
    if($("ruleMyScheme")) $("ruleMyScheme").value = e.target.value;
    if($("ruleDriverMode")) $("ruleDriverMode").value = "solo";
    saveRuleHistorySetting();
  }
  $("restAsStationary").onchange=e=>{state.restAsStationary=e.target.checked;saveSoon();renderDiaryFast();}
  if($("saveRuleHistory")) $("saveRuleHistory").onclick=saveRuleHistorySetting;
  if($("saveCalculationHistory")) $("saveCalculationHistory").onclick = saveCalculationHistorySettings;
  if($("saveShortBreakSettings")) $("saveShortBreakSettings").onclick = saveShortBreakSettings;
  $("exportCsv").onclick=exportCsv;
  $("exportPdf").onclick=exportPdf;
  if($("graphExportPdf")) $("graphExportPdf").onclick=exportPdf;
  $("exportJsonBackup").onclick=exportJsonBackup;
  if($("checkDataHealth")) $("checkDataHealth").onclick=checkDataHealth;
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
  if($("closeCurrentBookBtn")) $("closeCurrentBookBtn").onclick = closeCurrentDiaryBook;
  if($("startNewBookBtn")) $("startNewBookBtn").onclick = startNewDiaryBook;
  if($("saveDailySheetDetails")) $("saveDailySheetDetails").onclick = saveDailySheetDetails;
  if($("graphDetailsForm")){
    $("graphDetailsForm").addEventListener("input", updateDayDetailFromGraphForm);
    $("graphDetailsForm").addEventListener("change", updateDayDetailFromGraphForm);
  }
  if($("changeDetailsEditor")){
    $("changeDetailsEditor").addEventListener("input", handleChangeDetailsInput);
    $("changeDetailsEditor").addEventListener("change", handleChangeDetailsInput);
    $("changeDetailsEditor").addEventListener("click", (ev)=>{
      const btn = ev.target && ev.target.closest ? ev.target.closest("[data-location-index]") : null;
      if(btn){
        ev.preventDefault();
        setChangeRowLocationFromCurrent(Number(btn.dataset.locationIndex), btn);
      }
    });
  }
  $("clearDay").onclick=clearSelectedDay;
  $("clearAll").onclick=clearAll;
  if($("clearAuditLog")) $("clearAuditLog").onclick=clearAuditLogOnly;
  $("startWorkBtn").onclick=()=>startTimer("work");
  $("startRestBtn").onclick=()=>startTimer("rest");
  $("stopTimerBtn").onclick=stopTimer;

  document.querySelectorAll(".tabbar button").forEach(btn=>{
    btn.onclick=()=>{
      safeSwitchTab(btn.dataset.tab);
      try{
        renderDate();
        renderTimer();
        if(btn.dataset.tab === "diaryScreen"){
          renderDiaryFast();
        }
        if(btn.dataset.tab === "graphScreen"){
          refreshCurrentPageData({forceDefaults:false});
          renderGraphPage();
        }
        if(btn.dataset.tab === "statsScreen"){
          renderRuleCards();
          renderNextBreak();
          renderTodayAdvice();
          renderStatistics();
          renderComplianceConfidence();
        }
        if(btn.dataset.tab === "drivingScreen"){
          renderRuleCards();
          renderNextBreak();
          renderTodayAdvice();
          renderAuditList();
          renderComplianceConfidence();
        }
        if(btn.dataset.tab === "vehiclesScreen"){
          renderVehicleDriverRegistry();
        }
        if(btn.dataset.tab === "settingsScreen"){
          renderDriverSettings();
          renderBackupReminderSettings();
          renderAuditLog();
        }
      }catch(e){
        console.error("Screen render error", e);
      }
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


/* Robust Find modal controller v3 */
(function(){
  function byId(id){ return document.getElementById(id); }
  function cleanPage(value){
    if(typeof cleanPageNumberInput === "function") return cleanPageNumberInput(value);
    return String(value || "").replace(/[^\d ]+/g, "").replace(/\s+/g, " ").trim();
  }
  function digits(value){
    if(typeof pageNumberDigits === "function") return pageNumberDigits(value);
    return String(value || "").replace(/\D+/g, "");
  }
  function samePage(a,b){
    const ad = digits(a), bd = digits(b);
    return !!ad && !!bd && ad === bd;
  }
  window.openFindModal = function(){
    const modal = byId("findModal");
    if(!modal) return;
    const dateInput = byId("jumpDateInput");
    const status = byId("jumpStatus");
    if(dateInput) dateInput.value = state.selectedDate || toKey(new Date());
    if(status) status.textContent = "";
    modal.hidden = false;
    modal.classList.add("show");
    setTimeout(()=>{ const page = byId("jumpPageInput"); if(page) page.focus(); }, 60);
  };
  window.closeFindModal = function(){
    const modal = byId("findModal");
    if(!modal) return;
    modal.classList.remove("show");
    modal.hidden = true;
  };
  window.goToDiaryDateFromFind = function(key, message){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(key || "")){
      alert("Please select a valid date.");
      return false;
    }
    state.selectedDate = key;
    try{ applyAutoDefaultsToDay(key); }catch(e){ console.warn(e); }
    try{
      if(typeof refreshCurrentPageData === "function") refreshCurrentPageData({forceDefaults:false});
      else {
        if(typeof saveSoon === "function") saveSoon(); else save();
        if(typeof renderDiaryFast === "function") renderDiaryFast(); else renderAll();
      }
    }catch(e){
      console.warn("Jump render fallback", e);
      try{ save(); renderAll(); }catch(err){ console.error(err); }
    }
    const dateInput = byId("jumpDateInput");
    if(dateInput) dateInput.value = key;
    const status = byId("jumpStatus");
    if(status) status.textContent = `${message || "Opened"}: ${key}`;
    closeFindModal();
    if(typeof showToast === "function") showToast(message || "Opened");
    return true;
  };
  window.jumpToDateValue = function(){
    const input = byId("jumpDateInput");
    const key = input ? input.value : "";
    return goToDiaryDateFromFind(key, "Opened date");
  };
  window.findDateByPageNumber = function(pageNo){
    const target = cleanPage(pageNo);
    if(!target) return null;
    try{ if(typeof recomputeAutoPageNumbers === "function") recomputeAutoPageNumbers(); }catch(e){}
    const dates = new Set();
    try{ Object.keys(state.dayDetails || {}).forEach(k => dates.add(k)); }catch(e){}
    try{ Object.keys(state.slots || {}).forEach(k => dates.add(k)); }catch(e){}
    try{
      (state.entries || []).forEach(e => {
        if(e.start) dates.add(String(e.start).slice(0,10));
        if(e.end) dates.add(String(e.end).slice(0,10));
      });
    }catch(e){}
    if(state.selectedDate) dates.add(state.selectedDate);

    const sorted = [...dates].filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
    for(const key of sorted){
      let detail = null;
      try{ detail = ensureDayDetail(key); }catch(e){ detail = (state.dayDetails || {})[key]; }
      const stored = detail && detail.pageNo ? detail.pageNo : "";
      let calc = "";
      try{ calc = calculatedPageNumberForDate(key) || ""; }catch(e){}
      if((stored && samePage(stored, target)) || (calc && samePage(calc, target))){
        return {key, page: stored || calc};
      }
    }
    return null;
  };
  window.jumpToPageNumberValue = function(){
    const input = byId("jumpPageInput");
    const status = byId("jumpStatus");
    const page = cleanPage(input ? input.value : "");
    if(input) input.value = page;
    if(!page){
      alert("Please enter a page number.");
      return false;
    }
    const found = findDateByPageNumber(page);
    if(found){
      return goToDiaryDateFromFind(found.key, `Page ${found.page || page} opened`);
    }
    const msg = `Page ${page} not found in saved diary records.`;
    if(status) status.textContent = msg;
    alert(msg);
    return false;
  };
  window.bindFindModalControls = function(){
    const openBtn = byId("openFindModalBtn");
    const modal = byId("findModal");
    const pageInput = byId("jumpPageInput");
    if(openBtn) openBtn.onclick = (e)=>{ e.preventDefault(); openFindModal(); };
    if(modal){
      modal.onclick = (e)=>{
        const actionEl = e.target && e.target.closest ? e.target.closest("[data-find-action]") : null;
        if(actionEl){
          const action = actionEl.getAttribute("data-find-action");
          e.preventDefault();
          e.stopPropagation();
          if(action === "close") closeFindModal();
          if(action === "date") jumpToDateValue();
          if(action === "page") jumpToPageNumberValue();
          if(action === "open") openFindModal();
          return;
        }
        if(e.target === modal) closeFindModal();
      };
    }
    if(pageInput && !pageInput.dataset.findEnterBound){
      pageInput.dataset.findEnterBound = "true";
      pageInput.addEventListener("keydown", (e)=>{
        if(e.key === "Enter"){
          e.preventDefault();
          jumpToPageNumberValue();
        }
      });
    }
  };
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bindFindModalControls);
  }else{
    bindFindModalControls();
  }
})();

