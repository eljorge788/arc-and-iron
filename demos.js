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
const S=0.84,GY=268,TEMPO=1.25;            // px per cm, ground line, slow everything a touch
const TORSO=50,UARM=30,FARM=27,THIGH=44,SHIN=43,MACE=95,CLUB=62,FOOT=17;
const REACH1=55.5;   // locked-arm reach of one hand from its shoulder (two hands: the farther arm straight, see reachB)
const CAM={
  front:{x:p=>120+p[0]*S,depth:p=>p[2],label:'Front'},
  side:{x:p=>136+p[2]*S,depth:p=>-p[0],label:'Side'}
};

/* ---------- vectors ---------- */
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
  mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  len=a=>Math.hypot(a[0],a[1],a[2]),norm=a=>{const l=len(a)||1e-9;return [a[0]/l,a[1]/l,a[2]/l]},
  lerp=(a,b,u)=>a+(b-a)*u,vl=(a,b,u)=>[lerp(a[0],b[0],u),lerp(a[1],b[1],u),lerp(a[2],b[2],u)],
  rotY=(v,deg)=>{const r=deg*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return [v[0]*c+v[2]*s,v[1],-v[0]*s+v[2]*c]};
const mx=v=>[-v[0],v[1],v[2]];          // mirror left <-> right

/* ---------- poses ---------- */
const STAND={P:[0,94,0],pitch:0,yaw:0,roll:0,hipYaw:0,feet:{L:[12,8,0],R:[-12,8,0]},turn:8,fyL:0,fyR:0,tL:0,tR:0,
  G:[0,104,22],D:[0,1,0],gR:0,gL:10,choke:6,len:MACE,offL:0,offR:0,freeL:[20,92,4],freeR:[-20,92,4],
  eL:[1,-0.8,-0.3],eR:[-1,-0.8,-0.3],kneeOut:0.3,kb:0,W:[1,0,0],hR:-4.5,hL:4.5,hD:0};
// Kettlebell (kb:1): G is the middle of the handle and D points from the handle to the centre of the bell.
// W runs along the handle toward the figure's left. Each hand sits at G + D*hD + W*hR (or hL): side by
// side on the handle with hD 0, or on the horns with hD about 5.
// Pose fields: P pelvis, pitch (forward lean, deg), yaw (torso turn, + toward the figure's left),
// hipYaw, feet (ankle points), turn (toe-out), fyL/fyR (extra foot pivot), tL/tR (0..1 up on the toes),
// G (reference point on the shaft) and D (shaft direction, toward the head), gR/gL (where each hand
// sits along the shaft from G), choke (cm from the butt end to G), offL/offR (0..1 hand off the mace,
// moving to freeL/freeR), eL/eR and kneeOut (which way elbows and knees bend), len (implement length:
// MACE or CLUB; a club is drawn as a short handle that swells toward the end).

/* helpers for writing moves */
function torsoFrame(P,pitch,yaw,roll=0,twist=0){
  let l=rotY([1,0,0],yaw);const f0=rotY([0,0,1],yaw),r=pitch*Math.PI/180;
  let u=add(mul([0,1,0],Math.cos(r)),mul(f0,Math.sin(r)));let f=sub(mul(f0,Math.cos(r)),mul([0,1,0],Math.sin(r)));
  if(roll){const q=roll*Math.PI/180,c=Math.cos(q),s=Math.sin(q);const u2=add(mul(u,c),mul(l,s));l=sub(mul(l,c),mul(u,s));u=u2}
  // twist: the chest turns about the spine (positive drops the left shoulder toward the chest side)
  if(twist){const q=twist*Math.PI/180,c=Math.cos(q),s=Math.sin(q);const l2=add(mul(l,c),mul(f,s));f=sub(mul(f,c),mul(l,s));l=l2}
  return {l,u,f,f0};
}
// a point fixed to the torso: lat toward the figure's left, h up the spine from the pelvis, fw forward
function onBody(pose,lat,h,fw){const F=torsoFrame(pose.P,pose.pitch||0,pose.yaw||0,pose.roll||0,pose.twist||0);
  return add(add(add(pose.P,mul(F.l,lat)),mul(F.u,h)),mul(F.f,fw))}
// upright hold placed on the body (belly button) for whatever the hips and torso are doing
const hold=pose=>Object.assign({G:onBody(pose,0,10,22),D:[0,1,0],eL:STAND.eL,eR:STAND.eR},pose);
// mirror a pose left <-> right; grip:true also swaps which hand is on top
function mirror(p,grip=true){
  const o=Object.assign({},p),sw=(a,b,f)=>{if(a in p||b in p){const A=p[a],B=p[b];if(B!==undefined)o[a]=f(B);else delete o[a];if(A!==undefined)o[b]=f(A);else delete o[b]}};
  const id=v=>v,neg=v=>-v;
  for(const k of ['P','G','D'])if(p[k])o[k]=mx(p[k]);
  if('yaw' in p)o.yaw=-p.yaw;if('hipYaw' in p)o.hipYaw=-p.hipYaw;if('roll' in p)o.roll=-p.roll;if('twist' in p)o.twist=-p.twist;
  if(p.feet)o.feet={L:mx(p.feet.R),R:mx(p.feet.L)};
  sw('eL','eR',mx);sw('freeL','freeR',mx);if(grip){sw('gL','gR',id);sw('offL','offR',id)}sw('tL','tR',id);sw('fyL','fyR',neg);
  if(p.W)o.W=mx(p.W);sw('hL','hR',id);
  if(p.lock==='R')o.lock='L';else if(p.lock==='L')o.lock='R';
  return o;
}
const mirrorKF=(kf,grip=true)=>kf.map(([t,p])=>[t,mirror(p,grip)]);
// play keyframe lists one after another
function chain(...parts){
  const out=[];let t0=0;
  parts.forEach((kf,i)=>{const off=i?t0+0.1:0;kf.forEach(([t,p])=>out.push([t+off,p]));t0=out[out.length-1][0]});
  return out;
}
const both=(kf,grip=true)=>chain(kf,mirrorKF(kf,grip));
// swap which hand is on top without moving anything. The lead side is the top hand, and a two-hand club
// is held on the top hand's side of the body, so a move built with the club on the right takes the
// right hand on top; both() then gives the left side with the left hand on top.
const topSwap=kf=>kf.map(([t,p])=>{const o=Object.assign({},p);
  if('gL' in p||'gR' in p){o.gL=p.gR;o.gR=p.gL;if(o.gL===undefined)delete o.gL;if(o.gR===undefined)delete o.gR}
  if('offL' in p||'offR' in p){o.offL=p.offR;o.offR=p.offL;if(o.offL===undefined)delete o.offL;if(o.offR===undefined)delete o.offR}
  return [t,o]});
const shaft=(G,tip)=>norm(sub(tip,G));
// in-between keyframes that move the mace by its head (the working hand), not by its base, so a hand
// sliding along the shaft follows a sensible path. a and b must be full poses.
function viaHead(a,b,n,dt){
  const headOf=p=>add(p.G,mul(p.D,Math.max(p.gL,p.gR)));
  const ha=headOf(a),hb=headOf(b),out=[];
  for(let i=1;i<n;i++){const u=i/n,o={};
    for(const k of ['pitch','yaw','roll','twist','hipYaw','turn','kneeOut','gL','gR','choke','tL','tR','fyL','fyR'])if(k in a&&k in b)o[k]=lerp(a[k],b[k],u);
    o.P=vl(a.P,b.P,u);o.feet={L:vl(a.feet.L,b.feet.L,u),R:vl(a.feet.R,b.feet.R,u)};o.eL=vl(a.eL,b.eL,u);o.eR=vl(a.eR,b.eR,u);
    o.D=norm(vl(a.D,b.D,u));const h=vl(ha,hb,u);o.G=sub(h,mul(o.D,Math.max(o.gL,o.gR)));o.pass=true;
    out.push([dt*u,o]);}
  return out;
}   // direction from the hands toward where the head should be
// wide grip: one hand on the base, the working hand right at the head. Places the shaft through both
// hands and slides the butt so the head sits just past the working hand.
function wide(base,head,work='R',extra){
  const d=len(sub(head,base)),o={G:base,D:norm(sub(head,base)),choke:Math.max(0,MACE-d-6)};
  if(work==='R'){o.gL=0;o.gR=d}else{o.gR=0;o.gL=d}
  return Object.assign(o,{offL:0,offR:0},extra||{});
}
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
  // Standing pullover: the mace goes back over the head and hangs behind the back, then comes back over
  // the top all the way into the upright hold in front. Only then squat, and stand with it there.
  const wide2={L:[16,8,0],R:[-16,8,0]};
  const pull={G:[0,160,14],D:norm([0,0.5,-0.87]),eL:[1,0.3,0.4],eR:[-1,0.3,0.4],pass:true};
  const behind={G:[0,176,-4],D:norm([0,-0.92,-0.38]),eL:[1,0.6,0.3],eR:[-1,0.6,0.3]};
  const over={G:[0,166,10],D:norm([0,0.6,-0.8]),eL:[1,0.3,0.4],eR:[-1,0.3,0.4],pass:true};
  const front=Object.assign({},STAND,{feet:wide2,turn:15});
  const bottom=hold({P:[0,56,-14],pitch:22,yaw:0,feet:wide2,turn:15});
  return [[0,STAND],[0.5,pull],[0.9,behind],[1.1,{}],[1.5,over],[1.95,front],[2.1,{}],[2.8,bottom],[3.05,{}],
    [3.75,front],[3.9,{}],[4.2,Object.assign({},STAND)],[4.4,{}]];
}

// A step for the lunges: in-between poses from a to b in which the stepping foot (leg 'L' or 'R') leaves the
// floor, travels and lands, so the step reads as a step and not a slide. down: the foot lands before the body
// lowers; otherwise (coming back up) the body rises as the foot comes back. Returns keyframes between t0 and t1.
function stepKF(a,b,t0,t1,leg,down,lift=20){
  const L=(x,y,u)=>x+(y-x)*u,V=(x,y,u)=>[L(x[0],y[0],u),L(x[1],y[1],u),L(x[2],y[2],u)];
  const mid=f=>{
    const fb=down?f*f:1-(1-f)*(1-f),o={pass:true};
    for(const k of new Set(Object.keys(a).concat(Object.keys(b)))){
      if(k==='pass'||k==='feet')continue;
      const x=k in a?a[k]:b[k],y=k in b?b[k]:a[k];
      if(Array.isArray(x)&&x.length===3)o[k]=(k==='D'||k==='W'||k[0]==='e')?norm(V(x,y,fb)):V(x,y,fb);
      else if(typeof x==='number'&&typeof y==='number')o[k]=L(x,y,fb);
      else o[k]=y;
    }
    const fa=a.feet||STAND.feet,fz=b.feet||STAND.feet;
    o.feet={L:V(fa.L,fz.L,f),R:V(fa.R,fz.R,f)};o.feet[leg]=add(o.feet[leg],[0,lift*Math.sin(Math.PI*f),0]);
    o['t'+leg]=0;
    return o;
  };
  return [0.3,0.65].map(f=>[L(t0,t1,f),mid(f)]);
}
function reverseLunge(side){            // side = the leg that steps back
  const feet=side==='L'?{L:[12,15,-88],R:[-12,8,6]}:{L:[12,8,6],R:[-12,15,-88]};
  const bottom=Object.assign({},STAND,{P:[0,54,-36],pitch:5,feet,G:[0,64,-15],tL:side==='L'?1:0,tR:side==='R'?1:0});
  return [[0,STAND]].concat(stepKF(STAND,bottom,0,0.8,side,true),[[0.8,bottom],[1.1,{}]],stepKF(bottom,STAND,1.1,1.9,side,false),[[1.9,STAND],[2.2,{}]]);
}

function frontSquat(){
  // mace pressed out in front, still vertical, held there through the squat
  const out=pose=>Object.assign({G:onBody(pose,0,28,44),D:[0,1,0],eL:[1,-0.6,-0.4],eR:[-1,-0.6,-0.4]},pose);
  const wide={L:[16,8,0],R:[-16,8,0]};
  const top=out({P:STAND.P,pitch:0,yaw:0,feet:wide,turn:15});
  const bottom=out({P:[0,56,-14],pitch:22,yaw:0,feet:wide,turn:15});
  return [[0,STAND],[0.55,top],[0.7,{}],[1.5,bottom],[1.75,{}],[2.55,top],[2.7,{}],[3.2,Object.assign({},STAND)],[3.4,{}]];
}
function lateralLunge(){
  // Upright hold, step out wide. Shift well over one bent leg with the other locked straight; the top hand
  // slides to the head and punches it down to finish low and parallel, almost alongside the straight leg.
  // To change sides, rise to the wide centered stance and prayer-switch at the head in one motion as the
  // other hand punches down to the other side. Feet stay wide throughout.
  const feet={L:[48,8,0],R:[-48,8,0]};
  const P=[38,44,-14],hipR=[P[0]-9,P[1],P[2]],legDir=shaft(hipR,feet.R);
  const base=add(add(hipR,mul(sub(feet.R,hipR),0.05)),[0,4,12]),head=add(base,mul(legDir,56));
  // bent left, straight right leg: right hand on the head
  const punchL=Object.assign({P,pitch:33,roll:-25,yaw:0,feet,turn:14,kneeOut:0.1,eL:[1,-0.8,0],eR:[-0.6,-0.8,0.3]},wide(base,head,'R'));
  const punchR=mirror(punchL);               // bent right, straight left leg: left hand on the head
  const c=wide([0,40,34],[0,118,30],'R');
  const center=Object.assign({P:[0,82,0],pitch:0,yaw:0,roll:0,feet,turn:14,kneeOut:0.3,eL:[1,-1,0.2],eR:[-1,-1,0.2],pass:true},c,{gL:c.gR-4,pass:true});
  const wideHold=Object.assign(hold({P:[0,82,0],pitch:0,yaw:0,roll:0,feet,turn:14}),{gL:10,gR:0,choke:6,offL:0,offR:0});
  const full=p=>Object.assign({},STAND,p);
  const pR=full(punchR),pL=full(punchL),ctr=full(center);
  const leg=(a,b,t0,dt)=>viaHead(a,b,3,dt).map(([t,p])=>[t0+t,p]);
  const wideHoldF=Object.assign({},STAND,wideHold),halfOut=Object.assign({},STAND,{feet:{L:[48,8,0],R:[-12,8,0]},P:[10,93,0]});
  const halfIn=Object.assign({},wideHoldF,{feet:{L:[12,8,0],R:[-48,8,0]},P:[-10,88,0]});
  return [[0,STAND]].concat(stepKF(STAND,halfOut,0,0.35,'L',true,16),[[0.35,Object.assign({},halfOut,{pass:true})]],
    stepKF(halfOut,wideHoldF,0.35,0.7,'R',true,16),[[0.7,wideHold],[0.9,{}],[1.7,punchR],[1.95,{}]])
    .concat(leg(pR,ctr,1.95,0.6),[[2.55,center]],leg(ctr,pL,2.55,0.6),[[3.15,punchL],[3.4,{}]])
    .concat(leg(pL,ctr,3.4,0.6),[[4.0,center]],leg(ctr,pR,4.0,0.6),[[4.6,punchR],[4.85,{}]])
    .concat([[5.5,wideHold],[5.7,{}]],stepKF(wideHoldF,halfIn,5.7,6.05,'L',false,16),[[6.05,Object.assign({},halfIn,{pass:true})]],
      stepKF(halfIn,STAND,6.05,6.4,'R',false,16),[[6.4,Object.assign({},STAND)],[6.6,{}]]);
}
function frontLunge(){
  // left foot steps forward; front shin near vertical; then the right
  const bottom=hold({P:[0,54,26],pitch:4,yaw:0,feet:{L:[12,8,72],R:[-12,15,-18]},tR:1});
  const top=Object.assign({},STAND,{tR:0}),low=Object.assign({},STAND,bottom);
  const L=[[0,STAND]].concat(stepKF(STAND,low,0,0.8,'L',true),[[0.8,bottom],[1.1,{}]],stepKF(low,top,1.1,1.9,'L',false),[[1.9,top]]);
  return both(L.concat([[2.0,{}]]),false);
}

function threeSixty(){
  // Left hand on top. Elbows stay vertical and tight to the head the whole time.
  // Vertical press just off to the right, pull over the right shoulder, the head circles low behind
  // the back, comes up over the left shoulder, and finishes in a vertical press just off to the left.
  const up=[-0.3,1,0.15],upL=[0.3,1,0.15];
  const pressR={G:[-9,150,18],D:norm([-0.1,1,0]),eL:[0.4,-1,0.4],eR:[-0.4,-1,0.4]};
  const overR={G:[-7,172,-4],D:norm([-0.3,0.35,-0.88]),eL:upL,eR:up,pass:true};
  const behindR={G:[-3,175,-6],D:norm([-0.45,-0.55,-0.7]),eL:upL,eR:up,pass:true};
  const low={G:[0,176,-6],D:norm([0,-0.92,-0.38]),eL:upL,eR:up,pass:true};
  const behindL={G:[3,175,-6],D:norm([0.45,-0.55,-0.7]),eL:upL,eR:up,pass:true};
  const overL={G:[7,172,-4],D:norm([0.3,0.35,-0.88]),eL:upL,eR:up,pass:true};
  const pressL={G:[9,150,18],D:norm([0.1,1,0]),eL:[0.4,-1,0.4],eR:[-0.4,-1,0.4]};
  return [[0,STAND],[0.25,{}],[0.65,pressR],[0.8,{}],[1.1,overR],[1.35,behindR],[1.6,low],[1.85,behindL],[2.1,overL],
    [2.45,pressL],[2.6,{}],[3.0,{G:STAND.G,D:STAND.D,eL:STAND.eL,eR:STAND.eR}],[3.2,{}]];
}

function pendulum(){
  // choked up, arms long, head hanging down in front; small side-to-side arcs
  const hang={G:[0,101,24],D:[0,-1,0.1],choke:32,gL:7,eL:[1,-0.6,-0.4],eR:[-1,-0.6,-0.4]};
  const tip={G:[0,104,30],D:[0,0.1,1],choke:20,pass:true};
  const sw=x=>({G:[-x*0.12,102,24],D:norm([x,-0.9,0.08])});
  return [[0,STAND],[0.4,tip],[0.8,hang],[1.25,sw(0.42)],[1.75,sw(-0.42)],[2.25,sw(0.42)],[2.75,sw(-0.42)],
    [3.15,hang],[3.55,tip],[3.95,{G:STAND.G,D:STAND.D,choke:6,gL:10,pass:false}],[4.2,{}]];
}
function gravedigger(){
  // left: shovel grip, load over the right shoulder, dig the head down to the floor by the left foot
  const grip={gR:0,gL:22};
  const loadG=[8,116,22];
  const load=Object.assign({P:[0,92,-2],yaw:-20,hipYaw:-10,feet:{L:[18,8,6],R:[-18,8,-4]},turn:12,
    G:loadG,D:norm([-0.6,0.74,-0.33]),eL:[0.3,-1,0.4],eR:[-0.6,-1,0.2],tR:0,fyR:0},grip);
  const dP=[0,80,-4],dPitch=30,dYaw=28;
  const digG=onBody({P:dP,pitch:dPitch,yaw:dYaw},-10,18,18);
  const dig={P:dP,pitch:dPitch,yaw:dYaw,hipYaw:18,G:digG,D:shaft(digG,[44,12,46]),eL:[1,-0.4,0.5],eR:[-0.8,-0.8,0],tR:0.6,fyR:35};
  const swing={P:[0,84,-4],pitch:18,yaw:8,hipYaw:4,G:[2,104,36],D:norm([0.3,-0.35,0.9]),pass:true};
  return [[0,STAND],[0.45,Object.assign({},STAND,grip,{pass:true})],[0.9,load],[1.1,{}],[1.55,swing],[1.95,dig],[2.25,{}],
    [2.65,Object.assign({},swing,{tR:0.3,fyR:15})],[3.05,Object.assign({},load,{tR:0,fyR:0})],[3.25,{}],
    [3.75,Object.assign({},STAND)],[3.95,{}]];
}
function uppercut(){
  // Wide grip, right side working (right hand on the head). Horizontal along the right side with the head
  // toward the rear; the hips and shoulders turn it through a diagonal in front of the body (head up) to
  // horizontal along the left side; then back down the same way.
  const pose=(yaw,pitch,base,head,extra)=>Object.assign({P:[0,90,-2],pitch,yaw,hipYaw:yaw*0.5,feet:{L:[16,8,4],R:[-16,8,-4]},turn:12,
    eL:[1,-0.8,-0.2],eR:[-1,-0.8,-0.2]},wide(base,head,'R'),extra||{});
  // start low and level along the right side, head to the rear; through a diagonal in front with the
  // head low; finish level and high along the left side
  const start=pose(-30,8,[-20,104,44],[-32,92,-36]);
  const mid=Object.assign(pose(-10,16,[16,136,22],[-20,84,30],{pass:true}),{P:[0,88,-3]});
  const end=Object.assign(pose(30,0,[30,162,-50],[18,164,20],{tR:0.4,fyR:24,eL:[1,0,-0.3],eR:[-0.6,-0.6,0.4]}),{P:[0,92,0]});
  const swing=Object.assign(pose(-22,12,[-4,122,40],[-30,88,-4],{pass:true}),{P:[0,89,-3]});
  const back=Object.assign({},mid,{tR:0.15,fyR:8});
  const home=Object.assign({},STAND,{tR:0,fyR:0});
  const st=Object.assign({},start,{tR:0,fyR:0}),sw2=Object.assign({},swing,{tR:0,fyR:0});
  const reps=[[0,st],[0.2,{}],[0.4,swing],[0.6,mid],[0.95,end],[1.15,{}],[1.5,back],[1.7,sw2],[1.9,st],[2.1,{}],
    [2.3,swing],[2.5,mid],[2.85,end],[3.05,{}],[3.4,back],[3.6,sw2],[3.8,st],[4.0,{}]];
  // sword switch: the base hand lets go; the head hand, overhand, drives the mace forward like a sword
  // thrust; the other hand catches it at the head and carries it down to the start on the other side
  const thrustAt=[0,118,46],baseFwd=[2,116,116];
  const thrust=Object.assign({P:[0,92,0],pitch:0,yaw:0,hipYaw:0,tR:0,fyR:0,eL:[1,-0.5,-0.2],eR:[-1,-0.5,-0.2]},wide(baseFwd,thrustAt,'R',{offL:1}));
  const caught=Object.assign({},thrust,{offL:0,gL:thrust.gR});
  const handed=Object.assign({},caught,{offR:1});
  const lowR=Object.assign({},st,{offL:1});
  const lowL=mirror(Object.assign({},st,{offL:1}));
  const sword=[[0,lowR],[0.5,thrust],[0.7,caught],[0.85,handed],[1.35,lowL],[1.55,mirror(st)]];
  return chain([[0,STAND],[0.6,start]],reps.slice(1).map(([t,p])=>[t-0.2+0.2,p]),sword,mirrorKF(reps).slice(1),
    [[0,Object.assign({},home)],[0.25,{}]]);
}

function paddle(){
  // Like an oar on the low-hand side only. Left hand low and overhand near the head, right hand on the
  // end of the handle; three strokes front to back along the left, then a sword switch to the right side.
  const grip={gR:0,gL:62,offL:0,offR:0};
  const bend=[1,-0.6,0.2],bendR=[-1,-0.4,0.4];
  const at=(pitch,yaw,G,tip,extra)=>Object.assign({P:[0,80,-pitch/3],pitch,yaw,G,D:shaft(G,tip),eL:bend,eR:bendR},extra||{});
  const catchL=at(34,26,[6,126,16],[34,14,40],grip);
  const finishL=at(10,-6,[0,126,16],[34,14,-24]);
  const recoverL=at(22,10,[4,130,20],[30,40,10],{pass:true});
  const strokes=K=>[[0,K.c],[0.8,K.f],[1.15,K.r],[1.5,K.c],[2.3,K.f],[2.65,K.r],[3.0,K.c],[3.8,K.f]];
  const left=strokes({c:catchL,f:finishL,r:recoverL});
  const right=mirrorKF(left);              // hands trade jobs: right hand low near the head, left on the end
  // sword switch: top hand lets go, the low hand drives the mace forward like a sword thrust, the other
  // hand catches it there and carries it down to the start on the other side
  const thrustL=[6,118,46],dirL=norm([0,-0.05,-1]);
  const lowL=at(22,4,[4,126,16],[34,16,4],{offR:1});
  const thrust={P:[0,90,0],pitch:0,yaw:0,G:sub(thrustL,mul(dirL,62)),D:dirL,gL:62,gR:62,offR:1,offL:0,eL:[1,-0.5,-0.2],eR:[-1,-0.5,-0.2]};
  const caught=Object.assign({},thrust,{offR:0});
  const handed=Object.assign({},caught,{offL:1});
  const sword=[[0,lowL],[0.55,thrust],[0.75,caught],[0.9,handed]];
  const startR=mirror(catchL);
  return chain([[0,STAND],[0.6,catchL]],left,sword.concat([[1.45,mirror(lowL)],[1.85,startR]]),right.slice(1).map(([t,p])=>[t-0.7,p]),
    [[0,Object.assign({},STAND,{offL:0,offR:0})],[0.25,{}]]);
}

function handSwitches(){
  // Wide grip: right hand on the head out level to the right, left hand on the base. The head travels
  // level to the center while the base swings down and the left hand slides up the shaft to meet the right
  // at the head (prayer). Then the left hand carries the head out level to the left while the right hand
  // slides down to the base. The head stays at the same height the whole time.
  const H=124,X=52,SP=84,N=4;
  const at=(k,dir)=>{                         // k: 0 at the side .. 1 at the center
    const th=k*Math.PI/2,head=[dir*X*(1-k),H,24+6*k];
    const D=norm([dir*Math.cos(th),Math.sin(th),-0.04*k]);
    const G=sub(head,mul(D,SP));
    const o={G,D,choke:MACE-SP-6,eL:[1,-0.8,-0.1],eR:[-1,-0.8,-0.1],pass:k>0&&k<1};
    if(dir<0){o.gR=SP;o.gL=SP*0.95*k}else{o.gL=SP;o.gR=SP*0.95*k}
    return o;
  };
  const toCenter=(dir,t0)=>{const out=[];for(let i=0;i<=N;i++)out.push([t0+0.6*i/N,at(i/N,dir)]);return out};
  const fromCenter=(dir,t0)=>{const out=[];for(let i=N;i>=0;i--)out.push([t0+0.6*(N-i)/N,at(i/N,dir)]);return out};
  // center pose: both hands on the head; the centers from each side are the same place
  const seq=[[0,STAND],[0.6,at(0,-1)],[0.8,{}]]
    .concat(toCenter(-1,0.8).slice(1)).concat(fromCenter(1,1.4).slice(1)).concat([[2.2,{}]])
    .concat(toCenter(1,2.2).slice(1)).concat(fromCenter(-1,2.8).slice(1)).concat([[3.6,{}]])
    .concat([[4.2,Object.assign({},STAND)],[4.4,{}]]);
  return seq;
}

function offsetPress(){
  // mace horizontal with the head out to the left; pressed from the clean-rack position to overhead
  const rack={G:[-10,132,18],D:[1,0,0.04],eL:[0.6,-1,0],eR:[-1,-1,0]};
  const tilt={G:[-6,122,24],D:norm([0.7,0.7,0.1]),pass:true};
  const top={G:[-10,190,6],D:[1,0,0.02],eL:[1,0.2,-0.2],eR:[-1,0.2,-0.2]};
  const one=[[0,STAND],[0.35,tilt],[0.7,rack],[0.95,{}],[1.55,top],[1.8,{}],[2.4,rack],[2.6,{}],[3.2,top],[3.45,{}],
    [4.05,rack],[4.25,{}],[4.6,tilt],[4.95,{G:STAND.G,D:STAND.D,eL:STAND.eL,eR:STAND.eR}],[5.1,{}]];
  return both(one);
}
function curl(sw){
  // Wide grip: the working hand (right) holds the head, the left hand the base. The shaft runs from
  // the left chest down to the right thigh; the right hand curls nearly straight up to the front of the
  // shoulder while the base swings out to the left.
  const low=wide([30,140,26],[-20,88,22],'R',{eL:[1,-1,0],eR:[-0.4,-1,-0.2]});
  const top=wide([50,128,22],[-20,132,26],'R',{eL:[1,-1,0],eR:[-0.4,-1,0.3]});
  const home={G:STAND.G,D:STAND.D,choke:6,gL:10,gR:0,eL:STAND.eL,eR:STAND.eR};
  if(!sw){
    const one=[[0,STAND],[0.75,low],[0.95,{}],[1.25,top],[1.45,{}],[1.95,low],[2.1,{}],[2.4,top],[2.6,{}],[3.1,home],[3.3,{}]];
    return both(one);
  }
  // switch curl: keep the curl going up into an arc over the top; the hands meet at the head in the
  // middle of the arc and the left hand catches it into the low curl position on the left
  const arc=Object.assign(wide([0,88,22],[0,168,26],'R',{eL:[1,-1,0.3],eR:[-1,-1,0.3],pass:true}),{gL:wide([0,88,22],[0,168,26]).gR-4});
  const arcR=mirror(arc);
  const topL=mirror(top),lowL=mirror(low);
  return [[0,STAND],[0.75,low],[0.95,{}],[1.25,top],[1.55,arc],[1.85,topL],[2.2,lowL],[2.4,{}],
    [2.7,topL],[3.0,arcR],[3.3,top],[3.65,low],[3.85,{}],[4.15,top],[4.45,arc],[4.75,topL],[5.1,lowL],[5.3,{}],
    [5.8,Object.assign({},home,{gL:0,gR:10})],[6.1,home],[6.3,{}]];
}

