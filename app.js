const $=id=>document.getElementById(id);
const defaultData={start:"2025-07-23",end:"2026-12-31",target:25,records:{},firebaseConfig:""};
let data=load(), selected=isoToday(), view=new Date(selected+"T12:00:00");
function load(){try{return {...defaultData,...JSON.parse(localStorage.getItem("attendanceData")||"{}")}}catch{return structuredClone(defaultData)}}
function save(){data.updatedAt=Date.now();localStorage.setItem("attendanceData",JSON.stringify(data)); render(); syncCloud();}
function isoToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function parse(s){return new Date(s+"T12:00:00")}
function fmt(s){return parse(s).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})}
function iso(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function inPeriod(s){return s>=data.start&&s<=data.end}
function isWorkday(s){return parse(s).getDay()!==0 && inPeriod(s) && data.records[s]!=="holiday"}
function allDays(){let a=[];if(!data.start||!data.end||data.start>data.end)return a;for(let d=parse(data.start);iso(d)<=data.end;d.setDate(d.getDate()+1)){let s=iso(d);if(parse(s).getDay()!==0 && data.records[s]!=="holiday")a.push(s)}return a}
function calc(){const days=allDays(),present=days.filter(s=>data.records[s]==="present").length,absent=days.filter(s=>data.records[s]==="absent").length,marked=present+absent,total=days.length,required=Math.ceil(total*Number(data.target||0)/100),needed=Math.max(0,required-present),remaining=days.filter(s=>s>=isoToday()&&data.records[s]!== "present"&&data.records[s]!=="absent").length;return {days,present,absent,marked,total,required,needed,remaining}}
function render(){const c=calc();$("periodText").textContent=`${fmt(data.start)} – ${fmt(data.end)}`;$("presentCount").textContent=c.present;$("absentCount").textContent=c.absent;$("requiredCount").textContent=c.required;$("neededCount").textContent=c.needed;
const pct=c.total?Math.round(c.present/c.total*100):0;$("progressText").textContent=`${pct}% attendance`; $("progressMeta").textContent=`${c.present} / ${c.total} working days`; $("progressBar").style.width=Math.min(100,pct)+"%";
$("selectedDateLabel").textContent=fmt(selected);let status=data.records[selected]||"Not marked";$("selectedStatus").textContent=status[0].toUpperCase()+status.slice(1);$("presentBtn").disabled=!inPeriod(selected)||data.records[selected]==="holiday";$("absentBtn").disabled=!inPeriod(selected)||data.records[selected]==="holiday";
$("monthLabel").textContent=view.toLocaleDateString(undefined,{month:"long",year:"numeric"});const cal=$("calendar");cal.innerHTML="";
const first=new Date(view.getFullYear(),view.getMonth(),1);let offset=(first.getDay()+6)%7;const start=new Date(first);start.setDate(first.getDate()-offset);
for(let i=0;i<42;i++){let d=new Date(start);d.setDate(start.getDate()+i);let s=iso(d),b=document.createElement("button");b.className="day";if(d.getMonth()!==view.getMonth())b.classList.add("outside");if(d.getDay()===0)b.classList.add("sunday");if(s===selected)b.classList.add("selected");let r=data.records[s];if(r)b.classList.add(r);b.innerHTML=`<span class="num">${d.getDate()}</span>${r?`<span class="tag">${r==="present"?"✓ Present":r==="absent"?"✕ Absent":"Holiday"}</span>`:""}`;b.disabled=!inPeriod(s);b.addEventListener("click",()=>{selected=s;render()});cal.appendChild(b)}
}
function mark(v){if(!inPeriod(selected))return;data.records[selected]=v;save()}
$("presentBtn").onclick=()=>mark("present");$("absentBtn").onclick=()=>mark("absent");
$("prevMonth").onclick=()=>{view.setMonth(view.getMonth()-1);render()};$("nextMonth").onclick=()=>{view.setMonth(view.getMonth()+1);render()};
$("holidayBtn").onclick=()=>{if(!inPeriod(selected))return;data.records[selected]=data.records[selected]==="holiday"?undefined:"holiday";if(!data.records[selected])delete data.records[selected];save()};
$("clearBtn").onclick=()=>{delete data.records[selected];save()};
$("settingsBtn").onclick=()=>{$("startDate").value=data.start;$("endDate").value=data.end;$("targetPct").value=data.target;$("firebaseConfig").value=data.firebaseConfig||"";$("firebaseEmail").value=data.firebaseEmail||"";$("firebasePassword").value=data.firebasePassword||"";$("settingsDialog").showModal()};
$("saveSettings").onclick=e=>{e.preventDefault();let st=$("startDate").value,en=$("endDate").value,p=Number($("targetPct").value);if(!st||!en||st>en||p<0||p>100){alert("Check dates and percentage.");return}data.start=st;data.end=en;data.target=p;data.firebaseConfig=$("firebaseConfig").value.trim();data.firebaseEmail=$("firebaseEmail").value.trim();data.firebasePassword=$("firebasePassword").value;$("settingsDialog").close();save()};
$("exportBtn").onclick=()=>{let rows=[["Date","Day","Status"]];for(let d=parse(data.start);iso(d)<=data.end;d.setDate(d.getDate()+1)){let s=iso(d);rows.push([s,d.toLocaleDateString(undefined,{weekday:"long"}),data.records[s]|| (d.getDay()===0?"Sunday":"Unmarked")])}let csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");let blob=new Blob([csv],{type:"text/csv"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="attendance.csv";a.click();URL.revokeObjectURL(a.href)};
$("backupBtn").onclick=()=>{$("backupText").value=JSON.stringify(data,null,2);$("backupDialog").showModal()};
$("restoreBtn").onclick=e=>{e.preventDefault();try{let x=JSON.parse($("backupText").value);if(!x.start||!x.end||!x.records)throw 0;data={...defaultData,...x};$("backupDialog").close();save()}catch{alert("Invalid backup file.")}};
render();
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
async function getFirebase(){
 const cfg=JSON.parse(data.firebaseConfig||"{}");
 if(!cfg.apiKey||!cfg.projectId)throw Error("Firebase config incomplete");
 if(!window.firebaseApp){
  const {initializeApp}=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const {getAuth}=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  const {getFirestore,doc,setDoc,getDoc}=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const app=initializeApp(cfg);window.firebaseApp={app,auth:getAuth(app),db:getFirestore(app),doc,setDoc,getDoc};
 }
 return window.firebaseApp;
}
async function authAction(mode){
 try{
  const f=await getFirebase(),{createUserWithEmailAndPassword,signInWithEmailAndPassword}=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  const email=$("firebaseEmail").value.trim(),password=$("firebasePassword").value;
  if(!email||!password){alert("Enter email and password.");return}
  if(mode==="create")await createUserWithEmailAndPassword(f.auth,email,password);else await signInWithEmailAndPassword(f.auth,email,password);
  data.firebaseEmail=email;data.firebasePassword=password;data.updatedAt=Date.now();localStorage.setItem("attendanceData",JSON.stringify(data));
  $("syncStatus").textContent="Signed in · syncing";await syncCloud();alert("Firebase account ready. Use the same account on your other device.");
 }catch(e){alert("Firebase sign-in failed: "+(e.message||e))}
}
$("createAccount").onclick=()=>authAction("create");
$("loginAccount").onclick=()=>authAction("login");
async function syncCloud(){
 if(!data.firebaseConfig){$("syncStatus").textContent="Saved on this device";return}
 try{
  const f=await getFirebase(),user=f.auth.currentUser;
  if(!user){$("syncStatus").textContent="Sign in to enable cloud sync";return}
  const ref=f.doc(f.db,"attendance",user.uid),snap=await f.getDoc(ref);
  if(snap.exists()){
   const remote=snap.data();
   if((remote.updatedAt||0)>(data.updatedAt||0)){data={...defaultData,...remote};localStorage.setItem("attendanceData",JSON.stringify(data));render()}
   else{data.updatedAt=Date.now();await f.setDoc(ref,data)}
  }else{data.updatedAt=Date.now();await f.setDoc(ref,data)}
  $("syncStatus").textContent="Synced online";
 }catch(err){console.error(err);$("syncStatus").textContent="Offline / sync setup needed"}
}

