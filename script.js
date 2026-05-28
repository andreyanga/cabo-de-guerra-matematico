/* ═══════════════════════════════════════════════════════
   TUG OF WAR: MATHEMATICS — TIS AO  |  script.js v3.0
   Corrigido para funcionar com SVG do HTML/CSS v3.0
   - Animações via classes CSS no SVG
   - Corda move via atributo "d" do SVG path
   - Bandeira move via transform no SVG
   - Personagens movem-se com translateX no SVG
═══════════════════════════════════════════════════════ */
'use strict';

// ────────────────────────────────────────
// 1. ESTADO GLOBAL
// ────────────────────────────────────────
const G = {
  t1Name: 'Team 1', t2Name: 'Team 2',
  operation: 'add', ageGroup: '5-7',
  customMax: 50,
  totalTime: 120,
  winScore: 5,

  score1: 0, score2: 0,
  ans1: '', ans2: '',
  q1: null, q2: null,
  timer: null, timeLeft: 120,
  running: false,
  soundOn: true,

  // ropePos: negativo=team1 lidera, positivo=team2 lidera
  ropePos: 0,

  ranking: JSON.parse(localStorage.getItem('tis_tow_rank') || '[]'),
};

// ────────────────────────────────────────
// 2. PARÂMETROS POR IDADE
// ────────────────────────────────────────
const AGE = { '5-7': 10, '8-10': 50, '11-14': 100, 'custom': null };

function maxVal() {
  return G.ageGroup === 'custom' ? G.customMax : AGE[G.ageGroup];
}

// ────────────────────────────────────────
// 3. SOM (Web Audio API)
// ────────────────────────────────────────
let _actx = null;
function actx() {
  if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
  return _actx;
}
function tone(freq, type = 'sine', dur = 0.14, gain = 0.32) {
  if (!G.soundOn) return;
  try {
    const c = actx(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.start(); o.stop(c.currentTime + dur);
  } catch (e) {}
}
const SFX = {
  tap:     () => tone(440, 'square', 0.06, 0.1),
  correct: () => { tone(880, 'sine', 0.1); setTimeout(() => tone(1100, 'sine', 0.14), 100); },
  wrong:   () => tone(150, 'sawtooth', 0.22, 0.28),
  tick:    () => tone(660, 'triangle', 0.08, 0.2),
  win:     () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 'sine', 0.3, 0.5), i * 110)); },
  timeout: () => tone(200, 'sawtooth', 0.45, 0.35),
};

// ────────────────────────────────────────
// 4. GERADOR DE QUESTÕES
// ────────────────────────────────────────
function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

function genQ() {
  const ops = G.operation === 'mix'
    ? ['add', 'sub', 'mul', 'div']
    : [G.operation];
  const op = ops[rand(0, ops.length - 1)];
  const mx = maxVal();
  let a, b, text, ans;

  switch (op) {
    case 'add':
      a = rand(1, mx); b = rand(1, mx);
      text = `${a} + ${b} = ?`; ans = a + b; break;
    case 'sub':
      a = rand(1, mx); b = rand(1, a);
      text = `${a} − ${b} = ?`; ans = a - b; break;
    case 'mul':
      a = rand(1, Math.min(mx, 12)); b = rand(1, Math.min(mx, 12));
      text = `${a} × ${b} = ?`; ans = a * b; break;
    case 'div':
      b = rand(1, Math.min(mx, 12)); ans = rand(1, Math.min(mx, 12));
      a = b * ans;
      text = `${a} ÷ ${b} = ?`; break;
    default:
      a = rand(1, mx); b = rand(1, mx);
      text = `${a} + ${b} = ?`; ans = a + b;
  }
  return { text, ans };
}

// ────────────────────────────────────────
// 5. DOM REFS
// ────────────────────────────────────────
const $ = id => document.getElementById(id);