function offsetRow(){
  // hinge; two-hand hold with the mace horizontal and the head out to the left; row to the ribs
  const base={P:[0,86,-18],pitch:55,yaw:0,feet:{L:[16,8,4],R:[-16,8,4]},turn:12};
  const hang=Object.assign({},base,{G:onBody(base,-6,44,52),D:[1,0,0.05],eL:[1,-0.3,-0.4],eR:[-1,-0.3,-0.4]});
  const row=Object.assign({},base,{G:onBody(base,-6,24,16),eL:[0.6,0.6,-0.6],eR:[-0.6,0.6,-0.6]});
  const set={G:[-6,98,26],D:norm([0.8,0.5,0.1]),pass:true};
  const one=[[0,STAND],[0.4,set],[0.95,hang],[1.15,{}],[1.65,row],[1.85,{}],[2.35,hang],[2.5,{}],[3.0,row],[3.2,{}],[3.7,hang],
    [4.15,Object.assign({},set,{P:STAND.P,pitch:0,feet:STAND.feet,turn:STAND.turn})],[4.5,Object.assign({},STAND)],[4.7,{}]];
  return both(one);
}
function offsetMarch(){
  // bar horizontal at chest height with the weight out to the left; slow marching steps
  const hold={G:[-8,124,24],D:[1,0,0.05],eL:[0.6,-1,0],eR:[-1,-1,0]};
  const set={G:[-4,116,26],D:norm([0.7,0.7,0.1]),pass:true};
  const kneeL={feet:{L:[12,42,18],R:[-12,8,0]}},kneeR={feet:{L:[12,8,0],R:[-12,42,18]}},down={feet:STAND.feet};
  const one=[[0,STAND],[0.35,set],[0.7,hold],[0.9,{}],[1.35,kneeL],[1.8,down],[2.25,kneeR],[2.7,down],[3.15,kneeL],[3.6,down],
    [4.05,kneeR],[4.5,down],[4.85,set],[5.2,{G:STAND.G,D:STAND.D,eL:STAND.eL,eR:STAND.eR}],[5.4,{}]];
  return both(one);
}
function shoulderedLunge(){
  // mace resting on the right shoulder, head behind; reverse lunge each leg
  const sh={G:[-8,124,18],D:norm([-0.3,0.6,-0.74]),eL:[0.4,-1,0.5],eR:[-0.8,-1,0]};
  const set={G:[-6,118,24],D:norm([-0.2,0.9,-0.2]),pass:true};
  const bottom=side=>{const feet=side==='L'?{L:[12,15,-88],R:[-12,8,6]}:{L:[12,8,6],R:[-12,15,-88]};
    const pose={P:[0,54,-36],pitch:5,yaw:0,feet,tL:side==='L'?1:0,tR:side==='R'?1:0};
    return Object.assign(pose,{G:onBody(pose,-8,30,18),D:sh.D})};
  const up=Object.assign({},sh,{P:STAND.P,pitch:0,feet:STAND.feet,tL:0,tR:0});
  const upF=Object.assign({},STAND,up),bL=Object.assign({},upF,bottom('L')),bR=Object.assign({},upF,bottom('R'));
  return [[0,STAND],[0.4,set],[0.8,sh],[1.0,{}]].concat(stepKF(upF,bL,1.0,1.8,'L',true),[[1.8,bottom('L')],[2.1,{}]],stepKF(bL,upF,2.1,2.9,'L',false),
    [[2.9,up],[3.1,{}]],stepKF(upF,bR,3.1,3.9,'R',true),[[3.9,bottom('R')],[4.2,{}]],stepKF(bR,upF,4.2,5.0,'R',false),[[5.0,up],
    [5.2,{}],[5.55,set],[5.9,{G:STAND.G,D:STAND.D,eL:STAND.eL,eR:STAND.eR}],[6.1,{}]]);
}
function lungeTo360(){
  const lunge=reverseLunge('L'),turn=threeSixty();
  return both(chain(lunge,turn));
}
function plankPullThrough(){
  // high plank; the mace lies on the floor to the left. The right hand reaches under the chest and drags
  // it across to the right side, then the left hand drags it back.
  const feet={L:[16,8,-108],R:[-16,8,-108]};
  const plank=Object.assign({},STAND,{P:[0,40,-28],pitch:70,yaw:0,hipYaw:0,feet,turn:0,tL:1,tR:1,
    G:[18,4,-50],D:[0,0,1],gR:70,gL:70,choke:6,offL:1,offR:1,freeL:[17,3,18],freeR:[-17,3,18],
    eL:[1,0,-0.5],eR:[-1,0,-0.5]});
  const dip={P:[0,34,-28],pitch:72};
  const grabR=Object.assign({offR:0,eR:[-0.6,0.4,-0.4]},dip);
  const dragR={G:[-18,4,-50],D:[0,0,1],P:[0,38,-28],pitch:70};
  const relR={offR:1,eR:[-1,0,-0.5]};
  const grabL=Object.assign({offL:0,eL:[0.6,0.4,-0.4]},dip);
  const dragL={G:[18,4,-50],D:[0,0,1],P:[0,38,-28],pitch:70};
  const relL={offL:1,eL:[1,0,-0.5]};
  return [[0,plank],[0.5,{}],[1.0,grabR],[1.7,dragR],[2.0,relR],[2.4,{}],[2.9,grabL],[3.6,dragL],[3.9,relL],[4.3,{}]];
}


/* ---------- steel club ----------
   Reference: Dangerously Fit's "5 Best Steel Club Exercises for Beginners" and "Steel Club Training for
   Beginners: Complete Guide" (notes in the Arc & Iron project, steel-club-exercises.md). One club. The right hand
   works by default (gR:0 sits at G, just above the knob); one-handed moves park the left hand at the
   hip (offL:1). Two-handed moves stack the left hand above the right. both() mirrors to the other side. */
const CB2={len:CLUB,choke:3,gR:0,gL:7,offL:0,offR:0};                 // two hands, stacked
const CB1={len:CLUB,choke:3,gR:0,gL:7,offL:1,offR:0,freeL:[21,87,3]};  // right hand only
const C_ORDER2={G:[7,124,22],D:[0,1,0],eL:[1,-1,-0.25],eR:[-1,-1,-0.25]};      // order: hands at the sternum, elbows by the ribs, favouring the lead (top hand, left) side
const C_ORDER1={G:[-16,118,22],D:[0,1,0],eR:[-0.8,-1,-0.1]};                   // order position, right shoulder
const C_TWO=Object.assign({},STAND,CB2,C_ORDER2),C_ONE=Object.assign({},STAND,CB1,C_ORDER1);
const HINGE={P:[0,88,-3],pitch:16,feet:{L:[23,8,0],R:[-23,8,0]},turn:14,kneeOut:0.6};
const UPRIGHT={P:STAND.P,pitch:0,yaw:0,hipYaw:0,feet:STAND.feet,turn:STAND.turn,kneeOut:STAND.kneeOut};

function sideRocker(){
  // Two hands, wide hinge, club hanging in front of the shins. Rock it side to side like a pendulum and
  // shift onto the leg it swings toward.
  const hang=Object.assign({},HINGE,{G:[0,90,25],D:[0,-1,0.06],eL:[1,-0.5,-0.4],eR:[-1,-0.5,-0.4]});
  const to=x=>({P:[x*6,88,-3],yaw:x*6,hipYaw:x*3,G:[x*7,91,25],D:norm([x*0.62,-0.78,0.06])});
  return [[0,C_TWO],[0.25,{}],[0.75,hang],[1.25,to(1)],[1.8,to(-1)],[2.35,to(1)],[2.9,to(-1)],[3.4,{P:HINGE.P,yaw:0,hipYaw:0,G:hang.G,D:hang.D}],
    [3.95,Object.assign({},UPRIGHT,C_ORDER2)],[4.2,{}]];
}
function lateralSwing(){
  // One hand (right), wide hinge. The arm stays straight with the elbow locked and the shoulder is the pivot:
  // the hand stays at arm's length from the shoulder and the club stays in line with the arm as it swings
  // across the front, from outside the right leg to outside the left. The torso turns with it and the free
  // arm moves the other way. Keyframes every few degrees keep the hand on the arc, so the elbow never bends.
  const H=(f)=>{const yaw=f*16;return {P:[6*f,88,-3],pitch:16,yaw,hipYaw:yaw*0.45,roll:0,feet:{L:[23,8,0],R:[-23,8,0]},turn:14,kneeOut:0.6}};
  // f runs from -1 (club out past the right leg) to 1 (out past the left leg)
  const at=(f,pass)=>{const b=H(f),a=f*36*Math.PI/180,u=norm([Math.sin(a)*1.1,-Math.cos(a),0.27]);
    return Object.assign({},b,{G:add(shoulderOf(b,'R'),mul(u,57.5)),D:u,eR:[-0.3,-0.3,-1],freeL:[22-5*f,86,12-22*f],pass})};
  const sweep=(from,to,t0,dt)=>{const out=[],n=6;for(let k=1;k<=n;k++){const f=from+(to-from)*k/n;out.push([t0+dt*k/n,at(f,k<n)])}return out};
  const hang=at(0,false);
  return [[0,C_ONE],[0.25,{}],[0.75,hang]].concat(sweep(0,-1,0.75,0.5),sweep(-1,1,1.25,0.55),sweep(1,-1,1.8,0.55),sweep(-1,1,2.35,0.55),sweep(1,0,2.9,0.5),
    [[3.95,Object.assign({},UPRIGHT,C_ORDER1,{freeL:CB1.freeL})],[4.2,{}]]);
}
// Side swing (Dangerously Fit, "Steel Club Side Swing"; notes in the Arc & Iron project,
// steel-club-side-swing.md). The normal swing turned sideways: feet shoulder-width with the toes forward,
// cast the club low to one side with a 45-degree hinge back and toward that side, wait for it to cross in
// front of the knees, then snap the hips forward so it rises across the front to shoulder height on the
// other side, arms locked and the chest and eyes turned to the club. Same path back. Built swinging up to
// the right: the right arm is the long arm, so the right hand is on top (lead side) and the left hand is
// "married to the pommel". both() gives the other set, up to the left with the hands swapped.
const SS_FEET={L:[14,8,0],R:[-14,8,0]};
// hands at locked-arm length from the shoulders, out along u (world direction); the club carries on along D
function ssArms(body,u,D,extra){
  const mid=vl(shoulderOf(body,'L'),shoulderOf(body,'R'),0.5);
  return Object.assign({},body,{G:add(mid,mul(norm(u),45)),D:norm(D),eL:[1,-0.3,-0.2],eR:[-1,-0.3,-0.2]},extra||{});
}
function ssBody(P,pitch,yaw,extra){
  return Object.assign({P,pitch,yaw,hipYaw:yaw*0.45,roll:0,feet:SS_FEET,turn:4,kneeOut:0.35,tL:0,tR:0,fyL:0,fyR:0},extra||{});
}
// one hand on the handle (the right), at locked-arm length from that shoulder
function ssArm1(body,u,D,free,extra){
  return Object.assign({},body,{G:add(shoulderOf(body,'R'),mul(norm(u),55)),D:norm(D),eR:[-1,-0.3,-0.2],freeL:free,eL:[1,-0.4,-0.6]},extra||{});
}
function sideSwingKF(one){
  // weight on the right foot as the club casts low to the left (the coach's cue), hips back at 45 degrees
  const bottomB=ssBody([-4,85,-11],44,30);
  const lowB=ssBody([-1,87,-8],32,4);                 // still hinged while the club crosses the knees
  const riseB=ssBody([2,92,-3],12,-34);               // hips snapping through
  const topB=ssBody([4,94,0],0,-60);                  // tall, chest facing the club
  const standB=ssBody([0,94,0],0,0);
  const castB=ssBody([-2,90,-4],16,16);              // first cast: out to the side in front, then back
  let start,cast,bottom,low,rise,top;
  if(!one){
    const grip={len:CLUB,choke:3,gL:0,gR:7,offL:0,offR:0};
    start=Object.assign({},STAND,grip,ssArms(standB,[0,-0.94,0.34],[0,-1,0.12]));
    cast=ssArms(castB,[0.32,-0.88,0.36],[0.62,-0.62,0.48],{pass:true});
    bottom=ssArms(bottomB,[0.36,-0.9,0.24],[0.25,-0.72,-0.64]);
    low=ssArms(lowB,[0,-0.92,0.4],[-0.15,-0.9,0.4],{pass:true});
    rise=ssArms(riseB,[-0.72,-0.5,0.48],[-0.78,-0.38,0.5],{pass:true});
    top=ssArms(topB,[-0.9,0.02,0.44],[-0.88,0.18,0.44]);
  }else{
    // free arm held out the other way for balance
    const grip={len:CLUB,choke:3,gR:0,gL:7,offL:1,offR:0,freeL:[21,87,3]};
    const freeOut=(b,dir)=>add(shoulderOf(b,'L'),mul(norm(dir),52));
    start=Object.assign({},STAND,grip,ssArm1(standB,[0.05,-0.96,0.28],[0,-1,0.12],[21,87,3]));
    cast=ssArm1(castB,[0.36,-0.86,0.36],[0.62,-0.62,0.48],freeOut(castB,[0.6,-0.6,-0.5]),{pass:true});
    bottom=ssArm1(bottomB,[0.42,-0.86,0.3],[0.25,-0.72,-0.64],freeOut(bottomB,[0.5,-0.2,-0.84]));
    low=ssArm1(lowB,[0.08,-0.92,0.38],[-0.15,-0.9,0.4],freeOut(lowB,[0.8,-0.5,-0.3]),{pass:true});
    rise=ssArm1(riseB,[-0.75,-0.45,0.48],[-0.78,-0.38,0.5],freeOut(riseB,[0.85,-0.3,-0.4]),{pass:true});
    top=ssArm1(topB,[-0.9,0.02,0.44],[-0.88,0.18,0.44],freeOut(topB,[0.86,0.02,-0.5]));
  }
  const c=o=>Object.assign({},o);
  // the club travels the same path both ways: up through low and rise, back down through rise and low
  return [[0,start],[0.3,{}],[0.6,c(cast)],[0.95,c(bottom)],[1.05,{}],[1.35,c(low)],[1.6,c(rise)],[1.9,c(top)],[2.05,{}],
    [2.35,c(rise)],[2.6,c(low)],[2.95,c(bottom)],[3.1,{}],[3.4,c(low)],[3.65,c(rise)],[3.95,c(top)],[4.1,{}],
    [4.4,c(rise)],[4.7,Object.assign({},low)],[5.15,c(start)],[5.4,{}]];
}

function swipe(){
  // One hand (right, the lead), from order (Chris). Cast the club out to the front to full extension, then
  // swing it down with the arm straight, hinging at the waist as it goes past the outside of the knee and
  // behind you. Drive the hips (glutes) to swing it back up with the arm straight to full extension in front,
  // then come back in from extension as you cast the club behind the shoulder (the arm cast, elbow in at 90
  // degrees), and pull it back to order. The club stays outside the legs. both() gives the left side.
  const free={freeL:[22,92,6]};
  const B=(P,pitch,extra)=>Object.assign({P,pitch,yaw:0,hipYaw:0,roll:0,feet:WIDE,turn:15,kneeOut:0.5},extra||{});
  const arm=(b,u,D,pass)=>Object.assign({},b,{G:add(shoulderOf(b,'R'),mul(norm(u),REACH1)),D:norm(D),eR:[-1,-0.3,-0.2],lock:'R',pass:!!pass},free);
  const up=B([0,94,0],0),mid=B([0,91,-3],14),low=B([0,86,-6],32),deep=B([0,84,-8],40);
  const ext=arm(up,[-0.12,0.05,1],[-0.08,0.25,0.96],true);             // cast out in front, full extension
  const down=arm(mid,[-0.22,-0.6,0.77],[-0.2,-0.55,0.81],true);
  const knee=arm(low,[-0.3,-0.95,0.08],[-0.28,-0.92,-0.25],true);       // past the outside of the knee
  const behind=arm(deep,[-0.28,-0.8,-0.53],[-0.22,-0.45,-0.86]);         // behind you, hips back
  const drive=arm(mid,[-0.22,-0.5,0.84],[-0.15,-0.15,0.98],true);       // glutes: hips through
  const top=arm(up,[-0.12,0.3,0.95],[-0.06,0.62,0.78],true);            // back to full extension in front
  const U=Object.assign({},UPRIGHT,{feet:WIDE,turn:15},free);
  const tip=Object.assign({},U,{G:[-15,150,10],D:norm([-0.05,0.3,-0.95]),eR:[-0.3,0.6,1],pass:true});
  const cast=Object.assign({},U,{G:[-15,160,-2],D:norm([0.1,-0.9,-0.42]),eR:[-0.3,0.6,1]});
  const pull=Object.assign({},U,{G:[-15,154,10],D:norm([0,0.8,-0.6]),eR:[-0.3,0.6,1],pass:true});
  return [[0,C_ONE],[0.25,{}],[0.6,ext],[0.85,down],[1.05,knee],[1.25,behind],[1.4,{}],[1.65,Object.assign({},knee)],[1.85,drive],
    [2.1,top],[2.4,tip],[2.7,cast],[2.85,{}],[3.2,pull],[3.55,Object.assign({},UPRIGHT,C_ONE)],[3.75,{}]];
}
function sideClean(){
  // Two hands, club upright in order on the left side. Turn the torso to the right with the weight on the
  // left leg (held by the left glute) and cast the club out to the right; it swings down in front of the
  // body and up to the left while the weight shifts across to the right leg, then swings back up the same
  // path and is caught in left-side order again. both() gives the right side.
  const order=Object.assign({},TALL,{G:[13,124,20],D:norm([0.08,1,0]),eL:[1,-1,-0.25],eR:[-0.6,-1,-0.25]});
  const start=Object.assign({},C_TWO,order);
  const turnR={P:[5,93,0],pitch:0,yaw:-30,hipYaw:-12,feet:WIDE,turn:15,kneeOut:0.4,tR:0.25,fyR:-14,tL:0,fyL:0};
  const wind=Object.assign({},turnR,{G:onBody(turnR,9,30,22),D:norm([0.1,1,0]),eL:[1,-1,-0.25],eR:[-0.6,-1,-0.25]});
  const castR=Object.assign({},turnR,{G:[-22,126,32],D:norm([-0.82,0.25,0.5]),eL:[1,-0.4,-0.2],eR:[-1,-0.4,-0.2],pass:true});
  const low={P:[0,89,-3],pitch:12,yaw:0,hipYaw:0,tR:0,fyR:0,tL:0,fyL:0,feet:WIDE,turn:15,kneeOut:0.5,G:[0,98,30],D:norm([0,-0.8,0.6]),eL:[1,-0.6,-0.3],eR:[-1,-0.6,-0.3],pass:true};
  const left={P:[-5,92,-1],pitch:4,yaw:22,hipYaw:10,tL:0.25,fyL:14,tR:0,fyR:0,feet:WIDE,turn:15,kneeOut:0.4,G:[22,106,26],D:norm([0.85,-0.3,0.3]),eL:[1,-0.5,-0.2],eR:[-1,-0.5,-0.2]};
  return [[0,start],[0.25,{}],[0.65,wind],[0.8,{}],[1.15,castR],[1.5,low],[1.85,left],[1.95,{}],
    [2.3,Object.assign({},low)],[2.65,Object.assign({},castR)],[3.05,Object.assign({},wind,{pass:true})],[3.35,Object.assign({},start)],[3.55,{}]];
}

// One-handed circles (right hand, the lead; both() gives the left). Each starts with a horizontal push out
// in front from order, the club staying vertical; then the club drops into its swing with the arm long, so
// its offset weight turns the body (the torso turns with it and the weight shifts against it). The circle
// stays in front of the body, never over the head, and finishes caught with the elbow bent 90 degrees out
// to the right side, club upright; then the arm comes back to order. arm(body,u) puts the hand at arm's
// length from the right shoulder in direction u.
const armAt=(body,u,D,extra)=>Object.assign({},body,{G:add(shoulderOf(body,'R'),mul(norm(u),50)),D:norm(D),eR:[-0.4,-0.6,0.6],freeL:[22,92,6]},extra||{});
const CB_BODY={P:[0,93,0],pitch:0,yaw:0,hipYaw:0,roll:0,feet:{L:[16,8,0],R:[-16,8,0]},turn:15,kneeOut:0.4};
const body=(yaw,px)=>Object.assign({},CB_BODY,{yaw,hipYaw:yaw*0.45,P:[px,93,0]});
// order held on a turned body: elbow tight to the side, club upright at the right shoulder
const orderOn=b=>Object.assign({},b,{G:onBody(b,-16,24,22),D:[0,1,0],eR:[-0.6,-1,0.1],freeL:[22,92,6]});
// arm extended straight out from the turned torso at shoulder height, club still upright
const pushOn=b=>{const F=torsoFrame(b.P,b.pitch||0,b.yaw||0,b.roll||0,b.twist||0);
  return Object.assign({},b,{G:add(shoulderOf(b,'R'),add(mul(F.f,48),[0,-5,0])),D:[0,1,0],eR:[-1,-0.4,0],freeL:[22,92,6]})};
const PUSH=()=>pushOn(CB_BODY);
// the swing comes back to a 90-degree elbow with the elbow tucked to the side of the body, club upright
const CATCH90=()=>{const b=body(-6,2);return Object.assign({},b,{G:onBody(b,-19,22,28),D:norm([0,1,-0.05]),eR:[-0.3,-1,-0.1],freeL:[22,92,6]})};
// circle start: from order the torso turns to aim the club (still in order) the way the swing goes, then
// the arm extends to push it out. dir>0 turns toward the inside (left) for inside circles and mills,
// dir<0 toward the lead side (right) for outside circles and reverse mills.
function circleStart(dir){
  const b=body(30*dir,-2*dir);
  return [[0,C_ONE],[0.3,{}],[0.75,orderOn(b)],[0.9,{}],[1.3,pushOn(b)],[1.45,{}]];
}
// inside circle swing: drops in across the body, down, out to the right and up the right side
const insideSwing=()=>[
  armAt(body(14,-3),[0.55,0.05,0.83],[0.8,0.35,0.45],{pass:true}),
  armAt(body(16,-4),[0.35,-0.5,0.8],[0.4,-0.82,0.42],{pass:true}),
  armAt(body(2,0),[-0.1,-0.78,0.62],[-0.1,-0.95,0.3],{pass:true}),
  armAt(body(-14,4),[-0.72,-0.42,0.55],[-0.9,-0.3,0.3],{pass:true}),
  armAt(body(-16,4),[-0.95,0,0.32],[-0.6,0.76,0.25],{pass:true})];
// outside circle swing: drops out to the right, down, across the front to the left, up the inside and back
// across the front (below the head) to the right side
const outsideSwing=()=>[
  armAt(body(-14,3),[-0.6,0.05,0.8],[-0.8,0.35,0.45],{pass:true}),
  armAt(body(-16,4),[-0.45,-0.5,0.75],[-0.45,-0.8,0.4],{pass:true}),
  armAt(body(-2,0),[0.05,-0.78,0.62],[0.1,-0.95,0.3],{pass:true}),
  armAt(body(14,-4),[0.6,-0.42,0.68],[0.9,-0.3,0.3],{pass:true}),
  armAt(body(16,-4),[0.6,0.1,0.8],[0.5,0.78,0.35],{pass:true}),
  armAt(body(4,-1),[0.05,0.1,1],[-0.35,0.88,0.3],{pass:true})];
const seq=(t0,dt,poses)=>poses.map((p,i)=>[t0+i*dt,p]);
function circleKF(swing,dir){
  const sw=seq(1.7,0.3,swing);const t=sw[sw.length-1][0];
  return circleStart(dir).concat(sw,[[t+0.35,CATCH90()],[t+0.55,{}],[t+1.0,Object.assign({},UPRIGHT,C_ONE)],[t+1.2,{}]]);
}
function insideCircle(){return circleKF(insideSwing(),1)}
function outsideCircle(){return circleKF(outsideSwing(),-1)}
// Arm cast, two hands (also called a pullover), order on the lead (left, top hand) side. Arm cast over the left shoulder; the lead
// (top) elbow stays in at 90 degrees in front, and the supporting (right) elbow goes vertical, the bicep by
// the ear and the forearm reaching over the top of the head to the club. Then pull it back over the
// shoulder to order.
// Side swipe: one hand (right), from order. An outside circle carries the club to the far (left) side, low; then the return swing
// carries the club up the right side, and instead of stopping at shoulder height it goes on up and over the
// shoulder into a side arm cast: the elbow opens out to the side and the club drops behind the right shoulder. Pull it back over the
// shoulder to order.
function sideSwipe(){
  // from order: turn toward the lead side and push out, and an outside circle (out, down and across the
  // front) carries the club to the far side, low, where the side swing's return begins
  const kf=sideSwingKF(true),pose=at=>kf.find(([t])=>Math.abs(t-at)<1e-6)[1];
  const circ=circleStart(-1).concat(seq(1.7,0.28,outsideSwing().slice(0,4)));const tc=circ[circ.length-1][0];
  const head=circ.concat([[tc+0.3,Object.assign({},pose(0.95),{pass:true})],[tc+0.6,pose(1.35)],[tc+0.85,pose(1.6)]]);const t=head[head.length-1][0];
  const free=[21,87,3];
  const high=ssArm1(ssBody([2,94,-1],2,-34),[-0.85,0.45,0.28],[-0.5,0.85,0.15],free,{pass:true});
  const b=ssBody([0,94,0],0,-12);
  // the club carries on up and over the shoulder, toward the head and back, before it drops behind
  const over=Object.assign({},ssBody([0,94,0],0,-18),{G:[-22,162,6],D:norm([0.2,0.6,-0.77]),eR:[-1,0.3,0.2],freeL:free,pass:true});
  const openCast=Object.assign({},b,{G:[-23,163,-2],D:norm([-0.05,-0.9,-0.42]),eR:[-1,0.3,0],freeL:free});
  const pull=Object.assign({},ssBody([0,94,0],0,-6),{G:[-20,156,10],D:norm([-0.1,0.8,-0.58]),eR:[-1,0.2,0.3],freeL:free,pass:true});
  const front=Object.assign({},ssBody([0,94,0],0,0),{G:[-16,146,24],D:norm([-0.2,0.7,0.68]),eR:[-1,-0.6,0.2],freeL:free,pass:true});
  return head.concat([[t+0.3,high],[t+0.55,over],[t+0.8,openCast],[t+0.95,{}],[t+1.25,pull],[t+1.5,front],[t+1.9,Object.assign({},C_ONE)],[t+2.1,{}]]);
}
// the two-hand arm cast's positions, shared by the arm cast, the arm cast to flag press, the barbarian squat
// and the gamma cast so the arm cast looks the same in all of them
const AC2={order:{G:[9,124,22],D:[0,1,0],eL:[1,-1,-0.25],eR:[-1,-1,-0.25]},
  tip:{G:[11,156,10],D:norm([0.1,0.35,-0.93]),eL:[0.4,-0.5,1],eR:[-0.3,1,0.2],pass:true},
  back:{G:[9,177,-4],D:norm([0.08,-0.9,-0.42]),eL:[0.4,-0.5,1],eR:[-0.2,1,0.1]},
  pull:{G:[11,162,8],D:norm([0.05,0.8,-0.6]),eL:[0.4,-0.5,1],eR:[-0.3,1,0.2],pass:true}};
