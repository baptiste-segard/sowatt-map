import * as THREE from 'three';
// ---------- données ----------
const RAW = JSON.parse(document.getElementById('data').textContent);
const CONVD = JSON.parse(document.getElementById('conv').textContent); const CONV = CONVD.convergences, FAMS = CONVD.families;
const CATS = ['ART','ATELIER','ARTISANAT','ASSO','COM','SERV','BIENETRE','BAT','RESTO'];
const CATLABEL = {}; RAW.forEach(o=>CATLABEL[o.cat]=o.catLabel);
const FLOOR_ORDER = ['R3','R2','R1','RDC','SS','B','COUR'];
const FLOORLABEL = {}; RAW.forEach(o=>FLOORLABEL[o.floor]=o.floorLabel);
const catColor = c => `var(--c-${c})`;
const CATHEX = {ART:'#E2572B',ATELIER:'#F2B01E',ARTISANAT:'#C2559B',ASSO:'#16A34A',COM:'#2F80ED',SERV:'#0E8C8C',BIENETRE:'#7C5CBF',BAT:'#6B7280',RESTO:'#A8622D'};
const DIMS = {
  cat:{label:'Catégorie',key:'catLabel',multi:false},
  theme:{label:'Thèmes',key:'themes',multi:true},
  floor:{label:'Étage',key:'floorLabel',multi:false},
  conv:{label:'Convergences',key:'convTitles',multi:true},
  public:{label:'Publics',key:'publics',multi:true},
};
const orgById=new Map(RAW.map(o=>[o.id,o]));
const convById=new Map(CONV.map(c=>[c.id,c]));
// convergences par structure (+ titres pour le filtre / le regroupement)
const convByOrg=new Map();
CONV.forEach(c=>c.members.forEach(m=>{ if(!convByOrg.has(m.id)) convByOrg.set(m.id,[]); convByOrg.get(m.id).push({c,role:m.role}); }));
RAW.forEach(o=>{ o.convs=convByOrg.get(o.id)||[]; o.convTitles=o.convs.map(x=>x.c.title); o.catLabel=CATLABEL[o.cat]; });
const ACU=new Set(RAW.filter(o=>o.acu&&o.acu.top).map(o=>o.id));
const logoUrl = o => o.logo ? `logos/${o.id}.webp` : null;
const logoImg = (o,cls='lg') => o.logo ? `<img class="${cls}" src="${logoUrl(o)}" alt="" loading="lazy">` : `<span class="${cls} lg-dot" style="background:${catColor(o.cat)}"></span>`;
const vals = (o,key) => Array.isArray(o[key]) ? (o[key].length?o[key]:['—']) : (o[key] ? [o[key]] : ['—']);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

let orgs = RAW.slice();
let groupBy = 'cat';
let active = {cat:new Set(), theme:new Set(), floor:new Set(), conv:new Set(), public:new Set()};
let viewMode = 'clusters'; // 'clusters' | 'lieu' | 'conv'
let query = '';
let selected = null, selectedConv=null, focusGroup = null;
let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrowMQ = matchMedia('(max-width:980px)');

// ---------- profil (repris d'eco-map : rôle → structure, thèmes, chantiers) ----------
let profile=null; // {me:id|null, themes:[], wants:[convIds]}
try{ const p=JSON.parse(localStorage.getItem('sowatt.profile')||'null'); if(p && (p.cat||p.me||p.themes?.length||p.wants?.length)) profile=p; }catch(e){}
function saveProfile(){ try{ profile? localStorage.setItem('sowatt.profile',JSON.stringify(profile)) : localStorage.removeItem('sowatt.profile'); }catch(e){} }
const meOrg=()=>profile?.me?orgById.get(profile.me):null;
const profileWho=()=>{ const me=meOrg(); if(me) return me.name; if(profile?.cat) return CATLABEL[profile.cat]; return 'Visiteur·se'; };
function profileMatch(o){ if(!profile) return true; if(o.id===profile.me) return true; const t=profile.themes?.length && o.themes.some(x=>profile.themes.includes(x)); const w=profile.wants?.length && o.convs.some(c=>profile.wants.includes(c.c.id)); const c=profile.cat && o.cat===profile.cat; if(!profile.cat && !profile.themes?.length && !profile.wants?.length) return true; return !!(c||t||w); }
function profileScore(o){ if(!profile) return 0; const me=meOrg(); let s=o.themes.filter(x=>profile.themes?.includes(x)).length*2 + o.convs.filter(c=>profile.wants?.includes(c.c.id)).length*3 + (profile.cat&&o.cat===profile.cat?2:0); if(me&&o!==me){ s+=o.convs.filter(c=>me.convs.some(m=>m.c===c.c)).length*1.5 + o.themes.filter(x=>me.themes.includes(x)).length + (o.floor===me.floor?1:0) + (o.room&&o.room===me.room?2:0) + (DECL.some(r=>(r.a===me.id&&r.b===o.id)||(r.b===me.id&&r.a===o.id))?3:0); } return s; }
function convsForProfile(limit=6){ if(!profile) return []; const me=meOrg(); return CONV.map(c=>{ let s=0; if(profile.wants?.includes(c.id)) s+=4; s+=c.members.map(m=>orgById.get(m.id)).filter(Boolean).filter(o=>o.themes.some(x=>profile.themes?.includes(x))).length*0.15; if(me&&c.members.some(m=>m.id===me.id)) s+=2; if(profile.cat) s+=c.members.map(m=>orgById.get(m.id)).filter(o=>o&&o.cat===profile.cat).length*0.4; return {c,s}; }).filter(x=>x.s>=1).sort((a,b)=>b.s-a.s).slice(0,limit); }

// ---------- filtres ----------
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
function textMatch(o){ if(!query) return true; const q=norm(query); return norm(o.name).includes(q)||norm(o.people).includes(q)||norm(o.desc).includes(q)||norm(o.offre).includes(q)||norm(o.room).includes(q); }
function matches(o){
  if(!textMatch(o)) return false;
  for(const d in active){ const set=active[d]; if(!set.size) continue; const v=vals(o,DIMS[d].key); if(!v.some(x=>set.has(x))) return false; }
  return true;
}
function anyFilter(){ return query || Object.values(active).some(s=>s.size); }
function visible(o){ return (!profile || profileMatch(o)) && (!anyFilter() || matches(o)); }
function anyDim(){ return anyFilter() || !!profile; }
let convHits=[];
function matchConv(){ convHits = query ? CONV.filter(c=>norm(c.title).includes(norm(query))||norm(c.summary).includes(norm(query))||norm(c.potential).includes(norm(query))) : []; }

// ---------- relations ----------
const DECL=CONVD.relations||[];
function declared(o){ return DECL.filter(r=>r.a===o.id||r.b===o.id).map(r=>({x:orgById.get(r.a===o.id?r.b:r.a),why:r.why})).filter(r=>r.x); }
function convLinks(o){ // reliés par des convergences communes
  const m=new Map();
  o.convs.forEach(({c})=>c.members.forEach(mm=>{ if(mm.id===o.id) return; const x=orgById.get(mm.id); if(!x) return; if(!m.has(x)) m.set(x,{x,via:[],score:0}); const e=m.get(x); e.via.push(c); e.score+=1+(x.cat!==o.cat?0.5:0); }));
  return [...m.values()].sort((a,b)=>b.score-a.score);
}
function related(o, limit=10){ // affinités : thèmes et publics partagés
  const T=new Set(o.themes),P=new Set(o.publics);
  return orgs.filter(x=>x!==o).map(x=>{ const t=x.themes.filter(v=>T.has(v)), p=x.publics.filter(v=>P.has(v)); const score=t.length*2+p.length*0.5+(x.cat===o.cat?0.5:0); return {x,score,shared:t}; })
    .filter(r=>r.score>=2.5&&r.shared.length).sort((a,b)=>b.score-a.score).slice(0,limit);
}
function neighbours(o){ const sameRoom=orgs.filter(x=>x!==o&&x.floor===o.floor&&x.room&&x.room===o.room); const sameFloor=orgs.filter(x=>x!==o&&x.floor===o.floor&&!sameRoom.includes(x)); return {sameRoom,sameFloor}; }
function convOrgs(c){ return new Set(c.members.map(m=>orgById.get(m.id)).filter(Boolean)); }

// ---------- SVG : grappes et convergences ----------
const svg = d3.select('#map');
const gRoot = svg.append('g');
const gGroups = gRoot.append('g'), gLinks = gRoot.append('g'), gNodes = gRoot.append('g'), gLabels = gRoot.append('g');
let leaves=[], groups=[];
const canvas = document.getElementById('canvas');
const zoom = d3.zoom().scaleExtent([0.4,40]).on('zoom',e=>{ gRoot.attr('transform',e.transform); updateLabelVisibility(e.transform.k); });
svg.call(zoom).on('dblclick.zoom',null);
let W=800,H=600, root=null, leafByOrg=new Map();

function layout(){
  const r=canvas.getBoundingClientRect(); W=Math.max(320,r.width); H=Math.max(320,r.height);
  if(viewMode==='lieu'){ LIEU.resize(); LIEU.render(); return; }
  if(viewMode==='conv'){
    const fams=Object.keys(FAMS).map(f=>({name:FAMS[f].label,fam:f,children:CONV.filter(c=>c.family===f).map(c=>({name:c.title,conv:c,children:c.members.map(m=>({org:orgById.get(m.id),role:m.role,value:1})).filter(x=>x.org)}))}));
    root=d3.hierarchy({children:fams}).sum(d=>d.value||0).sort((a,b)=>b.value-a.value);
    d3.pack().size([W,H-40]).padding(d=>d.depth===0?Math.max(16,Math.min(W,H)*0.035):d.depth===1?10:1.8)(root);
    root.each(d=>{ d.y+=32; });
    leaves=root.leaves().filter(l=>l.data.org); groups=root.descendants().filter(d=>d.depth===1||d.depth===2);
  } else {
    const key=DIMS[groupBy].key;
    let children;
    if(DIMS[groupBy].multi){ // une structure apparaît dans chacun de ses groupes
      const m=new Map(); orgs.forEach(o=>vals(o,key).forEach(v=>{ if(!m.has(v)) m.set(v,[]); m.get(v).push(o); }));
      children=[...m].map(([name,items])=>({name,children:items.map(o=>({org:o,value:1}))}));
    } else {
      const grouped=d3.group(orgs, o=>vals(o,key)[0]);
      children=[...grouped].map(([name,items])=>({name,children:items.map(o=>({org:o,value:1}))}));
    }
    if(groupBy==='floor') children.sort((a,b)=>FLOOR_ORDER.indexOf(Object.keys(FLOORLABEL).find(k=>FLOORLABEL[k]===a.name))-FLOOR_ORDER.indexOf(Object.keys(FLOORLABEL).find(k=>FLOORLABEL[k]===b.name)));
    else children.sort((a,b)=>b.children.length-a.children.length);
    root=d3.hierarchy({children}).sum(d=>d.value).sort(groupBy==='floor'?null:(a,b)=>b.value-a.value);
    d3.pack().size([W,H-40]).padding(d=>d.depth===0?Math.max(18,Math.min(W,H)*0.04):2.4)(root);
    root.each(d=>{ d.y+=32; });
    leaves=root.leaves(); groups=root.children||[];
  }
  leafByOrg=new Map(); leaves.forEach(l=>{ if(!leafByOrg.has(l.data.org)) leafByOrg.set(l.data.org,l); });
  draw();
}