const D = {
  // Screens
  sSetup: $('screen-setup'),
  sGame:  $('screen-game'),
  sVic:   $('screen-victory'),

  // Setup inputs
  inT1:      $('inp-t1'),
  inT2:      $('inp-t2'),
  inCmax:    $('inp-cmax'),
  customBox: $('custom-box'),
  btnPlay:   $('btn-play'),

  // Header
  btnHome: $('btn-home'),

  // Team badges
  bnT1: $('bname-t1'), bnT2: $('bname-t2'),
  bsT1: $('bscore-t1'), bsT2: $('bscore-t2'),

  // Questions
  qT1: $('qt1'), qT2: $('qt2'),

  // Answer displays
  adT1: $('ad-t1'), adT2: $('ad-t2'),
  abT1: $('ab-t1'), abT2: $('ab-t2'),

  // Scoreboard
  sbN1: $('sb-name1'), sbN2: $('sb-name2'),
  sbV1: $('sb-val1'), sbV2: $('sb-val2'),
  timerVal: $('timer-val'),

  // SVG elements (corda e personagens)
  arenaSvg:      $('arena-svg'),
  ropeMain:      $('rope-main'),
  ropeShadow:    $('rope-shadow'),
  ropeHighlight: $('rope-highlight'),
  ropeFlag:      $('rope-flag'),
  char1a:        $('char-1a'),
  char1b:        $('char-1b'),
  char2a:        $('char-2a'),
  char2b:        $('char-2b'),

  // Barra de progresso
  rpBlue: $('rp-blue'),
  rpRed:  $('rp-red'),

  // Colunas (shake)
  colT1: $('col-t1'),
  colT2: $('col-t2'),

  // Botões arena
  btnSettings: $('btn-settings'),
  btnSound:    $('btn-sound'),

  // Victory screen
  vTitle:    $('v-title'),
  vSub:      $('v-sub'),
  vsV1:      $('vs-v1'), vsV2: $('vs-v2'),
  vsN1:      $('vs-n1'), vsN2: $('vs-n2'),
  rankList:  $('rank-list'),
  vbtnAgain: $('vbtn-again'),
  vbtnCfg:   $('vbtn-config'),
};

// ────────────────────────────────────────
// 6. GRUPOS DE OPÇÕES (Setup)
// ────────────────────────────────────────
function bindOptGroup(id, key, cb) {
  $(id).addEventListener('pointerdown', e => {
    const b = e.target.closest('.sopt');
    if (!b) return;
    $(id).querySelectorAll('.sopt').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    G[key] = b.dataset.v;
    SFX.tap();
    if (cb) cb(b.dataset.v);
  });
}

bindOptGroup('grp-op',   'operation');
bindOptGroup('grp-age',  'ageGroup', v => {
  D.customBox.style.display = v === 'custom' ? 'block' : 'none';
});
bindOptGroup('grp-time', 'totalTime');
bindOptGroup('grp-win',  'winScore');

D.inCmax.addEventListener('input', () => {
  G.customMax = parseInt(D.inCmax.value) || 50;
});

// ────────────────────────────────────────
// 7. INICIAR JOGO
// ────────────────────────────────────────
D.btnPlay.addEventListener('pointerdown', startGame);

function startGame() {
  G.t1Name    = D.inT1.value.trim() || 'Team 1';
  G.t2Name    = D.inT2.value.trim() || 'Team 2';
  G.customMax = parseInt(D.inCmax.value) || 50;
  G.totalTime = parseInt(G.totalTime);
  G.winScore  = parseInt(G.winScore);

  G.score1 = 0; G.score2 = 0;
  G.ropePos = 0;
  G.ans1 = ''; G.ans2 = '';
  G.running = true;

  // Nomes no DOM
  D.bnT1.textContent = G.t1Name; D.bnT2.textContent = G.t2Name;
  D.sbN1.textContent = G.t1Name; D.sbN2.textContent = G.t2Name;

  updateScores();
  updateRopeVisual(true);
  setCharsState('chars-strain');
  newQ(1); newQ(2);

  showScreen('game');
  startTimer();
  SFX.tick();
}

// ────────────────────────────────────────
// 8. MOSTRAR ECRÃ
// ────────────────────────────────────────
function showScreen(s) {
  ['sSetup', 'sGame', 'sVic'].forEach(k => D[k].classList.remove('active'));
  const map = { setup: 'sSetup', game: 'sGame', victory: 'sVic' };
  D[map[s]].classList.add('active');
}

// ────────────────────────────────────────
// 9. QUESTÕES
// ────────────────────────────────────────
function newQ(t) {
  const q = genQ();
  if (t === 1) { G.q1 = q; D.qT1.textContent = q.text; G.ans1 = ''; updAns(1); }
  else          { G.q2 = q; D.qT2.textContent = q.text; G.ans2 = ''; updAns(2); }
}

