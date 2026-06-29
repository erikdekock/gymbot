
const C=document.getElementById('game'),X=C.getContext('2d');
const W=600,H=800,HORIZON=300,F=190,CAMH=4.2,XW=3.2,ROAD=2.6,ZMIN=0.8;
const SS=1.7;C.width=W*SS;C.height=H*SS;C.style.width='100%';C.style.height='100%';
const SPEED=3.5,LEN=56,JUMPV=375,GRAV=1200;
const FPS=10,ARTHUR_W=112;
const ERIK_FPS=8,ERIK_H=1.8;/* walk-cycle-snelheid en wereldhoogte (reproduceert de oude vector-silhouethoogte) */
const CAT_FPS=10,CAT_H=1.0;/* kat: animatie-snelheid (fps) en wereldhoogte */
const DOG_FPS=9,DOG_H=0.96;/* hond: animatie-snelheid (fps) en wereldhoogte */
/* knockback-tunables: visuele boog van de weggeknalde kat (raakt score/levens NIET aan) */
const KNOCK_HV=9.2;  /* horizontale vliegsnelheid (sc-eenheden/s) */
const KNOCK_UV=8.8;  /* initiële opwaartse snelheid (sc-eenheden/s) */
const KNOCK_GV=11.5; /* zwaartekracht van de boog (sc-eenheden/s²) */
const KNOCK_ROT=13.5;/* rotatiesnelheid (rad/s) */
const KNOCK_SHR=0.5; /* schaalkrimp per seconde */
/* ---- Climax: sprong over het hek (Ticket 8) — losse tunables ---- */
const GATE_Z=LEN;       /* wereldpositie van het hek (einde van het parcours) */
const GATE_D=1.8;       /* controlediepte: check valt als d ≈ GATE_D */
const GATE_DMARG=0.45;  /* timing-venster (halve breedte); groter = milder */
const GATE_CLEAR=30;    /* minimale air-hoogte (px) om over het hek te komen */
const GATE_CAP_D=8;     /* toon affordance-caption binnen deze diepte */
const AIMGS=ARTHUR_FRAMES.map(s=>{const im=new Image();im.src=s;return im;});
const EIMGS=ERIK_FRAMES.map(s=>{const im=new Image();im.src=s;return im;});
const CIMGS=CAT_FRAMES.map(s=>{const im=new Image();im.src=s;return im;});
const DIMGS=DOG_FRAMES.map(s=>{const im=new Image();im.src=s;return im;});
const HOUSE_IMGS=HOUSES.map(o=>{const im=new Image();im.src=o.d;return im;});
const FLIP=new Array(5);
HOUSE_IMGS.forEach((im,i)=>{ im.onload=()=>{const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const g=c.getContext('2d');g.translate(c.width,0);g.scale(-1,1);g.drawImage(im,0,0);FLIP[i]=c;}; });
const HOUSE_AR=HOUSES.map(o=>o.h/o.w);
const HOUSE_N=10;
function houseImg(v){return v<5?HOUSE_IMGS[v]:(FLIP[v-5]||HOUSE_IMGS[v-5]);}
function houseAR(v){return HOUSE_AR[v<5?v:v-5];}
const ROADIMG=new Image();ROADIMG.src=STREET.road.d;
const GATEIMG=new Image();GATEIMG.src=STREET.gate.d;
const ASSET={};for(const k of ['tree','bike','bench','car','bollard','lamp'])(ASSET[k]=new Image()).src=STREET[k].d;
const OBST={};for(const k of ['cat_ok','cat_hiss','dog'])(OBST[k]=new Image()).src=OBSTI[k].d;
function texStrip(img,side,zN,w,h,strips){const x=side*XW,iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
 for(let i=0;i<strips;i++){const u0=i/strips,u1=Math.min(1,(i+1)/strips+0.004);const z0=zN+u0*w,z1=zN+u1*w;
  const NT=P(x,h,z0),NB=P(x,0,z0),NM=P(x,h*0.5,z0),FM=P(x,h*0.5,z1);const sx0=u0*iw,sx1=u1*iw,dsx=sx1-sx0;if(dsx<=0)continue;
  const a=(FM[0]-NM[0])/dsx,b=(FM[1]-NM[1])/dsx,c=(NB[0]-NT[0])/ih,d=(NB[1]-NT[1])/ih,e=NT[0]-a*sx0,f=NT[1]-b*sx0;
  X.setTransform(a*SS,b*SS,c*SS,d*SS,e*SS,f*SS);X.drawImage(img,sx0,0,dsx,ih,sx0,0,dsx,ih);}
 X.setTransform(SS,0,0,SS,0,0);}

const FAC=[[158,92,70],[120,82,64],[201,156,96],[70,96,80],[96,110,118],[176,138,98],[140,110,138],[178,98,86],[92,104,96]];
const DOORC=['#37503f','#7a2f2f','#2f4a6a','#5a4a2a','#26323e'];
const GAB=['tri','step','flat','tri','step'];
const CARC=[[58,64,72],[150,44,44],[206,196,186],[44,50,64]];