function draw(){
  const gc=gGroups.selectAll('circle').data(groups,d=>d.data.name);
  gc.join('circle').attr('class',d=>'group-circle'+(d.data.conv?' conv':'')+(d.depth===1&&viewMode==='conv'?' fam':'')).attr('cx',d=>d.x).attr('cy',d=>d.y).attr('r',d=>d.r).style('opacity',scattered?0:1)
    .on('click',(e,d)=>{e.stopPropagation(); if(d.data.conv){ selectConv(d.data.conv); focusOn(d); } else { if(selectedConv) selectConv(null); focusOn(d);} });
  const gl=gLabels.selectAll('text.group-label').data(groups,d=>d.data.name);
  gl.join('text').attr('class',d=>'group-label'+(d.data.conv?' conv':'')).attr('x',d=>d.x).attr('y',d=>d.data.conv?d.y-d.r-4:d.y-d.r-8).style('opacity',scattered?0:1)
    .html(d=>d.data.conv?`${FAMS[d.data.conv.family].icon} ${esc(d.data.conv.title.length>40?d.data.conv.title.slice(0,38)+'…':d.data.conv.title)}`:`${esc(d.data.name)} <tspan class="n">${d.children.length}</tspan>`);
  gNodes.selectAll('circle.node').interrupt(); gGroups.selectAll('circle').interrupt(); gLabels.selectAll('text').interrupt();
  const nkey=d=>d.data.org.id+(d.parent&&d.parent.data.conv?'@'+d.parent.data.conv.id:'')+(d.parent&&!d.parent.data.conv&&viewMode==='clusters'&&DIMS[groupBy].multi?'@'+d.parent.data.name:'');
  const nd=gNodes.selectAll('circle.node').data(leaves,nkey);
  nd.join('circle').attr('class','node')
    .attr('cx',d=>scattered?scatterOf(d.data.org)[0]:d.x).attr('cy',d=>scattered?scatterOf(d.data.org)[1]:d.y).attr('r',d=>scattered?3:Math.max(1.2,d.r-0.6)).attr('fill',d=>catColor(d.data.org.cat))
    .on('mouseenter',(e,d)=>showTip(e,d.data.org)).on('mousemove',moveTip).on('mouseleave',hideTip)
    .on('click',(e,d)=>{e.stopPropagation(); select(d.data.org);});
  gNodes.selectAll('circle.acu-ring').data(leaves.filter(d=>ACU.has(d.data.org.id)),nkey).join('circle').attr('class','acu-ring').attr('cx',d=>d.x).attr('cy',d=>d.y).attr('r',d=>d.r+1.5);
  const withLogo=leaves.filter(d=>d.data.org.logo);
  gNodes.selectAll('circle.nback').data(withLogo,nkey).join('circle').attr('class','nback').attr('cx',d=>d.x).attr('cy',d=>d.y).style('display','none');
  gNodes.selectAll('image.nlogo').data(withLogo,nkey).join('image').attr('class','nlogo').attr('href',d=>logoUrl(d.data.org)).attr('preserveAspectRatio','xMidYMid meet').style('display','none')
    .on('mouseenter',(e,d)=>showTip(e,d.data.org)).on('mousemove',moveTip).on('mouseleave',hideTip).on('click',(e,d)=>{e.stopPropagation(); select(d.data.org);});
  const nl=gLabels.selectAll('text.node-label').data(leaves,nkey);
  nl.join('text').attr('class','node-label').attr('x',d=>d.x+d.r+2).attr('y',d=>d.y+3).text(d=>d.data.org.name).style('display','none');
  applyState();
  updateLabelVisibility(d3.zoomTransform(svg.node()).k);
  svg.on('click',()=>{ if(selected) select(null); else if(selectedConv) selectConv(null); });
}

function applyState(){ updateBurgerCount?.();
  const f=anyDim();
  gNodes.selectAll('circle.node').classed('off',d=>f && !visible(d.data.org)).classed('sel',d=>d.data.org===selected);
  gGroups.selectAll('circle').classed('focus',d=>d===focusGroup);
  drawLinks();
  const shown=orgs.filter(visible).length;
  document.getElementById('countShown').textContent=shown; document.getElementById('countAll').textContent=orgs.length;
  document.getElementById('status').classList.toggle('filtered',f);
  const zero=f && shown===0; if(zero!==lastZero){ lastZero=zero; renderHint(); }
  renderFilters();
  LIEU.setState();
}
let lastZero=false;
let relSet=new Set(), relKind=new Map();
function computeRelations(){
  relSet=new Set(); relKind=new Map();
  if(selectedConv){ relSet=convOrgs(selectedConv); return; }
  if(!selected) return;
  const decl=declared(selected), know=convLinks(selected).slice(0,12);
  const knowSet=new Set(know.map(k=>k.x));
  const aff=related(selected,8).filter(r=>!knowSet.has(r.x)).slice(0,6);
  decl.forEach(d=>relKind.set(d.x,{kind:'decl',w:2}));
  know.forEach(k=>{ if(!relKind.has(k.x)) relKind.set(k.x,{kind:'know',w:1+k.score*0.5}); });
  aff.forEach(a=>{ if(!relKind.has(a.x)) relKind.set(a.x,{kind:'aff',w:1}); });
  relSet=new Set(relKind.keys());
}
function drawLinks(){
  gLinks.selectAll('*').remove();
  computeRelations();
  if(viewMode==='lieu'){ return; }
  if(selectedConv){ const pts=[...relSet].map(o=>leafByOrg.get(o)).filter(Boolean); if(pts.length>1){ const cx=d3.mean(pts,p=>p.x), cy=d3.mean(pts,p=>p.y); gLinks.selectAll('path').data(pts).join('path').attr('class','link').attr('stroke-width',1.2).attr('d',p=>`M${cx},${cy} L${p.x},${p.y}`); gLinks.append('circle').attr('class','halo pulse').attr('cx',cx).attr('cy',cy).attr('r',6); }
    gNodes.selectAll('circle.node').classed('off',d=>!relSet.has(d.data.org)||(anyFilter()&&!matches(d.data.org))); updateLabelVisibility(d3.zoomTransform(svg.node()).k); return; }
  if(!selected){ updateLabelVisibility(d3.zoomTransform(svg.node()).k); return; }
  const a=leafByOrg.get(selected); if(!a) return;
  const curve=(b)=>{ const dx=b.x-a.x, dy=b.y-a.y; const k=0.22; const c1x=a.x+dx*0.25-dy*k, c1y=a.y+dy*0.25+dx*k, c2x=a.x+dx*0.75-dy*k*0.4, c2y=a.y+dy*0.75+dx*k*0.4; return `M${a.x},${a.y} C${c1x},${c1y} ${c2x},${c2y} ${b.x},${b.y}`; };
  const items=[...relKind].map(([x,k])=>({x,...k}));
  gLinks.selectAll('path').data(items).join('path').attr('class',d=>'link '+d.kind).attr('stroke-width',d=>d.w).attr('d',d=>{const b=leafByOrg.get(d.x); return b?curve(b):null;});
  gLinks.append('circle').attr('class','halo pulse').attr('cx',a.x).attr('cy',a.y).attr('r',6);
  gNodes.selectAll('circle.node').classed('off',d=>{ if(d.data.org===selected||relSet.has(d.data.org)) return false; return anyDim()? !visible(d.data.org) : true; });
  updateLabelVisibility(d3.zoomTransform(svg.node()).k);
}

let currentK=1;
function updateLabelVisibility(k){
  currentK=k;
  const t=d3.zoomTransform(svg.node());
  const rs=1/Math.sqrt(k);
  const nodeR=d=>(scattered?3:Math.max(1.2,d.r-0.6))*Math.max(rs,0.35);
  gNodes.selectAll('circle.node').attr('r',nodeR);
  gNodes.selectAll('circle.acu-ring').attr('r',d=>nodeR(d)+2.5/k);
  gLinks.style('--ik',1/k);
  const offSet=new Set(); gNodes.selectAll('circle.node.off').each(d=>offSet.add(d.data.org));
  const showLogo=d=>nodeR(d)*k>=12 && !offSet.has(d.data.org);
  gNodes.selectAll('circle.nback').style('display',d=>showLogo(d)?null:'none').attr('cx',d=>d.x).attr('cy',d=>d.y).attr('r',d=>nodeR(d)*0.82);
  gNodes.selectAll('image.nlogo').style('display',d=>showLogo(d)?null:'none').each(function(d){ const r=nodeR(d)*0.72; d3.select(this).attr('x',d.x-r).attr('y',d.y-r).attr('width',2*r).attr('height',2*r); });
  gLabels.selectAll('text.group-label').style('font-size',d=>(d.data.conv?Math.max(10/k,10/Math.sqrt(k)*0.6):Math.max(13/k,13/Math.sqrt(k)*0.6))+'px').style('stroke-width',(4/k)+'px')
    .style('display',d=>d.data.conv ? ((focusGroup===d||focusGroup===d.parent||k>2.2||d.r*k>34)?null:'none') : (k>5?'none':null));
  const dim=anyDim();
  const inFocus=d=>focusGroup && d.parent===focusGroup;
  const eligible=d=>{ const o=d.data.org; if(o===selected||relSet.has(o)) return true; if(selected||selectedConv) return false; if(viewMode==='conv' && !(focusGroup && (d.parent===focusGroup||d.parent?.parent===focusGroup)) && k<2.5) return false; if(dim && !visible(o)) return false; const big=d.r*k>14; return big || (inFocus(d) && d.r*k>5); };
  const prio=d=>{ const o=d.data.org; return o===selected?0 : relSet.has(o)?1 : (profile&&o.id===profile.me)?1 : (profile&&profileMatch(o))?2 : ACU.has(o.id)?2 : 3; };
  const placed=[]; const cand=leaves.filter(eligible).sort((a,b)=>prio(a)-prio(b)||a.data.org.name.length-b.data.org.name.length); const show=new Set();
  for(const d of cand){
    const sx=t.applyX(d.x)+nodeR(d)*k+3, sy=t.applyY(d.y);
    if(sx<-200||sx>W||sy<0||sy>H) continue;
    const w=Math.min(d.data.org.name.length*6.2+6,260), box=[sx,sy-7,sx+w,sy+7];
    if(placed.some(b=>!(box[2]<b[0]||box[0]>b[2]||box[3]<b[1]||box[1]>b[3]))) continue;
    placed.push(box); show.add(d.data.org); if(placed.length>90) break;
  }
  gLabels.selectAll('text.node-label').style('display',d=>show.has(d.data.org)?null:'none')
    .attr('x',d=>d.x+nodeR(d)+3/k).attr('y',d=>d.y+3.5/k).style('font-size',(11/k)+'px').style('stroke-width',(3/k)+'px');
}