function updAns(t) {
  const val = t === 1 ? G.ans1 : G.ans2;
  const el  = t === 1 ? D.adT1 : D.adT2;
  const box = t === 1 ? D.abT1 : D.abT2;
  el.innerHTML = val.length ? val : '&nbsp;';
  box.classList.toggle('has-val', val.length > 0);
}

// ────────────────────────────────────────
// 10. NUMPAD — MULTITOUCH REAL
// ────────────────────────────────────────
['np1', 'np2'].forEach(id => {
  $(id).addEventListener('pointerdown', e => {
    const btn = e.target.closest('.np');
    if (!btn) return;
    e.preventDefault();
    btn.setPointerCapture(e.pointerId);
    handleInput(parseInt(btn.dataset.t), btn.dataset.v);
  }, { passive: false });
});

function handleInput(t, v) {
  if (!G.running) return;
  if (v === 'del') {
    SFX.tap();
    if (t === 1) G.ans1 = G.ans1.slice(0, -1);
    else         G.ans2 = G.ans2.slice(0, -1);
    updAns(t);
    return;
  }
  if (v === 'ok') { submit(t); return; }
  SFX.tap();
  if (t === 1 && G.ans1.length < 4) { G.ans1 += v; updAns(1); }
  if (t === 2 && G.ans2.length < 4) { G.ans2 += v; updAns(2); }
}

// ────────────────────────────────────────
// 11. SUBMETER RESPOSTA
// ────────────────────────────────────────
function submit(t) {
  if (!G.running) return;
  const ans = parseInt(t === 1 ? G.ans1 : G.ans2);
  const q   = t === 1 ? G.q1 : G.q2;
  const box = t === 1 ? D.abT1 : D.abT2;
  const adv = t === 1 ? D.colT2 : D.colT1;
  if (isNaN(ans)) return;

  if (ans === q.ans) {
    // ✅ CORRETO
    SFX.correct();
    if (t === 1) { G.score1++; G.ropePos--; }
    else         { G.score2++; G.ropePos++; }

    box.classList.remove('wrong-flash');
    void box.offsetWidth;
    box.classList.add('correct-flash');
    setTimeout(() => box.classList.remove('correct-flash'), 400);

    // Animação personagens SVG
    triggerCharAnim(t === 1 ? 'pull-blue' : 'pull-red');

    // Shake adversário
    adv.classList.add('panel-shake');
    setTimeout(() => adv.classList.remove('panel-shake'), 450);

    updateScores();
    updateRopeVisual();

    if (checkWin()) return;
    setTimeout(() => newQ(t), 280);

  } else {
    // ❌ ERRADO
    SFX.wrong();
    box.classList.remove('correct-flash');
    void box.offsetWidth;
    box.classList.add('wrong-flash');
    setTimeout(() => box.classList.remove('wrong-flash'), 450);

    triggerCharAnim(t === 1 ? 'wrong-blue' : 'wrong-red');

    if (t === 1) { G.ans1 = ''; updAns(1); }
    else         { G.ans2 = ''; updAns(2); }
  }
}

// ────────────────────────────────────────
// 12. ANIMAÇÕES SVG DOS PERSONAGENS
// ────────────────────────────────────────
// As classes são aplicadas no elemento #arena-svg
// O CSS mapeia as classes para animações dos personagens

const ANIM_STATES = [
  'chars-idle', 'chars-strain',
  'pull-blue', 'pull-red',
  'wrong-blue', 'wrong-red',
  'victory-blue', 'victory-red',
];

function setCharsState(state) {
  const svg = D.arenaSvg;
  if (!svg) return;
  ANIM_STATES.forEach(s => svg.classList.remove(s));
  if (state) svg.classList.add(state);
}

function triggerCharAnim(anim) {
  setCharsState(anim);
  // Após a animação, volta ao estado de esforço
  setTimeout(() => {
    if (G.running) setCharsState('chars-strain');
  }, 500);
}

// ────────────────────────────────────────
// 13. VERIFICAR VITÓRIA
// ────────────────────────────────────────
function checkWin() {
  const w = parseInt(G.winScore);
  if (G.score1 >= w) { doVictory(1); return true; }
  if (G.score2 >= w) { doVictory(2); return true; }
  const ropeMax = Math.ceil(w / 2);
  if (G.ropePos <= -ropeMax) { doVictory(1); return true; }
  if (G.ropePos >=  ropeMax) { doVictory(2); return true; }
  return false;
}

