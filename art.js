/* Arc & Iron artwork: original, hand-drawn SVG scenes of kettlebells, steel maces and steel clubs.
 * Every color comes from the page's theme tokens (--eq-kb, --eq-mace, --eq-club, --accent, --ink ...),
 * so the art recolors itself with each theme and with light/dark mode.
 * Two styles: "poster" (bold fills, soft gradients) and "engraved" (line art with hatching).
 * Scenes are 400 x 200. Art.scene(name, style) returns an SVG string.
 */
(function(){
  let uid=0;
  const P=n=>Math.round(n*100)/100;
  const rad=d=>d*Math.PI/180;
  // point at distance r from (cx,cy), angle in degrees clockwise from straight up
  const pol=(cx,cy,r,a)=>[P(cx+r*Math.sin(rad(a))),P(cy-r*Math.cos(rad(a)))];
  const arc=(cx,cy,r,a0,a1)=>{const[x0,y0]=pol(cx,cy,r,a0),[x1,y1]=pol(cx,cy,r,a1);const large=Math.abs(a1-a0)>180?1:0,sweep=a1>a0?1:0;return`M${x0} ${y0}A${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`};

  // ---- tools, drawn in local coordinates ----
  // kettlebell centered on its body, unit size ~ 30 wide
  const KB_HANDLE='M-11.5 -8V-23a11.5 11.5 0 0 1 23 0V-8';
  const KB_BODY='M-9 12A15 15 0 1 1 9 12Z';
  // mace: grip at origin, pointing up, head radius r
  const maceShaft=len=>`M0 0V${-len}`;
  // club: knob at origin, pointing up
  const clubPath=(len,w)=>`M-2.2 0L-2.6 ${P(-len*.42)}C-3.2 ${P(-len*.58)} ${-w} ${P(-len*.72)} ${-w} ${P(-len*.88)}A${w} ${w} 0 0 1 ${w} ${P(-len*.88)}C${w} ${P(-len*.72)} 3.2 ${P(-len*.58)} 2.6 ${P(-len*.42)}L2.2 0Z`;

  function kit(style,id){
    const poster=style!=='engraved';
    const g=n=>`url(#${id}-${n})`;
    const defs=`<defs>
      <linearGradient id="${id}-kb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:color-mix(in srgb,var(--eq-kb) 55%,#fff)"/><stop offset="1" style="stop-color:var(--eq-kb)"/></linearGradient>
      <linearGradient id="${id}-mace" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:color-mix(in srgb,var(--eq-mace) 50%,#fff)"/><stop offset="1" style="stop-color:var(--eq-mace)"/></linearGradient>
      <linearGradient id="${id}-club" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color:var(--eq-club)"/><stop offset=".45" style="stop-color:color-mix(in srgb,var(--eq-club) 45%,#fff)"/><stop offset="1" style="stop-color:var(--eq-club)"/></linearGradient>
      <linearGradient id="${id}-steel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color:color-mix(in srgb,var(--ink) 55%,var(--bg))"/><stop offset=".5" style="stop-color:color-mix(in srgb,var(--ink) 25%,var(--bg))"/><stop offset="1" style="stop-color:color-mix(in srgb,var(--ink) 60%,var(--bg))"/></linearGradient>
      <radialGradient id="${id}-glow" cx=".5" cy=".55" r=".6"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.22"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></radialGradient>
      <pattern id="${id}-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><line x1="0" y1="0" x2="0" y2="5" style="stroke:var(--ink)" stroke-width="1" opacity=".35"/></pattern>
    </defs>`;
    const ink='style="stroke:var(--ink)"';
    const K={
      defs,
      kb(x,y,s=1,rot=0,o=1){
        const t=`transform="translate(${P(x)} ${P(y)}) rotate(${rot}) scale(${s})" opacity="${o}"`;
        return poster
          ?`<g ${t}><path d="${KB_HANDLE}" fill="none" style="stroke:color-mix(in srgb,var(--eq-kb) 70%,var(--ink))" stroke-width="5.5" stroke-linecap="round"/><path d="${KB_BODY}" fill="${g('kb')}"/><path d="M-9.5 -2a10 10 0 0 1 6-8.5" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.4" stroke-linecap="round"/></g>`
          :`<g ${t} fill="none" ${ink} stroke-width="${P(2.2/s)}" stroke-linejoin="round" stroke-linecap="round"><path d="${KB_HANDLE}"/><path d="M-7 -12V-22a7 7 0 0 1 14 0V-12"/><path d="${KB_BODY}" fill="url(#${id}-hatch)"/><path d="${KB_BODY}"/><path d="M-9 -3a10 10 0 0 1 6-8"/></g>`;
      },
      mace(x,y,rot,len=90,r=13,o=1){
        const t=`transform="translate(${P(x)} ${P(y)}) rotate(${rot})" opacity="${o}"`;
        return poster
          ?`<g ${t}><path d="${maceShaft(len)}" style="stroke:color-mix(in srgb,var(--ink) 45%,var(--bg))" stroke-width="5" stroke-linecap="round"/><path d="M-1 -26V${-len+4}" style="stroke:var(--bg)" stroke-opacity=".5" stroke-width="1.4" stroke-linecap="round"/><path d="M0 -6V-24" style="stroke:color-mix(in srgb,var(--ink) 70%,var(--bg))" stroke-width="6.5" stroke-linecap="round" stroke-dasharray="1.6 1.4"/><circle cy="${-len-r*.55}" r="${r}" fill="${g('mace')}"/><circle cx="${-r*.35}" cy="${-len-r*.9}" r="${r*.3}" fill="#fff" fill-opacity=".45"/></g>`
          :`<g ${t} fill="none" ${ink} stroke-width="2.2" stroke-linecap="round"><path d="M-2.2 0V${-len}M2.2 0V${-len}"/><path d="M-3.2 -6H3.2M-3.2 -12H3.2M-3.2 -18H3.2M-3.2 -24H3.2" stroke-width="1.4"/><circle cy="${-len-r*.55}" r="${r}" fill="url(#${id}-hatch)"/><circle cy="${-len-r*.55}" r="${r}"/><path d="M${-r*.6} ${-len-r*.9}a${r*.7} ${r*.7} 0 0 1 ${r*.5} ${-r*.4}"/></g>`;
      },
      club(x,y,rot,len=110,w=11,o=1){
        const t=`transform="translate(${P(x)} ${P(y)}) rotate(${rot})" opacity="${o}"`;
        return poster
          ?`<g ${t}><path d="${clubPath(len,w)}" fill="${g('club')}"/><ellipse cy="1.5" rx="5" ry="3" style="fill:color-mix(in srgb,var(--eq-club) 70%,var(--ink))"/></g>`
          :`<g ${t} fill="none" ${ink} stroke-width="2.2" stroke-linejoin="round"><path d="${clubPath(len,w)}" fill="url(#${id}-hatch)"/><path d="${clubPath(len,w)}"/><ellipse cy="1.5" rx="5" ry="3"/><path d="M0 ${P(-len*.5)}V${P(-len*.95)}" stroke-width="1.2" opacity=".6"/></g>`;
      },
      // motion trail along an arc, in an equipment color
      trail(cx,cy,r,a0,a1,eq,w=3){
        return poster
          ?`<path d="${arc(cx,cy,r,a0,a1)}" fill="none" style="stroke:var(--eq-${eq})" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="2 9" opacity=".75"/>`
          :`<path d="${arc(cx,cy,r,a0,a1)}" fill="none" ${ink} stroke-width="1.4" stroke-dasharray="4 6" opacity=".7"/>`;
      },
      ring(cx,cy,r,o=.35){
        return poster
          ?`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" style="stroke:var(--accent)" stroke-width="10" opacity="${o*.45}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" style="stroke:var(--accent)" stroke-width="1.5" opacity="${o}"/>`
          :`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" ${ink} stroke-width="1.2" opacity=".35"/><circle cx="${cx}" cy="${cy}" r="${r-6}" fill="none" ${ink} stroke-width=".8" opacity=".25" stroke-dasharray="1 4"/>`;
      },
      glow(){return poster?`<rect width="400" height="200" fill="${g('glow')}"/>`:''},
      floor(y=182){
        return poster
          ?`<rect x="0" y="${y}" width="400" height="${200-y}" style="fill:var(--accent)" opacity=".1"/><line x1="20" y1="${y}" x2="380" y2="${y}" style="stroke:var(--accent)" stroke-width="1.5" opacity=".4"/>`
          :`<line x1="20" y1="${y}" x2="380" y2="${y}" ${ink} stroke-width="1.6" opacity=".5"/>${Array.from({length:18},(_,i)=>`<line x1="${30+i*20}" y1="${y+4}" x2="${22+i*20}" y2="${y+12}" ${ink} stroke-width="1" opacity=".25"/>`).join('')}`;
      },
      dust(n,seed){let s=seed||7;const r=()=>{s=(s*9301+49297)%233280;return s/233280};
        return Array.from({length:n},()=>`<circle cx="${P(20+r()*360)}" cy="${P(10+r()*150)}" r="${P(.8+r()*1.6)}" style="fill:var(--accent)" opacity="${P(.15+r()*.3)}"/>`).join('')}
    };
    return K;
  }

  // ---- scenes ----
  const SCENES={
    // the 360: mace circling around the grip, ghosts trace the path
    mace360(K){const px=200,py=176,L=96;
      return K.glow()+K.dust(14,3)+K.trail(px,py,L+14,-100,58,'mace',4)
        +[-92,-64,-36,-8].map((a,i)=>K.mace(px,py,a,L,12,.14+i*.1)).join('')+K.mace(px,py,24,L,13)+K.floor(186)},
    // two clubs crossed, mill circles around each head
    clubs(K){return K.glow()+K.dust(12,11)
        +`<ellipse cx="146" cy="58" rx="46" ry="24" fill="none" style="stroke:var(--eq-club)" stroke-width="2" stroke-dasharray="3 7" opacity=".7" transform="rotate(-24 146 58)"/>`
        +`<ellipse cx="254" cy="58" rx="46" ry="24" fill="none" style="stroke:var(--eq-club)" stroke-width="2" stroke-dasharray="3 7" opacity=".7" transform="rotate(24 254 58)"/>`
        +K.club(236,182,-28,140,13)+K.club(164,182,28,140,13)+K.floor(186)},
    // kettlebell swing: pendulum arc from the hike to chest height
    swing(K){const cx=196,cy=20,R=128,at=t=>pol(cx,cy,R,180+t);
      return K.glow()+K.dust(12,5)+`<path d="${arc(cx,cy,R,130,248)}" fill="none" style="stroke:var(--eq-kb)" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 9" opacity=".75"/>`
        +[-52,-28,-4,20].map((t,i)=>{const[x,y]=at(t);return K.kb(x,y,1.05,t,.16+i*.12)}).join('')
        +(()=>{const[x,y]=at(62);return K.kb(x,y,1.4,62)})()+K.floor(190)},
    // all three: bell in front, mace and club crossed behind, ring like the badge
    hybrid(K){return K.glow()+K.dust(16,9)+K.ring(200,104,84,.35)
        +K.club(272,190,-46,168,13)+K.mace(126,190,48,150,14)+K.kb(200,165,2.05)+K.floor(190)},
    // the rack: bells by size, a mace and a club leaning on the wall
    rack(K){return K.glow()+K.floor(176)
        +[[70,.75],[118,.9],[172,1.05],[232,1.25]].map(([x,s])=>K.kb(x,176-s*12,s)).join('')
        +K.mace(300,176,10,128,13)+K.club(344,176,-6,132,12)},
    // progress: bells climbing a staircase
    progress(K){const steps=[[60,160,.7],[130,138,.85],[200,116,1],[270,94,1.15],[340,72,1.3]];
      return K.glow()+K.dust(10,13)
        +steps.map(([x,y])=>`<rect x="${x-30}" y="${y}" width="60" height="${200-y}" style="fill:var(--accent)" opacity=".1"/><line x1="${x-30}" y1="${y}" x2="${x+30}" y2="${y}" style="stroke:var(--accent)" stroke-width="1.5" opacity=".45"/>`).join('')
        +steps.map(([x,y,s])=>K.kb(x,y-s*12,s)).join('')
        +`<path d="M44 148C130 132 230 100 356 52" fill="none" style="stroke:var(--eq-kb)" stroke-width="2.5" stroke-dasharray="3 8" stroke-linecap="round" opacity=".8"/>`},
    // recovery: tools at rest on the floor, a moon and slow breath lines
    recovery(K){return K.glow()+`<circle cx="318" cy="52" r="24" style="fill:var(--accent)" opacity=".18"/><circle cx="330" cy="44" r="22" style="fill:var(--bg)" opacity=".9"/>`
        +[70,90,110].map((y,i)=>`<path d="M40 ${y}c30-12 60 12 90 0s60 12 90 0" fill="none" style="stroke:var(--accent)" stroke-width="1.6" opacity="${.35-i*.08}" stroke-linecap="round"/>`).join('')
        +K.mace(96,172,84,170,12)+K.club(312,176,-88,150,12)+K.kb(206,170,1.1)+K.floor(182)},
    // continue: a bell with a forward arc
    resume(K){return K.glow()+K.dust(10,17)
        +`<path d="${arc(200,120,74,-120,100)}" fill="none" style="stroke:var(--accent)" stroke-width="4" stroke-linecap="round" opacity=".6"/><path d="M${pol(200,120,74,100).join(' ')}l-14 -2l8 12z" style="fill:var(--accent)" opacity=".7"/>`
        +K.mace(132,180,-30,96,11,.85)+K.club(274,182,30,112,10,.85)+K.kb(200,165,1.7)+K.floor(186)},
    // log: tally marks chalked on the wall above a bell
    ledger(K){const tally=(x,y)=>`<g style="stroke:var(--ink)" stroke-width="2.4" stroke-linecap="round" opacity=".45">${[0,1,2,3].map(i=>`<line x1="${x+i*9}" y1="${y}" x2="${x+i*9-2}" y2="${y+32}"/>`).join('')}<line x1="${x-6}" y1="${y+26}" x2="${x+33}" y2="${y+6}"/></g>`;
      return K.glow()+tally(80,40)+tally(140,46)+tally(200,40)+`<g style="stroke:var(--ink)" stroke-width="2.4" stroke-linecap="round" opacity=".45"><line x1="262" y1="46" x2="260" y2="78"/><line x1="271" y1="46" x2="269" y2="78"/></g>`
        +K.club(330,182,-10,124,11)+K.kb(250,171,1.25)+K.mace(110,182,14,104,12)+K.floor(186)}
  };

  window.Art={
    scenes:Object.keys(SCENES),
    scene(name,style){
      const f=SCENES[name];if(!f)return '';
      const id='art'+(++uid);const K=kit(style||'poster',id);
      return `<svg class="art-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" role="presentation" aria-hidden="true" focusable="false">${K.defs}${f(K)}</svg>`;
    }
  };
})();