const ac2=(k,extra)=>Object.assign({},AC2[k],extra||{});
function twoArmCast(){
  return [[0,Object.assign({},C_TWO,AC2.order)],[0.3,{}],[0.7,ac2('tip')],[1.05,ac2('back')],[1.3,{}],[1.65,ac2('pull')],[2.0,ac2('order')],[2.25,{}]];
}
// Arm cast, one hand (right hand; also called a pullover): arm cast over the right shoulder with the elbow bent 90 degrees and in,
// club hanging behind; pull it back over the shoulder to order.
function armCast(){
  const tip={G:[-15,150,10],D:norm([-0.05,0.3,-0.95]),eR:[-0.3,0.6,1],pass:true};
  const back={G:[-15,160,-2],D:norm([0.1,-0.9,-0.42]),eR:[-0.3,0.6,1]};
  const pull={G:[-15,154,10],D:norm([0,0.8,-0.6]),eR:[-0.3,0.6,1],pass:true};
  return [[0,C_ONE],[0.3,{}],[0.7,tip],[1.05,back],[1.3,{}],[1.65,pull],[2.0,Object.assign({},C_ORDER1)],[2.25,{}]];
}
function flagPress(){
  // One hand. From order on the right, press the club straight out in front at shoulder height, club
  // upright, then bring it back to order. Twice.
  const out={G:[-16,136,56],D:norm([0,1,0.05]),eR:[-1,-0.3,0]};
  return [[0,C_ONE],[0.3,{}],[0.8,out],[1.05,{}],[1.55,Object.assign({},C_ORDER1)],[1.75,{}],[2.25,Object.assign({},out)],[2.5,{}],[3.0,Object.assign({},C_ORDER1)],[3.2,{}]];
}
function flagPressTwo(){
  // Two hands, order on the lead (left, top hand) side: press straight out in front at shoulder height, club
  // upright, and back. Twice.
  const order=Object.assign({},C_ORDER2,{G:[9,124,22]});
  const out={G:[6,136,50],D:norm([0,1,0.05]),eL:[1,-0.3,0],eR:[-1,-0.3,0]};
  return [[0,Object.assign({},C_TWO,order)],[0.3,{}],[0.8,out],[1.05,{}],[1.55,Object.assign({},order)],[1.75,{}],[2.25,Object.assign({},out)],[2.5,{}],[3.0,Object.assign({},order)],[3.2,{}]];
}
function torchPressTwo(){
  // Two hands, club upright in order on the lead side; press it straight up and lower, club vertical.
  const order=Object.assign({},C_ORDER2,{G:[9,124,22]});
  const top={G:[7,181,22],D:[0,1,0],eL:[1,-0.2,0.2],eR:[-1,-0.2,0.2]};
  return [[0,Object.assign({},C_TWO,order)],[0.3,{}],[0.9,top],[1.15,{}],[1.75,Object.assign({},order)],[1.95,{}],[2.55,Object.assign({},top)],[2.8,{}],[3.4,Object.assign({},order)],[3.6,{}]];
}
function mill(){
  // One hand (right). Big circle: push out, then an inside circle with the arm long, rising up the right side
  // with the elbow opening out to the side (club upright). Small circle, with no stop: cast it behind
  // the head, let it swing down behind the right shoulder and round, and pull it back in front to order. The
  // body turns against the weight the whole way.
  const big=circleStart(1).concat(seq(1.7,0.28,insideSwing()));
  const t=big[big.length-1][0]+0.32;
  const cast=Object.assign({},body(12,0),{G:[-26,166,-2],D:norm([0.55,0.1,-0.83]),eR:[-1,0.2,0.3],pass:true});
  const behind=Object.assign({},body(16,-3),{G:[-15,160,-2],D:norm([0.15,-0.9,-0.4]),eR:[-0.3,0.6,1]});
  const round=Object.assign({},body(8,0),{G:[-16,158,6],D:norm([-0.92,-0.2,-0.3]),pass:true});
  const front=Object.assign({},body(0,0),{G:[-15,146,26],D:norm([-0.3,0.65,0.7]),eR:[-1,-0.6,0.2],pass:true});
  // from the 90 at the side the elbow lifts out to the side (club still upright) before the cast behind the head
  const out90=Object.assign({},body(-8,3),{G:[-36,160,8],D:norm([-0.1,1,-0.05]),eR:[-1,-0.3,-0.2],pass:true});
  return big.concat([[t,out90],[t+0.3,cast],[t+0.6,behind],[t+0.75,{}],[t+1.05,round],[t+1.35,front],[t+1.75,Object.assign({},UPRIGHT,C_ONE)],[t+1.95,{}]]);
}
function reverseMill(){
  // One hand (right). Big circle: push out, then an outside circle with the arm long. Small circle, the same
  // way round, with no stop in between: cast it over the right (lead)
  // shoulder, let it swing down behind, carry on round behind the head to the left and up, and pull it back
  // over the lead shoulder to order. The body turns against the weight.
  const big=circleStart(-1).concat(seq(1.7,0.28,outsideSwing()));
  const t=big[big.length-1][0]+0.32;
  const outR=Object.assign({},body(-12,2),{G:[-20,163,0],D:norm([-0.85,0.1,-0.5]),eR:[-0.5,0.5,0.8],pass:true});
  const down=Object.assign({},body(-14,3),{G:[-15,160,-2],D:norm([0.15,-0.9,-0.4]),eR:[-0.3,0.6,1]});
  const left=Object.assign({},body(-4,0),{G:[-13,164,-2],D:norm([0.9,-0.05,-0.42]),eR:[-0.3,0.7,0.8],pass:true});
  const up=Object.assign({},body(4,0),{G:[-18,166,0],D:norm([-0.25,0.88,-0.4]),eR:[-0.4,0.6,0.8],pass:true});
  const front=Object.assign({},body(0,0),{G:[-17,150,22],D:norm([-0.2,0.7,0.68]),eR:[-1,-0.6,0.2],pass:true});
  return big.concat([[t,outR],[t+0.3,down],[t+0.45,{}],[t+0.75,left],[t+1.0,up],[t+1.3,front],[t+1.7,Object.assign({},UPRIGHT,C_ONE)],[t+1.9,{}]]);
}
// ---- from the Dangerously Fit switch and half mill videos ----
// a body turned to one side (dir 1 = turned left, -1 = turned right), pivoting on the back foot ("squish
// the bug": heel up, ball of the foot turning)
const tb=(dir,deg=35)=>Object.assign({},CB_BODY,{yaw:deg*dir,hipYaw:deg*0.55*dir,P:[-3*dir,93,0],
  tR:dir>0?0.45:0,fyR:dir>0?deg:0,tL:dir<0?0.45:0,fyL:dir<0?-deg:0});
// rotational torch press, right hand: from order on a turned body, drive the club forward and up in the
// direction you've turned, finishing in a forearm lock with the club upright like a torch; the free arm
// reaches forward and out; pull it back down to order with the lat.
function rtpTop(b){
  const F=torsoFrame(b.P,b.pitch||0,b.yaw||0,b.roll||0,b.twist||0),sR=shoulderOf(b,'R'),sL=shoulderOf(b,'L');
  const u=norm(add(mul(F.f,0.55),[0,0.84,0]));
  return Object.assign({},b,{G:add(sR,mul(u,54)),D:[0,1,0],eR:[-1,-0.2,0.2],freeL:add(sL,mul(norm(add(mul(F.f,0.8),mul(F.l,0.55))),50))});
}
// Rotational torch press (Chris): cross-body only. The lead (right) hand turns in toward the other side: a
// full 90 degree turn of the torso, pivoting on the back (right) foot, pressing the club up to a forearm lock
// as you turn. Then turn back to the front, bringing the club back in to order on the way.
function rotTorchPress(){
  const b90=Object.assign({},tb(1,90),{fyR:70,tR:0.6}),b45=Object.assign({},tb(1,45),{fyR:38,tR:0.35});
  const top=rtpTop(b90);
  const mid=b=>{const o=orderOn(b),t=rtpTop(b);return Object.assign({},t,{G:mul(add(o.G,t.G),0.5),D:[0,1,0],eR:[-0.8,-0.6,0.3],pass:true})};
  return [[0,C_ONE],[0.25,{}],[0.75,mid(b45)],[1.25,top],[1.5,{}],[2.0,mid(b45)],[2.5,Object.assign({},UPRIGHT,C_ONE)],[2.7,{}]];
}
// the half reverse mill done facing front, for flows: over the lead shoulder, down behind, round behind the
// head and up, and back to order in front
function halfRevMillFront(){
  const step=(deg,extra)=>Object.assign({},tb(deg>=0?1:-1,Math.abs(deg)),extra);
  return [[0,C_ONE],[0.2,{}],
    [0.5,step(-14,{G:[-20,163,0],D:norm([-0.85,0.1,-0.5]),eR:[-0.5,0.5,0.8],pass:true})],
    [0.8,step(-8,{G:[-15,160,-2],D:norm([0.15,-0.9,-0.4]),eR:[-0.3,0.6,1],pass:true})],
    [1.1,step(6,{G:[-13,164,-2],D:norm([0.9,-0.05,-0.42]),eR:[-0.3,0.7,0.8],pass:true})],
    [1.35,step(4,{G:[-18,166,0],D:norm([-0.25,0.88,-0.4]),eR:[-0.4,0.6,0.8],pass:true})],
    [1.65,Object.assign({},UPRIGHT,{G:[-17,150,22],D:norm([-0.2,0.7,0.68]),eR:[-1,-0.6,0.2],pass:true})],
    [1.95,Object.assign({},UPRIGHT,C_ONE)],[2.15,{}]];
}
// half reverse mill: from order turned left, the small outside circle behind the head (over the right
// shoulder, down behind, round behind the head and up), and the club whips the body round to face right
function halfReverseMill(){
  const a=tb(1),z=tb(-1);
  const step=(deg,extra)=>Object.assign({},tb(deg>=0?1:-1,Math.abs(deg)),extra);
  return [[0,Object.assign({},C_ONE,orderOn(a))],[0.2,{}],
    [0.5,step(25,{G:[-20,163,0],D:norm([-0.85,0.1,-0.5]),eR:[-0.5,0.5,0.8],pass:true})],
    [0.8,step(10,{G:[-15,160,-2],D:norm([0.15,-0.9,-0.4]),eR:[-0.3,0.6,1],pass:true})],
    [1.1,step(-8,{G:[-13,164,-2],D:norm([0.9,-0.05,-0.42]),eR:[-0.3,0.7,0.8],pass:true})],
    [1.35,step(-22,{G:[-18,166,0],D:norm([-0.25,0.88,-0.4]),eR:[-0.4,0.6,0.8],pass:true})],
    [1.7,orderOn(z)],[1.9,{}]];
}
// half mill: from order turned right, the small inside circle behind the head (elbow out to the side, cast
// behind the head, down behind the right shoulder and round to the front), whipping the body back to the left
function halfMill(){
  const a=tb(-1),z=tb(1);
  const step=(deg,extra)=>Object.assign({},tb(deg>=0?1:-1,Math.abs(deg)),extra);
  return [[0,Object.assign({},C_ONE,orderOn(a))],[0.2,{}],
    [0.5,step(-22,{G:[-36,160,8],D:norm([-0.1,1,-0.05]),eR:[-1,-0.3,-0.2],pass:true})],
    [0.8,step(-6,{G:[-26,166,-2],D:norm([0.55,0.1,-0.83]),eR:[-1,0.2,0.3],pass:true})],
    [1.1,step(10,{G:[-15,160,-2],D:norm([0.15,-0.9,-0.4]),eR:[-0.3,0.6,1],pass:true})],
    [1.4,step(24,{G:[-16,158,6],D:norm([-0.92,-0.2,-0.3]),pass:true})],
    [1.75,orderOn(z)],[1.95,{}]];
}
// switch moves change hands every rep: the free hand catches the club as it arrives on that hand's side
// (or at the navel for the shield cast), and the next rep starts from there with the new hand. Each is
// built right hand to left; both() mirrors it for the way back.
// the free (left) hand catches the club upright in left-side order; the right hand lets go
const catchLeft=()=>({G:[16,118,22],D:[0,1,0],offL:0,offR:0,gR:0,gL:7,eL:[1,-1,-0.1],eR:[-0.5,-1,0.6],yaw:0,hipYaw:0});
const leftHas=()=>Object.assign({},UPRIGHT,mirror(C_ONE));
// switch shield cast: the cast starts and ends at the navel; the club comes down to the navel, where the
// other hand catches it and begins its own cast
function switchShield(){
  const navel={G:[-2,108,26],D:[0,1,0],eR:[-0.6,-1,0.2],freeL:[22,92,6]};
  const k=oneArmShield();
  const mid=k.filter(([t])=>t>=0.5&&t<=2.4);          // lift ... front
  const t=mid[mid.length-1][0];
  return [[0,Object.assign({},C_ONE,navel)],[0.25,{}]].concat(mid,[[t+0.4,Object.assign({},navel,{G:[-1,108,26],pass:true})],
    [t+0.6,{G:[0,108,26],D:[0,1,0],offL:0,offR:0,gR:0,gL:7,eL:[1,-1,-0.1],eR:[-1,-1,-0.1]}],[t+0.8,{}]]);
}
// switch reverse mill: the reverse mill, then an extra outside circle carries the club across to the left
// side, where the left hand catches it
function switchRevMill(){
  const k=reverseMill();const body=k.slice(0,k.length-2);   // up to the pull to the front, without stopping at order
  const t=body[body.length-1][0];
  const circ=seq(t+0.3,0.28,outsideSwing().slice(0,5));const tc=circ[circ.length-1][0];
  return body.concat(circ,[[tc+0.35,catchLeft()],[tc+0.5,{}],[tc+0.75,leftHas()],[tc+0.9,{}]]);
}
// switch 180, right hand to left: order with the elbow tucked; rotate through the upper back (away from the
// club); cast it away to the right with the arm locked; it swings down and across the front in a low U and
// up the left side, where the left hand catches it upright on top.
// one-hand 180 (right hand, it never leaves it): order with the elbow tucked; rotate through the upper back
// and cast the club away to the right with the arm locked; it swings down and across the front in a low
// U (an outside circle) and up the left side into a cross-body order, club upright in front of the left
// chest. Then cast it back out to the left to reverse the circle, down and across, and up to order.
function oneHand180(){
  const free=[21,87,3];
  const armR=(b,u,D,extra)=>Object.assign({},b,{G:add(shoulderOf(b,'R'),mul(norm(u),55)),D:norm(D),eR:[-1,-0.3,-0.2],freeL:free},extra||{});
  const B=(yaw,extra)=>Object.assign({},CB_BODY,{yaw,hipYaw:yaw*0.35},extra||{});
  const rot=B(20);
  const castOut=armR(B(12),[-0.95,-0.05,0.3],[-0.75,0.6,0.2],{pass:true});
  const downR=armR(B(-4),[-0.6,-0.72,0.35],[-0.55,-0.8,0.25],{pass:true});
  const bottom=armR(B(-2,{P:[0,90,-2],pitch:6}),[0.1,-0.92,0.38],[0.05,-1,0.15],{pass:true});
  const upL=armR(B(-14),[0.6,-0.55,0.58],[0.7,-0.6,0.3],{pass:true});
  const highL=armR(B(-18),[0.62,-0.05,0.78],[0.55,0.78,0.3],{pass:true});
  // cross-body order: right hand in front of the left chest, club upright, elbow across the body
  const cross=Object.assign({},B(-20),{G:[9,124,24],D:[0,1,0],eR:[-0.2,-1,0.5],freeL:free});
  // and back: cast out to the left, down and across, up the right side to order
  const castL=armR(B(-12),[0.85,-0.05,0.55],[0.75,0.6,0.2],{pass:true});
  const downL=armR(B(4),[0.55,-0.7,0.48],[0.55,-0.8,0.25],{pass:true});
  const bottom2=armR(B(2,{P:[0,90,-2],pitch:6}),[-0.05,-0.92,0.38],[-0.05,-1,0.15],{pass:true});
  const upR=armR(B(14),[-0.65,-0.55,0.5],[-0.7,-0.6,0.3],{pass:true});
  const highR=armR(B(16),[-0.92,-0.05,0.38],[-0.55,0.78,0.3],{pass:true});
  return [[0,C_ONE],[0.25,{}],[0.6,Object.assign({},rot,{G:onBody(rot,-16,24,22),D:[0,1,0],eR:[-0.6,-1,0.1],freeL:free})],[0.75,{}],
    [1.05,castOut],[1.35,downR],[1.6,bottom],[1.85,upL],[2.1,highL],[2.45,cross],[2.65,{}],
    [2.95,castL],[3.25,downL],[3.5,bottom2],[3.75,upR],[4.0,highR],[4.35,Object.assign({},UPRIGHT,C_ONE)],[4.55,{}]];
}
function switch180(){
  const free=[21,87,3],rot=Object.assign({},CB_BODY,{yaw:20,hipYaw:6});
  const armR=(b,u,D,extra)=>Object.assign({},b,{G:add(shoulderOf(b,'R'),mul(norm(u),55)),D:norm(D),eR:[-1,-0.3,-0.2],freeL:free},extra||{});
  const castOut=armR(Object.assign({},CB_BODY,{yaw:12,hipYaw:4}),[-0.95,-0.05,0.3],[-0.75,0.6,0.2],{pass:true});
  const downR=armR(Object.assign({},CB_BODY,{yaw:-4,hipYaw:-2}),[-0.6,-0.72,0.35],[-0.55,-0.8,0.25],{pass:true});
  const bottomB=Object.assign({},CB_BODY,{yaw:-2,hipYaw:-1,P:[0,90,-2],pitch:6});
  const bottom=armR(bottomB,[0.1,-0.92,0.38],[0.05,-1,0.15],{pass:true});
  // the right arm carries on across and up the left side, where the left hand catches it
  const upL=armR(Object.assign({},CB_BODY,{yaw:-14,hipYaw:-5}),[0.6,-0.55,0.58],[0.7,-0.6,0.3],{pass:true});
  const highL=armR(Object.assign({},CB_BODY,{yaw:-18,hipYaw:-6}),[0.62,-0.05,0.78],[0.55,0.78,0.3],{pass:true});
  return [[0,C_ONE],[0.25,{}],[0.6,Object.assign({},rot,{G:onBody(rot,-16,24,22),D:[0,1,0]})],[0.75,{}],
    [1.05,castOut],[1.35,downR],[1.6,bottom],[1.85,upL],[2.1,highL],[2.4,catchLeft()],[2.55,{}],[2.8,leftHas()],[2.95,{}]];
}
function shieldCast(){
  // Two hands, club upright in front of the chest and close to the body like a shield. Hands rise beside
  // the right side of the head and the club drops behind that shoulder to hang down the back; the head of
  // the club circles round behind and comes back out over the same shoulder to the front.
  const shield={G:[-4,122,18],D:norm([0.28,0.96,0]),eL:[1,-1,0.1],eR:[-1,-1,0.1]};
  const behind={G:[-13,163,-2],D:norm([0.12,-0.9,-0.42]),eL:[0.5,1,0.2],eR:[-0.4,1,0.2]};
  const round={G:[-15,164,5],D:norm([-0.9,-0.2,-0.35]),pass:true};
  const over={G:[-10,152,16],D:norm([-0.45,0.6,0.66]),eL:[1,-0.6,0.2],eR:[-1,-0.6,0.2],pass:true};
  return [[0,Object.assign({},C_TWO,{G:[-7,124,22]})],[0.25,{}],[0.6,shield],[1.0,behind],[1.2,{}],[1.55,round],[1.85,over],[2.25,Object.assign({},C_ORDER2,{G:[-7,124,22]})],[2.45,{}]];
}
function torchPress(){
  // One hand. Club upright like a torch at the shoulder; press it up and a little out in front, club
  // vertical, and lower.
  const rack={G:[-17,128,12],D:[0,1,0],eR:[-0.5,-1,0.3]};
  const top={G:[-17,188,20],D:[0,1,0],eR:[-1,-0.2,0.2]};
  return [[0,C_ONE],[0.4,rack],[0.6,{}],[1.2,top],[1.45,{}],[2.05,rack],[2.25,{}],[2.65,Object.assign({},C_ORDER1)],[2.8,{}]];
}

const WIDE={L:[16,8,0],R:[-16,8,0]};
const atOrder=pose=>Object.assign({G:onBody(pose,7,30,22),D:[0,1,0],eL:C_ORDER2.eL,eR:C_ORDER2.eR},pose);
const SQUAT={P:[0,56,-14],pitch:22,yaw:0,hipYaw:0,feet:WIDE,turn:15,kneeOut:0.5};
const TALL={P:STAND.P,pitch:0,yaw:0,hipYaw:0,feet:WIDE,turn:15,kneeOut:0.3,tL:0,tR:0,fyL:0,fyR:0};
// side order: body turned toward one side (s=-1 right, 1 left), club upright in front of the turned chest;
// the back foot pivots on its toes
function sideOrder(s){
  const pose={P:STAND.P,pitch:0,yaw:s*38,hipYaw:s*24,feet:WIDE,turn:15,kneeOut:0.3,
    tL:s<0?0.45:0,tR:s>0?0.45:0,fyL:s<0?-38:0,fyR:s>0?38:0};
  return Object.assign({},pose,{G:onBody(pose,0,30,22),D:[0,1,0],eL:[1,-1,-0.2],eR:[-1,-1,-0.2]});
}
// two-hand arm cast positions: hands behind the head, elbows up beside the ears, club down the back
const BEHIND2={G:[0,166,-12],D:norm([0,-0.93,-0.36]),eL:[1,0.9,0.15],eR:[-1,0.9,0.15]};
const TIPBACK2={G:[0,146,14],D:norm([0,0.35,-0.94]),eL:[1,0,0.3],eR:[-1,0,0.3],pass:true};
const PULL2={G:[0,152,16],D:norm([0,0.85,-0.5]),eL:[1,-0.4,0.4],eR:[-1,-0.4,0.4],pass:true};

