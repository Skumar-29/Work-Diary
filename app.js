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
    baseTimeZone: "Local phone time"
  },
  backupReminder: {
    frequency: "off",
    lastBackupAt: "",
    lastPromptDate: ""
  }
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
function save(){
  ensureProfile();
  ensureBackupReminder();
  localStorage.setItem("truckDiaryPWA", JSON.stringify(state));
}
function load(){
  const raw = localStorage.getItem("truckDiaryPWA");
  if(raw){
    try{ state = {...state, ...JSON.parse(raw)}; }catch(e){}
  }
  ensureProfile();
  ensureBackupReminder();
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

function renderGraphPage(){
  ensureProfile();
  $("graphDate").textContent = fmtDateLong(state.selectedDate);
  $("graphDriver").textContent = state.profile.driverName || "Not entered";
  $("graphBaseTime").textContent = state.profile.baseTimeZone || "Local phone time";

  const width = 960;
  const left = 50;
  const topY = 70;
  const bottomY = 220;
  const right = width - 20;
  const slotW = (right - left) / 96;

  const labels = [];
  for(let h=0; h<=24; h++){
    const x = left + h*4*slotW;
    labels.push(`<line x1="${x}" y1="${topY}" x2="${x}" y2="${bottomY}" stroke="${h===24 ? '#bbb' : '#888'}" stroke-width="${h%6===0 ? 1.5 : 1}" />`);
    if(h < 24){
      const text = h===0 ? "12am" : h<12 ? `${h}am` : h===12 ? "12pm" : `${h-12}pm`;
      labels.push(`<text x="${x+2}" y="24" font-size="12" fill="#333">${text}</text>`);
    }
  }

  const horiz = [
    `<line x1="${left}" y1="${topY}" x2="${right}" y2="${topY}" stroke="#555" stroke-width="1.5" />`,
    `<line x1="${left}" y1="${(topY+bottomY)/2}" x2="${right}" y2="${(topY+bottomY)/2}" stroke="#bbb" stroke-width="1" stroke-dasharray="4,4" />`,
    `<line x1="${left}" y1="${bottomY}" x2="${right}" y2="${bottomY}" stroke="#555" stroke-width="1.5" />`,
    `<text x="6" y="${topY+4}" font-size="14" fill="#222">WORK</text>`,
    `<text x="10" y="${bottomY+4}" font-size="14" fill="#222">REST</text>`
  ];

  const getY = (slotIndex) => getSlot(state.selectedDate, slotIndex) === "work" ? topY : bottomY;
  let d = `M ${left} ${getY(0)}`;
  for(let i=0;i<96;i++){
    const y = getY(i);
    const nextY = i < 95 ? getY(i+1) : y;
    const xEnd = left + (i+1)*slotW;
    d += ` L ${xEnd} ${y}`;
    if(i < 95 && nextY !== y){
      d += ` L ${xEnd} ${nextY}`;
    }
  }

  const svg = `
    <svg viewBox="0 0 ${width} 270" width="100%" height="260" role="img" aria-label="Work diary graph page">
      <rect x="0" y="0" width="${width}" height="270" fill="white" />
      <rect x="${left}" y="${topY}" width="${right-left}" height="${bottomY-topY}" fill="#fff" stroke="#ccc" />
      ${labels.join("")}
      ${horiz.join("")}
      <path d="${d}" fill="none" stroke="#111" stroke-width="3" />
    </svg>`;
  $("graphSvgHolder").innerHTML = svg;

  const segs = segmentsForDay(state.selectedDate);
  const rows = segs.map(s => `<tr><td>${fmtHM(s.startMins)}</td><td>${s.endMins>=1440 ? "24:00" : fmtHM(s.endMins)}</td><td>${activityLabel(s.activity)}</td><td>${Math.floor((s.endMins-s.startMins)/60)}h ${(s.endMins-s.startMins)%60}m</td></tr>`).join("");
  $("graphSummaryTable").innerHTML = `
    <table class="graphTable">
      <thead><tr><th>Start</th><th>End</th><th>Activity</th><th>Duration</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
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
    save(); renderAll();
  }
}
function clearAll(){
  if(confirm("Clear all saved diary data from this phone/browser?")){
    localStorage.removeItem("truckDiaryPWA");
    state.slots={}; state.entries=[]; state.activeTimer=null;
    state.profile={driverName:"", licenceNumber:"", baseTimeZone:"Local phone time"};
    state.backupReminder={frequency:"off", lastBackupAt:"", lastPromptDate:""};
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
  const t = totalsForDay();
  const segs = segmentsForDay(state.selectedDate);
  const rows = segs.map(s => `<tr><td>${fmtHM(s.startMins)}</td><td>${s.endMins>=1440 ? "24:00" : fmtHM(s.endMins)}</td><td>${activityLabel(s.activity)}</td><td>${Math.floor((s.endMins-s.startMins)/60)}h ${(s.endMins-s.startMins)%60}m</td></tr>`).join("");
  const graph = $("graphSvgHolder").innerHTML;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Work Diary ${state.selectedDate}</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:24px;color:#111}
    h1{font-size:24px;margin:0 0 8px}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0 18px}
    .box{border:1px solid #ccc;border-radius:10px;padding:10px}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th,td{border:1px solid #999;padding:7px;text-align:left;font-size:13px}
    th{background:#eee}
    .warn{background:#fff3cd;border:1px solid #e3bd4f;border-radius:10px;padding:10px;margin-top:12px}
    .small{font-size:12px;color:#555;margin-top:20px}
    .graph{border:1px solid #ccc;border-radius:10px;padding:10px;margin-top:14px}
    .pdfBtns{display:flex;gap:8px;margin-bottom:12px}.pdfBtns button{padding:10px 12px;border:0;border-radius:10px;background:#2c6d5e;color:white;font-weight:800}.pdfBtns button+button{background:#eee;color:#111}@media print{button,.pdfBtns{display:none} body{margin:12mm}}
  </style></head><body>
    <div class="pdfBtns"><button onclick="window.print()">Print / Save as PDF</button><button onclick="if(window.opener){window.close()}else{history.back()}">Close / Back to app</button></div>
    <h1>Truck Work Diary Report</h1>
    <div class="meta">
      <div class="box"><strong>Date:</strong><br>${escapeHtml(fmtDateLong(state.selectedDate))}</div>
      <div class="box"><strong>Scheme:</strong><br>${escapeHtml(state.scheme)}</div>
      <div class="box"><strong>Driver:</strong><br>${escapeHtml(state.profile.driverName || "Not entered")}</div>
      <div class="box"><strong>Licence:</strong><br>${escapeHtml(state.profile.licenceNumber || "Not entered")}</div>
      <div class="box"><strong>Base time:</strong><br>${escapeHtml(state.profile.baseTimeZone || "Local phone time")}</div>
      <div class="box"><strong>Totals:</strong><br>Work ${minsToHoursText(t.work)} | Rest ${minsToHoursText(t.rest)}</div>
    </div>
    <div class="graph">${graph}</div>
    <table>
      <thead><tr><th>Start</th><th>End</th><th>Activity</th><th>Duration</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="warn"><strong>App warnings:</strong><br>${escapeHtml(warningsText())}</div>
    <p class="small">This report is from a personal checking helper only. It is not an NHVR-approved Electronic Work Diary and does not replace your official paper diary/EWD.</p>
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
    if(confirm("Backup reminder: your JSON backup is due. Export Backup JSON now?")){
      exportJsonBackup();
    }
  }, 700);
}

function exportJsonBackup(){
  ensureProfile();
  const backup = {
    app: "Truck Work Diary Checker",
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    selectedDate: state.selectedDate,
    scheme: state.scheme,
    restAsStationary: state.restAsStationary,
    slots: state.slots || {},
    entries: state.entries || [],
    profile: state.profile || {},
    backupReminder: state.backupReminder || {},
    note: "Personal backup file for restoring this app data. Keep this file private."
  };
  state.backupReminder.lastBackupAt = new Date().toISOString();
  backup.backupReminder = state.backupReminder;
  save();
  renderBackupReminderSettings();
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `truck-work-diary-backup-${state.selectedDate}.json`;
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
      state.profile = backup.profile || {driverName:"", licenceNumber:"", baseTimeZone:"Local phone time"};
      state.backupReminder = backup.backupReminder || state.backupReminder || {frequency:"off", lastBackupAt:"", lastPromptDate:""};
      ensureProfile();
      ensureBackupReminder();
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
  $("importJsonBackup").onclick=()=>$("jsonImportFile").click();
  $("jsonImportFile").onchange=e=>importJsonBackupFromFile(e.target.files[0]);
  $("backupReminderFrequency").onchange=saveBackupReminderSetting;
  $("saveDriverSettings").onclick=saveDriverSettings;
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
      renderTimer();
    };
  });

  setupSwipePainting();
  setInterval(renderTimer, 30000);
  setInterval(()=>{ $("fakeTime").textContent=new Date().toLocaleTimeString("en-AU",{hour:"numeric",minute:"2-digit"}); }, 30000);
  renderAll();
  maybeShowBackupReminder();
}

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js").catch(()=>{}));
}
setup();