// ────────────────────────────────────────
// 14. VITÓRIA
// ────────────────────────────────────────
function doVictory(winner) {
  G.running = false;
  clearInterval(G.timer);
  SFX.win();

  // Animação de vitória nos personagens SVG
  setCharsState(winner === 1 ? 'victory-blue' : 'victory-red');

  const wn = winner === 1 ? G.t1Name : G.t2Name;
  const ws = winner === 1 ? G.score1 : G.score2;

  D.vTitle.textContent = `🏆 ${wn} Venceu!`;
  D.vSub.textContent   = 'Parabéns! Excelente trabalho em equipa!';
  D.vsV1.textContent   = G.score1; D.vsN1.textContent = G.t1Name;
  D.vsV2.textContent   = G.score2; D.vsN2.textContent = G.t2Name;

  addRank(wn, ws);
  renderRank();

  setTimeout(() => {
    showScreen('victory');
    launchConfetti();
  }, 900);
}

// ────────────────────────────────────────
// 15. TIMER
// ────────────────────────────────────────
function startTimer() {
  clearInterval(G.timer);
  G.timeLeft = parseInt(G.totalTime);
  updTimerDisplay();
  G.timer = setInterval(() => {
    G.timeLeft--;
    updTimerDisplay();
    if (G.timeLeft <= 10 && G.timeLeft > 0) {
      SFX.tick();
      D.timerVal.classList.add('urgent');
    } else {
      D.timerVal.classList.remove('urgent');
    }
    if (G.timeLeft <= 0) { clearInterval(G.timer); onTimeout(); }
  }, 1000);
}

function updTimerDisplay() {
  const m = String(Math.floor(G.timeLeft / 60)).padStart(2, '0');
  const s = String(G.timeLeft % 60).padStart(2, '0');
  D.timerVal.textContent = `${m}:${s}`;
}

function onTimeout() {
  if (!G.running) return;
  SFX.timeout();
  if (G.score1 > G.score2)      doVictory(1);
  else if (G.score2 > G.score1) doVictory(2);
  else {
    // Empate: ronda extra de 30s
    G.totalTime = 30;
    G.timeLeft  = 30;
    startTimer();
  }
}

// ────────────────────────────────────────
// 16. SCORES DISPLAY
// ────────────────────────────────────────
function updateScores() {
  D.bsT1.textContent = G.score1; D.bsT2.textContent = G.score2;
  D.sbV1.textContent = G.score1; D.sbV2.textContent = G.score2;
}

// ────────────────────────────────────────
// 17. VISUAL DA CORDA (SVG)
// ────────────────────────────────────────
// O SVG viewBox é 700×220
// Posição neutra da bandeira: x=343 (centro 350 − metade largura)
// Personagens azuis: centrados em ~109 (média de char-1a e char-1b)
// Personagens vermelhos: centrados em ~591

const SVG_CENTER   = 350;   // centro do SVG
const SVG_RANGE    = 100;   // deslocamento máximo da bandeira (±100px)
const CHAR_SHIFT   = 55;    // deslocamento máximo dos personagens