function oneArmShield(){
  // One hand (right), from order. Cast the club over the opposite (left) ear so it swings down behind the
  // head and left shoulder, carry it round behind the back and pull it over the right (lead) shoulder back
  // to the front and into order. Like the two-hand shield cast.
  const lift={G:[-10,150,20],D:norm([0.25,0.85,-0.45]),eR:[-0.7,-0.2,1],pass:true};
  const overL={G:[-4,160,8],D:norm([0.55,0.35,-0.76]),eR:[-0.5,0.2,1],pass:true};
  const behindL={G:[-2,162,0],D:norm([0.25,-0.88,-0.4]),eR:[-0.4,0.5,1]};
  const across={G:[-12,162,-2],D:norm([-0.3,-0.85,-0.42]),eR:[-0.4,0.5,1],pass:true};
  const outR={G:[-17,160,0],D:norm([-0.88,-0.2,-0.42]),eR:[-0.4,0.6,0.9],pass:true};
  const overR={G:[-16,154,10],D:norm([-0.15,0.75,-0.64]),eR:[-0.4,0.4,1],pass:true};
  const front={G:[-15,146,24],D:norm([-0.2,0.7,0.68]),eR:[-1,-0.6,0.2],pass:true};
  return [[0,C_ONE],[0.25,{}],[0.6,lift],[0.9,overL],[1.2,behindL],[1.35,{}],[1.6,across],[1.85,outR],[2.1,overR],[2.35,front],
    [2.75,Object.assign({},C_ORDER1)],[2.95,{}]];
}
function cleanKF(){
  // Hinge and let the club drop between the legs, then drive the hips so it floats up; tighten to stop in order.
  const drop={G:[0,102,28],D:norm([0,-0.55,0.84]),eL:[1,-0.6,-0.3],eR:[-1,-0.6,-0.3],pass:true};
  const back={P:[0,84,-8],pitch:38,feet:WIDE,turn:15,kneeOut:0.6,G:[0,76,10],D:norm([0,-0.6,-0.8])};
  const fwd={P:STAND.P,pitch:0,feet:WIDE,G:[0,108,34],D:norm([0,0.45,0.9]),pass:true};
  return [[0.5,drop],[0.95,back],[1.1,{}],[1.5,fwd],[1.85,atOrder(TALL)],[2.05,{}]];
}
function twoClean(){return [[0,C_TWO],[0.25,{}]].concat(cleanKF()).concat([[2.45,Object.assign({},UPRIGHT,C_ORDER2)],[2.6,{}]])}
function gamma(){
  // Two hands. Arm cast over the lead (left) shoulder; then, with the club still hanging behind, carry the
  // hands over the top of the head to the right shoulder (no swing of the club) and pull it over that
  // shoulder to order on the right. both() comes back the other way.
  const backR={G:[-9,177,-4],D:norm([-0.08,-0.9,-0.42]),eL:[0.2,1,0.1],eR:[-0.4,-0.5,1]};
  const over={G:[0,181,-6],D:norm([0,-0.9,-0.43]),eL:[0.5,1,0.2],eR:[-0.5,1,0.2],pass:true};
  const pullR={G:[-11,162,8],D:norm([-0.05,0.8,-0.6]),eL:[0.3,1,0.2],eR:[-0.4,-0.5,1],pass:true};
  const orderR={G:[-9,124,22],D:[0,1,0],eL:[1,-1,-0.25],eR:[-1,-1,-0.25]};
  return [[0,Object.assign({},C_TWO,AC2.order)],[0.3,{}],[0.7,ac2('tip')],[1.05,ac2('back')],[1.25,{}],
    [1.65,over],[2.05,backR],[2.25,{}],[2.6,pullR],[2.95,orderR],[3.15,{}]];
}
function swingSquat(){
  // From order, cast forward into a swing with the arms locked out, then catch the club back in order as
  // you sit into the squat; stand and return to order.
  const cast={P:STAND.P,G:[0,132,48],D:norm([0,0.15,1]),eL:[1,-0.5,0],eR:[-1,-0.5,0],pass:true};
  const low={P:[0,90,-4],pitch:14,feet:WIDE,turn:15,G:[0,92,34],D:norm([0,-0.85,-0.5]),pass:true};
  const up={G:[0,118,44],D:norm([0,0.9,0.45]),pass:true};
  return [[0,C_TWO],[0.25,{}],[0.65,cast],[1.05,low],[1.4,up],[1.85,atOrder(SQUAT)],[2.1,{}],[2.8,atOrder(TALL)],[2.95,{}],
    [3.3,Object.assign({},UPRIGHT,C_ORDER2)],[3.5,{}]];
}
function castFlag(){
  // Two hands, order on the lead (left, top hand) side. The two-hand arm cast exactly as in its own demo:
  // cast over the left shoulder, club behind, and pull it back over; then press it straight out in front at
  // shoulder height, club upright, exactly like the two-hand flag press, and back to order. both() does the other side.
  const flag={G:[6,136,50],D:norm([0,1,0.05]),eL:[1,-0.3,0],eR:[-1,-0.3,0]};   // the two-hand flag press's end position
  return [[0,Object.assign({},C_TWO,AC2.order)],[0.3,{}],[0.7,ac2('tip')],[1.05,ac2('back')],[1.3,{}],[1.65,ac2('pull')],
    [2.0,flag],[2.3,{}],[2.85,ac2('order')],[3.05,{}]];
}
function cleanPress(){
  // Clean to order, then drive the club forward and up to straight arms, still upright; lower to order.
  const top={G:[7,180,24],D:[0,1,0],eL:[1,-0.2,0],eR:[-1,-0.2,0]};
  return [[0,C_TWO],[0.25,{}]].concat(cleanKF()).concat([[2.65,top],[2.9,{}],[3.55,atOrder(TALL)],[3.75,{}],
    [4.1,Object.assign({},UPRIGHT,C_ORDER2)],[4.3,{}]]);
}
// Reverse lunge arm cast (Chris): the mace's reverse lunge with a club. Arm cast as you step back into the
// lunge with the lead side leg (one hand: the working hand's leg; two hands: the top hand's leg), club hanging
// behind at the bottom; pull it back over the shoulder to order as you stand and step back to the start.
function lungeBody(leg,f){                         // f: 0 standing, 1 bottom of the reverse lunge (as the mace demo)
  const back=leg==='L'?'L':'R',front=back==='L'?'R':'L',x=back==='L'?12:-12;
  const lift=f>0&&f<0.8?20*Math.sin(Math.PI*f/0.8):0;   // the stepping foot leaves the floor, travels, lands; then the body lowers
  const feet={};feet[back]=[x,8+7*f+lift,-94*f];feet[front]=[-x,8,6*f];
  const o={P:[0,94-40*f*f,-36*f],pitch:5*f,yaw:0,hipYaw:0,roll:0,feet,turn:8,fyL:0,fyR:0,tL:0,tR:0};
  o['t'+back]=f>0.9?1:0;return o;
}
function lungeArmCast(two){
  const leg=two?'L':'R',base=two?C_TWO:C_ONE;
  const H=two?{tip:AC2.tip,back:AC2.back,pull:AC2.pull,order:AC2.order}:{
    tip:{G:[-15,150,10],D:norm([-0.05,0.3,-0.95]),eR:[-0.3,0.6,1]},
    back:{G:[-15,160,-2],D:norm([0.1,-0.9,-0.42]),eR:[-0.3,0.6,1]},
    pull:{G:[-15,154,10],D:norm([0,0.8,-0.6]),eR:[-0.3,0.6,1]},
    order:C_ORDER1};
  const at=(f,k,pass)=>{const src=Object.assign({},base,H[k],{W:[1,0,0]});const o=carry(lungeBody(leg,f),src);delete o.W;if(pass)o.pass=true;else delete o.pass;return o};
  const mix=(f,k1,k2,w)=>{const a=at(f,k1,true),b=at(f,k2,true);a.G=add(mul(a.G,1-w),mul(b.G,w));a.D=norm(add(mul(a.D,1-w),mul(b.D,w)));return a};
  return [[0,base],[0.3,{}],[0.6,mix(0.3,'order','tip',0.6)],[0.85,at(0.6,'tip',true)],[1.2,at(1,'back')],[1.45,{}],
    [1.75,at(0.6,'pull',true)],[2.0,mix(0.3,'pull','order',0.6)],[2.3,at(0,'order')],[2.55,{}]];
}
// Forward lunge flag press (Chris): the mace front lunge with a club. Step forward into the lunge with the lead
// side leg as the club is pressed straight out in front (one hand or two); come back to order as you step back
// to the starting stance.
function fwdLungeBody(leg,f){                      // f: 0 standing, 1 bottom of the front lunge (as the mace demo)
  const back=leg==='L'?'R':'L',x=leg==='L'?12:-12;
  const lift=f>0&&f<0.8?20*Math.sin(Math.PI*f/0.8):0;   // the stepping foot leaves the floor, travels, lands; then the body lowers
  const feet={};feet[leg]=[x,8+lift,72*f];feet[back]=[-x,8+7*f,-18*f];
  const o={P:[0,94-40*f*f,26*f],pitch:4*f,yaw:0,hipYaw:0,roll:0,feet,turn:8,fyL:0,fyR:0,tL:0,tR:0};
  o['t'+back]=f>0.6?1:0;return o;
}
function lungeFlagPress(two){
  const leg=two?'L':'R',base=two?C_TWO:C_ONE;
  const H=two?{order:C_ORDER2,out:{G:[6,136,50],D:norm([0,1,0.05]),eL:[1,-0.3,0],eR:[-1,-0.3,0]}}
             :{order:C_ORDER1,out:{G:[-16,136,56],D:norm([0,1,0.05]),eR:[-1,-0.3,0]}};
  const at=(f,k)=>{const o=carry(fwdLungeBody(leg,f),Object.assign({},base,H[k],{W:[1,0,0]}));delete o.W;delete o.pass;return o};
  const half=f=>{const o=carry(fwdLungeBody(leg,f),Object.assign({},base,H.order,{W:[1,0,0]}));const q=carry(fwdLungeBody(leg,f),Object.assign({},base,H.out,{W:[1,0,0]}));
    o.G=mul(add(o.G,q.G),0.5);o.D=norm(add(o.D,q.D));delete o.W;o.pass=true;return o};
  return [[0,base],[0.3,{}],[0.6,half(0.3)],[0.85,half(0.6)],[1.2,at(1,'out')],[1.5,{}],[1.8,half(0.6)],[2.05,half(0.3)],[2.35,at(0,'order')],[2.6,{}]];
}
// Clock squat (Chris), one hand or two. Built for a right lead (two hands: mirrored to a left lead, top hand
// on the lead side). From order, cast out into an outside circle and bring the club to rest across the
// opposite shoulder, close to horizontal and behind the head so the weight is centred; squat. As you stand,
// cast it out from that side into another circle and rest it across the lead shoulder; squat again. Stand
// and return to order.
function clockSquat(two){
  const B=(yaw,extra)=>Object.assign({},TALL,{yaw,hipYaw:yaw*0.35},extra||{});
  const eLof=e=>[-e[0],e[1],e[2]];
  const hands=o=>{if(two){o.offL=0;o.offR=0;o.eL=o.eL||eLof(o.eR)}else o.freeL=[21,87,3];return o};
  const anchor=b=>two?mul(add(shoulderOf(b,'R'),shoulderOf(b,'L')),0.5):shoulderOf(b,'R');
  const armR=(b,u,D,extra)=>hands(Object.assign({},b,{G:add(anchor(b),mul(norm(u),two?35:55)),D:norm(D),eR:[-1,-0.3,-0.2]},extra||{}));
  // resting across a shoulder: handle on top of that shoulder, club pointing across and behind the neck
  const restL={G:two?[20,146,8]:[15,147,1],D:norm([-0.92,0.03,-0.4]),eR:[0.1,-0.4,1]};
  const restR={G:two?[-21,146,9]:[-16,148,2],D:norm([0.92,0.03,-0.4]),eR:[-0.6,-0.2,1]};
  const onTall=src=>hands(Object.assign({},TALL,src));
  const onSquat=src=>{const h=hands(Object.assign({},TALL,src,{W:[1,0,0]}));const o=carry(SQUAT,Object.assign({eL:eLof(h.eR)},h));delete o.W;if(!two)delete o.eL;return o};
  const start=hands(Object.assign({},STAND,CB2,two?{G:[-7,124,22],D:[0,1,0],eR:[-1,-1,-0.25]}:C_ORDER1));
  if(!two)Object.assign(start,{offL:1});
  // first circle: out to the lead side, down, across the front, up the far side, onto the far shoulder
  const c1=[armR(B(10),[-0.95,-0.05,0.3],[-0.75,0.6,0.2],{pass:true}),
    armR(B(-2),[-0.6,-0.72,0.35],[-0.55,-0.8,0.25],{pass:true}),
    armR(B(-4,{P:[0,90,-2],pitch:6}),[0.1,-0.92,0.38],[0.05,-1,0.15],{pass:true}),
    armR(B(-10),[0.6,-0.55,0.58],[0.7,-0.6,0.3],{pass:true}),
    armR(B(-8),[0.55,0.1,0.82],[0.3,0.85,-0.2],{pass:true})];
  // second circle: from the far shoulder out to that side, down, across, up the lead side, onto the lead shoulder
  const c2=[armR(B(-10),[0.8,0.05,0.6],[0.75,0.6,0.2],{pass:true}),
    armR(B(2),[0.55,-0.7,0.48],[0.55,-0.8,0.25],{pass:true}),
    armR(B(4,{P:[0,90,-2],pitch:6}),[-0.05,-0.92,0.38],[-0.05,-1,0.15],{pass:true}),
    armR(B(10),[-0.65,-0.55,0.5],[-0.7,-0.6,0.3],{pass:true}),
    armR(B(8),[-0.75,0.15,0.62],[-0.3,0.85,-0.2],{pass:true})];
  const kf=[[0,start],[0.3,{}],[0.6,c1[0]],[0.85,c1[1]],[1.05,c1[2]],[1.25,c1[3]],[1.45,c1[4]],[1.75,onTall(restL)],[1.95,{}],
    [2.8,onSquat(restL)],[3.05,{}],[3.85,onTall(restL)],
    [4.15,c2[0]],[4.4,c2[1]],[4.6,c2[2]],[4.8,c2[3]],[5.0,c2[4]],[5.15,onTall({G:two?[-14,148,16]:[-14,152,10],D:norm([0.55,0.6,-0.55]),eR:[-0.7,-0.3,1],pass:true})],[5.3,onTall(restR)],[5.5,{}],
    [6.35,onSquat(restR)],[6.6,{}],[7.4,onTall(restR)],[7.55,{}],[7.8,onTall({G:[-13,136,12],D:norm([0.45,0.75,-0.45]),eR:[-0.8,-0.7,0.5],pass:true})],[8.05,Object.assign({},start)],[8.25,{}]];
  return two?mirrorKF(kf,false):kf;
}
// Bullwhip (Chris), one hand only (right; both() gives the left). Cast out into an outside circle and rotate
// the torso to the far side as the club comes across; the wrist turns so the hand rises up that far side with
// the club hanging down. The hand passes the far-side ear and the club half mills behind the head (the small
// circle), is pulled over the lead shoulder and cast out into an inside circle. The inside circle swings the
// club out to a straight arm at shoulder height on the lead side and straight back into the outside circle
// for the next rep; after the last rep it comes back to order.
function bullwhip(){
  const os=outsideSwing(),is=insideSwing(),P=x=>Object.assign({},x,{pass:true});
  const farLow=armAt(body(30,-4),[0.75,-0.35,0.55],[0.35,-0.92,0.15],{eR:[0.3,-0.8,0.6],pass:true});
  const farHigh=Object.assign({},body(28,-4),{G:[20,156,10],D:norm([0.12,-0.97,0.15]),eR:[0.2,0.1,1],freeL:[22,92,6],pass:true});
  const pastEar=Object.assign({},body(18,-3),{G:[2,172,-2],D:norm([0.3,-0.85,-0.45]),eR:[0.1,0.7,0.7],freeL:[22,92,6],pass:true});
  const left=Object.assign({},body(6,0),{G:[-11,166,-3],D:norm([0.9,-0.1,-0.42]),eR:[-0.3,0.7,0.8],freeL:[22,92,6],pass:true});
  const up=Object.assign({},body(-4,0),{G:[-18,166,0],D:norm([-0.25,0.88,-0.4]),eR:[-0.4,0.6,0.8],freeL:[22,92,6],pass:true});
  const over=Object.assign({},body(-6,1),{G:[-18,152,20],D:norm([-0.25,0.7,0.66]),eR:[-1,-0.6,0.2],freeL:[22,92,6],pass:true});
  const whip=[farLow,farHigh,pastEar,left,up,over];
  const kf=circleStart(-1);let t=kf[kf.length-1][0]+0.25;
  const add_=(poses,dt)=>{for(const p of poses){kf.push([t,P(p)]);t+=dt}};
  add_(os.slice(0,4),0.26);add_(whip,0.28);          // rep 1: outside circle, far side, half mill, over the lead shoulder
  add_(is,0.26);                                     // inside circle out to a straight arm at shoulder height
  add_(os.slice(1,4),0.26);add_(whip,0.28);          // straight back into the outside circle: rep 2
  kf.push([t+0.15,Object.assign({},UPRIGHT,C_ONE)],[t+0.35,{}]);
  return kf;
}
// H2H clean (hand to hand), two hands, a switch move. Built from a right lead (right hand on top, club on the
// right); both() gives the way back. From order, a two-hand front swing: cast forward, down and back between
// the legs, then drive the hips. On the way back up the bottom hand lets go and the club slides out until the
// top hand rests against the pommel; the loose hand takes hold again above it, so it is now the top (lead)
// hand, and the club comes to order on that side.
function h2hClean(){
  const eTwo={eL:[1,-0.5,0],eR:[-1,-0.5,0]};
  const start=Object.assign({},STAND,CB2,{gL:0,gR:7,G:[-7,124,22],D:[0,1,0],eL:[1,-1,-0.25],eR:[-1,-1,-0.25]});
  const cast=Object.assign({G:[0,128,46],D:norm([0,0.2,1]),pass:true},eTwo);
  const low=Object.assign({P:[0,88,-6],pitch:24,feet:WIDE,turn:15,kneeOut:0.5,G:[0,84,24],D:norm([0,-0.8,-0.5]),pass:true},eTwo);
  const back=Object.assign({P:[0,84,-8],pitch:38,feet:WIDE,turn:15,kneeOut:0.6,G:[0,76,10],D:norm([0,-0.6,-0.8])},eTwo);
  // driving up: the bottom (left) hand lets go and stays close to the club
  const fwd=Object.assign({},TALL,{G:[0,106,34],D:norm([0,0.4,0.9]),offL:1,freeL:[10,104,30],pass:true},eTwo);
  // the club slides through the top hand until that hand rests on the pommel
  const slide=Object.assign({},TALL,{G:[1,116,34],D:norm([0,0.78,0.62]),gR:0,offL:1,freeL:[10,124,32],eR:[-1,-0.7,0.1],eL:[1,-0.8,0.2],pass:true});
  // the loose hand takes hold above it and becomes the top hand
  const regrip=Object.assign({},TALL,{G:[3,120,28],D:norm([0,0.95,0.3]),gR:0,gL:7,offL:0,eL:[1,-1,-0.1],eR:[-1,-1,-0.1],pass:true});
  const order=Object.assign({},UPRIGHT,{G:[7,124,22],D:[0,1,0],gR:0,gL:7,offL:0,offR:0,eL:[1,-1,-0.25],eR:[-1,-1,-0.25]});
  return [[0,start],[0.25,{}],[0.6,cast],[0.95,low],[1.15,back],[1.3,{}],[1.65,fwd],[1.9,slide],[2.15,regrip],[2.45,order],[2.65,{}]];
}
// ---- two clubs: the right club is G/D, the left club G2/D2 (left hand on its pommel) ----
// the same club position in both hands, mirrored, on a square body
function dblClub(p){
  if(!Object.keys(p).length)return {};
  const m=mirror(p),o=Object.assign({},p,{offL:0,offR:0});
  if('yaw' in p||'P' in p){o.yaw=0;o.hipYaw=0}
  if(p.P)o.P=[0,p.P[1],p.P[2]];
  if(p.G){o.G2=m.G;o.D2=m.D}
  if(p.eR)o.eL=m.eL;
  if(p.lock)o.lock='2';
  return o;
}
// Double swipe (Chris): a club in each hand, both sides swipe at the same time
function doubleSwipe(){return swipe().map(([t,p])=>[t,dblClub(p)])}
// Double mill (Chris): a club in each hand. Each hand on its own does a full mill over and over (inside
// circle, then the half mill behind the head, then straight into the next inside circle); the two hands are
// half a cycle apart, so one does the inside circle while the other does the half mill, then they swap.
function doubleMill(){
  const B=Object.assign({},CB_BODY);
  const at=(u,D,eR)=>({G:add(shoulderOf(B,'R'),mul(norm(u),50)),D:norm(D),eR:eR||[-0.4,-0.6,0.6]});
  const C=[at([0.55,0.05,0.83],[0.8,0.35,0.45]),at([0.35,-0.5,0.8],[0.4,-0.82,0.42]),at([-0.1,-0.78,0.62],[-0.1,-0.95,0.3]),
    at([-0.72,-0.42,0.55],[-0.9,-0.3,0.3]),at([-0.95,0,0.32],[-0.6,0.76,0.25]),           // inside circle
    {G:[-36,160,8],D:norm([-0.1,1,-0.05]),eR:[-1,-0.3,-0.2]},{G:[-26,166,-2],D:norm([0.55,0.1,-0.83]),eR:[-1,0.2,0.3]},
    {G:[-15,160,-2],D:norm([0.15,-0.9,-0.4]),eR:[-0.3,0.6,1]},{G:[-16,158,6],D:norm([-0.92,-0.2,-0.3]),eR:[-0.3,0.6,1]},
    {G:[-15,146,26],D:norm([-0.3,0.65,0.7]),eR:[-1,-0.6,0.2]}];                        // half mill
  const N=C.length,both=i=>{const r=C[i%N],l=mirror(C[(i+N/2)%N]);
    return Object.assign({},B,{G:r.G,D:r.D,eR:r.eR,G2:l.G,D2:l.D,eL:l.eL,pass:true})};
  const order=Object.assign({},STAND,CB2,{G:C_ORDER1.G,D:[0,1,0],eR:C_ORDER1.eR,G2:mx(C_ORDER1.G),D2:[0,1,0],eL:mx(C_ORDER1.eR),offL:0,offR:0,gR:0,gL:0});
  const kf=[[0,order],[0.3,{}]];let t=0.75;
  for(let i=0;i<2*N;i++){kf.push([t,both(i)]);t+=0.28}
  kf.push([t+0.2,Object.assign({},UPRIGHT,{G:C_ORDER1.G,D:[0,1,0],eR:C_ORDER1.eR,G2:mx(C_ORDER1.G),D2:[0,1,0],eL:mx(C_ORDER1.eR)})],[t+0.45,{}]);
  return kf;
}
// Front lever hold (Chris): a single flag press with a pause at extension. One hand.
function frontLever(){
  const out={G:[-16,136,56],D:norm([0,1,0.05]),eR:[-1,-0.3,0]};
  return [[0,C_ONE],[0.3,{}],[0.8,out],[2.6,{}],[3.1,Object.assign({},C_ORDER1)],[3.3,{}]];
}
// Side lever hold (Chris): a single side press, the flag press straight out to the side with a straight arm,
// club upright, with a pause at extension. One hand.
function sideLever(){
  const out={G:add(shoulderOf(STAND,'R'),[-54,-3,3]),D:norm([-0.05,1,0]),eR:[0,-1,0.4],freeL:[21,87,3]};
  return [[0,C_ONE],[0.3,{}],[0.85,out],[2.65,{}],[3.2,Object.assign({},C_ORDER1)],[3.4,{}]];
}
function clubBarbarian(){
  // Start with the two-hand arm cast over the lead (left) shoulder. As the club is pulled back to the front,
  // sink into the squat and lock the arms out, club upright in front. Arm cast again as you stand, and
  // repeat; finish standing in order.
  const lock=pose=>Object.assign({G:onBody(pose,7,42,50),D:[0,1,0],eL:[1,-0.4,0],eR:[-1,-0.4,0]},pose);
  const MID={P:[0,76,-8],pitch:11,yaw:0,hipYaw:0,feet:WIDE,turn:15,kneeOut:0.4};
  const onMid=k=>{const o=carry(MID,Object.assign({},AC2[k],{W:[1,0,0]}));delete o.W;return o};
  const tall=k=>Object.assign({},TALL,AC2[k]);
  return [[0,Object.assign({},C_TWO,AC2.order)],[0.3,{}],[0.7,tall('tip')],[1.05,tall('back')],[1.3,{}],
    [1.7,onMid('pull')],[2.15,lock(SQUAT)],[2.35,{}],
    [2.8,onMid('tip')],[3.2,tall('back')],[3.4,{}],
    [3.8,onMid('pull')],[4.25,lock(SQUAT)],[4.45,{}],[5.15,lock(TALL)],[5.3,{}],[5.65,Object.assign({},UPRIGHT,C_ORDER2)],[5.85,{}]];
}
function orderSquat(){
  return [[0,C_TWO],[0.3,atOrder(TALL)],[0.45,{}],[1.25,atOrder(SQUAT)],[1.5,{}],[2.3,atOrder(TALL)],[2.45,{}],
    [2.8,Object.assign({},UPRIGHT,C_ORDER2)],[3.0,{}]];
}

/* ---------- kettlebell ----------
   From Chris's lesson notes (Mark Wildman, Wildman Athletica, kettlebell lessons 1 to 4): two-hand deadlift,
   two-hand swing, around the world and the single-direction halo. */
const KFEET={L:[16,8,0],R:[-16,8,0]};
const KB=Object.assign({},STAND,{kb:1,feet:KFEET,turn:0,kneeOut:0.35,W:[1,0,0],hR:-4.5,hL:4.5,hD:0,offL:0,offR:0,
  eL:[1,0,-0.6],eR:[-1,0,-0.6]});
// middle of the shoulders for a pose, and the handle point reached with straight arms in a direction
function shoulderMid(p){const F=torsoFrame(p.P,p.pitch||0,p.yaw||0,p.roll||0,p.twist||0);return add(add(p.P,mul(F.u,TORSO)),mul(F.u,-4))}
const armsTo=(p,dir,reach=53)=>add(shoulderMid(p),mul(norm(dir),reach));
const kbArms=(pose,dir,reach)=>Object.assign({},pose,{G:armsTo(pose,dir,reach),D:norm(dir)});

function kbDeadlift(){
  // Feet shoulder-width, toes straight, bell between the insteps. Hips back to about knee height, torso
  // about 45 degrees, knees behind the toes, arms hanging straight. Stand all the way up, then touch down.
  const bottom=Object.assign({},KB,{P:[0,54,-34],pitch:54,G:[0,25.5,3],D:[0,-1,0]});
  const top=kbArms(Object.assign({},KB,{P:[0,94,0],pitch:0}),[0,-1,0.22]);
  const mid=Object.assign(kbArms(Object.assign({},KB,{P:[0,72,-17],pitch:27}),[0,-1,0.06]),{pass:true});
  return [[0,bottom],[0.35,{}],[0.8,mid],[1.25,top],[1.75,{}],[2.2,mid],[2.65,bottom],[3.0,{}],[3.45,mid],[3.9,top],[4.4,{}],[4.85,mid],[5.3,bottom],[5.6,{}]];
}
function kbSwing(){
  // Bell about 40 cm in front. Hinge, reach out with straight arms and tip it toward you. Hike it back high
  // between the thighs, snap the hips and stand tall so it floats to about chest height on straight arms.
  // On the last back-swing, track it out in front and park it, then stand up.
  const floorG=[0,23.6,32.8],floorD=norm([0,-0.876,0.482]);
  const standFree=Object.assign({},KB,{G:floorG,D:floorD,offL:1,offR:1,freeL:[20,86,2],freeR:[-20,86,2],eL:[1,-0.4,-0.6],eR:[-1,-0.4,-0.6]});
  const setup=Object.assign({},KB,{P:[0,62,-32],pitch:74,G:floorG,D:floorD,eL:[1,0.3,-0.3],eR:[-1,0.3,-0.3]});
  const hike=kbArms(Object.assign({},KB,{P:[0,74,-20],pitch:48}),[0,-0.766,-0.643]);
  const pass=Object.assign(kbArms(Object.assign({},KB,{P:[0,88,-8],pitch:18}),[0,-1,0.35]),{pass:true});
  const top=kbArms(Object.assign({},KB,{P:[0,94,0],pitch:0}),[0,-0.08,1]);
  const rep=t=>[[t,pass],[t+0.28,top],[t+0.56,pass],[t+0.84,hike]];
  const reach=Object.assign({},setup,{offL:1,offR:1,freeL:[16,46,16],freeR:[-16,46,16]});   // hands near the knees, about to grip
  let kf=[[0,standFree],[0.35,{}],[1.15,reach],[1.4,setup],[1.6,{}],[2.05,hike]];
  for(let i=0;i<3;i++)kf=kf.concat(rep(2.05+0.84*i+0.0001).slice(0));
  const end=kf[kf.length-1][0];
  return kf.concat([[end+0.45,setup],[end+0.65,{}],[end+0.85,reach],[end+1.65,standFree],[end+1.95,{}]]);
}
function kbAroundTheWorld(){
  // Feet together, legs straight, bell hanging in front of the hips in both hands. The right hand takes it
  // round the right hip; swap thumb to thumb behind the back; the left hand brings it round the left hip and
  // they swap in front. Two laps one way, then two the other.
  const base=Object.assign({},KB,{feet:{L:[5,8,0],R:[-5,8,0]},P:[0,94,0],kneeOut:0.1,pitch:0,roll:0});
  const at=th=>{const r=th*Math.PI/180,c=Math.cos(r),sn=Math.sin(r);
    return {G:[-25*sn,89,c>=0?15*c:18*c],D:[0,-1,0],
      pitch:-1.5*c,roll:3*sn,P:[1.5*sn,94,1.5*c]}};   // lean a little away from the bell
  const both={hR:-3,hL:3,offL:0,offR:0},rightOnly={hR:0,offL:1,offR:0},leftOnly={hL:0,offR:1,offL:0};
  const lap=t0=>[
    [t0,Object.assign(at(0),both)],[t0+0.18,Object.assign(at(12),rightOnly,{pass:true})],
    [t0+0.42,Object.assign(at(60),{pass:true})],[t0+0.66,Object.assign(at(110),{pass:true})],
    [t0+0.9,Object.assign(at(160),{offL:0.5,pass:true})],[t0+1.05,Object.assign(at(180),both)],
    [t0+1.2,Object.assign(at(200),leftOnly,{pass:true})],[t0+1.44,Object.assign(at(250),{pass:true})],
    [t0+1.68,Object.assign(at(300),{pass:true})],[t0+1.92,Object.assign(at(345),{offR:0.5,pass:true})],[t0+2.1,Object.assign(at(360),both)]];
  const one=[[0,Object.assign({},base,at(0),both)],[0.3,{}]].concat(lap(0.3).slice(1),lap(2.4).slice(1),[[4.7,{}]]);
  return chain(one,mirrorKF(one));
}
function kbHalo(){
  // Bell upside down by the horns in front of the chest: elbows on the body, forearms flat. The right hand
  // goes past the left ear, the bell circles behind the head close to the nape and comes back to the front.
  // Pause, and after two the left hand leads past the right ear.
  const base=Object.assign({},KB,{P:[0,94,0],pitch:0,hR:-8,hL:8,hD:5}),at=haloAt;
  const rep=(t0,dir)=>{const out=[];for(let i=1;i<=8;i++)out.push([t0+0.26*i,Object.assign(at(dir*45*i),{pass:i<8})]);return out};
  const kf=[[0,Object.assign({},base,at(0))],[0.3,{}]].concat(rep(0.3,1),[[2.68,{}]],rep(2.68,1),[[5.06,{}]],
    rep(5.06,-1),[[7.44,{}]],rep(7.44,-1),[[9.82,{}]]);
  return kf;
}
function haloAt(deg){{const r=deg*Math.PI/180,c=Math.cos(r),sn=Math.sin(r),k=(1-c)/2;
    const rad=c>=0?lerp(19,29,c):lerp(19,14,-c);
    const H=[sn*rad,106+54*Math.sqrt(k),c*rad];
    const D=norm(add(mul([0,1,0],c),mul([sn,0,c],Math.abs(sn)*0.9+0.25)));
    return {G:sub(H,mul(D,5)),D,W:[Math.cos(r),0,-Math.sin(r)],
      eL:norm(vl([0.3,-1,0],[0.4,0.7,0.7],k)),eR:norm(vl([-0.3,-1,0],[-0.4,0.7,0.7],k))}}
}

/* one-hand kettlebell work (lessons 5-16). Positions are for the right hand; mirror() gives the left. */
function shoulderOf(p,side){const F=torsoFrame(p.P,p.pitch||0,p.yaw||0,p.roll||0,p.twist||0);
  return add(add(add(p.P,mul(F.u,TORSO)),mul(F.l,side==='L'?17:-17)),mul(F.u,-4))}
const UP_KB=Object.assign({},KB,{P:[0,94,0],pitch:0,yaw:0,roll:0,hipYaw:0});
const ONE_R={hR:0,hL:0,offL:1,offR:0,freeL:[20,86,2]};                 // right hand only, left arm down
// the rack: hand vertical with the thumb at collarbone height, elbow tucked to the hip, handle 45 degrees
// down across the palm, bell resting on the outside of the forearm below the shoulder joint
const RACK_R=Object.assign({},UP_KB,ONE_R,{G:[-6,134,12],D:norm([-15,-11,-9]),W:norm([0.35,-0.45,0.82]),eR:[0,-1,0]});
const rackHandR=RACK_R.G;
// overhead lockout: arm straight up beside the head, bell sitting behind the hand
const LOCK_R=Object.assign({},UP_KB,ONE_R,{G:[-14,190,-1],D:norm([-0.25,-0.55,-0.8]),W:norm([0.2,-0.6,0.75]),eR:[-1,0,0]});
// press half-way: elbow coming away from the body as the bell rises
const PRESS_MID_R=Object.assign({},UP_KB,ONE_R,{G:[-21,168,3],D:norm([-0.35,-0.75,-0.55]),W:norm([0.2,-0.5,0.85]),eR:[-0.7,-0.7,0.1],pass:true});
// one hand, straight arm from the right shoulder in a direction (bell beyond the hand along the arm)
const perpTo=(D,h)=>{const d=norm(D);return norm(sub(h,mul(d,dot(h,d))))};
function armR(pose,dir,reach=54,hint=[0,0,1]){const d=norm(dir);return Object.assign({},pose,{G:add(shoulderOf(pose,'R'),mul(d,reach)),D:d,W:perpTo(d,hint)})}
// slide a whole pose (or keyframes) forward along the floor
function moveZ(p,dz){const o=Object.assign({},p),f=v=>v&&[v[0],v[1],v[2]+dz];
  for(const k of ['P','G','freeL','freeR'])if(p[k])o[k]=f(p[k]);if(p.feet)o.feet={L:f(p.feet.L),R:f(p.feet.R)};return o}
const moveZKF=(kf,dz)=>kf.map(([t,p])=>[t,moveZ(p,dz)]);

// shared pieces: free hands hanging from the shoulders, the floor spots, hinge depths
const freeL_=p=>Object.assign({},p,{offL:1,freeL:add(shoulderOf(p,'L'),[4,-52,6])});
const free_=p=>Object.assign({},freeL_(p),{offR:1,freeR:add(shoulderOf(p,'R'),[-4,-52,6])});
const R1=p=>freeL_(Object.assign({},p,{hR:0,hL:0,offR:0}));                    // right hand on, left hangs
const FLOOR_IN={G:[0,25.5,3],D:[0,-1,0],W:[1,0,0]};                             // between the insteps
const FLOOR_AHEAD=(()=>{const D=norm([0,-0.876,0.482]);return {G:[0,23.6,32.8],D,W:perpTo(D,[0,0,1])}})(); // tipped, handle pointing away
const DL_P={P:[0,54,-34],pitch:54},SET_P={P:[0,62,-32],pitch:74},HIKE_P={P:[0,76,-20],pitch:45},PASS_P={P:[0,88,-8],pitch:18};
const TWO={hR:-3,hL:3,offL:0,offR:0,W:[1,0,0]};
const DL_MID2=Object.assign(kbArms(Object.assign({},UP_KB,TWO,{P:[0,72,-17],pitch:27}),[0,-1,0.06]),{W:[1,0,0],pass:true});
// two hands: floor between the insteps -> deadlift up -> curl into the right rack, left hand cupped under
function pickupToRack(){
  const flStand=free_(Object.assign({},UP_KB,FLOOR_IN));
  const dlBot=Object.assign({},UP_KB,DL_P,FLOOR_IN,TWO,{eL:[1,0,-0.6],eR:[-1,0,-0.6]});
  const dlTop=kbArms(Object.assign({},UP_KB,TWO),[0,-1,0.22]);
  const curl=Object.assign({},UP_KB,TWO,{G:[-4,114,22],D:[0,-1,0.1],eL:[1,-1,0],eR:[-1,-1,0],pass:true});
  const rackSup=Object.assign({},RACK_R,{freeL:add(RACK_R.G,[3,-9,4]),eL:[1,-1,0]});
  return [[0,flStand],[0.3,{}],[1.1,dlBot],[1.3,{}],[1.65,DL_MID2],[2.0,dlTop],[2.35,curl],[2.75,rackSup],[3.15,{}],[3.45,Object.assign({},RACK_R)],[3.6,{}]];
}
// from the right rack: the other hand grabs, both arms straighten, set it down between the insteps, stand
function setDownFromRack(){
  const rackBoth=Object.assign({},RACK_R,{hL:4,offL:0,eL:[1,-1,0]});
  const dlTop=kbArms(Object.assign({},UP_KB,TWO),[0,-1,0.22]);
  const dlBot=Object.assign({},UP_KB,DL_P,FLOOR_IN,TWO,{eL:[1,0,-0.6],eR:[-1,0,-0.6]});
  return [[0,rackBoth],[0.3,{}],[0.75,dlTop],[1.15,DL_MID2],[1.55,dlBot],[1.75,{}],[2.45,free_(Object.assign({},UP_KB,FLOOR_IN))],[2.7,{}]];
}
// right-hand swing and clean positions
const HIKE_R=R1(armR(Object.assign({},UP_KB,HIKE_P,{eR:[-1,0,-0.5]}),[0.25,-0.8,-0.55]));      // forearm on the high inner thigh
const SWPASS_R=Object.assign(R1(armR(Object.assign({},UP_KB,PASS_P),[0.12,-1,0.3])),{pass:true});
const SWTOP_R=R1(armR(Object.assign({},UP_KB),[0.15,-0.7,0.7]));                               // about 45 degrees below level
const PINNED_R=Object.assign(R1(Object.assign({},UP_KB,{G:[-12,104,31],D:norm([0,-0.85,0.5]),W:[1,0,0],eR:[0,-1,-0.2]})),{pass:true}); // elbow pinned, bell travelling out
const FLOAT_R=Object.assign(R1(Object.assign({},UP_KB,{G:[-8,108,24],D:norm([0,-0.9,-0.3]),W:[1,0,0],eR:[0,-1,0]})),{pass:true});      // stood up, bell close, about to land
const SWITCH_TOP=Object.assign(kbArms(Object.assign({},UP_KB,TWO),[0,-0.7,0.7]),{W:[1,0,0]});   // both hands at the top of a swing
const setOne=fl=>R1(Object.assign({},UP_KB,SET_P,fl,{eR:[-1,0.3,-0.3]}));
const reachFree=fl=>Object.assign(free_(Object.assign({},UP_KB,SET_P,fl)),{freeL:[16,46,16],freeR:[-16,46,16]});
const standFree=fl=>free_(Object.assign({},UP_KB,fl));
// cleans (Chris): a one-hand swing that brings the bell up into the rack in one movement: hike, swing
// through, the elbow pulls in so the bell rides up close, and it lands in the rack, all without a stop
const cleanUp=t=>[[t+0.27,SWPASS_R],[t+0.48,FLOAT_R],[t+0.7,RACK_R],[t+1.05,{}]];
const cleanRep=t=>[[t,PINNED_R],[t+0.3,HIKE_R]].concat(cleanUp(t+0.3));
// start a set from the floor: bell ahead, reach in, hike it back and clean it straight up into the rack
const cleanStart=()=>[[0,standFree(FLOOR_AHEAD)],[0.35,{}],[1.1,reachFree(FLOOR_AHEAD)],[1.35,setOne(FLOOR_AHEAD)],[1.55,{}],[2.0,HIKE_R]].concat(cleanUp(2.0));
// finish from the rack: drop into the swing and park the bell where it started
const cleanFinish=t=>[[t+0.3,PINNED_R],[t+0.6,HIKE_R],[t+1.05,setOne(FLOOR_AHEAD)],[t+1.25,{}],[t+1.45,reachFree(FLOOR_AHEAD)],[t+2.2,standFree(FLOOR_AHEAD)],[t+2.45,{}]];
const pressRep=(t,fist)=>[[t,Object.assign({},PRESS_MID_R,fist)],[t+0.55,Object.assign({},LOCK_R,fist)],[t+0.9,{}],
  [t+1.3,Object.assign({},PRESS_MID_R,fist)],[t+1.75,Object.assign({},RACK_R,fist)],[t+2.05,{}]];
