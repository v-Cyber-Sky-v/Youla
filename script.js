import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

(() => {
  'use strict';
window.addEventListener('error', (event) => {
  const message = document.getElementById('runtime-error');
  if (message && event.message) {
    message.hidden = false;
    message.textContent = 'Ошибка запуска 3D-сцены: ' + event.message + '. Проверьте интернет-соединение и поддержку WebGL.';
  }
});
window.addEventListener('unhandledrejection', (event) => {
  const message = document.getElementById('runtime-error');
  if (message) {
    message.hidden = false;
    message.textContent = 'Не удалось загрузить 3D-библиотеку. Обновите страницу и проверьте интернет-соединение.';
  }
});

  const $ = id => document.getElementById(id);
  // The simulation uses scaled game units (not a precision ephemeris).
  const SUN_GM = 100;
  const EARTH_GM = 0.16;
  const EARTH_RADIUS = 0.1065;
  const KM_SCALE = EARTH_RADIUS / 6371;
  const STEP = 0.25;
  const planets = [
    {key:'mercury',name:'Меркурий',orbit:387,ecc:.2056,inc:7,node:48.3,radius:0.0426,gm:EARTH_GM*.0553,color:'#aaa39b',phase:1.1,type:'rocky'},
    {key:'venus',name:'Венера',orbit:723,ecc:.0068,inc:3.39,node:76.7,radius:0.101175,gm:EARTH_GM*.815,color:'#d8b477',phase:2,type:'venus'},
    {key:'earth',name:'Земля',orbit:1000,ecc:.0167,inc:0,node:0,radius:0.1065,gm:EARTH_GM,color:'#438ee5',phase:0,type:'earth'},
    {key:'mars',name:'Марс',orbit:1524,ecc:.0934,inc:1.85,node:49.6,radius:0.05325,gm:EARTH_GM*.107,color:'#c85b43',phase:2.5,type:'mars'},
    {key:'jupiter',name:'Юпитер',orbit:5204,ecc:.0489,inc:1.3,node:100.5,radius:0.1065,gm:EARTH_GM*317.8,color:'#d5ad82',phase:.6,type:'jupiter'},
    {key:'saturn',name:'Сатурн',orbit:9533,ecc:.0565,inc:2.49,node:113.7,radius:0.1065,gm:EARTH_GM*95.2,color:'#d8c58d',phase:2.8,type:'saturn'},
    {key:'uranus',name:'Уран',orbit:19190,ecc:.0457,inc:.77,node:74, radius:0.426,gm:EARTH_GM*14.5,color:'#83d9df',phase:1.4,type:'uranus'},
    {key:'neptune',name:'Нептун',orbit:30060,ecc:.0113,inc:1.77,node:131,radius:0.426,gm:EARTH_GM*17.1,color:'#4777e8',phase:4.1,type:'neptune'}
  ];
  const captureRadius=p=>p.radius*25;

  const canvas = $('game');
  if (!window.WebGLRenderingContext) { throw new Error('WebGL не поддерживается этим браузером'); }
  let renderer;
  try { renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:false}); }
  catch (error) { const box = $('runtime-error'); if (box) { box.hidden = false; box.textContent = 'Не удалось создать 3D-сцену: браузер не поддерживает WebGL или аппаратное ускорение отключено.'; } throw error; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x050510, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050510, 0.000008);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100000);
  camera.position.set(0, 4200, 9000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.zoomSpeed = 2.2;
  controls.dampingFactor = 0.065;
  controls.minDistance = 0.2;
  controls.maxDistance = 300000;
  controls.enablePan = true;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.AmbientLight(0x8998bb, 1.1));
  const sunLight = new THREE.PointLight(0xffffff, 2600, 0, 1.35);
  scene.add(sunLight);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(2.13, 48, 36), new THREE.MeshBasicMaterial({color:0xffc347}));
  scene.add(sun);

  // Build detailed procedural texture maps so planets are textured spheres, not flat coloured dots.
  function makePlanetTexture(type, base) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = base; ctx.fillRect(0,0,c.width,c.height);
    const rand = (() => { let seed = type.split('').reduce((a,ch)=>a+ch.charCodeAt(0),37); return () => { seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; }; })();
    if (type === 'earth') {
      // ocean gradients and stylized continent masses
      const ocean=ctx.createLinearGradient(0,0,0,512); ocean.addColorStop(0,'#1c5d9c'); ocean.addColorStop(.5,'#1f78b9'); ocean.addColorStop(1,'#12385f'); ctx.fillStyle=ocean;ctx.fillRect(0,0,1024,512);
      for(let i=0;i<38;i++){const x=rand()*1024,y=rand()*512,rx=18+rand()*65,ry=12+rand()*42;ctx.fillStyle=rand()>.35?'#56884d':'#8d9b59';ctx.beginPath();ctx.ellipse(x,y,rx,ry,rand()*Math.PI,0,Math.PI*2);ctx.fill();
        for(let j=0;j<4;j++){ctx.beginPath();ctx.ellipse(x+(rand()-.5)*rx*2,y+(rand()-.5)*ry*2,rx*.25,ry*.22,rand()*3,0,Math.PI*2);ctx.fill();}}
      for(let i=0;i<180;i++){ctx.fillStyle=`rgba(255,255,255,${.08+rand()*.22})`;ctx.beginPath();ctx.ellipse(rand()*1024,rand()*512,8+rand()*45,2+rand()*9,rand()*3,0,Math.PI*2);ctx.fill();}
      ctx.fillStyle='#e7f5ff';ctx.fillRect(0,0,1024,10);ctx.fillRect(0,502,1024,10);
    } else if (type === 'jupiter' || type === 'saturn' || type === 'venus' || type === 'uranus' || type === 'neptune') {
      const bands = type==='jupiter'?24:(type==='saturn'?36:(type==='venus'?14:22));
      for(let i=0;i<bands;i++){const y=i*512/bands;ctx.fillStyle=(type==='venus'||type==='uranus'||type==='neptune')?`rgba(${type==='uranus'?'185,245,245':type==='neptune'?'100,140,255':'255,235,190'},${.08+rand()*.22})`:`rgba(${type==='saturn'?'112,77,45':'115,65,39'},${.08+rand()*.32})`;ctx.fillRect(0,y,1024,512/bands*(.3+rand()*.8));
        if(rand()>.4){ctx.strokeStyle='rgba(255,245,220,.15)';ctx.lineWidth=1+rand()*5;ctx.beginPath();ctx.moveTo(0,y+rand()*12);for(let x=0;x<=1024;x+=32)ctx.lineTo(x,y+Math.sin(x*.02+i)*rand()*9);ctx.stroke();}}
      if(type==='jupiter'){ctx.fillStyle='#a95c43';ctx.beginPath();ctx.ellipse(700,290,70,28,-.08,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#e2b18a';ctx.lineWidth=6;ctx.stroke();}
      if(type==='venus'){for(let i=0;i<100;i++){ctx.strokeStyle='rgba(255,250,225,.12)';ctx.lineWidth=2+rand()*5;ctx.beginPath();ctx.moveTo(rand()*1024,rand()*512);ctx.bezierCurveTo(rand()*1024,rand()*512,rand()*1024,rand()*512,rand()*1024,rand()*512);ctx.stroke();}}
    } else {
      for(let i=0;i<700;i++){const x=rand()*1024,y=rand()*512,r=rand()*2.6;ctx.fillStyle=`rgba(${type==='mars'?'210,120,80':'255,255,255'},${.04+rand()*.18})`;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
      if(type==='mars'){for(let i=0;i<35;i++){ctx.fillStyle='rgba(75,35,26,.22)';ctx.beginPath();ctx.ellipse(rand()*1024,rand()*512,5+rand()*30,3+rand()*12,rand()*3,0,Math.PI*2);ctx.fill();}}
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; tex.wrapS=THREE.RepeatWrapping; tex.anisotropy=4; return tex;
  }
  const starPositions=[];
  for(let i=0;i<2400;i++){const v=new THREE.Vector3().randomDirection().multiplyScalar(17500+Math.random()*10000);starPositions.push(v.x,v.y,v.z);}
  const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
  scene.add(new THREE.Points(starGeometry,new THREE.PointsMaterial({color:0xcbd8ff,size:1.5,sizeAttenuation:true})));

  function orbitalPosition(p, angle) {
    const inc=THREE.MathUtils.degToRad(p.inc), node=THREE.MathUtils.degToRad(p.node), c=Math.cos(angle), s=Math.sin(angle);
    const r=p.orbit*(1-(p.ecc||0)*(p.ecc||0))/(1+(p.ecc||0)*c);
    return new THREE.Vector3(r*(Math.cos(node)*c-Math.sin(node)*s*Math.cos(inc)), r*s*Math.sin(inc), r*(Math.sin(node)*c+Math.cos(node)*s*Math.cos(inc)));
  }
  const planetMeshes={};
  for(const p of planets){
    const points=[];for(let i=0;i<=360;i++)points.push(orbitalPosition(p,i*Math.PI/180));
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:p.color,transparent:true,opacity:.48})));
    const material=new THREE.MeshStandardMaterial({map:makePlanetTexture(p.type,p.color),roughness:.9,metalness:0});
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(p.radius,48,36),material);scene.add(mesh);
    if(p.key==='saturn') {const ring=new THREE.Mesh(new THREE.RingGeometry(p.radius*1.25,p.radius*2.1,96),new THREE.MeshStandardMaterial({color:0xcab98f,side:THREE.DoubleSide,transparent:true,opacity:.72,roughness:1}));ring.rotation.x=Math.PI/2;mesh.add(ring);}
    const labelCanvas=document.createElement('canvas');labelCanvas.width=256;labelCanvas.height=64;const cx=labelCanvas.getContext('2d');cx.font='28px system-ui';cx.fillStyle='#fff';cx.shadowColor='#000';cx.shadowBlur=5;cx.fillText(p.name,7,42);
    const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(labelCanvas),transparent:true,depthTest:false}));label.scale.set(22,5.5,1);scene.add(label);
    planetMeshes[p.key]={mesh,label};
  }
  // Each planet has a transparent spherical capture field, a fixed circular guide and a marker ball.
  const captureFields={};
  for(const p of planets){
    const r=captureRadius(p),group=new THREE.Group();
    const shell=new THREE.Mesh(new THREE.SphereGeometry(r,32,24),new THREE.MeshBasicMaterial({color:p.color,transparent:true,opacity:.05,depthWrite:false,side:THREE.DoubleSide}));
    const outline=new THREE.Mesh(new THREE.SphereGeometry(r*1.002,24,16),new THREE.MeshBasicMaterial({color:p.color,wireframe:true,transparent:true,opacity:.13,depthWrite:false}));
    const ring=new THREE.Mesh(new THREE.RingGeometry(r*.992,r*1.008,96),new THREE.MeshBasicMaterial({color:p.color,side:THREE.DoubleSide,transparent:true,opacity:.18,depthWrite:false}));
    ring.rotation.x=-Math.PI/2;
    const marker=new THREE.Mesh(new THREE.SphereGeometry(Math.max(.12,r*.025),12,8),new THREE.MeshBasicMaterial({color:p.color}));
    marker.position.set(r,0,0);group.add(shell,outline,ring,marker);scene.add(group);captureFields[p.key]=group;
  }
  // Major natural satellites of the gas/ice giants (illustrative scaled orbits).
  const moonData=[
    {name:'Луна',parent:'earth',distance:6.43,size:0.0291,rate:.23,phase:.4,color:0xbfc4cc},
    {name:'Ио',parent:'jupiter',distance:16,size:0.02375,rate:.20,phase:0,color:0xe8d59a},
    {name:'Европа',parent:'jupiter',distance:20,size:0.0215,rate:.13,phase:1.7,color:0xd8c9ad},
    {name:'Ганимед',parent:'jupiter',distance:25,size:0.02575,rate:.085,phase:3.1,color:0x9e9585},
    {name:'Каллисто',parent:'jupiter',distance:32,size:0.0235,rate:.055,phase:4.4,color:0x817c78},
    {name:'Титан',parent:'saturn',distance:20,size:0.02575,rate:.075,phase:1.1,color:0xd6a65b},
    {name:'Рея',parent:'saturn',distance:14,size:0.016,rate:.12,phase:2.6,color:0xbcb9b1},
    {name:'Энцелад',parent:'saturn',distance:11,size:0.0115,rate:.17,phase:4.6,color:0xe9f1ef},
    {name:'Титания',parent:'uranus',distance:11,size:.35,rate:.09,phase:.7,color:0xc1d5d7},
    {name:'Тритон',parent:'neptune',distance:11,size:.4,rate:-.10,phase:2.2,color:0xc9d6e7}
  ];
  const moonMeshes=moonData.map(m=>{const mesh=new THREE.Mesh(new THREE.SphereGeometry(m.size,20,16),new THREE.MeshStandardMaterial({color:m.color,roughness:1}));scene.add(mesh);const c=document.createElement('canvas');c.width=192;c.height=48;const x=c.getContext('2d');x.font='22px system-ui';x.fillStyle='#f2f4ff';x.shadowColor='#000';x.shadowBlur=4;x.fillText(m.name,4,32);const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false}));label.scale.set(15,3.75,1);scene.add(label);return{data:m,mesh,label};});
  const shipMaterial=new THREE.MeshStandardMaterial({color:0x8cecff,emissive:0x15506b,metalness:.45,roughness:.3});
  const ship=new THREE.Mesh(new THREE.ConeGeometry(0.045,0.18,10),shipMaterial);ship.rotation.x=Math.PI/2;scene.add(ship);
  const shipLight=new THREE.PointLight(0x4bd7ff,0.08,1.2);ship.add(shipLight);
  const trail=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x58e7ff,transparent:true,opacity:.8}));scene.add(trail);
  const prediction=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:0xffd779,dashSize:3,gapSize:2,transparent:true,opacity:.85}));scene.add(prediction);
  const targetMarker=new THREE.Group();
  const markerMaterial=new THREE.LineBasicMaterial({color:0xffe58a,depthTest:false,transparent:true,opacity:.98});
  for(const axis of [new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)]){const pts=[axis.clone().multiplyScalar(-7),axis.clone().multiplyScalar(7)];targetMarker.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),markerMaterial));}
  targetMarker.add(new THREE.Mesh(new THREE.SphereGeometry(2.2,12,8),new THREE.MeshBasicMaterial({color:0xffe58a,wireframe:true,depthTest:false})));targetMarker.visible=false;scene.add(targetMarker);

  const state={phase:'setup',time:0,epochDay:300,ship:{x:100,y:0,z:0,vx:0,vy:0,vz:0},previousShip:null,trail:[],totalDv:0,fuel:7.5,timeScale:1,captureArmed:{},cameraFocus:'ship'};
  const meanMotion=p=>Math.sqrt(SUN_GM/Math.pow(p.orbit,3));
  // A visible capture/influence zone: a modest fraction of each planet's Hill radius.
  function anglesAt(absoluteDay){return Object.fromEntries(planets.map(p=>[p.key,p.phase+meanMotion(p)*absoluteDay]));}
  function bodyPositions(absoluteDay){const a=anglesAt(absoluteDay);return Object.fromEntries(planets.map(p=>[p.key,orbitalPosition(p,a[p.key])]));}
  function acceleration(x,y,z,t){let ax=0,ay=0,az=0;const r=Math.max(Math.hypot(x,y,z),3),g=SUN_GM/(r*r*r);ax-=g*x;ay-=g*y;az-=g*z;const bodies=bodyPositions(state.epochDay+t);for(const p of planets){const b=bodies[p.key],dx=x-b.x,dy=y-b.y,dz=z-b.z,d=Math.max(Math.hypot(dx,dy,dz),Math.max(1.2,p.radius*.35)),f=p.gm/(d*d*d);ax-=f*dx;ay-=f*dy;az-=f*dz;}return{x:ax,y:ay,z:az};}
  function integrate(s,dt,t){const deriv=(q,tt)=>{const a=acceleration(q.x,q.y,q.z,tt);return{x:q.vx,y:q.vy,z:q.vz,vx:a.x,vy:a.y,vz:a.z};};const add=(q,k,f)=>({x:q.x+k.x*f,y:q.y+k.y*f,z:q.z+k.z*f,vx:q.vx+k.vx*f,vy:q.vy+k.vy*f,vz:q.vz+k.vz*f});const k1=deriv(s,t),k2=deriv(add(s,k1,dt/2),t+dt/2),k3=deriv(add(s,k2,dt/2),t+dt/2),k4=deriv(add(s,k3,dt),t+dt);for(const key of ['x','y','z','vx','vy','vz'])s[key]+=dt/6*(k1[key]+2*k2[key]+2*k3[key]+k4[key]);}
  function initialShip(){const day=+$('startDay').value,start=planets.find(p=>p.key===$('startPlanet').value)||planets[2],angle=start.phase+meanMotion(start)*day,planetPos=orbitalPosition(start,angle),eps=.01,pa=orbitalPosition(start,start.phase+meanMotion(start)*(day-eps)),pb=orbitalPosition(start,start.phase+meanMotion(start)*(day+eps)),planetVel=pb.sub(pa).multiplyScalar(1/(2*eps));const radial=planetPos.clone().normalize(),normal=radial.clone().cross(planetVel).normalize(),prograde=normal.clone().cross(radial).normalize(),physicalRadius=({mercury:2439.7,venus:6051.8,earth:6371,mars:3389.5,jupiter:69911,saturn:58232,uranus:25362,neptune:24622}[start.key]||6371)*KM_SCALE,r=physicalRadius+(+$('orbitAlt').value)*KM_SCALE,v=Math.sqrt(start.gm/r);return{x:planetPos.x+radial.x*r,y:planetPos.y+radial.y*r,z:planetPos.z+radial.z*r,vx:planetVel.x+prograde.x*v,vy:planetVel.y+prograde.y*v,vz:planetVel.z+prograde.z*v};}
  function setAimPrecision(distance,radius){const miss=Math.max(0,distance-radius),mode=$('difficulty').value;const step=mode==='hard'?1:mode==='medium'?(miss<1?0.05:miss<10?0.2:1):(miss<0.25?0.0001:miss<1?0.0005:miss<3?0.002:miss<10?0.01:miss<30?0.05:miss<100?0.15:0.5);$('trajectory').step=String(step);$('elevation').step=String(step);}
  function updatePrediction(){
    if(state.phase==='setup')state.epochDay=+$('startDay').value;
    const s=state.phase==='setup'?initialShip():{...state.ship},points=[],startT=state.phase==='setup'?0:state.time;
    if(state.phase==='editing'||state.phase==='aiming'){
      const velocity=new THREE.Vector3(s.vx,s.vy,s.vz),prograde=velocity.lengthSq()>1e-10?velocity.clone().normalize():new THREE.Vector3(1,0,0),radial=new THREE.Vector3(s.x,0,s.z).lengthSq()>1e-10?new THREE.Vector3(s.x,0,s.z).normalize():new THREE.Vector3(1,0,0),az=THREE.MathUtils.degToRad(+$('trajectory').value),el=THREE.MathUtils.degToRad(+$('elevation').value),d=prograde.multiplyScalar(Math.cos(az)*Math.cos(el)).add(radial.multiplyScalar(Math.sin(az)*Math.cos(el))).add(new THREE.Vector3(0,Math.sin(el),0)).normalize(),dv=+$('impulse').value;
      s.vx+=d.x*dv;s.vy+=d.y*dv;s.vz+=d.z*dv;
    }
    const target=planets.find(p=>p.key===$('targetPlanet').value)||planets[3];let best={distance:Infinity,t:0,pos:null,ship:null};
    for(let i=0;i<1250;i++){
      const t=i*STEP*4;points.push(new THREE.Vector3(s.x,s.y,s.z));
      const targetPos=orbitalPosition(target, target.phase+meanMotion(target)*(state.epochDay+startT+t));
      const distance=Math.hypot(s.x-targetPos.x,s.y-targetPos.y,s.z-targetPos.z);
      if(distance<best.distance)best={distance,t,pos:targetPos.clone(),ship:new THREE.Vector3(s.x,s.y,s.z)};
      for(let j=0;j<4;j++)integrate(s,STEP,startT+(i*4+j)*STEP);
    }
    prediction.geometry.dispose();prediction.geometry=new THREE.BufferGeometry().setFromPoints(points);prediction.computeLineDistances();
    if(best.pos){setAimPrecision(best.distance,captureRadius(target));targetMarker.position.copy(best.pos);targetMarker.visible=true;const status=$('targetStatus');if(status)status.textContent=(best.distance<captureRadius(target)?'Возможное попадание':'Ближайшее сближение')+' с '+target.name+': примерно через '+best.t.toFixed(1)+' дн., расстояние '+best.distance.toFixed(2)+' ед. масштаба. Крестик показывает положение планеты в этот момент.';}
  }
  function updateHud(){$('hud-speed').textContent=Math.hypot(state.ship.vx,state.ship.vy,state.ship.vz).toFixed(3);$('hud-time').textContent=Math.floor(state.time)+' дн.';$('hud-dv').textContent=state.totalDv.toFixed(2)+' / '+state.fuel.toFixed(2);}
  function resize(){const w=canvas.clientWidth||640,h=canvas.clientHeight||400;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  new ResizeObserver(resize).observe(canvas);resize();
  function updatePlanetPositions(absoluteDay){const a=anglesAt(absoluteDay);for(const p of planets){const v=orbitalPosition(p,a[p.key]),o=planetMeshes[p.key];o.mesh.position.copy(v);o.label.position.copy(v).add(new THREE.Vector3(0,p.radius+40,0));captureFields[p.key].position.copy(v);}for(const m of moonMeshes){const d=m.data,parent=planetMeshes[d.parent].mesh.position,angle=d.phase+absoluteDay*d.rate,pos=new THREE.Vector3(parent.x+Math.cos(angle)*d.distance, parent.y+Math.sin(angle)*d.distance*.22, parent.z+Math.sin(angle)*d.distance);m.mesh.position.copy(pos);m.label.position.copy(pos).add(new THREE.Vector3(0,d.size+1.5,0));}}
  function refreshTrail(){trail.geometry.dispose();trail.geometry=new THREE.BufferGeometry().setFromPoints(state.trail.map(p=>new THREE.Vector3(p.x,p.y,p.z)));}
  function finishFlight(won,message){state.phase=won?'won':'lost';$('resultText').className=won?'win':'lose';$('resultText').textContent=message;$('result-panel').classList.remove('hidden');}
  function checkPlanetCollision(){const day=state.epochDay+state.time,prevDay=day-STEP,targetKey=$('targetPlanet').value,prev=state.previousShip||state.ship;for(const p of planets){const b=orbitalPosition(p,p.phase+meanMotion(p)*day),bp=orbitalPosition(p,p.phase+meanMotion(p)*prevDay),dx=state.ship.x-b.x,dy=state.ship.y-b.y,dz=state.ship.z-b.z,d=Math.hypot(dx,dy,dz),zone=captureRadius(p);const rx=prev.x-bp.x,ry=prev.y-bp.y,rz=prev.z-bp.z,vx=dx-rx,vy=dy-ry,vz=dz-rz,v2=vx*vx+vy*vy+vz*vz,u=v2>1e-16?Math.max(0,Math.min(1,-(rx*vx+ry*vy+rz*vz)/v2)):1,closest=Math.hypot(rx+vx*u,ry+vy*u,rz+vz*u);if(d>zone||closest>zone)state.captureArmed[p.key]=true;if(p.key===targetKey&&state.captureArmed[p.key]&&Math.min(d,closest)<=zone){finishFlight(true,'Попадание! КА достиг зоны захвата планеты '+p.name+'. Полёт завершён.');return true;}if(p.key!==$('startPlanet').value&&d<p.radius+0.0002){if(p.key===targetKey)finishFlight(true,'Попадание! КА достиг планеты '+p.name+'.');else finishFlight(false,'КА потерян: столкновение с планетой '+p.name+'.');return true;}}return false;}
  const cameraOffset=new THREE.Vector3(0,220,580);
  function currentFocusPosition(){if(state.cameraFocus==='free')return null;const day=(state.phase==='setup'||state.phase==='aiming')?+$('startDay').value:state.epochDay+state.time;if(state.cameraFocus==='target'){const tp=planets.find(p=>p.key===$('targetPlanet').value)||planets[3];return orbitalPosition(tp,tp.phase+meanMotion(tp)*day);}const q=(state.phase==='setup'||state.phase==='aiming')?state.ship||initialShip():state.ship;return new THREE.Vector3(q.x,q.y,q.z);}
  function snapCameraToFocus(){const focus=currentFocusPosition();if(!focus)return;const offset=(state.phase==='setup'||state.phase==='aiming')?new THREE.Vector3(0,60,140):cameraOffset;controls.target.copy(focus);camera.position.copy(focus).add(offset);controls.update();}

  function loop(){requestAnimationFrame(loop);if(state.phase==='flying'){const steps=Math.min(40,Math.round(state.timeScale*4));for(let i=0;i<steps;i++){state.previousShip={...state.ship};if(state.time<3){const h=STEP/10;for(let j=0;j<10;j++)integrate(state.ship,h,state.time+j*h);}else integrate(state.ship,STEP,state.time);state.time+=STEP;if(checkPlanetCollision())break;if(Math.hypot(state.ship.x,state.ship.y,state.ship.z)>80000){finishFlight(false,'КА потерян: аппарат покинул пределы моделируемой системы.');break;}}state.trail.push({...state.ship});if(state.trail.length>4000)state.trail.shift();refreshTrail();updateHud();if(state.phase==='flying'&&state.time>+$('timeLimit').value)finishFlight(false,'КА потерян: время полёта истекло.');}
    updatePlanetPositions((state.phase==='setup'||state.phase==='aiming')?+$('startDay').value:state.epochDay+state.time);const s=(state.phase==='setup'||state.phase==='aiming')?(state.ship||initialShip()):state.ship;ship.position.set(s.x,s.y,s.z);{const focusPos=currentFocusPosition();if(focusPos){const delta=focusPos.clone().sub(controls.target);camera.position.add(delta);controls.target.copy(focusPos);}}controls.update();renderer.render(scene,camera);if(window.__hideFallbackSolarScene)window.__hideFallbackSolarScene();}
  function showTab(which){$('setup-params').classList.toggle('hidden',which!=='params');$('impulse-controls').classList.toggle('hidden',which!=='impulse');$('paramsTab').classList.toggle('active',which==='params');$('impulseTab').classList.toggle('active',which==='impulse');}
  const dateToDay=value=>{const d=new Date(value+'T00:00:00Z'),epoch=Date.UTC(2026,0,1);return Math.max(0,Math.min(1000,Math.round((d.getTime()-epoch)/86400000)));};
  $('startDate').addEventListener('change',()=>{$('startDay').value=dateToDay($('startDate').value);state.epochDay=+$('startDay').value;if(state.phase==='setup')updatePrediction();});
  const orbitRanges={mercury:[200,10000],venus:[200,10000],earth:[200,35786],mars:[200,17000],jupiter:[1000,500000],saturn:[1000,500000],uranus:[1000,300000],neptune:[1000,300000]};
  function updateMissionOptions(){const start=$('startPlanet').value,target=$('targetPlanet');if(target.value===start){const next=planets.find(p=>p.key!==start);target.value=next.key;}const range=orbitRanges[start]||orbitRanges.earth,orbit=$('orbitAlt');orbit.min=range[0];orbit.max=range[1];orbit.step=range[0]>=1000?100:10;orbit.value=Math.min(range[1],Math.max(range[0],+$('orbitAlt').value));$('orbitAltVal').textContent=orbit.value;$('autoAimBtn').classList.toggle('hidden',$('difficulty').value!=='easy');target.querySelectorAll('option').forEach(o=>o.disabled=o.value===start);if(state.phase==='setup')updatePrediction();}
  $('startPlanet').addEventListener('change',updateMissionOptions);$('difficulty').addEventListener('change',updateMissionOptions);
  $('paramsTab').addEventListener('click',()=>showTab('params'));
  $('impulseTab').addEventListener('click',()=>{showTab('impulse');if(state.phase==='aiming'){$('trajectoryEditActions').classList.remove('hidden');$('applyImpulseBtn').textContent='Запустить КА';updatePrediction();}else if(state.phase==='flying'||state.phase==='editing'){$('setup-panel').classList.remove('hidden');state.phase='editing';$('trajectoryEditActions').classList.remove('hidden');const remaining=Math.max(0,state.fuel-state.totalDv);$('impulse').max=remaining.toFixed(2);$('impulse').value=Math.min(+$('impulse').value,remaining).toFixed(2);$('impulseVal').textContent=(+$('impulse').value).toFixed(2);$('fuelPreview').textContent=(+$('impulse').value).toFixed(2)+' ΔV';updatePrediction();}else{ $('trajectoryEditActions').classList.add('hidden');updatePrediction();}});
  function aimVector(q,azDeg,elDeg){const velocity=new THREE.Vector3(q.vx,q.vy,q.vz),pro=velocity.lengthSq()>1e-10?velocity.normalize():new THREE.Vector3(1,0,0),radial=new THREE.Vector3(q.x,0,q.z).lengthSq()>1e-10?new THREE.Vector3(q.x,0,q.z).normalize():new THREE.Vector3(1,0,0),az=THREE.MathUtils.degToRad(azDeg),el=THREE.MathUtils.degToRad(elDeg);return pro.multiplyScalar(Math.cos(az)*Math.cos(el)).add(radial.multiplyScalar(Math.sin(az)*Math.cos(el))).add(new THREE.Vector3(0,1,0).multiplyScalar(Math.sin(el))).normalize();}
  function autoAim(){
    const target=planets.find(p=>p.key===$('targetPlanet').value)||planets[3],dv=+$('impulse').value;
    let base;
    if(state.phase==='flying'||state.phase==='editing') base={...state.ship};
    else {base=initialShip();}
    const start=state.phase==='flying'||state.phase==='editing'?state.time:0;
    let best={score:Infinity,az:0,el:0};
    function test(az,el){
      const d=aimVector(base,az,el),q={...base,vx:base.vx+d.x*dv,vy:base.vy+d.y*dv,vz:base.vz+d.z*dv};
      let score=Infinity,bestDay=0;
      for(let i=0;i<3600;i++){
        const t=start+i*.5,tp=orbitalPosition(target,target.phase+meanMotion(target)*(state.epochDay+t));
        const dist=Math.hypot(q.x-tp.x,q.y-tp.y,q.z-tp.z);
        if(dist<score){score=dist;bestDay=t;}
        integrate(q,.5,start+i*.5);
        if(Math.hypot(q.x,q.y,q.z)>80000)break;
      }
      if(score<best.score)best={score,az,el,day:bestDay};
    }
    for(let az=-180;az<=180;az+=30)for(let el=-90;el<=90;el+=30)test(az,el);
    let center={...best};
    for(let az=center.az-25;az<=center.az+25;az+=5)for(let el=Math.max(-90,center.el-25);el<=Math.min(90,center.el+25);el+=5)test(az,el);
    center={...best};
    for(let az=center.az-5;az<=center.az+5;az+=1)for(let el=Math.max(-90,center.el-5);el<=Math.min(90,center.el+5);el+=1)test(az,el);
    $('trajectory').value=best.az;$('elevation').value=best.el;
    $('trajectory').dispatchEvent(new Event('input',{bubbles:true}));
    $('targetStatus').textContent='Автонаводка рассчитала перехват движущейся планеты: ближайшее сближение через '+best.day.toFixed(0)+' дн., промах '+best.score.toFixed(3)+' (радиус зоны захвата '+captureRadius(target).toFixed(3)+').';
    updatePrediction();
  }
  $('autoAimBtn').addEventListener('click',()=>{if(!window.__solarModuleReady||$('difficulty').value!=='easy') return;autoAim();});
  $('focusShipBtn').addEventListener('click',()=>{state.cameraFocus='ship';snapCameraToFocus();});
  $('focusTargetBtn').addEventListener('click',()=>{state.cameraFocus='target';snapCameraToFocus();});$('freeCameraBtn').addEventListener('click',()=>{state.cameraFocus='free';});
  $('launchBtn').addEventListener('click',()=>{state.epochDay=+$('startDay').value;state.time=0;state.fuel=+$('fuel').value;state.totalDv=0;state.ship=initialShip();state.phase='aiming';state.cameraFocus='ship';state.captureArmed={};state.previousShip={...state.ship};state.trail=[{...state.ship}];$('impulse').max=state.fuel.toFixed(2);showTab('impulse');$('setup-params').classList.add('hidden');$('setup-panel').classList.remove('hidden');$('impulse-controls').classList.remove('hidden');$('trajectoryEditActions').classList.remove('hidden');$('applyImpulseBtn').textContent='Запустить КА';$('impulseHeading').textContent='Начальная траектория — время остановлено';$('flight-panel').classList.remove('hidden');$('launchBtn').disabled=true;snapCameraToFocus();updateHud();updatePrediction();});
  window.__solarModuleLaunchBound=true;
  $('restartBtn').addEventListener('click',()=>{$('impulse').max='20.00';state.phase='setup';state.time=0;state.totalDv=0;state.fuel=+$('fuel').value;state.captureArmed={};state.trail=[];state.epochDay=+$('startDay').value;state.ship=initialShip();$('setup-panel').classList.remove('hidden');$('flight-panel').classList.add('hidden');$('result-panel').classList.add('hidden');$('launchBtn').disabled=false;$('trajectoryEditActions').classList.add('hidden');$('applyImpulseBtn').textContent='Запустить КА';$('impulseHeading').textContent='Начальная траектория — время остановлено';state.cameraFocus='ship';snapCameraToFocus();updateHud();updatePrediction();});
  document.querySelectorAll('.tsBtn').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tsBtn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');state.timeScale=+btn.dataset.ts;}));
  function updateLabels(){const angle=+$('trajectory').value,elevation=+$('elevation').value,dv=+$('impulse').value;$('trajectoryVal').textContent=angle+'°';$('elevationVal').textContent=elevation+'°';$('impulseVal').textContent=dv.toFixed(2);$('fuelPreview').textContent=dv.toFixed(2)+' ΔV';if(state.phase==='setup'||state.phase==='editing')updatePrediction();}
  ['startDay','orbitAlt','trajectory','elevation','impulse'].forEach(id=>$(id).addEventListener('input',()=>{const label=$(id+'Val');if(label&&id==='startDay')label.textContent=$('startDay').value;if(label&&id==='orbitAlt')label.textContent=$('orbitAlt').value;updateLabels();}));
  $('fuel').addEventListener('input',()=>{$('fuelVal').textContent=(+$('fuel').value).toFixed(2);state.fuel=+$('fuel').value;updateHud();});
  $('timeLimit').addEventListener('input',()=>$('timeLimitVal').textContent=$('timeLimit').value);
  $('targetPlanet').addEventListener('change',()=>{if(state.phase==='setup'||state.phase==='editing')updatePrediction();else updatePrediction();});
  $('applyImpulseBtn').addEventListener('click',()=>{const dv=+$('impulse').value;if(state.totalDv+dv>state.fuel+1e-8){$('impulseHint').textContent='Недостаточно топлива для коррекции.';return;}if(state.phase!=='aiming'&&state.phase!=='editing')return;const velocity=new THREE.Vector3(state.ship.vx,state.ship.vy,state.ship.vz),prograde=velocity.lengthSq()>1e-10?velocity.clone().normalize():new THREE.Vector3(1,0,0),radial=new THREE.Vector3(state.ship.x,0,state.ship.z).normalize(),az=THREE.MathUtils.degToRad(+$('trajectory').value),el=THREE.MathUtils.degToRad(+$('elevation').value),direction=prograde.clone().multiplyScalar(Math.cos(az)*Math.cos(el)).add(radial.clone().multiplyScalar(Math.sin(az)*Math.cos(el))).add(new THREE.Vector3(0,1,0).multiplyScalar(Math.sin(el))).normalize();state.ship.vx+=direction.x*dv;state.ship.vy+=direction.y*dv;state.ship.vz+=direction.z*dv;state.totalDv+=dv;state.trail=[{...state.ship}];state.phase='flying';state.captureArmed=Object.fromEntries(planets.map(p=>{const b=orbitalPosition(p,p.phase+meanMotion(p)*state.epochDay),dist=Math.hypot(state.ship.x-b.x,state.ship.y-b.y,state.ship.z-b.z);return [p.key,dist>captureRadius(p)];}));$('applyImpulseBtn').textContent='Применить импульс';$('impulseHeading').textContent='Коррекция траектории';$('trajectoryEditActions').classList.add('hidden');$('setup-panel').classList.add('hidden');$('impulseHint').textContent='Импульс применён. Можно продолжить полёт или задать новую коррекцию.';updateHud();updatePrediction();});
  $('cancelImpulseBtn').addEventListener('click',()=>{if(state.phase==='aiming'){state.phase='setup';$('flight-panel').classList.add('hidden');$('setup-params').classList.remove('hidden');$('impulse-controls').classList.add('hidden');$('launchBtn').disabled=false;$('applyImpulseBtn').textContent='Запустить КА';document.body.classList.remove('game-screen');document.body.classList.add('mission-screen');snapCameraToFocus();updatePrediction();return;}if(state.phase==='editing')state.phase='flying';$('impulse').max='20.00';$('trajectoryEditActions').classList.add('hidden');$('setup-panel').classList.add('hidden');updatePrediction();});
  state.fuel=+$('fuel').value;state.epochDay=+$('startDay').value;updateMissionOptions();state.ship=initialShip();state.cameraFocus='ship';updatePlanetPositions(state.epochDay);snapCameraToFocus();updateLabels();updateHud();updatePrediction();window.__solarModuleReady=true;loop();
})();