function updateRopeVisual(instant) {
  const w    = parseInt(G.winScore);
  const maxR = Math.max(1, Math.ceil(w / 2));
  // pos normalizado: -1 (team1 ganhando) a +1 (team2 ganhando)
  const norm = Math.max(-1, Math.min(1, G.ropePos / maxR));

  // ── Bandeira SVG ──
  // Posição base da bandeira é x=343 (rect); move ±SVG_RANGE
  if (D.ropeFlag) {
    const flagX = norm * SVG_RANGE;
    D.ropeFlag.setAttribute('transform', `translate(${flagX}, 0)`);
  }

  // ── Corda SVG — curva bezier ──
  // Quando team1 puxa (norm<0): corda sobe levemente à esquerda
  // Quando team2 puxa (norm>0): corda sobe levemente à direita
  if (D.ropeMain) {
    const offsetX  = norm * 60;  // ancoragens deslocam horizontalmente
    const sagExtra = Math.abs(norm) * 12; // corda fica mais tensa quando alguém puxa
    const sag      = 22 - sagExtra;

    // Ancoragens da corda nos punhos dos personagens
    const leftX  = 168 + norm * 30;
    const rightX = 532 + norm * 30;
    const ctrlY  = 108 + sag; // controlo de curvatura

    const d = `M ${leftX},108 Q ${SVG_CENTER + offsetX},${ctrlY} ${rightX},108`;
    D.ropeMain.setAttribute('d', d);

    if (D.ropeShadow) {
      const ds = `M ${leftX},112 Q ${SVG_CENTER + offsetX},${ctrlY + 6} ${rightX},112`;
      D.ropeShadow.setAttribute('d', ds);
    }
    if (D.ropeHighlight) {
      const dh = `M ${leftX},103 Q ${SVG_CENTER + offsetX},${ctrlY - 5} ${rightX},103`;
      D.ropeHighlight.setAttribute('d', dh);
    }
  }

  // ── Deslocamento dos personagens ──
  // Quando team1 acerta, todos avançam ligeiramente para a direita
  // (team1 avança direita, team2 recua direita = shift positivo)
  const shift = norm * CHAR_SHIFT;

  if (D.char1a) D.char1a.style.transform = `translateX(${shift * 0.5}px)`;
  if (D.char1b) D.char1b.style.transform = `translateX(${shift * 0.5}px)`;
  if (D.char2a) D.char2a.style.transform = `translateX(${shift * 0.5}px)`;
  if (D.char2b) D.char2b.style.transform = `translateX(${shift * 0.5}px)`;

  // ── Barra de progresso HTML ──
  // norm=-1 → team1 100%, norm=+1 → team2 100%
  const t1pct = Math.max(0, (-norm) * 50);  // 0–50
  const t2pct = Math.max(0, ( norm) * 50);  // 0–50
  if (D.rpBlue) D.rpBlue.style.flex = t1pct.toFixed(1);
  if (D.rpRed)  D.rpRed.style.flex  = t2pct.toFixed(1);
}