const shift=(kf,dt)=>kf.map(([t,p])=>[t+dt,p]);
const endOf=kf=>kf[kf.length-1][0];

function kbFigure8(back){
  // Stance about 1.5 times shoulder width, feet straight. Front to back: the left hand passes the bell back
  // between the legs under the right leg, the right hand reaches round behind that leg and takes it thumb to
  // thumb, then stands tall and carries it round the right hip to the front; then right under left.
  // Back to front: the right hand passes it from behind forward under the right leg, the left hand meets it
  // in front, stands and carries it round the left hip to the back; then left under left.
  const feet={L:[24,8,0],R:[-24,8,0]};
  const up=Object.assign({},UP_KB,{feet,kneeOut:0.5});
  const low=Object.assign({},up,{P:[0,64,-24],pitch:58,kneeOut:0.9});
  const hang=(G,extra)=>Object.assign({D:[0,-1,0],W:[1,0,0]},{G},extra||{});
  const onlyR={hR:0,offL:1,offR:0},onlyL={hL:0,offR:1,offL:0},both={hR:-3,hL:3,offL:0,offR:0};
  const fr=(p,o)=>{const q=Object.assign({},p,o);if(q.offL)q.freeL=add(shoulderOf(q,'L'),[4,-52,6]);if(q.offR)q.freeR=add(shoulderOf(q,'R'),[-4,-52,6]);return q};
  let half;
  if(!back){
    half=[
      [0,fr(up,Object.assign(hang([0,89,15]),onlyL))],
      [0.5,fr(low,Object.assign(hang([0,52,10]),onlyL,{eL:[1,0.2,-0.6],pass:true}))],
      [0.85,fr(low,Object.assign(hang([-8,48,-12]),both,{eL:[1,0.2,-0.6],eR:[-1,0,0]}))],
      [1.05,{}],
      [1.25,fr(low,Object.assign(hang([-14,50,-12]),onlyR,{eR:[-1,0,0]}))],
      [1.5,fr(Object.assign({},up,{P:[0,76,-14],pitch:36,kneeOut:0.7}),Object.assign(hang([-18,66,-12]),onlyR,{eR:[-1,-0.2,-0.3],pass:true}))],
      [1.75,fr(up,Object.assign(hang([-21,86,-9]),onlyR,{eR:[-1,-0.3,-0.3],pass:true}))],
      [2.05,fr(up,Object.assign(hang([-26,88,4]),onlyR,{pass:true}))],
      [2.35,fr(up,Object.assign(hang([-6,89,15]),onlyR))],[2.55,{}]];
  }else{
    half=[
      [0,fr(up,Object.assign(hang([-16,88,-16]),onlyR,{eR:[-1,-0.3,-0.3]}))],
      [0.5,fr(low,Object.assign(hang([-12,48,-12]),onlyR,{eR:[-1,0,0],pass:true}))],
      [0.85,fr(low,Object.assign(hang([0,50,8]),onlyR,{eR:[-1,0,0],pass:true}))],
      [1.1,fr(low,Object.assign(hang([2,52,14]),both,{eL:[1,-0.2,-0.4],eR:[-1,0,0]}))],
      [1.3,fr(low,Object.assign(hang([4,52,14]),onlyL,{eL:[1,-0.2,-0.4]}))],
      [1.8,fr(up,Object.assign(hang([8,88,16]),onlyL,{pass:true}))],
      [2.1,fr(up,Object.assign(hang([26,88,2]),onlyL,{pass:true}))],
      [2.4,fr(up,Object.assign(hang([16,88,-16]),onlyL,{eL:[1,-0.3,-0.3]}))],[2.6,{}]];
  }
  const other=mirrorKF(half.slice(1));
  return half.concat(shift(other,endOf(half)-other[0][0]+0.3),[[endOf(half)*2+0.4,{}]]);
}
function kbAltHalo(){
  // The halo, changing direction every rep: right hand past the left ear, then left hand past the right ear.
  const base=Object.assign({},KB,{P:[0,94,0],pitch:0,hR:-8,hL:8,hD:5});
  const rep=(t0,dir)=>{const out=[];for(let i=1;i<=8;i++)out.push([t0+0.26*i,Object.assign(haloAt(dir*45*i),{pass:i<8})]);out.push([t0+2.38,{}]);return out};
  let kf=[[0,Object.assign({},base,haloAt(0))],[0.3,{}]],t=0.3;
  for(const d of [1,-1,1,-1]){kf=kf.concat(rep(t,d));t+=2.38}
  return kf;
}
function kbRackPickup(){
  // Two hands to the rack, one hand down: pick up with two hands, find the rack, touch the bell with the free
  // hand to check it, straighten the arm, thumb back, and lower it to the floor with one straight arm.
  const touch=Object.assign({},RACK_R,{freeL:[-6,124,20],eL:[1,-1,0]});
  const straight=R1(armR(Object.assign({},UP_KB),[0.12,-1,0.2],54,[1,0,0]));
  const lowR=R1(Object.assign({},UP_KB,DL_P,FLOOR_IN,{eR:[-1,0,-0.6]}));
  const midR=Object.assign(R1(armR(Object.assign({},UP_KB,{P:[0,72,-17],pitch:27}),[0.15,-1,0.06],54,[1,0,0])),{pass:true});
  const one=pickupToRack().concat([[4.1,touch],[4.6,{}],[4.95,Object.assign({},RACK_R)],[5.5,straight],[5.95,midR],[6.4,lowR],[6.6,{}],
    [7.3,standFree(FLOOR_IN)],[7.5,{}]]);
  return both(one);
}
function kbOneArmSwing(){
  // Baby single-arm swing: bell 12-18 inches ahead, handle pointing away. Reach in thumb down, hike it
  // back, snap up so the arm floats to about 45 degrees below level; forearm meets the inner thigh at the
  // bottom. Park it where it started. Then the other hand.
  let kf=[[0,standFree(FLOOR_AHEAD)],[0.35,{}],[1.1,reachFree(FLOOR_AHEAD)],[1.35,setOne(FLOOR_AHEAD)],[1.55,{}],[2.0,HIKE_R]];
  for(let i=0;i<3;i++){const t=2.0+1.1*i;kf=kf.concat([[t+0.27,SWPASS_R],[t+0.55,SWTOP_R],[t+0.82,SWPASS_R],[t+1.1,HIKE_R]])}
  const e=endOf(kf);
  kf=kf.concat([[e+0.45,setOne(FLOOR_AHEAD)],[e+0.65,{}],[e+0.85,reachFree(FLOOR_AHEAD)],[e+1.6,standFree(FLOOR_AHEAD)],[e+1.85,{}]]);
  return both(kf);
}
function kbHandToHand(){
  // Swing, and at the top, where the bell weighs almost nothing, roll the thumb up and let the other hand
  // take the free side of the handle thumb to thumb; go down with the new hand, thumb back.
  const HL=mirror(HIKE_R),PL=mirror(SWPASS_R),TL=mirror(SWTOP_R);
  let kf=[[0,standFree(FLOOR_AHEAD)],[0.35,{}],[1.1,reachFree(FLOOR_AHEAD)],[1.35,setOne(FLOOR_AHEAD)],[1.55,{}],[2.0,HIKE_R]];
  let t=2.0;const up=(pass,top)=>{kf=kf.concat([[t+0.27,pass],[t+0.55,top],[t+0.7,SWITCH_TOP]]);t+=0.7};
  const down=(pass,hike)=>{kf=kf.concat([[t+0.28,pass],[t+0.55,hike]]);t+=0.55};
  for(let i=0;i<2;i++){up(SWPASS_R,SWTOP_R);down(PL,HL);up(PL,TL);down(SWPASS_R,HIKE_R)}
  kf=kf.concat([[t+0.45,setOne(FLOOR_AHEAD)],[t+0.65,{}],[t+0.85,reachFree(FLOOR_AHEAD)],[t+1.6,standFree(FLOOR_AHEAD)],[t+1.85,{}]]);
  return kf;
}
function kbPushBack(){
  // From a two-hand pickup to the rack: elbow pinned to the hip, push the bell back, thumb rolls back and
  // the arm straightens; sit back so the legs absorb it, forearm high on the inner thigh. Set it down out
  // in front, stand up, step up to it, and go again on the other side.
  const floorAhead={G:[0,25.5,34],D:[0,-1,0],W:[1,0,0]};
  const setDown=R1(Object.assign({},UP_KB,SET_P,floorAhead,{eR:[-1,0.3,-0.3]}));
  const one=pickupToRack().concat([[4.1,PINNED_R],[4.45,HIKE_R],[4.65,{}],[5.2,setDown],[5.4,{}],
    [5.65,reachFree(floorAhead)],[6.4,standFree(floorAhead)],[6.6,{}]]);
  const st=standFree(floorAhead),e=endOf(one);
  const step1=Object.assign({},st,{feet:{L:[16,15,15],R:[-16,8,0]},P:[2,95,8],pass:true}),step1b=Object.assign({},st,{feet:{L:[16,8,31],R:[-16,8,0]},P:[1,94,15]});
  const step2=Object.assign({},st,{feet:{L:[16,8,31],R:[-16,15,15]},P:[-2,95,23],pass:true}),step2b=Object.assign({},st,{feet:{L:[16,8,31],R:[-16,8,31]},P:[0,94,31]});
  for(const q of [step1,step1b,step2,step2b]){q.freeL=add(shoulderOf(q,'L'),[4,-52,6]);q.freeR=add(shoulderOf(q,'R'),[-4,-52,6])}
  const steps=[[e+0.35,step1],[e+0.7,step1b],[e+1.05,step2],[e+1.4,step2b],[e+1.6,{}]];
  const second=shift(moveZKF(mirrorKF(one),31),endOf(steps)-one[0][0]+0.1);
  return one.concat(steps,second.slice(1));
}
function kbClean(){
  // Swing clean: two-hand pickup to the rack. Pin the elbow, push back, thumb back, absorb with the hips;
  // snap the hips with the elbow pinned so the bell floats in close, and catch it in the rack, thumb at the
  // collarbone. Pause and check. To finish, the other hand grabs, both arms straighten, set it down.
  let kf=cleanStart();
  kf=kf.concat(cleanRep(endOf(kf)+0.1));
  kf=kf.concat(cleanFinish(endOf(kf)));
  return both(kf);
}
function kbCleanTransitions(){
  // Swing cleans that change hands without setting the bell down: "down, up, down, up". Down into a swing,
  // up and switch hands at the top, down with the new hand, up into the rack on the new side.
  const HL=mirror(HIKE_R),PL=mirror(SWPASS_R),FL=mirror(FLOAT_R),RL=mirror(RACK_R),PNL=mirror(PINNED_R);
  let kf=cleanStart();
  let t=endOf(kf);
  const add_=(...ps)=>{for(const [d,p] of ps){t+=d;kf.push([t,p])}};
  add_([0.3,PINNED_R],[0.3,HIKE_R],[0.3,SWPASS_R],[0.3,SWITCH_TOP],[0.3,PL],[0.3,HL],[0.27,PL],[0.21,FL],[0.22,RL],[0.35,{}]);
  add_([0.3,PNL],[0.3,HL],[0.27,PL],[0.21,FL],[0.22,RL],[0.35,{}]);
  add_([0.3,PNL],[0.3,HL],[0.3,PL],[0.3,SWITCH_TOP],[0.3,SWPASS_R],[0.3,HIKE_R],[0.27,SWPASS_R],[0.21,FLOAT_R],[0.22,RACK_R],[0.35,{}]);
  return kf.concat(cleanFinish(t));
}
function kbPress(){
  // Two-hand pickup to the rack; free arm out to the side with a tight fist. Open the shoulder and press to
  // lockout, biceps by the ear; pull it down and fold it in, elbow to hip, thumb to collarbone. Pause.
  const fist={freeL:add(shoulderOf(UP_KB,'L'),[54,-2,4]),eL:[0,-1,0]};
  let kf=pickupToRack();
  kf.push([endOf(kf)+0.45,Object.assign({},RACK_R,fist)]);
  for(let i=0;i<2;i++)kf=kf.concat(pressRep(endOf(kf)+0.1,fist));
  kf=kf.concat(shift(setDownFromRack(),endOf(kf)+0.15));
  return both(kf);
}
function kbCleanPress(){
  // Lessons 12 and 14 together: swing clean to the rack, pause, press to lockout, back to the rack.
  const fist={freeL:add(shoulderOf(UP_KB,'L'),[54,-2,4]),eL:[0,-1,0]};
  let kf=cleanStart();
  kf.push([endOf(kf)+0.2,Object.assign({},RACK_R,fist)]);
  kf=kf.concat(pressRep(endOf(kf)+0.1,fist));
  kf=kf.concat(cleanRep(endOf(kf)+0.1));kf.push([endOf(kf)+0.2,Object.assign({},RACK_R,fist)]);
  kf=kf.concat(pressRep(endOf(kf)+0.1,fist));
  kf=kf.concat(cleanFinish(endOf(kf)));
  return both(kf);
}
function kbStartStop(){
  // Start and finish every set the same way: bell 12-18 inches ahead, reach in thumb down to the corner of
  // the handle nearest you, hike it back, stand up into the clean and catch soft in the rack; push it back
  // and set it down exactly where it started.
  const kf=[[0,standFree(FLOOR_AHEAD)],[0.35,{}],[1.1,reachFree(FLOOR_AHEAD)],[1.35,setOne(FLOOR_AHEAD)],[1.55,{}],
    [2.0,HIKE_R],[2.27,SWPASS_R],[2.48,FLOAT_R],[2.7,RACK_R],[3.2,{}],[3.5,PINNED_R],[3.8,HIKE_R],[4.25,setOne(FLOOR_AHEAD)],[4.45,{}],
    [4.65,reachFree(FLOOR_AHEAD)],[5.4,standFree(FLOOR_AHEAD)],[5.6,{}]];
  return both(kf);
}

/* goblet squats and the single kettlebell front squat (Chris's notes on Mark Wildman's "3 Types of Goblet Squats") */
// carry a hold written for standing tall (UP_KB) onto a pose whose torso has moved (squat depth, lean)
function carry(pose,src){
  const F=torsoFrame(pose.P,pose.pitch||0,pose.yaw||0,pose.roll||0,pose.twist||0);
  const pt=v=>add(add(add(pose.P,mul(F.l,v[0])),mul(F.u,v[1]-94)),mul(F.f,v[2]));
  const dir=v=>norm(add(add(mul(F.l,v[0]),mul(F.u,v[1])),mul(F.f,v[2])));
  const o=Object.assign({},src);
  for(const k of ['P','pitch','yaw','roll','twist','hipYaw','feet','turn','kneeOut','tL','tR','fyL','fyR'])if(k in pose)o[k]=pose[k];   // body from pose, hands from src
  o.G=pt(src.G);o.D=dir(src.D);o.W=dir(src.W);o.eL=dir(src.eL);o.eR=dir(src.eR);
  if(src.freeL)o.freeL=pt(src.freeL);if(src.freeR)o.freeR=pt(src.freeR);
  return o;
}
// goblet: hands under the ball, handle on top at eye level ("looking through the window"), elbows together
const GOBLET=Object.assign({},UP_KB,{G:[0,158,26],D:[0,-1,0],W:[1,0,0],hR:-5,hL:5,hD:24,offL:0,offR:0,eL:[-0.25,-1,-0.25],eR:[0.25,-1,-0.25]});
// bottoms-up: the halo start position, bell upside down by the horns, elbows on the ribs, forearms level
const BOTTOMS_UP=Object.assign({},UP_KB,{hR:-8,hL:8,hD:5,offL:0,offR:0},haloAt(0));
function kbSquatReps(top,bottom,reps){
  const kf=[[0,top],[0.4,{}]];let t=0.4;
  for(let i=0;i<reps;i++){kf.push([t+0.95,bottom],[t+1.2,{}],[t+2.0,top],[t+2.35,{}]);t+=2.35}
  return kf;
}
function kbGobletSquat(){
  // Squat all the way down, hips below the knees, leaning back away from the bell; drive straight up,
  // tuck the tailbone and squeeze at the top. Feet about shoulder width.
  const feet={L:[18,8,0],R:[-18,8,0]};
  const top=carry(Object.assign({},UP_KB,{feet,turn:6,kneeOut:0.45}),GOBLET);
  const bottom=carry(Object.assign({},UP_KB,{P:[0,47,-12],pitch:6,feet,turn:6,kneeOut:0.6}),GOBLET);
  return kbSquatReps(top,bottom,2);
}
function kbBottomsUpSquat(){
  // Wide stance. Squat with the points of the elbows inside the knees: push out with the elbows, squeeze in
  // with the knees, chest high. The bell stays upside down at chest height, off the body. Stand all the way up.
  const feet={L:[22,8,0],R:[-22,8,0]};
  const top=carry(Object.assign({},UP_KB,{feet,turn:10,kneeOut:0.5}),BOTTOMS_UP);
  const bottom=carry(Object.assign({},UP_KB,{P:[0,46,-12],pitch:12,feet,turn:10,kneeOut:0.75}),BOTTOMS_UP);
  return kbSquatReps(top,bottom,2);
}

/* horn hold, goblet hold and crush grip (Chris, 2026-11-27)
   horn hold: hands on the sides of the handle (the horns), bell reversed, above the hands
   goblet hold: hands on the horns, bell facing down
   crush grip: the ball of the bell squeezed between the palms */
const hornHands={hR:-6.5,hL:6.5,hD:2,offL:0,offR:0};
const GOBLET_HOLD=Object.assign({},UP_KB,hornHands,{G:[0,136,24],D:[0,-1,0],W:[1,0,0],eL:[-0.25,-1,-0.25],eR:[0.25,-1,-0.25]});
const crushAt=(c,extra)=>Object.assign({},UP_KB,{hR:-12,hL:12,hD:15,offL:0,offR:0,G:sub(c,[0,-15,0]),D:[0,-1,0],W:[1,0,0],eL:[1,-0.6,0],eR:[-1,-0.6,0]},extra||{});
const CRUSH_CHEST=crushAt([0,128,26]),CRUSH_TOP=crushAt([0,190,8],{eL:[1,0,0],eR:[-1,0,0]});
// horn hold through a curl: forearms pivot on elbows held at the ribs (theta 0 = hanging straight down)
function hornCurlAt(theta,pass){
  const a=theta*Math.PI/180,E=[0,110,2],hand=add(E,mul([0,-Math.cos(a),Math.sin(a)],27));
  const D=norm([0,1,0.35-0.55*theta/150]);
  return Object.assign({},UP_KB,hornHands,{G:sub(hand,mul(D,2)),D,W:[1,0,0],eL:[0.3,-1,-0.6],eR:[-0.3,-1,-0.6],pass:!!pass});
}
// horn hold over and behind the head: elbows at 90 degrees by the ears, bell hanging behind
const HORN_OVER=Object.assign({},UP_KB,hornHands,{G:[0,184,12],D:norm([0,0.6,-0.8]),W:[1,0,0],eL:[0.4,0.8,0.4],eR:[-0.4,0.8,0.4],pass:true});
const HORN_BEHIND=Object.assign({},UP_KB,hornHands,{G:[0,164,-8],D:norm([0,-0.85,-0.5]),W:[1,0,0],eL:[0.25,1,0.25],eR:[-0.25,1,0.25]});
const HORN_UP=Object.assign({},UP_KB,hornHands,{G:[0,194,-2],D:[0,1,0],W:[1,0,0],eL:[0.25,1,0.25],eR:[-0.25,1,0.25]});
function kbHornCurl(){
  // horn hold, bell in front on straight arms; elbows locked to the ribs, curl it to the chest, forearms
  // pivoting on the elbows; lower under control
  const kf=[[0,hornCurlAt(8)],[0.4,{}]];let t=0.4;
  for(let i=0;i<3;i++){kf.push([t+0.45,hornCurlAt(75,true)],[t+0.9,hornCurlAt(145)],[t+1.15,{}],[t+1.65,hornCurlAt(75,true)],[t+2.15,hornCurlAt(8)],[t+2.35,{}]);t+=2.35}
  return kf;
}
function kbPullover(){
  // horn hold at the chest: take the bell over the head and behind the back with the elbows at 90 degrees,
  // then bring it back over to the front
  const chest=hornCurlAt(145);
  const kf=[[0,chest],[0.4,{}]];let t=0.4;
  for(let i=0;i<2;i++){kf.push([t+0.5,HORN_OVER],[t+0.95,HORN_BEHIND],[t+1.2,{}],[t+1.65,Object.assign({},HORN_OVER)],[t+2.1,Object.assign({},chest)],[t+2.35,{}]);t+=2.35}
  return kf;
}
function kbTricepPress(){
  // the pullover, but once the bell is behind the back keep the biceps by the ears and straighten the arms
  // so the bell rotates up over the head, then lower it behind again (skull crushers); bring it back over
  const chest=hornCurlAt(145);
  const kf=[[0,chest],[0.4,{}],[0.9,HORN_OVER],[1.35,HORN_BEHIND],[1.55,{}]];let t=1.55;
  for(let i=0;i<3;i++){kf.push([t+0.55,HORN_UP],[t+0.8,{}],[t+1.35,Object.assign({},HORN_BEHIND)],[t+1.55,{}]);t+=1.55}
  kf.push([t+0.45,Object.assign({},HORN_OVER)],[t+0.9,Object.assign({},chest)],[t+1.15,{}]);
  return kf;
}
function kbCrushPress(){
  // crush grip: squeeze the ball of the bell between the palms, then press it overhead and lower
  const kf=[[0,CRUSH_CHEST],[0.4,{}]];let t=0.4;
  for(let i=0;i<3;i++){kf.push([t+0.8,CRUSH_TOP],[t+1.05,{}],[t+1.85,Object.assign({},CRUSH_CHEST)],[t+2.1,{}]);t+=2.1}
  return kf;
}
const KSQ={P:[0,47,-12],pitch:8,feet:{L:[18,8,0],R:[-18,8,0]},turn:6,kneeOut:0.6};
function kbThruster(){
  // a front squat holding the bell (crush grip here; horn or goblet hold work too), and the drive up
  // carries straight into a push press overhead; lower to the chest and go again
  const feet=KSQ.feet,top=Object.assign({},CRUSH_CHEST,{feet,turn:6,kneeOut:0.45});
  const bottom=carry(Object.assign({},UP_KB,KSQ),Object.assign({},CRUSH_CHEST));
  const rise=Object.assign(carry(Object.assign({},UP_KB,{P:[0,80,-5],pitch:4,feet,turn:6,kneeOut:0.5}),crushAt([0,140,22])),{pass:true});
  const press=Object.assign({},CRUSH_TOP,{feet,turn:6,kneeOut:0.45});
  const kf=[[0,top],[0.4,{}]];let t=0.4;
  for(let i=0;i<2;i++){kf.push([t+0.95,bottom],[t+1.15,{}],[t+1.5,rise],[t+1.8,press],[t+2.1,{}],[t+2.8,Object.assign({},top)],[t+3.0,{}]);t+=3.0}
  return kf;
}
function kbGobletHoldSquat(){
  // goblet hold: hands on the horns, bell facing down at the chest; squat all the way down and drive up
  const feet={L:[18,8,0],R:[-18,8,0]};
  const top=carry(Object.assign({},UP_KB,{feet,turn:6,kneeOut:0.45}),GOBLET_HOLD);
  const bottom=carry(Object.assign({},UP_KB,{P:[0,47,-12],pitch:8,feet,turn:6,kneeOut:0.6}),GOBLET_HOLD);
  return kbSquatReps(top,bottom,2);
}
function kbRackLunge(){
  // Pick the bell up to the rack in the lead (right) hand, free arm out to the side. Reverse lunge with the
  // lead side leg: the foot lifts, steps back and lands softly, then the body lowers with the front shin near
  // vertical; drive back up as the foot steps forward to the start. Twice, set it down, then the other side.
  const arm=Object.assign({},RACK_R,{freeL:add(shoulderOf(UP_KB,'L'),[54,-1,4]),eL:[0,-1,0]});
  const at=(f,pass)=>{const o=carry(lungeBody('R',f),arm);if(pass)o.pass=true;else delete o.pass;return o};
  const top=at(0);
  let kf=pickupToRack();
  kf.push([endOf(kf)+0.45,top],[endOf(kf)+0.75,{}]);
  for(let i=0;i<2;i++){const t=endOf(kf);
    kf.push([t+0.3,at(0.3,true)],[t+0.6,at(0.6,true)],[t+1.0,at(1)],[t+1.3,{}],[t+1.65,at(0.6,true)],[t+1.95,at(0.3,true)],[t+2.3,top],[t+2.6,{}])}
  kf=kf.concat(shift(setDownFromRack(),endOf(kf)+0.2));
  return both(kf);
}

/* kettlebell moves from Chris's descriptions (2026-11-27) */
// a right-hand kettlebell pose with the same bell mirrored into the left hand (double moves), body square
function dblBell(p){
  if(!Object.keys(p).length)return {};
  const m=mirror(p),o=Object.assign({},p,{offL:0,offR:0});
  if('yaw' in p||'P' in p){o.yaw=0;o.hipYaw=0;o.roll=0}
  if(p.P)o.P=[0,p.P[1],p.P[2]];
  if(p.G){o.G2=m.G;o.D2=m.D;o.W2=m.W}
  if(p.eR)o.eL=m.eL;
  return o;
}
// the bell on the floor beside the outside of the right (lead) foot, handle running front to back
const SUITCASE_FLOOR={G:[-27,25.5,4],D:[0,-1,0],W:[0,0,1]};
const SC_BOTTOM={P:[0,52,-28],pitch:53,feet:KFEET,kneeOut:0.5};
// standing tall with the bell hanging at the side on a straight arm, shoulders level
const suitcaseTop=b=>R1(Object.assign({},UP_KB,b||{},{G:add(shoulderOf(Object.assign({},UP_KB,b||{}),'R'),[-6,-54,2]),D:[0,-1,0],W:[0,0,1],eR:[-1,0,0]}));
function suitcaseKF(reps){
  // bell outside the lead foot; shoulders square, hips back, hinge down and take it with the lead hand;
  // stand up with the arm still straight down; lower the same way, tap and go again, then set it down
  const grip=R1(Object.assign({},UP_KB,SC_BOTTOM,SUITCASE_FLOOR,{eR:[-1,0,-0.3]}));
  const tap=Object.assign({},grip,{G:add(SUITCASE_FLOOR.G,[0,1,0])});
  const mid=Object.assign(suitcaseTop({P:[0,74,-17],pitch:27,feet:KFEET}),{pass:true});   // half way: arm still hanging straight
  const kf=[[0,standFree(SUITCASE_FLOOR)],[0.35,{}],[1.15,grip],[1.35,{}],[1.75,mid],[2.15,suitcaseTop()],[2.45,{}]];
  let t=2.45;for(let i=1;i<reps;i++){kf.push([t+0.4,Object.assign({},mid)],[t+0.75,tap],[t+0.85,{}],[t+1.2,Object.assign({},mid)],[t+1.6,suitcaseTop()],[t+1.9,{}]);t+=1.9}
  kf.mid=mid;
  return {kf,t,grip};
}
function kbSuitcaseDeadlift(){
  const {kf,t,grip}=suitcaseKF(2);
  kf.push([t+0.4,Object.assign({},kf.mid)],[t+0.75,grip],[t+0.95,{}],[t+1.15,free_(Object.assign({},UP_KB,SC_BOTTOM,SUITCASE_FLOOR))],[t+1.9,standFree(SUITCASE_FLOOR)],[t+2.15,{}]);
  return both(kf);
}
function kbFarmerCarry(){
  // suitcase deadlift to standing, then walk forward: body tall, shoulders even, the bell steady at the side
  const {kf,t}=suitcaseKF(1);
  let z=0,tt=t;const step=26,top=suitcaseTop();
  for(let i=0;i<4;i++){const s=i%2?'L':'R',o=s==='L'?'R':'L';
    const mid=moveZ(top,z+step/2),feetMid={};feetMid[s]=[top.feet[s][0],18,z+step];feetMid[o]=[top.feet[o][0],8,z];
    mid.feet=feetMid;mid.pass=true;
    const land=moveZ(top,z+step/2);land.feet={};land.feet[s]=[top.feet[s][0],8,z+step];land.feet[o]=[top.feet[o][0],8,z];
    kf.push([tt+0.3,mid],[tt+0.55,land]);tt+=0.55;
    // the back foot comes through on the next step
    const mid2=moveZ(top,z+step),f2={};f2[o]=[top.feet[o][0],18,z+step];f2[s]=[top.feet[s][0],8,z+step];mid2.feet=f2;mid2.pass=true;
    if(i===3){kf.push([tt+0.3,mid2],[tt+0.55,moveZ(top,z+step)]);tt+=0.55}
    z+=step;}
  kf.push([tt+0.4,{}]);
  const grip=moveZ(R1(Object.assign({},UP_KB,SC_BOTTOM,SUITCASE_FLOOR,{eR:[-1,0,-0.3]})),z);
  kf.push([tt+1.2,grip],[tt+1.4,{}],[tt+1.6,moveZ(free_(Object.assign({},UP_KB,SC_BOTTOM,SUITCASE_FLOOR)),z)],[tt+2.35,moveZ(standFree(SUITCASE_FLOOR),z)],[tt+2.6,{}]);
  return both(kf);
}
function kbPushPress(){
  // from the rack: a slight squat (dip), then drive up through the legs and carry that into the press,
  // more explosive than the strict press; ease the bell back down to the rack under control
  const fist={freeL:add(shoulderOf(UP_KB,'L'),[54,-2,4]),eL:[0,-1,0]};
  const rack=Object.assign({},RACK_R,fist);
  const dipB=Object.assign({},UP_KB,{P:[0,84,-5],pitch:6,feet:KFEET,kneeOut:0.5});
  const dip=Object.assign(carry(dipB,rack),{freeL:fist.freeL});
  const drive=Object.assign({},rack,{G:add(rack.G,[-2,10,-2]),pass:true});
  let kf=pickupToRack();kf.push([endOf(kf)+0.45,rack],[endOf(kf)+0.75,{}]);
  for(let i=0;i<2;i++){const t=endOf(kf);
    kf.push([t+0.45,dip],[t+0.6,{}],[t+0.78,drive],[t+0.92,Object.assign({},PRESS_MID_R,fist)],[t+1.08,Object.assign({},LOCK_R,fist)],[t+1.5,{}],
      [t+2.15,Object.assign({},PRESS_MID_R,fist)],[t+2.75,rack],[t+3.0,{}])}
  kf=kf.concat(shift(setDownFromRack(),endOf(kf)+0.15));
  return both(kf);
}
function kbDoubleFrontSquat(){
  // the front squat with a bell in each hand in the rack
  const rack=dblBell(Object.assign({},RACK_R,{feet:KFEET,turn:4,kneeOut:0.45}));
  const bottom=dblBell(carry(Object.assign({},UP_KB,{P:[0,48,-12],pitch:8,feet:KFEET,turn:4,kneeOut:0.6}),RACK_R));
  const kf=[[0,rack],[0.5,{}]];let t=0.5;
  for(let i=0;i<2;i++){kf.push([t+0.95,bottom],[t+1.2,{}],[t+2.0,rack],[t+2.3,{}]);t+=2.3}
  return kf;
}
function kbDoubleSwing(){
  // the one-arm swing with a bell in each hand, feet a little wider; the bells travel side by side between
  // the legs, apart enough that they never knock together
  const W2F={L:[24,8,0],R:[-24,8,0]};
  const B=x=>Object.assign({},UP_KB,x||{},{feet:W2F});
  const at=(b,dir)=>dblBell(R1(armR(B(b),dir)));
  const hang=at(null,[0.02,-1,0.12]),hike=Object.assign(at(HIKE_P,[0.06,-0.8,-0.55]),{eR:[-1,0,-0.5]});
  const pass=Object.assign(at(PASS_P,[0.04,-1,0.3]),{pass:true}),top=at(null,[-0.04,-0.7,0.7]);
  hike.eL=mx(hike.eR);
  const kf=[[0,hang],[0.4,{}],[0.9,hike]];let t=0.9;
  for(let i=0;i<3;i++){kf.push([t+0.27,pass],[t+0.55,top],[t+0.82,pass],[t+1.1,hike]);t+=1.1}
  kf.push([t+0.5,Object.assign({},pass,{pass:false})],[t+0.8,hang],[t+1.1,{}]);
  return kf;
}
// snatch: the bell driven up close to the body, and the arm on its way back down into the swing
const SN_PULL=Object.assign(R1(Object.assign({},UP_KB,{G:[-14,146,18],D:norm([0,-0.9,-0.2]),W:[1,0,0],eR:[-1,0.6,0]})),{pass:true});
const SN_OVER=Object.assign(R1(armR(Object.assign({},UP_KB),[0.1,0.35,0.93])),{pass:true});
function kbSnatch(){
  // one-arm swing, then in one explosive move drive the bell up close to the body and punch through so it
  // turns to sit behind the wrist (like the rack) with the arm straight up overhead, biceps by the ear,
  // bell high. Drop it back into the swing.
  const pull=SN_PULL,over=SN_OVER;
  let kf=[[0,standFree(FLOOR_AHEAD)],[0.35,{}],[1.1,reachFree(FLOOR_AHEAD)],[1.35,setOne(FLOOR_AHEAD)],[1.55,{}],[2.0,HIKE_R]];
  let t=2.0;
  for(let i=0;i<2;i++){kf.push([t+0.27,SWPASS_R],[t+0.48,pull],[t+0.7,LOCK_R],[t+1.15,{}],[t+1.45,over],[t+1.72,SWPASS_R],[t+2.0,HIKE_R]);t+=2.0}
  kf.push([t+0.45,setOne(FLOOR_AHEAD)],[t+0.65,{}],[t+0.85,reachFree(FLOOR_AHEAD)],[t+1.6,standFree(FLOOR_AHEAD)],[t+1.85,{}]);
  return both(kf);
}

