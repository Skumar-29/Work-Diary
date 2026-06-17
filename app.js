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
  slots: {},     // yyyy-mm-dd -> array of "work"|"rest"|"stationary"|undefined
  entries: [],
  activeTimer: null,
  paintMode: "work"
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
function normaliseToQuarter(mins){ return Math.floor(mins / 15) * 15; }
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

function save(){
  localStorage.setItem("truckDiaryPWA", JSON.stringify(state));
}
function load(){
  const raw = localStorage.getItem("truckDiaryPWA");
  if(raw){
    try{ state = {...state, ...JSON.parse(raw)}; }catch(e){}
  }
}

function isWork(key, idx){ return getSlot(key, idx) === "work"; }
function isRestType(type){ return type === "rest" || type === "stationary"; }
function isStationary(key, idx){
  const t = getSlot(key, idx);
  return t === "stationary" || (state.restAsStationary && t === "rest");
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
function countStationaryBetween(endAbs, windowMins){
  let count = 0;
  const startAbs = endAbs - windowMins*60000;
  for(let t=startAbs; t<endAbs; t+=SLOT*60000){
    const {key, slot} = absToKeySlot(t);
    if(isStationary(key, slot)) count += SLOT;
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

function renderGrid(){
  const grid = $("diaryGrid");
  grid.innerHTML = "";
  const sections = [
    {start:0, labels:["midnight","1am","2am","3am","4am","5am"]},
    {start:6, labels:["6am","7am","8am","9am","10am","11am"]},
    {start:12, labels:["noon","1pm","2pm","3pm","4pm","5pm"]},
    {start:18, labels:["6pm","7pm","8pm","9pm","10pm","11pm"]}
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
    const workLabel = document.createElement("div");
    workLabel.className = "rowLabel";
    workLabel.textContent = "Work";
    block.appendChild(workLabel);
    for(let i=0;i<24;i++){
      const slotIndex = sec.start*4 + i;
      const cell = document.createElement("button");
      cell.className = "slot";
      const t = getSlot(state.selectedDate, slotIndex);
      if(t === "work") cell.classList.add(slotBreaches(state.selectedDate, slotIndex) ? "bad" : "work");
      else cell.classList.add("empty");
      if((i+1)%4===0) cell.classList.add("thick");
      cell.title = `${fmtHM(slotIndex*15)} Work`;
      cell.dataset.slot = slotIndex;
      cell.dataset.row = "work";
      block.appendChild(cell);
    }
    const restLabel = document.createElement("div");
    restLabel.className = "rowLabel";
    restLabel.textContent = "Rest";
    block.appendChild(restLabel);
    for(let i=0;i<24;i++){
      const slotIndex = sec.start*4 + i;
      const cell = document.createElement("button");
      cell.className = "slot";
      const t = getSlot(state.selectedDate, slotIndex);
      if(t === "work") cell.classList.add("empty");
      else if(t === "stationary") cell.classList.add("stationary");
      else cell.classList.add("rest");
      if((i+1)%4===0) cell.classList.add("thick");
      cell.title = `${fmtHM(slotIndex*15)} Rest`;
      cell.dataset.slot = slotIndex;
      cell.dataset.row = "rest";
      block.appendChild(cell);
    }
    grid.appendChild(block);
  }
}

function currentPaintValue(){
  if(state.paintMode === "clear") return undefined;
  return state.paintMode || "work";
}
function quickSetSlot(idx, val){
  setSlot(state.selectedDate, idx, val);
  addEntryRecord(state.selectedDate, idx*SLOT, state.selectedDate, (idx+1)*SLOT, val || "clear", "Tapped grid");
  save();
  renderAll();
}
function paintSlotByElement(el){
  const cell = el && el.closest ? el.closest(".slot[data-slot]") : null;
  if(!cell) return false;
  const idx = Number(cell.dataset.slot);
  if(Number.isNaN(idx)) return false;
  const val = currentPaintValue();
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
  let drawing = false;
  let changed = false;
  let startSlot = null;
  let lastSlot = null;

  function start(e){
    const target = e.target.closest ? e.target.closest(".slot[data-slot]") : null;
    if(!target) return;
    drawing = true;
    changed = false;
    startSlot = Number(target.dataset.slot);
    lastSlot = startSlot;
    grid.classList.add("painting");
    paintSlotByElement(target);
    changed = true;
    e.preventDefault();
  }

  function move(e){
    if(!drawing) return;
    const point = e.touches ? e.touches[0] : e;
    const el = document.elementFromPoint(point.clientX, point.clientY);
    const cell = el && el.closest ? el.closest(".slot[data-slot]") : null;
    if(!cell) return;
    const idx = Number(cell.dataset.slot);
    if(Number.isNaN(idx) || idx === lastSlot) return;

    const from = Math.min(lastSlot, idx);
    const to = Math.max(lastSlot, idx);
    for(let i = from; i <= to; i++){
      const slotEl = grid.querySelector(`.slot[data-slot="${i}"]`);
      paintSlotByElement(slotEl);
    }
    lastSlot = idx;
    changed = true;
    e.preventDefault();
  }

  function end(){
    if(!drawing) return;
    drawing = false;
    grid.classList.remove("painting");
    document.querySelectorAll(".slot.dragPreview").forEach(x => x.classList.remove("dragPreview"));
    if(changed){
      const activity = currentPaintValue() || "clear";
      if(startSlot !== null && lastSlot !== null){
        const a = Math.min(startSlot, lastSlot);
        const b = Math.max(startSlot, lastSlot);
        addEntryRecord(state.selectedDate, a*SLOT, state.selectedDate, (b+1)*SLOT, activity, "Swipe fill");
      }
      save();
      renderAll();
    }
    startSlot = null;
    lastSlot = null;
  }

  grid.addEventListener("touchstart", start, {passive:false});
  grid.addEventListener("touchmove", move, {passive:false});
  grid.addEventListener("touchend", end);
  grid.addEventListener("touchcancel", end);

  grid.addEventListener("mousedown", start);
  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", end);
}
function renderPaintButtons(){
  document.querySelectorAll(".paintBtn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.paint === (state.paintMode || "work"));
  });
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
function renderTodayAdvice(){
  const el=$("todayAdvice");
  const warns=checkDayWarnings();
  el.innerHTML = warns.map(w=>`<p>${w.text}</p>`).join("");
}
function renderTimer(){
  const s=$("liveStatus"), since=$("liveSince");
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
function renderAll(){
  renderDate(); renderAlerts(); renderGrid(); renderTotals(); renderRuleCards(); renderNextBreak(); renderTodayAdvice(); renderTimer(); renderPaintButtons();
}

function loadBFMSample(){
  const d = state.selectedDate;
  const next = addDays(d,1);
  // Clear selected and next morning for clean sample
  state.slots[d]=Array(SLOTS_PER_DAY).fill(undefined);
  state.slots[next]=Array(SLOTS_PER_DAY).fill(undefined);
  // previous stationary rest 11:00-18:00
  for(let i=44;i<72;i++) setSlot(d,i,"stationary");
  // work 18:00-00:00
  for(let i=72;i<96;i++) setSlot(d,i,"work");
  // rest 00:00-00:15, work 00:15-02:45, rest 02:45-03:00, work 03:00-05:30, rest 05:30-06:00, work 06:00-09:00, stationary 09:00-16:00
  setSlot(next,0,"rest");
  for(let i=1;i<11;i++) setSlot(next,i,"work");
  setSlot(next,11,"rest");
  for(let i=12;i<22;i++) setSlot(next,i,"work");
  for(let i=22;i<24;i++) setSlot(next,i,"rest");
  for(let i=24;i<36;i++) setSlot(next,i,"work");
  for(let i=36;i<64;i++) setSlot(next,i,"stationary");
  state.entries.push({id:Date.now()+"sample", start:`${d} 11:00`, end:`${d} 18:00`, activity:"stationary", note:"Sample major rest"});
  state.entries.push({id:Date.now()+"sample2", start:`${d} 18:00`, end:`${next} 00:00`, activity:"work", note:"Sample BFM work"});
  state.entries.push({id:Date.now()+"sample3", start:`${next} 00:00`, end:`${next} 00:15`, activity:"rest", note:"Sample rest"});
  save(); renderAll();
}
function clearSelectedDay(){
  if(confirm("Clear all blocks for selected day?")){
    state.slots[state.selectedDate]=Array(SLOTS_PER_DAY).fill(undefined);
    save(); renderAll();
  }
}
function clearAll(){
  if(confirm("Clear all saved diary data from this phone/browser?")){
    localStorage.removeItem("truckDiaryPWA");
    state.slots={}; state.entries=[]; state.activeTimer=null;
    save(); renderAll();
  }
}
function exportCsv(){
  const rows=[["start","end","activity","note"]];
  state.entries.forEach(e=>rows.push([e.start,e.end,e.activity,e.note || ""]));
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download="truck-work-diary-export.csv";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function startTimer(activity){
  if(state.activeTimer && !confirm("Stop current timer and start a new one?")) return;
  state.activeTimer={activity, startISO:new Date().toISOString()};
  save(); renderAll();
}
function stopTimer(){
  if(!state.activeTimer){ alert("No active timer."); return; }
  const start=new Date(state.activeTimer.startISO);
  const end=new Date();
  const roundedStart = new Date(Math.floor(start.getTime()/(SLOT*60000))*(SLOT*60000));
  const roundedEnd = new Date(Math.ceil(end.getTime()/(SLOT*60000))*(SLOT*60000));
  for(let t=roundedStart.getTime(); t<roundedEnd.getTime(); t+=SLOT*60000){
    const {key,slot}=absToKeySlot(t);
    setSlot(key,slot,state.activeTimer.activity);
  }
  addEntryRecord(toKey(roundedStart), roundedStart.getHours()*60+roundedStart.getMinutes(), toKey(roundedEnd), roundedEnd.getHours()*60+roundedEnd.getMinutes(), state.activeTimer.activity, "Live timer");
  state.selectedDate=toKey(roundedStart);
  state.activeTimer=null;
  save(); renderAll();
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
    };
  });
  document.querySelectorAll(".paintBtn").forEach(btn=>{
    btn.onclick=()=>{
      state.paintMode = btn.dataset.paint;
      save();
      renderPaintButtons();
    };
  });
  setupSwipePainting();
  setInterval(renderTimer, 30000);
  setInterval(()=>{ $("fakeTime").textContent=new Date().toLocaleTimeString("en-AU",{hour:"numeric",minute:"2-digit"}); }, 30000);
  renderAll();
}
if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js").catch(()=>{}));
}
setup();
