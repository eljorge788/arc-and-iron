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
  eL:[1,-0.8,-0.3],eR:[-1,-0.8,-0.3],kneeOut:0.3};
// Pose fields: P pelvis, pitch (forward lean, deg), yaw (torso turn, + toward the figure's left),
// hipYaw, feet (ankle points), turn (toe-out), fyL/fyR (extra foot pivot), tL/tR (0..1 up on the toes),
// G (reference point on the shaft) and D (shaft direction, toward the head), gR/gL (where each hand
// sits along the shaft from G), choke (cm from the butt end to G), offL/offR (0..1 hand off the mace,
// moving to freeL/freeR), eL/eR and kneeOut (which way elbows and knees bend), len (implement length:
// MACE or CLUB; a club is drawn as a short handle that swells toward the end).

/* helpers for writing moves */
function torsoFrame(P,pitch,yaw,roll=0){
  let l=rotY([1,0,0],yaw);const f0=rotY([0,0,1],yaw),r=pitch*Math.PI/180;
  let u=add(mul([0,1,0],Math.cos(r)),mul(f0,Math.sin(r)));const f=sub(mul(f0,Math.cos(r)),mul([0,1,0],Math.sin(r)));
  if(roll){const q=roll*Math.PI/180,c=Math.cos(q),s=Math.sin(q);const u2=add(mul(u,c),mul(l,s));l=sub(mul(l,c),mul(u,s));u=u2}
  return {l,u,f,f0};
}
// a point fixed to the torso: lat toward the figure's left, h up the spine from the pelvis, fw forward
function onBody(pose,lat,h,fw){const F=torsoFrame(pose.P,pose.pitch||0,pose.yaw||0,pose.roll||0);
  return add(add(add(pose.P,mul(F.l,lat)),mul(F.u,h)),mul(F.f,fw))}