function zoomTo(x,y,r,dur){
  const k=Math.min(W,H)/(r*2.3);
  const tr=d3.zoomIdentity.translate(W/2,H/2).scale(k).translate(-x,-y);
  (dur&&!reduced? svg.transition().duration(dur): svg).call(zoom.transform,tr);
}
function focusOn(g){ focusGroup=g; if(viewMode!=='lieu') zoomTo(g.x,g.y,g.r,650); renderHint(); applyState(); }
function setView(mode){
  viewMode=mode;
  for(const [id,m] of [['viewClusters','clusters'],['viewLieu','lieu'],['viewConv','conv']]) document.getElementById(id).setAttribute('aria-pressed',mode===m);
  document.body.classList.toggle('lieu',mode==='lieu');
  focusGroup=null; svg.call(zoom.transform,d3.zoomIdentity);
  if(mode==='lieu'){ LIEU.show(); } else { LIEU.hide(); }
  layout(); renderHint(); renderLegend(); applyState();
}
function resetView(){ focusGroup=null; if(selectedConv){ selectedConv=null; renderDetail(); } if(viewMode==='lieu') LIEU.home(); else (reduced?svg:svg.transition().duration(500)).call(zoom.transform,d3.zoomIdentity); renderHint(); applyState(); }
function selectConv(c){ selectedConv=c; selected=null; renderDetail(); if(c&&viewMode==='lieu') LIEU.flyToConv(c); applyState(); }
function select(o){
  selected=o; if(o) selectedConv=null; renderDetail();
  if(o){ if(viewMode==='lieu') LIEU.flyTo(o); else { const l=leafByOrg.get(o); if(l && l.parent && l.parent!==focusGroup){ focusGroup=l.parent; zoomTo(l.parent.x,l.parent.y,l.parent.r,650); renderHint(); } } }
  applyState(); if(!o&&viewMode!=='lieu') updateLabelVisibility(currentK);
}

// ---------- UI ----------
const tip=document.getElementById('tip');
function showTip(e,o){ tip.innerHTML=`<div class="row">${logoImg(o,'lg tip')}<span>${esc(o.name)}<div class="sub">${esc(o.catLabel)} · ${esc(o.floorLabel)}${o.room?' · '+esc(o.room):''}</div></span></div>`; tip.style.opacity=1; moveTip(e); }
function moveTip(e){ const r=canvas.getBoundingClientRect(); tip.style.left=(e.clientX-r.left)+'px'; tip.style.top=(e.clientY-r.top)+'px'; }
function hideTip(){ tip.style.opacity=0; }