function L3(a,b,t){return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
function RGB(a){return 'rgb('+(a[0]|0)+','+(a[1]|0)+','+(a[2]|0)+')';}
function sm(e0,e1,x){x=Math.max(0,Math.min(1,(x-e0)/(e1-e0)));return x*x*(3-2*x);}
function hash(a,b){let x=Math.sin(a*127.1+b*311.7)*43758.5;return x-Math.floor(x);}
function P(x,y,z){const zz=Math.max(ZMIN,z),sc=F/zz;return [300+x*sc, HORIZON+(CAMH-y)*sc];}
function groundY(d){return HORIZON+CAMH*F/Math.max(ZMIN,d);}

let S, stars=[];
for(let i=0;i<70;i++)stars.push({x:Math.random()*W,y:Math.random()*(HORIZON-30),s:Math.random()<0.5?1:2,a:0.4+Math.random()*0.6});
function fresh(){return {phase:'start',travel:0,spd:0,air:0,vy:0,duck:false,slapT:0,stun:0,shake:0,flash:0,
 lives:3,score:0,
 buildings:[],props:[],obs:[],birds:[],fx:[],orbs:[],
 nbz:[2.2,2.9],npz:2.5,noz:7,birdsDone:false,bloomT:0,cap:0,t:0,
 level:1,climax:null,capText:'Op weg naar de speeltuin...',fw:[],fwT:0,fwNext:0,retryT:0};}
S=fresh();
let nf=0,ph=0,dusk=0;
function gpf(){return Math.min(1,S.travel/LEN);}

addEventListener('keydown',e=>{
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();
 if(S.phase==='start'){return;}/* de #intro-overlay start de run (begin()); geen spatie-startprompt meer hier */
 if(S.phase==='run'){
   if(e.key==='ArrowUp'&&S.air<=0&&!S.duck)S.vy=JUMPV;
   if(e.key==='ArrowDown')S.duck=true;
   if(e.key===' ')slap();}});
addEventListener('keyup',e=>{if(e.key==='ArrowDown')S.duck=false;});
C.addEventListener('pointerdown',e=>{const r=C.getBoundingClientRect(),cy=(e.clientY-r.top)/r.height*H;
 if(S.phase==='start'){return;}/* de #intro-overlay start de run */
 if(S.phase==='run'){ if(cy<H*0.4){if(S.air<=0&&!S.duck)S.vy=JUMPV;} else if(cy>H*0.7){S.duck=true;} else slap(); }});
C.addEventListener('pointerup',()=>{S.duck=false;});
function begin(level){S=fresh();S.level=level||currentLevel||1;gen();S.props=S.props.filter(p=>!(p.kind==='tree'&&p.z<6));S.props.push({kind:'bench',side:1,z:4.6,cx:3.02});S.props.push({kind:'bench',side:-1,z:10.5,cx:3.02});S.phase='run';S.cap=2.2;clearOv();}
function restart(){begin(currentLevel);}
function clearOv(){['finalChoice','reveal','gameOver','hub','cards'].forEach(id=>{var e=document.getElementById(id);if(e)e.classList.remove('show');});}

/* ===== Reishub / 3 etappes (Ticket 3) — voortgang in module-scope, GEEN storage ===== */
let currentLevel=1, completed=[false,false,false];
const REIS={picks:[],votes:{marseille:0,palermo:0,bilbao:0},packs:null,packIndex:0};/* kaarten/pakjes (ticket 5); picks/votes/packIndex consumeren in ticket 6 */
/* ---- Pakjes-datalaag (Ticket 5): 9 pakjes uit de 27 kaarten (CARDS), GEEN UI ---- */
function shufflePack(a){for(var i=a.length-1;i>0;i--){var j=(Math.random()*(i+1))|0,t=a[i];a[i]=a[j];a[j]=t;}return a;}
function cardOf(city,theme){for(var i=0;i<CARDS.length;i++)if(CARDS[i].city===city&&CARDS[i].theme===theme)return CARDS[i];return null;}
function buildPacks(){
 /* offsets 0/3/6 -> binnen elk pakje drie verschillende thema's; rotatie r randomiseert de paring */
 var cities=['Marseille','Palermo','Bilbao'],off=[0,3,6],r=(Math.random()*9)|0,packs=[];
 for(var i=0;i<9;i++){
   var trio=cities.map(function(city,ci){return cardOf(city,((i+off[ci]+r)%9)+1);});
   shufflePack(trio);/* posities links/midden/rechts schudden */
   packs.push(trio);
 }
 shufflePack(packs);/* pakje-volgorde schudden */
 return packs;
}
function packsForLevel(level){return REIS.packs?REIS.packs.slice((level-1)*3,(level-1)*3+3):[];}/* 3 pakjes per etappe */

/* ===== Kaart-fase (Ticket 6): woordloze keuze, 3 pakjes per etappe, stemmen, reveal ===== */
let CARDP=null,cardLock=false;
/* na de fireworks: eerste keer -> open de 3 pakjes; al gehaald (replay) -> geen kaarten/stemmen */
function afterClimax(){if(completed[currentLevel-1]){completeEtappe();}else{startCardPhase(currentLevel);}}
function startCardPhase(level){S.phase='cards';CARDP={level:level,packs:packsForLevel(level),i:0};cardLock=false;var ov=document.getElementById('cards');if(ov)ov.classList.add('show');showPack();}
function showPack(){var ov=document.getElementById('cards');if(!ov||!CARDP)return;var pack=CARDP.packs[CARDP.i],cards=ov.querySelectorAll('.gcard');
 cards.forEach(function(el,k){el.classList.remove('chosen','faded');var im=el.querySelector('img');im.src=pack[k]?pack[k].src:'';el.onclick=function(){chooseCard(k);};});
 var dots=ov.querySelectorAll('.cardprog span');dots.forEach(function(d,k){d.classList.toggle('on',k===CARDP.i);d.classList.toggle('done',k<CARDP.i);});
 var row=ov.querySelector('.cardrow');row.classList.remove('in');void row.offsetWidth;row.classList.add('in');}/* re-trigger binnenkomst-animatie */
function chooseCard(k){if(cardLock||!CARDP)return;var pack=CARDP.packs[CARDP.i];if(!pack||!pack[k])return;cardLock=true;
 var ov=document.getElementById('cards'),cards=ov.querySelectorAll('.gcard');
 ov.querySelector('.cardrow').classList.remove('in');/* stop de binnenkomst-animatie (fill-mode) zodat .faded/.chosen kunnen winnen */
 cards.forEach(function(el,j){el.onclick=null;el.classList.add(j===k?'chosen':'faded');});
 REIS.picks.push({city:pack[k].city,theme:pack[k].theme});REIS.packIndex++;/* geordende stem; cursor vooruit */
 setTimeout(function(){cardLock=false;CARDP.i++;if(CARDP.i<3){showPack();}else{endCardPhase();}},800);}
function endCardPhase(){var ov=document.getElementById('cards');if(ov)ov.classList.remove('show');CARDP=null;
 if(REIS.picks.length>=9){completed[currentLevel-1]=true;S.phase='reveal';showReveal(cityByName(tallyWinner(REIS.picks)));}/* reis compleet -> tel stemmen -> bestaande reveal bovenop (geen hub eronder) */
 else{completeEtappe();}}
/* pure functie: meeste stemmen wint; gelijkspel -> de laatst-gekozen stad uit de gelijke set */
function tallyWinner(picks){var count={},i,c;for(i=0;i<picks.length;i++){c=picks[i].city;count[c]=(count[c]||0)+1;}
 var max=-1;for(c in count)if(count[c]>max)max=count[c];
 var tied={};for(c in count)if(count[c]===max)tied[c]=true;
 for(i=picks.length-1;i>=0;i--)if(tied[picks[i].city])return picks[i].city;
 return picks[picks.length-1].city;}
function cityByName(name){for(var i=0;i<CITYDATA.length;i++)if(CITYDATA[i].name===name)return CITYDATA[i];return CITYDATA[0];}
const HUBTIJD=['Ochtend','Schemering','Nacht'];/* tijd-van-de-dag per etappe */
function levelUnlocked(i){return i===0||completed[i-1];}/* lineair ontgrendeld (0-based) */
function showHub(){if(!REIS.packs)REIS.packs=buildPacks();/* één keer bij de eerste hub; NIET opnieuw schudden bij herstart/mis */S.phase='hub';renderHubTiles();var h=document.getElementById('hub');if(h)h.classList.add('show');}
function renderHubTiles(){
 var tiles=document.querySelectorAll('#hub .htile');
 for(var i=0;i<tiles.length;i++){(function(i){
   var t=tiles[i],open=levelUnlocked(i),done=completed[i];
   t.classList.toggle('locked',!open);t.classList.toggle('done',done);
   var ck=t.querySelector('.hcheck');if(ck)ck.style.display=done?'block':'none';
   var lk=t.querySelector('.hlock');if(lk)lk.style.display=open?'none':'block';
   t.onclick=open?function(){startEtappe(i+1);}:null;
 })(i);}
 var dn=document.getElementById('hubdone');if(dn)dn.style.display=completed.every(Boolean)?'block':'none';
}
function startEtappe(level){if(!levelUnlocked(level-1))return;currentLevel=level;var h=document.getElementById('hub');if(h)h.classList.remove('show');begin(level);}
function completeEtappe(){completed[currentLevel-1]=true;showHub();}
/* ---- Climax-afloop (Ticket 4): herstart etappe zonder voortgang/stemmen te wissen, zonder reload ---- */
function runFail(msg){S.phase='retry';S.retryT=0;S.capText=msg;S.cap=2.0;S.flash=0.6;}
function gateHit(){S.climax='hit';S.phase='fireworks';S.fw=[];S.fwT=0;S.fwNext=0;S.shake=0.18;S.cap=0;}
function gateMiss(){S.climax='miss';runFail('Tegen het hek! Opnieuw.');}
function spawnBurst(cx,cy){const cols=[[255,210,120],[255,150,90],[180,210,255],[255,120,160]],col=cols[(Math.random()*cols.length)|0],n=22;
 for(let i=0;i<n;i++){const a=(i/n)*6.283+Math.random()*0.25,sp=55+Math.random()*95;S.fw.push({x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-12,life:0,max:0.85+Math.random()*0.55,col});}}

function pts(d,v){S.fx.push({x:300,y:groundY(d)-44,t:0,kind:'pts',v});}
function slap(){S.slapT=0.22;let best=99,bi=-1;S.obs.forEach((o,i)=>{if(o.type==='cat'&&o.state==='come'){const d=o.z-S.travel;if(d>1.9&&d<3.7&&d<best){best=d;bi=i;}}});
 if(bi>=0){const o=S.obs[bi];o.state='done';o.ft=0;o.fdir=Math.random()<0.5?-1:1;S.score+=10;pts(best,'+10');S.shake=0.14;}}
function loseLife(){S.lives--;S.stun=0.9;S.shake=0.3;S.flash=0.5;if(S.lives<=0)runFail('Arthur haalde het net niet — opnieuw.');}

function gen(){const FAR=52;
 for(let si=0;si<2;si++){const side=si===0?-1:1;
   while(S.nbz[si]<S.travel+FAR){const w=1.85+Math.random()*0.7,hi=(Math.random()*HOUSE_N)|0,h=w*houseAR(hi);
     S.buildings.push({side,z:S.nbz[si],w,h,hi,col:FAC[(Math.random()*FAC.length)|0],lit:[{u:0.18+Math.random()*0.22,v:0.42+Math.random()*0.2},{u:0.56+Math.random()*0.22,v:0.4+Math.random()*0.26}]});
     S.nbz[si]+=w;}}
 while(S.npz<S.travel+FAR){const z=S.npz;
   S.props.push({kind:'bollard',side:-1,z});S.props.push({kind:'bollard',side:1,z});
   const r=Math.random();
   if(r<0.22)S.props.push({kind:'car',side:Math.random()<0.5?-1:1,z:z+0.5,col:CARC[(Math.random()*CARC.length)|0]});
   else if(r<0.40)S.props.push({kind:'bike',side:Math.random()<0.5?-1:1,z:z+0.4});
   else if(r<0.50)S.props.push({kind:'tree',side:Math.random()<0.5?-1:1,z:z+0.3});
   else if(r<0.56)S.props.push({kind:'bench',side:Math.random()<0.5?-1:1,z:z+0.4,cx:2.92});
   if(Math.round(z)%6===0)S.props.push({kind:'lamp',side:(Math.round(z)%12===0)?-1:1,z});
   S.npz+=1.6;}
 while(S.noz<Math.min(S.travel+FAR,LEN-3.5)){const r=Math.random();const type=r<0.4?'cat':r<0.7?'dog':'erik';
   S.obs.push({type,z:S.noz,state:'come',ft:0,fdir:0});
   S.noz+=2.9+Math.random()*1.5;}
 const lim=S.travel-2.6;
 S.buildings=S.buildings.filter(b=>b.z>lim);S.props=S.props.filter(p=>p.z>S.travel-1.6);
 S.obs=S.obs.filter(o=>o.z-S.travel>0.5);
}

let last=performance.now();
function loop(now){const dt=Math.min(0.05,(now-last)/1000);last=now;S.t+=dt;
 /* reis-brede tijd: etappe 1 ochtend -> 2 schemering -> 3 nacht, via offset in dezelfde curve */
 ph=(((S.level||1)-1)+Math.min(1,S.travel/LEN))/3;nf=sm(0.45,1.0,ph);dusk=Math.sin(ph*Math.PI)*0.62*(1-nf*0.55);
 if(S.phase==='run')update(dt);
 else if(S.phase==='bloom'){S.bloomT+=dt;if(S.bloomT>0.3&&S.orbs.length<26&&Math.random()<0.4)S.orbs.push({x:120+Math.random()*360,y:760+Math.random()*40,vy:-(20+Math.random()*30),tw:Math.random()*6,r:3+Math.random()*4});if(S.bloomT>4.2&&!document.getElementById('finalChoice').classList.contains('show'))showFinalChoice();}
 else if(S.phase==='fireworks'){S.fwT+=dt;if(S.fwT>=S.fwNext&&S.fwT<2.0){S.fwNext+=0.34;spawnBurst(140+Math.random()*320,150+Math.random()*230);}for(const p of S.fw){p.life+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=140*dt;}S.fw=S.fw.filter(p=>p.life<p.max);if(S.fwT>2.7)afterClimax();}
 else if(S.phase==='retry'){S.retryT+=dt;if(S.flash>0)S.flash-=dt*1.2;if(S.retryT>1.6)begin(currentLevel);}
 for(const o of S.orbs)o.y+=o.vy*dt,o.tw+=dt;
 for(const b of S.birds){b.x+=b.vx*dt;b.y+=b.vy*dt;b.vy+=20*dt;b.t+=dt;}S.birds=S.birds.filter(b=>b.t<2.4);
 for(const f of S.fx)f.t+=dt;S.fx=S.fx.filter(f=>f.t<(f.kind==='pts'?0.7:0.45));
 if(S.shake>0)S.shake-=dt;
 render();requestAnimationFrame(loop);}

function update(dt){
 S.spd+=(SPEED-S.spd)*Math.min(1,dt*1.5);S.travel+=S.spd*dt;gen();
 S.vy-=GRAV*dt;S.air=Math.max(0,S.air+S.vy*dt);if(S.air===0&&S.vy<0)S.vy=0;
 if(S.slapT>0)S.slapT-=dt; if(S.stun>0)S.stun-=dt; if(S.flash>0)S.flash-=dt; if(S.cap>0)S.cap-=dt;
 for(const o of S.obs){ if(o.state!=='come')continue; const d=o.z-S.travel;
   if(o.type==='dog'){ if(d<2.6&&S.air>22){o.state='done';o.ft=0;S.score+=12;pts(d,'+12');} else if(d<1.95){o.state='miss';o.ft=0;loseLife();} }
   else if(o.type==='erik'){ if(d<2.6&&S.duck){o.state='done';o.ft=0;S.score+=15;pts(d,'+15');} else if(d<1.95){o.state='miss';o.ft=0;loseLife();} }
   else { if(d<1.95){o.state='miss';o.ft=0;loseLife();} } }
 for(const o of S.obs)if(o.state!=='come')o.ft+=dt;
 if(!S.birdsDone&&S.travel>LEN-5){S.birdsDone=true;const py=groundY(LEN-S.travel)-30;for(let i=0;i<7;i++)S.birds.push({x:300+(Math.random()*2-1)*120,y:py,vx:(Math.random()*2-1)*60,vy:-(60+Math.random()*50),t:0});}
 /* CLIMAX (ticket 8): sprong over het hek — geen bovengrens (hoger is altijd goed) */
 const dGate=GATE_Z-S.travel;
 if(S.climax==null){
   if(dGate<GATE_CAP_D&&dGate>GATE_D){S.cap=0.25;S.capText='Spring over het hek!';}
   if(dGate<=GATE_D+GATE_DMARG&&dGate>=GATE_D-GATE_DMARG){
     if(S.air>=GATE_CLEAR)gateHit();/* in de lucht hoog genoeg -> over het hek */
   } else if(dGate<GATE_D-GATE_DMARG){gateMiss();}/* venster voorbij zonder te springen -> mis */
 }
}

function quad(p){X.beginPath();X.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)X.lineTo(p[i][0],p[i][1]);X.closePath();X.fill();}
function tri(a,b,c){X.beginPath();X.moveTo(a[0],a[1]);X.lineTo(b[0],b[1]);X.lineTo(c[0],c[1]);X.closePath();X.fill();}
function fq(x,zN,w,u0,u1,y0,y1){return [P(x,y0,zN+u0*w),P(x,y0,zN+u1*w),P(x,y1,zN+u1*w),P(x,y1,zN+u0*w)];}
function drawSky(){const top=L3([122,182,232],[14,20,42],nf);let hor=L3([208,232,240],[52,68,106],nf);hor=L3(hor,[236,150,96],dusk);
 const g=X.createLinearGradient(0,0,0,HORIZON+50);g.addColorStop(0,RGB(top));g.addColorStop(1,RGB(hor));X.fillStyle=g;X.fillRect(0,0,W,HORIZON+50);
 const sunY=95+ph*150;X.globalAlpha=Math.max(0,1-nf*0.85);X.fillStyle='rgba(255,240,205,1)';X.beginPath();X.arc(420,sunY,27,0,7);X.fill();X.globalAlpha=1;
 if(nf>0.4){X.globalAlpha=nf;X.fillStyle='#eef3ff';X.beginPath();X.arc(165,95,17,0,7);X.fill();X.fillStyle=RGB(top);X.beginPath();X.arc(172,91,15,0,7);X.fill();for(const s of stars){X.globalAlpha=nf*s.a;X.fillStyle='#fff';X.fillRect(s.x,s.y,s.s,s.s);}X.globalAlpha=1;}
 X.globalAlpha=(1-nf)*0.8;X.fillStyle='rgba(255,255,255,0.85)';for(let i=0;i<3;i++){const cx=((i*230-S.travel*6)%(W+170))-85;X.beginPath();X.ellipse(cx,60+i*26,38,15,0,0,7);X.ellipse(cx+28,64+i*26,28,12,0,0,7);X.ellipse(cx-26,65+i*26,24,11,0,0,7);X.fill();}X.globalAlpha=1;}
