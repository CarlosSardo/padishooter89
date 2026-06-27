/* =====================================================================
   PaDi Shooter 89 - Main Game
   Scene rendering + game flow + input, all driven by a single
   requestAnimationFrame loop on one canvas.

   A first father & son game by Carlos & Diogo Sardo (2026).
   ===================================================================== */
(function () {
  'use strict';
  const PADI = (window.PADI = window.PADI || {});
  const audio = PADI.audio;

  // ----- virtual resolution (everything is drawn in these coordinates) ----
  const VW = 800;
  const VH = 600;

  // ----- the goal mouth and its 9 aiming zones ---------------------------
  const GOAL = { x: 215, y: 150, w: 370, h: 120 };
  const ZONE_COLS = 3;
  const ZONE_ROWS = 3;

  function zoneRect(i) {
    const col = i % ZONE_COLS;
    const row = (i / ZONE_COLS) | 0;
    const w = GOAL.w / ZONE_COLS;
    const h = GOAL.h / ZONE_ROWS;
    return { x: GOAL.x + col * w, y: GOAL.y + row * h, w, h, col, row };
  }
  function zoneCenter(i) {
    const r = zoneRect(i);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }
  function chebyshev(a, b) {
    const ax = a % 3,
      ay = (a / 3) | 0,
      bx = b % 3,
      by = (b / 3) | 0;
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
  }

  // penalty spot (where the ball starts on screen)
  const SPOT = { x: VW / 2, y: 478 };
  // keeper home position
  const KEEPER_HOME = { x: VW / 2, y: GOAL.y + GOAL.h - 8 };

  // power meter bar
  const POWER_BAR = { x: 170, y: 556, w: 460, h: 26 };

  // ----- colors ----------------------------------------------------------
  const COL = {
    skyTop: '#1b6ca8',
    skyBot: '#8ecae6',
    grass1: '#2f9e44',
    grass2: '#37b24d',
    line: '#f8f9fa',
    goalWhite: '#ffffff',
    goalShadow: '#cfd4da',
    net: 'rgba(255,255,255,0.35)',
    keeper: '#ffd23b',
    keeper2: '#e8b800',
    shooter: '#2563eb',
    shooter2: '#1d4ed8',
  };

  // Fallback kits used on the menus / before any team is chosen.
  const KEEPER_FALLBACK = { primary: COL.keeper, secondary: COL.keeper2, text: '#1a1a1a', short: 'GK' };
  const SHOOTER_FALLBACK = { primary: COL.shooter, secondary: COL.shooter2, text: '#ffffff', short: '' };

  // Return a player's chosen team kit, or a sensible fallback kit.
  function kitOf(player, fallback) {
    if (player && player.team) return player.team;
    return fallback || (PADI.Teams && PADI.Teams.DEFAULT) || SHOOTER_FALLBACK;
  }

  // =====================================================================
  //  GAME STATE
  // =====================================================================
  const G = {
    canvas: null,
    ctx: null,
    crowd: null,
    last: 0,
    phase: 'menu', // menu | getready | keeperset | aim | power | shoot | result
    token: 0,
    scale: 1,
    rectCache: null,

    // selection / interaction
    hoverZone: -1,
    selectedZone: -1,
    keeperZone: -1,
    powerValue: 1,
    powerDir: 1,
    powerPhase: 0,
    powerLocked: false,

    // animation
    ball: { x: SPOT.x, y: SPOT.y, scale: 1, visible: true },
    shot: null,
    keeperPose: { x: KEEPER_HOME.x, y: KEEPER_HOME.y, lean: 0, dive: 0, arms: 0 },
    shooterKick: 0,
    particles: [],
    shake: 0,

    banner: null,
    resultText: '',
    resultColor: '#fff',
    canContinue: false,

    match: null,
  };

  // =====================================================================
  //  SET-UP
  // =====================================================================
  function init() {
    G.canvas = document.getElementById('game');
    G.ctx = G.canvas.getContext('2d');
    G.canvas.width = VW;
    G.canvas.height = VH;
    G.ctx.imageSmoothingEnabled = false;

    G.crowd = new PADI.Crowd({
      x: 40,
      y: 18,
      w: VW - 80,
      h: 118,
      shoutCenter: { x: VW / 2, y: VH / 2 }, // support pops up mid-screen
    });

    bindMenus();
    setupTeamPickers();
    bindCanvasInput();
    window.addEventListener('resize', cacheRect);
    cacheRect();

    showScreen('title');
    G.last = performance.now();
    requestAnimationFrame(loop);
  }

  function cacheRect() {
    if (G.canvas) G.rectCache = G.canvas.getBoundingClientRect();
  }

  // =====================================================================
  //  HTML SCREEN / MENU HANDLING
  // =====================================================================
  const SCREENS = ['title', 'setup', 'help', 'leaderboard', 'matchover'];
  function showScreen(name) {
    for (const s of SCREENS) {
      const el = document.getElementById('screen-' + s);
      if (el) el.classList.toggle('hidden', s !== name);
    }
    const overlay = document.getElementById('overlay');
    if (overlay) overlay.classList.toggle('hidden', !name);
    if (name) G.phase = 'menu';
  }

  function bindMenus() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => { tap(); fn(); });
    };

    on('btn-1p', () => openSetup('1p'));
    on('btn-2p', () => openSetup('2p'));
    on('btn-help', () => showScreen('help'));
    on('btn-leaderboard', () => { renderLeaderboard(); showScreen('leaderboard'); });
    on('btn-help-back', () => showScreen('title'));
    on('btn-lb-back', () => showScreen('title'));
    on('btn-lb-clear', () => { PADI.Leaderboard.clear(); renderLeaderboard(); });
    on('btn-setup-back', () => showScreen('title'));
    on('btn-setup-start', startFromSetup);
    on('btn-mo-again', () => { showScreen(null); startMatch(G.lastConfig); });
    on('btn-mo-menu', () => { showScreen('title'); });

    // difficulty buttons
    document.querySelectorAll('[data-diff]').forEach((b) => {
      b.addEventListener('click', () => {
        tap();
        document.querySelectorAll('[data-diff]').forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
        G.setupDiff = b.getAttribute('data-diff');
      });
    });
  }

  function tap() {
    audio.init();
    audio.resume();
    audio.uiClick();
    if (audio.musicEnabled && !audio.musicPlaying) audio.startMusic();
  }

  // ---- team / competition pickers --------------------------------------
  function compIndexById(id) {
    const i = PADI.Teams.competitions.findIndex((c) => c.id === id);
    return i < 0 ? 0 : i;
  }
  function fillCompSelect(sel) {
    if (!sel) return;
    sel.innerHTML = '';
    PADI.Teams.competitions.forEach((c, i) => {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = c.emoji + ' ' + c.name;
      sel.appendChild(o);
    });
  }
  function fillTeamSelect(compSel, teamSel, keepName) {
    if (!compSel || !teamSel) return;
    const comp = PADI.Teams.competitions[+compSel.value] || PADI.Teams.competitions[0];
    teamSel.innerHTML = '';
    comp.teams.forEach((t, i) => {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = t.name;
      teamSel.appendChild(o);
    });
    if (keepName) {
      const idx = comp.teams.findIndex((t) => t.name === keepName);
      if (idx >= 0) teamSel.value = String(idx);
    }
  }
  function readTeam(compId, teamId) {
    const compSel = document.getElementById(compId);
    const teamSel = document.getElementById(teamId);
    if (!compSel || !teamSel) return PADI.Teams.DEFAULT;
    const comp = PADI.Teams.competitions[+compSel.value] || PADI.Teams.competitions[0];
    return comp.teams[+teamSel.value] || comp.teams[0] || PADI.Teams.DEFAULT;
  }
  function setupTeamPickers() {
    const p1c = document.getElementById('p1-comp');
    const p1t = document.getElementById('p1-team');
    const p2c = document.getElementById('p2-comp');
    const p2t = document.getElementById('p2-team');
    if (!p1c || !p2c) return;
    fillCompSelect(p1c);
    fillCompSelect(p2c);
    // fun defaults: a Portugal vs Netherlands World Cup tie :)
    p1c.value = String(compIndexById('wc'));
    p2c.value = String(compIndexById('wc'));
    fillTeamSelect(p1c, p1t, 'Portugal');
    fillTeamSelect(p2c, p2t, 'Netherlands');
    p1c.addEventListener('change', () => { tap(); fillTeamSelect(p1c, p1t); });
    p2c.addEventListener('change', () => { tap(); fillTeamSelect(p2c, p2t); });
    p1t.addEventListener('change', tap);
    p2t.addEventListener('change', tap);
  }

  function openSetup(mode) {
    G.setupMode = mode;
    G.setupDiff = G.setupDiff || 'normal';
    document.getElementById('setup-title').textContent =
      mode === '1p' ? '1 PLAYER vs CPU' : '2 PLAYERS';
    document.getElementById('p2-row').style.display = mode === '2p' ? '' : 'none';
    document.getElementById('diff-row').style.display = mode === '1p' ? '' : 'none';
    const p2TeamLabel = document.getElementById('p2-team-label');
    if (p2TeamLabel)
      p2TeamLabel.textContent =
        (mode === '2p' ? 'Player 2 team' : 'CPU opponent team') +
        ' \u2014 pick a league or cup';
    document.querySelectorAll('[data-diff]').forEach((x) =>
      x.classList.toggle('sel', x.getAttribute('data-diff') === G.setupDiff)
    );
    const p1 = document.getElementById('p1-name');
    const p2 = document.getElementById('p2-name');
    if (!p1.value) p1.value = 'PAPA';
    if (!p2.value) p2.value = 'DIOGO';
    showScreen('setup');
  }

  function startFromSetup() {
    const p1 = (document.getElementById('p1-name').value || 'PAPA').toUpperCase();
    const p2 = (document.getElementById('p2-name').value || 'DIOGO').toUpperCase();
    const cfg = {
      mode: G.setupMode,
      difficulty: G.setupDiff || 'normal',
      p1Name: p1.slice(0, 10),
      p2Name: G.setupMode === '2p' ? p2.slice(0, 10) : 'CPU',
      p1Team: readTeam('p1-comp', 'p1-team'),
      p2Team: readTeam('p2-comp', 'p2-team'),
    };
    showScreen(null);
    startMatch(cfg);
  }

  // =====================================================================
  //  MATCH LIFECYCLE
  // =====================================================================
  function startMatch(cfg) {
    G.lastConfig = cfg;
    audio.init();
    audio.resume();
    if (audio.musicEnabled && !audio.musicPlaying) audio.startMusic();

    G.match = {
      mode: cfg.mode,
      difficulty: cfg.difficulty || 'normal',
      players: [
        { name: cfg.p1Name, isCPU: false, goals: 0, taken: 0, team: cfg.p1Team || PADI.Teams.DEFAULT },
        { name: cfg.p2Name, isCPU: cfg.mode === '1p', goals: 0, taken: 0, team: cfg.p2Team || PADI.Teams.DEFAULT },
      ],
      round: 1,
      maxRounds: 5,
      half: 0, // 0 -> player0 shoots, 1 -> player1 shoots
      suddenDeath: false,
      decided: false,
    };
    G.crowd.react('idle');
    nextPenalty(true);
  }

  function shooterIndex() {
    return G.match.half;
  }
  function keeperIndex() {
    return 1 - G.match.half;
  }
  function shooter() {
    return G.match.players[shooterIndex()];
  }
  function keeper() {
    return G.match.players[keeperIndex()];
  }

  // Decide whether the shoot-out is mathematically over.
  function checkDecided() {
    const m = G.match;
    const a = m.players[0],
      b = m.players[1];
    if (!m.suddenDeath) {
      if (m.round > m.maxRounds) {
        if (a.goals !== b.goals) return true;
        m.suddenDeath = true; // go to sudden death
        return false;
      }
      return false;
    }
    // sudden death: decided only when both took the same number and differ
    if (a.taken === b.taken && a.taken >= m.maxRounds && a.goals !== b.goals)
      return true;
    return false;
  }

  function nextPenalty(first) {
    const m = G.match;
    if (!first) {
      // advance turn order
      if (m.half === 0) {
        m.half = 1;
      } else {
        m.half = 0;
        m.round++;
      }
    }
    if (checkDecided()) {
      matchOver();
      return;
    }
    // reset entities
    G.selectedZone = -1;
    G.keeperZone = -1;
    G.hoverZone = -1;
    G.powerValue = 1;
    G.powerLocked = false;
    G.ball.x = SPOT.x;
    G.ball.y = SPOT.y;
    G.ball.scale = 1;
    G.ball.visible = true;
    G.keeperPose = { x: KEEPER_HOME.x, y: KEEPER_HOME.y, lean: 0, dive: 0, arms: 0 };
    G.shooterKick = 0;
    G.shot = null;
    G.canContinue = false;

    const sh = shooter();
    const roundLabel = m.suddenDeath ? 'SUDDEN DEATH' : 'ROUND ' + m.round + '/' + m.maxRounds;
    setBanner(roundLabel + '  -  ' + sh.name + ' (' + kitOf(sh).short + ') SHOOTS', 1.4);
    setPhase('getready');
    delay(1300, () => beginKeeperPhase());
  }

  function matchOver() {
    G.match.decided = true;
    setPhase('menu');
    audio.whistle(3);
    const m = G.match;
    const a = m.players[0],
      b = m.players[1];
    const p1Win = a.goals > b.goals;
    const winner = p1Win ? a : b;

    // save human results to the leaderboard
    [0, 1].forEach((i) => {
      const p = m.players[i];
      const opp = m.players[1 - i];
      if (!p.isCPU) {
        PADI.Leaderboard.add({
          name: p.name,
          goals: p.goals,
          against: opp.goals,
          opponent: opp.name,
          mode: m.mode.toUpperCase(),
          win: p.goals > opp.goals ? 1 : 0,
        });
      }
    });

    document.getElementById('mo-result').textContent =
      a.goals === b.goals ? 'DRAW!' : winner.name + ' WINS!';
    document.getElementById('mo-score').textContent =
      a.name + '  ' + a.goals + '  -  ' + b.goals + '  ' + b.name;
    showScreen('matchover');
  }

  // =====================================================================
  //  PENALTY FLOW
  // =====================================================================
  function setPhase(p) {
    G.phase = p;
    G.token++;
  }

  function delay(ms, fn) {
    const tk = G.token;
    setTimeout(() => {
      if (tk === G.token) fn();
    }, ms);
  }

  function beginKeeperPhase() {
    setPhase('keeperset');
    audio.whistle(2); // referee signals the penalty
    const k = keeper();
    if (k.isCPU) {
      setBanner('CPU IS GETTING READY...', 0);
      G.keeperGuessCPU = cpuKeeperGuess();
      delay(750, () => beginAimPhase());
    } else {
      // human keeper picks a dive (hidden from the shooter)
      setBanner(k.name + ': PICK YOUR DIVE!  (shooter, look away)', 0);
    }
  }

  function onKeeperPick(zone) {
    if (G.phase !== 'keeperset') return;
    const k = keeper();
    if (k.isCPU) return;
    G.keeperZone = zone;
    audio.uiSelect();
    setBanner('DIVE LOCKED IN!', 0.8);
    delay(650, () => beginAimPhase());
  }

  function beginAimPhase() {
    setPhase('aim');
    const sh = shooter();
    if (sh.isCPU) {
      setBanner('CPU IS AIMING...', 0);
      const z = cpuShooterZone();
      delay(700, () => {
        G.selectedZone = z;
        audio.uiSelect();
        const pw = cpuShooterPower();
        delay(450, () => doShoot(z, pw));
      });
    } else {
      setBanner(sh.name + ': TAP A TARGET IN THE GOAL', 0);
    }
  }

  function onAimPick(zone) {
    if (G.phase !== 'aim') return;
    if (shooter().isCPU) return;
    G.selectedZone = zone;
    audio.uiSelect();
    beginPowerPhase();
  }

  function beginPowerPhase() {
    setPhase('power');
    G.powerValue = 1;
    G.powerPhase = 0;
    G.powerDir = 1;
    G.powerLocked = false;
    setBanner(shooter().name + ': TAP TO SET POWER!', 0);
  }

  function onPowerLock() {
    if (G.phase !== 'power' || G.powerLocked) return;
    G.powerLocked = true;
    audio.powerLock();
    doShoot(G.selectedZone, Math.round(G.powerValue));
  }

  // =====================================================================
  //  CPU BRAINS
  // =====================================================================
  function diffParams() {
    const d = G.match.difficulty;
    if (d === 'easy') return { read: 0.05, smart: 0.1, pmin: 40, pmax: 100 };
    if (d === 'hard') return { read: 0.4, smart: 0.55, pmin: 65, pmax: 96 };
    return { read: 0.2, smart: 0.32, pmin: 55, pmax: 92 }; // normal
  }

  // CPU keeper makes a hidden guess; real keepers rarely fully commit high.
  function cpuKeeperGuess() {
    // weight toward mid/low zones
    const weights = [0.6, 0.5, 0.6, 1, 0.9, 1, 1.1, 1, 1.1];
    return weightedPick(weights);
  }

  function cpuShooterZone() {
    const p = diffParams();
    // smart CPU avoids the human keeper's committed zone
    if (Math.random() < p.smart && G.keeperZone >= 0) {
      const corners = [0, 2, 6, 8].filter((z) => chebyshev(z, G.keeperZone) >= 2);
      const pool = corners.length ? corners : [0, 2, 6, 8];
      return pool[(Math.random() * pool.length) | 0];
    }
    // otherwise favour corners a bit
    const weights = [1.3, 0.8, 1.3, 1, 0.6, 1, 1.2, 0.9, 1.2];
    return weightedPick(weights);
  }

  function cpuShooterPower() {
    const p = diffParams();
    return Math.round(p.pmin + Math.random() * (p.pmax - p.pmin));
  }

  function weightedPick(weights) {
    let total = 0;
    for (const w of weights) total += w;
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }

  // =====================================================================
  //  SHOT RESOLUTION
  // =====================================================================
  function resolveOutcome(shotZone, keeperZone, power) {
    const p = power / 100;
    const col = shotZone % 3;
    const row = (shotZone / 3) | 0;

    // chance the ball flies off target — depends only on AIM, not power.
    // Going for the corners (sides/top) is riskier, but blasting the ball at
    // full power never makes you miss: a hard, well-aimed shot is rewarded.
    let missCh = 0.02;
    if (col !== 1) missCh += 0.05;
    if (row === 0) missCh += 0.06;
    if (Math.random() < missCh) return 'miss';

    const dist = chebyshev(shotZone, keeperZone);
    // The keeper dived to the SAME zone as the on-target shot: the ball flies
    // straight into the keeper, so it is ALWAYS a save. This keeps the result
    // consistent with what the player sees on screen.
    if (dist === 0) return 'save';
    let save = 0;
    if (dist === 1) save = 0.20 - p * 0.10; // adjacent: a fingertip save sometimes
    if (row === 0) save *= 0.6; // high shots are harder to stop
    if (Math.random() < Math.max(0, save)) return 'save';
    return 'goal';
  }

  function doShoot(zone, power) {
    setPhase('shoot');
    const k = keeper();
    let keeperZone;
    if (k.isCPU) {
      const p = diffParams();
      // a skilled CPU keeper sometimes "reads" the shot
      keeperZone = Math.random() < p.read ? zone : G.keeperGuessCPU;
    } else {
      keeperZone = G.keeperZone;
    }
    G.keeperZone = keeperZone;

    const outcome = resolveOutcome(zone, keeperZone, power);
    const target = computeBallTarget(zone, outcome, keeperZone);

    G.shot = {
      zone,
      keeperZone,
      power,
      outcome,
      t: 0,
      dur: 0.62 - (power / 100) * 0.18, // harder = faster
      from: { x: SPOT.x, y: SPOT.y },
      to: target,
      arc: 60 + (power / 100) * 30,
      resolved: false,
      keeperT: 0,
    };
    G.shooterKick = 0.001; // trigger kick animation
    audio.kick();
  }

  function computeBallTarget(zone, outcome, keeperZone) {
    const c = zoneCenter(zone);
    if (outcome === 'miss') {
      const col = zone % 3;
      const row = (zone / 3) | 0;
      if (col === 0) return { x: GOAL.x - 34, y: c.y };
      if (col === 2) return { x: GOAL.x + GOAL.w + 34, y: c.y };
      return { x: c.x + (Math.random() < 0.5 ? -20 : 20), y: GOAL.y - 40 };
    }
    if (outcome === 'save') {
      const kc = zoneCenter(keeperZone);
      return { x: (c.x + kc.x) / 2, y: (c.y + kc.y) / 2 };
    }
    return c; // goal
  }

  // =====================================================================
  //  MAIN LOOP
  // =====================================================================
  function loop(now) {
    const dt = Math.min(0.05, (now - G.last) / 1000);
    G.last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    if (G.crowd) G.crowd.update(dt);

    // power meter oscillation
    if (G.phase === 'power' && !G.powerLocked) {
      G.powerPhase += dt * 1.6; // ~ full sweep speed
      const v = (Math.sin(G.powerPhase * Math.PI - Math.PI / 2) + 1) / 2;
      G.powerValue = 1 + v * 99;
    }

    // shooter kick animation
    if (G.shooterKick > 0) {
      G.shooterKick += dt;
      if (G.shooterKick > 0.4) G.shooterKick = 0;
    }

    // shot animation
    if (G.shot && G.phase === 'shoot') {
      const s = G.shot;
      s.t += dt;
      const p = Math.min(1, s.t / s.dur);
      // ball position with an arc
      G.ball.x = lerp(s.from.x, s.to.x, p);
      const baseY = lerp(s.from.y, s.to.y, p);
      G.ball.y = baseY - Math.sin(p * Math.PI) * s.arc * 0.4;
      G.ball.scale = lerp(1, 0.42, p); // perspective shrink
      // keeper dive
      const kc = zoneCenter(s.keeperZone);
      const kp = Math.min(1, p * 1.15);
      G.keeperPose.x = lerp(KEEPER_HOME.x, kc.x, easeOut(kp));
      G.keeperPose.y = lerp(KEEPER_HOME.y, KEEPER_HOME.y + (kc.y - GOAL.y - GOAL.h) * 0.3, easeOut(kp));
      G.keeperPose.dive = (kc.x - KEEPER_HOME.x) / (GOAL.w / 2);
      G.keeperPose.lean = G.keeperPose.dive * 0.5;
      G.keeperPose.arms = kp;

      if (p >= 1 && !s.resolved) {
        s.resolved = true;
        finishShot();
      }
    }

    // particles
    for (let i = G.particles.length - 1; i >= 0; i--) {
      const pt = G.particles[i];
      pt.life += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 400 * dt;
      if (pt.life >= pt.max) G.particles.splice(i, 1);
    }

    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 3);
    if (G.banner && G.banner.time > 0) {
      G.banner.life += dt;
      if (G.banner.life >= G.banner.time) G.banner = null;
    }
  }

  function finishShot() {
    const s = G.shot;
    const sh = shooter();
    sh.taken++;
    if (s.outcome === 'goal') {
      sh.goals++;
      G.resultText = 'G O A L ! ! !';
      G.resultColor = '#ffe600';
      audio.goal();
      G.crowd.react('goal');
      G.shake = 1;
      spawnNetBurst(zoneCenter(s.zone));
    } else if (s.outcome === 'save') {
      G.resultText = 'SAVED!';
      G.resultColor = '#7ad7ff';
      audio.save();
      G.crowd.react('save');
      G.ball.visible = true;
    } else {
      G.resultText = 'MISSED!';
      G.resultColor = '#ff6b6b';
      audio.miss();
      G.crowd.react('miss');
    }
    setPhase('result');
    G.canContinue = false;
    delay(700, () => {
      G.canContinue = true;
    });
    delay(2600, () => advanceAfterResult());
  }

  function advanceAfterResult() {
    if (G.phase !== 'result') return;
    nextPenalty(false);
  }

  function onResultTap() {
    if (G.phase !== 'result' || !G.canContinue) return;
    nextPenalty(false);
  }

  function spawnNetBurst(c) {
    for (let i = 0; i < 22; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 160;
      G.particles.push({
        x: c.x,
        y: c.y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 60,
        size: 2 + Math.random() * 3,
        color: ['#fff', '#ffe600', '#7ad7ff'][(Math.random() * 3) | 0],
        life: 0,
        max: 0.7 + Math.random() * 0.5,
      });
    }
  }

  // =====================================================================
  //  RENDERING
  // =====================================================================
  function draw() {
    const ctx = G.ctx;
    ctx.save();
    if (G.shake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * 8 * G.shake,
        (Math.random() - 0.5) * 8 * G.shake
      );
    }

    drawSky(ctx);
    drawStands(ctx);
    G.crowd.draw(ctx);
    drawField(ctx);
    drawGoal(ctx);
    drawKeeper(ctx);
    drawShooter(ctx);
    drawBall(ctx);
    drawParticles(ctx);
    G.crowd.drawConfetti(ctx);

    // gameplay overlays
    if (G.phase === 'keeperset' && !keeper().isCPU) drawZones(ctx, 'keeper');
    if (G.phase === 'aim' && !shooter().isCPU) drawZones(ctx, 'aim');
    if (G.phase === 'aim' && shooter().isCPU && G.selectedZone >= 0)
      highlightZone(ctx, G.selectedZone, 'rgba(255,80,80,0.4)');
    if (G.phase === 'power') drawPowerMeter(ctx);

    if (G.match && !G.match.decided && G.phase !== 'menu') drawHUD(ctx);
    drawBanner(ctx);
    if (G.phase === 'result') drawResult(ctx);
    G.crowd.drawShouts(ctx); // supportive shouts on top, in the middle
    drawTopButtons(ctx);

    ctx.restore();
  }

  function drawSky(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, GOAL.y + 40);
    g.addColorStop(0, COL.skyTop);
    g.addColorStop(1, COL.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
  }

  function drawStands(ctx) {
    // dark stadium band behind the crowd
    ctx.fillStyle = '#21304a';
    ctx.fillRect(0, 0, VW, 140);
    // seat rows
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 16; y < 140; y += 16) ctx.fillRect(0, y, VW, 2);
    // advertising hoarding
    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(0, 140, VW, 14);
    ctx.fillStyle = '#ffd23b';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('* PADI SHOOTER 89 *  PAPA & DIOGO  * PADI SHOOTER 89 *', VW / 2, 151);
  }

  function drawField(ctx) {
    const top = 154;
    // perspective stripes
    let stripe = 0;
    for (let y = top; y < VH; y += 1) {
      const t = (y - top) / (VH - top);
      stripe = Math.floor((y - top) / (10 + t * 26));
      ctx.fillStyle = stripe % 2 === 0 ? COL.grass1 : COL.grass2;
      ctx.fillRect(0, y, VW, 1);
    }
    // penalty box + arc + spot
    ctx.strokeStyle = COL.line;
    ctx.lineWidth = 3;
    // goal line
    ctx.beginPath();
    ctx.moveTo(0, top + 2);
    ctx.lineTo(VW, top + 2);
    ctx.stroke();
    // box (trapezoid for perspective)
    ctx.beginPath();
    ctx.moveTo(150, top + 2);
    ctx.lineTo(110, 360);
    ctx.lineTo(VW - 110, 360);
    ctx.lineTo(VW - 150, top + 2);
    ctx.stroke();
    // six yard box
    ctx.beginPath();
    ctx.moveTo(280, top + 2);
    ctx.lineTo(265, 235);
    ctx.lineTo(VW - 265, 235);
    ctx.lineTo(VW - 280, top + 2);
    ctx.stroke();
    // penalty arc
    ctx.beginPath();
    ctx.arc(SPOT.x, 392, 70, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    // penalty spot
    ctx.fillStyle = COL.line;
    ctx.beginPath();
    ctx.arc(SPOT.x, 470, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGoal(ctx) {
    const x = GOAL.x,
      y = GOAL.y,
      w = GOAL.w,
      h = GOAL.h;
    const depth = 16;
    // net (back)
    ctx.fillStyle = 'rgba(20,40,60,0.25)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = COL.net;
    ctx.lineWidth = 1;
    for (let gx = x; gx <= x + w; gx += 12) {
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + h);
      ctx.stroke();
    }
    for (let gy = y; gy <= y + h; gy += 12) {
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }
    // white painted frame (the "goolie")
    ctx.lineCap = 'round';
    // posts + crossbar with a little 3D edge
    ctx.fillStyle = COL.goalShadow;
    ctx.fillRect(x - 8 + 3, y - 8 + 3, 8, h + 16);
    ctx.fillRect(x + w + 3, y - 8 + 3, 8, h + 16);
    ctx.fillRect(x - 8 + 3, y - 8 + 3, w + 16, 8);
    ctx.fillStyle = COL.goalWhite;
    ctx.fillRect(x - 8, y - 8, 8, h + 16); // left post
    ctx.fillRect(x + w, y - 8, 8, h + 16); // right post
    ctx.fillRect(x - 8, y - 8, w + 16, 8); // crossbar
  }

  function drawKeeper(ctx) {
    const k = G.keeperPose;
    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.rotate(k.lean * 0.5);
    const reach = k.arms;
    const kit = kitOf(G.match ? keeper() : null, KEEPER_FALLBACK);
    // legs
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4, -2);
    ctx.lineTo(-8 - reach * 14, 18);
    ctx.moveTo(4, -2);
    ctx.lineTo(8 + reach * 14, 18);
    ctx.stroke();
    // body (keeper jersey, team kit)
    ctx.fillStyle = kit.primary;
    ctx.fillRect(-9, -34, 18, 34);
    ctx.fillStyle = kit.secondary;
    ctx.fillRect(-9, -20, 18, 4);
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 2;
    ctx.strokeRect(-9, -34, 18, 34);
    // arms reaching out for the dive
    ctx.strokeStyle = kit.primary;
    ctx.lineWidth = 6;
    const armSpread = 12 + reach * 30;
    const dir = k.dive >= 0 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(dir * armSpread, -34 - reach * 10);
    ctx.moveTo(0, -26);
    ctx.lineTo(-dir * (armSpread * 0.5), -20 + reach * 6);
    ctx.stroke();
    // gloves
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(dir * armSpread, -34 - reach * 10, 4, 0, Math.PI * 2);
    ctx.fill();
    // head
    ctx.fillStyle = '#ffd9b3';
    ctx.beginPath();
    ctx.arc(0, -40, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawShooter(ctx) {
    // shooter stands just behind the ball, seen from behind
    const baseX = SPOT.x - 26;
    const baseY = 520;
    const kick = G.shooterKick > 0 ? Math.sin(Math.min(1, G.shooterKick / 0.2) * Math.PI) : 0;
    const kit = kitOf(G.match ? shooter() : null, SHOOTER_FALLBACK);
    ctx.save();
    ctx.translate(baseX, baseY);
    // legs (one kicks toward the ball)
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2, -4);
    ctx.lineTo(-8, 26);
    ctx.moveTo(2, -4);
    ctx.lineTo(14 + kick * 22, 14 - kick * 16);
    ctx.stroke();
    // body
    ctx.fillStyle = kit.primary;
    ctx.fillRect(-11, -40, 22, 38);
    ctx.fillStyle = kit.secondary;
    ctx.fillRect(-11, -26, 22, 5);
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 2;
    ctx.strokeRect(-11, -40, 22, 38);
    // number
    ctx.fillStyle = kit.text;
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('89', 0, -18);
    // arms
    ctx.strokeStyle = kit.primary;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-9, -34);
    ctx.lineTo(-18 - kick * 6, -20);
    ctx.moveTo(9, -34);
    ctx.lineTo(18, -22);
    ctx.stroke();
    // head
    ctx.fillStyle = '#ffd9b3';
    ctx.beginPath();
    ctx.arc(0, -46, 8, 0, Math.PI * 2);
    ctx.fill();
    // hair
    ctx.fillStyle = '#3b2a1a';
    ctx.fillRect(-8, -54, 16, 5);
    ctx.restore();
  }

  function drawBall(ctx) {
    if (!G.ball.visible) return;
    const r = 11 * G.ball.scale;
    ctx.save();
    ctx.translate(G.ball.x, G.ball.y);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.9, r, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // ball
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // retro pentagons
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
    for (let a = 0; a < 5; a++) {
      const ang = (a / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(Math.cos(ang) * r * 0.62, Math.sin(ang) * r * 0.62, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawParticles(ctx) {
    for (const p of G.particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  // ---- interactive zones -----------------------------------------------
  function drawZones(ctx, mode) {
    const accent = mode === 'keeper' ? '#7ad7ff' : '#ffd23b';
    const hotFill =
      mode === 'keeper' ? 'rgba(122,215,255,0.55)' : 'rgba(255,80,80,0.55)';
    const pulse = 0.5 + 0.5 * Math.sin(G.crowd.time * 6);
    for (let i = 0; i < 9; i++) {
      const r = zoneRect(i);
      const hot = i === G.hoverZone;
      // zone tint
      ctx.fillStyle = hot ? hotFill : 'rgba(0,0,0,0.18)';
      ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
      // bold coloured border so it stands out from the white net
      ctx.strokeStyle = accent;
      ctx.lineWidth = hot ? 3 : 2;
      ctx.strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
      // bullseye target at the centre
      const c = zoneCenter(i);
      const rad = hot ? 11 + pulse * 3 : 9;
      ctx.lineWidth = 2;
      ctx.strokeStyle = hot ? '#fff' : accent;
      ctx.beginPath();
      ctx.arc(c.x, c.y, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = hot ? '#fff' : accent;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(c.x - rad - 3, c.y);
      ctx.lineTo(c.x - rad + 2, c.y);
      ctx.moveTo(c.x + rad - 2, c.y);
      ctx.lineTo(c.x + rad + 3, c.y);
      ctx.moveTo(c.x, c.y - rad - 3);
      ctx.lineTo(c.x, c.y - rad + 2);
      ctx.moveTo(c.x, c.y + rad - 2);
      ctx.lineTo(c.x, c.y + rad + 3);
      ctx.stroke();
    }
  }

  function highlightZone(ctx, i, color) {
    const r = zoneRect(i);
    ctx.fillStyle = color;
    ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
  }

  function drawPowerMeter(ctx) {
    const b = POWER_BAR;
    // frame
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(b.x - 6, b.y - 22, b.w + 12, b.h + 42);
    ctx.fillStyle = '#000';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // gradient fill green -> yellow -> red
    const grad = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
    grad.addColorStop(0, '#37b24d');
    grad.addColorStop(0.6, '#ffd23b');
    grad.addColorStop(1, '#ef233c');
    const w = (G.powerValue / 100) * b.w;
    ctx.fillStyle = grad;
    ctx.fillRect(b.x, b.y, w, b.h);
    // moving marker
    ctx.fillStyle = '#fff';
    ctx.fillRect(b.x + w - 2, b.y - 4, 4, b.h + 8);
    // label
    ctx.fillStyle = '#fff';
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('POWER ' + Math.round(G.powerValue) + '%', VW / 2, b.y - 8);
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillText('TAP ANYWHERE TO SHOOT', VW / 2, b.y + b.h + 14);
  }

  // ---- HUD --------------------------------------------------------------
  function drawHUD(ctx) {
    const m = G.match;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(8, 160, VW - 16, 26);
    ctx.font = '11px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = shooterIndex() === 0 ? '#ffd23b' : '#fff';
    ctx.fillText(m.players[0].name + ' ' + m.players[0].goals, 18, 178);
    ctx.textAlign = 'right';
    ctx.fillStyle = shooterIndex() === 1 ? '#ffd23b' : '#fff';
    ctx.fillText(m.players[1].goals + ' ' + m.players[1].name, VW - 18, 178);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    const label = m.suddenDeath ? 'SUDDEN DEATH' : 'ROUND ' + m.round + '/' + m.maxRounds;
    ctx.fillText(label, VW / 2, 178);
    // role tags + team badge colour
    ctx.font = '8px "Press Start 2P", monospace';
    const t0 = kitOf(m.players[0]);
    const t1 = kitOf(m.players[1]);
    ctx.lineWidth = 1;
    ctx.fillStyle = t0.primary;
    ctx.fillRect(18, 182, 8, 8);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(18, 182, 8, 8);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7ad7ff';
    ctx.fillText((shooterIndex() === 0 ? 'SHOOTER' : 'KEEPER') + ' ' + t0.short, 30, 189);
    ctx.fillStyle = t1.primary;
    ctx.fillRect(VW - 26, 182, 8, 8);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(VW - 26, 182, 8, 8);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#7ad7ff';
    ctx.fillText(t1.short + ' ' + (shooterIndex() === 1 ? 'SHOOTER' : 'KEEPER'), VW - 30, 189);
  }

  function setBanner(text, time) {
    G.banner = { text, time: time || 0, life: 0 };
  }

  function drawBanner(ctx) {
    if (!G.banner) return;
    ctx.font = '13px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    const w = ctx.measureText(G.banner.text).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(VW / 2 - w / 2, 200, w, 30);
    ctx.fillStyle = '#fff';
    ctx.fillText(G.banner.text, VW / 2, 220);
  }

  function drawResult(ctx) {
    ctx.font = '30px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    const txt = G.resultText;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 280, VW, 70);
    ctx.fillStyle = '#000';
    ctx.fillText(txt, VW / 2 + 3, 327);
    ctx.fillStyle = G.resultColor;
    ctx.fillText(txt, VW / 2, 324);
    if (G.canContinue) {
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText('TAP TO CONTINUE', VW / 2, 360);
    }
  }

  // ---- top corner buttons (mute / menu) --------------------------------
  function muteRect() {
    return { x: VW - 44, y: 8, w: 36, h: 28 };
  }
  function menuRect() {
    return { x: 8, y: 8, w: 70, h: 28 };
  }
  function drawTopButtons(ctx) {
    const mr = muteRect();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(mr.x, mr.y, mr.w, mr.h);
    ctx.fillStyle = '#fff';
    ctx.font = '13px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(audio.muted ? 'X' : '♪', mr.x + mr.w / 2, mr.y + 20);

    if (G.match && !G.match.decided && G.phase !== 'menu') {
      const br = menuRect();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(br.x, br.y, br.w, br.h);
      ctx.fillStyle = '#fff';
      ctx.font = '9px "Press Start 2P", monospace';
      ctx.fillText('MENU', br.x + br.w / 2, br.y + 18);
    }
  }

  // =====================================================================
  //  INPUT
  // =====================================================================
  function bindCanvasInput() {
    const cv = G.canvas;
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const p = toVirtual(e.clientX, e.clientY);
      handlePointer(p.x, p.y, true);
    });
    cv.addEventListener('pointermove', (e) => {
      const p = toVirtual(e.clientX, e.clientY);
      handleHover(p.x, p.y);
    });
    cv.addEventListener('pointerleave', () => {
      G.hoverZone = -1;
    });
    window.addEventListener('keydown', onKey);
  }

  function toVirtual(clientX, clientY) {
    const r = G.canvas.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * VW,
      y: ((clientY - r.top) / r.height) * VH,
    };
  }

  function pointInRect(x, y, r) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  function zoneAt(x, y) {
    for (let i = 0; i < 9; i++) {
      if (pointInRect(x, y, zoneRect(i))) return i;
    }
    return -1;
  }

  function handleHover(x, y) {
    if (G.phase === 'aim' && !shooter().isCPU) G.hoverZone = zoneAt(x, y);
    else if (G.phase === 'keeperset' && !keeper().isCPU) G.hoverZone = zoneAt(x, y);
    else G.hoverZone = -1;
  }

  function handlePointer(x, y) {
    // top buttons first
    if (pointInRect(x, y, muteRect())) {
      audio.init();
      audio.toggleMute();
      return;
    }
    if (G.match && !G.match.decided && G.phase !== 'menu' && pointInRect(x, y, menuRect())) {
      audio.uiClick();
      G.match.decided = true;
      showScreen('title');
      return;
    }

    switch (G.phase) {
      case 'keeperset': {
        if (keeper().isCPU) return;
        const z = zoneAt(x, y);
        if (z >= 0) onKeeperPick(z);
        break;
      }
      case 'aim': {
        if (shooter().isCPU) return;
        const z = zoneAt(x, y);
        if (z >= 0) onAimPick(z);
        break;
      }
      case 'power': {
        onPowerLock();
        break;
      }
      case 'result': {
        onResultTap();
        break;
      }
    }
  }

  function onKey(e) {
    if (G.phase === 'power' && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      onPowerLock();
    } else if (G.phase === 'result' && (e.key === ' ' || e.key === 'Enter')) {
      onResultTap();
    } else if (e.key === 'm' || e.key === 'M') {
      audio.init();
      audio.toggleMute();
    }
  }

  // ---- small math helpers ----------------------------------------------
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function easeOut(t) {
    return 1 - Math.pow(1 - t, 2);
  }

  // ---- leaderboard rendering -------------------------------------------
  function renderLeaderboard() {
    const list = PADI.Leaderboard.top(12);
    const box = document.getElementById('lb-list');
    if (!box) return;
    if (!list.length) {
      box.innerHTML = '<p class="lb-empty">No scores yet. Be the first!</p>';
      return;
    }
    let html = '<table class="lb-table"><tr><th>#</th><th>NAME</th><th>GOALS</th><th>VS</th><th>RES</th></tr>';
    list.forEach((e, i) => {
      html +=
        '<tr><td>' + (i + 1) + '</td><td>' + esc(e.name) + '</td><td>' + e.goals +
        '</td><td>' + e.against + '</td><td>' + (e.win ? 'WIN' : '-') + '</td></tr>';
    });
    html += '</table>';
    box.innerHTML = html;
  }

  function esc(s) {
    return String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  }

  PADI.game = { init, startMatch, showScreen };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