// shift a pose (body, feet and anything in hand) along the floor so a body point lands over a target x/z
function overXZ(p,pt,target){const dx=target[0]-pt[0],dz=target[2]-pt[2],f=v=>v&&[v[0]+dx,v[1],v[2]+dz];
  const o=Object.assign({},p,{P:f(p.P)});if(p.feet)o.feet={L:f(p.feet.L),R:f(p.feet.R)};return o}
function kbSingleLegDeadlift(){
  // Single-leg (Romanian) deadlift (Chris): bell on the floor outside the lead (right) foot. Hinge at the
  // waist with the other leg straight in line with the body, lifting back as you tip forward. Low enough to
  // reach, take it like the suitcase deadlift and reverse the hinge, the free leg staying off the floor
  // while you repeat; then set the bell back down.
  const floor={G:[-22,25.5,16],D:[0,-1,0],W:[0,0,1]};
  const leg=(P,pitch,lift)=>{const F=torsoFrame(P,pitch,0,0),hipL=add(P,mul(F.l,9));
    return add(hipL,mul(F.u,-(lift?84:86)))};
  const body=(P,pitch,lift,extra)=>{const L=lift?leg(P,pitch,lift):[10,8,0];
    return Object.assign({},UP_KB,{P,pitch,feet:{L:[L[0],Math.max(8,L[1]),L[2]],R:[-10,8,0]},turn:4,kneeOut:0.2,tL:lift?1:0},extra||{})};
  const bottom=body([0,72,-6],82,true),mid=body([0,84,-3],40,true),up=body([0,93,0],6,true),stand=body([0,94,0],0,false);
  const grip=R1(Object.assign({},bottom,floor,{eR:[-1,0,-0.3]}));
  const tap=Object.assign({},grip,{G:add(floor.G,[0,1.5,0])});
  const hang=(b,pass)=>Object.assign(R1(Object.assign({},b,{G:add(shoulderOf(b,'R'),mul(norm([-0.05,-1,0.02]),54)),D:[0,-1,0],W:[0,0,1],eR:[-1,0,0]})),{pass:!!pass});
  const free=(b,pass)=>Object.assign(free_(Object.assign({},b,floor)),{pass:!!pass});
  const kf=[[0,free(stand)],[0.35,{}],[0.9,free(mid,true)],[1.4,Object.assign(free_(Object.assign({},bottom,floor)),{offR:0.6})],[1.55,grip],[1.75,{}],
    [2.25,hang(mid,true)],[2.75,hang(up)],[3.05,{}],[3.55,hang(mid,true)],[4.05,tap],[4.2,{}],[4.7,hang(mid,true)],[5.2,hang(up)],[5.5,{}],
    [6.0,hang(mid,true)],[6.5,grip],[6.7,{}],[6.9,free(bottom)],[7.45,free(mid,true)],[7.95,free(stand)],[8.2,{}]];
  return both(kf);
}
function kbBentOverRow(){
  // Bent-over row (Chris): bell on the floor between the legs. Pivot to one side and hinge forward with a
  // straight back, the free forearm resting on the front thigh. Reach down with the working (right) arm and
  // take the bell; keeping everything else still, row it up toward the chest, elbow to the hip pocket, and
  // lower it under control. both() pivots the other way for the left arm.
  const B=Object.assign({},UP_KB,{P:[0,62,-10],pitch:68,yaw:28,hipYaw:22,feet:{L:[16,8,22],R:[-18,8,-16]},turn:8,kneeOut:0.4,fyR:24,fyL:18});
  const bellAt=FLOOR_IN.G,sR=shoulderOf(B,'R');
  const body=overXZ(B,sR,bellAt);
  const F=torsoFrame(body.P,body.pitch,body.yaw,0),hipL=add(body.P,mul(F.l,9)),kneeL=vl(hipL,body.feet.L,0.45);
  const brace={freeL:add(kneeL,[0,6,0]),eL:[1,0.2,-0.4]};
  const grip=R1(Object.assign({},body,FLOOR_IN,{W:[0,0,1],eR:[-1,0,-0.3]},brace));
  const rowTop=R1(Object.assign({},body,{G:onBody(body,-15,24,-10),D:[0,-1,0],W:norm([0.4,0,0.9]),eR:[-0.6,1,-0.2]},brace));
  const low=Object.assign({},grip,{G:add(FLOOR_IN.G,[0,6,0])});
  const st=standFree(FLOOR_IN),turned=Object.assign(free_(Object.assign({},body,FLOOR_IN)),brace,{offL:1});
  const kf=[[0,st],[0.35,{}],[1.2,turned],[1.45,grip],[1.65,{}]];let t=1.65;
  for(let i=0;i<2;i++){kf.push([t+0.55,rowTop],[t+0.8,{}],[t+1.5,low],[t+1.6,{}]);t+=1.6}
  kf.push([t+0.3,grip],[t+0.45,{}],[t+0.65,turned],[t+1.5,st],[t+1.75,{}]);
  return both(kf);
}
function kbGorillaRow(){
  // Gorilla row (Chris): two bells on the floor, a deep hinge forward with feet wide and no pivot, back
  // straight. Rest on one bell while the other rows to the chest like the bent-over row and comes back down
  // under control; set it down and row the other side.
  const W2F={L:[26,8,0],R:[-26,8,0]};
  const B=Object.assign({},UP_KB,{P:[0,64,-16],pitch:66,feet:W2F,turn:12,kneeOut:0.6});
  const sR=shoulderOf(B,'R'),sL=shoulderOf(B,'L');
  const bR={G:[sR[0]+2,25.5,sR[2]],D:[0,-1,0],W:[0,0,1]},bL={G:[sL[0]-2,25.5,sL[2]],D:[0,-1,0],W:[0,0,1]};
  const two=(b,r,l,extra)=>Object.assign({},b,{G:r.G,D:r.D,W:r.W,G2:l.G,D2:l.D,W2:l.W,hR:0,hL:0,hD:0,eR:[-1,0,-0.3],eL:[1,0,-0.3]},extra||{});
  const rowR={G:onBody(B,-15,24,-10),D:[0,-1,0],W:[0,0,1]},rowL={G:onBody(B,15,24,-10),D:[0,-1,0],W:[0,0,1]};
  const hold=two(B,bR,bL,{offL:0,offR:0,freeL:[20,86,2],freeR:[-20,86,2]});
  const standF=two(Object.assign({},UP_KB,{feet:W2F,turn:12}),bR,bL,{offL:1,offR:1,freeL:add(shoulderOf(UP_KB,'L'),[4,-52,6]),freeR:add(shoulderOf(UP_KB,'R'),[-4,-52,6])});
  const reach=two(B,bR,bL,{offL:1,offR:1,freeL:add(bL.G,[0,14,0]),freeR:add(bR.G,[0,14,0])});
  const upR=Object.assign({},hold,{G:rowR.G,eR:[-0.6,1,-0.2]}),upL=Object.assign({},hold,{G2:rowL.G,eL:[0.6,1,-0.2]});
  const kf=[[0,standF],[0.35,{}],[1.2,reach],[1.45,hold],[1.65,{}]];let t=1.65;
  for(const up of [upR,upR,upL,upL]){kf.push([t+0.55,up],[t+0.8,{}],[t+1.45,hold],[t+1.6,{}]);t+=1.6}
  kf.push([t+0.25,reach],[t+1.1,standF],[t+1.35,{}]);
  return kf;
}
function kbHighPull(){
  // High pull (Chris): a two-hand swing that brings the handle up under the chin with the elbows as high as
  // they go, then swings back down under control.
  const floorG=[0,23.6,32.8],floorD=norm([0,-0.876,0.482]);
  const standF=Object.assign({},KB,{G:floorG,D:floorD,offL:1,offR:1,freeL:[20,86,2],freeR:[-20,86,2],eL:[1,-0.4,-0.6],eR:[-1,-0.4,-0.6]});
  const setup=Object.assign({},KB,{P:[0,62,-32],pitch:74,G:floorG,D:floorD,eL:[1,0.3,-0.3],eR:[-1,0.3,-0.3]});
  const hike=kbArms(Object.assign({},KB,{P:[0,74,-20],pitch:48}),[0,-0.766,-0.643]);
  const pass=Object.assign(kbArms(Object.assign({},KB,{P:[0,88,-8],pitch:18}),[0,-1,0.35]),{pass:true});
  const rise=Object.assign(kbArms(Object.assign({},KB,{P:[0,94,0],pitch:0}),[0,-0.55,0.85]),{pass:true});
  const chin=Object.assign({},KB,{P:[0,94,0],pitch:0,G:[0,146,16],D:norm([0,-1,0.15]),W:[1,0,0],hR:-4,hL:4,eL:[1,0.7,-0.3],eR:[-1,0.7,-0.3]});
  const reach=Object.assign({},setup,{offL:1,offR:1,freeL:[16,46,16],freeR:[-16,46,16]});
  let kf=[[0,standF],[0.35,{}],[1.15,reach],[1.4,setup],[1.6,{}],[2.05,hike]];let t=2.05;
  for(let i=0;i<3;i++){kf.push([t+0.28,pass],[t+0.46,rise],[t+0.64,chin],[t+0.85,{}],[t+1.1,Object.assign({},rise)],[t+1.32,Object.assign({},pass)],[t+1.6,hike]);t+=1.6}
  kf.push([t+0.45,setup],[t+0.65,{}],[t+0.85,reach],[t+1.65,standF],[t+1.95,{}]);
  return kf;
}

// the bell held straight up over the lead (right) shoulder whatever the body is doing: arm vertical, bell
// resting behind the wrist (on the back of the forearm), as at the top of the snatch
function bellUp(pose,extra){
  const F=torsoFrame(pose.P,pose.pitch||0,pose.yaw||0,pose.roll||0,pose.twist||0),sR=shoulderOf(pose,'R');
  const D=norm(add(mul(F.f,-0.75),[0,-0.6,0]));
  return Object.assign({},pose,{kb:1,G:add(sR,[0,54,0]),D,W:perpTo(D,F.l),hR:0,hL:0,hD:0,offR:0,eR:[-1,0,0]},extra||{});
}
function kbWindmill(){return both(windmillKF(2))}
function windmillKF(reps){
  // Windmill (Chris): from the overhead hold, feet pivot 45 degrees toward the non-lead side. Hinge at the
  // waist with the weight on the lead leg, kept straight; the support hand glides down the inside of the
  // other leg. The bell stays straight up as the torso turns toward the lead side and hinges down, until the
  // support hand touches the floor (or as low as you can), then everything comes back up. At the bottom the
  // chest has turned on the spine so the bell, both shoulders and the support hand make one vertical line.
  const feet={L:[14,8,6],R:[-16,8,-6]};
  // twist turns the chest about the spine toward the lead side, so at the bottom the spine is level and the
  // shoulders stack one over the other: bell, both shoulders and the support hand on one vertical line
  const B=(P,pitch,yaw,roll,kneeL,twist)=>Object.assign({},UP_KB,{P,pitch,yaw,roll,twist,hipYaw:40,feet,turn:4,fyL:40,fyR:40,kneeOut:kneeL});
  const stand=B([0,94,0],0,40,0,0.3,0),mid=B([-10,92,-2],48,46,0,0.4,45),low=B([-21,88,-3],93,52,0,0.5,90);
  // the support hand slides down the inside of the other leg, as low as the arm reaches (to the floor if it can)
  const glide=(b,f)=>{const F=torsoFrame(b.P,b.pitch,b.yaw,b.roll,b.twist||0),target=add(vl(add(b.P,mul(F.l,9)),b.feet.L,f),[-5,f>0.9?-3:2,0]);
    const sL=shoulderOf(b,'L'),d=sub(target,sL),r=Math.hypot(...d);return add(sL,mul(d,Math.min(1,54/r)))};
  // at the bottom the support arm hangs straight down from its shoulder, fingertips to the floor
  const down=b=>{const sL=shoulderOf(b,'L');return [sL[0],Math.max(12,sL[1]-56),sL[2]]};
  const held=(b,f,pass)=>bellUp(b,{G:add(shoulderOf(b,'R'),[0,56,0]),offL:1,freeL:f===null?add(shoulderOf(b,'L'),[4,-52,6]):f==='down'?down(b):glide(b,f),eL:[1,-0.3,0.2],pass:!!pass});
  const start=held(Object.assign({},UP_KB,{feet:{L:[14,8,0],R:[-14,8,0]}}),null);
  const kf=[[0,start],[0.4,{}],[0.9,held(stand,null)],[1.15,{}]];let t=1.15;
  for(let i=0;i<reps;i++){kf.push([t+0.7,held(mid,0.55,true)],[t+1.4,held(low,'down')],[t+1.7,{}],[t+2.4,held(mid,0.55,true)],[t+3.1,held(stand,null)],[t+3.35,{}]);t+=3.35}
  kf.push([t+0.5,Object.assign({},start)],[t+0.75,{}]);
  return kf;
}
function kbTurkishGetUp(){
  // Turkish get-up (Chris): lying on the back, bell straight up over the lead (right) shoulder, lead knee
  // bent with the foot flat. The bell always stays straight up. Roll to the support (left) elbow, straighten
  // the support arm, push the hips up with both legs, sweep the support leg under to the support knee, then
  // stand up tall. Reverse to get down: to the support knee, leg back out straight, from the hand to the
  // elbow to the shoulder and all the way down. both() mirrors it.
  const LEGS_FLAT={L:[14,8,84],R:[-12,8,44]};
  const handF=[40,4,-14];
  const B=(P,pitch,roll,feet,extra)=>Object.assign({},UP_KB,{P,pitch,yaw:0,roll,hipYaw:0,feet,turn:10,kneeOut:0.3,tL:0,tR:0,fyL:0,fyR:0},extra||{});
  const lie=bellUp(B([0,11,0],-88,0,LEGS_FLAT,{kneeOut:0.2}),{offL:1,freeL:[44,4,-22],eL:[1,-0.2,0]});
  const elbow=bellUp(B([0,13,0],-58,18,LEGS_FLAT),{offL:1,freeL:[34,4,-18],eL:[0.4,-1,-0.3]});
  const hand=bellUp(B([2,16,2],-32,28,LEGS_FLAT),{offL:1,freeL:handF,eL:[1,0,0]});
  const bridge=bellUp(B([0,40,8],-50,32,{L:[14,8,80],R:[-12,8,44]},{kneeOut:0.4}),{offL:1,freeL:handF,eL:[1,0,0],pass:true});
  const knee=bellUp(B([4,48,8],-8,58,{L:[12,10,-26],R:[-12,8,44]},{kneeOut:0.3,tL:1}),{offL:1,freeL:[36,4,4],eL:[1,0,0]});
  const tall=bellUp(B([0,58,10],0,0,{L:[12,10,-28],R:[-12,8,44]},{kneeOut:0.3,tL:1}),{offL:1,freeL:add([0,58,10],[24,4,6]),eL:[1,-0.5,0]});
  const up=bellUp(B([0,94,10],0,0,{L:[12,8,20],R:[-12,8,20]},{kneeOut:0.3}),{offL:1,freeL:[20,88,14],eL:[1,-0.5,0]});
  const seq=[lie,elbow,hand,bridge,knee,tall,up],dur=[0,1.0,0.9,0.9,1.0,0.9,1.2];
  const kf=[[0,lie],[0.6,{}]];let t=0.6;
  for(let i=1;i<seq.length;i++){t+=dur[i];kf.push([t,seq[i]],[t+0.25,{}]);t+=0.25}
  for(let i=seq.length-2;i>=0;i--){t+=dur[i+1];kf.push([t,Object.assign({},seq[i],{pass:false})],[t+0.25,{}]);t+=0.25}
  return both(kf);
}
function kbFrontSquat(){
  // Two-hand pickup to the rack, free arm straight out to the side, feet straight ahead. Squat with the
  // racked elbow inside the knee, leaning back against the bell, head up; roll the shoulder back and drive
  // all the way up. Set it down and do the other side.
  const arm=Object.assign({},RACK_R,{freeL:add(shoulderOf(UP_KB,'L'),[54,-1,4]),eL:[0,-1,0]});
  const top=Object.assign({},arm,{feet:KFEET,turn:4,kneeOut:0.45,roll:3});
  const bottom=carry(Object.assign({},UP_KB,{P:[1,48,-12],pitch:8,roll:5,feet:KFEET,turn:4,kneeOut:0.6}),arm);
  let kf=pickupToRack();
  kf.push([endOf(kf)+0.45,top],[endOf(kf)+0.75,{}]);
  for(let i=0;i<2;i++){const t=endOf(kf);kf.push([t+0.95,bottom],[t+1.2,{}],[t+2.0,top],[t+2.3,{}])}
  kf=kf.concat(shift(setDownFromRack(),endOf(kf)+0.2));
  return both(kf);
}