function drawGround(){const dN0=CAMH*F/(H-HORIZON);
 const g=X.createLinearGradient(0,HORIZON,0,H);g.addColorStop(0,RGB(L3([104,84,76],[24,30,50],nf)));g.addColorStop(1,RGB(L3([120,94,82],[28,34,54],nf)));
 X.fillStyle=g;X.fillRect(0,HORIZON,W,H-HORIZON);
 const lenX=0.6,depthZ=0.3,mInX=0.05,mInZ=0.05,DCAP=9.0,baseRow=Math.floor(S.travel/depthZ),phase=S.travel-baseRow*depthZ;
 const NR=Math.ceil((DCAP-dN0)/depthZ)+2;
 for(let i=0;i<NR;i++){const dN=dN0+i*depthZ-phase,dF=dN+depthZ,dNc=Math.max(ZMIN,dN);if(dF<=ZMIN)continue;if(dNc>DCAP)break;
   const fade=dN>DCAP-1.7?Math.max(0,(DCAP-dN)/1.7):1,rowId=baseRow+i,off=(rowId&1)?lenX*0.5:0;
   for(let c=-7;c<=7;c++){const xc=c*lenX+off,xL=xc-lenX*0.5+mInX,xR=xc+lenX*0.5-mInX;if(xR<-XW-0.7||xL>XW+0.7)continue;
     let hsh=((rowId*73856093)^(c*19349663))>>>0;hsh^=hsh>>>13;const r=(hsh>>>0)%997/997;
     const A=P(xL,0,dF-mInZ),B=P(xR,0,dF-mInZ),Cc=P(xR,0,dNc),D=P(xL,0,dNc);
     X.globalAlpha=fade;X.fillStyle=RGB(L3([154-r*42,92-r*26,70-r*22],[32,38,58],nf*0.9));
     X.beginPath();X.moveTo(A[0],A[1]);X.lineTo(B[0],B[1]);X.lineTo(Cc[0],Cc[1]);X.lineTo(D[0],D[1]);X.closePath();X.fill();}}
 X.globalAlpha=1;
 if(nf>0){X.fillStyle='rgba(16,20,40,'+(nf*0.3)+')';X.fillRect(0,HORIZON,W,H-HORIZON);}}
