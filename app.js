const $=id=>document.getElementById(id);
const defaultData={start:"2025-07-23",end:"2026-12-31",target:25,records:{},firebaseConfig:""};
let data=load(), selected=isoToday(), view=new Date(selected+"T12:00:00");
let firebase=null, unsubscribe=null, cloudReady=false, writeTimer=null, importRows=[];
function load(){try{const x=JSON.parse(localStorage.getItem("attendanceData")||"{}");const merged={...defaultData,...x,records:{...(x.records||{})}};delete merged.firebasePassword;return merged}catch{return structuredClone(defaultData)}}
function persistLocal(){delete data.firebasePassword;localStorage.setItem("attendanceData",JSON.stringify(data))}
function save(){data.updatedAt=Date.now();persistLocal();render();scheduleCloudWrite()}
function isoToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function parse(s){return new Date(s+"T12:00:00")}
function fmt(s){return parse(s).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})}
function iso(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function inPeriod(s){return s>=data.start&&s<=data.end}
function allDays(){let a=[];if(!data.start||!data.end||data.start>data.end)return a;for(let d=parse(data.start);iso(d)<=data.end;d.setDate(d.getDate()+1)){let s=iso(d);if(parse(s).getDay()!==0&&data.records[s]!=="holiday")a.push(s)}return a}
function calc(){const days=allDays(),present=days.filter(s=>data.records[s]==="present").length,absent=days.filter(s=>data.records[s]==="absent").length,total=days.length,required=Math.ceil(total*Number(data.target||0)/100),needed=Math.max(0,required-present);return {days,present,absent,total,required,needed}}
function render(){const c=calc();$("periodText").textContent=`${fmt(data.start)} – ${fmt(data.end)}`;$("presentCount").textContent=c.present;$("absentCount").textContent=c.absent;$("requiredCount").textContent=c.required;$("neededCount").textContent=c.needed;
const pct=c.total?Math.round(c.present/c.total*100):0;$("progressText").textContent=`${pct}% attendance`;$("progressMeta").textContent=`${c.present} / ${c.total} working days`;$("progressBar").style.width=Math.min(100,pct)+"%";
$("selectedDateLabel").textContent=fmt(selected);let status=data.records[selected]||"Not marked";$("selectedStatus").textContent=status[0].toUpperCase()+status.slice(1);$("presentBtn").disabled=!inPeriod(selected)||data.records[selected]==="holiday";$("absentBtn").disabled=!inPeriod(selected)||data.records[selected]==="holiday";
$("monthLabel").textContent=view.toLocaleDateString(undefined,{month:"long",year:"numeric"});const cal=$("calendar");cal.innerHTML="";
const first=new Date(view.getFullYear(),view.getMonth(),1);let offset=(first.getDay()+6)%7;const start=new Date(first);start.setDate(first.getDate()-offset);
for(let i=0;i<42;i++){let d=new Date(start);d.setDate(start.getDate()+i);let s=iso(d),b=document.createElement("button");b.className="day";if(d.getMonth()!==view.getMonth())b.classList.add("outside");if(d.getDay()===0)b.classList.add("sunday");if(s===selected)b.classList.add("selected");let r=data.records[s];if(r)b.classList.add(r);b.innerHTML=`<span class="num">${d.getDate()}</span>${r?`<span class="tag">${r==="present"?"✓ Present":r==="absent"?"✕ Absent":"Holiday"}</span>`:""}`;b.disabled=!inPeriod(s);b.addEventListener("click",()=>{selected=s;render()});cal.appendChild(b)}
}
function mark(v){if(!inPeriod(selected)||parse(selected).getDay()===0)return;data.records[selected]=v;save()}
$("presentBtn").onclick=()=>mark("present");$("absentBtn").onclick=()=>mark("absent");
$("prevMonth").onclick=()=>{view.setMonth(view.getMonth()-1);render()};$("nextMonth").onclick=()=>{view.setMonth(view.getMonth()+1);render()};
$("holidayBtn").onclick=()=>{if(!inPeriod(selected))return;if(data.records[selected]==="holiday")delete data.records[selected];else data.records[selected]="holiday";save()};
$("clearBtn").onclick=()=>{delete data.records[selected];save()};
$("settingsBtn").onclick=()=>{$("startDate").value=data.start;$("endDate").value=data.end;$("targetPct").value=data.target;$("firebaseConfig").value=data.firebaseConfig||"";$("firebaseEmail").value=data.firebaseEmail||"";$("firebasePassword").value="";$("settingsDialog").showModal()};
$("saveSettings").onclick=e=>{e.preventDefault();let st=$("startDate").value,en=$("endDate").value,p=Number($("targetPct").value);if(!st||!en||st>en||p<0||p>100){alert("Check dates and percentage.");return}data.start=st;data.end=en;data.target=p;data.firebaseConfig=$("firebaseConfig").value.trim();data.firebaseEmail=$("firebaseEmail").value.trim();$("settingsDialog").close();save();initFirebase().catch(showFirebaseError)};
$("exportBtn").onclick=()=>{let rows=[["Date","Day","Status"]];for(let d=parse(data.start);iso(d)<=data.end;d.setDate(d.getDate()+1)){let s=iso(d);rows.push([s,d.toLocaleDateString(undefined,{weekday:"long"}),data.records[s]||(d.getDay()===0?"Sunday":"Unmarked")])}downloadCsv(rows,"attendance.csv")};
function downloadCsv(rows,name){let csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\r\n");let blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
$("backupBtn").onclick=()=>{$("backupText").value=JSON.stringify(data,null,2);$("backupDialog").showModal()};
$("restoreBtn").onclick=e=>{e.preventDefault();try{let x=JSON.parse($("backupText").value);if(!x.start||!x.end||!x.records)throw 0;data={...defaultData,...x,records:{...x.records}};delete data.firebasePassword;$("backupDialog").close();save()}catch{alert("Invalid backup file.")}};

async function getFirebase(){
 const cfg=JSON.parse(data.firebaseConfig||"{}");if(!cfg.apiKey||!cfg.projectId)throw Error("Firebase config incomplete");
 if(!firebase){const v="10.12.2";const [appM,authM,dbM]=await Promise.all([import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`),import(`https://www.gstatic.com/firebasejs/${v}/firebase-auth.js`),import(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore.js`)]);const app=appM.initializeApp(cfg);firebase={app,auth:authM.getAuth(app),db:dbM.getFirestore(app),authM,dbM};}
 return firebase;
}
function status(s){$("syncStatus").textContent=s}
function showFirebaseError(e){console.error(e);status("Firebase setup/login needed");alert("Firebase: "+(e.message||e))}
async function authAction(mode){
 try{const f=await getFirebase(),email=$("firebaseEmail").value.trim(),password=$("firebasePassword").value;if(!email||!password){alert("Enter email and password.");return}
 if(mode==="create")await f.authM.createUserWithEmailAndPassword(f.auth,email,password);else await f.authM.signInWithEmailAndPassword(f.auth,email,password);
 data.firebaseEmail=email;persistLocal();$("firebasePassword").value="";status("Signed in · connecting");await attachCloudListener();alert("Signed in. Use this same account on your other device.");}
 catch(e){showFirebaseError(e)}
}
$("createAccount").onclick=()=>authAction("create");$("loginAccount").onclick=()=>authAction("login");
async function initFirebase(){if(!data.firebaseConfig){status("Saved on this device");return}const f=await getFirebase();f.authM.onAuthStateChanged(f.auth,async user=>{if(user){data.firebaseEmail=user.email||data.firebaseEmail;persistLocal();await attachCloudListener()}else{if(unsubscribe){unsubscribe();unsubscribe=null}cloudReady=false;status("Sign in to enable cloud sync")}})}
async function attachCloudListener(){
 const f=await getFirebase(),user=f.auth.currentUser;if(!user){status("Sign in to enable cloud sync");return}
 if(unsubscribe)unsubscribe();const ref=f.dbM.doc(f.db,"users",user.uid,"attendance","main");
 status("Connecting to cloud…");
 unsubscribe=f.dbM.onSnapshot(ref,snap=>{if(snap.exists()){const remote=snap.data();const localStamp=data.updatedAt||0,remoteStamp=remote.updatedAt||0;
 if(remoteStamp>localStamp){data={...defaultData,...remote,records:{...(remote.records||{})}};delete data.firebasePassword;persistLocal();render()}
 else if(!cloudReady){f.dbM.setDoc(ref,{...data,updatedAt:Math.max(localStamp,remoteStamp)+1})}
 }else{f.dbM.setDoc(ref,{...data,updatedAt:Date.now()})}
 cloudReady=true;status("Synced online · "+(user.email||"account"));
 },err=>{console.error(err);status("Sync error — check Firebase rules/network")});
}
function scheduleCloudWrite(){if(writeTimer)clearTimeout(writeTimer);writeTimer=setTimeout(writeCloud,500)}
async function writeCloud(){try{const f=await getFirebase(),user=f.auth.currentUser;if(!user){if(data.firebaseConfig)status("Saved locally · sign in for sync");return}const ref=f.dbM.doc(f.db,"users",user.uid,"attendance","main");await f.dbM.setDoc(ref,{...data,updatedAt:Date.now()});status("Synced online")}catch(e){console.error(e);status("Saved locally · cloud sync failed")}}
$("syncNowBtn").onclick=()=>writeCloud();
$("importBtn").onclick=()=>{$("importFile").value="";$("importPreview").value="";$("importSummary").textContent="";$("confirmImport").disabled=true;importRows=[];$("importDialog").showModal()};
$("importFile").onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 try{let rows;if(file.name.toLowerCase().endsWith(".csv")){const text=await file.text();rows=parseCsv(text)}else{if(!window.XLSX)throw Error("Excel reader failed to load. Check internet and reload.");const wb=XLSX.read(await file.arrayBuffer(),{type:"array"});rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""})}
 importRows=normalizeImport(rows);$("importPreview").value=importRows.slice(0,20).map(x=>`${x.date} | ${x.status}`).join("\n");$("importSummary").textContent=`Valid rows: ${importRows.length}. Previewing up to 20 rows. Dates outside your period and invalid statuses are skipped.`;$("confirmImport").disabled=!importRows.length;
 }catch(err){alert("Could not read file: "+err.message)}
};
function parseCsv(text){const lines=text.replace(/^\ufeff/,"").split(/\r?\n/).filter(x=>x.trim());return lines.map(line=>{let out=[],cur="",q=false;for(let i=0;i<line.length;i++){let ch=line[i];if(ch==='"'&&line[i+1]==='"'&&q){cur+='"';i++}else if(ch==='"')q=!q;else if(ch===","&&!q){out.push(cur);cur=""}else cur+=ch}out.push(cur);return out})}
function normalizeImport(rows){
 if(!rows.length)return [];let headers=Array.isArray(rows[0])?rows[0].map(x=>String(x).trim().toLowerCase()):Object.keys(rows[0]).map(x=>x.trim().toLowerCase());
 let dateIdx=headers.findIndex(x=>["date","attendance date","day"].includes(x)),statusIdx=headers.findIndex(x=>["status","attendance","present/absent","attendance status"].includes(x));
 if(dateIdx<0||statusIdx<0){alert("Import needs columns named Date and Status (or Attendance).");return []}
 const body=Array.isArray(rows[0])?rows.slice(1):rows;let valid=[];
 for(const row of body){let rawDate=Array.isArray(row)?row[dateIdx]:row[Object.keys(row)[dateIdx]],rawStatus=Array.isArray(row)?row[statusIdx]:row[Object.keys(row)[statusIdx]];
 let date=normalizeDate(rawDate),status=String(rawStatus||"").trim().toLowerCase();
 if(["p","present","yes","1"].includes(status))status="present";else if(["a","absent","no","0"].includes(status))status="absent";else if(["h","holiday"].includes(status))status="holiday";else continue;
 if(date&&inPeriod(date)&&parse(date).getDay()!==0)valid.push({date,status});
 }return valid;
}
function normalizeDate(v){if(v instanceof Date)return iso(v);if(typeof v==="number"&&window.XLSX){const d=XLSX.SSF.parse_date_code(v);if(d)return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`}
 let s=String(v||"").trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
 let m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);if(m){let a=Number(m[1]),b=Number(m[2]),y=m[3]; // interpret DD/MM/YYYY for Indian users
 return `${y}-${String(b).padStart(2,"0")}-${String(a).padStart(2,"0")}`}
 let d=new Date(s);if(!isNaN(d))return iso(d);return null;
}
$("confirmImport").onclick=()=>{if(!importRows.length)return;let duplicateCount=0;for(const r of importRows){if(data.records[r.date]&&data.records[r.date]!==r.status)duplicateCount++;data.records[r.date]=r.status}save();$("importDialog").close();alert(`Imported ${importRows.length} rows. ${duplicateCount} existing dates were replaced by imported values.`)};
render();if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});initFirebase().catch(showFirebaseError);