const MOVES={
  'kb:two-hand deadlift':{kf:kbDeadlift(),
    cue:'Feet shoulder-width, toes straight ahead, bell between your insteps. Push your hips back with your weight in your heels and knees behind your toes. Arms straight down the insides of your legs, both hands on the handle, head and tailbone in one line. Drive through your heels and stand all the way up: kneecaps up, tailbone under, ribs down. Sit back and touch the bell down.'},
  'kb:two-hand swing':{kf:kbSwing(),
    cue:'Bell a foot or so in front of you. Hinge, reach out with straight arms and tip it toward you, lats on. Hike it back high between your thighs, then snap your hips and stand all the way up so it floats to about chest height. Your arms are ropes; the hips do the work. On the last rep, track it out in front and set it down.'},
  'kb:around-the-world':{kf:kbAroundTheWorld(),
    cue:'Feet together, toes straight ahead, legs straight. Bell in front of your hips in both hands. Pass it around one hip, swap hands thumb to thumb behind your back, bring it around the other hip and swap in front. Arms long, shoulders down, eyes out ahead. Both directions.'},
  'kb:figure-8':{kf:kbFigure8(false),
    cue:'Feet about one and a half times shoulder width, toes straight. Hinge and pass the bell back between your legs under one leg; the other hand reaches behind that leg and takes it thumb to thumb. Stand all the way up and carry it round that hip to the front, then go under the other leg.'},
  'kb:figure-8 back to front':{kf:kbFigure8(true),
    cue:'Start with the bell behind you. Pass it from behind forward between your legs under one leg, arm straight; the front hand finds it. Stand all the way up and carry it round the other hip to the back, then go under the other leg. Heels flat, knees behind the toes.'},
  'kb:alternating halo':{kf:kbAltHalo(),
    cue:'The halo, changing direction every rep: right hand past the left ear, then left hand past the right ear. Elbows on your body at 90 degrees, head up and still. Say the lead out loud if it helps.'},
  'kb:rack pickup':{kf:kbRackPickup(),
    cue:'Pick up with two hands, the other hand cupped under. Rack: fingers to the sky, wrist flat, web of the hand deep in the corner of the handle, thumb at the collarbone, elbow by the hip, bell below the shoulder. Touch it to check. Then straighten the arm, thumb back, and lower it with one hand. Both sides.'},
  'kb:one-arm swing':{kf:kbOneArmSwing(),
    cue:'Bell a foot or so ahead, handle pointing away. Reach in thumb down, shoulder away from the ear. Hike it back, snap up and let the arm float to about 45 degrees below level, thumb turning up. At the bottom your forearm touches your inner thigh. Both hands.'},
  'kb:hand-to-hand swing':{kf:kbHandToHand(),
    cue:'Switch at the top, never the bottom. As the bell floats up, roll the thumb to the sky; the other hand takes the free side of the handle, thumb to thumb. Go down with the new hand, thumb back. Thumb up, grab, thumb down.'},
  'kb:push-back drill':{kf:kbPushBack(),
    cue:'Two hands to the rack. Elbow pinned to the hip, push the bell back, roll the thumb back and straighten the arm; sit back so your legs absorb it, forearm high on the inner thigh. Set it down out in front, stand, step up and repeat on the other side. Go slow.'},
  'kb:clean':{kf:kbClean(),
    cue:'Two hands to the rack. Pin the elbow, push back, thumb back, absorb with the hips. Snap the hips with the elbow pinned so the bell floats in close, and catch it soft in the rack: thumb at the collarbone, wrist flat, handle 45 degrees down. Pause and check. Not a biceps curl.'},
  'kb:clean with transitions':{kf:kbCleanTransitions(),
    cue:'Swing cleans that change hands without setting the bell down. Down into a swing, up and switch hands at the top, down with the new hand, up into the rack on the new side. Pause and check the rack every time. Say it out loud: down, up, down, up.'},
  'kb:overhead press':{kf:kbPress(),
    cue:'Your body is the bench: legs locked, glutes tight, belly in. From the rack, free arm out with a fist. Open the shoulder and press to lockout, biceps by the ear; squeeze the opposite glute. Pull it down and fold it in: elbow to hip, thumb to collarbone. Pause.'},
  'kb:clean & press':{kf:kbCleanPress(),
    cue:'Swing clean to the rack, pause and check, then press to lockout and fold it back to the rack. Elbow pinned on the way down and up; glutes on for the press.'},
  'kb:start-stop':{kf:kbStartStop(),
    cue:'Same start, same stop, every set. Bell a foot or so ahead. Reach in thumb down to the corner of the handle nearest you, hike it back, stand up into the clean and catch soft in the rack. Push it back and set it down right where it started.'},
  'kb:goblet squat':{kf:kbGobletHoldSquat(),label:'Goblet hold',alt:'kb:horn hold goblet squat',
    cue:'Goblet hold: hands on the horns, bell facing down at your chest, elbows in. Squat all the way down, chest up, and drive straight up. Squeeze at the top.'},
  'kb:horn hold goblet squat':{kf:kbBottomsUpSquat(),label:'Horn hold',alt:'kb:goblet squat',
    cue:'Horn hold: bell reversed, upside down by the horns, elbows on your ribs, bell off your chest. Squat with your elbows inside your knees: push out with the elbows, squeeze in with the knees, chest up. Stand all the way up.'},
  'kb:horn curl':{kf:kbHornCurl(),
    cue:'Horn hold: hands on the sides of the handle, bell reversed. Stand with the bell in front on straight arms. Keep the elbows locked to your ribs and curl the bell up to your chest, the forearms pivoting on the elbows. Lower it under control.'},
  'kb:pullover':{kf:kbPullover(),
    cue:'Horn hold at the chest. Take the bell over your head and down behind your back with the elbows at 90 degrees, then bring it back over to the front.'},
  'kb:tricep press':{kf:kbTricepPress(),
    cue:'Also called skull crushers. Like the pullover, but once the bell is behind your back keep the biceps by your ears and straighten the arms so the bell rotates up over your head, then lower it behind again. Bring it back over to the front to finish.'},
  'kb:crush press':{kf:kbCrushPress(),
    cue:'Crush grip: squeeze the ball of the bell between your palms, hands pressing together. Press it straight overhead and lower it to the chest under control.'},
  'kb:thrusters':{kf:kbThruster(),
    cue:'Hold the bell in a crush grip, horn hold or goblet hold at the chest. Front squat, and as you drive up carry the momentum straight into a push press overhead. Lower to the chest and go again.'},
  'kb:hands-under goblet squat':{kf:kbGobletSquat(),label:'Hands under the bell',
    cue:'The alternative hold: hands under the bell, handle on top, looking through the window. Elbows together. Squat all the way down, lean back away from the bell, and drive straight up. Tuck the tailbone and squeeze at the top.'},
  'kb:rack reverse lunge':{kf:kbRackLunge(),
    cue:'Bell in the rack in your lead hand, free arm out to the side. Step back with the same side leg, land softly on the ball of the foot, and lower until the back knee is just off the floor, front shin near vertical. Drive through the front foot and step back to the start. Both sides.'},
  'kb:suitcase deadlift':{kf:kbSuitcaseDeadlift(),
    cue:'Bell beside the outside of your lead foot. Shoulders square and level, push the hips back and hinge down to take the handle with the lead hand. Stand up with the arm still straight down holding the bell. Lower it the same way: tap it down for more reps, or set it down to finish. Both sides.'},
  'kb:farmer carry':{kf:kbFarmerCarry(),
    cue:'Suitcase deadlift the bell to standing, arm straight down at your side. Walk forward with short steps, body tall, shoulders even and the bell steady the whole time. Set it down with the same hinge. Both sides.'},
  'kb:push press':{kf:kbPushPress(),
    cue:'From the rack: a slight squat, then drive up through the legs and carry that power straight into the press, more explosive than the strict press. Finish locked out, biceps by the ear. Ease the bell back down to the rack under control. Both sides.'},
  'kb:double front squat':{kf:kbDoubleFrontSquat(),
    cue:'The front squat with a bell in each hand in the rack, wrists straight, elbows in. Sit down between your heels, chest up, and drive all the way up.'},
  'kb:double swing':{kf:kbDoubleSwing(),
    cue:'The one-arm swing with a bell in each hand, feet a little wider. Hike both back between the legs and snap the hips; the bells move together, side by side, without knocking into each other.'},
  'kb:snatch':{kf:kbSnatch(),
    cue:'From a one-arm swing, drive the bell up in one explosive move, close to the body, and punch through so it turns to sit behind the wrist (like the rack) with the arm straight up overhead, biceps by the ear and the bell high. Drop it back into the swing. Both sides.'},
  'kb:single-leg deadlift':{kf:kbSingleLegDeadlift(),
    cue:'Also called the single-leg RDL. Bell on the floor outside your lead foot. Hinge at the waist and let the other leg rise straight behind you, in line with your body. When you can reach the bell, take it like the suitcase deadlift and reverse the hinge. Keep the free leg off the floor while you repeat, or set the bell down to finish. Both sides.'},
  'kb:bent-over row':{kf:kbBentOverRow(),
    cue:'Bell on the floor between your legs. Pivot to one side and hinge forward with a straight back; rest or brace the free forearm on that leg. Reach down with the working arm and take the bell. Keeping everything else still, row it toward the chest, elbow to the hip pocket, then lower it under control. Pivot the other way to switch sides.'},
  'kb:gorilla row':{kf:kbGorillaRow(),
    cue:'Two bells on the floor, feet wide, a deep hinge forward with no pivot and a straight back. Rest on one bell and row the other to the chest like the bent-over row, then lower it under control. Set it down and row the other side.'},
  'kb:high pull':{kf:kbHighPull(),
    cue:'A two-hand swing that brings the handle up under the chin with the elbows as high as they go, then swings back down under control.'},
  'kb:overhead hold':{kf:both([[0,Object.assign({},LOCK_R)],[1.6,{}]]),
    cue:'Bell straight up overhead, arm locked, biceps by the ear, the bell resting behind the wrist. Hold it steady.'},
  'kb:windmill':{kf:kbWindmill(),
    cue:'From the overhead hold, bell straight up, pivot your feet 45 degrees toward the non-lead side. Hinge at the waist with the weight on the lead leg, kept straight, and glide the support hand down the inside of the other leg. Keep the bell straight up as your torso turns toward the lead side and hinges down: rotate your chest open so the bell, both shoulders and the support hand stay on one straight vertical line. Go until the support hand touches the floor, or as low as you can, then bring everything back up. Both sides.'},
  'kb:turkish get-up':{kf:kbTurkishGetUp(),
    cue:'Lie on your back, bell straight up over the lead shoulder, lead knee bent with the foot flat. Keep the bell straight up the whole time. Roll to the support elbow, straighten the support arm, push the hips up with both legs, sweep the support leg under you onto that knee, then stand up tall. Reverse to get down: to the support knee, the leg back out straight, then from the hand to the elbow to the shoulder and all the way down. Both sides.'},
  'kb:front squat':{kf:kbFrontSquat(),
    cue:'Bell in the rack, free arm straight out to the side, feet straight ahead. Squat with the racked elbow inside the knee, lean back against the bell, head up. Roll the shoulder back and drive all the way up. Both sides.'},
  'kb:halo':{kf:kbHalo(),
    cue:'Hold the bell by the horns, upside down in front of your chest: elbows on your body, forearms flat, bell pushed off your chest. Right hand goes past your left ear, around the back of your head (breathe in) and back to the front (breathe out). Pause. Move the bell, not your head. Then lead with the left hand.'},
  'mace:10-to-2':{kf:tenToTwo(),
    cue:'From the upright hold, swing first to the side your top hand points to, the opposite side (left hand on top goes over the right shoulder). Then behind your back, over the other shoulder, back again, and return to the upright hold. Keep your head centered.'},
  'mace:barbarian squat':{kf:barbarianSquat(),
    cue:'Pull the mace over your head so it hangs behind your back, then bring it back over the top all the way into the upright hold in front. Only then squat, and stand with it there.'},
  'mace:front squat':{kf:frontSquat(),
    cue:'Bring the mace up to the chest with the shaft vertical. Sit down between your hips with your chest tall, then stand.'},
  'mace:lateral lunge':{kf:lateralLunge(),
    cue:'From the upright hold, step wide. Shift well over one bent leg with the other locked straight; the top hand slides to the head and punches it down low and parallel along the straight leg. Rise to center, prayer-switch at the head, and punch down to the other side in one motion.'},
  'mace:front lunge':{kf:frontLunge(),
    cue:'Upright hold. Step forward into a lunge with the front shin near vertical, push back to standing. Both legs.'},
  'mace:360:left':{kf:threeSixty(),
    cue:'Left hand on top. Keep the elbows vertical and tight to your head. Press up just off to the right, pull over that shoulder, circle behind the back, come over the left shoulder and finish in a press just off to the left.'},
  'mace:360:right':{kf:mirrorKF(threeSixty()),
    cue:'Right hand on top. Keep the elbows vertical and tight to your head. Press up just off to the left, pull over that shoulder, circle behind the back, come over the right shoulder and finish in a press just off to the right.'},
  'mace:pendulum swing':{kf:pendulum(),
    cue:'Choke up and let the head hang down in front with your arms long. Small, controlled arcs side to side.'},
  'mace:gravedigger:left':{kf:gravedigger(),
    cue:'Shovel grip. From the right shoulder, dig the head down and across to the floor by your left foot, pivoting the back foot, then return to the shoulder.'},
  'mace:gravedigger:right':{kf:mirrorKF(gravedigger()),
    cue:'Shovel grip. From the left shoulder, dig the head down and across to the floor by your right foot, pivoting the back foot, then return to the shoulder.'},
  'mace:uppercut':{kf:uppercut(),
    cue:'Wide grip, working hand on the head. Start low and level along one side, head to the rear. Drive through a diagonal in front with the head low and finish level and high on the other side; back down the same way. Sword switch to change sides.'},
  'mace:paddle':{kf:paddle(),
    cue:'Like an oar on the low-hand side: low hand overhand near the head, top hand on the end. Pull the head front to back along that side for your reps, then sword switch to the other side.'},
  'mace:hand switches':{kf:handSwitches(),
    cue:'Wide grip, hands at the head and the base. The lead hand brings the head to the center while the base hand slides up to meet it in prayer, then the other hand carries the head out to the other side. Keep it fluid with the head at the same height.'},
  'mace:offset press':{kf:offsetPress(),
    cue:'Mace level with the head out to one side. Press it from the clean-rack position straight overhead, keeping it level. Both sides.'},
  'mace:ballistic curl':{kf:curl(false),
    cue:'Wide grip: the curling hand holds the head, the other hand the base, shaft centered and head down. Curl the head hand nearly straight up to the shoulder. Both sides.'},
  'mace:switch curl':{kf:curl(true),
    cue:'Wide grip with the curling hand on the head. Curl up, keep the mace arcing over the top, meet the hands at the head mid-arc and catch it with the other hand in the low curl position.'},
  'mace:offset bent-over row':{kf:offsetRow(),
    cue:'Hinge with a flat back. Two hands on the handle, mace level with the head out to one side. Row to the ribs. Both sides.'},
  'mace:offset march':{kf:offsetMarch(),
    cue:'Hold the mace level at chest height with the weight out to one side. March slowly without leaning. Both sides.'},
  'mace:shouldered reverse lunge':{kf:shoulderedLunge(),
    cue:'Mace resting on one shoulder. Reverse lunge on each leg and resist the lean. Switch shoulders halfway through your set.'},
  'mace:lunge to 360':{kf:lungeTo360(),
    cue:'Reverse lunge in the upright hold, stand, and drive straight into a 360. Then the other side.'},
  'mace:plank pull-through':{kf:plankPullThrough(),
    cue:'High plank with the mace on the floor beside you. Reach under your chest with the far hand and drag it across. Keep your hips level.'},
  'mace:reverse lunge:left':{kf:reverseLunge('L'),
    cue:'Left leg steps back. Front shin stays near vertical; the mace stays in the upright hold.'},
  'mace:reverse lunge:right':{kf:reverseLunge('R'),
    cue:'Right leg steps back. Front shin stays near vertical; the mace stays in the upright hold.'}
};
Object.assign(MOVES,{
  'club:side rocker':{kf:sideRocker(),
    cue:'Feet wide, knees soft, slight hinge, both hands on the handle with the club hanging in front of your shins. Rock it side to side like a pendulum and shift your weight onto the leg it moves toward.'},
  'club:lateral swing':{kf:both(lockSwing(lateralSwing(),'R')),
    cue:'One hand, wide hinge. Arm straight and elbow locked: the shoulder is the pivot. Swing the club across the front from outside one leg to outside the other, the torso turning with it and the free arm moving the other way.'},
  'club:side swing':{kf:both(lockSwing(sideSwingKF(false),'B')),label:'Two hands',alt:'club:single-arm side swing',
    cue:'Feet shoulder-width, toes forward. One hand on the pommel, the other over the top (the hand on the side the club swings up to goes on top). Elbows locked, shoulders packed, club pointing down. Cast it low to one side and hinge back at 45 degrees toward it, feeling your hamstrings load. Stay hinged until it crosses in front of your knees, then drive your hips forward so it rises across the front to shoulder height on the other side, chest and eyes on the club. Come back the same way. Your arms only hold on; the hips move the club. Swap hands each set.'},
  'club:single-arm side swing':{kf:both(lockSwing(sideSwingKF(true),'R')),label:'One hand',
    cue:'Same swing with one hand. Cast the club out to one side and hinge back at 45 degrees. Keep your hips back until the arm has passed the middle of your body, then snap them forward so the arm rises to shoulder height on the other side. Free arm out the other way for balance. Follow the same path back down. Both arms.'},
  'club:arm cast':{kf:both(armCast()),label:'One hand',alt:'club:two-hand arm cast',
    cue:'Also called a pullover. One hand, club in order at the shoulder. Arm cast up and over the shoulder with the elbow in and bent to 90 degrees, club hanging behind, then pull it back over the shoulder to order, keeping the bend. Both arms.'},
  'club:two-hand arm cast':{kf:both(twoArmCast()),label:'Two hands',alt:'club:arm cast',
    cue:'Also called a pullover. Two hands, club in order on the lead side. Arm cast up and over that shoulder: the lead elbow stays in at 90 degrees, and the supporting elbow goes up with the bicep by your ear and the forearm reaching over your head to the club. Pull the club back over the shoulder to order. Both sides.'},
  'club:reverse lunge arm cast':{kf:both(lungeArmCast(false)),label:'One hand',alt:'club:two-hand reverse lunge arm cast',
    cue:'One hand, club in order at the shoulder. Arm cast up and over the shoulder (elbow in, bent to 90 degrees) as you step back into a reverse lunge with the same side leg; the club hangs behind at the bottom. Pull it back over the shoulder to order as you stand and step back to your starting stance. Front shin near vertical. Both sides.'},
  'club:two-hand reverse lunge arm cast':{kf:both(lungeArmCast(true)),label:'Two hands',alt:'club:reverse lunge arm cast',
    cue:'Two hands, club in order on the lead side. Two-hand arm cast over that shoulder as you step back into a reverse lunge with the lead side leg; the club hangs behind at the bottom. Pull it back over the shoulder to order as you stand and step back to your starting stance. Front shin near vertical. Both sides.'},
  'club:forward lunge flag press':{kf:both(lungeFlagPress(false)),label:'One hand',alt:'club:two-hand forward lunge flag press',
    cue:'One hand, club in order at the shoulder. Step forward into a lunge with the same side leg as you press the club straight out in front at shoulder height, club upright. Come back to order as you step back to your starting stance. Front shin near vertical. Both sides.'},
  'club:two-hand forward lunge flag press':{kf:both(lungeFlagPress(true)),label:'Two hands',alt:'club:forward lunge flag press',
    cue:'Two hands, club in order on the lead side. Step forward into a lunge with the lead side leg as you press the club straight out in front at shoulder height, club upright. Come back to order as you step back to your starting stance. Front shin near vertical. Both sides.'},
  'club:clock squat':{kf:both(clockSquat(false)),label:'One hand',alt:'club:two-hand clock squat',
    cue:'One hand, from order. Cast out into an outside circle and bring the club to rest across the opposite shoulder, as close to horizontal as you can and behind your head so the weight is centred. Squat. As you stand, cast it out from that side into another circle and rest it across your lead shoulder, then squat again. Stand and return to order. Both sides.'},
  'club:two-hand clock squat':{kf:both(clockSquat(true)),label:'Two hands',alt:'club:clock squat',
    cue:'Two hands, from order on the lead side. Cast out into an outside circle and bring the club to rest across the opposite shoulder, as close to horizontal as you can and behind your head so the weight is centred. Squat. As you stand, cast it out from that side into another circle and rest it across your lead shoulder, then squat again. Stand and return to order. Both sides.'},
  'club:bullwhip':{kf:both(bullwhip()),label:'One hand',
    cue:'One hand only. From order, cast out into an outside circle and rotate your torso to the far side as you bring the club across. Turn the wrist so the hand comes up that far side with the club hanging down, bring it past the far-side ear and half mill it behind your head (the small circle), pull it over your lead shoulder and cast out into an inside circle. To repeat, let the circle swing the club out to a straight arm at shoulder height and swing straight back into the outside circle. Both arms.'},
  'club:h2h clean':{kf:both(lockSwing(h2hClean(),'B')),label:'Two hands',
    cue:'Two hands, from order on the lead side. Two-hand front swing: cast forward, down and back between the legs, then drive the hips. On the way back up let go with the bottom hand and let the club slide out until the top hand rests against the pommel. Take hold again with the loose hand above it: that hand is now on top and leads, and the club comes to order on its side. Each rep switches the lead.'},
  'club:double swipe':{kf:doubleSwipe(),label:'Two clubs',
    cue:'A club in each hand, in order at each shoulder. Both sides swipe at the same time: hinge and swing both clubs down past the outside of the knees, elbows tight to your body, back up into an arm cast over each shoulder, and back to order.'},
  'club:double mill':{kf:doubleMill(),label:'Two clubs',
    cue:'A club in each hand. Each hand does its own full mill over and over: the inside circle, then the half mill behind the head, then straight into the next inside circle. The hands stay half a cycle apart for balance: one does the inside circle while the other does the half mill, then they swap. Keep it smooth.'},
  'club:front lever hold':{kf:both(frontLever()),label:'One hand',
    cue:'One hand. A single flag press: press the club straight out in front at shoulder height, club upright, and pause there at full extension. Back to order. Both arms.'},
  'club:side lever hold':{kf:both(sideLever()),label:'One hand',
    cue:'One hand. A side press: press the club straight out to the side at shoulder height with a straight arm, club upright, and pause there at full extension. Back to order. Both arms.'},
  'club:one-arm shield cast':{kf:both(oneArmShield()),
    cue:'One hand, club in order at the shoulder. Cast it over the opposite ear, let it swing down behind your head and shoulders, then pull it over your lead shoulder back to the front and into order. Both arms.'},
  'club:two-hand clean':{kf:lockSwing(twoClean(),'B'),
    cue:'Hinge and let the club drop between your legs, then drive with your hips to float it up. Tighten to stop it in order, hands at the sternum. Power from the hips, not the arms.'},
  'club:gamma cast':{kf:both(gamma()),
    cue:'Two hands. Arm cast over your lead shoulder: lead elbow in at 90 degrees, supporting elbow up by the ear. With the club still hanging behind, carry your hands over the top of your head to the other shoulder, with no swing of the club, and pull it over that shoulder to order. Then back the other way.'},
  'club:swing squat':{kf:lockSwing(swingSquat(),'B'),
    cue:'From order, cast forward into a swing with your arms locked out. Catch the club back in order as you sit into a squat, then stand.'},
  'club:arm cast to flag press':{kf:both(castFlag()),
    cue:'Two hands, club in order on the lead side. Two-hand arm cast over that shoulder (lead elbow in at 90 degrees, supporting elbow up by the ear) and pull it back over, then press the club straight out in front at shoulder height, club upright, like the flag press. Back to order. Both sides.'},
  'club:clean to torch press':{kf:lockSwing(cleanPress(),'B'),
    cue:'Clean the club to order, then drive it forward and up to straight arms, still upright. Lower to order under control.'},
  'club:barbarian squat':{kf:both(clubBarbarian()),
    cue:'Start with a two-hand arm cast over the lead shoulder. As you pull the club back to the front, sink into the squat and lock the arms out, club upright. Arm cast again as you stand, and repeat. Then switch your top hand and do the same on the other side.'},
  'club:order squat':{kf:orderSquat(),
    cue:'Club upright in order, hands at the sternum, elbows by the ribs. Sit tall into the squat and stand.'},
  'club:side swipe':{kf:both(lockSwing(sideSwipe(),'R')),
    cue:'One hand, from order. A side swing: cast the club low to the far side, then let it swing back up your lead side and carry it on up and over the shoulder, opening the elbow out to the side, so it drops behind that shoulder in a side arm cast. Pull it back over the shoulder to order. Both arms.'},
  'club:swipe':{kf:both(swipe()),
    cue:'One hand, from order. Hinge and swing the club down past the outside of the same knee, elbow tight to your body. Swing it back up the same way and on into an arm cast over the shoulder, then pull it back to order. Keep it outside the legs. Both arms.'},
  'club:side clean':{kf:both(lockSwing(sideClean(),'B')),
    cue:'Club in order on one side. Turn your torso away from it, weight on the near leg and held by that glute, and cast the club out to the far side. Let it swing down in front and across to the near side as your weight shifts over, then swing it back up the same path and catch it in order. Both sides.'},
  'club:inside circle':{kf:both(insideCircle()),
    cue:'One hand, club in order with the elbow tight to your side. Turn your torso toward the inside to aim the club, then push it straight out, club upright. Let it drop in across your body, down and out to the side with the arm long, turning against its weight, and bring it back to a 90-degree elbow with the elbow at your side. Then order. The club never goes over your head. Both arms.'},
  'club:outside circle':{kf:both(outsideCircle()),
    cue:'One hand, club in order with the elbow tight to your side. Turn your torso toward your lead side to aim the club, then push it straight out, club upright. Let it drop out to the side, down, across the front and up the inside with the arm long, and bring it back to a 90-degree elbow with the elbow at your side. Then order. The club never goes over your head. Both arms.'},
  'club:flag press':{kf:both(flagPress()),label:'One hand',alt:'club:two-hand flag press',
    cue:'One hand, club in order on your lead side. Press it straight out in front at shoulder height, club upright, then bring it back to order. Both arms.'},
  'club:two-hand flag press':{kf:both(flagPressTwo()),label:'Two hands',
    cue:'Two hands, club in order on the lead side. Press it straight out in front at shoulder height, club upright, then back to order. Both sides.'},
  'club:mill':{kf:both(mill()),
    cue:'One hand. From order, elbow at your side, turn toward the inside and push the club straight out, club upright. Inside circle with the arm long; as it rises up your side, carry it straight on: cast it behind your head, let it swing down behind the shoulder and round, turning your body against the weight, and pull it back in front to order. Both arms.'},
  'club:reverse mill':{kf:both(reverseMill()),
    cue:'One hand. From order, elbow at your side, turn toward your lead side and push the club straight out, club upright. Outside circle with the arm long, then carry it straight on over your lead shoulder, down behind and round behind your head, and pull it back over the shoulder to order. Both arms.'},
  'club:rotational torch press':{kf:both(rotTorchPress()),
    cue:'One hand, cross-body only. From order, turn the torso a full 90 degrees in toward the other side, pivoting on the back foot, and press the club up to a forearm lock as you turn, club upright, free arm reaching forward. Turn back to the front and bring the club back in to order on the way. Both arms.'},
  'club:half reverse mill':{kf:both(halfRevMillFront()),cue:'From order, the small outside circle: over the lead shoulder, down behind and round behind the head. Let the club whip your body round to the other side, pivoting the feet.'},
  'club:half mill':{kf:halfMill(),cue:'From order, the small inside circle: elbow out to the side, cast behind the head, down behind the shoulder and round to the front. Let the momentum turn your hips back.'},
  'club:switch shield cast':{kf:both(switchShield()),
    cue:'One-arm shield cast that changes hands every rep. Cast over the opposite ear, swing down behind and pull it over your lead shoulder, then bring the club down toward the navel. The other hand catches it there and starts its own shield cast.'},
  'club:switch reverse mill':{kf:both(switchRevMill()),
    cue:'A reverse mill that changes hands every rep. Turn, push out, outside circle with the arm long, over the lead shoulder and round behind the head. Then an extra outside circle carries the club across to the other side, where the free hand catches it and reverse mills from there.'},
  'club:one-hand 180':{kf:both(lockSwing(oneHand180(),'R')),
    cue:'One hand, and it stays in that hand. Order with the elbow tucked. Rotate through the upper back, cast the club away with the arm locked, and let it swing down and across in a low U and up the other side into a cross-body order, club upright in front of the opposite chest. Cast it back out to reverse the circle, down and across, and up to order. Both arms.'},
  'club:switch 180':{kf:both(lockSwing(switch180(),'R')),
    cue:'One hand, order with the elbow tucked, shoulder packed and wrist straight. Rotate through the upper back, cast the club away with the arm locked, and let it swing down and across the front in a low U and up the other side. The free hand catches it upright there. Then the other way.'},
  'club:shield cast':{kf:both(topSwap(shieldCast())),
    cue:'Both hands, club upright and close in front of the chest. Drop it behind one shoulder and circle it round the head and shoulder, then back out over the same shoulder. Keep it close. Alternate sides.'},
  'club:torch press':{kf:both(torchPress()),label:'One hand',alt:'club:two-hand torch press',
    cue:'Club upright like a torch at the shoulder. Press it up and a little out in front of you, keeping it vertical, and lower under control. Both arms.'},
  'club:two-hand torch press':{kf:both(torchPressTwo()),label:'Two hands',
    cue:'Two hands, club upright in order on the lead side. Press it up and a little out in front of you, keeping it vertical, and lower under control. Both sides.'},
});
MOVES['mace:360']={kf:both(threeSixty()),cue:'One 360 each way. Elbows vertical and tight to the head: press just off one side, pull over, circle behind the back, finish in a press just off the other side.'};
MOVES['mace:gravedigger']={kf:both(gravedigger()),cue:'Shovel grip. Dig the head down and across to the floor by the opposite foot, pivoting the back foot. Both sides.'};
MOVES['mace:reverse lunge']={kf:join([MOVES['mace:reverse lunge:left'],MOVES['mace:reverse lunge:right']]).kf.map(([t,p])=>[t/TEMPO,p]),
  cue:'Alternate legs. Front shin stays near vertical; the mace stays in the upright hold.'};

/* ---------- names ---------- */
const ALIAS={kb:{'bottoms-up press':'crush press','skull crushers':'tricep press','skull crusher':'tricep press','tricep press/skull crushers':'tricep press','thruster':'thrusters','horn hold squat':'horn hold goblet squat','goblet':'goblet squat','bottoms-up goblet squat':'goblet squat','bottoms-up goblet':'goblet squat','goblet squat by the horns':'goblet squat',
    'goblet squat, hands under the bell':'hands-under goblet squat','hands under goblet squat':'hands-under goblet squat',
    'single kettlebell front squat':'front squat','kettlebell front squat':'front squat','single front squat':'front squat','figure 8':'figure-8','figure 8 front to back':'figure-8','figure-8 front to back':'figure-8','figure 8s':'figure-8',
    'figure 8 back to front':'figure-8 back to front','alternating-direction halo':'alternating halo','alternating halos':'alternating halo',
    'two hands to rack':'rack pickup','rack pick-up':'rack pickup','single-arm swing':'one-arm swing','baby single-arm swing':'one-arm swing',
    'one arm swing':'one-arm swing','hand-to-hand swing switch':'hand-to-hand swing','hand-to-hand transition':'hand-to-hand swing','hand to hand swing':'hand-to-hand swing',
    'push back drill':'push-back drill','push-back drill from the rack':'push-back drill','swing clean':'clean','first swing clean':'clean',
    'swing clean with hand-to-hand transitions':'clean with transitions','clean transitions':'clean with transitions',
    'press':'overhead press','single-arm press':'overhead press','single-arm overhead press':'overhead press',
    'clean and press':'clean & press','start stop':'start-stop','two hand swing':'two-hand swing','2-hand swing':'two-hand swing','swing':'two-hand swing',
    'two hand deadlift':'two-hand deadlift','two-hand deadlift practice':'two-hand deadlift','2-hand deadlift':'two-hand deadlift','deadlift':'two-hand deadlift',
    'around the world':'around-the-world','halos':'halo','light halos':'halo','single-direction halo':'halo'},
  mace:{'hand switch':'hand switches','rotational uppercut':'uppercut','overhead press':'offset press',
  'squat':'front squat','bent-over row':'offset bent-over row','offset row':'offset bent-over row','pendulum swings':'pendulum swing'},
  club:{'switch shield casts':'switch shield cast','switch 180s':'switch 180',"switch 180's":'switch 180','switch reverse mills':'switch reverse mill','half mill rotational torch press':'rotational torch press','side swipes':'side swipe','one-hand swipe':'swipe','one-arm swipe':'swipe','inside and outside circles':'inside circle','inside circles':'inside circle','outside circles':'outside circle','mills':'mill','reverse mills':'reverse mill','pullover':'two-hand arm cast','pullovers':'two-hand arm cast','club pullover':'two-hand arm cast','two-hand pullover':'two-hand arm cast','two-handed pullover':'two-hand arm cast','one-hand pullover':'arm cast','one-handed pullover':'arm cast','one-arm pullover':'arm cast','arm casts':'arm cast','two-handed flag press':'two-hand flag press','one-hand flag press':'flag press','two-handed torch press':'two-hand torch press','one-hand torch press':'torch press','side cleans':'side clean','two-hand side clean':'side clean','two-hand side swing':'side swing','two-handed side swing':'side swing','two-hand side swings':'side swing','side swings':'side swing','steel club side swing':'side swing','single-arm side swing':'single-arm side swing','single side swing':'single-arm side swing','one-arm side swing':'single-arm side swing','one-hand side swing':'single-arm side swing','single-arm side swings':'single-arm side swing','two-handed side rocker':'side rocker','two-hand side rocker':'side rocker','cross-body swing':'lateral swing','cross-body swings':'lateral swing','side rock-it':'side rocker','side rocket':'side rocker',
    'swing':'lateral swing','swings':'lateral swing','one-arm arm cast':'arm cast','two-hand swipe':'swipe','swipes':'swipe',
    'two-hand shield cast':'shield cast','shield cast, one arm':'one-arm shield cast',
    'clean':'two-hand clean','two-handed clean':'two-hand clean','180':'one-hand 180','180s':'one-hand 180','one-arm 180':'one-hand 180','two-hand 180':'one-hand 180','two-handed 180':'one-hand 180',
    'two-handed swing squat':'swing squat','two-hand swing squat':'swing squat',
    'two-hand arm cast to flag press':'arm cast to flag press','two-handed arm cast to flag press':'arm cast to flag press',
    'two-hand clean to torch press':'clean to torch press','two-handed clean to torch press':'clean to torch press',
    'club barbarian squat':'barbarian squat','order-position squat':'order squat','two-handed arm cast':'two-hand arm cast'}};
function key(name,eq){
  let n=String(name).toLowerCase().replace(/\s*[×x]\s*\d.*$/,'').replace(/\(.*?\)/g,'').trim();
  let side='';
  const sh=n.match(/\s*\bover the (left|right) shoulder\b/);
  if(sh){side=sh[1]==='right'?'left':'right';n=n.replace(sh[0],'')} // over the right shoulder first = left hand on top
  else{const m=n.match(/,?\s*\b(left|right)\b.*$/);if(m){side=m[1];n=n.slice(0,m.index)}}
  n=n.replace(/,.*$/,'').replace(/^(mace|steel mace|club|steel club|kettlebell|kb)\s+/,'').replace(/[–—]/g,'-').replace(/\s+/g,' ').trim();
  n=(ALIAS[eq]&&ALIAS[eq][n])||n;
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

/* ---------- straight-arm swings ----------
   A pose with lock:'R' (right arm), 'L', 'B' (two hands on one club) or '2' (a club in each hand) has the
   swinging arm straight. Between two locked poses the hand travels on an arc around the shoulder (for two
   hands, around the middle of the shoulders) instead of a straight line, so the elbow never bends. */
function lockParts(p){            // [hand point, pivot, club key, grip offset] for each locked arm
  const sh=s=>shoulderOf(p,s),mid=()=>mul(add(sh('L'),sh('R')),0.5);
  if(p.lock==='R')return [[add(p.G,mul(p.D,p.gR||0)),sh('R'),'G','D',p.gR||0]];
  if(p.lock==='L')return [[add(p.G,mul(p.D,p.gL||0)),sh('L'),'G','D',p.gL||0]];
  if(p.lock==='B'){const g=((p.gR||0)+(p.gL||0))/2;return [[add(p.G,mul(p.D,g)),mid(),'G','D',g]]}
  if(p.lock==='2')return [[add(p.G,mul(p.D,p.gR||0)),sh('R'),'G','D',p.gR||0],[add(p.G2,mul(p.D2,p.gR||0)),sh('L'),'G2','D2',p.gR||0]];
  return [];
}
// two hands on one club: how far out along dir (from mid-shoulders) the hands go so the farther arm is straight
function reachB(p,piv,dir,g){
  const sL=shoulderOf(p,'L'),sR=shoulderOf(p,'R');
  const far=r=>{const h=add(piv,mul(dir,r));return Math.max(Math.hypot(...sub(add(h,mul(p.D,(p.gL||0)-g)),sL)),Math.hypot(...sub(add(h,mul(p.D,(p.gR||0)-g)),sR)))};
  let lo=20,hi=70;for(let i=0;i<24;i++){const m=(lo+hi)/2;if(far(m)>REACH1)hi=m;else lo=m}
  return lo;
}
function slerp(a,b,u){const d=Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2])),w=Math.acos(d);
  if(w<1e-3)return norm(vl(a,b,u));const s=Math.sin(w);return add(mul(a,Math.sin((1-u)*w)/s),mul(b,Math.sin(u*w)/s))}