function drawWall(b){const zN=b.z-S.travel,w=b.w,h=b.h,side=b.side,x=side*XW,zF=zN+w;if(zF<=ZMIN)return;
 const img=houseImg(b.hi);const znc=Math.max(ZMIN,zN);
 if(img&&(img.naturalWidth||img.width)){const sw=Math.abs(P(x,0,zN)[0]-P(x,0,zF)[0]);const strips=Math.max(2,Math.min(34,Math.round(sw/6)));texStrip(img,side,zN,w,h,strips);}
 else{X.fillStyle=RGB(L3(b.col,[40,46,60],0.25));quad([P(x,0,znc),P(x,h,znc),P(x,h,zF),P(x,0,zF)]);}
 if(nf>0){X.fillStyle='rgba(16,20,40,'+(nf*0.5)+')';quad([P(x,0,znc),P(x,h,znc),P(x,h,zF),P(x,0,zF)]);}
 if(nf>0.42&&b.lit){const a=Math.min(1,(nf-0.42)/0.4);for(const Lw of b.lit){const wz=zN+Lw.u*w;if(wz<ZMIN)continue;const pc=P(x,Lw.v*h,wz),sc=F/wz,r=0.55*sc;X.globalAlpha=a;const g=X.createRadialGradient(pc[0],pc[1],0,pc[0],pc[1],r);g.addColorStop(0,'rgba(255,205,110,0.9)');g.addColorStop(0.5,'rgba(255,190,90,0.45)');g.addColorStop(1,'rgba(255,190,90,0)');X.fillStyle=g;X.beginPath();X.arc(pc[0],pc[1],r,0,7);X.fill();X.globalAlpha=1;}}}
