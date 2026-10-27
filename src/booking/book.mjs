// ---------- réservation des salles (planning Google Sheet d'Intermède) ----------
// BOOK_API : URL de l'application Web Apps Script déployée par Intermède (voir booking/LISEZMOI.md).
// Vide → la page affiche les créneaux sans disponibilité et la demande part par mail à Zoé.
const BOOK_API='';
const BOOK_MAIL='zoe.ducrocq@intermede.co';
const ROOMS=[
  {key:'foyer',space:'foyer',name:'Le Foyer',floor:'RDC',cap:'200 debout · 50 assis',note:'Événements de plus de 50 personnes : prévenir Zoé.'},
  {key:'s012',space:'s012',name:'Salle 012',floor:'RDC',cap:'20 places'},
  {key:'s011',space:'s011',name:'Salle 011',floor:'RDC',cap:'6 places'},
  {key:'s010',space:'s010',name:'Salle 010',floor:'RDC',cap:'6 places'},
  {key:'s009',space:'s009',name:'Salle 009',floor:'RDC',cap:'6 places'},
  {key:'s008',space:'s008',name:'Salle 008',floor:'RDC',cap:'6 places'},
  {key:'s013',space:'s013',name:'Salle 013',floor:'RDC',cap:'4 places'},
  {key:'s171',space:'s171',name:'Salle 171',floor:'1er étage',cap:'12 places',occ:true},
  {key:'video',space:null,name:'Salle vidéo',floor:'',cap:'10 places',occ:true},
];
const roomBySpace=new Map(ROOMS.filter(r=>r.space).map(r=>[r.space,r]));
const SLOTDEF=[{id:'matin',label:'Matin',from:8,to:12},{id:'aprem',label:'Après-midi',from:13,to:18},{id:'soir',label:'Soir',from:18,to:22}];
const BOOK=(()=>{
  const dlg=document.getElementById('bookDlg'), body=document.getElementById('bookBody');
  const MONTHS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const DOW=['lun.','mar.','mer.','jeu.','ven.','sam.','dim.'];
  let st={room:null,month:null,date:null,slot:null,from:null,to:null,step:'pick',sending:false,msg:null};
  let busy=null, months=null, loading=false, loadErr=null;
  const pad=n=>String(n).padStart(2,'0');
  const isoD=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const today=()=>{ const d=new Date(); d.setHours(0,0,0,0); return d; };
  const hh=x=>{ const h=Math.floor(x), m=Math.round((x-h)*60); return h+'h'+(m?pad(m):''); };
  const fmtDay=s=>{ const d=new Date(s+'T12:00'); return `${['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'][d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  async function load(){ if(!BOOK_API||busy||loading) return; loading=true; loadErr=null; render();
    try{ const from=isoD(today()), t=new Date(); t.setMonth(t.getMonth()+6); const r=await fetch(`${BOOK_API}?action=dispo&from=${from}&to=${isoD(t)}`); const j=await r.json(); if(!j.ok) throw new Error(j.error||'erreur'); busy=new Map(); j.busy.forEach(b=>{ const k=`${b.room}|${b.date}|${b.slot}`; busy.set(k,b); }); months=j.months; }
    catch(e){ loadErr='Le planning n’a pas pu être chargé. Vous pouvez quand même envoyer une demande par mail.'; }
    loading=false; render(); }
  // état d'un créneau : 'free' | 'part' (plages prises) | 'full' | 'unknown'
  function slotState(room,date,slot){ if(!busy) return {s:'unknown',ranges:[]}; const b=busy.get(`${room}|${date}|${slot}`); if(!b) return {s:'free',ranges:[]}; if(b.whole) return {s:'full',ranges:[]}; const def=SLOTDEF.find(x=>x.id===slot); const free=freeSteps(def,b.ranges); return {s:free.length?'part':'full',ranges:b.ranges}; }
  function freeSteps(def,rs){ const out=[]; for(let t=def.from;t<def.to;t+=.5){ if(!rs.some(r=>t<r[1]&&t+.5>r[0])) out.push(t); } return out; }
  function dayState(room,date){ if(!busy) return 'unknown'; const ss=SLOTDEF.map(s=>slotState(room,date,s.id).s); if(ss.every(s=>s==='full')) return 'full'; if(ss.some(s=>s!=='free')) return 'part'; return 'free'; }
  function open(roomKey){ st={room:ROOMS.find(r=>r.key===roomKey)||null,month:null,date:null,slot:null,from:null,to:null,step:'pick',sending:false,msg:null}; const t=today(); st.month=new Date(t.getFullYear(),t.getMonth(),1); render(); if(!dlg.open) dlg.showModal(); FX.content?.(body); load(); }
  function close(){ dlg.close(); }
  function roomsHtml(){ return `<div class="bk-rooms" role="radiogroup" aria-label="Salle">${ROOMS.map(r=>`<button class="bk-room" role="radio" aria-checked="${st.room===r}" data-room="${r.key}"><span class="bk-rn">${esc(r.name)}</span><span class="bk-rc">${esc(r.cap)}${r.floor?' · '+esc(r.floor):''}${r.occ?' · occupant·e·s':''}</span></button>`).join('')}</div>`; }
  function calHtml(){ const m=st.month, y=m.getFullYear(), mo=m.getMonth(); const first=new Date(y,mo,1), lead=(first.getDay()+6)%7, n=new Date(y,mo+1,0).getDate(); const t=today(); const max=new Date(t); max.setMonth(max.getMonth()+6);
    const cells=[]; for(let i=0;i<lead;i++) cells.push('<span></span>');
    for(let d=1;d<=n;d++){ const dt=new Date(y,mo,d), s=isoD(dt), past=dt<t||dt>max; const ds=st.room&&!past?dayState(st.room.key,s):'';
      cells.push(`<button class="bk-d ${ds}" data-date="${s}" ${past?'disabled':''} aria-pressed="${st.date===s}" aria-label="${fmtDay(s)}${ds==='full'?' (complet)':''}">${d}</button>`); }
    const prevOk=new Date(y,mo,1)>new Date(t.getFullYear(),t.getMonth(),1), nextOk=new Date(y,mo+1,1)<=max;
    return `<div class="bk-cal"><div class="bk-calh"><button class="bk-nav" data-mon="-1" ${prevOk?'':'disabled'} aria-label="Mois précédent">‹</button><b>${MONTHS[mo]} ${y}</b><button class="bk-nav" data-mon="1" ${nextOk?'':'disabled'} aria-label="Mois suivant">›</button></div><div class="bk-dow">${DOW.map(x=>`<span>${x}</span>`).join('')}</div><div class="bk-grid">${cells.join('')}</div>${busy?`<p class="bk-leg"><i class="free"></i>libre <i class="part"></i>en partie pris <i class="full"></i>complet</p>`:''}</div>`; }
  function barHtml(def,ranges){ const span=def.to-def.from; return `<span class="bk-bar">${ranges.map(r=>{ const a=Math.max(r[0],def.from), b=Math.min(r[1],def.to); return b>a?`<i style="left:${(a-def.from)/span*100}%;width:${(b-a)/span*100}%"></i>`:''; }).join('')}</span>`; }
  function slotsHtml(){ if(!st.date) return `<p class="bk-hint">Choisissez un jour dans le calendrier.</p>`; const r=st.room;
    return `<h4 class="bk-dayt">${esc(fmtDay(st.date))}</h4><div class="bk-slots">${SLOTDEF.map(def=>{ const ss=slotState(r.key,st.date,def.id); const lab=ss.s==='full'?'Complet':ss.s==='part'?'En partie pris':ss.s==='free'?'Libre':''; return `<button class="bk-slot ${ss.s}" data-slot="${def.id}" ${ss.s==='full'?'disabled':''} aria-pressed="${st.slot===def.id}"><span class="bk-sl">${def.label}</span><span class="bk-sh">${hh(def.from)} – ${hh(def.to)}</span>${barHtml(def,ss.ranges)}${lab?`<span class="bk-ss">${lab}</span>`:''}</button>`; }).join('')}</div>${st.slot?hoursHtml():''}`; }
  function hoursHtml(){ const def=SLOTDEF.find(x=>x.id===st.slot); const ss=slotState(st.room.key,st.date,def.id); const freeS=freeSteps(def,ss.ranges); const opt=(v,sel,dis)=>`<option value="${v}" ${sel?'selected':''} ${dis?'disabled':''}>${hh(v)}</option>`;
    if(st.from==null||!freeS.includes(st.from)){ st.from=freeS[0]; st.to=null; }
    let maxTo=st.from; while(maxTo<def.to && freeS.includes(maxTo)) maxTo+=.5; if(st.to==null||st.to>maxTo||st.to<=st.from) st.to=maxTo;
    const froms=[]; for(let t=def.from;t<def.to;t+=.5) froms.push(opt(t,t===st.from,!freeS.includes(t)));
    const tos=[]; for(let t=st.from+.5;t<=maxTo;t+=.5) tos.push(opt(t,t===st.to,false));
    return `<div class="bk-hours"><label>De <select id="bkFrom">${froms.join('')}</select></label><label>à <select id="bkTo">${tos.join('')}</select></label><button class="btn-p" id="bkNext">Continuer <span aria-hidden="true">→</span></button></div>`; }
  function formHtml(){ const r=st.room; const names=RAW.map(o=>o.name).sort((a,b)=>a.localeCompare(b,'fr'));
    return `<button class="bk-back" id="bkBack">← Modifier le créneau</button>
      <div class="bk-recap"><b>${esc(r.name)}</b> · ${esc(fmtDay(st.date))} · ${hh(st.from)} – ${hh(st.to)}</div>
      <form class="bk-form" id="bkForm" novalidate>
        <label>Votre structure<input name="structure" list="bkOrgs" required autocomplete="organization" placeholder="ex. Studio CAD"></label><datalist id="bkOrgs">${names.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>
        <label>Votre nom<input name="who" required autocomplete="name"></label>
        <label>E-mail<input name="email" type="email" autocomplete="email" placeholder="pour recevoir la confirmation"></label>
        <label><span>Objet <span class="opt">(facultatif)</span></span><input name="object" placeholder="réunion, atelier, formation…"></label>
        <label class="bk-check"><input type="checkbox" name="external"> Accueille du public extérieur au So Watt !</label>
        ${BOOK_API?`<label>Code occupant·e<input name="code" required autocomplete="off" placeholder="communiqué par Intermède"></label>`:''}
        ${st.msg?`<p class="bk-err" role="alert">${esc(st.msg)}</p>`:''}
        <button class="btn-p" type="submit" ${st.sending?'disabled':''}>${BOOK_API?(st.sending?'Réservation…':'Réserver'):'Envoyer la demande à Zoé'}</button>
        ${BOOK_API?'':`<p class="bk-note">Le planning n’est pas encore relié à cette page : la demande s’ouvre dans votre messagerie, adressée à Zoé (Intermède), qui la reporte dans le tableur.</p>`}
      </form>`; }
  function doneHtml(){ return `<div class="bk-done"><div class="bk-ok" aria-hidden="true">✓</div><h3>C’est réservé</h3><p><b>${esc(st.room.name)}</b><br>${esc(fmtDay(st.date))} · ${hh(st.from)} – ${hh(st.to)}</p><p class="bk-note">La réservation est inscrite dans le planning d’Intermède. Pour l’annuler, prévenez Zoé (${BOOK_MAIL}).</p><button class="btn-g" id="bkAgain">Réserver un autre créneau</button></div>`; }
  function render(){
    const r=st.room;
    let main;
    if(st.step==='done') main=doneHtml();
    else if(st.step==='form') main=formHtml();
    else main=`${r?`${r.note?`<p class="bk-note">${esc(r.note)}</p>`:''}${r.occ?`<p class="bk-note">Réservée aux occupant·e·s.</p>`:''}<div class="bk-cols">${calHtml()}<div class="bk-right">${slotsHtml()}</div></div>`:`<p class="bk-hint">Choisissez une salle.</p>`}`;
    body.innerHTML=`<header class="bk-head"><h2 id="bookT">Réserver une salle</h2><p>Gratuit pour les occupant·e·s · usage professionnel uniquement · créneaux du planning d’Intermède</p>${BOOK_API&&loading?'<p class="bk-load">Chargement du planning…</p>':''}${loadErr?`<p class="bk-err">${esc(loadErr)}</p>`:''}</header>
      ${st.step==='pick'?roomsHtml():''}<div class="bk-main">${main}</div>`;
    bind(); const sel=body.querySelector('.bk-room[aria-checked="true"]'); if(sel){ const rr=sel.parentElement; rr.scrollLeft+=sel.getBoundingClientRect().left-rr.getBoundingClientRect().left-rr.clientWidth/2+sel.clientWidth/2; } }
  function bind(){
    body.querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>{ st.room=ROOMS.find(r=>r.key===b.dataset.room); st.slot=null; st.from=st.to=null; render(); });
    body.querySelectorAll('[data-mon]').forEach(b=>b.onclick=()=>{ st.month=new Date(st.month.getFullYear(),st.month.getMonth()+(+b.dataset.mon),1); render(); });
    body.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{ st.date=b.dataset.date; st.slot=null; st.from=st.to=null; render(); body.querySelector('.bk-right')?.scrollIntoView({block:'nearest',behavior:'smooth'}); });
    body.querySelectorAll('[data-slot]').forEach(b=>b.onclick=()=>{ st.slot=b.dataset.slot; st.from=st.to=null; render(); body.querySelector('.bk-hours')?.scrollIntoView({block:'nearest',behavior:'smooth'}); });
    const f=body.querySelector('#bkFrom'), t=body.querySelector('#bkTo');
    if(f) f.onchange=()=>{ st.from=+f.value; st.to=null; render(); };
    if(t) t.onchange=()=>{ st.to=+t.value; };
    const nx=body.querySelector('#bkNext'); if(nx) nx.onclick=()=>{ st.step='form'; st.msg=null; render(); body.querySelector('input[name=structure]')?.focus(); };
    const bk=body.querySelector('#bkBack'); if(bk) bk.onclick=()=>{ st.step='pick'; render(); };
    const ag=body.querySelector('#bkAgain'); if(ag) ag.onclick=()=>{ st.step='pick'; st.slot=null; st.from=st.to=null; render(); };
    const fm=body.querySelector('#bkForm'); if(fm) fm.onsubmit=async e=>{ e.preventDefault(); const d=Object.fromEntries(new FormData(fm)); d.external=!!d.external;
      if(!String(d.structure||'').trim()||!String(d.who||'').trim()){ st.msg='Indiquez votre structure et votre nom.'; render(); return; }
      const slotLab=SLOTDEF.find(x=>x.id===st.slot).label;
      if(!BOOK_API){ const subj=`Réservation ${st.room.name} – ${fmtDay(st.date)} ${hh(st.from)}-${hh(st.to)}`; const txt=`Bonjour Zoé,\n\nPourriez-vous réserver pour nous :\n- ${st.room.name}\n- ${fmtDay(st.date)} (${slotLab}), de ${hh(st.from)} à ${hh(st.to)}\n- Structure : ${d.structure}\n- Contact : ${d.who}${d.email?' · '+d.email:''}${d.object?'\n- Objet : '+d.object:''}\n- Public extérieur : ${d.external?'oui':'non'}\n\nMerci !`; location.href=`mailto:${BOOK_MAIL}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(txt)}`; return; }
      st.sending=true; st.msg=null; render();
      try{ const res=await fetch(BOOK_API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({room:st.room.key,date:st.date,slot:st.slot,from:st.from,to:st.to,...d})}); const j=await res.json(); st.sending=false;
        if(j.ok){ st.step='done'; const k=`${st.room.key}|${st.date}|${st.slot}`; const prev=busy?.get(k); busy?.set(k,{room:st.room.key,date:st.date,slot:st.slot,whole:false,ranges:[...(prev?.ranges||[]),[st.from,st.to]]}); }
        else st.msg=j.error||'La réservation a échoué.'; }
      catch(err){ st.sending=false; st.msg='Connexion au planning impossible. Réessayez, ou écrivez à '+BOOK_MAIL+'.'; }
      render(); };
  }
  document.getElementById('bookClose').onclick=close;
  dlg.addEventListener('click',e=>{ if(e.target===dlg) close(); });
  return {open,close,roomBySpace};
})();