function armArc(a,b,o,u){
  const A=lockParts(a),B=lockParts(b),O=lockParts(Object.assign({},o,{lock:a.lock}));
  A.forEach(([ha,pa],i)=>{const [hb,pb]=B[i],[,po,gk,dk,g]=O[i];
    const da=sub(ha,pa),db=sub(hb,pb),la=Math.hypot(...da),lb=Math.hypot(...db);
    const dir=slerp(norm(da),norm(db),u),len=a.lock==='B'?reachB(o,po,dir,g):lerp(la,lb,u);
    const hand=add(po,mul(dir,len));
    o[gk]=sub(hand,mul(o[dk],g))});
  o.lock=a.lock;
}
// straighten the swinging arm(s) of a full pose: same direction from the shoulder, at locked-arm length
function straight(p,lock){
  const o=Object.assign({},p,{lock});
  lockParts(o).forEach(([h,piv,gk,dk,g])=>{const dir=norm(sub(h,piv)),r=lock==='B'?reachB(o,piv,dir,g):REACH1;o[gk]=sub(add(piv,mul(dir,r)),mul(o[dk],g))});
  return o;
}
// lock the arm straight wherever the hand hangs well below the shoulder (the swing), leaving order alone
function lockSwing(kf,lock,drop=28){
  return resolve(kf).map(([t,p])=>{const parts=lockParts(Object.assign({},p,{lock}));
    const low=parts.length&&parts.every(([h,piv])=>piv[1]-h[1]>drop);
    if(!low){const q=Object.assign({},p);delete q.lock;return [t,q]}
    return [t,straight(p,lock)]});
}
function resolve(kf){
  let cur=null;
  return kf.map(([t,p])=>{const hold=!Object.keys(p).length;cur=Object.assign({},cur||p,p);if(!('pass' in p))cur.pass=false;if(!hold&&!('lock' in p))delete cur.lock;return [t,cur]});
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
    const o={feet:{L:vl(a.feet.L,b.feet.L,u),R:vl(a.feet.R,b.feet.R,u)},D:norm(vl(a.D,b.D,u))};
    for(const k of ['P','G','eL','eR','freeL','freeR'])o[k]=vl(a[k],b[k],u);
    for(const k of ['pitch','yaw','roll','hipYaw','turn','fyL','fyR','tL','tR','gR','gL','choke','offL','offR','kneeOut','len','kb','hR','hL','hD'])o[k]=lerp(a[k],b[k],u);
    o.W=norm(vl(a.W,b.W,u));o.twist=lerp(a.twist||0,b.twist||0,u);
    if(a.G2&&b.G2){o.G2=vl(a.G2,b.G2,u);o.D2=norm(vl(a.D2,b.D2,u))}
    if(a.W2&&b.W2)o.W2=norm(vl(a.W2,b.W2,u));   // a club in the left hand too (two clubs)
    if(a.lock&&a.lock===b.lock)armArc(a,b,o,u);
    return o;
  }
  return kf[kf.length-1][1];
}

/* ---------- skeleton ---------- */
const BELL_R=10.5,BELL_C=15;            // bell radius; handle middle to bell centre
function bellOf(p){
  const C=add(p.G,mul(p.D,BELL_C));
  return {C,a:sub(p.G,mul(p.W,7.5)),b:add(p.G,mul(p.W,7.5)),
    ha:add(sub(C,mul(p.W,7)),mul(p.D,-5)),hb:add(add(C,mul(p.W,7)),mul(p.D,-5))};
}
function ik(A,T,a,b,pole){
  let d=sub(T,A),dl=len(d);const max=a+b-0.01;
  if(dl>max){T=add(A,mul(d,max/dl));d=sub(T,A);dl=max}
  const u=mul(d,1/dl),x=(a*a-b*b+dl*dl)/(2*dl),h=Math.sqrt(Math.max(0,a*a-x*x));
  let bend=sub(pole,mul(u,dot(pole,u)));if(len(bend)<1e-4)bend=Math.abs(u[1])<0.9?[0,1,0]:[0,0,1];
  return [add(add(A,mul(u,x)),mul(norm(bend),h)),T];
}
function skeleton(p){
  const {l,u,f,f0}=torsoFrame(p.P,p.pitch,p.yaw,p.roll,p.twist||0),lh=rotY([1,0,0],p.hipYaw),fh=rotY([0,0,1],p.hipYaw);
  const P=p.P,neck=add(P,mul(u,TORSO)),head=add(add(neck,mul(u,15)),mul(f,2));
  const sk={P,neck,head,u,f,l,f0};
  sk.sh={L:add(add(neck,mul(l,17)),mul(u,-4)),R:add(add(neck,mul(l,-17)),mul(u,-4))};
  sk.hip={L:add(P,mul(lh,9)),R:add(P,mul(lh,-9))};
  const at=(h,lat,fw)=>add(add(add(P,mul(u,h)),mul(l,lat)),mul(f,fw));
  sk.torso=[at(46,14,0),at(46,-14,0),at(36,15,0),at(36,-15,0),at(36,0,10),at(38,0,-9),
    at(18,10.5,0),at(18,-10.5,0),at(18,0,8),at(18,0,-9),at(2,12.5,0),at(2,-12.5,0),at(2,0,8),at(4,0,-10),at(-3,0,0)];
  for(const s of ['L','R']){
    const sg=s==='L'?1:-1,toe=s==='L'?p.tL:p.tR;
    const pole=norm(add(fh,mul(lh,sg*p.kneeOut)));
    const [knee,ank]=ik(sk.hip[s],p.feet[s],THIGH,SHIN,pole);
    const h=rotY([sg*Math.sin(p.turn*Math.PI/180),0,Math.cos(p.turn*Math.PI/180)],p.hipYaw+(s==='L'?p.fyL:p.fyR));
    const fd=norm(add(mul(h,1-0.3*toe),[0,-0.3-0.6*toe,0]));
    sk['knee'+s]=knee;sk['ank'+s]=ank;sk['toe'+s]=add(ank,mul(fd,FOOT));
  }
  if(p.kb>0.5){const g=add(p.G,mul(p.D,p.hD));
    sk.hand={R:vl(add(g,mul(p.W,p.hR)),p.freeR,p.offR),L:vl(add(g,mul(p.W,p.hL)),p.freeL,p.offL)};}
  else sk.hand={R:vl(add(p.G,mul(p.D,p.gR)),p.freeR,p.offR),L:vl(add(p.G,mul(p.D,p.gL)),p.freeL,p.offL)};
  if(p.G2)sk.hand.L=p.kb>0.5?vl(add(p.G2,mul(p.D2,p.hD||0)),p.freeL,p.offL||0):add(p.G2,mul(p.D2,p.gR||0));
  for(const s of ['L','R']){const [elb,wr]=ik(sk.sh[s],sk.hand[s],UARM,FARM,norm(s==='L'?p.eL:p.eR));sk['elb'+s]=elb;sk['wr'+s]=wr}
  sk.len=p.len;sk.butt=sub(p.G,mul(p.D,p.choke));sk.tip=add(sk.butt,mul(p.D,p.len));
  sk.gripTop=add(sk.butt,mul(p.D,p.len<80?16:22));
  if(p.G2&&!(p.kb>0.5)){sk.butt2=sub(p.G2,mul(p.D2,p.choke));sk.tip2=add(sk.butt2,mul(p.D2,p.len));sk.gripTop2=add(sk.butt2,mul(p.D2,16))}
  if(p.kb>0.5){sk.kb=true;sk.bell=bellOf(p);sk.tip=sk.bell.C;if(p.G2)sk.bell2=bellOf({G:p.G2,D:p.D2,W:p.W2})}
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
  const hid=(a,b)=>((dz(a)+dz(b))/2<body-6?' dm-hid':'');
  if(sk.kb){
    // kettlebell: a handle with two horns over a round bell
    for(const B of [sk.bell,sk.bell2]){if(!B)continue;     // a second bell in the left hand for double moves
      seg(B.a,B.b,4,'dm-kbh'+hid(B.a,B.b));seg(B.a,B.ha,4,'dm-kbh'+hid(B.a,B.ha));seg(B.b,B.hb,4,'dm-kbh'+hid(B.b,B.hb));
      const C=pr(B.C);items.push({z:dz(B.C),s:`<circle cx="${f1(C[0])}" cy="${f1(C[1])}" r="${f1(BELL_R*S)}" class="dm-bell${hid(B.C,B.C)||' dm-ring'}"/>`});}
  }else if(sk.len<80){
    // club: knob, handle, then a body that swells toward a rounded end (two clubs: one in each hand)
    const club=(butt,neck,tip)=>{const N=7;
      seg(butt,neck,4.5,'dm-grip'+hid(butt,neck));
      const K=pr(butt);items.push({z:dz(butt),s:`<circle cx="${f1(K[0])}" cy="${f1(K[1])}" r="3.6" class="dm-ball${hid(butt,butt)}"/>`});
      for(let i=0;i<N;i++){const a=vl(neck,tip,i/N),b=vl(neck,tip,(i+1)/N),w=5+8*Math.sqrt((i+0.5)/N);
        seg(a,b,w,'dm-shaft'+hid(a,b))}
      const T=pr(tip);items.push({z:dz(tip),s:`<circle cx="${f1(T[0])}" cy="${f1(T[1])}" r="6.5" class="dm-ball${hid(tip,tip)||' dm-ring'}"/>`});};
    club(sk.butt,sk.gripTop,sk.tip);
    if(sk.tip2)club(sk.butt2,sk.gripTop2,sk.tip2);
  }else{
    const N=8;
    for(let i=0;i<N;i++){const a=vl(sk.butt,sk.tip,i/N),b=vl(sk.butt,sk.tip,(i+1)/N);
      seg(a,b,4,'dm-shaft'+hid(a,b))}
    seg(sk.butt,sk.gripTop,7,'dm-grip'+(dz(sk.butt)<body-6?' dm-hid':''));
    const T=pr(sk.tip);items.push({z:dz(sk.tip),s:`<circle cx="${f1(T[0])}" cy="${f1(T[1])}" r="8" class="dm-ball${dz(sk.tip)<body-6?' dm-hid':' dm-ring'}"/>`});
  }
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
    const trail=[];for(let i=12;i>=1;i--){const tt=t-i*0.035;if(tt<0)continue;const q=poseAt(tl.kf,tt);
      trail.push(q.kb>0.5?add(q.G,mul(q.D,BELL_C)):add(sub(q.G,mul(q.D,q.choke)),mul(q.D,q.len)))}
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
    <div class="seg dm-alt" id="dmAlt" role="group" aria-label="Version" hidden></div>
    <input type="range" class="dm-scrub" id="dmScrub" min="0" max="1000" value="0" aria-label="Move through the demo">
    <ol class="dm-steps" id="dmSteps" hidden></ol>
    <p class="dm-cue" id="dmCue"></p>
    <div class="dm-ctl"><button type="button" class="btn small" id="dmPlay">❚❚ Pause</button>
      <div class="seg dm-speed" role="group" aria-label="Speed"><button type="button" data-sp="0.5" aria-pressed="false">½×</button><button type="button" data-sp="1" aria-pressed="true">1×</button></div></div>
    <p class="hint">Lighter limbs are on the far side of the body. Anything faded and dashed is behind the body. The thin trail shows the path the end of the mace, club or bell just took.</p>`;
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
function show(title,eye,tl,stepNames,variants){
  const d=ensureDialog();if(player)player.destroy();
  // versions of one move (e.g. goblet squat by the horns / hands under the bell): a switch above the slider
  const alt=d.querySelector('#dmAlt');
  if(variants&&variants.length>1){alt.hidden=false;
    alt.innerHTML=variants.map((v,i)=>`<button type="button" data-v="${i}" aria-pressed="${i===0}">${esc(v.label)}</button>`).join('');
    alt.onclick=e=>{const b=e.target.closest('[data-v]');if(!b)return;
      alt.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));start(variants[+b.dataset.v].tl)}}
  else{alt.hidden=true;alt.innerHTML='';alt.onclick=null}
  d.querySelector('#dmTitle').textContent=title;d.querySelector('#dmEye').textContent=eye;
  const steps=d.querySelector('#dmSteps');
  if(stepNames){steps.hidden=false;steps.innerHTML=stepNames.map((s,i)=>`<li><button type="button" data-i="${i}">${esc(s)}</button></li>`).join('')}
  else{steps.hidden=true;steps.innerHTML=''}
  const playBtn=d.querySelector('#dmPlay'),scrub=d.querySelector('#dmScrub');
  d.querySelectorAll('[data-sp]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.sp==='1'));
  function start(tl){
    if(player)player.destroy();
    player=Player({front:d.querySelector('#dmFront'),side:d.querySelector('#dmSide')},tl,(i,m)=>{
      d.querySelector('#dmCue').textContent=m.cue||'';
      steps.querySelectorAll('button').forEach((b,j)=>b.setAttribute('aria-current',j===i?'step':'false'));
    });
    const sp=d.querySelector('[data-sp][aria-pressed="true"]');if(sp)player.speed(+sp.dataset.sp);
    player.onstate=on=>{playBtn.textContent=on?'❚❚ Pause':'▶ Play'};
    player.ontime=x=>{scrub.value=Math.round(x*1000)};
    player.autoplay?player.play():player.onstate(false);
  }
  if(!d.open)d.showModal();
  start(tl);
}

/* ---------- flowing flow demos ----------
   A flow built here plays as one continuous movement: each move runs straight into the next with no stop
   at order and no blend pause, and the whole cycle repeats on the other lead side. Marks carry the step
   index (for highlighting the step list) and the lead side. */
function trimHold(kf){let e=kf.length;while(e>1&&!Object.keys(kf[e-1][1]).length)e--;return kf.slice(0,e)}
function flowChain(parts){               // parts: [kf, step index]; the first part keeps its start pose
  const out=[],marks=[];let end=0;
  parts.forEach(([kf,step],i)=>{
    let k=trimHold(kf);
    if(i){                                // run through the move's start pose without stopping: drop only its hold
      const hold=k.length>2&&!Object.keys(k[1][1]).length?k[1][0]-k[0][0]:0;
      k=[[k[0][0],Object.assign({},k[0][1],{pass:true})]].concat(k.slice(hold?2:1).map(([t,p])=>[t-hold,p]))}
    const off=i?end+0.3-k[0][0]:0;
    marks.push({t:i?end:0,step});
    k.forEach(([t,p])=>out.push([t+off,p]));
    end=out[out.length-1][0];
  });
  return {kf:out,marks,end};
}
function flowTL(sides,stepNames){       // sides: [[kf, step], ...] for the right lead; mirrored for the left
  const right=sides,left=sides.map(([kf,st])=>[mirrorKF(kf),st]);
  const c=flowChain(right.concat(left));
  c.kf.push([c.end+0.3,{}]);
  const tl=join([{kf:c.kf}]);
  tl.marks=c.marks.map((m,i)=>({t:m.t*TEMPO,step:m.step,side:i<right.length?'Right hand leads':'Left hand leads',
    label:stepNames[m.step]+(i<right.length?' (right hand)':' (left hand)')}));
  return tl;
}
const FLOW_TL={
  // Three-Club Mini Flow (Chris): arm cast, push straight into a mill, then a switch shield cast that hands
  // the club to the other hand; repeat with the new lead side.
  'club:three-club mini flow':()=>flowTL([[armCast(),0],[mill(),1],[switchShield(),2]],['Arm cast','Mill','Switch shield cast'])
};
const FLOW_TL2={
  // Club Foundations (Chris): one rep of each move on the same lead side, then the H2H clean switches the lead
  // and the whole sequence is mirrored. Built from a right lead (right hand on top, club on the right).
  'club:club foundations':()=>{
    const one=ssFlowRep(false);                                // one side swing rep
    const tp=mirrorKF(torchPressTwo()).slice(0,6);            // one torch press
    return flowTL([[one,0],[mirrorKF(twoArmCast()),1],[topSwap(shieldCast()),2],[tp,3],[lockSwing(h2hClean(),'B'),4]],
      ['Two-hand side swing','Two-hand arm cast','Two-hand shield cast','Two-hand torch press','H2H clean']);}
};
// one side swing rep for a flow, from order: lower the club in front, cast, low, up to the top, then to order
function ssFlowRep(one){
  const ss=lockSwing(sideSwingKF(one),one?'R':'B');
  const order=one?Object.assign({},C_ONE):Object.assign({},STAND,CB2,{gL:0,gR:7,G:[-7,124,22],D:[0,1,0],eL:[1,-1,-0.25],eR:[-1,-1,-0.25]});
  const dip=one?{G:[-12,108,32],D:norm([0,-0.25,1]),eR:[-1,-0.5,0],freeL:[21,87,3],pass:true}:{G:[-3,110,34],D:norm([0,-0.25,1]),eL:[1,-0.5,0],eR:[-1,-0.5,0],pass:true};
  const k=[[0,order],[0.25,{}],[0.6,dip],[0.95,Object.assign({},ss[0][1],{pass:true})]].concat(ss.slice(2,9).map(([t,p])=>[t+0.65,p]));
  const fin=one?Object.assign({},UPRIGHT,C_ORDER1,{pass:true}):Object.assign({},UPRIGHT,{G:[-7,124,22],D:[0,1,0],eL:[1,-1,-0.25],eR:[-1,-1,-0.25],pass:true});
  return k.concat([[2.95,fin],[3.15,{}]]);
}
Object.assign(FLOW_TL2,{
  // Single-Arm Foundations (Chris): the one-hand version of Club Foundations, one rep of each on the lead
  // (working) hand, then a switch 180 hands the club over and it is mirrored.
  'club:single-arm foundations':()=>flowTL([[ssFlowRep(true),0],[armCast(),1],[oneArmShield(),2],[torchPress(),3],[lockSwing(switch180(),'R'),4]],
    ['Single-arm side swing','Arm cast','One-arm shield cast','Torch press','Switch 180']),
  // Rotational Torch Press to Half Reverse Mill (Chris): lead side rotational torch press, half reverse mill,
  // then a switch 180 hands the club over; mirrored.
  // Lunge Cast & Flag (Chris): reverse lunge arm cast, forward lunge flag press, then a switch shield cast hands
  // the club over; mirrored. One hand.
  'club:lunge cast & flag':()=>flowTL([[lungeArmCast(false),0],[lungeFlagPress(false),1],[switchShield(),2]],
    ['Reverse lunge arm cast','Forward lunge flag press','Switch shield cast']),
  // Two-Hand Lunge Cast & Flag (Chris): the beginner, two-hand version; the H2H clean is the switch. Built
  // from a right lead (right hand on top, right leg steps).
  'club:two-hand lunge cast & flag':()=>flowTL([[mirrorKF(lungeArmCast(true)),0],[mirrorKF(lungeFlagPress(true)),1],[lockSwing(h2hClean(),'B'),2]],
    ['Two-hand reverse lunge arm cast','Two-hand forward lunge flag press','H2H clean']),
  'club:rotational torch press to half reverse mill':()=>flowTL([[rotTorchPress(),0],[halfRevMillFront(),1],[lockSwing(switch180(),'R'),2]],
    ['Rotational torch press','Half reverse mill','Switch 180'])
});
Object.assign(FLOW_TL,FLOW_TL2);

/* ---------- flowing kettlebell flows (Chris) ----------
   Parts are [kf, step, side]; side 'R' or 'L' labels the working hand, null for two-hand flows with no
   lead side. Each part starts where the one before it ended. */
function flowTLs(parts,stepNames){
  const c=flowChain(parts.map(([kf,st])=>[kf,st]));
  c.kf.push([c.end+0.3,{}]);
  const tl=join([{kf:c.kf}]);
  const side={R:' (right hand)',L:' (left hand)'},swap={R:' (right hand to left)',L:' (left hand to right)'};
  tl.marks=c.marks.map((m,i)=>{const sd=parts[i][2],nm=stepNames[m.step];return {t:m.t*TEMPO,step:m.step,side:sd==='R'?'Right hand':sd==='L'?'Left hand':'',
    label:nm+((/switch/i.test(nm)?swap:side)[sd]||'')}});
  return tl;
}
// one-hand flows: the right-hand parts, then the same mirrored for the left. The intro (bell from the floor
// to the hike) leads into the first part and the outro (park it again) follows the last.
function kbSidedFlow(parts,names,intro,outro){
  const R=parts.map(([kf,st])=>[kf,st,'R']),L=parts.map(([kf,st])=>[mirrorKF(kf),st,'L']);
  const all=R.concat(L);
  if(intro){const k=all[0][0],d=endOf(intro);all[0]=[intro.concat(k.slice(1).map(([t,p])=>[t+d,p])),all[0][1],'R']}
  if(outro){const last=all[all.length-1],k=trimHold(last[0]),e=endOf(k);all[all.length-1]=[k.concat(outro.map(([t,p])=>[t+e,p])),last[1],'L']}
  return flowTLs(all,names);
}
// floor to hike, and hike back to the floor (bell parked 12-18 inches ahead)
const KB_INTRO=()=>[[0,standFree(FLOOR_AHEAD)],[0.35,{}],[1.1,reachFree(FLOOR_AHEAD)],[1.35,setOne(FLOOR_AHEAD)],[1.55,{}],[2.0,HIKE_R]];
const KB_OUTRO=()=>[[0.45,setOne(FLOOR_AHEAD)],[0.65,{}],[0.85,reachFree(FLOOR_AHEAD)],[1.6,standFree(FLOOR_AHEAD)],[1.85,{}]];
// pieces, all for the right hand
const kfSwing1=()=>[[0,HIKE_R],[0.27,SWPASS_R],[0.55,SWTOP_R],[0.82,SWPASS_R],[1.1,HIKE_R]];
const kfClean1=()=>[[0,HIKE_R]].concat(cleanUp(0));
const KB_FIST={freeL:add(shoulderOf(UP_KB,'L'),[54,-2,4]),eL:[0,-1,0]};
const kfPress1=()=>[[0,Object.assign({},RACK_R,KB_FIST)]].concat(pressRep(0.3,KB_FIST));
const kfFrontSquat1=()=>{const arm=Object.assign({},RACK_R,{freeL:add(shoulderOf(UP_KB,'L'),[54,-1,4]),eL:[0,-1,0]});
  const top=Object.assign({},arm,{feet:KFEET,turn:4,kneeOut:0.45,roll:3});
  const bottom=carry(Object.assign({},UP_KB,{P:[1,48,-12],pitch:8,roll:5,feet:KFEET,turn:4,kneeOut:0.6}),arm);
  return [[0,top],[0.95,bottom],[1.2,{}],[2.0,Object.assign({},top)]]};
// hand-to-hand swing switch: up with the right hand, change hands at the top, down with the left
const kfSwitchUp=t=>[[t+0.27,SWPASS_R],[t+0.55,SWTOP_R],[t+0.7,SWITCH_TOP],[t+0.98,mirror(SWPASS_R)],[t+1.25,mirror(HIKE_R)]];
// from the rack: drop into the swing, then the switch
const kfRackSwitch=()=>[[0,Object.assign({},RACK_R)],[0.3,PINNED_R],[0.6,HIKE_R]].concat(kfSwitchUp(0.6));
// from overhead: drop straight into the swing (as after a snatch), then the switch
const kfOverheadSwitch=()=>[[0,Object.assign({},LOCK_R)],[0.3,SN_OVER],[0.57,SWPASS_R],[0.85,HIKE_R]].concat(kfSwitchUp(0.85));
// from overhead: press back down to the rack, drop into the swing, then the switch
const kfPressDownSwitch=()=>[[0,Object.assign({},LOCK_R)],[0.45,Object.assign({},PRESS_MID_R)],[0.9,Object.assign({},RACK_R)],[1.15,{}],[1.45,PINNED_R],[1.75,HIKE_R]].concat(kfSwitchUp(1.75));
const kfSnatch1=()=>[[0,HIKE_R],[0.27,SWPASS_R],[0.48,SN_PULL],[0.7,Object.assign({},LOCK_R)]];
const kfCleanPress1=()=>kfClean1().concat([[1.35,Object.assign({},PRESS_MID_R)],[1.8,Object.assign({},LOCK_R)]]);
const kfOverheadHold=()=>[[0,Object.assign({},LOCK_R)],[1.0,Object.assign({},LOCK_R,{G:add(LOCK_R.G,[0,0.5,0])})]];

/* Halo flow (Chris): from the horn hold, alternating halos that finish each circle down at the hip opposite
   the side the bell came round to the front, pause, and reverse; a goblet squat, a thruster that finishes
   with the bell lowered behind the head, a skull crusher and a pullover back to the chest. */
const HF_FEET={feet:{L:[18,8,0],R:[-18,8,0]},turn:6};
const hfBody=p=>Object.assign({},p,HF_FEET,{kneeOut:p.kneeOut===undefined||p.kneeOut<0.45?0.45:p.kneeOut});
const hfHalo=deg=>hfBody(Object.assign({},UP_KB,{hR:-8,hL:8,hD:5,offL:0,offR:0},haloAt(deg)));
// bell at the hip, side +1 = left hip, -1 = right; still upside down by the horns, the chest turned toward it
const hfHip=sd=>hfBody(Object.assign({},UP_KB,{yaw:sd*22,hR:-8,hL:8,hD:5,offL:0,offR:0,G:[sd*20,92,20],D:norm([sd*0.25,1,0.15]),W:norm([1,-sd*0.25,0]),
  eL:[0.6,-0.6,-0.4],eR:[-0.6,-0.6,-0.4]}));
function hfHaloTo(dir,from){             // one halo in a direction (+1: right hand past the left ear), ending at the hip
  const k=[[0,from]];
  if(from.yaw)k.push([0.45,Object.assign(hfHalo(0),{pass:true})]);
  const t0=endOf(k);
  for(let i=1;i<=8;i++)k.push([t0+0.26*i,Object.assign(hfHalo(dir*45*i),{pass:true})]);
  const e=endOf(k);k.push([e+0.5,hfHip(dir)],[e+0.85,Object.assign({},hfHip(dir))]);
  return k;
}
function hfGobletSquat(){
  const top=carry(Object.assign({},UP_KB,HF_FEET,{kneeOut:0.45}),GOBLET_HOLD);
  const bottom=carry(Object.assign({},UP_KB,HF_FEET,{P:[0,47,-12],pitch:8,kneeOut:0.6}),GOBLET_HOLD);
  return [[0,hfHip(-1)],[0.5,Object.assign(hfHalo(0),{pass:true})],[0.85,top],[1.05,{}],[2.0,bottom],[2.25,{}]];
}
function hfThruster(){
  const bottom=carry(Object.assign({},UP_KB,HF_FEET,{P:[0,47,-12],pitch:8,kneeOut:0.6}),GOBLET_HOLD);
  const rise=Object.assign(carry(Object.assign({},UP_KB,HF_FEET,{P:[0,80,-5],pitch:4,kneeOut:0.5}),Object.assign({},GOBLET_HOLD,{G:[0,146,22]})),{pass:true});
  return [[0,bottom],[0.4,rise],[0.75,hfBody(HORN_UP)],[1.0,{}],[1.55,hfBody(HORN_BEHIND)],[1.75,{}]];
}
const hfSkull=()=>[[0,hfBody(HORN_BEHIND)],[0.55,hfBody(HORN_UP)],[0.8,{}],[1.35,hfBody(HORN_BEHIND)],[1.55,{}]];
const hfPullover=()=>[[0,hfBody(HORN_BEHIND)],[0.45,hfBody(HORN_OVER)],[0.9,hfBody(hornCurlAt(145))],[1.3,hfHalo(0)],[1.6,{}]];

Object.assign(FLOW_TL,{
  // Swing–Clean–Press–Squat (Chris): one rep of each with the right hand, a hand-to-hand swing switch, then
  // the same with the left; the bell never touches down
  'kb:swing–clean–press–squat':()=>kbSidedFlow([[kfSwing1(),0],[kfClean1(),1],[kfPress1(),2],[kfFrontSquat1(),3],[kfRackSwitch(),4]],
    ['One-arm swing','Clean','Press','Front squat','Hand-to-hand swing switch'],KB_INTRO(),KB_OUTRO()),
  'kb:halo flow':()=>flowTLs([[[[0,hfHalo(0)],[0.5,{}]].concat(hfHaloTo(1,hfHalo(0)).slice(1).map(([t,p])=>[t+0.5,p])),0,null],
    [hfHaloTo(-1,hfHip(1)),0,null],[hfGobletSquat(),1,null],[hfThruster(),2,null],[hfSkull(),3,null],[hfPullover(),4,null]],
    ['Alternating halo','Goblet squat','Thruster','Skull crusher','Pullover']),
  // Snatch–Windmill Chain (Chris): one rep of each into the next, a hand-to-hand swing switch, then the left
  'kb:snatch–windmill chain':()=>kbSidedFlow([[kfSnatch1(),0],[kfOverheadHold(),1],[windmillKF(1),2],[kfOverheadSwitch(),3]],
    ['Snatch','Overhead hold','Windmill','Hand-to-hand swing switch'],KB_INTRO(),KB_OUTRO()),
  // the easier chain: a clean and press gets the bell overhead instead of the snatch
  'kb:clean & press windmill chain':()=>kbSidedFlow([[kfCleanPress1(),0],[kfOverheadHold(),1],[windmillKF(1),2],[kfPressDownSwitch(),3]],
    ['Clean & press','Overhead hold','Windmill','Hand-to-hand swing switch'],KB_INTRO(),KB_OUTRO())
});
const flowTLFor=flow=>{const f=FLOW_TL[(flow.eq||'club')+':'+String(flow.name).toLowerCase()];return f?f():null};

window.Demos={
  has:(name,eq)=>!!key(name,eq),
  hasFlow:flow=>!!(flowTLFor(flow)||flowKeys(flow)),
  open(name,eq){const k=key(name,eq);if(!k)return false;const mv=MOVES[k];
    const vars=mv.alt?[{label:mv.label,tl:join([mv])},{label:MOVES[mv.alt].label,tl:join([MOVES[mv.alt]])}]:null;
    show(String(name).replace(/\s*[×x]\s*\d.*$/,''),'Move demo',join([mv]),null,vars);return true},
  openFlow(flow){const ft=flowTLFor(flow);if(ft){show(flow.name,'Flow demo',ft,ft.marks.map(m=>m.label));return true}
    const ks=flowKeys(flow);if(!ks)return false;
    show(flow.name,'Flow demo',join(ks.map(k=>MOVES[k[0]]),ks.map(k=>k[1])),ks.map(k=>k[1]));return true},
  // for previews and tests
  _Player:Player,_join:join,_flowTL:flowTLFor,_MOVES:MOVES,_key:key,_poseAt:poseAt,_skeleton:skeleton,_onBody:onBody,_STAND:STAND,_shaft:shaft,_norm:norm,_scene:scene,_CAM:CAM,_mirror:mirror,_mirrorKF:mirrorKF,_chain:chain,_torsoFrame:torsoFrame,_RACK_R:RACK_R,_LOCK_R:LOCK_R,_PRESS_MID_R:PRESS_MID_R,_UP_KB:UP_KB
};
})();