// ────────────────────────────────────────
// 18. CONFETES
// ────────────────────────────────────────
function launchConfetti() {
  if (typeof confetti === 'undefined') return;

  confetti({
    particleCount: 140, spread: 110, startVelocity: 45,
    origin: { x: 0.5, y: 0.45 },
    colors: ['#0057FF', '#003AAF', '#4A8CFF', '#E53935', '#FFFFFF', '#FFD700'],
    scalar: 1.3, zIndex: 9999,
  });

  const end = Date.now() + 4500;
  const frame = () => {
    confetti({ particleCount: 5, angle: 55, spread: 60, startVelocity: 55,
      origin: { x: 0, y: 0.65 }, colors: ['#0057FF', '#4A8CFF', '#FFFFFF'], zIndex: 9999 });
    confetti({ particleCount: 5, angle: 125, spread: 60, startVelocity: 55,
      origin: { x: 1, y: 0.65 }, colors: ['#E53935', '#FFD700', '#FFFFFF'], zIndex: 9999 });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();

  setTimeout(() => confetti({ particleCount: 80, spread: 80, origin: { x: 0.35, y: 0.5 },
    colors: ['#0057FF', '#FFFFFF'], shapes: ['star'], scalar: 1.5, zIndex: 9999 }), 600);
  setTimeout(() => confetti({ particleCount: 80, spread: 80, origin: { x: 0.65, y: 0.5 },
    colors: ['#E53935', '#FFD700'], shapes: ['star'], scalar: 1.5, zIndex: 9999 }), 900);
  setTimeout(() => confetti({ particleCount: 70, angle: 90, spread: 170,
    startVelocity: 18, origin: { x: 0.5, y: 0 }, gravity: 0.55,
    colors: ['#0057FF', '#E53935', '#FFFFFF', '#FFD700'], drift: 0.4, zIndex: 9999 }), 2000);
}

// ────────────────────────────────────────
// 19. RANKING
// ────────────────────────────────────────
function addRank(name, score) {
  G.ranking.push({
    name, score,
    date: new Date().toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  });
  G.ranking.sort((a, b) => b.score - a.score);
  G.ranking = G.ranking.slice(0, 10);
  localStorage.setItem('tis_tow_rank', JSON.stringify(G.ranking));
}

function renderRank() {
  if (!G.ranking.length) {
    D.rankList.innerHTML = '<p style="color:rgba(255,255,255,.45);font-size:13px;">Sem histórico ainda.</p>';
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  D.rankList.innerHTML = G.ranking.map((r, i) => `
    <div class="rank-item">
      <span class="rk-pos">${medals[i] || '#' + (i + 1)}</span>
      <span class="rk-name">${r.name.replace(/</g, '&lt;')}</span>
      <span class="rk-sc">${r.score} pts</span>
      <span class="rk-dt">${r.date}</span>
    </div>`).join('');
}

// ────────────────────────────────────────
// 20. BOTÕES DE CONTROLO
// ────────────────────────────────────────
D.btnHome.addEventListener('pointerdown', () => {
  if (!G.running) { showScreen('setup'); return; }
  if (!D.btnHome._c) {
    D.btnHome._c = true;
    D.btnHome.textContent = '🏠 Confirmar?';
    setTimeout(() => {
      D.btnHome._c = false;
      D.btnHome.textContent = '🏠 Início';
    }, 2000);
    return;
  }
  clearInterval(G.timer); G.running = false;
  D.btnHome._c = false; D.btnHome.textContent = '🏠 Início';
  setCharsState('chars-idle');
  showScreen('setup');
});

D.btnSettings.addEventListener('pointerdown', () => {
  clearInterval(G.timer); G.running = false;
  setCharsState('chars-idle');
  showScreen('setup'); SFX.tap();
});

D.btnSound.addEventListener('pointerdown', () => {
  G.soundOn = !G.soundOn;
  D.btnSound.textContent = G.soundOn ? '🔊' : '🔇';
  SFX.tap();
});

D.vbtnAgain.addEventListener('pointerdown', () => {
  SFX.tap(); restartMatch();
});
D.vbtnCfg.addEventListener('pointerdown', () => {
  SFX.tap(); clearInterval(G.timer); G.running = false;
  setCharsState('chars-idle');
  showScreen('setup');
});

function restartMatch() {
  G.score1 = 0; G.score2 = 0; G.ropePos = 0;
  G.ans1 = ''; G.ans2 = '';
  G.running = true;
  G.totalTime = parseInt(G.totalTime) || 120;

  updateScores();
  updateRopeVisual(true);
  setCharsState('chars-strain');
  newQ(1); newQ(2);
  D.timerVal.classList.remove('urgent');
  showScreen('game');
  startTimer();
}

// ────────────────────────────────────────
// 21. TECLADO FÍSICO (PC)
// ────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (!G.running) return;
  const t1Keys = {
    '1': '1', '2': '2', '3': '3', '4': '4', '5': '5',
    '6': '6', '7': '7', '8': '8', '9': '9', '0': '0',
    'Enter': 'ok', 'Backspace': 'del',
  };
  const t2Codes = {
    'Numpad1': '1', 'Numpad2': '2', 'Numpad3': '3', 'Numpad4': '4', 'Numpad5': '5',
    'Numpad6': '6', 'Numpad7': '7', 'Numpad8': '8', 'Numpad9': '9', 'Numpad0': '0',
    'NumpadEnter': 'ok', 'NumpadDecimal': 'del',
  };
  if (t1Keys[e.key] !== undefined)  handleInput(1, t1Keys[e.key]);
  if (t2Codes[e.code] !== undefined) handleInput(2, t2Codes[e.code]);
});

// ────────────────────────────────────────
// 22. PREVENIR GESTOS DO SISTEMA
// ────────────────────────────────────────
document.addEventListener('gesturestart',  e => e.preventDefault(), { passive: false });
document.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

let _lt = 0;
document.addEventListener('touchend', e => {
  const n = Date.now();
  if (n - _lt < 300) e.preventDefault();
  _lt = n;
}, { passive: false });

// ────────────────────────────────────────
// 23. SERVICE WORKER (offline)
// ────────────────────────────────────────
if ('serviceWorker' in navigator) {
  const sw = `
    const C='tis-tow-v3',A=['./','./index.html','./style.css','./script.js'];
    self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(A))));
    self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
  `;
  const url = URL.createObjectURL(new Blob([sw], { type: 'application/javascript' }));
  navigator.serviceWorker.register(url).catch(() => {});
}

// ────────────────────────────────────────
// 24. INIT
// ────────────────────────────────────────
(function init() {
  renderRank();
  showScreen('setup');
  // Personagens em idle no ecrã de setup (não visíveis, mas prontos)
  setCharsState('chars-idle');
  console.log('%c TIS AO · Tug of War Mathematics v3.0 ',
    'background:#0057FF;color:#fff;font-size:13px;font-weight:900;padding:5px 12px;border-radius:6px;');
})();