function drawProp(p){const d=p.z-S.travel;if(d<0.5)return;const sc=F/d,sx=300+p.side*(p.cx||2.85)*sc,gy=groundY(d);
 const img=ASSET[p.kind];
 if(img&&img.naturalWidth){const hWorld={tree:2.6,bike:1.05,bench:0.98,car:1.32,bollard:0.95,lamp:3.25}[p.kind]||1.2,h=hWorld*sc,w=h*img.naturalWidth/img.naturalHeight,ix=sx-w/2,iy=gy-h;X.drawImage(img,ix,iy,w,h);if(nf>0){X.fillStyle='rgba(18,22,42,'+(nf*0.42)+')';X.fillRect(ix,iy,w,h);}
  if(p.kind==='lamp'&&nf>0.3){const gx=sx,gyc=gy-h*0.87,r=1.2*sc;X.globalAlpha=Math.min(1,(nf-0.3)*1.5)*0.8;const g=X.createRadialGradient(gx,gyc,0,gx,gyc,r);g.addColorStop(0,'rgba(255,218,130,0.95)');g.addColorStop(1,'rgba(255,218,130,0)');X.fillStyle=g;X.beginPath();X.arc(gx,gyc,r,0,7);X.fill();X.globalAlpha=1;}
  return;}
 X.save();X.translate(sx,gy);X.scale(sc,sc);
 if(p.kind==='bollard'){X.fillStyle=RGB(L3([120,58,50],[40,26,30],nf));X.beginPath();X.moveTo(-0.07,0);X.lineTo(-0.07,-0.7);X.quadraticCurveTo(0,-0.86,0.07,-0.7);X.lineTo(0.07,0);X.fill();}
 else if(p.kind==='car')drawCarShape(p.col||[150,160,175]);
 X.restore();}
function drawCarShape(col){X.fillStyle='rgba(0,0,0,0.25)';X.beginPath();X.ellipse(0,0.03,1.05,0.11,0,0,7);X.fill();X.fillStyle=RGB(L3(col,[18,20,28],nf*0.5));X.beginPath();X.moveTo(-1.0,-0.04);X.lineTo(-0.92,-0.5);X.lineTo(-0.4,-0.57);X.lineTo(-0.26,-0.88);X.lineTo(0.42,-0.88);X.lineTo(0.56,-0.57);X.lineTo(0.92,-0.5);X.lineTo(1.0,-0.04);X.closePath();X.fill();X.fillStyle=RGB(L3([150,180,200],[40,60,90],nf));X.fillRect(-0.22,-0.83,0.58,0.28);X.fillStyle='#111';X.beginPath();X.arc(-0.56,-0.01,0.19,0,7);X.arc(0.58,-0.01,0.19,0,7);X.fill();}

