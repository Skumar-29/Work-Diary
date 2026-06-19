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
  dayDetails: {}
};

const $ = id => document.getElementById(id);

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
function defaultDayDetail(){
  return {
    workDiaryNo: "",
    pageNo: "",
    numberPlate: "",
    dailyCheckTime: "",
    comments: "",
    fitForDuty: false,
    twoUpEnabled: false,
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
function save(){
  ensureProfile();
  ensureBackupReminder();
  ensureDayDetailsContainer();
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
}
function isWork(key, idx){ return getSlot(key, idx) === "work"; }
function isRestType(type){ return type === "rest"; }
function isStationary(key, idx){
  const t = getSlot(key, idx);
  return t === "rest";
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
  return RULES[state.scheme].windows.some(r => countWorkBetween(endAbs, r.minutes) > r.maxWork);
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
  let anyBreach=false;
  for(let i=0;i<SLOTS_PER_DAY;i++) if(slotBreaches(state.selectedDate,i)) anyBreach=true;
  if(anyBreach) warns.push({type:"bad", text:"Possible rule breach found. Red blocks show work time that may exceed your selected scheme limits."});
  const selectedEndAbs = fromKey(state.selectedDate).getTime() + DAY_MS;
  const major = maxContinuousStationary(selectedEndAbs, 1440);
  if(major < RULES[state.scheme].majorRest) warns.push({type:"warn", text:`No ${RULES[state.scheme].majorRest/60}h continuous stationary-rest block found in this 24h day view.`});
  if(!warns.length) warns.push({type:"ok", text:"No daily rolling-window warning found for the selected scheme."});
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
  const div=$("ruleCards"); div.innerHTML="";
  const startAbs = fromKey(state.selectedDate).getTime();
  const endAbs = startAbs + DAY_MS;
  RULES[state.scheme].windows.forEach(r=>{
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
  const firstRule = RULES[state.scheme].windows[0];
  const remain = Math.max(0, firstRule.maxWork - work);
  const latest = restEnd + firstRule.maxWork*60000;
  const latestD = new Date(latest);
  box.innerHTML = remain>0
    ? `After your last 15-minute rest, you have about <strong>${Math.floor(remain/60)}h ${remain%60}m</strong> work left before another 15-minute rest is due. Latest rest start: <strong>${pad(latestD.getHours())}:${pad(latestD.getMinutes())}</strong>.`
    : `<strong>Take 15 minutes rest now before more work.</strong>`;
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
  const t = state.profile.baseTimeZone || "NSW";
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
      note: prev.note || ""
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
      <td><input data-change-index="${i}" data-change-field="note" value="${escapeHtml(r.note)}" placeholder="Optional"></td>
    </tr>`).join("");
  holder.innerHTML = `
    <table class="changeTable">
      <thead><tr><th>Time</th><th>Activity</th><th>Odometer</th><th>Location</th><th>Note</th></tr></thead>
      <tbody>${htmlRows}</tbody>
    </table>`;
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
  const dow = dayNameLetters().map((letter, i) => `<div class="psMiniBox ${i===dayIdx ? "active" : ""}">${letter}</div>`).join("");
  const states = ["ACT","NSW","NT","QLD","SA","TAS","VIC","WA"];
  const activeState = baseStateShort();
  const stateBoxes = states.map(s => `<div class="psMiniBox ${activeState===s ? "active" : ""}">${s}</div>`).join("");
  const schemeChecks = ["Standard","Standard Bus","BFM","AFM","Fit for Duty"].map(s => {
    const active = (s === state.scheme) || (s === "Fit for Duty" && detail.fitForDuty);
    return `<div class="psCheck"><span class="psCheckBox">${active ? "✓" : ""}</span>${s}</div>`;
  }).join("");
  const rowsHtml = changeRows.map(r => `<tr>
      <td>${escapeHtml(r.time)}</td>
      <td>${escapeHtml(r.odometer)}</td>
      <td class="vert">${escapeHtml(r.location || r.note)}</td>
      <td>${escapeHtml(activityLabel(r.activity))}</td>
    </tr>`).join("");
  const twoUpHidden = detail.twoUpEnabled ? "" : "psHide";
  return `
    <div class="paperSheet">
      <div class="psTitle">NATIONAL WORK DIARY DAILY SHEET</div>
      <div class="psHeaderLine">
        <div></div>
        <div class="smallLbl">WORK DIARY NO.</div>
        <div class="bigText">${escapeHtml(detail.workDiaryNo || "")}</div>
        <div class="redText">${escapeHtml(detail.pageNo || "")}</div>
      </div>

      <div class="psSectionTitle">DRIVER IDENTIFICATION</div>
      <div class="psTopGrid">
        <div class="psField">
          <div class="lbl">Driver's Name</div>
          <div class="val">${escapeHtml(state.profile.driverName || "")}</div>
        </div>
        <div class="psField">
          <div class="lbl">Date</div>
          <div class="val">${escapeHtml(formatDisplayDateShort(key))}</div>
        </div>
        <div class="psField">
          <div class="lbl">Day of the Week</div>
          <div class="psDayRow">${dow}</div>
        </div>
        <div class="psField">
          <div class="lbl">Time of daily check (if required)</div>
          <div class="val black">${escapeHtml(detail.dailyCheckTime || "")}</div>
        </div>

        <div class="psField">
          <div class="lbl">Licence No.</div>
          <div class="val">${escapeHtml(state.profile.licenceNumber || "")}</div>
        </div>
        <div class="psField">
          <div class="lbl">Number Plate</div>
          <div class="val">${escapeHtml(detail.numberPlate || "")}</div>
        </div>
        <div class="psField">
          <div class="lbl">Time Zone: State/Territory (Driver Base)</div>
          <div class="psStateRow">${stateBoxes}</div>
        </div>
        <div class="psField">
          <div class="lbl">Work/Rest Option</div>
          <div class="psCheckList">${schemeChecks}</div>
        </div>
      </div>

      <div class="psCommentsArea">${escapeHtml(detail.comments || "")}</div>

      <div class="psActivityArea">
        <div class="psSideTitle">DETAILS OF ACTIVITIES FOR THIS DAY</div>
        <div class="psActivityMain">
          <table class="psRowsTable">
            <thead>
              <tr>
                <th style="width:90px">Time</th>
                <th style="width:120px">Odometer Reading</th>
                <th>Name of Location at Work and Rest Change<br><span class="optional">(rest area, truck stop, suburb or town)</span></th>
                <th style="width:110px">Activity</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="4">No entries yet</td></tr>'}
            </tbody>
          </table>
          <div class="psGraphBox">${buildPaperGraphSvg(key)}</div>
          <div class="psTotalsRow"><div>Total Work: ${Math.floor(totals.work/60)}h ${totals.work%60}m</div><div>Total Rest: ${Math.floor(totals.rest/60)}h ${totals.rest%60}m</div></div>
        </div>
      </div>

      <div class="psSectionTitle ${twoUpHidden}">TWO-UP DRIVER'S IDENTIFICATION</div>
      <div class="psTwoUpWrap ${twoUpHidden}">
        <div class="psField"><div class="lbl">Two-up Driver Name</div><div class="val black">${escapeHtml(detail.twoUpDriverName || "")}</div></div>
        <div class="psField"><div class="lbl">Two-up Driver's Licence No</div><div class="val black">${escapeHtml(detail.twoUpLicenceNumber || "")}</div></div>
        <div class="psField"><div class="lbl">Two-up Driver Scheme</div><div class="val black">${escapeHtml(detail.twoUpScheme || "")}</div></div>
        <div class="psField"><div class="lbl">Two-up Base State</div><div class="val black">${escapeHtml(detail.twoUpBaseState || "")}</div></div>
      </div>

      <div class="psFooterGrid">
        <div>
          <div class="lbl" style="font-size:12px;margin-bottom:4px">Driver Signature</div>
          <div class="psSignatureBox"></div>
          <div class="psFine" style="margin-top:6px">To the best of my knowledge and belief the information I have recorded on this daily sheet is true and correct.</div>
        </div>
        <div>
          <div class="psFine" style="margin-bottom:6px">This page is a personal helper preview to help you match your real paper work diary. Keep your official paper diary / approved EWD as the legal record.</div>
          <div class="psField"><div class="lbl">Scheme in app</div><div class="val black">${escapeHtml(state.scheme)}</div></div>
        </div>
      </div>
    </div>`;
}
function renderGraphPreviewOnly(){
  const holder = $("paperSheetPreview");
  if(!holder) return;
  holder.innerHTML = buildPaperSheetHtml();
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
  save();
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

function renderGraphPage(){
  ensureProfile();
  ensureDayDetail(state.selectedDate);
  renderGraphForm();
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
  const scheme = RULES[state.scheme];
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
  const scheme = RULES[state.scheme];
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
function renderStatistics(){
  const asOf = parseStatsAsOf();
  const asOfAbs = asOf.getTime();
  const scheme = RULES[state.scheme];
  const input = $("statsAsOf");
  if(input && !input.value) input.value = makeLocalDateTimeValue(asOf);

  const can = calculateCanDriveMinutes(asOfAbs);
  const canCard = $("canDriveCard");
  if(canCard){
    canCard.className = "canDriveCard " + (can.minutes <= 0 ? "bad" : can.minutes <= 30 ? "warn" : "ok");
    canCard.innerHTML = `
      <p class="big">${can.minutes > 0 ? `You can work about ${formatMinsShort(can.minutes)}` : "Rest required now"}</p>
      <p class="sub">Limiting rule: ${escapeHtml(can.reason)}. Based on saved diary blocks up to ${escapeHtml(formatDateTimeForStats(asOfAbs))}.</p>`;
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
  const bfm14Limit = 144*60; // helper display only
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
}

function renderDate(){
  $("dateText").textContent=fmtDateLong(state.selectedDate);
  $("datePicker").value=state.selectedDate;
  $("schemeName").textContent=state.scheme;
  $("schemeSelect").value=state.scheme;
  $("restAsStationary").checked=!!state.restAsStationary;
  $("startDate").value=state.selectedDate;
  $("endDate").value=state.selectedDate;
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
  renderDriverSettings();
  renderBackupReminderSettings();
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
  const summary = $("graphSummaryTable").innerHTML;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Work Diary ${state.selectedDate}</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;margin:18px;color:#111}
    .wrap{max-width:1200px;margin:0 auto}
    .graphTable{width:100%;border-collapse:collapse;font-size:13px;margin-top:14px}
    .graphTable th,.graphTable td{border:1px solid #999;padding:6px;text-align:left}
    .graphTable th{background:#eee}
    .warn{background:#fff3cd;border:1px solid #e3bd4f;border-radius:10px;padding:10px;margin-top:12px}
    .small{font-size:12px;color:#555;margin-top:14px}
    .pdfBtns{display:flex;gap:8px;margin-bottom:12px}
    .pdfBtns button{padding:10px 12px;border:0;border-radius:10px;background:#2c6d5e;color:white;font-weight:800}
    .pdfBtns button+button{background:#eee;color:#111}
    .paperSheet{background:#fff;color:#111;border:2px solid #444;border-radius:18px;padding:14px;font-family:Arial,Helvetica,sans-serif}
    .psTitle{font-size:20px;font-weight:700;text-align:center;letter-spacing:.5px;margin-bottom:8px}
    .psHeaderLine{display:grid;grid-template-columns:1fr auto auto auto;gap:14px;align-items:center;margin-bottom:6px}
    .psHeaderLine .smallLbl{font-size:11px;color:#444}
    .psHeaderLine .bigText{font-size:18px;font-weight:700}
    .psHeaderLine .redText{font-size:18px;font-weight:700;color:#d82626}
    .psSectionTitle{background:#5f5f5f;color:#fff;text-align:center;font-weight:700;padding:4px 8px;margin:8px 0 6px;font-size:12px;letter-spacing:.4px}
    .psTopGrid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:8px;align-items:start}
    .psField{border:1px solid #333;min-height:38px;padding:4px 6px;background:#fff}
    .psField .lbl{font-size:11px;color:#333;margin-bottom:2px}
    .psField .val{font-size:16px;font-weight:700;color:#1439d6}
    .psField .val.black{color:#111}
    .psDayRow,.psStateRow{display:flex;gap:4px;flex-wrap:wrap}
    .psMiniBox{border:1px solid #333;min-width:28px;padding:6px 6px;text-align:center;font-size:12px;background:#fff}
    .psMiniBox.active{background:#eaf0ff;color:#1439d6;font-weight:700}
    .psCheckList{display:grid;grid-template-columns:repeat(2,auto);gap:6px 10px;align-content:start}
    .psCheck{display:flex;align-items:center;gap:6px;font-size:11px}
    .psCheckBox{width:12px;height:12px;border:1px solid #333;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
    .psCommentsArea{border:1px solid #333;min-height:72px;padding:8px;font-size:12px;white-space:pre-wrap}
    .psActivityArea{display:grid;grid-template-columns:38px 1fr;gap:0;margin-top:8px}
    .psSideTitle{writing-mode:vertical-rl;transform:rotate(180deg);background:#5f5f5f;color:#fff;font-weight:700;text-align:center;letter-spacing:.4px;padding:10px 0;font-size:12px}
    .psActivityMain{border:1px solid #333;border-left:0}
    .psRowsTable{width:100%;border-collapse:collapse}
    .psRowsTable th,.psRowsTable td{border:1px solid #333;padding:4px 6px;font-size:11px;vertical-align:top}
    .psRowsTable th{background:#fafafa}
    .psRowsTable td.vert{color:#1439d6;font-weight:700}
    .psRowsTable .optional{color:#555;font-size:10px}
    .psTotalsRow{display:flex;justify-content:flex-end;gap:28px;margin:6px 4px 0;font-size:12px;font-weight:700}
    .psTwoUpWrap{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px}
    .psSignatureBox{border:1px solid #333;min-height:55px;padding:4px 6px}
    .psFooterGrid{display:grid;grid-template-columns:1.2fr 2fr;gap:12px;margin-top:8px}
    .psFine{font-size:10px;color:#333;line-height:1.3}
    .psGraphBox{border-top:1px solid #333;padding-top:4px}
    .psHide{display:none}
    @media print{button,.pdfBtns{display:none} body{margin:10mm}}
  </style></head><body>
    <div class="wrap">
      <div class="pdfBtns"><button onclick="window.print()">Print / Save as PDF</button><button onclick="if(window.opener){window.close()}else{history.back()}">Close / Back to app</button></div>
      ${preview}
      <div style="margin-top:12px">${summary}</div>
      <div class="warn"><strong>App warnings:</strong><br>${escapeHtml(warningsText())}</div>
      <p class="small">This report is a personal helper preview only. It is not an NHVR-approved Electronic Work Diary and does not replace your official paper diary or approved EWD.</p>
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
      state.backupReminder = backup.backupReminder || state.backupReminder || {frequency:"off", lastBackupAt:"", lastPromptDate:""};
      ensureProfile();
      ensureBackupReminder();
      ensureDayDetailsContainer();
      save();
      renderAll();
      alert("Backup imported successfully.");
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
  save();
  renderAll();
  alert("Driver details saved.");
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
  $("addEntry").onclick=addEntryFromForm;
  $("quickBFM").onclick=loadBFMSample;
  $("schemeSelect").onchange=e=>{state.scheme=e.target.value;save();renderAll();}
  $("restAsStationary").onchange=e=>{state.restAsStationary=e.target.checked;save();renderAll();}
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
  $("graphDetailsForm").addEventListener("input", updateDayDetailFromGraphForm);
  $("graphDetailsForm").addEventListener("change", updateDayDetailFromGraphForm);
  $("changeDetailsEditor").addEventListener("input", handleChangeDetailsInput);
  $("clearDay").onclick=clearSelectedDay;
  $("clearAll").onclick=clearAll;
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
