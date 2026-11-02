/* Arc & Iron animated move demos.
   A stick figure plus the implement, posed by keyframes and solved with two-bone IK.
   Screen units: 240 x 270 viewBox, ground at y=250, figure ~185 tall, faces the viewer (face=1)
   or the right edge (face=0, side view). "L"/"R" are the figure's own sides, so in front view
   the figure's left limbs are on screen right, and in side view the left limbs are nearest you.
   Each move is a list of keyframes [seconds, pose]. A pose may leave things out; they carry over
   from the previous keyframe. `pass:true` keeps the motion flowing through that keyframe instead
   of easing to a stop. Add moves to MOVES and flows chain them automatically. */
(function(){
'use strict';
const NS='http://www.w3.org/2000/svg';
const TORSO=62,UARM=34,FARM=32,THIGH=46,SHIN=46,MACE=86,CLUB=58;

/* ---------- poses ---------- */
// Front view, mace at "12 o'clock": hands stacked at the chest, head of the mace straight up.
const F_FEET={L:[137,246],R:[103,246]};
const F_STAND={face:1,p:[120,156],lean:0,feet:F_FEET,g:[120,128],ang:-90,len:1,beh:0};
// Side view (facing right), mace held upright in front of the chest.
const S_FEET={L:[123,246],R:[117,246]};
const S_STAND={face:0,p:[120,156],lean:0,feet:S_FEET,g:[132,128],ang:-90,len:1,beh:0};

function lungeBack(side){ // side = the leg that steps back
  const back=side,front=side==='L'?'R':'L';
  const feet={};feet[back]=[36,246];feet[front]=[128,246];
  return [
    [0,S_STAND],
    [0.75,{p:[90,200],feet,g:[104,160],toe:back}],
    [1.05,{}],
    [1.75,Object.assign({},S_STAND,{toe:null})],
    [2.05,{}]
  ];
}

const MOVES={
  'mace:10-to-2':{view:'Front view',kf:[
    [0,F_STAND],
    [0.35,{g:[136,102],ang:-12,beh:0.6,pass:true}],
    [0.8,{g:[143,90],ang:100,beh:1}],
    [1.0,{}],
    [1.35,{g:[136,102],ang:-12,beh:0.4,pass:true}],
    [1.75,{g:[120,128],ang:-90,beh:0}],
    [2.1,{g:[104,102],ang:-168,beh:0.6,pass:true}],
    [2.55,{g:[97,90],ang:-280,beh:1}],
    [2.75,{}],
    [3.1,{g:[104,102],ang:-168,beh:0.4,pass:true}],
    [3.5,{g:[120,128],ang:-270,beh:0}],
    [3.8,{ang:-90}]
  ],cue:'Stack the hands and swing behind the back to each side, head centered.'},

  'mace:barbarian squat':{view:'Front view',kf:[
    [0,F_STAND],
    [0.45,{p:[120,172],g:[120,92],len:0.12,pass:true}],
    [0.45,{ang:90,beh:1,pass:true}],
    [0.95,{p:[120,200],g:[120,104],len:0.8}],
    [1.2,{}],
    [1.7,{p:[120,172],g:[120,88],len:0.12,pass:true}],
    [1.7,{ang:-90,beh:0,pass:true}],
    [2.15,{p:[120,156],g:[120,128],len:1}],
    [2.45,{}]
  ],cue:'Mace drops behind the head as you squat and returns as you stand.'},

  'mace:reverse lunge:left':{view:'Side view · left leg steps back',kf:lungeBack('L'),
    cue:'Step back softly; front shin stays near vertical. Mace stays upright at the chest.'},
  'mace:reverse lunge:right':{view:'Side view · right leg steps back',kf:lungeBack('R'),
    cue:'Step back softly; front shin stays near vertical. Mace stays upright at the chest.'}
};
// A plain "Reverse lunge" (no side given) shows both legs.
MOVES['mace:reverse lunge']={view:'Side view · alternate legs',kf:join([MOVES['mace:reverse lunge:left'],MOVES['mace:reverse lunge:right']]).kf,
  cue:MOVES['mace:reverse lunge:left'].cue};

/* ---------- names ---------- */
function key(name,eq){
  let n=String(name).toLowerCase().replace(/\s*[×x]\s*\d.*$/,'').replace(/\(.*?\)/g,'').trim();
  let side='';
  const m=n.match(/,?\s*\b(left|right)\b.*$/);if(m){side=m[1]==='left'?'left':'right';n=n.slice(0,m.index)}
  n=n.replace(/^(mace|steel mace)\s+/,'').replace(/[–—]/g,'-').replace(/\s+/g,' ').trim();
  if(side&&MOVES[eq+':'+n+':'+side])return eq+':'+n+':'+side;
  return MOVES[eq+':'+n]?eq+':'+n:null;
}
const PLAIN=/^(mirror|return|stand|switch hands|repeat|lower to rack)/i;
function flowKeys(flow){
  const ks=[];
  for(const s of flow.steps){if(PLAIN.test(s))continue;const k=key(s,flow.eq);if(!k)return null;ks.push([k,s])}
  return ks.length?ks:null;
}

/* ---------- timelines ---------- */
function resolve(kf){ // fill every keyframe with a complete pose
  let cur=null;
  return kf.map(([t,p])=>{cur=Object.assign({},cur||p,p);if(p.feet)cur.feet={L:p.feet.L.slice(),R:p.feet.R.slice()};
    if(!('pass' in p))cur.pass=false;return [t,cur]});
}
function join(moves,labels){ // chain moves; a short blend joins one to the next
  const out=[];const marks=[];let t0=0;
  moves.forEach((mv,i)=>{
    const kf=resolve(mv.kf);const off=i?t0+0.45:0;
    marks.push({t:off,label:labels?labels[i]:'',view:mv.view,cue:mv.cue});
    kf.forEach(([t,p])=>out.push([t+off,p]));
    t0=out[out.length-1][0];
  });
  return {kf:out,marks,dur:t0};
}

/* ---------- interpolation ---------- */
const lerp=(a,b,u)=>a+(b-a)*u;
const lp=(a,b,u)=>[lerp(a[0],b[0],u),lerp(a[1],b[1],u)];
function ease(u,stopA,stopB){
  if(stopA&&stopB)return u*u*(3-2*u);
  if(stopA)return u*u;
  if(stopB)return 1-(1-u)*(1-u);
  return u;
}
function poseAt(kf,t){
  if(t<=kf[0][0])return kf[0][1];
  for(let i=1;i<kf.length;i++){
    const [tb,b]=kf[i];if(t>tb)continue;const [ta,a]=kf[i-1];
    if(tb===ta)return b;
    const u=ease((t-ta)/(tb-ta),!a.pass,!b.pass);
    return {face:lerp(a.face,b.face,u),p:lp(a.p,b.p,u),lean:lerp(a.lean,b.lean,u),
      feet:{L:lp(a.feet.L,b.feet.L,u),R:lp(a.feet.R,b.feet.R,u)},g:lp(a.g,b.g,u),
      ang:lerp(a.ang,b.ang,u),len:lerp(a.len,b.len,u),beh:lerp(a.beh,b.beh,u),
      toe:u<0.5?a.toe:b.toe,impl:b.impl||a.impl};
  }
  return kf[kf.length-1][1];
}

/* ---------- IK ---------- */
function ik(root,tgt,a,b,score){
  let dx=tgt[0]-root[0],dy=tgt[1]-root[1];let d=Math.hypot(dx,dy)||1e-6;
  const max=a+b-0.01;let end=tgt;
  if(d>max){end=[root[0]+dx/d*max,root[1]+dy/d*max];dx=end[0]-root[0];dy=end[1]-root[1];d=max}
  const x=(a*a-b*b+d*d)/(2*d),h=Math.sqrt(Math.max(0,a*a-x*x));
  const ux=dx/d,uy=dy/d,mx=root[0]+ux*x,my=root[1]+uy*x;
  const j1=[mx-uy*h,my+ux*h],j2=[mx+uy*h,my-ux*h];
  return [score(j1)>=score(j2)?j1:j2,end];
}

/* ---------- drawing ---------- */
function el(tag,attrs,parent){const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e}
function build(svg){
  svg.setAttribute('viewBox','0 0 240 270');
  const g={};
  el('ellipse',{cx:120,cy:251,rx:58,ry:5,class:'dm-shadow'},svg);
  el('line',{x1:8,y1:250,x2:232,y2:250,class:'dm-ground'},svg);
  g.implBack=el('g',{},svg);
  g.far=el('g',{class:'dm-far'},svg);
  g.body=el('g',{class:'dm-body'},svg);
  g.near=el('g',{class:'dm-near'},svg);
  g.implFront=el('g',{},svg);
  const limb=(parent)=>({up:el('line',{},parent),lo:el('line',{},parent),foot:el('line',{},parent)});
  g.legR=limb(g.far);g.armR=limb(g.far);
  g.torso=el('line',{},g.body);g.shoulders=el('line',{},g.body);g.hips=el('line',{},g.body);
  g.head=el('circle',{r:12},g.body);g.face=el('circle',{r:2.4,class:'dm-eye'},g.body);
  g.legL=limb(g.near);g.armL=limb(g.near);
  g.impl={shaft:el('line',{class:'dm-shaft'}),head:el('circle',{class:'dm-ball'}),grip:el('line',{class:'dm-grip'})};
  return g;
}
function setLine(l,a,b){l.setAttribute('x1',a[0].toFixed(1));l.setAttribute('y1',a[1].toFixed(1));l.setAttribute('x2',b[0].toFixed(1));l.setAttribute('y2',b[1].toFixed(1))}
function draw(g,P){
  const f=P.face,side=1-f;
  const lean=P.lean*Math.PI/180;
  const neck=[P.p[0]+Math.sin(lean)*TORSO*(side),P.p[1]-Math.cos(lean)*TORSO];
  const headC=[neck[0]+side*3,neck[1]-17];
  const sh={L:[neck[0]+18*f,neck[1]+7],R:[neck[0]-18*f,neck[1]+7]};
  const hp={L:[P.p[0]+11*f,P.p[1]],R:[P.p[0]-11*f,P.p[1]]};
  setLine(g.torso,[P.p[0],P.p[1]-4],[neck[0],neck[1]+6]);setLine(g.shoulders,sh.R,sh.L);setLine(g.hips,hp.R,hp.L);
  g.torso.style.strokeWidth=(13+11*f).toFixed(1);
  g.far.style.opacity=(1-0.55*side).toFixed(2);
  g.head.setAttribute('cx',headC[0].toFixed(1));g.head.setAttribute('cy',headC[1].toFixed(1));
  g.face.setAttribute('cx',(headC[0]+7*side).toFixed(1));g.face.setAttribute('cy',(headC[1]-1).toFixed(1));
  g.face.style.opacity=side>0.5?1:0;
  const mid=P.p[0];
  // legs: knees out in front view, forward in side view
  for(const s of ['L','R']){
    const leg=s==='L'?g.legL:g.legR;const toes=P.toe===s;const ft=toes?[P.feet[s][0],P.feet[s][1]-6]:P.feet[s];
    let [knee,ank]=ik(hp[s],ft,THIGH,SHIN,j=>f*Math.abs(j[0]-mid)*0.6+side*j[0]-0.02*j[1]);
    // front view: the thigh points toward you, so the knee's sideways reach shrinks (foreshortening)
    const cx=(hp[s][0]+ank[0])/2;knee=[cx+(knee[0]-cx)*(1-0.6*f),knee[1]];
    setLine(leg.up,hp[s],knee);setLine(leg.lo,knee,ank);
    const fx=side*11+f*(s==='L'?5:-5);
    setLine(leg.foot,ank,toes?[ank[0]+fx*0.8,ank[1]+7]:[ank[0]+fx,ank[1]+2]);
  }
  // implement: hands stacked on the handle, R on the bottom
  const a=P.ang*Math.PI/180,dir=[Math.cos(a),Math.sin(a)];
  const hand={R:P.g,L:[P.g[0]+dir[0]*9*Math.max(P.len,0.4),P.g[1]+dir[1]*9*Math.max(P.len,0.4)]};
  for(const s of ['L','R']){
    const arm=s==='L'?g.armL:g.armR;
    const [elb,wr]=ik(sh[s],hand[s],UARM,FARM,j=>f*Math.abs(j[0]-mid)+side*(j[1]-j[0]*0.3));
    setLine(arm.up,sh[s],elb);setLine(arm.lo,elb,wr);arm.foot.style.display='none';
  }
  const L=MACE*P.len,tip=[P.g[0]+dir[0]*L,P.g[1]+dir[1]*L],butt=[P.g[0]-dir[0]*6,P.g[1]-dir[1]*6];
  // behind the body: drawn as a faded, dashed "ghost" so you can still follow its path
  const behind=P.beh>0.5,host=g.implFront;host.style.opacity=behind?'0.42':'1';
  host.classList.toggle('dm-behind',behind);
  for(const k of ['shaft','head','grip'])if(g.impl[k].parentNode!==host)host.appendChild(g.impl[k]);
  setLine(g.impl.shaft,butt,tip);setLine(g.impl.grip,butt,[P.g[0]+dir[0]*14,P.g[1]+dir[1]*14]);
  g.impl.head.setAttribute('cx',tip[0].toFixed(1));g.impl.head.setAttribute('cy',tip[1].toFixed(1));
  g.impl.head.setAttribute('r',(4+5*Math.max(P.len,0.35)).toFixed(1));
}

/* ---------- player ---------- */
function Player(svg,tl,onMark){
  const g=build(svg);let t=0,last=0,raf=0,playing=false,speed=1,mark=-1;
  const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  function render(){
    draw(g,poseAt(tl.kf,t));
    let m=0;for(let i=0;i<tl.marks.length;i++)if(t>=tl.marks[i].t)m=i;
    if(m!==mark){mark=m;onMark&&onMark(m,tl.marks[m])}
  }
  function frame(ts){
    if(!playing)return;const dt=last?Math.min((ts-last)/1000,0.1):0;last=ts;
    t+=dt*speed;if(t>tl.dur+0.5)t=0;render();raf=requestAnimationFrame(frame);
  }
  const api={
    play(){if(playing)return;playing=true;last=0;raf=requestAnimationFrame(frame);api.onstate&&api.onstate(true)},
    pause(){playing=false;cancelAnimationFrame(raf);api.onstate&&api.onstate(false)},
    toggle(){playing?api.pause():api.play()},
    get playing(){return playing},
    speed(s){speed=s},
    seek(s){t=Math.max(0,Math.min(s,tl.dur));render()},
    goto(i){api.seek(tl.marks[i].t)},
    destroy(){api.pause();svg.textContent=''},
    autoplay:!reduce,onstate:null
  };
  render();
  return api;
}

/* ---------- modal ---------- */
let dlg=null,player=null;
function ensureDialog(){
  if(dlg)return dlg;
  dlg=document.createElement('dialog');dlg.className='dm-dialog';dlg.setAttribute('aria-labelledby','dmTitle');
  dlg.innerHTML=`<div class="dm-head"><div><div class="eyebrow" id="dmEye">Demo</div><h3 id="dmTitle"></h3></div>
    <button class="dm-x" type="button" aria-label="Close demo">✕</button></div>
    <div class="dm-stage"><svg class="dm-svg" role="img" aria-labelledby="dmTitle dmCue"></svg><span class="dm-view" id="dmView"></span></div>
    <ol class="dm-steps" id="dmSteps" hidden></ol>
    <p class="dm-cue" id="dmCue"></p>
    <div class="dm-ctl"><button type="button" class="btn small" id="dmPlay">❚❚ Pause</button>
      <div class="seg dm-speed" role="group" aria-label="Speed"><button type="button" data-sp="0.5" aria-pressed="false">½×</button><button type="button" data-sp="1" aria-pressed="true">1×</button></div></div>
    <p class="hint">Animated guide to the path of the move. Train in clear space and stop a set when form fades.</p>`;
  document.body.appendChild(dlg);
  dlg.querySelector('.dm-x').onclick=()=>dlg.close();
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});
  dlg.addEventListener('close',()=>{if(player){player.destroy();player=null}});
  dlg.querySelector('#dmPlay').onclick=()=>player&&player.toggle();
  dlg.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{player&&player.speed(+b.dataset.sp);
    dlg.querySelectorAll('[data-sp]').forEach(x=>x.setAttribute('aria-pressed',x===b))});
  dlg.querySelector('#dmSteps').addEventListener('click',e=>{const b=e.target.closest('[data-i]');if(b&&player)player.goto(+b.dataset.i)});
  return dlg;
}
function show(title,eye,tl,stepNames){
  const d=ensureDialog();if(player)player.destroy();
  d.querySelector('#dmTitle').textContent=title;d.querySelector('#dmEye').textContent=eye;
  const steps=d.querySelector('#dmSteps');
  if(stepNames){steps.hidden=false;steps.innerHTML=stepNames.map((s,i)=>`<li><button type="button" data-i="${i}">${s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}</button></li>`).join('')}
  else{steps.hidden=true;steps.innerHTML=''}
  const svg=d.querySelector('.dm-svg');
  const playBtn=d.querySelector('#dmPlay');
  d.querySelectorAll('[data-sp]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.sp==='1'));
  player=Player(svg,tl,(i,m)=>{
    d.querySelector('#dmView').textContent=m.view||'';d.querySelector('#dmCue').textContent=m.cue||'';
    steps.querySelectorAll('button').forEach((b,j)=>b.setAttribute('aria-current',j===i?'step':'false'));
  });
  player.onstate=on=>{playBtn.textContent=on?'❚❚ Pause':'▶ Play'};
  if(!d.open)d.showModal();
  player.autoplay?player.play():player.onstate(false);
}

window.Demos={
  has:(name,eq)=>!!key(name,eq),
  hasFlow:flow=>!!flowKeys(flow),
  open(name,eq){const k=key(name,eq);if(!k)return false;const mv=MOVES[k];
    show(String(name).replace(/\s*[×x]\s*\d.*$/,''),'Move demo',join([mv]),null);return true},
  openFlow(flow,startStep){const ks=flowKeys(flow);if(!ks)return false;
    show(flow.name,'Flow demo',join(ks.map(k=>MOVES[k[0]]),ks.map(k=>k[1])),ks.map(k=>k[1]));
    if(startStep!=null&&player){const i=ks.findIndex(k=>k[1]===startStep);if(i>0)player.goto(i)}
    return true},
  // for previews and tests
  _Player:Player,_join:join,_MOVES:MOVES,_key:key,_poseAt:poseAt,_resolve:resolve
};
})();
