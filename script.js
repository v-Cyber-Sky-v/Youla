(() => {
  'use strict';
  const GM = 100;                       // гравитационный параметр Солнца
  const SUN_RADIUS = 10;                // Солнце стилизовано отдельно от масштаба планет
  const EARTH_RADIUS = 5;                // условный радиус Земли; радиусы планет заданы пропорционально реальным
  const EARTH_RADIUS_KM = 6371;
  const MIN_PARKING_ALT_KM = 200;
  const MAX_PARKING_ALT_KM = 35786;       // геостационарная орбита
  const EARTH_GM = 0.16;                  // ослабленное поле Земли для более устойчивых игровых коррекций
  const KM_TO_WORLD = EARTH_RADIUS / EARTH_RADIUS_KM;
  // Орбиты масштабированы по большой полуоси: Земля = 100 единиц.
  // Радиусы планет и их гравитационные параметры масштабированы относительно Земли.
  const EARTH_ORBIT = 100;
  const PLANETS = [
    { key: 'mercury', name: 'Меркурий', orbit: 38.7, radius: EARTH_RADIUS * 0.383, gm: EARTH_GM * 0.0553, color: '#b7a99a', period: 87.97, startAngle: 1.1 },
    { key: 'venus', name: 'Венера', orbit: 72.3, radius: EARTH_RADIUS * 0.949, gm: EARTH_GM * 0.815, color: '#e6c27a', period: 224.7, startAngle: 2.0 },
    { key: 'earth', name: 'Земля', orbit: EARTH_ORBIT, radius: EARTH_RADIUS, gm: EARTH_GM, color: '#4CAF50', period: 365.256, startAngle: 0 },
    { key: 'mars', name: 'Марс', orbit: 152.4, radius: EARTH_RADIUS * 0.532, gm: EARTH_GM * 0.107, color: '#E53935', period: 686.98, startAngle: 2.5 },
    { key: 'jupiter', name: 'Юпитер', orbit: 520.4, radius: EARTH_RADIUS * 11.21, gm: EARTH_GM * 317.8, color: '#d6a779', period: 4332.59, startAngle: 0.6 },
    { key: 'saturn', name: 'Сатурн', orbit: 953.3, radius: EARTH_RADIUS * 9.45, gm: EARTH_GM * 95.2, color: '#d8c58e', period: 10759.2, startAngle: 2.8 }
  ];
  const PLANET_BY_KEY = Object.fromEntries(PLANETS.map(p => [p.key, p]));
  const ORBIT_OMEGA = orbit => Math.sqrt(GM / Math.pow(orbit, 3));
  const EARTH_OMEGA = ORBIT_OMEGA(EARTH_ORBIT);
  const MARS_ORBIT = PLANET_BY_KEY.mars.orbit;
  const MARS_OMEGA = ORBIT_OMEGA(MARS_ORBIT);
  const MARS_START_ANGLE = PLANET_BY_KEY.mars.startAngle;
  const CAPTURE_RADIUS = 22;            // радиус зоны успеха у Марса
  const THRUST_AMOUNT = 0.03;           // усиленная коррекция ΔV
  const HOHMANN_DV = 0.1094;            // ориентир для идеального импульса перелёта
  const WORLD_VIEW = 1020;              // показывает орбиты до Сатурна на общем плане
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
  const impulseHeading = document.getElementById('impulseHeading');
  const impulseHint = document.getElementById('impulseHint');
  const trajectoryEditActions = document.getElementById('trajectoryEditActions');
  const applyImpulseBtn = document.getElementById('applyImpulseBtn');
  const cancelImpulseBtn = document.getElementById('cancelImpulseBtn');
  const timeLimit   = document.getElementById('timeLimit');
  const timeLimitVal= document.getElementById('timeLimitVal');
  const launchBtn   = document.getElementById('launchBtn');
  const restartBtn  = document.getElementById('restartBtn');
  const paramsTab   = document.getElementById('paramsTab');
  const impulseTab  = document.getElementById('impulseTab');
  const setupParams = document.getElementById('setup-params');
  const impulseControls = document.getElementById('impulse-controls');
  const tsBtns      = document.querySelectorAll('.tsBtn');
  const state = {
    phase: 'setup',                   // setup | flying | won | lost
    editingTrajectory: false,
    time: 0,
    earthAngle: 0,
    marsAngle: 0,
    mercuryAngle: PLANET_BY_KEY.mercury.startAngle,
    venusAngle: PLANET_BY_KEY.venus.startAngle,
    jupiterAngle: PLANET_BY_KEY.jupiter.startAngle,
    saturnAngle: PLANET_BY_KEY.saturn.startAngle,
    ship: { x: EARTH_ORBIT, y: 0, vx: 0, vy: 0 },
    totalDv: 0,
    fuelBudget: 0.15,
    plannedImpulse: 0.11,
    trajectoryDeg: 0,
    timeLimitVal: 1500,
    trail: [],
    prediction: [],
    timeScale: 1,
    stepAccumulator: 0,
    editOrigin: null,
    cameraZoom: 1,              // общий план при настройке импульса
    flightZoom: 3.2,            // приближение с камерой, закреплённой за аппаратом
    cameraX: 0,
    cameraY: 0,
    pointerPan: null
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
  function currentPlanetAngles() {
    return {
      mercury: state.mercuryAngle,
      venus: state.venusAngle,
      earth: state.earthAngle,
      mars: state.marsAngle,
      jupiter: state.jupiterAngle,
      saturn: state.saturnAngle
    };
  }
  function initialPlanetAngles(day) {
    return Object.fromEntries(PLANETS.map(p => [p.key, p.startAngle + ORBIT_OMEGA(p.orbit) * day]));
  }
  function bodyPositionsAtTime(t, startAngles) {
    const bodies = {};
    for (const planet of PLANETS) {
      const angle = startAngles[planet.key] + ORBIT_OMEGA(planet.orbit) * t;
      bodies[planet.key] = posOnOrbit(planet.orbit, angle);
    }
    return bodies;
  }
  function accelerationAt(x, y, t, startAngles) {
    let ax = 0;
    let ay = 0;
    const r2 = x * x + y * y;
    const r = Math.max(Math.sqrt(r2), 3);
    const sunA = GM / (r * r);
    ax += -sunA * x / r;
    ay += -sunA * y / r;

    const bodies = bodyPositionsAtTime(t, startAngles);
    // Гравитация всех шести планет. Мягкое ограничение расстояния предотвращает
    // численные выбросы при очень близком пролёте около центра планеты.
    for (const planet of PLANETS) {
      const dx = x - bodies[planet.key].x;
      const dy = y - bodies[planet.key].y;
      const distance = Math.max(Math.hypot(dx, dy), Math.max(1.2, planet.radius * 0.35));
      const a = planet.gm / (distance * distance);
      ax -= a * dx / distance;
      ay -= a * dy / distance;
    }
    return { x: ax, y: ay };
  }
  // Интегратор Рунге — Кутты 4-го порядка: гравитация пересчитывается
  // на промежуточных позициях аппарата и планет, а не только в начале шага.
  function integrateShipRK4(ship, dt, startAngles, timeOffset = 0) {
    const derivative = (x, y, vx, vy, t) => {
      const a = accelerationAt(x, y, timeOffset + t, startAngles);
      return { x: vx, y: vy, vx: a.x, vy: a.y };
    };
    const add = (base, k, factor) => ({
      x: base.x + k.x * factor,
      y: base.y + k.y * factor,
      vx: base.vx + k.vx * factor,
      vy: base.vy + k.vy * factor
    });
    const k1 = derivative(ship.x, ship.y, ship.vx, ship.vy, 0);
    const s2 = add(ship, k1, dt / 2);
    const k2 = derivative(s2.x, s2.y, s2.vx, s2.vy, dt / 2);
    const s3 = add(ship, k2, dt / 2);
    const k3 = derivative(s3.x, s3.y, s3.vx, s3.vy, dt / 2);
    const s4 = add(ship, k3, dt);
    const k4 = derivative(s4.x, s4.y, s4.vx, s4.vy, dt);
    ship.x += dt / 6 * (k1.x + 2 * k2.x + 2 * k3.x + k4.x);
    ship.y += dt / 6 * (k1.y + 2 * k2.y + 2 * k3.y + k4.y);
    ship.vx += dt / 6 * (k1.vx + 2 * k2.vx + 2 * k3.vx + k4.vx);
    ship.vy += dt / 6 * (k1.vy + 2 * k2.vy + 2 * k3.vy + k4.vy);
  }

  function predictTrajectory() {
    if (state.phase !== 'setup' && !state.editingTrajectory) return [];
    const editing = state.editingTrajectory;
    const parking = editing ? null : getParkingOrbitState();
    const startAngles = editing ? currentPlanetAngles() : initialPlanetAngles(Number(startDay.value));
    const maxTime = editing ? Math.max(1, Number(timeLimit.value) - state.time) : Number(timeLimit.value);
    let x, y, vx, vy;
    if (editing) {
      x = state.ship.x;
      y = state.ship.y;
      const angle = Number(trajectory.value) * Math.PI / 180;
      const speed = Math.hypot(state.ship.vx, state.ship.vy) || 1;
      const baseAngle = Math.atan2(state.ship.vy, state.ship.vx);
      const burnAngle = baseAngle + angle;
      const burn = Number(impulse.value);
      vx = state.ship.vx + Math.cos(burnAngle) * burn;
      vy = state.ship.vy + Math.sin(burnAngle) * burn;
    } else {
      x = parking.x;
      y = parking.y;
      vx = parking.vx;
      vy = parking.vy;
    }
    const prediction = [{ x, y }];
    // На каждом подшаге учитываем новое положение Земли и Марса в будущем.
    let t = 0;
    const predictionStep = 1;
    const maxPoints = 1800;
    for (let step = 0; step < maxTime && prediction.length < maxPoints; step++) {
      const dt = predictionStep / SUBSTEPS;
      for (let i = 0; i < SUBSTEPS; i++) {
        const predictedShip = { x, y, vx, vy };
        integrateShipRK4(predictedShip, dt, startAngles, t);
        ({ x, y, vx, vy } = predictedShip);
        t += dt;
      }
      prediction.push({ x, y });
      if (Math.hypot(x, y) > 700 || Math.hypot(x, y) < 4) break;
    }
    return prediction;
  }
  function updatePanels() {
    const isSetup = state.phase === 'setup';
    const isEditing = state.phase === 'flying' && state.editingTrajectory;
    setupPanel.classList.toggle('hidden', !(isSetup || isEditing));
    flightPanel.classList.toggle('hidden', state.phase !== 'flying' || isEditing);
    launchBtn.disabled = !isSetup;
    // После старта убираем элементы настройки запуска: остаются игровые кнопки.
    launchBtn.classList.toggle('hidden', !isSetup);
    paramsTab.classList.toggle('hidden', !isSetup);
    paramsTab.disabled = !isSetup;
    impulseTab.disabled = !(isSetup || state.phase === 'flying');
    trajectoryEditActions.classList.toggle('hidden', !isEditing);
    if (isEditing) {
      showSetupPage('impulse');
      impulseHeading.textContent = 'Редактирование траектории';
      impulseHint.textContent = 'Время остановлено. Угол задаёт направление импульса относительно текущей скорости; импульс добавляется к ней, не заменяя её.';
      fuelPreview.parentElement.querySelector('span').textContent = 'Расход коррекции';
    } else {
      impulseHeading.textContent = 'Импульс запуска';
      impulseHint.textContent = 'Направление задаётся относительно движения по орбите. Величина импульса расходует топливо.';
      fuelPreview.parentElement.querySelector('span').textContent = 'Расход при старте';
    }
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
    const available = state.fuelBudget - state.totalDv;
    const allowed = state.editingTrajectory ? burn <= available + 1e-9 : burn <= budget + 1e-9;
    if (allowed) {
      fuelPreview.textContent = state.editingTrajectory
        ? burn.toFixed(2) + ' ΔV из доступных ' + Math.max(0, available).toFixed(2)
        : burn.toFixed(2) + ' ΔV из ' + budget.toFixed(2);
      launchBtn.disabled = state.phase !== 'setup';
      applyImpulseBtn.disabled = !state.editingTrajectory || burn <= 0 || burn > available + 1e-9;
    } else {
      fuelPreview.textContent = state.editingTrajectory
        ? 'Нужно ' + burn.toFixed(2) + ' ΔV — доступно ' + Math.max(0, available).toFixed(2)
        : 'Нужно ' + burn.toFixed(2) + ' ΔV — доступно ' + budget.toFixed(2);
      launchBtn.disabled = true;
      applyImpulseBtn.disabled = true;
    }
  }
  function refreshSetupScene() {
    state.editingTrajectory = false;
    const day = Number(startDay.value);
    state.earthAngle = EARTH_OMEGA * day;
    const angles = initialPlanetAngles(day);
    state.mercuryAngle = angles.mercury;
    state.venusAngle = angles.venus;
    state.earthAngle = angles.earth;
    state.marsAngle = angles.mars;
    state.jupiterAngle = angles.jupiter;
    state.saturnAngle = angles.saturn;
    const parking = getParkingOrbitState();
    state.ship.x = parking.parkingPosition.x;
    state.ship.y = parking.parkingPosition.y;
    state.ship.vx = parking.earthVelocity.x + parking.parkingVelocity.x;
    state.ship.vy = parking.earthVelocity.y + parking.parkingVelocity.y;
    state.time = 0;
    state.stepAccumulator = 0;
    state.totalDv = 0;
    state.plannedImpulse = Number(impulse.value);
    state.trajectoryDeg = Number(trajectory.value);
    state.trail = [];
    state.prediction = predictTrajectory();
    state.fuelBudget = Number(fuel.value);
    state.timeLimitVal = Number(timeLimit.value);
  }
  function showSetupPage(page) {
    const showImpulse = page === 'impulse';
    setupParams.classList.toggle('hidden', showImpulse);
    impulseControls.classList.toggle('hidden', !showImpulse);
    paramsTab.classList.toggle('active', !showImpulse);
    impulseTab.classList.toggle('active', showImpulse);
  }
  function resetToSetup() {
    state.cameraZoom = 1;
    state.flightZoom = 3.2;
    state.cameraX = 0;
    state.cameraY = 0;
    state.phase = 'setup';
    state.editingTrajectory = false;
    state.editOrigin = null;
    showSetupPage('params');
    state.timeScale = 1;
    refreshSetupScene();
    updatePanels();
    updateTimeScaleButtons();
    updateHud();
  }
  function launch() {
    state.cameraZoom = 1;
    state.cameraX = 0;
    state.cameraY = 0;
    state.flightZoom = 3.2;
    state.editingTrajectory = false;
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
  function beginTrajectoryEdit() {
    if (state.phase === 'setup') {
      showSetupPage('impulse');
      return;
    }
    if (state.phase !== 'flying' || state.editingTrajectory) return;
    const available = Math.max(0, state.fuelBudget - state.totalDv);
    if (available < 0.01) {
      fuelPreview.textContent = 'Топливо для коррекции закончилось';
      return;
    }
    state.editOrigin = { x: state.ship.x, y: state.ship.y, vx: state.ship.vx, vy: state.ship.vy };
    state.editingTrajectory = true;
    trajectory.value = '0';
    trajectoryVal.textContent = '0°';
    const correction = Math.min(0.07, Math.floor(available * 100 + 1e-9) / 100);
    impulse.value = correction.toFixed(2);
    impulseVal.textContent = correction.toFixed(2);
    state.prediction = predictTrajectory();
    showSetupPage('impulse');
    updatePanels();
    updateFuelPreview();
  }
  function cancelTrajectoryEdit() {
    if (!state.editingTrajectory) return;
    state.editingTrajectory = false;
    state.editOrigin = null;
    state.prediction = [];
    updatePanels();
    updateFuelPreview();
  }
  function applyTrajectoryImpulse() {
    if (!state.editingTrajectory || state.phase !== 'flying') return;
    const burn = Number(impulse.value);
    const available = state.fuelBudget - state.totalDv;
    if (burn <= 0 || burn > available + 1e-9) {
      updateFuelPreview();
      return;
    }
    const angle = Number(trajectory.value) * Math.PI / 180;
    const baseAngle = Math.atan2(state.ship.vy, state.ship.vx);
    const burnAngle = baseAngle + angle;
    // Сохраняем текущую скорость и добавляем к ней ΔV в выбранном направлении.
    state.ship.vx += Math.cos(burnAngle) * burn;
    state.ship.vy += Math.sin(burnAngle) * burn;
    state.totalDv += burn;
    // Сбрасываем дробный остаток шага, чтобы после коррекции время сразу продолжилось штатно.
    state.stepAccumulator = 0;
    state.editingTrajectory = false;
    state.editOrigin = null;
    state.prediction = [];
    updatePanels();
    updateHud();
    updateFuelPreview();
  }
  function substep(dt) {
    integrateShipRK4(state.ship, dt, currentPlanetAngles());
    for (const planet of PLANETS) {
      state[planet.key + 'Angle'] += ORBIT_OMEGA(planet.orbit) * dt;
    }
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
    // При выборе импульса показываем общий план. Во время полёта камера
    // автоматически центрируется на КА и приближает сцену.
    const followShip = state.phase === 'flying' && !state.editingTrajectory;
    const viewCenterX = followShip ? state.ship.x : state.cameraX;
    const viewCenterY = followShip ? state.ship.y : state.cameraY;
    const viewZoom = followShip ? state.flightZoom : state.cameraZoom;
    const scale = Math.min(w, h) / (2 * WORLD_VIEW) * viewZoom;
    const tx = x => cx + (x - viewCenterX) * scale;
    const ty = y => cy + (y - viewCenterY) * scale;
    ctx.strokeStyle = 'rgba(140, 160, 220, 0.22)';
    ctx.lineWidth = 1;
    const worldCx = tx(0), worldCy = ty(0);
    for (const planet of PLANETS) {
      ctx.beginPath();
      ctx.arc(worldCx, worldCy, planet.orbit * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Визуальный размер Солнца: оно должно оставаться крупнее газовых гигантов
    // даже при приближении камеры. Орбиты и физические радиусы не меняются.
    // Солнце не получает крупный минимальный радиус при сильном отдалении камеры:
    // Юпитер и Сатурн остаются визуально крупнее, а внутренние орбиты не перекрываются.
    const sunR = Math.max(0.4, SUN_RADIUS * scale);
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(worldCx, worldCy, sunR, 0, Math.PI * 2);
    ctx.fill();
    const sg = ctx.createRadialGradient(worldCx, worldCy, sunR, worldCx, worldCy, sunR * 2.6);
    sg.addColorStop(0, 'rgba(255, 215, 0, 0.55)');
    sg.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(worldCx, worldCy, sunR * 2.6, 0, Math.PI * 2);
    ctx.fill();
    const ep = posOnOrbit(EARTH_ORBIT, state.earthAngle);
    const ex = tx(ep.x);
    const ey = ty(ep.y);
    const er = Math.max(0.75, PLANET_BY_KEY.earth.radius * scale);
    if (state.phase === 'setup' || state.editingTrajectory) {
      const parking = state.editingTrajectory ? { parkingRadius: 0, x: state.ship.x, y: state.ship.y, plannedImpulse: Number(impulse.value), burnDirection: (() => { const a = Math.atan2(state.ship.vy, state.ship.vx) + Number(trajectory.value) * Math.PI / 180; return { x: Math.cos(a), y: Math.sin(a) }; })() } : getParkingOrbitState();
      const parkingR = parking.parkingRadius * scale;
      ctx.strokeStyle = 'rgba(120, 220, 120, 0.65)';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      if (!state.editingTrajectory) {
        ctx.beginPath();
        ctx.arc(ex, ey, parkingR, 0, Math.PI * 2);
        ctx.stroke();
      }
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
    ctx.fillStyle = PLANET_BY_KEY.earth.color;
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fill();
    const mp = posOnOrbit(MARS_ORBIT, state.marsAngle);
    const mx = tx(mp.x);
    const my = ty(mp.y);
    const mr = Math.max(0.75, PLANET_BY_KEY.mars.radius * scale);
    ctx.strokeStyle = 'rgba(255, 90, 90, 0.75)';
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx, my, CAPTURE_RADIUS * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = PLANET_BY_KEY.mars.color;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    // Рисуем остальные планеты по единой шкале радиусов относительно Земли.
    const planetPositions = {};
    for (const planet of PLANETS) {
      if (planet.key === 'earth' || planet.key === 'mars') continue;
      const angle = state[planet.key + 'Angle'];
      const pos = posOnOrbit(planet.orbit, angle);
      const px = tx(pos.x), py = ty(pos.y);
      const radius = Math.max(0.55, planet.radius * scale);
      planetPositions[planet.key] = { x: px, y: py, r: radius };
      ctx.fillStyle = planet.color;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
      if (planet.key === 'saturn') {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(-0.25);
        ctx.strokeStyle = 'rgba(226, 208, 157, 0.85)';
        ctx.lineWidth = Math.max(0.8, radius * 0.22);
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 1.8, radius * 0.55, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    if ((state.phase === 'setup' || state.editingTrajectory) && state.prediction.length > 1) {
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
    ctx.fillText('Солнце', worldCx, worldCy + sunR + 14);
    ctx.fillText('Земля', ex, ey - er - 6);
    ctx.fillText('Марс', mx, my - mr - 6);
    for (const planet of PLANETS) {
      if (planet.key === 'earth' || planet.key === 'mars') continue;
      const pos = planetPositions[planet.key];
      if (pos && (planet.key === 'jupiter' || planet.key === 'saturn' || scale > 0.28)) {
        ctx.fillText(planet.name, pos.x, pos.y - pos.r - 6);
      }
    }
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
    else if (state.editingTrajectory) state.prediction = predictTrajectory();
  });
  impulse.addEventListener('input', () => {
    impulseVal.textContent = Number(impulse.value).toFixed(2);
    state.plannedImpulse = Number(impulse.value);
    updateFuelPreview();
    if (state.phase === 'setup') refreshSetupScene();
    else if (state.editingTrajectory) state.prediction = predictTrajectory();
    updateFuelPreview();
  });
  timeLimit.addEventListener('input', () => {
    timeLimitVal.textContent = timeLimit.value;
    state.timeLimitVal = Number(timeLimit.value);
  });
  launchBtn.addEventListener('click', launch);
  paramsTab.addEventListener('click', () => showSetupPage('params'));
  impulseTab.addEventListener('click', beginTrajectoryEdit);
  applyImpulseBtn.addEventListener('click', applyTrajectoryImpulse);
  cancelImpulseBtn.addEventListener('click', cancelTrajectoryEdit);
  restartBtn.addEventListener('click', resetToSetup);
  tsBtns.forEach(b => {
    b.addEventListener('click', () => {
      state.timeScale = Number(b.dataset.ts);
      updateTimeScaleButtons();
    });
  });
  // Камера: колесо мыши масштабирует, перетаскивание перемещает вид.
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    const followShip = state.phase === 'flying' && !state.editingTrajectory;
    if (followShip) {
      state.flightZoom = Math.max(1.5, Math.min(6, state.flightZoom * factor));
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left, py = event.clientY - rect.top;
    const oldScale = Math.min(canvas.clientWidth, canvas.clientHeight) / (2 * WORLD_VIEW) * state.cameraZoom;
    const wx = state.cameraX + (px - canvas.clientWidth / 2) / oldScale;
    const wy = state.cameraY + (py - canvas.clientHeight / 2) / oldScale;
    state.cameraZoom = Math.max(0.45, Math.min(5, state.cameraZoom * factor));
    const newScale = Math.min(canvas.clientWidth, canvas.clientHeight) / (2 * WORLD_VIEW) * state.cameraZoom;
    state.cameraX = wx - (px - canvas.clientWidth / 2) / newScale;
    state.cameraY = wy - (py - canvas.clientHeight / 2) / newScale;
  }, { passive: false });
  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    // В полёте камера следует за аппаратом; перетаскивание доступно на общем плане.
    if (state.phase === 'flying' && !state.editingTrajectory) return;
    state.pointerPan = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!state.pointerPan || state.pointerPan.id !== event.pointerId) return;
    const scale = Math.min(canvas.clientWidth, canvas.clientHeight) / (2 * WORLD_VIEW) * state.cameraZoom;
    state.cameraX -= (event.clientX - state.pointerPan.x) / scale;
    state.cameraY -= (event.clientY - state.pointerPan.y) / scale;
    state.pointerPan.x = event.clientX;
    state.pointerPan.y = event.clientY;
  });
  const endPan = event => { if (state.pointerPan && state.pointerPan.id === event.pointerId) state.pointerPan = null; };
  canvas.addEventListener('pointerup', endPan);
  canvas.addEventListener('pointercancel', endPan);
  canvas.addEventListener('dblclick', () => { state.cameraZoom = 1; state.flightZoom = 3.2; state.cameraX = 0; state.cameraY = 0; });

  function loop() {
    if (state.phase === 'flying' && !state.editingTrajectory) {
      // Базовая скорость симуляции снижена вдвое; кнопки x3/x10 остаются относительными ускорителями.
      state.stepAccumulator += 0.5 * state.timeScale;
      while (state.stepAccumulator >= 1) {
        stepGame();
        state.stepAccumulator -= 1;
        checkResult();
        if (state.phase !== 'flying') break;
      }
      updateHud();
    }
    render();
    requestAnimationFrame(loop);
  }
  showSetupPage('params');
  refreshSetupScene();
  updatePanels();
  updateTimeScaleButtons();
  updateFuelPreview();
  updateHud();
  requestAnimationFrame(loop);
})();