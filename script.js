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
  const EARTH_RADIUS = 5;
  const KM_SCALE = EARTH_RADIUS / 6371;
  const STEP = 0.25;
  const planets = [
    {key:'mercury',name:'Меркурий',orbit:38.7,inc:7,node:48.3,radius:1.6,gm:EARTH_GM*.0553,color:'#aaa39b',phase:1.1,type:'rocky'},
    {key:'venus',name:'Венера',orbit:72.3,inc:3.39,node:76.7,radius:3.9,gm:EARTH_GM*.815,color:'#d8b477',phase:2,type:'venus'},
    {key:'earth',name:'Земля',orbit:100,inc:0,node:0,radius:5,gm:EARTH_GM,color:'#438ee5',phase:0,type:'earth'},
    {key:'mars',name:'Марс',orbit:152.4,inc:1.85,node:49.6,radius:2.7,gm:EARTH_GM*.107,color:'#c85b43',phase:2.5,type:'mars'},
    {key:'jupiter',name:'Юпитер',orbit:520.4,inc:1.3,node:100.5,radius:11,gm:EARTH_GM*317.8,color:'#d5ad82',phase:.6,type:'jupiter'},
    {key:'saturn',name:'Сатурн',orbit:953.3,inc:2.49,node:113.7,radius:9,gm:EARTH_GM*95.2,color:'#d8c58d',phase:2.8,type:'saturn'},
    {key:'uranus',name:'Уран',orbit:1919,inc:.77,node:74, radius:3.8,gm:EARTH_GM*14.5,color:'#83d9df',phase:1.4,type:'uranus'},
    {key:'neptune',name:'Нептун',orbit:3006,inc:1.77,node:131,radius:3.7,gm:EARTH_GM*17.1,color:'#4777e8',phase:4.1,type:'neptune'}
  ];

  const canvas = $('game');
  if (!window.WebGLRenderingContext) { throw new Error('WebGL не поддерживается этим браузером'); }
  let renderer;
  try { renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:false}); }
  catch (error) { const box = $('runtime-error'); if (box) { box.hidden = false; box.textContent = 'Не удалось создать 3D-сцену: браузер не поддерживает WebGL или аппаратное ускорение отключено.'; } throw error; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x050510, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050510, 0.00008);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 10000);
  camera.position.set(0, 420, 900);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.zoomSpeed = 2.2;
  controls.dampingFactor = 0.065;
  controls.minDistance = 2;
  controls.maxDistance = 10000;
  controls.enablePan = true;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.AmbientLight(0x8998bb, 1.1));
  const sunLight = new THREE.PointLight(0xffffff, 2600, 0, 1.35);
  scene.add(sunLight);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(25, 48, 36), new THREE.MeshBasicMaterial({color:0xffc347}));
  scene.add(sun);
  const sunAura = new THREE.Mesh(new THREE.SphereGeometry(34, 32, 24), new THREE.MeshBasicMaterial({color:0xff9f26, transparent:true, opacity:.13, side:THREE.BackSide}));
  scene.add(sunAura);

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
  for(let i=0;i<2400;i++){const v=new THREE.Vector3().randomDirection().multiplyScalar(1750+Math.random()*1000);starPositions.push(v.x,v.y,v.z);}
  const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
  scene.add(new THREE.Points(starGeometry,new THREE.PointsMaterial({color:0xcbd8ff,size:1.5,sizeAttenuation:true})));

  function orbitalPosition(p, angle) {
    const inc=THREE.MathUtils.degToRad(p.inc), node=THREE.MathUtils.degToRad(p.node), c=Math.cos(angle), s=Math.sin(angle);
    return new THREE.Vector3(p.orbit*(Math.cos(node)*c-Math.sin(node)*s*Math.cos(inc)), p.orbit*s*Math.sin(inc), p.orbit*(Math.sin(node)*c+Math.cos(node)*s*Math.cos(inc)));
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
  // Major natural satellites of the gas/ice giants (illustrative scaled orbits).
  const moonData=[
    {name:'Ио',parent:'jupiter',distance:16,size:1.15,rate:.20,phase:0,color:0xe8d59a},
    {name:'Европа',parent:'jupiter',distance:20,size:1.0,rate:.13,phase:1.7,color:0xd8c9ad},
    {name:'Ганимед',parent:'jupiter',distance:25,size:1.25,rate:.085,phase:3.1,color:0x9e9585},
    {name:'Каллисто',parent:'jupiter',distance:32,size:1.1,rate:.055,phase:4.4,color:0x817c78},
    {name:'Титан',parent:'saturn',distance:20,size:1.25,rate:.075,phase:1.1,color:0xd6a65b},
    {name:'Рея',parent:'saturn',distance:14,size:.75,rate:.12,phase:2.6,color:0xbcb9b1},
    {name:'Энцелад',parent:'saturn',distance:11,size:.55,rate:.17,phase:4.6,color:0xe9f1ef},
    {name:'Титания',parent:'uranus',distance:11,size:.7,rate:.09,phase:.7,color:0xc1d5d7},
    {name:'Тритон',parent:'neptune',distance:11,size:.8,rate:-.10,phase:2.2,color:0xc9d6e7}
  ];
  const moonMeshes=moonData.map(m=>{const mesh=new THREE.Mesh(new THREE.SphereGeometry(m.size,20,16),new THREE.MeshStandardMaterial({color:m.color,roughness:1}));scene.add(mesh);const c=document.createElement('canvas');c.width=192;c.height=48;const x=c.getContext('2d');x.font='22px system-ui';x.fillStyle='#f2f4ff';x.shadowColor='#000';x.shadowBlur=4;x.fillText(m.name,4,32);const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false}));label.scale.set(15,3.75,1);scene.add(label);return{data:m,mesh,label};});
  const shipMaterial=new THREE.MeshStandardMaterial({color:0x8cecff,emissive:0x15506b,metalness:.45,roughness:.3});
  const ship=new THREE.Mesh(new THREE.ConeGeometry(1.7,7,14),shipMaterial);ship.rotation.x=Math.PI/2;scene.add(ship);
  const shipLight=new THREE.PointLight(0x4bd7ff,4,25);ship.add(shipLight);
  const trail=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x58e7ff,transparent:true,opacity:.8}));scene.add(trail);
  const prediction=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:0xffd779,dashSize:3,gapSize:2,transparent:true,opacity:.85}));scene.add(prediction);
  const targetMarker=new THREE.Group();
  const markerMaterial=new THREE.LineBasicMaterial({color:0xffe58a,depthTest:false,transparent:true,opacity:.98});
  for(const axis of [new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)]){const pts=[axis.clone().multiplyScalar(-7),axis.clone().multiplyScalar(7)];targetMarker.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),markerMaterial));}
  targetMarker.add(new THREE.Mesh(new THREE.SphereGeometry(2.2,12,8),new THREE.MeshBasicMaterial({color:0xffe58a,wireframe:true,depthTest:false})));targetMarker.visible=false;scene.add(targetMarker);

  const state={phase:'setup',time:0,epochDay:300,ship:{x:100,y:0,z:0,vx:0,vy:0,vz:0},trail:[],totalDv:0,fuel:1.5,timeScale:1};
  const meanMotion=p=>Math.sqrt(SUN_GM/Math.pow(p.orbit,3));
  function anglesAt(absoluteDay){return Object.fromEntries(planets.map(p=>[p.key,p.phase+meanMotion(p)*absoluteDay]));}
  function bodyPositions(absoluteDay){const a=anglesAt(absoluteDay);return Object.fromEntries(planets.map(p=>[p.key,orbitalPosition(p,a[p.key])]));}
  function acceleration(x,y,z,t){let ax=0,ay=0,az=0;const r=Math.max(Math.hypot(x,y,z),3),g=SUN_GM/(r*r*r);ax-=g*x;ay-=g*y;az-=g*z;const bodies=bodyPositions(state.epochDay+t);for(const p of planets){const b=bodies[p.key],dx=x-b.x,dy=y-b.y,dz=z-b.z,d=Math.max(Math.hypot(dx,dy,dz),Math.max(1.2,p.radius*.35)),f=p.gm/(d*d*d);ax-=f*dx;ay-=f*dy;az-=f*dz;}return{x:ax,y:ay,z:az};}
  function integrate(s,dt,t){const deriv=(q,tt)=>{const a=acceleration(q.x,q.y,q.z,tt);return{x:q.vx,y:q.vy,z:q.vz,vx:a.x,vy:a.y,vz:a.z};};const add=(q,k,f)=>({x:q.x+k.x*f,y:q.y+k.y*f,z:q.z+k.z*f,vx:q.vx+k.vx*f,vy:q.vy+k.vy*f,vz:q.vz+k.vz*f});const k1=deriv(s,t),k2=deriv(add(s,k1,dt/2),t+dt/2),k3=deriv(add(s,k2,dt/2),t+dt/2),k4=deriv(add(s,k3,dt),t+dt);for(const key of ['x','y','z','vx','vy','vz'])s[key]+=dt/6*(k1[key]+2*k2[key]+2*k3[key]+k4[key]);}
  function initialShip(){const day=+$('startDay').value,a=planets[2].phase+meanMotion(planets[2])*day,earth=orbitalPosition(planets[2],a),radial=new THREE.Vector3(Math.cos(a),0,Math.sin(a)),prograde=new THREE.Vector3(-Math.sin(a),0,Math.cos(a)),r=EARTH_RADIUS+(+$('orbitAlt').value)*KM_SCALE,v=Math.sqrt(EARTH_GM/r),az=THREE.MathUtils.degToRad(+$('trajectory').value),el=THREE.MathUtils.degToRad(+$('elevation').value),direction=prograde.clone().multiplyScalar(Math.cos(az)*Math.cos(el)).add(radial.clone().multiplyScalar(Math.sin(az)*Math.cos(el))).add(new THREE.Vector3(0,Math.sin(el),0)).normalize(),base=prograde.clone().multiplyScalar(Math.sqrt(SUN_GM/100)),dv=+$('impulse').value;return{x:earth.x+radial.x*r,y:earth.y,z:earth.z+radial.z*r,vx:base.x+prograde.x*v+direction.x*dv,vy:direction.y*dv,vz:base.z+prograde.z*v+direction.z*dv};}
  function updatePrediction(){
    if(state.phase==='setup')state.epochDay=+$('startDay').value;
    const s=state.phase==='setup'?initialShip():{...state.ship},points=[],startT=state.phase==='setup'?0:state.time;
    if(state.phase==='editing'){
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
    if(best.pos){targetMarker.position.copy(best.pos);targetMarker.visible=true;const status=$('targetStatus');if(status)status.textContent=(best.distance<target.radius+2?'Возможное попадание':'Ближайшее сближение')+' с '+target.name+': примерно через '+best.t.toFixed(1)+' дн., расстояние '+best.distance.toFixed(2)+' ед. масштаба. Крестик показывает положение планеты в этот момент.';}
  }
  function updateHud(){$('hud-speed').textContent=Math.hypot(state.ship.vx,state.ship.vy,state.ship.vz).toFixed(3);$('hud-time').textContent=Math.floor(state.time)+' дн.';$('hud-dv').textContent=state.totalDv.toFixed(2)+' / '+state.fuel.toFixed(2);}
  function resize(){const w=canvas.clientWidth||640,h=canvas.clientHeight||400;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  new ResizeObserver(resize).observe(canvas);resize();
  function updatePlanetPositions(absoluteDay){const a=anglesAt(absoluteDay);for(const p of planets){const v=orbitalPosition(p,a[p.key]),o=planetMeshes[p.key];o.mesh.position.copy(v);o.label.position.copy(v).add(new THREE.Vector3(0,p.radius+4,0));}for(const m of moonMeshes){const d=m.data,parent=planetMeshes[d.parent].mesh.position,angle=d.phase+absoluteDay*d.rate,pos=new THREE.Vector3(parent.x+Math.cos(angle)*d.distance, parent.y+Math.sin(angle)*d.distance*.22, parent.z+Math.sin(angle)*d.distance);m.mesh.position.copy(pos);m.label.position.copy(pos).add(new THREE.Vector3(0,d.size+1.5,0));}}
  function refreshTrail(){trail.geometry.dispose();trail.geometry=new THREE.BufferGeometry().setFromPoints(state.trail.map(p=>new THREE.Vector3(p.x,p.y,p.z)));}
  function finishFlight(won,message){state.phase=won?'won':'lost';$('resultText').className=won?'win':'lose';$('resultText').textContent=message;$('result-panel').classList.remove('hidden');}
  function checkPlanetCollision(){const day=state.epochDay+state.time,targetKey=$('targetPlanet').value;for(const p of planets){const b=orbitalPosition(p,p.phase+meanMotion(p)*day),d=Math.hypot(state.ship.x-b.x,state.ship.y-b.y,state.ship.z-b.z);if(d<p.radius+1.8){if(p.key===targetKey)finishFlight(true,'КА достиг точки назначения: '+p.name+'.');else finishFlight(false,'КА потерян: столкновение с планетой '+p.name+'.');return true;}}return false;}
  const cameraOffset=new THREE.Vector3(0,22,58);
  function loop(){requestAnimationFrame(loop);if(state.phase==='flying'){const steps=Math.min(40,Math.round(state.timeScale*4));for(let i=0;i<steps;i++){integrate(state.ship,STEP,state.time);state.time+=STEP;if(checkPlanetCollision())break;if(Math.hypot(state.ship.x,state.ship.y,state.ship.z)>2500){finishFlight(false,'КА потерян: аппарат покинул пределы моделируемой системы.');break;}}state.trail.push({...state.ship});if(state.trail.length>4000)state.trail.shift();refreshTrail();updateHud();if(state.phase==='flying'&&state.time>+$('timeLimit').value)finishFlight(false,'КА потерян: время полёта истекло.');}
    updatePlanetPositions(state.phase==='setup'?+$('startDay').value:state.epochDay+state.time);const s=state.phase==='setup'?initialShip():state.ship;ship.position.set(s.x,s.y,s.z);if(state.phase==='flying'||state.phase==='editing'){const targetPos=new THREE.Vector3(s.x,s.y,s.z),delta=targetPos.clone().sub(controls.target);camera.position.add(delta);controls.target.copy(targetPos);}controls.update();renderer.render(scene,camera);if(window.__hideFallbackSolarScene)window.__hideFallbackSolarScene();}
  function showTab(which){$('setup-params').classList.toggle('hidden',which!=='params');$('impulse-controls').classList.toggle('hidden',which!=='impulse');$('paramsTab').classList.toggle('active',which==='params');$('impulseTab').classList.toggle('active',which==='impulse');}
  $('paramsTab').addEventListener('click',()=>showTab('params'));
  $('impulseTab').addEventListener('click',()=>{showTab('impulse');if(state.phase==='flying'||state.phase==='editing'){state.phase='editing';$('trajectoryEditActions').classList.remove('hidden');const remaining=Math.max(0,state.fuel-state.totalDv);$('impulse').max=remaining.toFixed(2);$('impulse').value=Math.min(+$('impulse').value,remaining).toFixed(2);$('impulseVal').textContent=(+$('impulse').value).toFixed(2);$('fuelPreview').textContent=(+$('impulse').value).toFixed(2)+' ΔV';updatePrediction();}else{ $('trajectoryEditActions').classList.add('hidden');updatePrediction();}});
  $('launchBtn').addEventListener('click',()=>{$('impulse').max='4.00';const dv=+$('impulse').value;if(dv>state.fuel+1e-8){$('impulseHint').textContent='Недостаточно топлива для выбранного импульса.';showTab('impulse');return;}state.epochDay=+$('startDay').value;state.ship=initialShip();state.time=0;state.totalDv=dv;state.phase='flying';cameraOffset.set(0,22,58);controls.target.set(state.ship.x,state.ship.y,state.ship.z);camera.position.set(state.ship.x,state.ship.y+cameraOffset.y,state.ship.z+cameraOffset.z);state.trail=[{...state.ship}];$('setup-panel').classList.add('hidden');$('flight-panel').classList.remove('hidden');$('launchBtn').disabled=true;updateHud();});
  $('restartBtn').addEventListener('click',()=>{$('impulse').max='4.00';state.phase='setup';state.time=0;state.totalDv=0;state.fuel=+$('fuel').value;state.trail=[];state.epochDay=+$('startDay').value;state.ship=initialShip();$('setup-panel').classList.remove('hidden');$('flight-panel').classList.add('hidden');$('result-panel').classList.add('hidden');$('launchBtn').disabled=false;$('trajectoryEditActions').classList.add('hidden');controls.target.set(0,0,0);camera.position.set(0,420,900);updateHud();updatePrediction();});
  document.querySelectorAll('.tsBtn').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tsBtn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');state.timeScale=+btn.dataset.ts;}));
  function updateLabels(){const angle=+$('trajectory').value,elevation=+$('elevation').value,dv=+$('impulse').value;$('trajectoryVal').textContent=angle+'°';$('elevationVal').textContent=elevation+'°';$('impulseVal').textContent=dv.toFixed(2);$('fuelPreview').textContent=dv.toFixed(2)+' ΔV';if(state.phase==='setup'||state.phase==='editing')updatePrediction();}
  ['startDay','orbitAlt','trajectory','elevation','impulse'].forEach(id=>$(id).addEventListener('input',()=>{const label=$(id+'Val');if(label&&id==='startDay')label.textContent=$('startDay').value;if(label&&id==='orbitAlt')label.textContent=$('orbitAlt').value;updateLabels();}));
  $('fuel').addEventListener('input',()=>{$('fuelVal').textContent=(+$('fuel').value).toFixed(2);state.fuel=+$('fuel').value;updateHud();});
  $('timeLimit').addEventListener('input',()=>$('timeLimitVal').textContent=$('timeLimit').value);
  $('targetPlanet').addEventListener('change',()=>{if(state.phase==='setup'||state.phase==='editing')updatePrediction();else updatePrediction();});
  $('applyImpulseBtn').addEventListener('click',()=>{const dv=+$('impulse').value;if(state.totalDv+dv>state.fuel+1e-8){$('impulseHint').textContent='Недостаточно топлива для коррекции.';return;}const velocity=new THREE.Vector3(state.ship.vx,state.ship.vy,state.ship.vz),prograde=velocity.lengthSq()>1e-10?velocity.clone().normalize():new THREE.Vector3(1,0,0),radial=new THREE.Vector3(state.ship.x,0,state.ship.z).normalize(),az=THREE.MathUtils.degToRad(+$('trajectory').value),el=THREE.MathUtils.degToRad(+$('elevation').value),direction=prograde.clone().multiplyScalar(Math.cos(az)*Math.cos(el)).add(radial.clone().multiplyScalar(Math.sin(az)*Math.cos(el))).add(new THREE.Vector3(0,1,0).multiplyScalar(Math.sin(el))).normalize();state.ship.vx+=direction.x*dv;state.ship.vy+=direction.y*dv;state.ship.vz+=direction.z*dv;state.totalDv+=dv;state.trail=[{...state.ship}];state.phase='flying';$('trajectoryEditActions').classList.add('hidden');$('impulseHint').textContent='Импульс применён. Можно продолжить полёт или задать новую коррекцию.';updateHud();updatePrediction();});
  $('cancelImpulseBtn').addEventListener('click',()=>{if(state.phase==='editing')state.phase='flying';$('impulse').max='4.00';$('trajectoryEditActions').classList.add('hidden');updatePrediction();});
  state.fuel=+$('fuel').value;state.epochDay=+$('startDay').value;state.ship=initialShip();updateLabels();updateHud();updatePrediction();window.__solarModuleReady=true;loop();
})();