function drawObs(o){if(o.type==='cat')drawCat(o);else if(o.type==='dog')drawDog(o);else drawErik(o);}
function drawCat(o){const d=o.z-S.travel;if(d<0.28)return;const sc=F/d,gy=groundY(d);
 if(o.state==='done'){
  /* knockback: dramatische tuimelende boog ver buiten beeld */
  const ft=o.ft,img=CIMGS[0];
  if(img&&img.naturalWidth){
   const kx=300+o.fdir*ft*KNOCK_HV*sc;
   const krise=KNOCK_UV*sc*ft-0.5*KNOCK_GV*sc*ft*ft;
   const cy=gy-CAT_H*sc*0.5-krise;
   const ks=Math.max(0.04,1-ft*KNOCK_SHR);
   const hh=CAT_H*sc*ks,w=hh*img.naturalWidth/img.naturalHeight;
   X.save();X.translate(kx,cy);X.rotate(o.fdir*ft*KNOCK_ROT);
   X.drawImage(img,-w/2,-hh/2,w,hh);
   if(nf>0){X.fillStyle='rgba(18,22,42,'+(nf*0.45)+')';X.fillRect(-w/2,-hh/2,w,hh);}
   X.restore();}
  return;}
 /* nadering (come) of mis (miss): geanimeerde kat op zijn plek */
 const fi=Math.floor(S.t*CAT_FPS+o.z)%CIMGS.length,img=CIMGS[fi];
 if(img&&img.naturalWidth){const hh=CAT_H*sc,w=hh*img.naturalWidth/img.naturalHeight,ix=300-w/2,iy=gy-hh;
  X.save();
  X.fillStyle='rgba(0,0,0,0.2)';X.beginPath();X.ellipse(300,gy,w*0.4,sc*0.055,0,0,7);X.fill();
  X.drawImage(img,ix,iy,w,hh);if(nf>0){X.fillStyle='rgba(18,22,42,'+(nf*0.45)+')';X.fillRect(ix,iy,w,hh);}
  X.restore();
  if(o.state==='come'&&d>1.9&&d<5){X.fillStyle='#ff8a6b';X.font='bold 16px sans-serif';X.textAlign='center';X.fillText('spatie',300,iy-0.12*sc);}}}
function drawDog(o){const d=o.z-S.travel;if(d<0.28)return;const sc=F/d,x=300,gy=groundY(d);
 const fi=Math.floor(S.t*DOG_FPS+o.z)%DIMGS.length,img=DIMGS[fi];
 if(img&&img.naturalWidth){const hh=DOG_H*sc,w=hh*img.naturalWidth/img.naturalHeight,ix=x-w/2,iy=gy-hh;
   X.fillStyle='rgba(0,0,0,0.2)';X.beginPath();X.ellipse(x,gy,w*0.42,sc*0.06,0,0,7);X.fill();
   X.drawImage(img,ix,iy,w,hh);if(nf>0){X.fillStyle='rgba(18,22,42,'+(nf*0.45)+')';X.fillRect(ix,iy,w,hh);}
   if(o.state==='come'&&d>1.95&&d<5.2){X.fillStyle='#9ad0ff';X.font='bold 16px sans-serif';X.textAlign='center';X.fillText('omhoog',x,iy-0.12*sc);}}}
function drawErik(o){const d=o.z-S.travel;if(d<0.28)return;const sc=F/d,x=300,gy=groundY(d);
 const fi=Math.floor(S.t*ERIK_FPS+o.z)%EIMGS.length,img=EIMGS[fi];
 if(img&&img.naturalWidth){const hh=ERIK_H*sc,w=hh*img.naturalWidth/img.naturalHeight,ix=x-w/2,iy=gy-hh;
   X.fillStyle='rgba(0,0,0,0.2)';X.beginPath();X.ellipse(x,gy+0.04*sc,0.34*sc,0.1*sc,0,0,7);X.fill();
   X.drawImage(img,ix,iy,w,hh);if(nf>0){X.fillStyle='rgba(18,22,42,'+(nf*0.45)+')';X.fillRect(ix,iy,w,hh);}
   if(o.state==='come'&&d>1.95&&d<5.4){X.fillStyle='#ffd86b';X.font='bold 15px sans-serif';X.textAlign='center';if(Math.floor(S.t*7)%2)X.fillText('omlaag',x,gy-1.6*sc);}}}

function drawFireworks(){
 X.globalAlpha=0.45;const g=X.createRadialGradient(300,360,40,300,360,470);g.addColorStop(0,'rgba(255,210,140,0.6)');g.addColorStop(1,'rgba(40,30,60,0)');X.fillStyle=g;X.fillRect(0,0,W,H);X.globalAlpha=1;
 for(const p of S.fw){const a=Math.max(0,1-p.life/p.max);X.globalAlpha=a;X.fillStyle='rgb('+p.col[0]+','+p.col[1]+','+p.col[2]+')';X.beginPath();X.arc(p.x,p.y,2.6,0,7);X.fill();}
 X.globalAlpha=1;X.fillStyle='#fff';X.font='600 26px Georgia,serif';X.textAlign='center';X.fillText('Etappe gehaald!',300,300);}
function drawGate(d){const gy=groundY(d);
 if(GATEIMG.naturalWidth){const iw=GATEIMG.naturalWidth,ih=GATEIMG.naturalHeight,sw=2*XW*F/Math.max(ZMIN,d),w=sw*1.45,h=w*ih/iw;X.drawImage(GATEIMG,300-w/2,gy-h,w,h);if(nf>0){X.fillStyle='rgba(18,22,42,'+(nf*0.42)+')';X.fillRect(300-w/2,gy-h,w,h);}return;}
 const sc=F/d,top=HORIZON+(CAMH-2.3)*F/Math.max(ZMIN,d);X.fillStyle=RGB(L3([72,106,62],[24,40,30],nf));for(let gx=-2.6;gx<=2.6;gx+=0.6){const bx=300+gx*sc;X.beginPath();X.arc(bx,top-0.1*sc,0.5*sc,0,7);X.fill();}}
