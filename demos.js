/* Arc & Iron animated move demos.
   Each move is posed once in 3D and drawn from two cameras at the same moment: a front view
   and a side view. Units are centimetres; x points to the figure's left, y up, z the way the
   figure faces. The side camera stands at the figure's right, so the figure faces screen right
   there and its right limbs are the near ones.
   A move is a list of keyframes [seconds, pose]. A pose may leave things out; they carry over
   from the keyframe before. `pass:true` keeps the motion flowing through a keyframe instead of
   easing to a stop there. Add moves to MOVES; flows chain them automatically. */
(function(){
'use strict';
const S=1,GY=268,TEMPO=1.25;            // px per cm, ground line, slow everything a touch
const TORSO=50,UARM=30,FARM=27,THIGH=44,SHIN=43,MACE=95,FOOT=17;
const CAM={
  front:{x:p=>120+p[0]*S,depth:p=>p[2],label:'Front'},
  side:{x:p=>140+p[2]*S,depth:p=>-p[0],label:'Side'}
};

/* ---------- vectors ---------- */
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
  mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  len=a=>Math.hypot(a[0],a[1],a[2]),norm=a=>{const l=len(a)||1e-9;return [a[0]/l,a[1]/l,a[2]/l]},
  lerp=(a,b,u)=>a+(b-a)*u,vl=(a,b,u)=>[lerp(a[0],b[0],u),lerp(a[1],b[1],u),lerp(a[2],b[2],u)],
  rotY=(v,deg)=>{const r=deg*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return [v[0]*c+v[2]*s,v[1],-v[0]*s+v[2]*c]};
const mx=v=>[-v[0],v[1],v[2]];          // mirror left <-> right

/* ---------- poses ---------- */
const STAND={P:[0,94,0],pitch:0,yaw:0,feet:{L:[12,8,0],R:[-12,8,0]},turn:8,tL:0,tR:0,
  G:[0,104,22],D:[0,1,0],eL:[1,-0.8,-0.3],eR:[-1,-0.8,-0.3],kneeOut:0.3};
// STAND is the upright hold: mace vertical, hands stacked at the belly button, right hand on the bottom.

function tenToTwo(){
  // Left hand on top, so the first swing goes to the side that hand points to (the right): over the
  // right shoulder, the head swings low behind the back while the hands pass over the head, over the
  // left shoulder, then back over the right shoulder and return to the upright hold.
  const shL={G:[14,135,14],D:[0.45,0.75,-0.48],eL:[1,-0.6,0],eR:[0,-1,0.5]};
  const q1={G:[10,163,4],D:[0.55,-0.45,-0.7],eL:[1,0,0.2],eR:[-0.5,-0.3,0.8],pass:true};
  const mid={G:[0,180,-2],D:[0,-0.92,-0.38],eL:[1,0.5,0.3],eR:[-1,0.5,0.3],pass:true};
  const q3={G:mx(q1.G),D:mx(q1.D),eL:[0.5,-0.3,0.8],eR:[-1,0,0.2],pass:true};
  const shR={G:mx(shL.G),D:mx(shL.D),eL:[0,-1,0.5],eR:[-1,-0.6,0]};
  const hold={G:STAND.G,D:STAND.D,eL:STAND.eL,eR:STAND.eR};
  return [[0,STAND],[0.25,{}],[0.75,shR],[0.9,{}],[1.2,q3],[1.5,mid],[1.8,q1],[2.15,shL],[2.3,{}],
    [2.6,q1],[2.9,mid],[3.2,q3],[3.55,shR],[3.7,{}],[4.2,hold],[4.45,{}]];
}
function barbarianSquat(){
  const wide={L:[16,8,0],R:[-16,8,0]};
  const up={P:[0,80,-6],pitch:12,feet:wide,turn:15,G:[0,150,14],D:[0,0.75,-0.66],eL:[1,0.2,0.5],eR:[-1,0.2,0.5],pass:true};
  return [[0,STAND],[0.5,up],[1.0,{P:[0,56,-14],pitch:28,G:[0,124,-4],D:[0,-0.9,-0.43]}],[1.3,{}],
    [1.8,up],[2.3,STAND],[2.6,{}]];
}
function reverseLunge(side){            // side = the leg that steps back
  const feet=side==='L'?{L:[12,15,-88],R:[-12,8,6]}:{L:[12,8,6],R:[-12,15,-88]};
  const bottom={P:[0,54,-36],pitch:5,feet,G:[0,64,-15],tL:side==='L'?1:0,tR:side==='R'?1:0};
  return [[0,STAND],[0.8,bottom],[1.1,{}],[1.9,STAND],[2.2,{}]];
}

const MOVES={
  'mace:10-to-2':{kf:tenToTwo(),
    cue:'From the upright hold, swing first to the side your top hand points to, the opposite side (left hand on top goes over the right shoulder). Then behind your back, over the other shoulder, back again, and return to the upright hold. Keep your head centered.'},
  'mace:barbarian squat':{kf:barbarianSquat(),
    cue:'From the upright hold, the mace drops behind your head as you squat and returns to the upright hold as you stand.'},
  'mace:reverse lunge:left':{kf:reverseLunge('L'),
    cue:'Left leg steps back. Front shin stays near vertical; the mace stays in the upright hold.'},
  'mace:reverse lunge:right':{kf:reverseLunge('R'),
    cue:'Right leg steps back. Front shin stays near vertical; the mace stays in the upright hold.'}
};
MOVES['mace:reverse lunge']={kf:join([MOVES['mace:reverse lunge:left'],MOVES['mace:reverse lunge:right']]).kf.map(([t,p])=>[t/TEMPO,p]),
  cue:'Alternate legs. Front shin stays near vertical; the mace stays in the upright hold.'};

/* ---------- names ---------- */
function key(name,eq){
  let n=String(name).toLowerCase().replace(/\s*[×x]\s*\d.*$/,'').replace(/\(.*?\)/g,'').trim();
  let side='';
  const m=n.match(/,?\s*\b(left|right)\b.*$/);if(m){side=m[1];n=n.slice(0,m.index)}
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
function resolve(kf){
  let cur=null;
  return kf.map(([t,p])=>{cur=Object.assign({},cur||p,p);if(!('pass' in p))cur.pass=false;return [t,cur]});
}
function join(moves,labels){              // chain moves with a short blend between them
  const out=[],marks=[];let t0=0;
  moves.forEach((mv,i)=>{
    const kf=resolve(mv.kf);const off=i?t0+0.4:0;
    marks.push({t:off,label:labels?labels[i]:'',cue:mv.cue});
    kf.forEach(([t,p])=>out.push([t*TEMPO+off,p]));
    t0=out[out.length-1][0];
  });
  return {kf:out,marks,dur:t0};
}
function ease(u,a,b){if(a&&b)return u*u*(3-2*u);if(a)return u*u;if(b)return 1-(1-u)*(1-u);return u}
function poseAt(kf,t){
  if(t<=kf[0][0])return kf[0][1];
  for(let i=1;i<kf.length;i++){
    const [tb,b]=kf[i];if(t>tb)continue;const [ta,a]=kf[i-1];
    if(tb===ta)return b;
    const u=ease((t-ta)/(tb-ta),!a.pass,!b.pass);
    return {P:vl(a.P,b.P,u),pitch:lerp(a.pitch,b.pitch,u),yaw:lerp(a.yaw,b.yaw,u),
      feet:{L:vl(a.feet.L,b.feet.L,u),R:vl(a.feet.R,b.feet.R,u)},turn:lerp(a.turn,b.turn,u),
      tL:lerp(a.tL,b.tL,u),tR:lerp(a.tR,b.tR,u),G:vl(a.G,b.G,u),D:norm(vl(a.D,b.D,u)),
      eL:vl(a.eL,b.eL,u),eR:vl(a.eR,b.eR,u),kneeOut:lerp(a.kneeOut,b.kneeOut,u)};
  }
  return kf[kf.length-1][1];
}

/* ---------- skeleton ---------- */
function ik(A,T,a,b,pole){
  let d=sub(T,A),dl=len(d);const max=a+b-0.01;
  if(dl>max){T=add(A,mul(d,max/dl));d=sub(T,A);dl=max}
  const u=mul(d,1/dl),x=(a*a-b*b+dl*dl)/(2*dl),h=Math.sqrt(Math.max(0,a*a-x*x));
  let bend=sub(pole,mul(u,dot(pole,u)));if(len(bend)<1e-4)bend=Math.abs(u[1])<0.9?[0,1,0]:[0,0,1];
  return [add(add(A,mul(u,x)),mul(norm(bend),h)),T];
}
function skeleton(p){
  const l=rotY([1,0,0],p.yaw),f0=rotY([0,0,1],p.yaw),r=p.pitch*Math.PI/180;
  const u=add(mul([0,1,0],Math.cos(r)),mul(f0,Math.sin(r))),f=sub(mul(f0,Math.cos(r)),mul([0,1,0],Math.sin(r)));
  const P=p.P,neck=add(P,mul(u,TORSO)),head=add(add(neck,mul(u,15)),mul(f,2));
  const sk={P,neck,head,u,f,l,f0};
  sk.sh={L:add(add(neck,mul(l,17)),mul(u,-4)),R:add(add(neck,mul(l,-17)),mul(u,-4))};
  sk.hip={L:add(P,mul(l,9)),R:add(P,mul(l,-9))};
  const at=(h,lat,fw)=>add(add(add(P,mul(u,h)),mul(l,lat)),mul(f,fw));
  sk.torso=[at(46,14,0),at(46,-14,0),at(36,15,0),at(36,-15,0),at(36,0,10),at(38,0,-9),
    at(18,10.5,0),at(18,-10.5,0),at(18,0,8),at(18,0,-9),at(2,12.5,0),at(2,-12.5,0),at(2,0,8),at(4,0,-10),at(-3,0,0)];
  for(const s of ['L','R']){
    const sg=s==='L'?1:-1,toe=s==='L'?p.tL:p.tR;
    const pole=norm(add(f0,mul(l,sg*p.kneeOut)));
    const [knee,ank]=ik(sk.hip[s],p.feet[s],THIGH,SHIN,pole);
    const h=rotY([sg*Math.sin(p.turn*Math.PI/180),0,Math.cos(p.turn*Math.PI/180)],p.yaw);
    const fd=norm(add(mul(h,1-0.3*toe),[0,-0.3-0.6*toe,0]));
    sk['knee'+s]=knee;sk['ank'+s]=ank;sk['toe'+s]=add(ank,mul(fd,FOOT));
  }
  sk.hand={R:p.G,L:add(p.G,mul(p.D,10))};
  for(const s of ['L','R']){const [elb,wr]=ik(sk.sh[s],sk.hand[s],UARM,FARM,norm(s==='L'?p.eL:p.eR));sk['elb'+s]=elb;sk['wr'+s]=wr}
  sk.butt=sub(p.G,mul(p.D,6));sk.tip=add(p.G,mul(p.D,MACE));sk.gripTop=add(p.G,mul(p.D,16));
  return sk;
}

/* ---------- drawing ---------- */
function hull(pts){
  pts=pts.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lo=[],up=[];
  for(const p of pts){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p)}
  for(let i=pts.length-1;i>=0;i--){const p=pts[i];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p)}
  return lo.slice(0,-1).concat(up.slice(0,-1));
}
const f1=n=>n.toFixed(1);
function scene(cam,sk,trail){
  const pr=p=>[cam.x(p),GY-p[1]*S],dz=cam.depth;
  const body=dz(add(sk.P,mul(sk.u,25)));
  const items=[];
  const seg=(a,b,w,cls)=>{const A=pr(a),B=pr(b),xy=`x1="${f1(A[0])}" y1="${f1(A[1])}" x2="${f1(B[0])}" y2="${f1(B[1])}"`;
    const halo=/dm-hid|dm-shaft/.test(cls)?'':`<line ${xy} stroke-width="${w+3.5}" class="dm-halo"/>`;
    items.push({z:(dz(a)+dz(b))/2,s:halo+`<line ${xy} stroke-width="${w}" class="${cls}"/>`})};
  const shade=(a,b)=>((dz(a)+dz(b))/2<body-5?'dm-f':'dm-n');
  // torso as one rounded shape
  const th=hull(sk.torso.map(pr));
  items.push({z:body,s:`<polygon points="${th.map(p=>f1(p[0])+','+f1(p[1])).join(' ')}" class="dm-torso"/>`});
  seg(sk.neck,add(sk.neck,mul(sk.u,8)),9,'dm-n');
  const H=pr(sk.head);items.push({z:dz(sk.head),s:`<circle cx="${f1(H[0])}" cy="${f1(H[1])}" r="11" class="dm-n dm-head dm-ring"/>`});
  for(const sg of [1,-1]){ // eyes, drawn only when they face this camera
    const e=add(add(add(sk.head,mul(sk.f,9.5)),mul(sk.l,sg*4)),mul(sk.u,2));
    if(dz(e)>dz(sk.head)+3){const E=pr(e);items.push({z:dz(e)+0.1,s:`<circle cx="${f1(E[0])}" cy="${f1(E[1])}" r="1.8" class="dm-eye"/>`})}
  }
  for(const s of ['L','R']){
    seg(sk.hip[s],sk['knee'+s],12,shade(sk.hip[s],sk['knee'+s]));
    seg(sk['knee'+s],sk['ank'+s],10,shade(sk['knee'+s],sk['ank'+s]));
    seg(sk['ank'+s],sk['toe'+s],7,shade(sk['ank'+s],sk['toe'+s]));
    seg(sk.sh[s],sk['elb'+s],9,shade(sk.sh[s],sk['elb'+s]));
    seg(sk['elb'+s],sk['wr'+s],8,shade(sk['elb'+s],sk['wr'+s]));
  }
  // mace, cut into pieces so each piece sorts in front of or behind the body on its own
  const N=8;
  for(let i=0;i<N;i++){const a=vl(sk.butt,sk.tip,i/N),b=vl(sk.butt,sk.tip,(i+1)/N);
    seg(a,b,4,'dm-shaft'+((dz(a)+dz(b))/2<body-6?' dm-hid':''))}
  seg(sk.butt,sk.gripTop,7,'dm-grip'+(dz(sk.butt)<body-6?' dm-hid':''));
  const T=pr(sk.tip);items.push({z:dz(sk.tip),s:`<circle cx="${f1(T[0])}" cy="${f1(T[1])}" r="8" class="dm-ball${dz(sk.tip)<body-6?' dm-hid':' dm-ring'}"/>`});
  items.sort((a,b)=>a.z-b.z);
  // ground, shadow and the path the mace head just travelled
  const px=cam.x(sk.P);
  let out=`<line x1="10" y1="${GY+1}" x2="230" y2="${GY+1}" class="dm-ground"/><ellipse cx="${f1(px)}" cy="${GY+2}" rx="44" ry="4" class="dm-shadow"/>`;
  for(let i=1;i<trail.length;i++){const A=pr(trail[i-1]),B=pr(trail[i]);
    out+=`<line x1="${f1(A[0])}" y1="${f1(A[1])}" x2="${f1(B[0])}" y2="${f1(B[1])}" class="dm-trail" stroke-opacity="${(0.55*i/trail.length).toFixed(2)}"/>`}
  return out+items.map(i=>i.s).join('');
}

/* ---------- player ---------- */
function Player(views,tl,onMark){
  // views: {front: <svg>, side: <svg>}
  for(const k in views)views[k].setAttribute('viewBox','0 0 240 280');
  let t=0,last=0,raf=0,playing=false,speed=1,mark=-1;
  const reduce=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  function render(){
    const sk=skeleton(poseAt(tl.kf,t));
    const trail=[];for(let i=12;i>=1;i--){const tt=t-i*0.035;if(tt<0)continue;const q=poseAt(tl.kf,tt);trail.push(add(q.G,mul(q.D,MACE)))}
    trail.push(sk.tip);
    for(const k in views)views[k].innerHTML=scene(CAM[k],sk,trail);
    let m=0;for(let i=0;i<tl.marks.length;i++)if(t>=tl.marks[i].t)m=i;
    if(m!==mark){mark=m;onMark&&onMark(m,tl.marks[m])}
    api.ontime&&api.ontime(t/tl.dur);
  }
  function frame(ts){
    if(!playing)return;const dt=last?Math.min((ts-last)/1000,0.1):0;last=ts;
    t+=dt*speed;if(t>tl.dur+0.6)t=0;render();raf=requestAnimationFrame(frame);
  }
  const api={
    play(){if(playing)return;playing=true;last=0;raf=requestAnimationFrame(frame);api.onstate&&api.onstate(true)},
    pause(){playing=false;cancelAnimationFrame(raf);api.onstate&&api.onstate(false)},
    toggle(){playing?api.pause():api.play()},
    get playing(){return playing},
    speed(s){speed=s},
    seek(s){t=Math.max(0,Math.min(s,tl.dur));render()},
    seekFrac(x){api.seek(x*tl.dur)},
    goto(i){api.seek(tl.marks[i].t)},
    destroy(){api.pause();for(const k in views)views[k].textContent=''},
    autoplay:!reduce,onstate:null,ontime:null
  };
  render();
  return api;
}

/* ---------- pop-up ---------- */
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let dlg=null,player=null;
function ensureDialog(){
  if(dlg)return dlg;
  dlg=document.createElement('dialog');dlg.className='dm-dialog';dlg.setAttribute('aria-labelledby','dmTitle');
  dlg.innerHTML=`<div class="dm-head"><div><div class="eyebrow" id="dmEye">Demo</div><h3 id="dmTitle"></h3></div>
    <button class="dm-x" type="button" aria-label="Close demo">✕</button></div>
    <div class="dm-views">
      <figure class="dm-pane"><svg class="dm-svg" id="dmFront" role="img" aria-label="Front view"></svg><figcaption>Front</figcaption></figure>
      <figure class="dm-pane"><svg class="dm-svg" id="dmSide" role="img" aria-label="Side view"></svg><figcaption>Side</figcaption></figure>
    </div>
    <input type="range" class="dm-scrub" id="dmScrub" min="0" max="1000" value="0" aria-label="Move through the demo">
    <ol class="dm-steps" id="dmSteps" hidden></ol>
    <p class="dm-cue" id="dmCue"></p>
    <div class="dm-ctl"><button type="button" class="btn small" id="dmPlay">❚❚ Pause</button>
      <div class="seg dm-speed" role="group" aria-label="Speed"><button type="button" data-sp="0.5" aria-pressed="false">½×</button><button type="button" data-sp="1" aria-pressed="true">1×</button></div></div>
    <p class="hint">Lighter limbs are on the far side of the body. A faded, dashed mace is behind the body. The thin trail shows the path the mace head just took.</p>`;
  document.body.appendChild(dlg);
  dlg.querySelector('.dm-x').onclick=()=>dlg.close();
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});
  dlg.addEventListener('close',()=>{if(player){player.destroy();player=null}});
  dlg.querySelector('#dmPlay').onclick=()=>player&&player.toggle();
  dlg.querySelector('#dmScrub').addEventListener('input',e=>{if(!player)return;player.pause();player.seekFrac(+e.target.value/1000)});
  dlg.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{player&&player.speed(+b.dataset.sp);
    dlg.querySelectorAll('[data-sp]').forEach(x=>x.setAttribute('aria-pressed',x===b))});
  dlg.querySelector('#dmSteps').addEventListener('click',e=>{const b=e.target.closest('[data-i]');if(b&&player)player.goto(+b.dataset.i)});
  return dlg;
}
function show(title,eye,tl,stepNames){
  const d=ensureDialog();if(player)player.destroy();
  d.querySelector('#dmTitle').textContent=title;d.querySelector('#dmEye').textContent=eye;
  const steps=d.querySelector('#dmSteps');
  if(stepNames){steps.hidden=false;steps.innerHTML=stepNames.map((s,i)=>`<li><button type="button" data-i="${i}">${esc(s)}</button></li>`).join('')}
  else{steps.hidden=true;steps.innerHTML=''}
  const playBtn=d.querySelector('#dmPlay'),scrub=d.querySelector('#dmScrub');
  d.querySelectorAll('[data-sp]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.sp==='1'));
  player=Player({front:d.querySelector('#dmFront'),side:d.querySelector('#dmSide')},tl,(i,m)=>{
    d.querySelector('#dmCue').textContent=m.cue||'';
    steps.querySelectorAll('button').forEach((b,j)=>b.setAttribute('aria-current',j===i?'step':'false'));
  });
  player.onstate=on=>{playBtn.textContent=on?'❚❚ Pause':'▶ Play'};
  player.ontime=x=>{scrub.value=Math.round(x*1000)};
  if(!d.open)d.showModal();
  player.autoplay?player.play():player.onstate(false);
}

window.Demos={
  has:(name,eq)=>!!key(name,eq),
  hasFlow:flow=>!!flowKeys(flow),
  open(name,eq){const k=key(name,eq);if(!k)return false;
    show(String(name).replace(/\s*[×x]\s*\d.*$/,''),'Move demo',join([MOVES[k]]),null);return true},
  openFlow(flow){const ks=flowKeys(flow);if(!ks)return false;
    show(flow.name,'Flow demo',join(ks.map(k=>MOVES[k[0]]),ks.map(k=>k[1])),ks.map(k=>k[1]));return true},
  // for previews and tests
  _Player:Player,_join:join,_MOVES:MOVES,_key:key,_poseAt:poseAt,_skeleton:skeleton
};
})();
