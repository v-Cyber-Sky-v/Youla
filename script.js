(() => {
  'use strict';
  const GM = 100;                       // гравитационный параметр Солнца
  const SUN_RADIUS = 10;                // радиус Солнца
  const EARTH_RADIUS = 5;                 // визуальный радиус Земли (не меняем для сохранения пропорций)
  const EARTH_RADIUS_KM = 6371;
  const MIN_PARKING_ALT_KM = 200;
  const MAX_PARKING_ALT_KM = 35786;       // геостационарная орбита
  const EARTH_GM = 0.3518;                // нормировано так, чтобы орбитальные скорости были близки к реальным
  const MARS_GM = EARTH_GM * 0.107;       // отношение масс Марса и Земли
  const KM_TO_WORLD = EARTH_RADIUS / EARTH_RADIUS_KM;
  const EARTH_ORBIT = 100;
  const MARS_ORBIT = 160;
  const EARTH_OMEGA = Math.sqrt(GM / Math.pow(EARTH_ORBIT, 3)); // 0.01
  const MARS_OMEGA  = Math.sqrt(GM / Math.pow(MARS_ORBIT, 3));  // ~0.00494
  const MARS_START_ANGLE = 2.5;         // чтобы идеальный день был ~328
  const CAPTURE_RADIUS = 22;            // радиус зоны успеха у Марса
  const THRUST_AMOUNT = 0.02;           // ΔV одного нажатия коррекции
  const HOHMANN_DV = 0.1094;            // идеальный импульс перелёта
  const WORLD_VIEW = 350;               // сколько единиц мира влезает по короткой стороне
  const SUBSTEPS = 4;                   // подшагов физики за 1 игровой шаг
  const DT_TOTAL = 1;                   // длительность игрового шага
  const DT = DT_TOTAL / SUBSTEPS;
  const canvas      = document.getElementById('game');
  const ctx         = canvas.getContext('2d');
  const hudSpeed    = document.getElementById('hud-speed');
  const hudTime     = document.getElementById('hud-time');
  const hudDv       = document.getElementById('hud-dv');
  const setupPanel  = document.getElementById('setup-panel');
  const flightPanel = document.getElementById('flight-panel');
  const resultPanel = document.getElementById('result-panel');
  const resultText  = document.getElementById('resultText');
  const startDay    = document.getElementById('startDay');
  const startDayVal = document.getElementById('startDayVal');
  const orbitAlt    = document.getElementById('orbitAlt');
  const orbitAltVal = document.getElementById('orbitAltVal');
  const fuel        = document.getElementById('fuel');
  const fuelVal     = document.getElementById('fuelVal');
  const trajectory  = document.getElementById('trajectory');
  const trajectoryVal = document.getElementById('trajectoryVal');
  const impulse     = document.getElementById('impulse');
  const impulseVal  = document.getElementById('impulseVal');
  const fuelPreview = document.getElementById('fuelPreview');
  const timeLimit   = document.getElementById('timeLimit');
  const timeLimitVal= document.getElementById('timeLimitVal');
  const launchBtn   = document.getElementById('launchBtn');
  const restartBtn  = document.getElementById('restartBtn');
  const tsBtns      = document.querySelectorAll('.tsBtn');
  const dpBtns      = document.querySelectorAll('.dp');
  const state = {
    phase: 'setup',                   // setup | flying | won | lost
    time: 0,
    earthAngle: 0,
    marsAngle: 0,
    ship: { x: EARTH_ORBIT, y: 0, vx: 0, vy: 0 },
    totalDv: 0,
    fuelBudget: 0.15,
    plannedImpulse: 0.11,
    trajectoryDeg: 0,
    timeLimitVal: 1500,
    trail: [],
    prediction: [],
    timeScale: 1
  };
  function posOnOrbit(r, a) {
    return { x: r * Math.cos(a), y: r * Math.sin(a) };
  }
  function velOnOrbit(r, a, w) {
    return { x: -r * w * Math.sin(a), y: r * w * Math.cos(a) };
  }
  function rotateVector(x, y, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { x: x * c - y * s, y: x * s + y * c };
  }
  function getParkingOrbitState() {
    const day = Number(startDay.value);
    const earthAngle = EARTH_OMEGA * day;
    const earth = posOnOrbit(EARTH_ORBIT, earthAngle);
    const earthVelocity = velOnOrbit(EARTH_ORBIT, earthAngle, EARTH_OMEGA);
    const altitudeKm = Number(orbitAlt.value);
    const parkingRadius = EARTH_RADIUS + altitudeKm * KM_TO_WORLD;
    const radial = { x: Math.cos(earthAngle), y: Math.sin(earthAngle) };
    const prograde = { x: -Math.sin(earthAngle), y: Math.cos(earthAngle) };
    const parkingPosition = {
      x: earth.x + radial.x * parkingRadius,
      y: earth.y + radial.y * parkingRadius
    };
    const parkingSpeed = Math.sqrt(EARTH_GM / parkingRadius);
    const parkingVelocity = {
      x: prograde.x * parkingSpeed,
      y: prograde.y * parkingSpeed
    };
    const angle = Number(trajectory.value) * Math.PI / 180;
    const burnDirection = rotateVector(prograde.x, prograde.y, angle);
    const plannedImpulse = Number(impulse.value);
    return {
      earth,
      earthVelocity,
      altitudeKm,
      parkingRadius,
      parkingPosition,
      parkingVelocity,
      burnDirection,
      plannedImpulse,
      x: parkingPosition.x,
      y: parkingPosition.y,
      vx: earthVelocity.x + parkingVelocity.x + burnDirection.x * plannedImpulse,
      vy: earthVelocity.y + parkingVelocity.y + burnDirection.y * plannedImpulse
    };
  }
  function bodyPositionsAtTime(t, earthStartAngle, marsStartAngle) {
    return {
      earth: posOnOrbit(EARTH_ORBIT, earthStartAngle + EARTH_OMEGA * t),
      mars: posOnOrbit(MARS_ORBIT, marsStartAngle + MARS_OMEGA * t)
    };
  }
  function accelerationAt(x, y, t, earthStartAngle, marsStartAngle) {
    let ax = 0;
    let ay = 0;
    const r2 = x * x + y * y;
    const r = Math.max(Math.sqrt(r2), 3);
    const sunA = GM / (r * r);
    ax += -sunA * x / r;
    ay += -sunA * y / r;

    const bodies = bodyPositionsAtTime(t, earthStartAngle, marsStartAngle);
    const ex = x - bodies.earth.x;
    const ey = y - bodies.earth.y;
    const er = Math.max(Math.hypot(ex, ey), EARTH_RADIUS * 0.8);
    const earthA = EARTH_GM / (er * er);
    ax += -earthA * ex / er;
    ay += -earthA * ey / er;

    const mx = x - bodies.mars.x;
    const my = y - bodies.mars.y;
    const mr = Math.max(Math.hypot(mx, my), 3);
    const marsA = MARS_GM / (mr * mr);
    ax += -marsA * mx / mr;
    ay += -marsA * my / mr;
    return { x: ax, y: ay };
  }
  function predictTrajectory() {
    if (state.phase !== 'setup') return [];
    const parking = getParkingOrbitState();
    const earthStartAngle = EARTH_OMEGA * Number(startDay.value);
    const marsStartAngle = MARS_START_ANGLE + MARS_OMEGA * Number(startDay.value);
    const maxTime = Number(timeLimit.value);
    const prediction = [{ x: parking.x, y: parking.y }];
    let x = parking.x;
    let y = parking.y;
    let vx = parking.vx;
    let vy = parking.vy;
    let t = 0;
    const predictionStep = 1;
    const maxPoints = 1800;
    for (let step = 0; step < maxTime && prediction.length < maxPoints; step++) {
      const dt = predictionStep / SUBSTEPS;
      for (let i = 0; i < SUBSTEPS; i++) {
        const a = accelerationAt(x, y, t, earthStartAngle, marsStartAngle);
        vx += a.x * dt;
        vy += a.y * dt;
        x += vx * dt;
        y += vy * dt;
        t += dt;
      }
      prediction.push({ x, y });
      if (Math.hypot(x, y) > 700 || Math.hypot(x, y) < 4) break;
    }
    return prediction;
  }
  function updatePanels() {
    setupPanel.classList.toggle('hidden', state.phase !== 'setup');
    flightPanel.classList.toggle('hidden', state.phase !== 'flying');
    const isResult = state.phase === 'won' || state.phase === 'lost';
    resultPanel.classList.toggle('hidden', !isResult);
    if (state.phase === 'won') {
      resultText.textContent = 'Успех! Аппарат достиг Марса.';
      resultText.className = 'win';
    } else if (state.phase === 'lost') {
      resultText.textContent = 'Неудача. Попробуйте снова.';
      resultText.className = 'lose';
    }
  }
  function updateTimeScaleButtons() {
    tsBtns.forEach(b => {
      b.classList.toggle('active', Number(b.dataset.ts) === state.timeScale);
    });
  }
  function updateHud() {
    const speed = Math.hypot(state.ship.vx, state.ship.vy);
    hudSpeed.textContent = speed.toFixed(2);
    hudTime.textContent = Math.round(state.time);
    hudDv.textContent = state.totalDv.toFixed(2) + ' / ' + state.fuelBudget.toFixed(2);
  }
  function updateFuelPreview() {
    const burn = Number(impulse.value);
    const budget = Number(fuel.value);
    if (burn <= budget + 1e-9) {
      fuelPreview.textContent = burn.toFixed(2) + ' ΔV из ' + budget.toFixed(2);
      launchBtn.disabled = false;
    } else {
      fuelPreview.textContent = 'Нужно ' + burn.toFixed(2) + ' ΔV — доступно ' + budget.toFixed(2);
      launchBtn.disabled = true;
    }
  }
  function refreshSetupScene() {
    const day = Number(startDay.value);
    state.earthAngle = EARTH_OMEGA * day;
    state.marsAngle  = MARS_START_ANGLE + MARS_OMEGA * day;
    const parking = getParkingOrbitState();
    state.ship.x = parking.parkingPosition.x;
    state.ship.y = parking.parkingPosition.y;
    state.ship.vx = parking.earthVelocity.x + parking.parkingVelocity.x;
    state.ship.vy = parking.earthVelocity.y + parking.parkingVelocity.y;
    state.time = 0;
    state.totalDv = 0;
    state.plannedImpulse = Number(impulse.value);
    state.trajectoryDeg = Number(trajectory.value);
    state.trail = [];
    state.prediction = predictTrajectory();
    state.fuelBudget = Number(fuel.value);
    state.timeLimitVal = Number(timeLimit.value);
  }
  function resetToSetup() {
    state.phase = 'setup';
    state.timeScale = 1;
    refreshSetupScene();
    updatePanels();
    updateTimeScaleButtons();
    updateHud();
  }
  function launch() {
    refreshSetupScene();
    const plannedImpulse = Number(impulse.value);
    const fuelBudget = Number(fuel.value);
    if (plannedImpulse > fuelBudget + 1e-9) {
      fuelPreview.textContent = 'Недостаточно топлива';
      return;
    }
    const parking = getParkingOrbitState();
    state.ship.x = parking.x;
    state.ship.y = parking.y;
    state.ship.vx = parking.vx;
    state.ship.vy = parking.vy;
    state.totalDv = plannedImpulse;
    state.time = 0;
    state.trail = [{ x: state.ship.x, y: state.ship.y }];
    state.phase = 'flying';
    updatePanels();
    updateHud();
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  }
  function applyThrust(dx, dy) {
    if (state.phase !== 'flying') return;
    if (state.totalDv + THRUST_AMOUNT > state.fuelBudget + 1e-9) return;
    const len = Math.hypot(dx, dy) || 1;
    state.ship.vx += (dx / len) * THRUST_AMOUNT;
    state.ship.vy += (dy / len) * THRUST_AMOUNT;
    state.totalDv += THRUST_AMOUNT;
  }
  function substep(dt) {
    const earthStartAngle = state.earthAngle;
    const marsStartAngle = state.marsAngle;
    const a = accelerationAt(state.ship.x, state.ship.y, 0, earthStartAngle, marsStartAngle);
    state.ship.vx += a.x * dt;
    state.ship.vy += a.y * dt;
    state.ship.x += state.ship.vx * dt;
    state.ship.y += state.ship.vy * dt;
    state.earthAngle += EARTH_OMEGA * dt;
    state.marsAngle += MARS_OMEGA * dt;
  }
  function stepGame() {
    for (let i = 0; i < SUBSTEPS; i++) {
      substep(DT);
    }
    state.time += DT_TOTAL;
    state.trail.push({ x: state.ship.x, y: state.ship.y });
    if (state.trail.length > 4000) state.trail.shift();
  }
  function checkResult() {
    if (state.phase !== 'flying') return;
    const mp = posOnOrbit(MARS_ORBIT, state.marsAngle);
    const dx = state.ship.x - mp.x;
    const dy = state.ship.y - mp.y;
    if (Math.hypot(dx, dy) < CAPTURE_RADIUS) {
      state.phase = 'won';
      updatePanels();
      return;
    }
    if (state.time >= state.timeLimitVal) {
      state.phase = 'lost';
      updatePanels();
      return;
    }
    const r = Math.hypot(state.ship.x, state.ship.y);
    if (r > 700 || r < 4) {
      state.phase = 'lost';
      updatePanels();
    }
  }
  function ensureCanvasSize() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w > 0 && h > 0) {
      const targetW = Math.round(w * dpr);
      const targetH = Math.round(h * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    }
  }
  function render() {
    ensureCanvasSize();
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) / (2 * WORLD_VIEW);
    const tx = x => cx + x * scale;
    const ty = y => cy + y * scale;
    ctx.strokeStyle = 'rgba(140, 160, 220, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, EARTH_ORBIT * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, MARS_ORBIT * scale, 0, Math.PI * 2);
    ctx.stroke();
    const sunR = Math.max(12, SUN_RADIUS * scale);
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
    ctx.fill();
    const sg = ctx.createRadialGradient(cx, cy, sunR, cx, cy, sunR * 2.6);
    sg.addColorStop(0, 'rgba(255, 215, 0, 0.55)');
    sg.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(cx, cy, sunR * 2.6, 0, Math.PI * 2);
    ctx.fill();
    const ep = posOnOrbit(EARTH_ORBIT, state.earthAngle);
    const ex = tx(ep.x);
    const ey = ty(ep.y);
    const er = Math.max(6, 5 * scale);
    if (state.phase === 'setup') {
      const parking = getParkingOrbitState();
      const parkingR = parking.parkingRadius * scale;
      ctx.strokeStyle = 'rgba(120, 220, 120, 0.65)';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ex, ey, parkingR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      const sx0 = tx(parking.x);
      const sy0 = ty(parking.y);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.arc(sx0, sy0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx0, sy0, 3.5, 0, Math.PI * 2);
      ctx.fill();
      const arrowLength = Math.max(18, Math.min(55, Math.abs(parking.plannedImpulse) * 180));
      const ax = parking.burnDirection.x * arrowLength;
      const ay = parking.burnDirection.y * arrowLength;
      ctx.strokeStyle = 'rgba(255, 210, 90, 0.95)';
      ctx.fillStyle = 'rgba(255, 210, 90, 0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx0, sy0);
      ctx.lineTo(sx0 + ax, sy0 + ay);
      ctx.stroke();
      const tipX = sx0 + ax;
      const tipY = sy0 + ay;
      const a = Math.atan2(ay, ax);
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - 8 * Math.cos(a - 0.5), tipY - 8 * Math.sin(a - 0.5));
      ctx.lineTo(tipX - 8 * Math.cos(a + 0.5), tipY - 8 * Math.sin(a + 0.5));
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fill();
    const mp = posOnOrbit(MARS_ORBIT, state.marsAngle);
    const mx = tx(mp.x);
    const my = ty(mp.y);
    const mr = Math.max(6, 4.5 * scale);
    ctx.strokeStyle = 'rgba(255, 90, 90, 0.75)';
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx, my, CAPTURE_RADIUS * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#E53935';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    if (state.phase === 'setup' && state.prediction.length > 1) {
      ctx.strokeStyle = 'rgba(255, 220, 110, 0.95)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.moveTo(tx(state.prediction[0].x), ty(state.prediction[0].y));
      for (let i = 1; i < state.prediction.length; i++) {
        ctx.lineTo(tx(state.prediction[i].x), ty(state.prediction[i].y));
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (state.trail.length > 1) {
      ctx.strokeStyle = 'rgba(120, 220, 255, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tx(state.trail[0].x), ty(state.trail[0].y));
      for (let i = 1; i < state.trail.length; i++) {
        ctx.lineTo(tx(state.trail[i].x), ty(state.trail[i].y));
      }
      ctx.stroke();
    }
    if (state.phase !== 'setup') {
      const sx = tx(state.ship.x);
      const sy = ty(state.ship.y);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.arc(sx, sy, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Солнце', cx, cy + sunR + 14);
    ctx.fillText('Земля', ex, ey - er - 6);
    ctx.fillText('Марс', mx, my - mr - 6);
    if (state.phase === 'setup') {
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      const day = Number(startDay.value);
      const orbit = Number(orbitAlt.value);
      const f = Number(fuel.value);
      const angle = Number(trajectory.value);
      const burn = Number(impulse.value);
      const tl = Number(timeLimit.value);
      ctx.fillText('День старта: ' + day, 10, 18);
      ctx.fillText('Высота орбиты: ' + orbit + ' км', 10, 34);
      ctx.fillText('Траектория: ' + angle + '°', 10, 50);
      ctx.fillText('Импульс: ' + burn.toFixed(2) + ' | Топливо: ' + f.toFixed(2), 10, 66);
      ctx.fillText('Лимит времени: ' + tl, 10, 82);
    }
  }
  let dpadDir = null;
  let dpadTimer = null;
  function dpadApply() {
    if (!dpadDir) return;
    if (dpadDir === 'up')         applyThrust(0, -1);
    else if (dpadDir === 'down')  applyThrust(0, 1);
    else if (dpadDir === 'left')  applyThrust(-1, 0);
    else if (dpadDir === 'right') applyThrust(1, 0);
  }
  function dpadStart(dir) {
    dpadStop();
    dpadDir = dir;
    dpadApply();
    dpadTimer = setInterval(dpadApply, 120);
  }
  function dpadStop() {
    if (dpadTimer) { clearInterval(dpadTimer); dpadTimer = null; }
    dpadDir = null;
  }
  startDay.addEventListener('input', () => {
    startDayVal.textContent = startDay.value;
    if (state.phase === 'setup') refreshSetupScene();
  });
  orbitAlt.addEventListener('input', () => {
    orbitAltVal.textContent = orbitAlt.value;
    if (state.phase === 'setup') refreshSetupScene();
    updateFuelPreview();
  });
  fuel.addEventListener('input', () => {
    fuelVal.textContent = Number(fuel.value).toFixed(2);
    state.fuelBudget = Number(fuel.value);
    updateFuelPreview();
    updateHud();
  });
  trajectory.addEventListener('input', () => {
    trajectoryVal.textContent = Number(trajectory.value) + '°';
    state.trajectoryDeg = Number(trajectory.value);
    if (state.phase === 'setup') refreshSetupScene();
  });
  impulse.addEventListener('input', () => {
    impulseVal.textContent = Number(impulse.value).toFixed(2);
    state.plannedImpulse = Number(impulse.value);
    updateFuelPreview();
    if (state.phase === 'setup') refreshSetupScene();
  });
  timeLimit.addEventListener('input', () => {
    timeLimitVal.textContent = timeLimit.value;
    state.timeLimitVal = Number(timeLimit.value);
  });
  launchBtn.addEventListener('click', launch);
  restartBtn.addEventListener('click', resetToSetup);
  tsBtns.forEach(b => {
    b.addEventListener('click', () => {
      state.timeScale = Number(b.dataset.ts);
      updateTimeScaleButtons();
    });
  });
  dpBtns.forEach(b => {
    const dir = b.dataset.dir;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dpadStart(dir);
    });
    b.addEventListener('pointerup',    dpadStop);
    b.addEventListener('pointerleave', dpadStop);
    b.addEventListener('pointercancel', dpadStop);
  });
  const keysDown = {};
  function keyToDir(e) {
    switch (e.key) {
      case 'ArrowUp':    return 'up';
      case 'ArrowDown':  return 'down';
      case 'ArrowLeft':  return 'left';
      case 'ArrowRight': return 'right';
      case 'w': case 'W': return 'up';
      case 's': case 'S': return 'down';
      case 'a': case 'A': return 'left';
      case 'd': case 'D': return 'right';
    }
    return null;
  }
  window.addEventListener('keydown', (e) => {
    if (state.phase !== 'flying') return;
    const dir = keyToDir(e);
    if (!dir) return;
    e.preventDefault();
    if (keysDown[dir]) return;   // игнорируем автоповтор
    keysDown[dir] = true;
    if (dir === 'up')         applyThrust(0, -1);
    else if (dir === 'down')  applyThrust(0, 1);
    else if (dir === 'left')  applyThrust(-1, 0);
    else if (dir === 'right') applyThrust(1, 0);
  });
  window.addEventListener('keyup', (e) => {
    const dir = keyToDir(e);
    if (dir) keysDown[dir] = false;
  });
  function loop() {
    if (state.phase === 'flying') {
      const n = state.timeScale;
      for (let i = 0; i < n; i++) {
        stepGame();
        checkResult();
        if (state.phase !== 'flying') break;
      }
      updateHud();
    }
    render();
    requestAnimationFrame(loop);
  }
  refreshSetupScene();
  updatePanels();
  updateTimeScaleButtons();
  updateFuelPreview();
  updateHud();
  requestAnimationFrame(loop);
})();