function renderGroupSeg(){
  const seg=document.getElementById('groupSeg'); if(!seg) return; seg.innerHTML='';
  const sel=document.createElement('select'); sel.id='groupSel'; sel.setAttribute('aria-label','Regrouper les structures par');
  for(const d in DIMS){ const o=document.createElement('option'); o.value=d; o.textContent=DIMS[d].label.toLowerCase(); o.selected=d===groupBy; sel.appendChild(o); }
  sel.onchange=()=>{ groupBy=sel.value; focusGroup=null; svg.call(zoom.transform,d3.zoomIdentity); layout(); renderHint(); renderLegend(); };
  seg.appendChild(sel);
}
function renderHint(){
  const h=document.getElementById('hint'); h.innerHTML='';
  const c=document.createElement('div'); c.className='crumb';
  const shown=orgs.filter(visible).length;
  if(anyFilter() && shown===0){ c.className='crumb zero'; c.innerHTML=`<span>Aucune structure ne correspond${convHits.length?` · ${convHits.length} convergence${convHits.length>1?'s':''} dans le panneau`:''}</span><button id="hintClear">Effacer</button>`; h.appendChild(c); c.querySelector('#hintClear').onclick=()=>document.getElementById('clearAll').click(); return; }
  if(viewMode==='lieu'){ c.innerHTML=`<span class="sub">Le bâtiment réel (OpenStreetMap) posé sur l'orthophoto IGN, nord en haut. Glisser = tourner · molette = zoomer · clic droit = déplacer.</span><span class="floorbar">${['all','R3','R2','R1','RDC','SS'].map(f=>`<button data-floor="${f}" aria-pressed="${(LIEU.floor||'all')===f}">${f==='all'?'Tout':f==='SS'?'Sous-sol':f==='RDC'?'RDC':f.replace('R','')+(f==='R1'?'er':'e')}</button>`).join(' · ')}</span><span class="floorbar" style="margin-left:6px;border-left:1px solid var(--line);padding-left:8px"><button data-gap="eclate" aria-pressed="${LIEU.gap==='eclate'}">Éclaté</button> · <button data-gap="compact" aria-pressed="${LIEU.gap==='compact'}">Compact</button></span>`; h.appendChild(c); c.querySelectorAll('[data-floor]').forEach(b=>b.onclick=()=>{ LIEU.setFloor(b.dataset.floor==='all'?null:b.dataset.floor); renderHint(); }); c.querySelectorAll('[data-gap]').forEach(b=>b.onclick=()=>{ LIEU.setGap(b.dataset.gap); renderHint(); }); return; }
  if(focusGroup){ c.innerHTML=`<button id="crumbBack">← ${viewMode==='conv'?'Toutes les convergences':'Tout'}</button><span>${esc(focusGroup.data.name)} · ${focusGroup.children.length} structures</span>`; h.appendChild(c); c.querySelector('#crumbBack').onclick=resetView; }
  else if(viewMode==='conv'){ c.innerHTML=`<span>${CONV.length} convergences : là où des structures de catégories différentes travaillent la même matière ou les mêmes publics. Cliquer une convergence pour lire ce qu'elle pourrait devenir.</span>`; h.appendChild(c); }
  else { c.classList.add('gb'); c.innerHTML=`<span>Regroupées par</span><span id="groupSeg" role="group"></span><span class="sub" style="color:var(--muted)">· cliquer une grappe pour zoomer, un point pour ouvrir une fiche</span>`; h.appendChild(c); renderGroupSeg(); }
}
let legendOpen=false; try{ legendOpen=localStorage.getItem('sowatt.legend')==='1'; }catch(e){}
function renderLegend(){
  const l=document.getElementById('legend');
  let pill=document.getElementById('legendPill');
  if(!pill){ pill=document.createElement('button'); pill.id='legendPill'; pill.className='legend-pill'; pill.setAttribute('aria-controls','legend'); l.parentNode.insertBefore(pill,l); pill.onclick=()=>{ legendOpen=true; try{localStorage.setItem('sowatt.legend','1');}catch(e){} renderLegend(); }; }
  pill.innerHTML=`<span class="dots">${CATS.map(a=>`<i style="background:${catColor(a)}"></i>`).join('')}</span>Légende`;
  pill.setAttribute('aria-expanded',String(legendOpen)); pill.hidden=legendOpen; l.hidden=!legendOpen;
  const linkNote = `<p><span style="color:var(--fg)">━</span> relation déclarée · <span style="color:var(--accent)">━</span> convergence commune · <span style="color:var(--dim)">┄</span> affinité thématique · <span style="color:var(--accent)">◌</span> point d'acupuncture</p>`;
  const note = viewMode==='conv' ? `<p>Chaque cercle est une convergence ; les points à l'intérieur sont ses membres (une structure peut apparaître plusieurs fois).</p>` : viewMode==='lieu' ? `<p>Plans : MAJ du 20 oct. 2026 ; sous-sol, bâtiment B et cour placés hors plan. Orthophoto © IGN (Géoplateforme) · emprise © contributeurs OpenStreetMap.</p>` : DIMS[groupBy].multi ? `<p>Une structure apparaît dans chacun de ses groupes.</p>` : '';
  l.innerHTML=`<button class="lclose" id="legendClose" aria-label="Masquer la légende">×</button><h4>Couleur = catégorie</h4><ul>${CATS.map(a=>`<li><span class="sw" style="background:${catColor(a)}"></span>${esc(CATLABEL[a])}</li>`).join('')}</ul>${linkNote}${note}`;
  l.querySelector('#legendClose').onclick=()=>{ legendOpen=false; try{localStorage.setItem('sowatt.legend','0');}catch(e){} renderLegend(); };
}
const FILTER_LIMIT=8;
const fstate={open:{cat:true,theme:true}, more:{}};
const CHEV='<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
const orderCache={};
function chipOrder(d){
  if(!orderCache[d]){ const key=DIMS[d].key; const counts=d3.rollup(orgs.flatMap(o=>vals(o,key)),v=>v.length,x=>x); let arr=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([v])=>v); if(d==='floor') arr.sort((a,b)=>FLOOR_ORDER.indexOf(Object.keys(FLOORLABEL).find(k=>FLOORLABEL[k]===a))-FLOOR_ORDER.indexOf(Object.keys(FLOORLABEL).find(k=>FLOORLABEL[k]===b))); orderCache[d]=arr; }
  return orderCache[d];
}
function renderFilters(){
  const wrap=document.getElementById('filterGroups'), aside=document.getElementById('filters');
  const scrollTop=aside.scrollTop; const html=[];
  for(const d in DIMS){
    const key=DIMS[d].key, act=active[d];
    const others=orgs.filter(o=>{ if(profile && !profileMatch(o)) return false; if(!textMatch(o)) return false; for(const e in active){ if(e===d||!active[e].size) continue; if(!vals(o,DIMS[e].key).some(x=>active[e].has(x))) return false; } return true; });
    const counts=d3.rollup(others.flatMap(o=>vals(o,key)),v=>v.length,x=>x);
    const items=chipOrder(d).map(v=>[v,counts.get(v)||0]).filter(([v,n])=>(n>0||act.has(v))&&v!=='—');
    const expanded=!!fstate.more[d];
    const list=expanded ? items : items.filter(([v],i)=>i<FILTER_LIMIT||act.has(v));
    const hiddenN=items.length-list.length; const open=act.size>0||!!fstate.open[d];
    const chip=([v,n])=>`<button class="chip" data-dim="${d}" data-val="${esc(v)}" aria-pressed="${act.has(v)}">${d==='cat'?`<span class="sw" style="background:${catColor(CATS.find(c=>CATLABEL[c]===v))}"></span>`:''}${esc(v)} <span class="n">${n}</span></button>`;
    const more=hiddenN>0 ? `<button class="chip more" data-more="${d}" aria-expanded="false">+${hiddenN}</button>` : (expanded&&items.length>FILTER_LIMIT ? `<button class="chip more" data-more="${d}" aria-expanded="true">Réduire</button>` : '');
    html.push(`<details class="fgroup" data-dim="${d}"${open?' open':''}><summary><span class="lbl">${esc(DIMS[d].label)}</span>${act.size?`<span class="cnt">${act.size}</span><button class="gclear" data-clear="${d}">effacer</button>`:''}${CHEV}</summary><div class="chips">${list.map(chip).join('')}${more}</div></details>`);
  }
  wrap.innerHTML=html.join('');
  wrap.querySelectorAll('.chip[data-dim]').forEach(b=>b.onclick=()=>{ const d=b.dataset.dim,v=b.dataset.val; const on=!active[d].has(v); on?active[d].add(v):active[d].delete(v); if(d==='floor'&&viewMode==='lieu'){ LIEU.setFloor(on?Object.keys(FLOORLABEL).find(k=>FLOORLABEL[k]===v):null); renderHint(); } applyState(); });
  wrap.querySelectorAll('[data-more]').forEach(b=>b.onclick=()=>{ const d=b.dataset.more; fstate.more[d]=!fstate.more[d]; renderFilters(); });
  wrap.querySelectorAll('[data-clear]').forEach(b=>b.onclick=e=>{ e.preventDefault(); e.stopPropagation(); active[b.dataset.clear].clear(); applyState(); });
  wrap.querySelectorAll('details.fgroup').forEach(dt=>dt.addEventListener('toggle',()=>{ fstate.open[dt.dataset.dim]=dt.open; }));
  aside.scrollTop=scrollTop;
}
const TODAY=new Date().toISOString().slice(0,10);
const upcoming=o=>(o.agenda||[]).filter(a=>a.end>=TODAY);
function agendaLi(a,o){ return `<li><span class="adate">${esc(a.label)}</span><span class="aq">${esc(a.quoi)}${a.lieu?` <span class="al">· ${esc(a.lieu)}</span>`:''}${o?` <button class="aorg" data-id="${o.id}">${esc(o.name)}</button>`:''}</span></li>`; }
function agendaAll(limit=10){ const all=[]; RAW.forEach(o=>upcoming(o).forEach(a=>all.push({a,o}))); all.sort((x,y)=>(x.a.end<y.a.end?-1:1)); return all.slice(0,limit); }
function convCard(c,compact){
  const ms=c.members.map(m=>({o:orgById.get(m.id),role:m.role})).filter(x=>x.o);
  return `<li class="rescard" data-conv="${c.id}"><div class="rt"><span class="ri">${FAMS[c.family].icon}</span><span>${esc(FAMS[c.family].label)} · ${ms.length} structures</span></div><div class="rtitle">${esc(c.title)}</div>${compact?'':`<p class="rsum">${esc(c.summary)}</p><p class="rpot"><b>Ce que ça pourrait devenir ·</b> ${esc(c.potential)}</p>${c.first_step?`<p class="rstep"><b>Premier pas ·</b> ${esc(c.first_step)}</p>`:''}${c.evidence?`<p class="rev">Repéré sur : ${esc(c.evidence)}</p>`:''}`}<div class="rorgs">${ms.map(x=>`<button class="chip" data-id="${x.o.id}" title="${esc(x.role)}">${logoImg(x.o,'lg tip')}${esc(x.o.name)}${x.role?` <span class="n">${esc(x.role)}</span>`:''}</button>`).join('')}</div></li>`;
}
function bindConvCards(el){ el.querySelectorAll('.rescard').forEach(c=>{ c.querySelector('.rtitle').onclick=()=>{ const r=convById.get(c.dataset.conv); if(r){ if(viewMode==='clusters') setView('conv'); selectConv(r); const g=groups.find(g=>g.data.conv===r); if(g&&viewMode==='conv') focusOn(g); } }; c.querySelectorAll('.rorgs .chip[data-id]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); const t=orgById.get(b.dataset.id); if(t) select(t); }); }); }
function convHitsHtml(){ if(!query||!convHits.length) return ''; return `<div class="ksec" style="margin:0 0 16px"><dt>Convergences pour « ${esc(query)} » <span class="n">${convHits.length}</span></dt><ul class="reslist">${convHits.slice(0,6).map(c=>convCard(c,true)).join('')}</ul></div>`; }
function profileBarHtml(compact){ if(!profile) return ''; const who=esc(profileWho()); const th=profile.themes?.length?esc(profile.themes.join(' · ')):'tous les thèmes'; if(compact) return `<div class="profile-bar" style="padding:6px 10px;margin-right:28px"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">${who} · ${th}</span><button id="editProfile">Modifier</button></div>`; return `<div class="profile-bar"><b>${who}</b><span style="color:var(--muted);font-size:12px">${th}${profile.wants?.length?' · '+profile.wants.length+' chantier'+(profile.wants.length>1?'s':''):''}</span><span style="margin-left:auto;display:flex;gap:10px"><button id="editProfile">Modifier</button><button id="showAll">Tout afficher</button></span></div>`; }
function bindProfileBar(el){ el.querySelector('#editProfile')?.addEventListener('click',()=>startOnboarding(2)); el.querySelector('#showAll')?.addEventListener('click',()=>{ profile=null; saveProfile(); for(const d in active) active[d].clear(); applyState(); renderDetail(); renderPopover(); }); }
function orgLi(x,why,title){ return `<li><button data-id="${x.id}"${title?` title="${esc(title)}"`:''}>${logoImg(x)}<span class="nm">${esc(x.name)}</span><span class="why">${esc(why)}</span></button></li>`; }
function acuList(limit=12){ return RAW.filter(o=>o.acu&&o.acu.top).sort((a,b)=>a.acu.rank-b.acu.rank).slice(0,limit); }
function renderDetail(){
  const el=document.getElementById('detailBody');
  if(selectedConv){ const c=selectedConv; const acus=c.members.map(m=>orgById.get(m.id)).filter(o=>o&&ACU.has(o.id)).sort((a,b)=>a.acu.rank-b.acu.rank);
    el.innerHTML=`<button class="close" id="closeDetail" aria-label="Fermer">×</button><div class="eyebrow" style="color:var(--accent-ink)">Convergence</div><ul class="reslist">${convCard(c,false)}</ul>
    ${acus.length?`<div class="ksec"><dt>Points d'acupuncture dans cette convergence</dt><ul class="rel acu-list">${acus.map(o=>orgLi(o,o.acu.n+' convergences')).join('')}</ul></div>`:''}
    <p style="color:var(--muted);font-size:11.5px;margin-top:12px">Convergences et rôles ont été déduits des descriptifs ; à faire valider et enrichir par les occupant·e·s.</p>`;
    el.querySelector('#closeDetail').onclick=()=>selectConv(null); el.querySelectorAll('.rorgs .chip[data-id], .rel button[data-id]').forEach(b=>b.onclick=()=>{ const t=orgById.get(b.dataset.id); if(t) select(t); }); syncDetailSheet(); return; }
  if(!selected && profile){
    const me=meOrg(); const pool=orgs.filter(o=>o!==me&&profileMatch(o)).map(o=>({o,s:profileScore(o)})).sort((a,b)=>b.s-a.s).slice(0,8);
    const nMatch=orgs.filter(o=>profileMatch(o)&&o!==me).length; const nb=me?neighbours(me):null;
    el.innerHTML=`<div class="foryou">${profileBarHtml()}${convHitsHtml()}
      <h2 style="font-size:16px">${nMatch} structures correspondent à votre profil</h2>
      <p style="color:var(--muted);font-size:12.5px;margin:0">Elles restent en avant sur la carte ; le reste du lieu attend en arrière-plan. Ouvrez-en une pour voir qui elle relie.</p>
      ${me?`<h3>Votre structure</h3><ul class="rel">${orgLi(me,me.room?'bureau '+me.room:me.floorLabel)}</ul>`:''}
      <h3>Les plus proches de vous</h3>
      <ul class="rel">${pool.map(r=>orgLi(r.o,me&&r.o.floor===me.floor?'même étage':(r.o.themes.filter(x=>profile.themes?.includes(x)).length+' thèmes'))).join('')||'<li class="kempty">Élargissez vos thèmes ou vos chantiers.</li>'}</ul>
      <h3>Chantiers pour vous</h3>
      <ul class="reslist">${convsForProfile(6).map(x=>convCard(x.c,true)).join('')||'<li class="kempty">Rien ne correspond encore.</li>'}</ul>
      ${nb&&(nb.sameRoom.length||nb.sameFloor.length)?`<h3>Vos voisin·e·s de palier</h3><ul class="rel aff">${nb.sameRoom.map(x=>orgLi(x,'même bureau')).join('')}${nb.sameFloor.slice(0,8).map(x=>orgLi(x,x.room||'')).join('')}</ul>`:''}
      <p style="font-size:11.5px;margin-top:12px"><button id="replayIntro" style="background:none;border:0;color:var(--accent-ink);cursor:pointer;padding:0">Revoir l'introduction</button></p></div>`;
    bindProfileBar(el); el.querySelector('#replayIntro').onclick=()=>startOnboarding(0);
    el.querySelectorAll('.rel button[data-id]').forEach(b=>b.onclick=()=>{ const t=orgById.get(b.dataset.id); if(t) select(t); });
    bindConvCards(el); renderPopover(); syncDetailSheet(); return;
  }
  if(!selected){
    el.innerHTML=`${convHitsHtml()}<div class="empty"><p style="font-size:12.5px;margin:0 0 8px"><button id="setupProfile" class="btn" style="padding:6px 10px">Personnaliser cette carte</button></p><h2>Comment lire cette carte</h2><p>Chaque point est une structure du Sowatt, colorée par catégorie. ${RAW.length} structures, ${CONV.length} convergences.</p><ol><li><b>Qui est là ?</b> Grappes par catégorie, thème, étage ou public ; filtres derrière le bouton ☰ en haut à gauche.</li><li><b>Où ?</b> La vue <button class="chip" id="goLieu">Le lieu 3D</button> pose chacun·e sur son bureau, étage par étage.</li><li><b>Avec qui ?</b> Ouvrir une fiche : relations déclarées, convergences communes, affinités, voisin·e·s.</li><li><b>Où appuyer ?</b> Les <b>convergences</b> sont des chantiers communs possibles ; les <b>points d'acupuncture</b> sont les structures qui relient le plus de mondes différents.</li></ol></div>
    <div class="ksec"><dt>Points d'acupuncture <span class="n">· les 12 structures les plus reliantes</span></dt><ul class="rel acu-list">${acuList().map(o=>`<li><button data-id="${o.id}"><span class="rank">${o.acu.rank}</span>${logoImg(o)}<span class="nm">${esc(o.name)}</span><span class="why">${o.acu.n} conv. · ${o.acu.cats} cat.</span></button></li>`).join('')}</ul></div>
    ${agendaAll().length?`<div class="ksec"><dt>À venir chez les occupant·e·s <span class="n">· relevé sur leurs sites</span></dt><ul class="agenda">${agendaAll().map(x=>agendaLi(x.a,x.o)).join('')}</ul></div>`:''}
    <div class="ksec"><dt>Micro-systèmes <span class="n">· ${CONV.filter(c=>c.family==='niche').length} petits chantiers précis</span></dt><ul class="reslist">${CONV.filter(c=>c.family==='niche').map(c=>convCard(c,true)).join('')}</ul></div>
    <div class="ksec"><dt>Grandes convergences</dt><ul class="reslist">${CONV.filter(c=>c.family!=='niche').map(c=>convCard(c,true)).join('')}</ul></div>`;
    el.querySelectorAll('.agenda .aorg').forEach(b=>b.onclick=()=>{ const t=orgById.get(b.dataset.id); if(t) select(t); });
    el.querySelector('#goLieu').onclick=()=>setView('lieu'); el.querySelector('#setupProfile').onclick=()=>startOnboarding(2);
    el.querySelectorAll('.acu-list button').forEach(b=>b.onclick=()=>{ const t=orgById.get(b.dataset.id); if(t) select(t); });
    bindConvCards(el); syncDetailSheet(); return; }
  const o=selected; const rel=related(o,8); const know=convLinks(o); const decl=declared(o); const nb=neighbours(o);
  const tagList=(label,arr,dim)=>arr&&arr.length?`<div><dt>${label}</dt><dd class="chips">${arr.map(v=>`<button class="chip" data-dim="${dim}" data-val="${esc(v)}" aria-pressed="${active[dim].has(v)}">${esc(v)}</button>`).join('')}</dd></div>`:'';
  const site=o.website?`<a href="${esc(o.website)}" target="_blank" rel="noopener">${esc(o.website.replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,''))} ↗</a>`:'';
  el.innerHTML=`<button class="close" id="closeDetail" aria-label="Fermer">×</button>${profileBarHtml(true)}
    <div style="display:flex;gap:14px;align-items:flex-start;margin-top:4px">${logoImg(o,'lg big')}<div style="min-width:0"><span class="pill"><span class="sw" style="background:${catColor(o.cat)}"></span>${esc(o.catLabel)}</span>${ACU.has(o.id)?` <span class="pill acu" title="Point d'acupuncture n°${o.acu.rank}">◌ acupuncture n°${o.acu.rank}</span>`:''}
    <h2 style="margin-top:8px">${esc(o.name)}</h2></div></div>
    ${o.people?`<div style="font-size:13px">${esc(o.people)}</div>`:''}
    <div style="font-size:12.5px;margin-top:6px"><button class="chip" id="goRoom" title="Voir sur le plan 3D">📍 ${esc(o.floorLabel)}${o.room?' · bureau '+esc(o.room):''}</button>${o.approx?' <span style="color:var(--muted);font-size:11.5px">position approximative</span>':''}</div>
    ${o.desc?`<p class="desc clamp" id="descText">${esc(o.desc)}</p><button class="readmore" id="readMore" aria-expanded="false" hidden>Lire la suite</button>`:'<p class="desc" style="color:var(--muted)">Pas de descriptif dans le tableur.</p>'}
    ${o.offre?`<div class="offer"><dt>Ce qu'elle propose</dt><p>${esc(o.offre)}</p>${o.formats?`<p class="fmt">${esc(o.formats)}</p>`:''}${o.publicsDetail?`<p class="fmt">Pour : ${esc(o.publicsDetail)}</p>`:''}</div>`:''}
    ${upcoming(o).length?`<div class="ksec"><dt>À venir <span class="n">${upcoming(o).length}</span></dt><ul class="agenda">${upcoming(o).map(a=>agendaLi(a)).join('')}</ul></div>`:''}
    <div class="contact">${site?`<span>${site}</span>`:''}${o.mails.map(m=>`<span><a href="mailto:${esc(m)}">${esc(m)}</a></span>`).join('')}${o.phone?`<span><a href="tel:${esc(o.phone.replace(/\s/g,''))}">${esc(o.phone)}</a></span>`:''}${(o.reseaux||[]).length?`<span class="soc">${o.reseaux.map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener">${esc((u.match(/(instagram|facebook|linkedin|youtube|tiktok|vimeo)/)||['','lien'])[1])} ↗</a>`).join(' · ')}</span>`:''}</div>
    ${(o.alertes||[]).length?`<p class="alerte">À vérifier · ${o.alertes.map(esc).join(' ')}</p>`:''}
    ${ACU.has(o.id)&&o.acu.note?`<div class="acu-note"><b>Pourquoi un point d'acupuncture ·</b> ${esc(o.acu.note)}</div>`:''}
    <dl class="meta">${tagList('Thèmes',o.themes,'theme')}${tagList('Publics',o.publics,'public')}</dl>
    <div class="ksec"><dt>Convergences <span class="n">${o.convs.length}</span></dt>${o.convs.length?`<ul class="reslist">${o.convs.map(x=>convCard(x.c,true)).join('')}</ul>`:'<p class="kempty">Aucune convergence identifiée pour l’instant.</p>'}</div>
    ${decl.length?`<div class="ksec"><dt>Relations déclarées <span class="n">${decl.length}</span></dt><ul class="rel">${decl.map(d=>orgLi(d.x,d.why)).join('')}</ul></div>`:''}
    <div class="ksec"><dt>Reliés par des convergences communes <span class="n">${know.length}</span></dt><ul class="rel">${know.length?know.slice(0,10).map(k=>orgLi(k.x,k.via.length+' conv.',k.via.map(v=>v.title).join(' · '))).join(''):'<li class="kempty">Aucune.</li>'}</ul></div>
    ${rel.length?`<div class="ksec"><dt style="color:var(--dim)">Affinités thématiques <span class="n">(thèmes partagés, pas des partenariats)</span></dt><ul class="rel aff">${rel.slice(0,6).map(r=>orgLi(r.x,r.shared.length+' thème'+(r.shared.length>1?'s':''),r.shared.join(' · '))).join('')}</ul></div>`:''}
    ${(nb.sameRoom.length||nb.sameFloor.length)?`<div class="ksec"><dt>Voisin·e·s <span class="n">${nb.sameRoom.length?nb.sameRoom.length+' même bureau · ':''}${nb.sameFloor.length} même étage</span></dt><ul class="rel aff">${nb.sameRoom.map(x=>orgLi(x,'même bureau')).join('')}${nb.sameFloor.slice(0,6).map(x=>orgLi(x,x.room||'')).join('')}</ul></div>`:''}
    <p style="color:var(--muted);font-size:11.5px;margin-top:12px">Source : ${esc(o.source)}.</p>`;
  el.querySelector('#closeDetail').onclick=()=>select(null); bindProfileBar(el);
  el.querySelector('#goRoom').onclick=()=>{ const keep=selected; if(viewMode!=='lieu') setView('lieu'); selected=keep; LIEU.flyTo(keep); applyState(); };
  el.querySelectorAll('.meta .chip').forEach(b=>b.onclick=()=>{ const d=b.dataset.dim,v=b.dataset.val; active[d].has(v)?active[d].delete(v):active[d].add(v); applyState(); renderDetail(); });
  el.querySelectorAll('.rel button[data-id]').forEach(b=>b.onclick=()=>{ const t=orgById.get(b.dataset.id); if(t) select(t); });
  bindConvCards(el);
  const dt=el.querySelector('#descText'), rm=el.querySelector('#readMore');
  if(dt && rm){ syncDetailSheet(); if(dt.scrollHeight>dt.clientHeight+2){ rm.hidden=false; rm.onclick=()=>{ const open=dt.classList.toggle('clamp')===false; rm.textContent=open?'Réduire':'Lire la suite'; rm.setAttribute('aria-expanded',String(open)); }; } }
  syncDetailSheet();
}

document.getElementById('search').addEventListener('input',e=>{ query=e.target.value.trim().toLowerCase(); matchConv(); convDismissed=false; if(selectedConv) selectedConv=null; if(!selected) renderDetail(); applyState(); });
document.getElementById('searchToggle').onclick=e=>{ const h=document.querySelector('header.top'); const open=h.classList.toggle('search-open'); e.currentTarget.setAttribute('aria-expanded',String(open)); if(open) document.getElementById('search').focus(); };
const pop=document.getElementById('aboutPop'), popBtn=document.getElementById('aboutBtn');
function setPopover(open){ pop.hidden=!open; popBtn.setAttribute('aria-expanded',String(open)); if(open) renderPopover(); }
popBtn.onclick=()=>setPopover(pop.hidden);
document.addEventListener('click',e=>{ if(!pop.hidden && !pop.contains(e.target) && e.target!==popBtn) setPopover(false); });
document.getElementById('clearAll').onclick=()=>{ const had=anyFilter(); for(const d in active) active[d].clear(); query=''; document.getElementById('search').value=''; matchConv(); if(viewMode==='lieu'){ LIEU.setFloor(null); renderHint(); } if(!had && profile){ profile=null; saveProfile(); } if(!selected&&!selectedConv) renderDetail(); applyState(); renderPopover(); };
function renderPopover(){
  const el=document.getElementById('profileSummary'); if(!el) return; const me=meOrg();
  el.innerHTML = profile ? `<b>${esc(profileWho())}</b>${me?` · ${esc(me.floorLabel)}`:''}<br><span class="muted" style="color:var(--muted)">${profile.themes?.length?esc(profile.themes.join(' · ')):'tous les thèmes'}${profile.wants?.length?' · chantiers : '+esc(profile.wants.map(id=>convById.get(id)?.title).filter(Boolean).join(', ')):''}</span>` : `<span style="color:var(--muted)">Pas encore de profil : la carte montre tout.</span>`;
  document.getElementById('popShowAll').hidden=!profile; document.getElementById('popForYou').hidden=!(profile && narrowMQ.matches); popBtn.classList.toggle('has-profile',!!profile);
}
document.getElementById('profileBtn').onclick=()=>{ setPopover(false); startOnboarding(2); };
document.getElementById('popReplay').onclick=()=>{ setPopover(false); startOnboarding(0); };
document.getElementById('popForYou').onclick=()=>{ forYouOpen=true; select(null); setPopover(false); };
document.getElementById('popShowAll').onclick=()=>{ profile=null; saveProfile(); for(const d in active) active[d].clear(); forYouOpen=false; applyState(); renderDetail(); setPopover(false); renderPopover(); };
document.getElementById('zin').onclick=()=>viewMode==='lieu'?LIEU.dolly(0.7):svg.transition().duration(reduced?0:250).call(zoom.scaleBy,1.6);
document.getElementById('zout').onclick=()=>viewMode==='lieu'?LIEU.dolly(1.4):svg.transition().duration(reduced?0:250).call(zoom.scaleBy,1/1.6);
document.getElementById('zreset').onclick=resetView;
document.getElementById('viewClusters').onclick=()=>setView('clusters');
document.getElementById('viewLieu').onclick=()=>setView('lieu');
document.getElementById('viewConv').onclick=()=>setView('conv');
document.getElementById('brandHome').onclick=()=>{ profile=null; saveProfile(); for(const d in active) active[d].clear(); query=''; document.getElementById('search').value=''; selected=null; selectedConv=null; if(viewMode!=='clusters') setView('clusters'); startOnboarding(0); };
function setFiltersOpen(open){ const f=document.getElementById('filters'); f.hidden=!open; document.getElementById('toggleFilters').setAttribute('aria-pressed',String(open)); document.getElementById('burger').setAttribute('aria-expanded',String(open)); if(open && narrowMQ.matches) setDetailOpen(false); }
function setDetailOpen(open){ const d=document.getElementById('detail'); if(!narrowMQ.matches){ d.hidden=false; document.body.classList.remove('detail-open'); return; } d.hidden=!open; document.body.classList.toggle('detail-open',open); if(open){ d.scrollTop=0; setFiltersOpen(false); } }
let convDismissed=false, forYouOpen=false;
function syncDetailSheet(){ setDetailOpen(!!(selected||selectedConv||(profile&&forYouOpen)||(query&&convHits.length&&!convDismissed))); }
function closeDetailSheet(){ forYouOpen=false; convDismissed=true; if(selected) select(null); else if(selectedConv) selectConv(null); else setDetailOpen(false); }
document.getElementById('toggleFilters').onclick=()=>setFiltersOpen(document.getElementById('filters').hidden);
document.getElementById('closeFilters').onclick=()=>setFiltersOpen(false);
document.getElementById('burger').onclick=e=>{ e.stopPropagation(); setFiltersOpen(document.getElementById('filters').hidden); };
document.addEventListener('pointerdown',e=>{ if(narrowMQ.matches) return; const f=document.getElementById('filters'); if(!f.hidden && !f.contains(e.target) && !e.target.closest('#burger')) setFiltersOpen(false); });
function updateBurgerCount(){ const n=Object.values(active).reduce((a,s)=>a+s.size,0); const b=document.getElementById('burgerCount'); if(!b) return; b.hidden=!n; b.textContent=n; }
document.getElementById('closeDetailSheet').onclick=closeDetailSheet;
addEventListener('keydown',e=>{ if(e.key!=='Escape') return; if(!pop.hidden){ setPopover(false); return; } if(!narrowMQ.matches && !document.getElementById('filters').hidden){ setFiltersOpen(false); document.getElementById('burger').focus(); return; } if(narrowMQ.matches){ if(!document.getElementById('filters').hidden) setFiltersOpen(false); else if(!document.getElementById('detail').hidden && obStep<0) closeDetailSheet(); } else if(selected) select(null); else if(selectedConv) selectConv(null); });
function placeViewSeg(){ const seg=document.getElementById('viewSeg'); if(narrowMQ.matches) document.getElementById('mobileBar').appendChild(seg); else document.querySelector('header.top').insertBefore(seg,document.querySelector('header.top .controls')); }
function applyNarrow(){ placeViewSeg(); if(narrowMQ.matches){ setFiltersOpen(false); } else { setFiltersOpen(false); document.querySelector('header.top').classList.remove('search-open'); } syncDetailSheet(); renderPopover(); }
narrowMQ.addEventListener('change',applyNarrow);
let rt; addEventListener('resize',()=>{ clearTimeout(rt); rt=setTimeout(()=>{ layout(); },150); });

// ---------- Le lieu : WebGL (three.js) — bâtiment réel orienté sur l'orthophoto IGN ----------
const GEO = JSON.parse(document.getElementById('geo').textContent);
const LIEU=(()=>{
  const FLOORS=[{id:'SS',label:'Sous-sol',y:-1,plan:null},{id:'RDC',label:'RDC',y:0,plan:'plans/floor0.webp'},{id:'R1',label:'1er',y:1,plan:'plans/floor1.webp'},{id:'R2',label:'2e',y:2,plan:'plans/floor2.webp'},{id:'R3',label:'3e',y:3,plan:'plans/floor3.webp'}];
  const PW=842.25, PH=1190.25, LIFT=22, PPM=GEO.ptsPerM;  // 1 m ≈ 12,3 points de plan
  const GAPS={compact:3.6*PPM*1.25, eclate:11*PPM}; let gapMode='eclate'; let GAP=GAPS[gapMode];
  const HORS={bonallure:[560,700,'RDC'],familyforme:[150,330,'RDC'],enluminance:[300,540,'SS'],kpro:[420,620,'SS'],madeleine:[540,540,'SS']};
  const el=document.getElementById('gl');
  let renderer, scene, camera, ray=new THREE.Raycaster(), inited=false, lieuOn=false, needs=true, raf=0, shown=false;
  const nodes=new Map(), labels=new Map(); const floorGroups=new Map(); let building, linkGroup, haloSprite, pins;
  let floor=null;
  const target=new THREE.Vector3(0,0,0); const sph={r:2600,theta:2.3,phi:0.92};
  const homeR=()=>{ const r=canvas.getBoundingClientRect(); const a=Math.max(0.3,r.width/Math.max(1,r.height)); return Math.min(9000,Math.max(2500,1750/(0.69*a))); };
  const homeTarget=()=>new THREE.Vector3(0,GAP*1.3,0);
  const floorY=F=>F.y*GAP;
  const local=o=>{ const h=HORS[o.id]; const f=h?h[2]:o.floor; const F=FLOORS.find(x=>x.id===f)||FLOORS[1]; const px=h?h[0]:(o.px??421), py=h?h[1]:(o.py??595); return {x:px-GEO.pcx, z:py-GEO.pcy, F}; };
  const worldPos=o=>{ const p=local(o); const v=new THREE.Vector3(p.x,floorY(p.F)+LIFT,p.z); building.localToWorld(v); return v; };
  function circleTex(o){
    const S=128, c=document.createElement('canvas'); c.width=c.height=S; const g=c.getContext('2d');
    const col=CATHEX[o.cat]; g.clearRect(0,0,S,S);
    g.beginPath(); g.arc(S/2,S/2,S/2-2,0,Math.PI*2); g.fillStyle=o.logo?'#fff':col; g.fill(); g.lineWidth=o.logo?7:3; g.strokeStyle=o.logo?col:'#fff'; g.stroke();
    if(ACU.has(o.id)){ g.setLineDash([6,5]); g.lineWidth=3; g.strokeStyle='#F05A28'; g.beginPath(); g.arc(S/2,S/2,S/2-13,0,Math.PI*2); g.stroke(); g.setLineDash([]); }
    const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=4;
    if(o.logo){ const im=new Image(); im.onload=()=>{ g.save(); g.beginPath(); g.arc(S/2,S/2,S/2-9,0,Math.PI*2); g.clip(); g.drawImage(im,10,10,S-20,S-20); g.restore(); tex.needsUpdate=true; request(); }; im.src=logoUrl(o); }
    return tex;
  }
  function textTex(txt,opts={}){
    const fs=opts.size||26, pad=14; const c=document.createElement('canvas'); const g=c.getContext('2d'); g.font=`${opts.weight||600} ${fs}px Outfit, Figtree, sans-serif`;
    const w=Math.ceil(g.measureText(txt).width)+pad*2, h=fs+pad*1.4; c.width=w*2; c.height=h*2; g.scale(2,2);
    if(opts.bg!==false){ g.fillStyle=opts.bg||'rgba(255,255,255,.92)'; g.beginPath(); g.roundRect(0,0,w,h,h/2); g.fill(); }
    g.font=`${opts.weight||600} ${fs}px Outfit, Figtree, sans-serif`; g.fillStyle=opts.color||'#1F1B17'; g.textBaseline='middle'; g.fillText(txt,pad,h/2);
    const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; return {tex,w,h};
  }
  function screenSprite(t,px){ const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t.tex,transparent:true,depthTest:false,sizeAttenuation:false})); const k=px/Math.max(1,el.clientHeight); sp.scale.set(t.w*k,t.h*k,1); return sp; }
  function footprintShape(){ const sh=new THREE.Shape(); GEO.footprint.forEach(([x,y],i)=>{ const X=x-GEO.pcx, Y=y-GEO.pcy; i?sh.lineTo(X,Y):sh.moveTo(X,Y); }); sh.closePath(); return sh; }
  function buildFloors(){
    const loader=new THREE.TextureLoader();
    FLOORS.forEach(F=>{
      const grp=new THREE.Group(); grp.position.y=floorY(F); building.add(grp); floorGroups.set(F.id,grp);
      let mat;
      if(F.plan){ const tex=loader.load(F.plan,()=>request()); tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=8; mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide,depthWrite:false}); }
      else { const c=document.createElement('canvas'); c.width=842; c.height=1190; const g=c.getContext('2d'); g.fillStyle='rgba(235,231,224,.85)'; g.beginPath(); g.roundRect(180,440,500,320,24); g.fill(); g.strokeStyle='#B0A79D'; g.setLineDash([8,8]); g.lineWidth=3; g.stroke(); const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide,depthWrite:false}); }
      const slab=new THREE.Mesh(new THREE.PlaneGeometry(PW,PH),mat); slab.rotation.x=-Math.PI/2; slab.position.set(PW/2-GEO.pcx,0.5,PH/2-GEO.pcy); slab.renderOrder=10+F.y; slab.userData.slab=true; grp.add(slab);
      if(F.plan){ // murs translucides sur l'emprise réelle
        const wallH=GAP*0.88; const geo=new THREE.ExtrudeGeometry(footprintShape(),{depth:wallH,bevelEnabled:false}); geo.rotateX(Math.PI/2); geo.translate(0,wallH,0);
        const walls=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.22,side:THREE.DoubleSide,depthWrite:false})); walls.renderOrder=5; walls.userData.wall=true; grp.add(walls);
        const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geo,20),new THREE.LineBasicMaterial({color:0x8B8178,transparent:true,opacity:0.4})); edges.userData.edge=true; grp.add(edges);
      }
      const t=textTex(F.label,{size:22,color:'#F05A28',bg:'rgba(255,255,255,.9)'}); const sp=screenSprite(t,0.5); sp.position.set(33-GEO.pcx-30,8,1115-GEO.pcy+30); sp.renderOrder=60; sp.userData.floorText=true; grp.add(sp);
    });
  }
  function init(){
    if(inited) return; inited=true;
    renderer=new THREE.WebGLRenderer({canvas:el,antialias:true,alpha:true,powerPreference:'low-power'}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setClearColor(0xffffff,0);
    scene=new THREE.Scene(); camera=new THREE.PerspectiveCamera(38,1,10,30000);
    const loader=new THREE.TextureLoader();
    // sol : orthophoto IGN, nord vers -z, centrée sur le centroïde de l'emprise OSM
    const o=GEO.ortho, k=o.mpp*PPM, size=o.size*k;
    const gtex=loader.load('plans/ortho.webp',()=>request()); gtex.colorSpace=THREE.SRGBColorSpace; gtex.anisotropy=8;
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(size,size),new THREE.MeshBasicMaterial({map:gtex,transparent:true,opacity:0.92,depthWrite:false})); ground.rotation.x=-Math.PI/2; ground.position.set((o.size/2-o.cx)*k,-2,(o.size/2-o.cy)*k); ground.renderOrder=0; scene.add(ground);
    const vc=document.createElement('canvas'); vc.width=vc.height=512; const vg=vc.getContext('2d'); const grd=vg.createRadialGradient(256,256,120,256,256,256); grd.addColorStop(0,'rgba(255,255,255,0)'); grd.addColorStop(0.75,'rgba(255,255,255,0.55)'); grd.addColorStop(1,'rgba(255,255,255,1)'); vg.fillStyle=grd; vg.fillRect(0,0,512,512); const vt=new THREE.CanvasTexture(vc); const fade=new THREE.Mesh(new THREE.PlaneGeometry(size,size),new THREE.MeshBasicMaterial({map:vt,transparent:true,depthWrite:false})); fade.rotation.x=-Math.PI/2; fade.position.copy(ground.position); fade.position.y=-1; fade.renderOrder=1; scene.add(fade);
    building=new THREE.Group(); building.rotation.y=THREE.MathUtils.degToRad(GEO.theta); scene.add(building);
    buildFloors();
    RAW.forEach(o=>{
      const p=local(o); const mat=new THREE.SpriteMaterial({map:circleTex(o),transparent:true,depthTest:true});
      const sp=new THREE.Sprite(mat); sp.position.set(p.x,LIFT,p.z); sp.scale.set(30,30,1); sp.userData.org=o; sp.renderOrder=100; floorGroups.get(p.F.id).add(sp); nodes.set(o.id,sp);
    });
    buildPins();
    linkGroup=new THREE.Group(); scene.add(linkGroup);
    const ht=(()=>{ const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d'); g.strokeStyle='#F05A28'; g.lineWidth=5; g.beginPath(); g.arc(64,64,56,0,Math.PI*2); g.stroke(); return new THREE.CanvasTexture(c); })();
    haloSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:ht,transparent:true,depthTest:false})); haloSprite.visible=false; haloSprite.renderOrder=200; scene.add(haloSprite);
    // boussole
    const nt=textTex('N ↑',{size:20,color:'#6B625A',bg:'rgba(255,255,255,.85)'}); const ns=screenSprite(nt,0.5); ns.position.set(0,4,-size*0.42); scene.add(ns);
    bindControls(); resize(); updateCamera();
  }
  function buildPins(){ if(pins){ scene.remove(pins); pins.geometry.dispose(); } const arr=[]; RAW.forEach(o=>{ const p=local(o); const a=new THREE.Vector3(p.x,floorY(p.F)+1,p.z), b=new THREE.Vector3(p.x,floorY(p.F)+LIFT-12,p.z); building.localToWorld(a); building.localToWorld(b); arr.push(a.x,a.y,a.z,b.x,b.y,b.z); }); const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(arr,3)); pins=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0x8B8178,transparent:true,opacity:.7})); scene.add(pins); }
  function setGap(mode){ gapMode=mode; GAP=GAPS[mode]; FLOORS.forEach(F=>{ const grp=floorGroups.get(F.id); grp.position.y=floorY(F); grp.children.forEach(ch=>{ if(ch.userData.wall||ch.userData.edge){ grp.remove(ch); } }); if(F.plan){ const wallH=GAP*0.88; const geo=new THREE.ExtrudeGeometry(footprintShape(),{depth:wallH,bevelEnabled:false}); geo.rotateX(Math.PI/2); geo.translate(0,wallH,0); const walls=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.22,side:THREE.DoubleSide,depthWrite:false})); walls.renderOrder=5; walls.userData.wall=true; grp.add(walls); const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geo,20),new THREE.LineBasicMaterial({color:0x8B8178,transparent:true,opacity:0.4})); edges.userData.edge=true; grp.add(edges); } }); buildPins(); if(floor){ const F=FLOORS.find(x=>x.id===floor); flyTarget(new THREE.Vector3(0,floorY(F),0),sph.r); } else flyTarget(homeTarget(),sph.r); setState(); }
  function updateCamera(){ const {r,theta,phi}=sph; camera.position.set(target.x+r*Math.sin(phi)*Math.sin(theta), target.y+r*Math.cos(phi), target.z+r*Math.sin(phi)*Math.cos(theta)); camera.lookAt(target); request(); }
  function resize(){ if(!inited) return; const r=canvas.getBoundingClientRect(); const w=Math.max(1,r.width), h=Math.max(1,r.height); renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
  function request(){ needs=true; if(lieuOn&&!raf) raf=requestAnimationFrame(frame); }
  let tween=null;
  function frame(){ raf=0; if(!lieuOn) return; if(tween){ const t=Math.min(1,(performance.now()-tween.t0)/tween.dur); const e=1-Math.pow(1-t,3); target.lerpVectors(tween.from,tween.to,e); sph.r=tween.r0+(tween.r1-tween.r0)*e; if(tween.th!=null){ sph.theta=tween.th0+(tween.th-tween.th0)*e; sph.phi=tween.ph0+(tween.ph-tween.ph0)*e; } updateCamera(); if(t>=1) tween=null; needs=true; }
    if(needs){ needs=false; renderer.render(scene,camera); } if(tween) raf=requestAnimationFrame(frame); }
  function flyTarget(to,r,th,ph){ if(reduced){ target.copy(to); sph.r=r; if(th!=null){sph.theta=th; sph.phi=ph;} updateCamera(); return; } tween={from:target.clone(),to,r0:sph.r,r1:r,th0:sph.theta,ph0:sph.phi,th,ph,t0:performance.now(),dur:750}; request(); }
  function bindControls(){
    const ptrs=new Map(); let pinch=null, mode=null;
    el.addEventListener('pointerdown',e=>{ el.setPointerCapture(e.pointerId); ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY,x0:e.clientX,y0:e.clientY}); mode=(e.button===2||e.shiftKey||e.ctrlKey)?'pan':'rot'; if(ptrs.size===2){ const [a,b]=[...ptrs.values()]; pinch={d:Math.hypot(a.x-b.x,a.y-b.y),cx:(a.x+b.x)/2,cy:(a.y+b.y)/2}; } });
    el.addEventListener('pointermove',e=>{
      if(!ptrs.has(e.pointerId)){ hover(e); return; }
      const p=ptrs.get(e.pointerId); const dx=e.clientX-p.x, dy=e.clientY-p.y; p.x=e.clientX; p.y=e.clientY;
      if(ptrs.size===2){ const [a,b]=[...ptrs.values()]; const d=Math.hypot(a.x-b.x,a.y-b.y), cx=(a.x+b.x)/2, cy=(a.y+b.y)/2; if(pinch){ sph.r=Math.max(250,Math.min(9000,sph.r*pinch.d/d)); pan(cx-pinch.cx,cy-pinch.cy); } pinch={d,cx,cy}; updateCamera(); return; }
      if(mode==='pan') pan(dx,dy); else { sph.theta-=dx*0.005; sph.phi=Math.max(0.12,Math.min(1.5,sph.phi-dy*0.005)); }
      tween=null; updateCamera();
    });
    const up=e=>{ const p=ptrs.get(e.pointerId); ptrs.delete(e.pointerId); pinch=null; if(p && Math.hypot(e.clientX-p.x0,e.clientY-p.y0)<5 && e.button!==2) click(e); };
    el.addEventListener('pointerup',up); el.addEventListener('pointercancel',e=>{ ptrs.delete(e.pointerId); pinch=null; });
    el.addEventListener('wheel',e=>{ e.preventDefault(); sph.r=Math.max(250,Math.min(9000,sph.r*Math.exp(e.deltaY*0.0012))); tween=null; updateCamera(); },{passive:false});
    el.addEventListener('contextmenu',e=>e.preventDefault());
    el.addEventListener('pointerleave',hideTip);
  }
  function pan(dx,dy){ const r=canvas.getBoundingClientRect(); const k=sph.r*1.2/r.height; const right=new THREE.Vector3(), upv=new THREE.Vector3(0,1,0), dir=new THREE.Vector3(); camera.getWorldDirection(dir); right.crossVectors(dir,upv).normalize(); const fwd=new THREE.Vector3().crossVectors(upv,right).normalize(); target.addScaledVector(right,-dx*k).addScaledVector(fwd,-dy*k); }
  function pick(e){ const r=el.getBoundingClientRect(); const m=new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1); ray.setFromCamera(m,camera); const hits=ray.intersectObjects([...nodes.values()].filter(s=>s.visible&&s.material.opacity>0.2)); return hits.length?hits[0].object.userData.org:null; }
  function hover(e){ const o=pick(e); el.style.cursor=o?'pointer':''; if(o){ showTip(e,o); } else hideTip(); }
  function click(e){ const o=pick(e); if(o) select(o); else if(selected) select(null); else if(selectedConv) selectConv(null); }
  function dimFor(o){ const f=anyDim(); if(selectedConv) return relSet.has(o)&&(!anyFilter()||matches(o))?1:0.1; if(selected) return (o===selected||relSet.has(o))?1:(f?(visible(o)?0.35:0.08):0.18); return f&&!visible(o)?0.1:1; }
  function setState(){
    if(!inited) return;
    nodes.forEach((sp,id)=>{ const o=sp.userData.org; const fl=(HORS[id]?HORS[id][2]:o.floor); const floorOk=!floor||fl===floor; sp.material.opacity=dimFor(o)*(floorOk?1:0.08); const s=o===selected?40:(relSet.has(o)?34:30); sp.scale.set(s,s,1); });
    floorGroups.forEach((grp,id)=>{ const on=!floor||id===floor; grp.children.forEach(ch=>{ if(ch.userData.slab) ch.material.opacity=on?1:0.1; else if(ch.userData.wall) ch.material.opacity=on?0.22:0.04; else if(ch.userData.edge) ch.material.opacity=on?0.55:0.1; else if(ch.userData.floorText) ch.material.opacity=on?1:0.3; }); });
    if(pins) pins.material.opacity=floor?0.25:0.7;
    labels.forEach(sp=>scene.remove(sp)); labels.clear();
    const show=new Set(); if(selected) show.add(selected); relSet.forEach(o=>show.add(o));
    show.forEach(o=>{ const sp=nodes.get(o.id); if(!sp) return; const t=textTex(o.name,{size:22,weight:o===selected?700:500}); const l=screenSprite(t,0.55); l.position.copy(worldPos(o)); l.position.y+=26; l.renderOrder=150; l.center.set(0.5,-0.15); scene.add(l); labels.set(o.id,l); });
    while(linkGroup.children.length) linkGroup.remove(linkGroup.children[0]);
    const mk=(a,b,color,op,dash)=>{ const mid=new THREE.Vector3().addVectors(a,b).multiplyScalar(0.5); mid.y+=Math.max(30,a.distanceTo(b)*0.16); const curve=new THREE.QuadraticBezierCurve3(a,mid,b); const g=new THREE.BufferGeometry().setFromPoints(curve.getPoints(28)); const m=dash?new THREE.LineDashedMaterial({color,transparent:true,opacity:op,dashSize:10,gapSize:8}):new THREE.LineBasicMaterial({color,transparent:true,opacity:op}); const line=new THREE.Line(g,m); if(dash) line.computeLineDistances(); line.renderOrder=90; linkGroup.add(line); };
    haloSprite.visible=false;
    if(selectedConv){ const pts=[...relSet].map(o=>worldPos(o)); if(pts.length){ const c=new THREE.Vector3(); pts.forEach(p=>c.add(p)); c.multiplyScalar(1/pts.length); c.y+=70; pts.forEach(p=>mk(c,p,0xF05A28,0.6,false)); haloSprite.position.copy(c); haloSprite.scale.set(50,50,1); haloSprite.visible=true; } }
    else if(selected){ const a=worldPos(selected); relKind.forEach((k,x)=>{ const b=worldPos(x); mk(a,b,k.kind==='decl'?0x1F1B17:k.kind==='know'?0xF05A28:0xB0A79D,k.kind==='aff'?0.55:0.75,k.kind==='aff'); }); haloSprite.position.copy(a); haloSprite.scale.set(46,46,1); haloSprite.visible=true; }
    request();
  }
  function home(){ floor=null; flyTarget(homeTarget(),homeR(),2.3,0.92); setState(); }
  function flyTo(o){ if(!nodes.get(o.id)) return; const fl=(HORS[o.id]?HORS[o.id][2]:o.floor); if(floor&&floor!==fl){ floor=null; renderHint(); } flyTarget(worldPos(o),Math.min(sph.r,1400)); setState(); }
  function flyToConv(c){ const pts=c.members.map(m=>orgById.get(m.id)).filter(Boolean).map(o=>worldPos(o)); if(!pts.length) return; const ctr=new THREE.Vector3(); pts.forEach(p=>ctr.add(p)); ctr.multiplyScalar(1/pts.length); let far=0; pts.forEach(p=>far=Math.max(far,p.distanceTo(ctr))); floor=null; flyTarget(ctr,Math.max(1200,far*2.4)); }
  function setFloor(f){ floor=f; if(f){ const F=FLOORS.find(x=>x.id===f); flyTarget(new THREE.Vector3(0,floorY(F),0),1500,sph.theta,0.75); } else home(); setState(); }
  function dolly(k){ sph.r=Math.max(250,Math.min(9000,sph.r*k)); updateCamera(); }
  function show(){ init(); lieuOn=true; resize(); if(!shown){ shown=true; sph.r=homeR(); target.copy(homeTarget()); } setState(); updateCamera(); }
  function hide(){ lieuOn=false; hideTip(); }
  return {show,hide,resize,render:request,setState,flyTo,flyToConv,home,setFloor,setGap,dolly,get floor(){return floor;},get gap(){return gapMode;}};
})();

// ---------- onboarding (repris d'eco-map) : les structures sont les particules, chaque écran les réorganise ----------
const onb=document.getElementById('onb'), onbCard=document.getElementById('onbCard');
let obStep=-1, obDraft=null, scattered=false;
const scatterPos=new Map(); const rng=d3.randomLcg(7);
function scatterOf(o){ if(!scatterPos.has(o.id)) scatterPos.set(o.id,[0.08+rng()*0.84, 0.1+rng()*0.8]); const p=scatterPos.get(o.id); return [p[0]*W,p[1]*H]; }
function setScatter(on){
  scattered=on; const dur=reduced?0:900;
  gNodes.selectAll('circle.node').transition().duration(dur).ease(d3.easeCubicInOut).attr('cx',d=>on?scatterOf(d.data.org)[0]:d.x).attr('cy',d=>on?scatterOf(d.data.org)[1]:d.y).attr('r',d=>on?3:Math.max(1.2,d.r-0.6));
  gNodes.selectAll('circle.acu-ring,circle.nback,image.nlogo').style('display','none');
  gGroups.selectAll('circle').transition().duration(dur).style('opacity',on?0:1);
  gLabels.selectAll('text.group-label').transition().duration(dur).style('opacity',on?0:1);
  gLinks.selectAll('*').remove();
  if(!on) setTimeout(()=>updateLabelVisibility(currentK),dur+20);
}
let meQuery='';
const STEPS=[
  {render:()=>`<div class="step">Sowatt · carte des occupant·e·s</div><p class="big">${RAW.length}</p><h2>structures font vivre le Sowatt</h2><p>Artistes, artisans, ateliers, associations, agences, cabinets, thérapeutes. Chaque point est l'une d'elles. Suivez les liens pour trouver qui fait quoi, à quel étage, et avec qui converger.</p><div class="nav"><button class="primary" data-next>Commencer</button><button class="ghost" data-skip>Aller directement à la carte</button></div>`,
   enter:()=>{ profile=null; for(const d in active) active[d].clear(); if(viewMode!=='clusters') setView('clusters'); applyState(); setScatter(true); }},
  {render:()=>`<div class="step">Qui est là</div><h2>Neuf familles, un même bâtiment</h2><p>Des ateliers d'artistes du 1er aux agences du 2e, chaque catégorie garde sa couleur partout dans la carte. Les anneaux pointillés marquent les points d'acupuncture : les structures qui relient le plus de mondes différents.</p><div class="nav"><button class="ghost" data-prev>Retour</button><button class="primary" data-next>Continuer</button></div>`,
   enter:()=>{ profile=null; if(viewMode!=='clusters') setView('clusters'); applyState(); setScatter(false); }},
  {render:()=>{ const cnt=d3.rollup(RAW,v=>v.length,o=>o.cat); return `<div class="step">Personnaliser · 1 sur 3</div><h2>Qui êtes-vous ?</h2><p>Choisissez votre famille de métier : la carte mettra en avant celles et ceux qui font comme vous, et les chantiers où votre métier compte. Visiteur·se ? Passez cette étape.</p><div class="choices">${CATS.filter(c=>cnt.get(c)).map(c=>`<button class="chip" data-cat="${c}" aria-pressed="${obDraft.cat===c}"><span class="sw" style="background:${catColor(c)}"></span>${esc(CATLABEL[c])} <span class="n">${cnt.get(c)}</span></button>`).join('')}</div><div class="nav"><button class="ghost" data-prev>Retour</button><button class="primary" data-next>${obDraft.cat?'Continuer':'Je visite, continuer'}</button><button class="ghost" data-skip>Passer</button></div>`; },
   enter:()=>{ if(viewMode!=='clusters') setView('clusters'); setScatter(false); if(groupBy!=='cat'){ groupBy='cat'; layout(); } profile={cat:obDraft.cat,themes:[],wants:[]}; applyState(); if(obDraft.cat){ const g=groups.find(g=>g.depth===1&&g.leaves().some(l=>l.data.org&&l.data.org.cat===obDraft.cat)); if(g) zoomTo(g.x,g.y,g.r,650); } }},
  {render:()=>{ const pool=obDraft.cat?RAW.filter(o=>o.cat===obDraft.cat):RAW; const first=Array.from(d3.rollup(pool.flatMap(o=>o.themes),v=>v.length,x=>x)).sort((a,b)=>b[1]-a[1]).map(x=>x[0]); const all=first.concat(Array.from(d3.rollup(RAW.flatMap(o=>o.themes),v=>v.length,x=>x)).sort((a,b)=>b[1]-a[1]).map(x=>x[0]).filter(t=>!first.includes(t))); return `<div class="step">Personnaliser · 2 sur 3</div><h2>Sur quoi travaillez-vous ?</h2><p>Jusqu'à trois thèmes${obDraft.cat?` (ceux de votre famille de métier sont en tête)`:''}. Les structures qui les partagent passeront devant.</p><div class="choices">${all.map(t=>`<button class="chip" data-theme="${esc(t)}" aria-pressed="${obDraft.themes.includes(t)}">${esc(t)}</button>`).join('')}</div><div class="nav"><button class="ghost" data-prev>Retour</button><button class="primary" data-next ${obDraft.themes.length?'':'disabled'}>Continuer</button><button class="ghost" data-skip>Passer</button></div>`; },
   enter:()=>{ profile={cat:obDraft.cat,themes:obDraft.themes.slice(),wants:[]}; if(viewMode!=='clusters') setView('clusters'); groupBy='theme'; layout(); applyState(); }},
  {render:()=>`<div class="step">Personnaliser · 3 sur 3</div><h2>Quel chantier vous tente ?</h2><p>Les convergences sont des projets communs possibles entre structures de familles différentes. Choisissez ceux qui vous parlent.</p><div class="choices">${CONV.map(c=>`<button class="chip" data-want="${c.id}" aria-pressed="${obDraft.wants.includes(c.id)}"><span style="color:var(--accent);margin-right:4px">${FAMS[c.family].icon}</span>${esc(c.title)}</button>`).join('')}</div><div class="nav"><button class="ghost" data-prev>Retour</button><button class="primary" data-next>Continuer</button><button class="ghost" data-skip>Passer</button></div>`,
   enter:()=>{ profile={cat:obDraft.cat,themes:obDraft.themes.slice(),wants:obDraft.wants.slice()}; if(viewMode!=='conv') setView('conv'); applyState(); }},
  {render:()=>{ const n=orgs.filter(o=>profileMatch(o)).length; const kn=convsForProfile(50).length; const nc=obDraft.cat?RAW.filter(o=>o.cat===obDraft.cat).length:0; return `<div class="step">Votre vue</div><p class="big">${n}</p><h2>structures correspondent à votre profil${nc?`, dont ${nc} de votre famille de métier`:''}</h2><p>${kn} chantiers vous concernent. Vos structures restent devant ; le reste du lieu attend en arrière-plan jusqu'à ce que vous le demandiez. Changez de profil ou affichez tout à tout moment.</p><div class="nav"><button class="ghost" data-prev>Retour</button><button class="primary" data-finish>Ouvrir ma carte</button><button class="ghost" data-skip>Tout afficher plutôt</button></div>`; },
   enter:()=>{ profile={cat:obDraft.cat,themes:obDraft.themes.slice(),wants:obDraft.wants.slice()}; if(viewMode!=='lieu') setView('lieu'); applyState(); LIEU.home(); }},
];
function startOnboarding(step){
  obDraft={cat:profile?.cat||null,themes:(profile?.themes||[]).slice(),wants:(profile?.wants||[]).slice()}; meQuery='';
  document.body.classList.add('onboarding'); onb.hidden=false; select(null); selectedConv=null; focusGroup=null; svg.call(zoom.transform,d3.zoomIdentity);
  setTimeout(()=>{ layout(); goStep(step); },30);
}
function goStep(i){
  obStep=Math.max(0,Math.min(STEPS.length-1,i)); const s=STEPS[obStep];
  onbCard.innerHTML=s.render()+`<div class="dots">${STEPS.map((_,k)=>`<i class="${k===obStep?'on':''}"></i>`).join('')}</div><div class="kbd">Molette ou flèches ← → pour avancer</div>`;
  s.enter();
  onbCard.querySelector('[data-next]')?.addEventListener('click',()=>goStep(obStep+1));
  onbCard.querySelector('[data-prev]')?.addEventListener('click',()=>goStep(obStep-1));
  onbCard.querySelector('[data-skip]')?.addEventListener('click',()=>endOnboarding(false));
  onbCard.querySelector('[data-finish]')?.addEventListener('click',()=>endOnboarding(true));
  onbCard.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{ obDraft.cat=obDraft.cat===b.dataset.cat?null:b.dataset.cat; goStep(obStep); });
  const ms=onbCard.querySelector('#meSearch'); if(ms){ ms.oninput=()=>{ meQuery=ms.value; const pos=ms.selectionStart; goStep(obStep); const m2=onbCard.querySelector('#meSearch'); m2.focus(); m2.setSelectionRange(pos,pos); }; }
  onbCard.querySelectorAll('[data-want]').forEach(b=>b.onclick=()=>{ const t=b.dataset.want; const i=obDraft.wants.indexOf(t); if(i>=0) obDraft.wants.splice(i,1); else obDraft.wants.push(t); goStep(obStep); });
  onbCard.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>{ const t=b.dataset.theme; const i=obDraft.themes.indexOf(t); if(i>=0) obDraft.themes.splice(i,1); else if(obDraft.themes.length<3) obDraft.themes.push(t); goStep(obStep); });
  if(!ms) onbCard.querySelector('.primary')?.focus({preventScroll:true});
}
function endOnboarding(keep){
  if(keep && (obDraft.cat||obDraft.themes.length||obDraft.wants.length)) profile={cat:obDraft.cat,themes:obDraft.themes.slice(),wants:obDraft.wants.slice()}; else profile=null;
  saveProfile();
  document.body.classList.remove('onboarding'); onb.hidden=true; obStep=-1;
  if(scattered) setScatter(false);
  if(!profile && viewMode!=='clusters') setView('clusters'); else if(profile && viewMode==='conv') setView('clusters');
  if(groupBy!=='cat'){ groupBy='cat'; }
  setTimeout(()=>{ layout(); renderHint(); renderDetail(); renderPopover(); const me=meOrg(); if(me&&viewMode==='lieu') LIEU.flyTo(me); },30);
}
let wheelLock=0;
canvas.addEventListener('wheel',e=>{ if(obStep<0) return; e.preventDefault(); e.stopPropagation(); const now=Date.now(); if(now-wheelLock<900||Math.abs(e.deltaY)<20) return; wheelLock=now; const can=!onbCard.querySelector('[data-next]')?.disabled; if(e.deltaY>0){ if(obStep===STEPS.length-1) endOnboarding(true); else if(can) goStep(obStep+1); } else goStep(obStep-1); },{passive:false,capture:true});
addEventListener('keydown',e=>{ if(obStep<0||e.target.matches('input')) return; if(e.key==='ArrowRight'||e.key==='Enter'){ const n=onbCard.querySelector('[data-next],[data-finish]'); if(n&&!n.disabled&&e.target.tagName!=='BUTTON') n.click(); } else if(e.key==='ArrowLeft'&&obStep>0) goStep(obStep-1); else if(e.key==='Escape') endOnboarding(true); });
applyNarrow(); renderLegend(); renderHint(); renderDetail(); layout(); renderPopover();
if(!profile) startOnboarding(0); else if(meOrg()&&viewMode==='clusters'){ /* profil connu : carte complète, sélection dans le panneau */ }