function win(x,y,w,h,lit){X.fillStyle='#e9e3d6';X.fillRect(x-0.04,y-0.04,w+0.08,h+0.08);X.fillStyle=lit?'#f4c75a':RGB(L3([54,70,84],[18,26,40],nf));X.fillRect(x,y,w,h);X.fillStyle='#e9e3d6';X.fillRect(x+w/2-0.02,y,0.04,h);X.fillRect(x,y+h/2-0.02,w,0.04);}

function carOver(cx,cy,w){const img=ASSET.car;
 if(img&&img.naturalWidth){const h=w*img.naturalHeight/img.naturalWidth,iy=cy-h+8;X.drawImage(img,cx-w/2,iy,w,h);if(nf>0){X.fillStyle='rgba(18,22,42,'+(nf*0.45)+')';X.fillRect(cx-w/2,iy,w,h);}return;}
 const h=w*0.42;X.fillStyle='rgba(0,0,0,0.25)';X.beginPath();X.ellipse(cx,cy+3,w*0.52,h*0.12,0,0,7);X.fill();X.fillStyle=RGB(L3([66,72,80],[18,20,28],nf*0.5));X.beginPath();X.moveTo(cx-w*0.5,cy);X.lineTo(cx-w*0.45,cy-h*0.55);X.lineTo(cx-w*0.2,cy-h*0.64);X.lineTo(cx-w*0.12,cy-h);X.lineTo(cx+w*0.22,cy-h);X.lineTo(cx+w*0.3,cy-h*0.62);X.lineTo(cx+w*0.46,cy-h*0.55);X.lineTo(cx+w*0.5,cy);X.closePath();X.fill();}
function drawArthur(){const gx=300,base=H*0.82+8,air=S.air,ducking=S.duck&&air<=0;
 X.fillStyle='rgba(0,0,0,'+Math.max(0.05,0.30-air/360)+')';X.beginPath();X.ellipse(gx,base,46*Math.max(0.45,1-air/260),8.5*Math.max(0.4,1-air/300),0,0,7);X.fill();
 const fi=Math.floor(S.t*FPS)%AIMGS.length,img=AIMGS[fi];
 if(img&&img.naturalWidth){let w=ARTHUR_W,h=img.naturalHeight*(w/img.naturalWidth);if(ducking){w*=1.14;h*=0.56;}
   const wob=(S.stun>0)?Math.sin(S.t*40)*4:0;X.drawImage(img,gx-w/2+wob,base-air-h,w,h);}
 if(ducking){carOver(gx,base+6,ARTHUR_W*1.95);X.fillStyle='#bfe3ff';X.font='bold 13px sans-serif';X.textAlign='center';X.fillText('verstopt',gx,base-64);}
 if(S.slapT>0){const e=1-S.slapT/0.22;X.strokeStyle='rgba(255,255,255,0.9)';X.lineWidth=3;X.lineCap='round';X.beginPath();X.arc(gx+ARTHUR_W*0.32,base-air-46,13+e*9,-1.0,0.5);X.stroke();}}
function drawBirds(){for(const b of S.birds){X.strokeStyle='rgba(50,52,60,'+Math.max(0,1-b.t/2.4)+')';X.lineWidth=2;const f=Math.sin(b.t*15)*4;X.beginPath();X.moveTo(b.x-6,b.y+f);X.lineTo(b.x,b.y-2);X.lineTo(b.x+6,b.y+f);X.stroke();}}
function drawFx(){for(const f of S.fx){if(f.kind==='pts'){const a=Math.max(0,1-f.t/0.7);X.globalAlpha=a;X.fillStyle='#ffe06b';X.font='bold 21px sans-serif';X.textAlign='center';X.fillText(f.v,f.x,f.y-f.t*34);X.globalAlpha=1;}}}
function drawPaw(x,y,on){X.save();X.translate(x,y);X.fillStyle=on?'#ff6b6b':'rgba(255,255,255,0.22)';X.beginPath();X.ellipse(0,2.5,6.5,5.5,0,0,7);X.fill();X.beginPath();X.arc(-5.5,-3.5,2.3,0,7);X.arc(0,-6,2.5,0,7);X.arc(5.5,-3.5,2.3,0,7);X.fill();X.restore();}
function drawHUD(){
 X.fillStyle='rgba(0,0,0,0.42)';X.fillRect(0,0,W,56);
 for(let i=0;i<3;i++)drawPaw(26+i*30,24,i<S.lives);
 X.textAlign='center';X.fillStyle='#fff';X.font='bold 13px sans-serif';X.fillText('NAAR DE SPEELTUIN',300,20);
 X.textAlign='right';X.fillStyle='#ffd86b';X.font='bold 26px sans-serif';X.fillText(String(S.score),W-16,32);
 X.fillStyle='rgba(255,255,255,0.65)';X.font='10px sans-serif';X.fillText('PUNTEN',W-16,46);
 const prog=S.travel/LEN;
 X.fillStyle='rgba(255,255,255,0.16)';X.fillRect(110,30,W-260,6);X.fillStyle='#84a98c';X.fillRect(110,30,(W-260)*Math.min(1,prog),6);
 X.fillStyle='rgba(255,255,255,0.78)';X.font='12px sans-serif';X.textAlign='center';X.fillText('spatie = kat    .    omhoog = hond    .    omlaag = Erik',300,H-12);}

