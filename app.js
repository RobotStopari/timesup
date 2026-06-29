(() => {
  'use strict';

  // ── State ──
  let allCards = [];
  let selectedCards = [];
  let doneCards = [];
  let currentRound = 1;
  let timerLimit = 60;
  let timerRemaining = 60;
  let timerInterval = null;
  let gamePhase = 'setup'; // setup | tapStart | playing | timeUp | roundEnd | gameEnd
  let currentCardText = null;
  let cardCount = 30;
  let busy = false;
  let difficulty = 0;
  let lengthP75 = 0;
  let lengthP90 = 0;
  let reallyLongCards = [];

  // Swipe state
  let dragStartY = 0;
  let dragCurrentY = 0;
  let dragging = false;
  let activePointerId = null;

  // ── DOM refs ──
  const $ = (sel) => document.querySelector(sel);

  const setupScreen = $('#setup-screen');
  const gameScreen = $('#game-screen');
  const cardCountRange = $('#card-count-range');
  const cardCountInput = $('#card-count');
  const timerRange = $('#timer-range');
  const timerInput = $('#timer-limit');
  const difficultyRange = $('#difficulty-range');
  const difficultyValue = $('#difficulty-value');
  const difficultyHint = $('#difficulty-hint');
  const startBtn = $('#start-btn');
  const roundBadge = $('#round-badge');
  const timerDisplay = $('#timer-display');
  const timerBarFill = $('#timer-bar-fill');
  const cardsRemaining = $('#cards-remaining');
  const tapOverlay = $('#tap-overlay');
  const tapMessage = $('#tap-message');
  const timeupOverlay = $('#timeup-overlay');
  const roundOverlay = $('#round-overlay');
  const roundMessage = $('#round-message');
  const gameoverOverlay = $('#gameover-overlay');
  const playZone = $('#play-zone');
  const cardStack = $('#card-stack');
  const currentCard = $('#current-card');
  const cardText = $('#card-text');
  const btnGuessed = $('#btn-guessed');
  const btnSkip = $('#btn-skip');
  const gameArea = $('#game-area');
  const actionFlash = $('#action-flash');

  const DIFFICULTY_HINTS = {
    0: 'Náhodný výběr karet',
    1: 'Mírná preference delších jmen',
    2: 'Častěji delší a složitější jména',
    3: 'Minimálně 20 % velmi dlouhých jmen',
  };

  // ── Init ──
  async function init() {
    try {
      const res = await fetch('cards.txt');
      const text = await res.text();
      allCards = text.split('\n').map((l) => l.trim()).filter(Boolean);
      buildLengthTiers();
    } catch {
      startBtn.disabled = true;
      startBtn.textContent = 'Nelze načíst karty (cards.txt)';
      return;
    }

    syncInputs(cardCountRange, cardCountInput, 10, 50);
    syncInputs(timerRange, timerInput, 15, 180);
    setupDifficultySlider();

    if (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) {
      document.body.classList.add('touch-device');
    }
    setupCardSwipe();

    startBtn.addEventListener('click', startGame);
    btnGuessed.addEventListener('click', (e) => { e.stopPropagation(); triggerGuessed(); });
    btnSkip.addEventListener('click', (e) => { e.stopPropagation(); triggerSkip(); });

    tapOverlay.addEventListener('click', onTapOverlay);
    timeupOverlay.addEventListener('click', onTapOverlay);
    roundOverlay.addEventListener('click', onTapOverlay);
    gameoverOverlay.addEventListener('click', onTapOverlay);
  }

  function syncInputs(range, input, min, max) {
    const clamp = (v) => Math.min(max, Math.max(min, parseInt(v, 10) || min));

    range.addEventListener('input', () => { input.value = range.value; });
    input.addEventListener('input', () => {
      input.value = clamp(input.value);
      range.value = input.value;
    });
    input.addEventListener('change', () => {
      input.value = clamp(input.value);
      range.value = input.value;
    });
  }

  // ── Utilities ──
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function setupDifficultySlider() {
    const update = () => {
      difficultyValue.textContent = difficultyRange.value;
      difficultyHint.textContent = DIFFICULTY_HINTS[difficultyRange.value];
    };
    difficultyRange.addEventListener('input', update);
    update();
  }

  function buildLengthTiers() {
    const sorted = allCards.map((c) => c.length).sort((a, b) => a - b);
    lengthP75 = sorted[Math.floor(sorted.length * 0.75)];
    lengthP90 = sorted[Math.floor(sorted.length * 0.9)];
    reallyLongCards = allCards.filter((c) => c.length >= lengthP90);
  }

  function cardWeight(card, level) {
    if (card.length >= lengthP90) {
      return level === 1 ? 3 : level === 2 ? 7 : 5;
    }
    if (card.length >= lengthP75) {
      return level === 1 ? 2 : level === 2 ? 4 : 3;
    }
    return 1;
  }

  function weightedPick(pool, exclude, level) {
    const available = pool.filter((c) => !exclude.has(c));
    if (available.length === 0) return null;

    let total = 0;
    const weights = available.map((c) => {
      const w = cardWeight(c, level);
      total += w;
      return w;
    });

    let r = Math.random() * total;
    for (let i = 0; i < available.length; i++) {
      r -= weights[i];
      if (r <= 0) return available[i];
    }
    return available[available.length - 1];
  }

  function pickCards(n, level) {
    if (level === 0) return pickRandom(allCards, n);

    const picked = new Set();
    const result = [];

    if (level >= 3) {
      const minLong = Math.ceil(n * 0.2);
      for (const card of shuffle(reallyLongCards)) {
        if (result.length >= minLong) break;
        picked.add(card);
        result.push(card);
      }
    }

    while (result.length < n) {
      const card = weightedPick(allCards, picked, level);
      if (!card) break;
      picked.add(card);
      result.push(card);
    }

    return shuffle(result);
  }

  function pickRandom(arr, n) {
    return shuffle(arr).slice(0, n);
  }

  function flashAction(type) {
    actionFlash.hidden = false;
    actionFlash.className = 'action-flash flash-' + type;
    void actionFlash.offsetWidth;
    actionFlash.classList.add('active');
    setTimeout(() => {
      actionFlash.classList.remove('active');
      setTimeout(() => { actionFlash.hidden = true; }, 180);
    }, 160);
  }

  function skipFlashType() {
    return currentRound === 2 ? 'skip' : 'danger';
  }

  function triggerGuessed() {
    if (gamePhase !== 'playing' || busy) return;
    flashAction('success');
    onGuessed();
  }

  function triggerSkip() {
    if (gamePhase !== 'playing' || busy) return;
    flashAction(skipFlashType());
    onSkip();
  }

  function resetCardDrag() {
    dragging = false;
    activePointerId = null;
    currentCard.classList.remove('dragging', 'swipe-hint-up', 'swipe-hint-down', 'skip-turn-hint');
    currentCard.style.transform = '';
    currentCard.style.opacity = '';
    currentCard.style.willChange = '';
  }

  function updateCardDragVisuals(dy) {
    const clamped = Math.max(-140, Math.min(140, dy));
    currentCard.style.willChange = 'transform, opacity';
    currentCard.style.transform = `translateY(${clamped}px) rotate(${clamped * 0.04}deg)`;
    currentCard.style.opacity = String(1 - Math.abs(clamped) / 300);
    currentCard.classList.toggle('swipe-hint-up', dy < -20);
    currentCard.classList.toggle('swipe-hint-down', dy > 20);
    currentCard.classList.toggle('skip-turn-hint', dy > 20 && currentRound === 2);
  }

  function setupCardSwipe() {
    const SWIPE_THRESHOLD = 50;
    const target = cardStack;

    target.addEventListener('pointerdown', (e) => {
      if (gamePhase !== 'playing' || busy) return;
      if (e.pointerType === 'mouse') return;

      dragging = true;
      activePointerId = e.pointerId;
      dragStartY = e.clientY;
      dragCurrentY = dragStartY;
      currentCard.classList.add('dragging');
      target.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    target.addEventListener('pointermove', (e) => {
      if (!dragging || e.pointerId !== activePointerId) return;
      e.preventDefault();
      dragCurrentY = e.clientY;
      updateCardDragVisuals(dragCurrentY - dragStartY);
    });

    const endDrag = (e) => {
      if (!dragging || e.pointerId !== activePointerId) return;

      const dy = dragCurrentY - dragStartY;
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
      resetCardDrag();

      if (dy < -SWIPE_THRESHOLD) triggerGuessed();
      else if (dy > SWIPE_THRESHOLD) triggerSkip();
    };

    target.addEventListener('pointerup', endDrag);
    target.addEventListener('pointercancel', (e) => {
      if (!dragging || e.pointerId !== activePointerId) return;
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
      resetCardDrag();
    });
  }

  function vibrateThree() {
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }
  }

  function showScreen(screen) {
    setupScreen.classList.toggle('active', screen === 'setup');
    gameScreen.classList.toggle('active', screen === 'game');
  }

  function hideAllOverlays() {
    tapOverlay.hidden = true;
    timeupOverlay.hidden = true;
    roundOverlay.hidden = true;
    gameoverOverlay.hidden = true;
    playZone.hidden = true;
  }

  // ── Timer ──
  function startTimer() {
    stopTimer();
    timerInterval = setInterval(() => {
      timerRemaining--;
      updateTimerUI();
      if (timerRemaining <= 0) {
        stopTimer();
        onTimeUp();
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function updateTimerUI() {
    timerDisplay.textContent = timerRemaining;
    const pct = (timerRemaining / timerLimit) * 100;
    timerBarFill.style.width = pct + '%';

    timerDisplay.classList.remove('warning', 'danger');
    timerBarFill.classList.remove('warning', 'danger');

    if (timerRemaining <= 10) {
      timerDisplay.classList.add('danger');
      timerBarFill.classList.add('danger');
    } else if (timerRemaining <= 20) {
      timerDisplay.classList.add('warning');
      timerBarFill.classList.add('warning');
    }
  }

  function resetTimer() {
    timerRemaining = timerLimit;
    updateTimerUI();
  }

  // ── Game flow ──
  function startGame() {
    cardCount = parseInt(cardCountInput.value, 10);
    timerLimit = parseInt(timerInput.value, 10);
    difficulty = parseInt(difficultyRange.value, 10);

    selectedCards = pickCards(cardCount, difficulty);
    doneCards = [];
    currentRound = 1;
    currentCardText = null;

    showScreen('game');
    updateRoundUI();
    showTapStart();
  }

  function updateRoundUI() {
    roundBadge.textContent = 'Kolo ' + currentRound;
    updateCardsRemaining();

    if (currentRound === 2) {
      btnSkip.textContent = 'Přeskočit tah';
      btnSkip.classList.add('skip-turn');
      btnSkip.classList.remove('btn-danger');
    } else {
      btnSkip.textContent = 'Odsunout';
      btnSkip.classList.remove('skip-turn');
      btnSkip.classList.add('btn-danger');
    }
  }

  function updateCardsRemaining() {
    cardsRemaining.textContent = selectedCards.length + ' zbývá';
  }

  function showTapStart(msg) {
    gamePhase = 'tapStart';
    stopTimer();
    hideAllOverlays();
    tapMessage.textContent = msg || 'Klepněte pro start';
    tapOverlay.hidden = false;
    resetTimer();
  }

  function onTapOverlay() {
    if (gamePhase === 'tapStart') {
      beginRound();
    } else if (gamePhase === 'timeUp') {
      hideAllOverlays();
      showTapStart();
    } else if (gamePhase === 'roundEnd') {
      nextRound();
    } else if (gamePhase === 'gameEnd') {
      stopTimer();
      showScreen('setup');
      gamePhase = 'setup';
      hideAllOverlays();
    }
  }

  function beginRound() {
    if (selectedCards.length === 0) return;

    gamePhase = 'playing';
    hideAllOverlays();
    resetTimer();
    startTimer();
    showTopCard();
  }

  function showTopCard() {
    if (selectedCards.length === 0) {
      onRoundComplete();
      return;
    }

    const card = selectedCards[0];
    currentCardText = card;
    cardText.textContent = card;

    resetCardDrag();
    playZone.hidden = false;
    currentCard.className = 'game-card enter';

    // Re-trigger enter animation
    void currentCard.offsetWidth;
    currentCard.classList.add('enter');
  }

  function animateCard(exitClass) {
    return new Promise((resolve) => {
      currentCard.classList.remove('enter');
      currentCard.classList.add(exitClass);

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        currentCard.removeEventListener('animationend', onEnd);
        currentCard.className = 'game-card';
        currentCard.style.transform = '';
        currentCard.style.opacity = '';
        resolve();
      };

      const onEnd = (e) => {
        if (e.target === currentCard) finish();
      };
      currentCard.addEventListener('animationend', onEnd);
      setTimeout(finish, 500);
    });
  }

  async function onGuessed() {
    if (gamePhase !== 'playing' || busy) return;
    busy = true;

    const card = selectedCards.shift();
    doneCards.push(card);
    updateCardsRemaining();

    playZone.classList.add('animating');
    await animateCard('exit-guessed');
    playZone.classList.remove('animating');

    if (selectedCards.length === 0) {
      stopTimer();
      playZone.hidden = true;
      onRoundComplete();
    } else {
      showTopCard();
    }
    busy = false;
  }

  async function onSkip() {
    if (gamePhase !== 'playing' || busy) return;
    busy = true;

    if (currentRound === 2) {
      // Přeskočit tah — jump timer to 0
      timerRemaining = 0;
      updateTimerUI();
      stopTimer();
      onTimeUp();
      return;
    }

    // Odsunout — move card to bottom
    const card = selectedCards.shift();
    selectedCards.push(card);

    playZone.classList.add('animating');
    await animateCard('exit-skip');
    playZone.classList.remove('animating');
    showTopCard();
    busy = false;
  }

  async function onTimeUp() {
    if (gamePhase !== 'playing') return;
    busy = true;
    gamePhase = 'timeUp';

    playZone.classList.add('animating');
    await animateCard('exit-timeup');
    playZone.classList.remove('animating');
    playZone.hidden = true;

    // Move the top card to the bottom of the selected list
    if (selectedCards.length > 0) {
      selectedCards.push(selectedCards.shift());
    }
    currentCardText = null;
    updateCardsRemaining();

    vibrateThree();

    hideAllOverlays();
    timeupOverlay.hidden = false;
    busy = false;
  }

  function onRoundComplete() {
    if (currentRound >= 3) {
      gamePhase = 'gameEnd';
      vibrateThree();
      hideAllOverlays();
      gameoverOverlay.hidden = false;
      return;
    }

    gamePhase = 'roundEnd';
    vibrateThree();
    hideAllOverlays();

    const msgs = {
      1: 'Konec kola 1!<br>Připravte se na kolo 2',
      2: 'Konec kola 2!<br>Připravte se na kolo 3',
    };
    roundMessage.innerHTML = msgs[currentRound];
    roundOverlay.hidden = false;
  }

  function nextRound() {
    currentRound++;
    selectedCards = shuffle(doneCards);
    doneCards = [];
    currentCardText = null;

    updateRoundUI();
    showTapStart();
  }

  init();
})();