// upright hold placed on the body (belly button) for whatever the hips and torso are doing
const hold=pose=>Object.assign({G:onBody(pose,0,10,22),D:[0,1,0],eL:STAND.eL,eR:STAND.eR},pose);
// mirror a pose left <-> right; grip:true also swaps which hand is on top
function mirror(p,grip=true){
  const o=Object.assign({},p),sw=(a,b,f)=>{if(a in p||b in p){const A=p[a],B=p[b];if(B!==undefined)o[a]=f(B);else delete o[a];if(A!==undefined)o[b]=f(A);else delete o[b]}};
  const id=v=>v,neg=v=>-v;
  for(const k of ['P','G','D'])if(p[k])o[k]=mx(p[k]);
  if('yaw' in p)o.yaw=-p.yaw;if('hipYaw' in p)o.hipYaw=-p.hipYaw;if('roll' in p)o.roll=-p.roll;
  if(p.feet)o.feet={L:mx(p.feet.R),R:mx(p.feet.L)};
  sw('eL','eR',mx);sw('freeL','freeR',mx);if(grip){sw('gL','gR',id);sw('offL','offR',id)}sw('tL','tR',id);sw('fyL','fyR',neg);
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
const shaft=(G,tip)=>norm(sub(tip,G));
// in-between keyframes that move the mace by its head (the working hand), not by its base, so a hand
// sliding along the shaft follows a sensible path. a and b must be full poses.
function viaHead(a,b,n,dt){
  const headOf=p=>add(p.G,mul(p.D,Math.max(p.gL,p.gR)));
  const ha=headOf(a),hb=headOf(b),out=[];
  for(let i=1;i<n;i++){const u=i/n,o={};
    for(const k of ['pitch','yaw','roll','hipYaw','turn','kneeOut','gL','gR','choke','tL','tR','fyL','fyR'])if(k in a&&k in b)o[k]=lerp(a[k],b[k],u);
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

function reverseLunge(side){            // side = the leg that steps back
  const feet=side==='L'?{L:[12,15,-88],R:[-12,8,6]}:{L:[12,8,6],R:[-12,15,-88]};
  const bottom={P:[0,54,-36],pitch:5,feet,G:[0,64,-15],tL:side==='L'?1:0,tR:side==='R'?1:0};
  return [[0,STAND],[0.8,bottom],[1.1,{}],[1.9,STAND],[2.2,{}]];
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
  return [[0,STAND],[0.6,wideHold],[0.8,{}],[1.6,punchR],[1.85,{}]]
    .concat(leg(pR,ctr,1.85,0.6),[[2.45,center]],leg(ctr,pL,2.45,0.6),[[3.05,punchL],[3.3,{}]])
    .concat(leg(pL,ctr,3.3,0.6),[[3.9,center]],leg(ctr,pR,3.9,0.6),[[4.5,punchR],[4.75,{}]])
    .concat([[5.4,wideHold],[5.6,{}],[6.1,Object.assign({},STAND)],[6.3,{}]]);
}
function frontLunge(){
  // left foot steps forward; front shin near vertical; then the right
  const bottom=hold({P:[0,54,26],pitch:4,yaw:0,feet:{L:[12,8,72],R:[-12,15,-18]},tR:1});
  const L=[[0,STAND],[0.8,bottom],[1.1,{}],[1.9,Object.assign({},STAND,{tR:0})]];
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
  return [[0,STAND],[0.4,set],[0.8,sh],[1.0,{}],[1.8,bottom('L')],[2.1,{}],[2.9,up],[3.1,{}],[3.9,bottom('R')],[4.2,{}],[5.0,up],
    [5.2,{}],[5.55,set],[5.9,{G:STAND.G,D:STAND.D,eL:STAND.eL,eR:STAND.eR}],[6.1,{}]];
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
const C_ORDER2={G:[0,124,22],D:[0,1,0],eL:[1,-1,-0.25],eR:[-1,-1,-0.25]};      // order: hands at the sternum, elbows by the ribs
const C_ORDER1={G:[-16,118,22],D:[0,1,0],eR:[-0.8,-1,-0.1]};                   // order position, right shoulder
const C_TWO=Object.assign({},STAND,CB2,C_ORDER2),C_ONE=Object.assign({},STAND,CB1,C_ORDER1);
const HINGE={P:[0,88,-3],pitch:16,feet:{L:[23,8,0],R:[-23,8,0]},turn:14,kneeOut:0.6};
const UPRIGHT={P:STAND.P,pitch:0,yaw:0,hipYaw:0,feet:STAND.feet,turn:STAND.turn,kneeOut:STAND.kneeOut};

function sideRocker(){
  // Two hands, wide hinge, club hanging in front of the shins. Rock it side to side like a pendulum and
  // shift onto the leg it swings toward.
  const hang=Object.assign({},HINGE,{G:[0,86,27],D:[0,-1,0.06],eL:[1,-0.5,-0.4],eR:[-1,-0.5,-0.4]});
  const to=x=>({P:[x*6,88,-3],yaw:x*6,hipYaw:x*3,G:[x*7,87,27],D:norm([x*0.62,-0.78,0.06])});
  return [[0,C_TWO],[0.25,{}],[0.75,hang],[1.25,to(1)],[1.8,to(-1)],[2.35,to(1)],[2.9,to(-1)],[3.4,{P:HINGE.P,yaw:0,hipYaw:0,G:hang.G,D:hang.D}],
    [3.95,Object.assign({},UPRIGHT,C_ORDER2)],[4.2,{}]];
}
function lateralSwing(){
  // One hand (right), wide hinge. The club swings across the front from outside the right leg to outside
  // the left; the torso turns with it and the free arm moves the other way.
  const hang=Object.assign({},HINGE,{G:[-8,86,26],D:[0,-1,0.06],eR:[-1,-0.5,-0.4],freeL:[22,83,12]});
  const R={P:[-6,88,-3],yaw:-14,hipYaw:-6,G:[-13,90,22],D:norm([-0.8,-0.58,0.1]),freeL:[17,88,27]};
  const L={P:[6,88,-3],yaw:16,hipYaw:7,G:[7,89,25],D:norm([0.82,-0.55,0.1]),freeL:[27,88,-10]};
  return [[0,C_ONE],[0.25,{}],[0.75,hang],[1.25,R],[1.8,L],[2.35,R],[2.9,L],[3.4,{P:HINGE.P,yaw:0,hipYaw:0,G:hang.G,D:hang.D,freeL:hang.freeL}],
    [3.95,Object.assign({},UPRIGHT,C_ORDER1,{freeL:CB1.freeL})],[4.2,{}]];
}
function armCast(two){
  // From the order position the club tips back and drops behind the shoulder to hang down the back, the
  // elbow pointing up beside the head. It circles out around the outside, the arm casts it to the front,
  // and it returns to vertical in front of the shoulder. The body stays still.
  const x=two?-13:-15,base=two?C_TWO:C_ONE,order=two?C_ORDER2:C_ORDER1;
  const el2=two?{eL:[0.5,1,0.2],eR:[-0.4,1,0.2]}:{eR:[-0.3,0.4,1]};
  const tip={G:[x,146,14],D:norm([-0.1,0.25,-1]),pass:true};
  const behind=Object.assign({G:[x,two?163:158,-2],D:norm([-0.08,-0.9,-0.42])},el2);
  const out=Object.assign({G:[x-2,two?164:160,8],D:norm([-0.95,-0.15,-0.25]),pass:true},el2);
  const cast={G:[x,140,38],D:norm([-0.05,0.55,0.83]),eL:[1,-0.6,0],eR:[-1,-0.6,0]};
  return [[0,base],[0.25,{}],[0.6,tip],[0.95,behind],[1.15,{}],[1.45,out],[1.8,cast],[2.25,Object.assign({},order)],[2.45,{}]];
}
function swipe(){
  // Two hands. Club resting back on the right shoulder; hinge and sweep it down and across the front in a
  // big low arc, the hips and knees driving it, out past the left knee; then back the same way and up to
  // the shoulder as you stand.
  const rest={G:[-8,122,20],D:norm([-0.3,0.62,-0.72]),eL:[0.8,-1,0.3],eR:[-1,-1,0]};
  const low={P:[0,84,-4],pitch:30,feet:{L:[25,8,0],R:[-25,8,0]},turn:14,kneeOut:0.6};
  const lowR=Object.assign({},low,{yaw:-16,hipYaw:-8,G:[-8,86,30],D:norm([-0.62,-0.68,0.38]),eL:[1,-0.4,-0.3],eR:[-1,-0.4,-0.3],pass:true});
  const mid={P:[0,82,-4],yaw:0,hipYaw:0,G:[0,80,36],D:norm([0,-0.5,0.87]),pass:true};
  const lowL={P:[4,84,-4],yaw:18,hipYaw:9,G:[8,85,31],D:norm([0.8,-0.5,0.32])};
  return [[0,C_TWO],[0.25,{}],[0.7,rest],[0.85,{}],[1.25,lowR],[1.55,mid],[1.9,lowL],[2.05,{}],
    [2.4,Object.assign({},mid)],[2.7,Object.assign({},lowR,{pass:true})],[3.15,Object.assign({},UPRIGHT,rest)],[3.3,{}],
    [3.7,Object.assign({},C_ORDER2)],[3.9,{}]];
}
function shieldCast(){
  // Two hands, club upright in front of the chest and close to the body like a shield. Hands rise beside
  // the right side of the head and the club drops behind that shoulder to hang down the back; the head of
  // the club circles round behind and comes back out over the same shoulder to the front.
  const shield={G:[-4,122,18],D:norm([0.28,0.96,0]),eL:[1,-1,0.1],eR:[-1,-1,0.1]};
  const behind={G:[-13,163,-2],D:norm([0.12,-0.9,-0.42]),eL:[0.5,1,0.2],eR:[-0.4,1,0.2]};
  const round={G:[-15,164,5],D:norm([-0.9,-0.2,-0.35]),pass:true};
  const over={G:[-10,152,16],D:norm([-0.45,0.6,0.66]),eL:[1,-0.6,0.2],eR:[-1,-0.6,0.2],pass:true};
  return [[0,C_TWO],[0.25,{}],[0.6,shield],[1.0,behind],[1.2,{}],[1.55,round],[1.85,over],[2.25,Object.assign({},C_ORDER2)],[2.45,{}]];
}
function torchPress(){
  // One hand. Club upright like a torch at the shoulder; press straight up and lower, club vertical.
  const rack={G:[-17,128,12],D:[0,1,0],eR:[-0.5,-1,0.3]};
  const top={G:[-17,195,3],D:[0,1,0],eR:[-1,-0.2,0.2]};
  return [[0,C_ONE],[0.4,rack],[0.6,{}],[1.2,top],[1.45,{}],[2.05,rack],[2.25,{}],[2.65,Object.assign({},C_ORDER1)],[2.8,{}]];
}

const WIDE={L:[16,8,0],R:[-16,8,0]};
const atOrder=pose=>Object.assign({G:onBody(pose,0,30,22),D:[0,1,0],eL:C_ORDER2.eL,eR:C_ORDER2.eR},pose);
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

function twoArmCast(){
  // From order the club tips back over the head and relaxes; elbows rise beside the ears, hands behind the
  // head, club hanging down the back. Then the lats pull it back to order, elbows leading.
  return [[0,C_TWO],[0.25,{}],[0.65,TIPBACK2],[1.0,BEHIND2],[1.3,{}],[1.65,PULL2],[2.0,Object.assign({},C_ORDER2)],[2.25,{}]];
}
function oneArmShield(){
  // One hand, club up by the shoulder, free hand down. The club casts over the shoulder, circles round
  // behind the back and comes back out to the front.
  const up={G:[-15,132,16],D:[0,1,0],eR:[-0.8,-1,0]};
  const over={G:[-14,156,4],D:norm([0.1,0.2,-1]),eR:[-0.3,0.6,1],pass:true};
  const behind={G:[-14,160,-2],D:norm([0.15,-0.9,-0.4]),eR:[-0.3,0.6,1]};
  const round={G:[-16,160,6],D:norm([-0.92,-0.2,-0.3]),pass:true};
  const front={G:[-15,146,26],D:norm([-0.3,0.65,0.7]),eR:[-1,-0.6,0.2],pass:true};
  return [[0,C_ONE],[0.4,up],[0.55,{}],[0.9,over],[1.2,behind],[1.35,{}],[1.7,round],[2.0,front],[2.4,Object.assign({},up)],[2.6,{}],
    [3.0,Object.assign({},C_ORDER1)],[3.2,{}]];
}
function cleanKF(){
  // Hinge and let the club drop between the legs, then drive the hips so it floats up; tighten to stop in order.
  const drop={G:[0,100,32],D:norm([0,-0.55,0.84]),eL:[1,-0.6,-0.3],eR:[-1,-0.6,-0.3],pass:true};
  const back={P:[0,84,-8],pitch:38,feet:WIDE,turn:15,kneeOut:0.6,G:[0,76,10],D:norm([0,-0.6,-0.8])};
  const fwd={P:STAND.P,pitch:0,feet:WIDE,G:[0,108,34],D:norm([0,0.45,0.9]),pass:true};
  return [[0.5,drop],[0.95,back],[1.1,{}],[1.5,fwd],[1.85,atOrder(TALL)],[2.05,{}]];
}
function twoClean(){return [[0,C_TWO],[0.25,{}]].concat(cleanKF()).concat([[2.45,Object.assign({},UPRIGHT,C_ORDER2)],[2.6,{}]])}
function two180(){
  // From upright on the right with the body turned that way, the club swings down in a U past the front
  // and the feet and hips pivot to finish upright on the left. Then back again.
  const R=sideOrder(-1),L=sideOrder(1);
  const lowR={yaw:-20,hipYaw:-12,tL:0.2,fyL:-20,G:[-10,104,26],D:norm([-0.85,-0.45,0.25]),pass:true};
  const bottom={P:[0,90,-3],pitch:12,yaw:0,hipYaw:0,tL:0,tR:0,fyL:0,fyR:0,G:[0,92,28],D:norm([0,-1,0.08]),eL:[1,-0.5,-0.3],eR:[-1,-0.5,-0.3],pass:true};
  const lowL=Object.assign({},mirror(lowR,false),{pass:true});
  const there=[[0.45,lowR],[0.75,bottom],[1.05,lowL],[1.45,L],[1.65,{}]];
  const back=[[2.1,Object.assign({},mirror(lowR,false),{pass:true})],[2.4,bottom],[2.7,Object.assign({},lowR,{pass:true})],[3.1,R],[3.3,{}]];
  return [[0,C_TWO],[0.25,{}],[0.6,R],[0.75,{}]].map(([t,p])=>[t,p]).concat(there.map(([t,p])=>[t+0.75,p]),back.map(([t,p])=>[t+0.75,p]),
    [[4.5,Object.assign({},TALL,C_ORDER2)],[4.7,{}]]);
}
function gamma(){
  // Starts like the arm cast, but the torso turns so the club travels round the head: over the right
  // shoulder, behind the head, out over the left shoulder and back to order. both() changes sides.
  const overR={yaw:-14,G:[-12,150,10],D:norm([-0.45,0.3,-0.84]),eL:[1,0,0.3],eR:[-1,0,0.3],pass:true};
  const behind=Object.assign({},BEHIND2,{yaw:0,G:[0,166,-12]});
  const overL={yaw:14,G:[12,154,12],D:norm([0.5,0.55,0.67]),eL:[1,-0.3,0.4],eR:[-1,-0.3,0.4],pass:true};
  return [[0,C_TWO],[0.25,{}],[0.65,overR],[0.95,behind],[1.1,{}],[1.45,overL],[1.85,Object.assign({yaw:0},C_ORDER2)],[2.05,{}]];
}
function twoMill(){
  // The 180's low swing joined to a cast overhead: swing low across, up the left side and behind the head,
  // cast out to the right at arm's length, swing back down. Feet pivot throughout. both() reverses.
  const R=sideOrder(-1),L=sideOrder(1);
  const bottom={P:[0,90,-3],pitch:12,yaw:0,hipYaw:0,tL:0,tR:0,fyL:0,fyR:0,G:[0,92,28],D:norm([0,-1,0.08]),eL:[1,-0.5,-0.3],eR:[-1,-0.5,-0.3],pass:true};
  const upL={P:STAND.P,pitch:0,yaw:26,hipYaw:16,tR:0.4,fyR:28,G:[14,128,18],D:norm([0.75,0.66,0]),eL:[1,-0.6,-0.2],eR:[-1,-0.6,-0.2],pass:true};
  const behind={yaw:8,hipYaw:4,tR:0.1,fyR:8,G:[4,166,-10],D:norm([0.15,-0.92,-0.36]),eL:[1,0.9,0.15],eR:[-1,0.9,0.15]};
  const castR={yaw:-24,hipYaw:-14,tR:0,fyR:0,tL:0.4,fyL:-26,G:[-36,142,18],D:norm([-0.85,0.5,0.12]),eL:[0.4,-1,0.3],eR:[0,-1,0.3],pass:true};
  return [[0,C_TWO],[0.25,{}],[0.6,R],[0.75,{}],[1.15,Object.assign({},bottom)],[1.55,upL],[1.9,behind],[2.05,{}],[2.4,castR],
    [2.8,Object.assign({},bottom)],[3.2,Object.assign({},L,{pass:false})],[3.4,{}]];
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
  // From side order, arm cast with the elbow tucked to the ear, then drive the club forward and up, angled
  // out like a flag. both() does the other side.
  const side={G:[-12,124,20],D:[0,1,0],eL:[1,-1,-0.2],eR:[-1,-1,-0.2]};
  const tip={G:[-12,148,12],D:norm([-0.1,0.3,-0.95]),eL:[1,0,0.3],eR:[-0.6,0.2,0.7],pass:true};
  const behind={G:[-10,164,-8],D:norm([-0.05,-0.93,-0.36]),eL:[1,0.9,0.15],eR:[-0.6,1,0.1]};
  const flag={G:[-10,176,34],D:norm([-0.3,0.72,0.62]),eL:[1,-0.4,0],eR:[-1,-0.4,0]};
  return [[0,C_TWO],[0.35,side],[0.5,{}],[0.85,tip],[1.2,behind],[1.4,{}],[1.85,flag],[2.15,{}],[2.6,Object.assign({},side)],[2.75,{}],
    [3.1,Object.assign({},C_ORDER2)],[3.3,{}]];
}
function cleanPress(){
  // Clean to order, then drive the club forward and up to straight arms, still upright; lower to order.
  const top={G:[0,191,12],D:[0,1,0],eL:[1,-0.2,0],eR:[-1,-0.2,0]};
  return [[0,C_TWO],[0.25,{}]].concat(cleanKF()).concat([[2.65,top],[2.9,{}],[3.55,atOrder(TALL)],[3.75,{}],
    [4.1,Object.assign({},UPRIGHT,C_ORDER2)],[4.3,{}]]);
}
function clubBarbarian(){
  // Lock the arms out with the club upright in front and squat. As you stand, arm cast; pull it back
  // through with the lats and elbows, lock out and go straight into the next squat.
  const lock=pose=>Object.assign({G:onBody(pose,0,42,50),D:[0,1,0],eL:[1,-0.4,0],eR:[-1,-0.4,0]},pose);
  const behind=Object.assign({},BEHIND2,TALL);
  return [[0,C_TWO],[0.25,{}],[0.6,lock(TALL)],[0.75,{}],[1.45,lock(SQUAT)],[1.65,{}],
    [2.05,Object.assign({},TIPBACK2,{P:[0,80,-8],pitch:8,feet:WIDE,turn:15})],[2.45,behind],[2.6,{}],[2.95,PULL2],
    [3.3,lock(TALL)],[3.4,{}],[4.1,lock(SQUAT)],[4.3,{}],[5.0,lock(TALL)],[5.15,{}],[5.5,Object.assign({},UPRIGHT,C_ORDER2)],[5.7,{}]];
}
function orderSquat(){
  return [[0,C_TWO],[0.3,atOrder(TALL)],[0.45,{}],[1.25,atOrder(SQUAT)],[1.5,{}],[2.3,atOrder(TALL)],[2.45,{}],
    [2.8,Object.assign({},UPRIGHT,C_ORDER2)],[3.0,{}]];
}

const MOVES={
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
  'club:lateral swing':{kf:both(lateralSwing()),
    cue:'Same hinged stance, one hand. Swing the club across the front from outside one leg to outside the other; let your torso turn with it and your free arm move the other way. Both hands.'},
  'club:arm cast':{kf:both(armCast(false)),
    cue:'One hand, standing tall, club upright at the shoulder. Let it drop behind the shoulder to hang down your back, circle it round, and cast it back up to vertical in front. The arm and shoulder move; the body stays still. Both arms.'},
  'club:two-hand arm cast':{kf:twoArmCast(),
    cue:'Start in order, feet planted, knees soft. Let the club tip back over your head and relax: elbows beside your ears, hands behind your head, club hanging down your back. Pull it back to order with your lats, elbows leading, not the wrists.'},
  'club:one-arm shield cast':{kf:both(oneArmShield()),
    cue:'One hand, club up by the shoulder, the other hand free. Cast it over the shoulder, circle it behind you and bring it back to the front. Both arms.'},
  'club:two-hand clean':{kf:twoClean(),
    cue:'Hinge and let the club drop between your legs, then drive with your hips to float it up. Tighten to stop it in order, hands at the sternum. Power from the hips, not the arms.'},
  'club:two-hand 180':{kf:two180(),
    cue:'Club upright on one side, body turned that way. Swing it down in a U past the front, pivot your feet and hips, and finish upright on the other side. Then back.'},
  'club:gamma cast':{kf:both(gamma()),
    cue:'Start like the arm cast, but turn the torso so the club travels round your head: over one shoulder, behind the head, out over the other and back to order. Change sides each rep.'},
  'club:two-hand mill':{kf:both(twoMill()),
    cue:'Swing the club low across your body, up one side and behind your head, then cast it out to the other side at arm’s length and swing back down. Feet pivot throughout. Both directions.'},
  'club:swing squat':{kf:swingSquat(),
    cue:'From order, cast forward into a swing with your arms locked out. Catch the club back in order as you sit into a squat, then stand.'},
  'club:arm cast to flag press':{kf:both(castFlag()),
    cue:'From side order, arm cast with the elbow tucked to your ear, then drive the club forward and up, angled out like a flag. Both sides.'},
  'club:clean to torch press':{kf:cleanPress(),
    cue:'Clean the club to order, then drive it forward and up to straight arms, still upright. Lower to order under control.'},
  'club:barbarian squat':{kf:clubBarbarian(),
    cue:'Arms locked out, club upright, squat. As you stand, arm cast; pull it back through with your lats and elbows, lock out and go straight into the next squat.'},
  'club:order squat':{kf:orderSquat(),
    cue:'Club upright in order, hands at the sternum, elbows by the ribs. Sit tall into the squat and stand.'},
  'club:swipe':{kf:both(swipe()),
    cue:'Club resting back on the shoulder. Hinge and sweep it down and across the front in a big low arc, like swiping a table clear, driving with the hips and knees. Stand and bring it back to the shoulder. Both sides.'},
  'club:shield cast':{kf:both(shieldCast()),
    cue:'Both hands, club upright and close in front of the chest. Drop it behind one shoulder, circle it round behind and bring it back out over the same shoulder. Alternate sides.'},
  'club:torch press':{kf:both(torchPress()),
    cue:'Club upright like a torch at the shoulder. Press it straight up, keeping it vertical, and lower under control. Both arms.'}
});
MOVES['mace:360']={kf:both(threeSixty()),cue:'One 360 each way. Elbows vertical and tight to the head: press just off one side, pull over, circle behind the back, finish in a press just off the other side.'};
MOVES['mace:gravedigger']={kf:both(gravedigger()),cue:'Shovel grip. Dig the head down and across to the floor by the opposite foot, pivoting the back foot. Both sides.'};
MOVES['mace:reverse lunge']={kf:join([MOVES['mace:reverse lunge:left'],MOVES['mace:reverse lunge:right']]).kf.map(([t,p])=>[t/TEMPO,p]),
  cue:'Alternate legs. Front shin stays near vertical; the mace stays in the upright hold.'};

/* ---------- names ---------- */
const ALIAS={mace:{'hand switch':'hand switches','rotational uppercut':'uppercut','overhead press':'offset press',
  'squat':'front squat','bent-over row':'offset bent-over row','offset row':'offset bent-over row','pendulum swings':'pendulum swing'},
  club:{'two-hand side swing':'side rocker','two-hand side swings':'side rocker','side rock-it':'side rocker','side rocket':'side rocker',
    'swing':'lateral swing','swings':'lateral swing','one-arm arm cast':'arm cast','two-hand swipe':'swipe','swipes':'swipe',
    'two-hand shield cast':'shield cast','shield cast, one arm':'one-arm shield cast',
    'clean':'two-hand clean','two-handed clean':'two-hand clean','180':'two-hand 180','two-handed 180':'two-hand 180',
    'two-handed mill':'two-hand mill','two-handed swing squat':'swing squat','two-hand swing squat':'swing squat',
    'two-hand arm cast to flag press':'arm cast to flag press','two-handed arm cast to flag press':'arm cast to flag press',
    'two-hand clean to torch press':'clean to torch press','two-handed clean to torch press':'clean to torch press',
    'club barbarian squat':'barbarian squat','order-position squat':'order squat','two-handed arm cast':'two-hand arm cast'}};
function key(name,eq){
  let n=String(name).toLowerCase().replace(/\s*[×x]\s*\d.*$/,'').replace(/\(.*?\)/g,'').trim();
  let side='';
  const sh=n.match(/\s*\bover the (left|right) shoulder\b/);
  if(sh){side=sh[1]==='right'?'left':'right';n=n.replace(sh[0],'')} // over the right shoulder first = left hand on top
  else{const m=n.match(/,?\s*\b(left|right)\b.*$/);if(m){side=m[1];n=n.slice(0,m.index)}}
  n=n.replace(/,.*$/,'').replace(/^(mace|steel mace|club|steel club)\s+/,'').replace(/[–—]/g,'-').replace(/\s+/g,' ').trim();
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
    const o={feet:{L:vl(a.feet.L,b.feet.L,u),R:vl(a.feet.R,b.feet.R,u)},D:norm(vl(a.D,b.D,u))};
    for(const k of ['P','G','eL','eR','freeL','freeR'])o[k]=vl(a[k],b[k],u);
    for(const k of ['pitch','yaw','roll','hipYaw','turn','fyL','fyR','tL','tR','gR','gL','choke','offL','offR','kneeOut','len'])o[k]=lerp(a[k],b[k],u);
    return o;
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
  const {l,u,f,f0}=torsoFrame(p.P,p.pitch,p.yaw,p.roll),lh=rotY([1,0,0],p.hipYaw),fh=rotY([0,0,1],p.hipYaw);
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
  sk.hand={R:vl(add(p.G,mul(p.D,p.gR)),p.freeR,p.offR),L:vl(add(p.G,mul(p.D,p.gL)),p.freeL,p.offL)};
  for(const s of ['L','R']){const [elb,wr]=ik(sk.sh[s],sk.hand[s],UARM,FARM,norm(s==='L'?p.eL:p.eR));sk['elb'+s]=elb;sk['wr'+s]=wr}
  sk.len=p.len;sk.butt=sub(p.G,mul(p.D,p.choke));sk.tip=add(sk.butt,mul(p.D,p.len));
  sk.gripTop=add(sk.butt,mul(p.D,p.len<80?16:22));
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
  if(sk.len<80){
    // club: knob, handle, then a body that swells toward a rounded end
    const N=7,neck=sk.gripTop;
    seg(sk.butt,neck,4.5,'dm-grip'+hid(sk.butt,neck));
    const K=pr(sk.butt);items.push({z:dz(sk.butt),s:`<circle cx="${f1(K[0])}" cy="${f1(K[1])}" r="3.6" class="dm-ball${hid(sk.butt,sk.butt)}"/>`});
    for(let i=0;i<N;i++){const a=vl(neck,sk.tip,i/N),b=vl(neck,sk.tip,(i+1)/N),w=5+8*Math.sqrt((i+0.5)/N);
      seg(a,b,w,'dm-shaft'+hid(a,b))}
    const T=pr(sk.tip);items.push({z:dz(sk.tip),s:`<circle cx="${f1(T[0])}" cy="${f1(T[1])}" r="6.5" class="dm-ball${hid(sk.tip,sk.tip)||' dm-ring'}"/>`});
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
    const trail=[];for(let i=12;i>=1;i--){const tt=t-i*0.035;if(tt<0)continue;const q=poseAt(tl.kf,tt);trail.push(add(sub(q.G,mul(q.D,q.choke)),mul(q.D,q.len)))}
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
  _Player:Player,_join:join,_MOVES:MOVES,_key:key,_poseAt:poseAt,_skeleton:skeleton,_onBody:onBody,_STAND:STAND,_shaft:shaft,_norm:norm,_scene:scene,_CAM:CAM
};
})();