function render(){X.setTransform(SS,0,0,SS,0,0);X.imageSmoothingEnabled=true;X.imageSmoothingQuality='high';X.clearRect(0,0,W,H);
 if(S.phase==='reveal')return;/* alleen de reveal-overlay; lege (zwarte) canvas erachter, geen tekst-bleed */
 if(S.phase==='start'||S.phase==='hub'||S.phase==='cards'){startScreen();return;}
 X.save();if(S.shake>0){X.translate((Math.random()-0.5)*9*S.shake/0.2,(Math.random()-0.5)*9*S.shake/0.2);}
 drawSky();drawGround();
 const it=[];
 for(const b of S.buildings)it.push({d:b.z-S.travel,f:()=>drawWall(b)});
 for(const p of S.props)it.push({d:p.z-S.travel,f:()=>drawProp(p)});
 {const d=LEN-S.travel;if(d>0.5)it.push({d,f:()=>drawGate(d)});}
 for(const o of S.obs)it.push({d:o.z-S.travel,f:()=>drawObs(o)});
 it.sort((a,b)=>b.d-a.d);for(const o of it)if(o.d>0.5)o.f();
 drawBirds();drawFx();drawArthur();
 X.restore();
 if(S.flash>0){X.fillStyle='rgba(200,40,40,'+(S.flash*0.45)+')';X.fillRect(0,0,W,H);}
 if(S.phase==='bloom')bloom();
 if(S.phase==='fireworks')drawFireworks();
 drawHUD();
 if(S.cap>0){X.globalAlpha=Math.min(1,S.cap);X.fillStyle='rgba(0,0,0,0.42)';X.fillRect(0,150,W,50);X.fillStyle='#fff';X.font='600 23px Georgia,serif';X.textAlign='center';X.fillText(S.capText||'Op weg naar de speeltuin...',300,182);X.globalAlpha=1;}}
function bloom(){const t=Math.min(1,S.bloomT/1.6);X.globalAlpha=t*0.55;const g=X.createRadialGradient(300,470,40,300,470,460);g.addColorStop(0,'rgba(255,210,140,0.7)');g.addColorStop(1,'rgba(40,30,60,0)');X.fillStyle=g;X.fillRect(0,0,W,H);X.globalAlpha=1;
 for(const o of S.orbs){X.globalAlpha=0.5+0.4*Math.sin(o.tw*3);const gg=X.createRadialGradient(o.x,o.y,0,o.x,o.y,o.r*3);gg.addColorStop(0,'rgba(255,225,150,0.9)');gg.addColorStop(1,'rgba(255,225,150,0)');X.fillStyle=gg;X.beginPath();X.arc(o.x,o.y,o.r*3,0,7);X.fill();}X.globalAlpha=1;
 if(S.bloomT>0.8){X.globalAlpha=Math.min(1,(S.bloomT-0.8)/1.2);X.fillStyle='#fff';X.font='600 22px Georgia,serif';X.textAlign='center';X.fillText('Ergens wacht een reis op jullie...',300,290);X.globalAlpha=1;}}
function startScreen(){const sv=S.travel;S.travel=4;ph=0.1;nf=0;dusk=0.3;drawSky();drawGround();
 const it=[];for(const b of S.buildings)it.push({d:b.z-S.travel,f:()=>drawWall(b)});for(const p of S.props)it.push({d:p.z-S.travel,f:()=>drawProp(p)});it.sort((a,b)=>b.d-a.d);for(const o of it)if(o.d>0.5)o.f();S.travel=sv;
 X.fillStyle='rgba(8,10,12,0.52)';X.fillRect(0,0,W,H);X.textAlign='center';X.fillStyle='#fff';X.font='700 38px Georgia,serif';X.fillText('Arthur',300,232);
 X.font='16px sans-serif';X.fillStyle='rgba(255,255,255,0.9)';X.fillText('Breng Arthur veilig naar de speeltuin.',300,272);
 X.font='15px sans-serif';
 ['spatie  -  sla de zwarte kat','pijl-omhoog  -  spring over de hond','pijl-omlaag  -  duik onder de auto voor Erik','3 levens - haal de speeltuin'].forEach((t,i)=>X.fillText(t,300,318+i*28));
 X.font='600 18px sans-serif';X.fillStyle='#ffd86b';X.fillText('spatie of klik om te beginnen',300,495);}

// ===== EINDE: Kies! =====
const CITYDATA=[
 {key:'marseille',name:'Marseille',line:'Zout, zon en de Maghreb om de hoek.',hero:'Marseille_2.png',imgs:['Marseille_1.png','Marseille_3.png','Marseille_4.png','Marseille_5.png','Marseille_6.png']},
 {key:'palermo',name:'Palermo',line:'Barok verval, markten en zee.',hero:'Palermo_2.png',imgs:['Palermo_1.png','Palermo_3.png','Palermo_4.png','Palermo_5.png','Palermo_6.png']},
 {key:'bilbao',name:'Bilbao',line:'Baskisch, koel, en heerlijk eten.',hero:'Bilbao_1.png',imgs:['Bilbao_2.png','Bilbao_3.png','Bilbao_4.png','Bilbao_5.png','Bilbao_6.png']}];
let FC=null;
function showFinalChoice(){const order=[...CITYDATA].sort(()=>Math.random()-0.5);FC={order};const ov=document.getElementById('finalChoice');const cards=ov.querySelectorAll('.fccard');
 order.forEach((city,i)=>{const c=cards[i];c.querySelector('img').src=IMAGES[city.hero];c.onclick=()=>pickCity(i);});ov.classList.add('show');}
function pickCity(i){if(!FC)return;const city=FC.order[i];FC=null;document.getElementById('finalChoice').classList.remove('show');showReveal(city);}
function showReveal(city){const ov=document.getElementById('reveal');ov.querySelector('.rvhero').src=IMAGES[city.hero];ov.querySelector('.rvname').textContent=city.name;ov.querySelector('.rvline').textContent=city.line;
 const strip=ov.querySelector('.rvstrip');strip.innerHTML='';city.imgs.forEach(im=>{const g=document.createElement('img');g.src=IMAGES[im];strip.appendChild(g);});ov.classList.add('show');}
function showGameOver(){const ov=document.getElementById('gameOver');ov.querySelector('.goscore').textContent='Punten: '+S.score;ov.classList.add('show');}
addEventListener('keydown',e=>{if(document.getElementById('finalChoice').classList.contains('show')&&['1','2','3'].includes(e.key))pickCity(+e.key-1);});
addEventListener('keydown',e=>{if(S.phase==='cards'&&['1','2','3'].includes(e.key))chooseCard(+e.key-1);});/* kaart-fase: toets 1/2/3 */

gen();requestAnimationFrame(loop);
