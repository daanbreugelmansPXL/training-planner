/**
 * Training Planner PWA - Main Application Logic
 * Pure vanilla JavaScript - zero frameworks, zero external dependencies
 */

(function () {
  'use strict';

  // Core Application State
  const state = {
    data: null,
    currentIsoWeek: '',
    currentYear: 2026,
    currentWeekNumber: 1,
    selectedDayIndex: 0, // 0 = Mon ... 6 = Sun
    todayIsoWeek: '',
    todayDayIndex: 0,
    activeTab: 'planner', // 'planner' | 'progress' | 'settings'
    editMode: false,
    timer: {
      active: false,
      paused: false,
      targetEndTime: 0,
      totalDuration: 0,
      remainingSeconds: 0,
      intervalId: null
    },
    audioCtx: null,
    chartMetric: '1rm', // '1rm' | 'weight'
    chartSelectedExerciseId: null,
    activeEditingExercise: null, // { sessionId, exerciseId, exerciseObj }
    activeReschedulingSessionId: null
  };

  // Day Name Constants (Monday first)
  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  /* ==========================================================================
     Calendar & ISO Week Math
     ========================================================================== */

  /**
   * Get ISO 8601 week string for a given Date: e.g. "2026-W43"
   */
  function getIsoWeekString(date) {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7; // Monday = 0
    target.setDate(target.getDate() - dayNr + 3); // Thursday in target week
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const weekNumber = 1 + Math.ceil((firstThursday - target) / 604800000);
    const year = new Date(firstThursday).getFullYear();
    const padWeek = weekNumber < 10 ? '0' + weekNumber : weekNumber;
    return `${year}-W${padWeek}`;
  }

  /**
   * Parse ISO week string ("2026-W43") to { year, weekNumber }
   */
  function parseIsoWeek(isoStr) {
    const parts = isoStr.split('-W');
    return {
      year: parseInt(parts[0], 10),
      weekNumber: parseInt(parts[1], 10)
    };
  }

  /**
   * Calculate all 7 Date objects (Mon..Sun) for an ISO week string
   */
  function getWeekDates(isoStr) {
    const { year, weekNumber } = parseIsoWeek(isoStr);
    // Jan 4th is always in week 1
    const simple = new Date(Date.UTC(year, 0, 4));
    const day = (simple.getUTCDay() + 6) % 7; // Mon=0
    const mondayWeek1 = new Date(simple.valueOf());
    mondayWeek1.setUTCDate(simple.getUTCDate() - day);

    const mondayTarget = new Date(mondayWeek1.valueOf());
    mondayTarget.setUTCDate(mondayWeek1.getUTCDate() + (weekNumber - 1) * 7);

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(mondayTarget.valueOf());
      d.setUTCDate(mondayTarget.getUTCDate() + i);
      dates.push(d);
    }
    return dates;
  }

  /**
   * Shift ISO week by offset (+1 or -1)
   */
  function shiftIsoWeek(isoStr, offset) {
    const dates = getWeekDates(isoStr);
    const midWeek = new Date(dates[3].valueOf()); // Thursday
    midWeek.setDate(midWeek.getDate() + offset * 7);
    return getIsoWeekString(midWeek);
  }

  /* ==========================================================================
     Audio & Haptics Feedback
     ========================================================================== */

  /**
   * Unlocks WebAudio on user interaction (Safari/iOS requirement)
   */
  function ensureAudioUnlocked() {
    if (!state.audioCtx) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          state.audioCtx = new AudioContextClass();
        }
      } catch (err) {
        console.warn('AudioContext init error:', err);
      }
    }
    if (state.audioCtx && state.audioCtx.state === 'suspended') {
      state.audioCtx.resume();
    }
  }

  /**
   * Plays a distinct, clean two-tone chime when rest timer completes
   */
  function playRestTimerBeep() {
    try {
      ensureAudioUnlocked();
      if (!state.audioCtx) return;

      const now = state.audioCtx.currentTime;
      const osc = state.audioCtx.createOscillator();
      const gain = state.audioCtx.createGain();

      osc.type = 'sine';
      // First tone: 880 Hz (A5), Second tone: 1320 Hz (E6)
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1320, now + 0.18);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.connect(gain);
      gain.connect(state.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.55);
    } catch (e) {
      console.warn('Could not play sound:', e);
    }
  }

  function triggerVibrate() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch (e) {
        // Ignored if device does not support vibration
      }
    }
  }

  /* ==========================================================================
     Rest Timer Controller (Timestamp Based - Survives Lock/Background)
     ========================================================================== */

  function startRestTimer(seconds) {
    ensureAudioUnlocked();
    if (!seconds || seconds <= 0) seconds = 90;

    clearInterval(state.timer.intervalId);

    state.timer.active = true;
    state.timer.paused = false;
    state.timer.totalDuration = seconds;
    state.timer.remainingSeconds = seconds;
    state.timer.targetEndTime = Date.now() + seconds * 1000;

    const timerEl = document.getElementById('floating-rest-timer');
    if (timerEl) timerEl.classList.remove('hidden');

    updateTimerDisplay();

    state.timer.intervalId = setInterval(() => {
      if (state.timer.paused) return;

      const diff = Math.max(0, Math.round((state.timer.targetEndTime - Date.now()) / 1000));
      state.timer.remainingSeconds = diff;
      updateTimerDisplay();

      if (diff <= 0) {
        stopRestTimer();
        playRestTimerBeep();
        triggerVibrate();
      }
    }, 250);
  }

  function stopRestTimer() {
    clearInterval(state.timer.intervalId);
    state.timer.active = false;
    state.timer.paused = false;
    const timerEl = document.getElementById('floating-rest-timer');
    if (timerEl) timerEl.classList.add('hidden');
  }

  function pauseResumeRestTimer() {
    if (!state.timer.active) return;
    if (state.timer.paused) {
      // Resume
      state.timer.paused = false;
      state.timer.targetEndTime = Date.now() + state.timer.remainingSeconds * 1000;
      document.getElementById('timer-btn-toggle').textContent = '⏸';
    } else {
      // Pause
      state.timer.paused = true;
      document.getElementById('timer-btn-toggle').textContent = '▶';
    }
  }

  function adjustRestTimer(deltaSeconds) {
    if (!state.timer.active) return;
    if (state.timer.paused) {
      state.timer.remainingSeconds = Math.max(5, state.timer.remainingSeconds + deltaSeconds);
    } else {
      state.timer.targetEndTime += deltaSeconds * 1000;
      state.timer.remainingSeconds = Math.max(0, Math.round((state.timer.targetEndTime - Date.now()) / 1000));
    }
    updateTimerDisplay();
  }

  function updateTimerDisplay() {
    const digitsEl = document.getElementById('timer-countdown');
    if (!digitsEl) return;
    const s = state.timer.remainingSeconds;
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    digitsEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /* ==========================================================================
     Log Key & State Persistence Helpers
     ========================================================================== */

  function getSessionLogKey(isoWeek, dayIndex, sessionId) {
    return `${isoWeek}_${dayIndex}_${sessionId}`;
  }

  function getOrCreateSessionLog(isoWeek, dayIndex, sessionId) {
    const key = getSessionLogKey(isoWeek, dayIndex, sessionId);
    if (!state.data.logs[key]) {
      state.data.logs[key] = {
        sessionId,
        dayIndex,
        isoWeek,
        completed: false,
        completedAt: null,
        warmup: [],
        cooldown: [],
        includeMiniMobility: false,
        miniMobility: [],
        exercises: {},
        notes: '',
        feeling: 0,
        sleepHours: ''
      };
    }
    return state.data.logs[key];
  }

  function saveCurrentState() {
    StorageService.save(state.data);
    updateWeekStripCompletion();
    checkBackupReminder();
  }

  /* ==========================================================================
     UI Rendering: Week Strip & Navigation
     ========================================================================== */

  function renderWeekNavigator() {
    const { year, weekNumber } = parseIsoWeek(state.currentIsoWeek);
    document.getElementById('week-display-label').textContent = `Week ${weekNumber}`;
    document.getElementById('week-year-label').textContent = year;

    // Update 3-Day vs 2-Day Fallback toggle buttons
    const planType = StorageService.getWeekPlanType(state.data, state.currentIsoWeek);
    const btn3Day = document.getElementById('plan-btn-3day');
    const btn2Day = document.getElementById('plan-btn-2day');

    if (planType === '2-day-fallback') {
      btn3Day.classList.remove('active');
      btn3Day.setAttribute('aria-checked', 'false');
      btn2Day.classList.add('active');
      btn2Day.setAttribute('aria-checked', 'true');
    } else {
      btn3Day.classList.add('active');
      btn3Day.setAttribute('aria-checked', 'true');
      btn2Day.classList.remove('active');
      btn2Day.setAttribute('aria-checked', 'false');
    }
  }

  function renderWeekStrip() {
    const stripContainer = document.getElementById('week-tiles-strip');
    if (!stripContainer) return;
    stripContainer.innerHTML = '';

    const weekDates = getWeekDates(state.currentIsoWeek);
    const schedule = StorageService.getResolvedWeekSchedule(state.data, state.currentIsoWeek, window.PLAN_DATA);

    weekDates.forEach((date, dayIdx) => {
      const sessionId = schedule[dayIdx];
      const session = window.PLAN_DATA.sessions[sessionId] || { title: 'Rest', type: 'rest' };
      const sessionType = window.PLAN_DATA.sessionTypes[session.type] || window.PLAN_DATA.sessionTypes['rest'];

      const isToday = (state.currentIsoWeek === state.todayIsoWeek && dayIdx === state.todayDayIndex);
      const isSelected = (dayIdx === state.selectedDayIndex);

      // Check log status
      const logKey = getSessionLogKey(state.currentIsoWeek, dayIdx, sessionId);
      const log = state.data.logs[logKey];
      const isDone = log && log.completed;
      const isPartial = log && !log.completed && hasAnyLogActivity(log);

      const tile = document.createElement('div');
      tile.className = `week-tile ${isSelected ? 'active' : ''} ${isToday ? 'is-today' : ''} ${isDone ? 'done' : ''} ${isPartial ? 'partial' : ''}`;
      tile.setAttribute('role', 'tab');
      tile.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      tile.setAttribute('tabindex', '0');
      tile.dataset.dayIndex = dayIdx;

      tile.innerHTML = `
        <span class="tile-day-name">${DAY_SHORT[dayIdx]}</span>
        <span class="tile-date-number">${date.getDate()}</span>
        <div class="tile-session-info">
          <span class="tile-icon" style="color: ${sessionType.color}">${sessionType.icon}</span>
          <span class="tile-title" title="${session.title}">${session.shortTitle || session.title}</span>
        </div>
        <div class="tile-status-dot" title="${isDone ? 'Completed' : (isPartial ? 'In progress' : 'Not started')}"></div>
      `;

      tile.addEventListener('click', () => {
        ensureAudioUnlocked();
        selectDay(dayIdx);
      });

      stripContainer.appendChild(tile);
    });

    // Auto-scroll to selected tile on mobile
    setTimeout(() => {
      const activeTile = stripContainer.querySelector('.week-tile.active');
      if (activeTile && typeof activeTile.scrollIntoView === 'function') {
        activeTile.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }, 50);

    updateWeekStripCompletion();
    updateTodayJumpBanner();
  }

  function hasAnyLogActivity(log) {
    if (!log) return false;
    if (log.notes && log.notes.trim().length > 0) return true;
    if (log.feeling > 0 || log.sleepHours) return true;
    if (log.warmup && log.warmup.some(Boolean)) return true;
    if (log.cooldown && log.cooldown.some(Boolean)) return true;
    if (log.exercises) {
      for (const exId of Object.keys(log.exercises)) {
        const ex = log.exercises[exId];
        if (ex && ex.sets && ex.sets.some(s => s && s.done)) return true;
      }
    }
    return false;
  }

  function updateWeekStripCompletion() {
    const schedule = StorageService.getResolvedWeekSchedule(state.data, state.currentIsoWeek, window.PLAN_DATA);
    let doneCount = 0;
    let totalTarget = 0;

    schedule.forEach((sessionId, dayIdx) => {
      if (sessionId !== 'rest') totalTarget++;
      const logKey = getSessionLogKey(state.currentIsoWeek, dayIdx, sessionId);
      const log = state.data.logs[logKey];
      if (log && log.completed) doneCount++;
    });

    const badge = document.getElementById('week-completion-badge');
    if (badge) {
      badge.textContent = `${doneCount}/${totalTarget} Done`;
    }
  }

  function updateTodayJumpBanner() {
    const banner = document.getElementById('today-jump-banner');
    if (!banner) return;

    // Show jump banner if current week is today's week, but user is looking at another day
    const isTodayWeek = (state.currentIsoWeek === state.todayIsoWeek);
    const schedule = StorageService.getResolvedWeekSchedule(state.data, state.todayIsoWeek, window.PLAN_DATA);
    const todaySessionId = schedule[state.todayDayIndex];
    const todayLogKey = getSessionLogKey(state.todayIsoWeek, state.todayDayIndex, todaySessionId);
    const isTodayDone = state.data.logs[todayLogKey] && state.data.logs[todayLogKey].completed;

    if (isTodayWeek && state.selectedDayIndex !== state.todayDayIndex && !isTodayDone) {
      const todaySession = window.PLAN_DATA.sessions[todaySessionId] || { title: 'Session' };
      document.getElementById('today-banner-title').textContent = todaySession.shortTitle || todaySession.title;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  function selectDay(dayIdx) {
    state.selectedDayIndex = dayIdx;
    renderWeekStrip();
    renderActiveSession();
  }

  /* ==========================================================================
     Session Page Rendering (Dynamic Overrides & Logging)
     ========================================================================== */

  function renderActiveSession() {
    const container = document.getElementById('active-session-container');
    if (!container) return;

    const schedule = StorageService.getResolvedWeekSchedule(state.data, state.currentIsoWeek, window.PLAN_DATA);
    const sessionId = schedule[state.selectedDayIndex];
    const baseSession = window.PLAN_DATA.sessions[sessionId];

    if (!baseSession) {
      container.innerHTML = `<div class="card"><p>No session configured for this day.</p></div>`;
      return;
    }

    // Merge session overrides layer
    const session = StorageService.resolveSessionWithOverrides(baseSession, state.data.overrides);
    const sessionType = window.PLAN_DATA.sessionTypes[session.type] || window.PLAN_DATA.sessionTypes['rest'];
    const log = getOrCreateSessionLog(state.currentIsoWeek, state.selectedDayIndex, session.id);

    const isToday = (state.currentIsoWeek === state.todayIsoWeek && state.selectedDayIndex === state.todayDayIndex);
    const weekDates = getWeekDates(state.currentIsoWeek);
    const currentDate = weekDates[state.selectedDayIndex];

    container.innerHTML = `
      <!-- Session Header Card -->
      <div class="session-header-card" style="--session-color: ${sessionType.color}">
        <div class="session-header-top">
          <div class="session-title-group">
            <span class="session-day-label">
              ${DAY_NAMES[state.selectedDayIndex]}, ${currentDate.getDate()} ${currentDate.toLocaleString('en-US', { month: 'short' })} ${isToday ? '• TODAY' : ''}
            </span>
            <h1 class="session-title">${session.title}</h1>
          </div>

          <div class="session-header-actions">
            ${session.id !== 'muay-thai-1' && session.id !== 'muay-thai-2' ? `
              <button id="btn-session-reschedule" class="btn-secondary btn-sm" title="Move session to another day">
                Reschedule ↺
              </button>
            ` : ''}
          </div>
        </div>

        <div class="session-meta-row">
          <span class="badge" style="background-color: ${sessionType.bgLight}; color: ${sessionType.color}; border-color: ${sessionType.color}40">
            ${sessionType.icon} ${sessionType.label}
          </span>
          <span class="badge">⏱ ${session.duration}</span>
          ${session.hasOverrides ? `<span class="badge text-warning">● Customized</span>` : ''}
        </div>

        <p class="session-goal-text"><strong>Goal:</strong> ${session.goal}</p>
        ${session.when ? `<p class="session-when-text">${session.when}</p>` : ''}
        ${session.notes ? `<p class="session-when-text">${session.notes}</p>` : ''}

        <!-- Edit Mode Toggle Header Bar -->
        ${(session.exercises && session.exercises.length > 0) || state.editMode ? `
          <div class="session-controls-bar">
            <label class="edit-mode-toggle">
              <input type="checkbox" id="toggle-session-edit-mode" class="visually-hidden" ${state.editMode ? 'checked' : ''}>
              <span class="edit-mode-pill">
                ✏️ ${state.editMode ? 'Exit Edit Mode' : 'Edit Exercises'}
              </span>
            </label>

            ${state.editMode ? `
              <div class="edit-mode-actions">
                <button id="btn-add-exercise-to-session" class="btn-secondary btn-sm">+ Add Exercise</button>
                <button id="btn-reset-session-overrides" class="btn-secondary btn-sm text-warning" title="Restore original plan defaults">Reset Session</button>
              </div>
            ` : ''}
          </div>

          ${state.editMode && state.data.overrides && state.data.overrides[session.id] && state.data.overrides[session.id].hidden && state.data.overrides[session.id].hidden.length > 0 ? `
            <div class="hidden-exercises-panel" style="margin-top: 12px; padding: 10px; background: var(--bg-input); border-radius: var(--radius-sm); border: 1px dashed var(--border-subtle);">
              <div style="font-size: 0.8rem; font-weight: 700; margin-bottom: 6px; color: var(--accent-warning);">
                Hidden Exercises (${state.data.overrides[session.id].hidden.length})
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${state.data.overrides[session.id].hidden.map(hiddenId => {
                  const hiddenName = hiddenId.replace(/-/g, ' ');
                  return `<button class="btn-secondary btn-sm btn-unhide-ex" data-unhide-id="${hiddenId}" title="Restore to session">↩ Unhide ${hiddenName}</button>`;
                }).join('')}
              </div>
            </div>
          ` : ''}
        ` : ''}
      </div>

      <!-- Session-Specific Content -->
      <div id="session-body-content" class="session-body-content">
        <!-- Rendered based on session type -->
      </div>

      <!-- Daily Recovery & Notes Card -->
      <div class="wellness-card">
        <h2 class="card-title">Recovery & Session Notes</h2>
        
        <div class="wellness-grid">
          <div class="form-group">
            <label class="form-label">How do I feel today? (1–5)</label>
            <div class="feeling-pills">
              <button class="btn-feeling ${log.feeling === 1 ? 'active' : ''}" data-score="1" title="Sore / Drained">😫</button>
              <button class="btn-feeling ${log.feeling === 2 ? 'active' : ''}" data-score="2" title="Tired">🥱</button>
              <button class="btn-feeling ${log.feeling === 3 ? 'active' : ''}" data-score="3" title="Good / Normal">🙂</button>
              <button class="btn-feeling ${log.feeling === 4 ? 'active' : ''}" data-score="4" title="Great / Strong">💪</button>
              <button class="btn-feeling ${log.feeling === 5 ? 'active' : ''}" data-score="5" title="Peak Energy">🔥</button>
            </div>
          </div>

          <div class="form-group">
            <label for="input-sleep-hours" class="form-label">Sleep Hours</label>
            <input type="number" id="input-sleep-hours" class="text-input" step="0.5" min="0" max="16" placeholder="e.g. 8.0" value="${log.sleepHours || ''}">
          </div>
        </div>

        <div class="form-group">
          <label for="session-free-notes" class="form-label">Session Notes</label>
          <textarea id="session-free-notes" class="text-input" rows="2" placeholder="How did training feel? Form cues, weight feeling, sparring notes...">${log.notes || ''}</textarea>
        </div>
      </div>
    `;

    // Render session specific body (Muay Thai vs Cardio vs Strength vs Rest)
    renderSessionBody(session, log);

    // Bind Session Header Events
    bindSessionHeaderEvents(session, log);
  }

  function renderSessionBody(session, log) {
    const bodyEl = document.getElementById('session-body-content');
    if (!bodyEl) return;

    if (session.type === 'muay-thai') {
      renderMuayThaiBody(bodyEl, session, log);
    } else if (session.type === 'cardio-mobility') {
      renderCardioMobilityBody(bodyEl, session, log);
    } else if (session.type === 'rest') {
      renderRestBody(bodyEl, session, log);
    } else {
      renderStrengthBody(bodyEl, session, log);
    }
  }

  /* ==========================================================================
     Muay Thai Session Body
     ========================================================================== */

  function renderMuayThaiBody(container, session, log) {
    const isDone = log.completed;
    container.innerHTML = `
      <div class="muay-thai-card">
        <div>
          <h2 class="card-title">Club Training & Sparring</h2>
          <p class="text-muted text-sm" style="margin-top: 4px;">
            Technique drills, pads, clinch work, and conditioning. Muay Thai is the core focus of your athletic program.
          </p>
        </div>

        <div class="rpe-scale-group">
          <label class="form-label">Rate of Perceived Exertion (RPE 1–10): <strong id="rpe-val-display">${log.rpe || '—'}</strong></label>
          <div class="rpe-buttons">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => `
              <button class="btn-rpe ${log.rpe === val ? 'active' : ''}" data-rpe="${val}">${val}</button>
            `).join('')}
          </div>
        </div>

        <button id="btn-toggle-muaythai-done" class="btn-primary btn-block ${isDone ? 'btn-secondary' : ''}" style="min-height: 52px; font-size: 1rem;">
          ${isDone ? '✓ Muay Thai Session Completed' : 'Mark Muay Thai as Done 🔥'}
        </button>
      </div>
    `;

    // Events
    container.querySelectorAll('.btn-rpe').forEach(btn => {
      btn.addEventListener('click', () => {
        ensureAudioUnlocked();
        const rpe = parseInt(btn.dataset.rpe, 10);
        log.rpe = rpe;
        document.getElementById('rpe-val-display').textContent = rpe;
        container.querySelectorAll('.btn-rpe').forEach(b => b.classList.toggle('active', b === btn));
        saveCurrentState();
      });
    });

    const doneBtn = document.getElementById('btn-toggle-muaythai-done');
    doneBtn.addEventListener('click', () => {
      ensureAudioUnlocked();
      log.completed = !log.completed;
      log.completedAt = log.completed ? new Date().toISOString() : null;
      saveCurrentState();
      renderActiveSession();
      renderWeekStrip();
    });
  }

  /* ==========================================================================
     Cardio & Mobility Session Body
     ========================================================================== */

  function renderCardioMobilityBody(container, session, log) {
    const isDone = log.completed;
    const selectedVariant = log.variant || 'run-7km';

    container.innerHTML = `
      <div class="cardio-log-card">
        <div>
          <h2 class="card-title">Cardio & Mobility Session</h2>
          <p class="text-muted text-sm" style="margin-top: 4px;">
            Aerobic foundation build. Keep heart rate conversational or choose the bag interval variant.
          </p>
        </div>

        <!-- Variant Selector -->
        <div class="form-group">
          <label class="form-label">Protocol Done:</label>
          <div class="variant-pills">
            <button class="btn-variant-pill ${selectedVariant === 'run-7km' ? 'active' : ''}" data-variant="run-7km">
              🏃 Run (7.5 km)
            </button>
            <button class="btn-variant-pill ${selectedVariant === 'cross-trainer' ? 'active' : ''}" data-variant="cross-trainer">
              🚴 Cross Trainer (35–45m)
            </button>
            <button class="btn-variant-pill ${selectedVariant === 'home-trainer' ? 'active' : ''}" data-variant="home-trainer">
              🚲 Home Trainer (35–45m)
            </button>
            <button class="btn-variant-pill ${selectedVariant === 'bag-intervals' ? 'active' : ''}" data-variant="bag-intervals">
              🥊 Bag Intervals (~30m)
            </button>
          </div>
        </div>

        <!-- Metrics Inputs -->
        <div class="form-row form-grid-3">
          <div class="form-group">
            <label for="cardio-duration" class="form-label">Duration (min)</label>
            <input type="number" id="cardio-duration" class="text-input" inputmode="numeric" placeholder="e.g. 40" value="${log.duration || ''}">
          </div>
          <div class="form-group">
            <label for="cardio-distance" class="form-label">Distance (km)</label>
            <input type="text" id="cardio-distance" class="text-input" inputmode="decimal" placeholder="e.g. 7.5" value="${log.distance || ''}">
          </div>
          <div class="form-group">
            <label for="cardio-avghr" class="form-label">Avg HR (bpm)</label>
            <input type="number" id="cardio-avghr" class="text-input" inputmode="numeric" placeholder="e.g. 145" value="${log.avgHr || ''}">
          </div>
        </div>

        <!-- RPE Scale -->
        <div class="rpe-scale-group">
          <label class="form-label">Effort Rating (RPE 1–10): <strong id="cardio-rpe-display">${log.rpe || '—'}</strong></label>
          <div class="rpe-buttons">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => `
              <button class="btn-rpe ${log.rpe === val ? 'active' : ''}" data-rpe="${val}">${val}</button>
            `).join('')}
          </div>
        </div>

        <button id="btn-toggle-cardio-done" class="btn-primary btn-block ${isDone ? 'btn-secondary' : ''}" style="min-height: 50px;">
          ${isDone ? '✓ Cardio Logged' : 'Mark Session as Done'}
        </button>
      </div>

      <!-- Mobility Section -->
      <div class="collapsible-card open" style="margin-top: 14px;">
        <button class="collapsible-header" aria-expanded="true">
          <span>🧘 Mobility Routine (15–20 min)</span>
          <span class="chevron">▼</span>
        </button>
        <div class="collapsible-content">
          <div class="checklist-group">
            ${(session.exercises || []).map((ex, idx) => {
              const checked = log.mobilityDone && log.mobilityDone[idx];
              return `
                <div class="checklist-item ${checked ? 'checked' : ''}" data-mobility-idx="${idx}">
                  <div class="check-box">${checked ? '✓' : ''}</div>
                  <div class="flex-1">
                    <strong>${ex.name}</strong>
                    <span class="text-muted text-xs block">${ex.repRange} • ${ex.tip}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    // Event Listeners
    container.querySelectorAll('.btn-variant-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        ensureAudioUnlocked();
        log.variant = btn.dataset.variant;
        container.querySelectorAll('.btn-variant-pill').forEach(b => b.classList.toggle('active', b === btn));
        saveCurrentState();
      });
    });

    ['cardio-duration', 'cardio-distance', 'cardio-avghr'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('input', () => {
          log.duration = document.getElementById('cardio-duration').value;
          log.distance = document.getElementById('cardio-distance').value;
          log.avgHr = document.getElementById('cardio-avghr').value;
          saveCurrentState();
        });
      }
    });

    container.querySelectorAll('.btn-rpe').forEach(btn => {
      btn.addEventListener('click', () => {
        ensureAudioUnlocked();
        const rpe = parseInt(btn.dataset.rpe, 10);
        log.rpe = rpe;
        document.getElementById('cardio-rpe-display').textContent = rpe;
        container.querySelectorAll('.btn-rpe').forEach(b => b.classList.toggle('active', b === btn));
        saveCurrentState();
      });
    });

    const doneBtn = document.getElementById('btn-toggle-cardio-done');
    doneBtn.addEventListener('click', () => {
      ensureAudioUnlocked();
      log.completed = !log.completed;
      log.completedAt = log.completed ? new Date().toISOString() : null;
      saveCurrentState();
      renderActiveSession();
      renderWeekStrip();
    });

    // Mobility checklist toggle
    container.querySelectorAll('[data-mobility-idx]').forEach(item => {
      item.addEventListener('click', () => {
        ensureAudioUnlocked();
        const idx = parseInt(item.dataset.mobilityIdx, 10);
        if (!log.mobilityDone) log.mobilityDone = [];
        log.mobilityDone[idx] = !log.mobilityDone[idx];
        saveCurrentState();
        item.classList.toggle('checked', log.mobilityDone[idx]);
        item.querySelector('.check-box').textContent = log.mobilityDone[idx] ? '✓' : '';
      });
    });
  }

  /* ==========================================================================
     Rest Day Body
     ========================================================================== */

  function renderRestBody(container, session, log) {
    const isDone = log.completed;
    container.innerHTML = `
      <div class="card">
        <h2 class="card-title">Active Recovery & Restoration</h2>
        <p class="text-muted text-sm">
          Recovery is where muscle adaptation, tendon remodelling, and nervous system replenishment happen.
        </p>
        <ul style="padding-left: 20px; font-size: 0.88rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 6px; margin: 8px 0;">
          <li>Aim for 8–9 hours of quality sleep.</li>
          <li>Take an easy 20–30 minute walk outdoors.</li>
          <li>Rehydrate with electrolytes and hit your daily protein target.</li>
        </ul>

        <button id="btn-toggle-rest-done" class="btn-secondary btn-block" style="min-height: 48px; margin-top: 8px;">
          ${isDone ? '✓ Rest Day Acknowledged' : 'Mark Rest Day Complete'}
        </button>
      </div>

      <!-- Optional Mini-Mobility Module on Rest Day -->
      ${renderMiniMobilityModule(session, log)}
    `;

    const doneBtn = document.getElementById('btn-toggle-rest-done');
    doneBtn.addEventListener('click', () => {
      ensureAudioUnlocked();
      log.completed = !log.completed;
      log.completedAt = log.completed ? new Date().toISOString() : null;
      saveCurrentState();
      renderActiveSession();
      renderWeekStrip();
    });

    bindMiniMobilityEvents(container, log);
  }

  /* ==========================================================================
     Strength Workout Body (Exercises, Sets, Warmup, Cooldown)
     ========================================================================== */

  function renderStrengthBody(container, session, log) {
    // Warmup collapsible
    const warmupHtml = session.warmup && session.warmup.length > 0 ? `
      <div class="collapsible-card ${log.warmupOpen ? 'open' : ''}" id="section-warmup">
        <button class="collapsible-header" aria-expanded="${log.warmupOpen ? 'true' : 'false'}">
          <span>🔥 Warm-up Checklist (8 min)</span>
          <span class="chevron">▼</span>
        </button>
        <div class="collapsible-content">
          <div class="checklist-group">
            ${session.warmup.map((item, idx) => {
              const checked = log.warmup && log.warmup[idx];
              return `
                <div class="checklist-item ${checked ? 'checked' : ''}" data-warmup-idx="${idx}">
                  <div class="check-box">${checked ? '✓' : ''}</div>
                  <span class="text-sm">${item}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    ` : '';

    // Exercises cards list
    const exercisesHtml = (session.exercises || []).map((ex, exIdx) => {
      return renderExerciseCard(session, ex, exIdx, log);
    }).join('');

    // Cooldown collapsible
    const cooldownHtml = session.cooldown && session.cooldown.length > 0 ? `
      <div class="collapsible-card ${log.cooldownOpen ? 'open' : ''}" id="section-cooldown" style="margin-top: 14px;">
        <button class="collapsible-header" aria-expanded="${log.cooldownOpen ? 'true' : 'false'}">
          <span>❄️ Cool-down & Decompression (Optional)</span>
          <span class="chevron">▼</span>
        </button>
        <div class="collapsible-content">
          <div class="checklist-group">
            ${session.cooldown.map((item, idx) => {
              const checked = log.cooldown && log.cooldown[idx];
              return `
                <div class="checklist-item ${checked ? 'checked' : ''}" data-cooldown-idx="${idx}">
                  <div class="check-box">${checked ? '✓' : ''}</div>
                  <span class="text-sm">${item}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    ` : '';

    container.innerHTML = `
      ${warmupHtml}

      <div class="workout-section" style="margin-top: 14px;">
        <div class="workout-section-title-row">
          <h2 class="section-title">Main Workout (${(session.exercises || []).length} Exercises)</h2>
          ${state.editMode ? `<span class="badge text-warning">Edit Mode Active</span>` : ''}
        </div>
        ${exercisesHtml}
      </div>

      ${cooldownHtml}

      <!-- Mini-Mobility Module -->
      ${renderMiniMobilityModule(session, log)}
    `;

    // Bind Strength Body Events
    bindStrengthBodyEvents(container, session, log);
  }

  function renderExerciseCard(session, ex, exIdx, log) {
    if (!log.exercises) log.exercises = {};
    if (!log.exercises[ex.id]) {
      log.exercises[ex.id] = { sets: [] };
    }
    const exLog = log.exercises[ex.id];

    // Check progressive overload hint from previous sessions
    const showIncreaseHint = StorageService.checkProgressHint(state.data, ex);

    // Retrieve previous logged performance for placeholder prefill
    const prevPerf = StorageService.getPreviousExercisePerformance(state.data, ex.id);
    const placeholderWeight = prevPerf && prevPerf.firstWeight ? prevPerf.firstWeight : '';
    const placeholderReps = prevPerf && prevPerf.firstReps ? prevPerf.firstReps : (ex.repMax || '');
    const prevSummary = prevPerf ? prevPerf.display : '—';

    // Total target sets
    const numSets = ex.targetSets || 3;
    const setsRows = [];

    for (let sIdx = 0; sIdx < numSets; sIdx++) {
      const setLog = (exLog.sets && exLog.sets[sIdx]) || { weight: '', reps: '', done: false };
      const isDone = !!setLog.done;

      setsRows.push(`
        <div class="set-row ${isDone ? 'done' : ''}" data-set-idx="${sIdx}">
          <span class="set-number">${sIdx + 1}</span>
          <span class="set-prev-value" title="Previous session">${prevSummary}</span>
          <input type="text" class="input-weight" inputmode="decimal" placeholder="${placeholderWeight || '—'}" value="${setLog.weight || ''}" aria-label="Weight in kg">
          <input type="number" class="input-reps" inputmode="numeric" placeholder="${placeholderReps || ex.repMax || '—'}" value="${setLog.reps || ''}" aria-label="Reps completed">
          <button class="btn-set-done ${isDone ? 'done' : ''}" data-set-idx="${sIdx}" data-rest="${ex.restSeconds}" aria-label="Mark set done">
            ${isDone ? '✓' : ''}
          </button>
        </div>
      `);
    }

    // Has alternatives
    const hasAlts = ex.alternatives && ex.alternatives.length > 0;

    return `
      <div class="exercise-card ${ex.isEdited || ex.isReplaced || ex.isCustomAdded ? 'edited' : ''}" data-exercise-id="${ex.id}" data-exercise-idx="${exIdx}">
        <div class="exercise-card-header">
          <div class="exercise-title-area">
            <div class="exercise-name-row">
              <h3 class="exercise-name">${ex.name}</h3>
              ${ex.isEdited || ex.isReplaced || ex.isCustomAdded ? `<span class="edited-dot" title="Customized"></span>` : ''}
              ${showIncreaseHint ? `<span class="overload-hint-badge">💡 Increase next time</span>` : ''}
            </div>

            <div class="exercise-meta-pills">
              <span class="badge">🎯 ${ex.targetSets} × ${ex.repRange}</span>
              <span class="badge">⏳ Rest: ${ex.restDisplay || (ex.restSeconds + 's')}</span>
              ${ex.isCustomAdded ? `<span class="badge text-warning">Custom</span>` : ''}
            </div>
          </div>

          <!-- Edit Mode Reorder & Edit Controls -->
          ${state.editMode ? `
            <div class="exercise-edit-toolbar">
              <button class="btn-icon btn-ex-up" data-exercise-idx="${exIdx}" title="Move Up" ${exIdx === 0 ? 'disabled' : ''}>▲</button>
              <button class="btn-icon btn-ex-down" data-exercise-idx="${exIdx}" title="Move Down" ${exIdx === (session.exercises.length - 1) ? 'disabled' : ''}>▼</button>
              <button class="btn-icon btn-ex-edit" data-exercise-id="${ex.id}" title="Edit Exercise Settings">✏️</button>
            </div>
          ` : ''}
        </div>

        ${ex.tip ? `<div class="exercise-tip-box">💡 <strong>Tip:</strong> ${ex.tip}</div>` : ''}

        <!-- Collapsible Alternatives for this session -->
        ${hasAlts ? `
          <div class="alternatives-container">
            <button class="alternatives-toggle-btn" data-toggle-alts="${ex.id}">
              <span>⇄ Alternatives (${ex.alternatives.length})</span>
              <span class="chevron-sm">▼</span>
            </button>
            <div class="alternatives-list hidden" id="alts-list-${ex.id}">
              ${ex.alternatives.map(alt => `
                <button class="alt-exercise-chip" data-swap-alt-id="${alt.id}" data-swap-alt-name="${alt.name}">
                  <span>${alt.name}</span>
                  <span class="alt-swap-action">Swap in ↺</span>
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Set Table -->
        <div class="set-table">
          <div class="set-table-header">
            <span>SET</span>
            <span>PREV</span>
            <span>KG</span>
            <span>REPS</span>
            <span>DONE</span>
          </div>
          ${setsRows.join('')}
        </div>

        <!-- Table Footer: Copy Last Set Shortcut -->
        <div class="set-table-footer">
          <button class="btn-set-action btn-copy-set" data-exercise-id="${ex.id}">
            📋 Copy first set to all
          </button>
          <span class="text-xs text-muted">Tap ✓ to start rest timer</span>
        </div>
      </div>
    `;
  }

  function renderMiniMobilityModule(session, log) {
    if (session.id === 'aerobic-base-mobility') {
      return `
        <div class="card" style="margin-top: 14px;">
          <p class="text-muted text-sm">
            💡 You already have a full mobility session today; pick one of the two.
          </p>
        </div>
      `;
    }

    const miniMobilityData = window.PLAN_DATA.sessions['mini-mobility'];
    const isIncluded = !!log.includeMiniMobility;

    return `
      <div class="card" style="margin-top: 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h3 class="card-title">Mini Mobility (10 min, Optional)</h3>
            <span class="text-muted text-xs">Daily joint prep, ankle & hip decompression</span>
          </div>
          <label style="cursor: pointer;">
            <input type="checkbox" id="toggle-mini-mobility" class="visually-hidden" ${isIncluded ? 'checked' : ''}>
            <span class="badge ${isIncluded ? 'text-success' : ''}" style="padding: 6px 12px; font-size: 0.8rem;">
              ${isIncluded ? '✓ Included' : '+ Add to day'}
            </span>
          </label>
        </div>

        ${isIncluded ? `
          <div class="checklist-group" style="margin-top: 10px;">
            ${(miniMobilityData.exercises || []).map((ex, idx) => {
              const checked = log.miniMobility && log.miniMobility[idx];
              return `
                <div class="checklist-item ${checked ? 'checked' : ''}" data-minimob-idx="${idx}">
                  <div class="check-box">${checked ? '✓' : ''}</div>
                  <div class="flex-1">
                    <strong>${ex.name}</strong>
                    <span class="text-muted text-xs block">${ex.repRange} • ${ex.tip}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  /* ==========================================================================
     Event Handlers: Session Logging, Inputs & Set Completion
     ========================================================================== */

  function bindSessionHeaderEvents(session, log) {
    // Reschedule button
    const btnReschedule = document.getElementById('btn-session-reschedule');
    if (btnReschedule) {
      btnReschedule.addEventListener('click', () => {
        openRescheduleModal(session.id);
      });
    }

    // Edit mode toggle
    const toggleEdit = document.getElementById('toggle-session-edit-mode');
    if (toggleEdit) {
      toggleEdit.addEventListener('change', (e) => {
        state.editMode = e.target.checked;
        renderActiveSession();
      });
    }

    // Add exercise button in edit mode
    const btnAddEx = document.getElementById('btn-add-exercise-to-session');
    if (btnAddEx) {
      btnAddEx.addEventListener('click', () => {
        openAddExerciseModal(session.id);
      });
    }

    // Reset session overrides button in edit mode
    const btnResetSession = document.getElementById('btn-reset-session-overrides');
    if (btnResetSession) {
      btnResetSession.addEventListener('click', () => {
        showConfirmDialog(
          'Reset Whole Session to Default?',
          'This will remove all your exercise replacements, custom additions, reordering, and restore the original program.',
          () => {
            if (state.data.overrides && state.data.overrides[session.id]) {
              delete state.data.overrides[session.id];
              saveCurrentState();
              renderActiveSession();
            }
          }
        );
      });
    }

    // Unhide exercise buttons
    document.querySelectorAll('.btn-unhide-ex').forEach(btn => {
      btn.addEventListener('click', () => {
        ensureAudioUnlocked();
        const unhideId = btn.dataset.unhideId;
        const overrides = state.data.overrides && state.data.overrides[session.id];
        if (overrides && overrides.hidden) {
          overrides.hidden = overrides.hidden.filter(h => h !== unhideId);
          saveCurrentState();
          renderActiveSession();
        }
      });
    });

    // Daily Feeling pills
    document.querySelectorAll('.btn-feeling').forEach(btn => {
      btn.addEventListener('click', () => {
        ensureAudioUnlocked();
        const score = parseInt(btn.dataset.score, 10);
        log.feeling = score;
        document.querySelectorAll('.btn-feeling').forEach(b => b.classList.toggle('active', b === btn));
        saveCurrentState();
      });
    });

    // Sleep hours input
    const sleepInput = document.getElementById('input-sleep-hours');
    if (sleepInput) {
      sleepInput.addEventListener('input', () => {
        log.sleepHours = sleepInput.value;
        saveCurrentState();
      });
    }

    // Free text notes
    const notesInput = document.getElementById('session-free-notes');
    if (notesInput) {
      notesInput.addEventListener('input', () => {
        log.notes = notesInput.value;
        saveCurrentState();
      });
    }
  }

  function bindStrengthBodyEvents(container, session, log) {
    // Warmup collapsible
    const warmupHeader = container.querySelector('#section-warmup .collapsible-header');
    if (warmupHeader) {
      warmupHeader.addEventListener('click', () => {
        const parent = warmupHeader.closest('.collapsible-card');
        parent.classList.toggle('open');
        log.warmupOpen = parent.classList.contains('open');
        saveCurrentState();
      });
    }

    container.querySelectorAll('[data-warmup-idx]').forEach(item => {
      item.addEventListener('click', () => {
        ensureAudioUnlocked();
        const idx = parseInt(item.dataset.warmupIdx, 10);
        if (!log.warmup) log.warmup = [];
        log.warmup[idx] = !log.warmup[idx];
        item.classList.toggle('checked', log.warmup[idx]);
        item.querySelector('.check-box').textContent = log.warmup[idx] ? '✓' : '';
        saveCurrentState();
      });
    });

    // Cooldown collapsible
    const cooldownHeader = container.querySelector('#section-cooldown .collapsible-header');
    if (cooldownHeader) {
      cooldownHeader.addEventListener('click', () => {
        const parent = cooldownHeader.closest('.collapsible-card');
        parent.classList.toggle('open');
        log.cooldownOpen = parent.classList.contains('open');
        saveCurrentState();
      });
    }

    container.querySelectorAll('[data-cooldown-idx]').forEach(item => {
      item.addEventListener('click', () => {
        ensureAudioUnlocked();
        const idx = parseInt(item.dataset.cooldownIdx, 10);
        if (!log.cooldown) log.cooldown = [];
        log.cooldown[idx] = !log.cooldown[idx];
        item.classList.toggle('checked', log.cooldown[idx]);
        item.querySelector('.check-box').textContent = log.cooldown[idx] ? '✓' : '';
        saveCurrentState();
      });
    });

    // Exercise Set Table Inputs & Done Checkboxes
    container.querySelectorAll('.exercise-card').forEach(card => {
      const exId = card.dataset.exerciseId;
      if (!log.exercises[exId]) log.exercises[exId] = { sets: [] };
      const exLog = log.exercises[exId];

      card.querySelectorAll('.set-row').forEach(row => {
        const sIdx = parseInt(row.dataset.setIdx, 10);
        if (!exLog.sets[sIdx]) exLog.sets[sIdx] = { weight: '', reps: '', done: false };

        const weightInput = row.querySelector('.input-weight');
        const repsInput = row.querySelector('.input-reps');
        const doneBtn = row.querySelector('.btn-set-done');

        // Input changes
        weightInput.addEventListener('input', () => {
          exLog.sets[sIdx].weight = weightInput.value;
          saveCurrentState();
        });

        repsInput.addEventListener('input', () => {
          exLog.sets[sIdx].reps = repsInput.value;
          saveCurrentState();
        });

        // Set Done button (starts Rest Timer)
        doneBtn.addEventListener('click', () => {
          ensureAudioUnlocked();
          const wasDone = !!exLog.sets[sIdx].done;
          exLog.sets[sIdx].done = !wasDone;

          // If no weight was explicitly typed, copy from placeholder or set 1
          if (!exLog.sets[sIdx].weight && weightInput.placeholder && weightInput.placeholder !== '—') {
            exLog.sets[sIdx].weight = weightInput.placeholder;
            weightInput.value = weightInput.placeholder;
          }
          if (!exLog.sets[sIdx].reps && repsInput.placeholder && repsInput.placeholder !== '—') {
            exLog.sets[sIdx].reps = repsInput.placeholder;
            repsInput.value = repsInput.placeholder;
          }

          row.classList.toggle('done', exLog.sets[sIdx].done);
          doneBtn.classList.toggle('done', exLog.sets[sIdx].done);
          doneBtn.textContent = exLog.sets[sIdx].done ? '✓' : '';

          // If set was just marked DONE, launch the rest timer!
          if (!wasDone) {
            const restSec = parseInt(doneBtn.dataset.rest, 10) || 90;
            startRestTimer(restSec);
          }

          // Evaluate whether whole session is completed
          checkAutoSessionCompletion(session, log);
          saveCurrentState();
        });
      });

      // "Copy first set to all" shortcut button
      const copyBtn = card.querySelector('.btn-copy-set');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          ensureAudioUnlocked();
          const firstSet = exLog.sets[0];
          if (!firstSet || (!firstSet.weight && !firstSet.reps)) {
            // Nothing in set 1, check placeholder
            const firstWeightInp = card.querySelector('.input-weight');
            const firstRepsInp = card.querySelector('.input-reps');
            if (firstWeightInp.value || firstRepsInp.value) {
              firstSet.weight = firstWeightInp.value;
              firstSet.reps = firstRepsInp.value;
            } else {
              return;
            }
          }

          card.querySelectorAll('.set-row').forEach((row, idx) => {
            if (idx > 0) {
              if (!exLog.sets[idx]) exLog.sets[idx] = { weight: '', reps: '', done: false };
              exLog.sets[idx].weight = firstSet.weight;
              exLog.sets[idx].reps = firstSet.reps;
              row.querySelector('.input-weight').value = firstSet.weight;
              row.querySelector('.input-reps').value = firstSet.reps;
            }
          });
          saveCurrentState();
        });
      }

      // Alternatives toggle button
      const altToggle = card.querySelector('[data-toggle-alts]');
      if (altToggle) {
        altToggle.addEventListener('click', () => {
          const list = card.querySelector(`#alts-list-${exId}`);
          if (list) list.classList.toggle('hidden');
        });
      }

      // Swap in alternative for this session
      card.querySelectorAll('[data-swap-alt-id]').forEach(swapBtn => {
        swapBtn.addEventListener('click', () => {
          ensureAudioUnlocked();
          const altId = swapBtn.dataset.swapAltId;
          const altName = swapBtn.dataset.swapAltName;

          // Swap name for this session in log
          if (!exLog.swappedWith) exLog.swappedWith = {};
          exLog.swappedWith = { id: altId, name: altName };
          saveCurrentState();

          // Update exercise title on card
          card.querySelector('.exercise-name').textContent = altName;
          const altsList = card.querySelector(`#alts-list-${exId}`);
          if (altsList) altsList.classList.add('hidden');
        });
      });

      // Edit Mode buttons (Up, Down, Edit)
      const btnUp = card.querySelector('.btn-ex-up');
      if (btnUp) {
        btnUp.addEventListener('click', () => {
          const idx = parseInt(btnUp.dataset.exerciseIdx, 10);
          reorderSessionExercises(session.id, idx, idx - 1);
        });
      }

      const btnDown = card.querySelector('.btn-ex-down');
      if (btnDown) {
        btnDown.addEventListener('click', () => {
          const idx = parseInt(btnDown.dataset.exerciseIdx, 10);
          reorderSessionExercises(session.id, idx, idx + 1);
        });
      }

      const btnEdit = card.querySelector('.btn-ex-edit');
      if (btnEdit) {
        btnEdit.addEventListener('click', () => {
          openEditExerciseModal(session.id, ex);
        });
      }
    });

    // Mini mobility events
    bindMiniMobilityEvents(container, log);
  }

  function bindMiniMobilityEvents(container, log) {
    const toggle = container.querySelector('#toggle-mini-mobility');
    if (toggle) {
      toggle.addEventListener('change', (e) => {
        ensureAudioUnlocked();
        log.includeMiniMobility = e.target.checked;
        saveCurrentState();
        renderActiveSession();
      });
    }

    container.querySelectorAll('[data-minimob-idx]').forEach(item => {
      item.addEventListener('click', () => {
        ensureAudioUnlocked();
        const idx = parseInt(item.dataset.minimobIdx, 10);
        if (!log.miniMobility) log.miniMobility = [];
        log.miniMobility[idx] = !log.miniMobility[idx];
        item.classList.toggle('checked', log.miniMobility[idx]);
        item.querySelector('.check-box').textContent = log.miniMobility[idx] ? '✓' : '';
        saveCurrentState();
      });
    });
  }

  function checkAutoSessionCompletion(session, log) {
    if (!session.exercises || session.exercises.length === 0) return;
    let allDone = true;

    for (const ex of session.exercises) {
      const exLog = log.exercises && log.exercises[ex.id];
      if (!exLog || !exLog.sets || exLog.sets.length === 0) {
        allDone = false;
        break;
      }
      const doneSets = exLog.sets.filter(s => s && s.done).length;
      if (doneSets < (ex.targetSets || 3)) {
        allDone = false;
        break;
      }
    }

    log.completed = allDone;
    if (allDone && !log.completedAt) {
      log.completedAt = new Date().toISOString();
    }
    updateWeekStripCompletion();
  }

  /* ==========================================================================
     Edit Mode Overrides Layer (Up/Down, Edit, Replace, Hide, Reset)
     ========================================================================== */

  function getOrCreateSessionOverrides(sessionId) {
    if (!state.data.overrides) state.data.overrides = {};
    if (!state.data.overrides[sessionId]) {
      state.data.overrides[sessionId] = {
        hidden: [],
        replaced: {},
        edited: {},
        added: [],
        order: []
      };
    }
    return state.data.overrides[sessionId];
  }

  function reorderSessionExercises(sessionId, fromIdx, toIdx) {
    const baseSession = window.PLAN_DATA.sessions[sessionId];
    const resolvedSession = StorageService.resolveSessionWithOverrides(baseSession, state.data.overrides);
    const exercises = resolvedSession.exercises;

    if (toIdx < 0 || toIdx >= exercises.length) return;

    const currentOrder = exercises.map(e => e.id);
    const movedId = currentOrder.splice(fromIdx, 1)[0];
    currentOrder.splice(toIdx, 0, movedId);

    const overrides = getOrCreateSessionOverrides(sessionId);
    overrides.order = currentOrder;

    saveCurrentState();
    renderActiveSession();
  }

  function openEditExerciseModal(sessionId, ex) {
    state.activeEditingExercise = { sessionId, exercise: ex };
    const modal = document.getElementById('modal-edit-exercise');

    document.getElementById('edit-exercise-title').textContent = `Edit ${ex.name}`;
    document.getElementById('edit-exercise-subtitle').textContent = `Session: ${sessionId}`;

    document.getElementById('edit-target-sets').value = ex.targetSets || 3;
    document.getElementById('edit-rep-range').value = ex.repRange || '8–12';
    document.getElementById('edit-rest-seconds').value = ex.restSeconds || 90;
    document.getElementById('edit-personal-tip').value = ex.tip || '';
    document.getElementById('edit-custom-replace-name').value = '';

    // Populate alternatives dropdown
    const selectRep = document.getElementById('edit-select-replacement');
    selectRep.innerHTML = `<option value="">Keep "${ex.name}"</option>`;

    if (ex.alternatives && ex.alternatives.length > 0) {
      ex.alternatives.forEach(alt => {
        selectRep.innerHTML += `<option value="${alt.id}" data-name="${alt.name}">Replace with: ${alt.name}</option>`;
      });
    }

    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
  }

  function openAddExerciseModal(sessionId) {
    state.activeEditingExercise = { sessionId };
    const modal = document.getElementById('modal-add-exercise');

    // Populate pool results with exercises from plan.js
    renderExercisePoolSearch('', sessionId);

    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
  }

  function renderExercisePoolSearch(query, sessionId) {
    const poolContainer = document.getElementById('exercise-pool-results');
    if (!poolContainer) return;

    // Gather all unique exercises across all sessions in plan.js
    const allExercises = [];
    const seenIds = new Set();

    Object.values(window.PLAN_DATA.sessions).forEach(sess => {
      (sess.exercises || []).forEach(ex => {
        if (!seenIds.has(ex.id)) {
          seenIds.add(ex.id);
          allExercises.push(ex);
        }
      });
    });

    const filtered = allExercises.filter(ex => {
      if (!query) return true;
      return ex.name.toLowerCase().includes(query.toLowerCase());
    });

    if (filtered.length === 0) {
      poolContainer.innerHTML = `<p class="text-muted text-sm" style="padding: 10px;">No matching exercises found. You can create a custom one below.</p>`;
      return;
    }

    poolContainer.innerHTML = filtered.slice(0, 10).map(ex => `
      <div class="alt-exercise-chip" style="margin-bottom: 6px;">
        <div>
          <strong>${ex.name}</strong>
          <span class="text-muted text-xs block">${ex.targetSets} sets • ${ex.repRange} • Rest ${ex.restSeconds}s</span>
        </div>
        <button class="btn-primary btn-sm" data-add-pool-id="${ex.id}">+ Add</button>
      </div>
    `).join('');

    poolContainer.querySelectorAll('[data-add-pool-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.addPoolId;
        const targetEx = allExercises.find(x => x.id === id);
        if (targetEx) {
          const overrides = getOrCreateSessionOverrides(sessionId);
          // If was hidden, unhide
          overrides.hidden = (overrides.hidden || []).filter(h => h !== id);
          // Add to added
          if (!overrides.added) overrides.added = [];
          if (!overrides.added.some(x => x.id === id)) {
            overrides.added.push({ ...targetEx });
          }
          saveCurrentState();
          document.getElementById('modal-add-exercise').close();
          renderActiveSession();
        }
      });
    });
  }

  /* ==========================================================================
     Reschedule Feature (With Section 6 Rules & Warnings)
     ========================================================================== */

  function openRescheduleModal(sessionId) {
    state.activeReschedulingSessionId = sessionId;
    const session = window.PLAN_DATA.sessions[sessionId];
    const modal = document.getElementById('modal-reschedule');

    // Section 6 Check: Muay Thai cannot be moved
    const ruleCheck = window.PLAN_DATA.rules.canRescheduleSession(sessionId);
    if (!ruleCheck.allowed) {
      alert(ruleCheck.reason);
      return;
    }

    document.getElementById('reschedule-session-desc').textContent =
      `Move "${session.title}" to a different day this week.`;

    const currentSchedule = StorageService.getResolvedWeekSchedule(state.data, state.currentIsoWeek, window.PLAN_DATA);
    const targetDays = window.PLAN_DATA.rules.getAllowedDaysForSession(sessionId, currentSchedule);
    const listEl = document.getElementById('reschedule-options-list');
    const weekDates = getWeekDates(state.currentIsoWeek);

    listEl.innerHTML = targetDays.map(item => {
      const isCurrentDay = (item.dayIndex === state.selectedDayIndex);
      const occupant = window.PLAN_DATA.sessions[item.occupiedBy] || { title: 'Rest' };
      const date = weekDates[item.dayIndex];
      const hasWarnings = item.warnings && item.warnings.length > 0;

      return `
        <div class="reschedule-item ${hasWarnings ? 'has-warning' : ''}" data-target-day="${item.dayIndex}">
          <div class="reschedule-item-header">
            <span class="reschedule-day-name">${DAY_NAMES[item.dayIndex]} (${date.getDate()} ${date.toLocaleString('en-US', { month: 'short' })})</span>
            <span class="reschedule-current-occupant">${isCurrentDay ? 'Current day' : `Currently: ${occupant.shortTitle || occupant.title}`}</span>
          </div>
          ${hasWarnings ? `
            <div class="reschedule-warning-box">
              ⚠️ ${item.warnings.join(' ')}
            </div>
          ` : `
            <span class="text-xs text-muted" style="color: var(--accent-success)">✓ Recommended / Safe</span>
          `}
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('[data-target-day]').forEach(item => {
      item.addEventListener('click', () => {
        ensureAudioUnlocked();
        const targetDay = parseInt(item.dataset.targetDay, 10);
        if (targetDay === state.selectedDayIndex) {
          modal.close();
          return;
        }

        // Move session to target day
        const currentOccupant = currentSchedule[targetDay];
        StorageService.setScheduleOverride(state.data, state.currentIsoWeek, targetDay, sessionId);
        // Replace source day with Rest or swapped occupant
        StorageService.setScheduleOverride(state.data, state.currentIsoWeek, state.selectedDayIndex, currentOccupant === sessionId ? 'rest' : currentOccupant);

        saveCurrentState();
        modal.close();
        selectDay(targetDay);
      });
    });

    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
  }

  /* ==========================================================================
     Progress Charts & Consistency Tracking (Plain SVG, Zero Libraries)
     ========================================================================== */

  function renderProgressView() {
    renderProgressSummary();
    renderConsistencyTracker();
    renderStrengthChart();
  }

  function renderProgressSummary() {
    let totalCompleted = 0;
    let muayThaiCompleted = 0;

    Object.values(state.data.logs || {}).forEach(log => {
      if (log.completed) {
        totalCompleted++;
        if (log.sessionId === 'muay-thai-1' || log.sessionId === 'muay-thai-2') {
          muayThaiCompleted++;
        }
      }
    });

    // Calculate active weekly streak
    const streak = calculateWeeklyStreak();

    document.getElementById('streak-count').textContent = streak;
    document.getElementById('total-workouts-count').textContent = totalCompleted;
    document.getElementById('muaythai-sessions-count').textContent = muayThaiCompleted;
  }

  function calculateWeeklyStreak() {
    let streak = 0;
    let checkWeek = state.todayIsoWeek;

    for (let i = 0; i < 52; i++) {
      const schedule = StorageService.getResolvedWeekSchedule(state.data, checkWeek, window.PLAN_DATA);
      let weekHasDone = false;

      schedule.forEach((sessId, dayIdx) => {
        const key = getSessionLogKey(checkWeek, dayIdx, sessId);
        if (state.data.logs[key] && state.data.logs[key].completed) {
          weekHasDone = true;
        }
      });

      if (weekHasDone) {
        streak++;
        checkWeek = shiftIsoWeek(checkWeek, -1);
      } else {
        break;
      }
    }
    return streak;
  }

  function renderConsistencyTracker() {
    const container = document.getElementById('consistency-tracker');
    if (!container) return;
    container.innerHTML = '';

    // Collect last 8 ISO weeks
    const weeksList = [];
    let cur = state.todayIsoWeek;
    for (let i = 0; i < 8; i++) {
      weeksList.push(cur);
      cur = shiftIsoWeek(cur, -1);
    }
    weeksList.reverse();

    weeksList.forEach(isoWeek => {
      const { weekNumber } = parseIsoWeek(isoWeek);
      const schedule = StorageService.getResolvedWeekSchedule(state.data, isoWeek, window.PLAN_DATA);
      let doneCount = 0;
      let targetCount = 0;

      const dotsHtml = schedule.map((sessionId, dayIdx) => {
        if (sessionId !== 'rest') targetCount++;
        const key = getSessionLogKey(isoWeek, dayIdx, sessionId);
        const isDone = state.data.logs[key] && state.data.logs[key].completed;
        if (isDone) doneCount++;

        return `<div class="consistency-dot ${isDone ? 'done' : ''}" title="${DAY_SHORT[dayIdx]}: ${sessionId} (${isDone ? 'Done' : 'Not done'})"></div>`;
      }).join('');

      container.innerHTML += `
        <div class="consistency-week-row">
          <span class="consistency-week-label">Week ${weekNumber}</span>
          <div class="consistency-bars">${dotsHtml}</div>
          <span class="consistency-score">${doneCount}/${targetCount}</span>
        </div>
      `;
    });
  }

  function renderStrengthChart() {
    const select = document.getElementById('progress-exercise-select');
    const chartContainer = document.getElementById('chart-container');
    if (!select || !chartContainer) return;

    // Collect list of all exercises with logged data
    const loggedExercisesMap = new Map();
    // Default foundational lifts
    loggedExercisesMap.set('back-squat', 'Barbell back squat');
    loggedExercisesMap.set('bench-press', 'Barbell or dumbbell bench press');
    loggedExercisesMap.set('romanian-deadlift-barbell', 'Romanian deadlift with barbell');
    loggedExercisesMap.set('conventional-deadlift', 'Conventional deadlift with barbell');
    loggedExercisesMap.set('bulgarian-split-squat', 'Bulgarian split squat with dumbbells');
    loggedExercisesMap.set('seated-cable-row', 'Seated cable row');
    loggedExercisesMap.set('lat-pulldown', 'Lat pulldown');
    loggedExercisesMap.set('dumbbell-shoulder-press', 'Dumbbell shoulder press');

    // Scan logs to add any others
    Object.values(state.data.logs || {}).forEach(log => {
      if (log.exercises) {
        Object.keys(log.exercises).forEach(exId => {
          if (!loggedExercisesMap.has(exId)) {
            loggedExercisesMap.set(exId, exId.replace(/-/g, ' '));
          }
        });
      }
    });

    // Populate dropdown
    select.innerHTML = Array.from(loggedExercisesMap.entries()).map(([id, name]) => {
      return `<option value="${id}" ${state.chartSelectedExerciseId === id ? 'selected' : ''}>${name}</option>`;
    }).join('');

    const activeExerciseId = state.chartSelectedExerciseId || select.value || 'back-squat';
    state.chartSelectedExerciseId = activeExerciseId;

    // Gather chronological points for this exercise
    const dataPoints = [];
    const logKeys = Object.keys(state.data.logs || {}).sort();

    logKeys.forEach(k => {
      const log = state.data.logs[k];
      if (log.exercises && log.exercises[activeExerciseId]) {
        const exLog = log.exercises[activeExerciseId];
        if (exLog.sets && exLog.sets.length > 0) {
          const completedSets = exLog.sets.filter(s => s && s.done && Number(s.weight) > 0 && Number(s.reps) > 0);
          if (completedSets.length > 0) {
            // Find top weight set
            let topWeight = 0;
            let topWeightReps = 0;
            let best1RM = 0;

            completedSets.forEach(s => {
              const w = Number(s.weight);
              const r = Number(s.reps);
              // Epley formula: 1RM = Weight * (1 + Reps / 30)
              const epley = Math.round(w * (1 + r / 30));
              if (w > topWeight) {
                topWeight = w;
                topWeightReps = r;
              }
              if (epley > best1RM) {
                best1RM = epley;
              }
            });

            // Extract date label from log or ISO week
            let dateLabel = k.split('_')[0];
            if (log.completedAt) {
              const d = new Date(log.completedAt);
              dateLabel = `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
            }

            dataPoints.push({
              key: k,
              dateLabel,
              weight: topWeight,
              reps: topWeightReps,
              epley1RM: best1RM,
              value: state.chartMetric === '1rm' ? best1RM : topWeight
            });
          }
        }
      }
    });

    if (dataPoints.length === 0) {
      chartContainer.innerHTML = `
        <div class="chart-empty-state">
          <span>📊</span>
          <strong>No workout logs found for this exercise yet.</strong>
          <span class="text-xs text-muted">Complete sets for this lift in your workouts to track your progressive strength curve!</span>
        </div>
      `;
      return;
    }

    // Render plain SVG line chart
    drawSvgChart(chartContainer, dataPoints);
  }

  function drawSvgChart(container, points) {
    const width = 500;
    const height = 220;
    const padding = { top: 25, right: 30, bottom: 40, left: 45 };

    const values = points.map(p => p.value);
    const minVal = Math.max(0, Math.floor(Math.min(...values) * 0.85));
    const maxVal = Math.ceil(Math.max(...values) * 1.15) || 100;

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const getX = (idx) => {
      if (points.length === 1) return padding.left + chartW / 2;
      return padding.left + (idx / (points.length - 1)) * chartW;
    };

    const getY = (val) => {
      const range = maxVal - minVal || 1;
      return padding.top + chartH - ((val - minVal) / range) * chartH;
    };

    // Build SVG path
    let pathD = '';
    let areaD = '';

    points.forEach((p, idx) => {
      const x = getX(idx);
      const y = getY(p.value);
      if (idx === 0) {
        pathD += `M ${x} ${y}`;
        areaD += `M ${x} ${padding.top + chartH} L ${x} ${y}`;
      } else {
        pathD += ` L ${x} ${y}`;
        areaD += ` L ${x} ${y}`;
      }
    });

    if (points.length > 1) {
      areaD += ` L ${getX(points.length - 1)} ${padding.top + chartH} Z`;
    }

    // Y Axis Grid lines
    const gridSteps = 4;
    let gridHtml = '';
    for (let i = 0; i <= gridSteps; i++) {
      const val = Math.round(minVal + (i / gridSteps) * (maxVal - minVal));
      const y = getY(val);
      gridHtml += `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="var(--border-subtle)" stroke-dasharray="3,3" />
        <text x="${padding.left - 8}" y="${y + 4}" fill="var(--text-muted)" font-size="11" text-anchor="end">${val}kg</text>
      `;
    }

    // Dots and labels
    let dotsHtml = '';
    points.forEach((p, idx) => {
      const x = getX(idx);
      const y = getY(p.value);
      dotsHtml += `
        <circle cx="${x}" cy="${y}" r="5" fill="var(--accent-primary)" stroke="var(--bg-app)" stroke-width="2" class="chart-point" data-idx="${idx}" />
        <text x="${x}" y="${padding.top + chartH + 20}" fill="var(--text-muted)" font-size="10" text-anchor="middle">${p.dateLabel}</text>
      `;
    });

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="chart-svg">
        <defs>
          <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="var(--accent-primary)" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="var(--accent-primary)" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        ${gridHtml}
        ${points.length > 1 ? `<path d="${areaD}" fill="url(#chartGrad)" />` : ''}
        <path d="${pathD}" fill="none" stroke="var(--accent-primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        ${dotsHtml}
      </svg>
    `;

    // Tooltip interaction
    const tooltip = document.getElementById('chart-tooltip');
    container.querySelectorAll('.chart-point').forEach(circle => {
      circle.addEventListener('click', (e) => {
        const idx = parseInt(circle.dataset.idx, 10);
        const p = points[idx];
        if (tooltip) {
          tooltip.innerHTML = `
            <strong>${p.dateLabel}</strong>
            <span>Top set: ${p.weight} kg × ${p.reps} reps</span>
            <span>Est. 1RM: ${p.epley1RM} kg</span>
          `;
          tooltip.classList.remove('hidden');
          const rect = container.getBoundingClientRect();
          tooltip.style.left = `${e.clientX - rect.left}px`;
          tooltip.style.top = `${e.clientY - rect.top - 50}px`;
        }
      });
    });
  }

  /* ==========================================================================
     Settings, Backup & Data Transfer Handlers
     ========================================================================== */

  function renderSettingsView() {
    const lastBackupEl = document.getElementById('settings-last-backup-date');
    if (lastBackupEl) {
      if (state.data.lastBackup) {
        const d = new Date(state.data.lastBackup);
        lastBackupEl.textContent = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      } else {
        lastBackupEl.textContent = 'Never';
      }
    }

    const selectTheme = document.getElementById('select-theme');
    if (selectTheme) {
      selectTheme.value = state.data.theme || 'auto';
    }
  }

  function checkBackupReminder() {
    const banner = document.getElementById('backup-reminder-banner');
    if (!banner) return;
    if (StorageService.shouldShowBackupReminder(state.data)) {
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  /* ==========================================================================
     Dialog & Modal Helpers
     ========================================================================== */

  function showConfirmDialog(title, message, onConfirm) {
    const modal = document.getElementById('modal-confirm');
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-message').textContent = message;

    const btnAction = document.getElementById('btn-confirm-action');
    const newBtn = btnAction.cloneNode(true);
    btnAction.parentNode.replaceChild(newBtn, btnAction);

    newBtn.addEventListener('click', () => {
      modal.close();
      onConfirm();
    });

    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
  }

  /* ==========================================================================
     App Initialization & Event Wiring
     ========================================================================== */

  function initApp() {
    // Load persisted state
    state.data = StorageService.load();

    // Determine current date & week
    const now = new Date();
    state.todayIsoWeek = getIsoWeekString(now);
    state.todayDayIndex = (now.getDay() + 6) % 7; // Monday = 0

    state.currentIsoWeek = state.todayIsoWeek;
    state.selectedDayIndex = state.todayDayIndex;

    // Apply stored theme
    applyTheme(state.data.theme || 'auto');

    // Register service worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
          console.log('[App] Service worker active with scope:', reg.scope);
        }).catch((err) => {
          console.warn('[App] SW registration error:', err);
        });
      });
    }

    // Storage persistence
    StorageService.requestPersist();

    // Wire Global UI Listeners
    wireNavigationListeners();
    wireHeaderListeners();
    wireSettingsListeners();
    wireRestTimerListeners();
    wireEditModalListeners();

    // Initial Render
    renderWeekNavigator();
    renderWeekStrip();
    renderActiveSession();
    checkBackupReminder();
  }

  function applyTheme(theme) {
    document.body.className = `theme-${theme}`;
  }

  function wireNavigationListeners() {
    const navPlanner = document.getElementById('nav-planner');
    const navProgress = document.getElementById('nav-progress');
    const navSettings = document.getElementById('nav-settings');

    const deskPlanner = document.getElementById('desk-nav-planner');
    const deskProgress = document.getElementById('desk-nav-progress');
    const deskSettings = document.getElementById('desk-nav-settings');

    function switchTab(tabId) {
      state.activeTab = tabId;
      document.querySelectorAll('.tab-view').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-view').forEach(t => t.setAttribute('hidden', ''));
      document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.remove('active');
        n.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.btn-header-tab').forEach(b => b.classList.remove('active'));

      const targetTab = document.getElementById(`tab-${tabId}`);
      if (targetTab) {
        targetTab.classList.add('active');
        targetTab.removeAttribute('hidden');
      }

      const activeBottomBtn = document.getElementById(`nav-${tabId}`);
      if (activeBottomBtn) {
        activeBottomBtn.classList.add('active');
        activeBottomBtn.setAttribute('aria-selected', 'true');
      }

      const activeDeskBtn = document.getElementById(`desk-nav-${tabId}`);
      if (activeDeskBtn) {
        activeDeskBtn.classList.add('active');
      }

      if (tabId === 'progress') {
        renderProgressView();
      } else if (tabId === 'settings') {
        renderSettingsView();
      } else if (tabId === 'planner') {
        renderActiveSession();
      }
    }

    [navPlanner, deskPlanner].forEach(btn => btn && btn.addEventListener('click', () => switchTab('planner')));
    [navProgress, deskProgress].forEach(btn => btn && btn.addEventListener('click', () => switchTab('progress')));
    [navSettings, deskSettings].forEach(btn => btn && btn.addEventListener('click', () => switchTab('settings')));

    // Today jump banner
    const btnJumpToday = document.getElementById('btn-jump-today');
    if (btnJumpToday) {
      btnJumpToday.addEventListener('click', () => {
        state.currentIsoWeek = state.todayIsoWeek;
        state.selectedDayIndex = state.todayDayIndex;
        renderWeekNavigator();
        renderWeekStrip();
        renderActiveSession();
      });
    }
  }

  function wireHeaderListeners() {
    // Prev / Next Week buttons
    document.getElementById('btn-prev-week').addEventListener('click', () => {
      state.currentIsoWeek = shiftIsoWeek(state.currentIsoWeek, -1);
      renderWeekNavigator();
      renderWeekStrip();
      renderActiveSession();
    });

    document.getElementById('btn-next-week').addEventListener('click', () => {
      state.currentIsoWeek = shiftIsoWeek(state.currentIsoWeek, 1);
      renderWeekNavigator();
      renderWeekStrip();
      renderActiveSession();
    });

    document.getElementById('btn-current-week-label').addEventListener('click', () => {
      state.currentIsoWeek = state.todayIsoWeek;
      state.selectedDayIndex = state.todayDayIndex;
      renderWeekNavigator();
      renderWeekStrip();
      renderActiveSession();
    });

    // 3-Day Plan vs 2-Day Fallback Switcher
    document.getElementById('plan-btn-3day').addEventListener('click', () => {
      StorageService.setWeekPlanType(state.data, state.currentIsoWeek, '3-day-plan');
      renderWeekNavigator();
      renderWeekStrip();
      renderActiveSession();
    });

    document.getElementById('plan-btn-2day').addEventListener('click', () => {
      StorageService.setWeekPlanType(state.data, state.currentIsoWeek, '2-day-fallback');
      renderWeekNavigator();
      renderWeekStrip();
      renderActiveSession();
    });

    // Rules Info Dialog
    const rulesModal = document.getElementById('modal-rules-info');
    document.getElementById('btn-rules-info').addEventListener('click', () => {
      rulesModal.showModal();
    });
    document.getElementById('btn-close-rules-modal').addEventListener('click', () => {
      rulesModal.close();
    });
    document.getElementById('btn-dismiss-rules').addEventListener('click', () => {
      rulesModal.close();
    });

    // Backup banner buttons
    document.getElementById('banner-btn-export').addEventListener('click', async () => {
      await StorageService.exportData(state.data);
      checkBackupReminder();
    });
    document.getElementById('banner-btn-dismiss').addEventListener('click', () => {
      document.getElementById('backup-reminder-banner').classList.add('hidden');
    });
  }

  function wireSettingsListeners() {
    // Export Data
    document.getElementById('btn-export-data').addEventListener('click', async () => {
      try {
        await StorageService.exportData(state.data);
        renderSettingsView();
        checkBackupReminder();
      } catch (err) {
        alert(err.message);
      }
    });

    // Import Data
    const importInput = document.getElementById('file-import-input');
    importInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (readEvent) => {
        const jsonStr = readEvent.target.result;
        // Prompt Merge vs Replace dialog
        const importModal = document.getElementById('modal-import-mode');
        importModal.showModal();

        const btnMerge = document.getElementById('btn-import-merge');
        const btnReplace = document.getElementById('btn-import-replace');

        const handleImport = (mode) => {
          try {
            state.data = StorageService.importData(state.data, jsonStr, mode);
            importModal.close();
            importInput.value = '';
            alert(`Backup successfully ${mode === 'merge' ? 'merged' : 'imported'}!`);
            renderSettingsView();
            renderWeekStrip();
            renderActiveSession();
          } catch (err) {
            alert(`Import failed: ${err.message}`);
          }
        };

        btnMerge.onclick = () => handleImport('merge');
        btnReplace.onclick = () => handleImport('replace');
        document.getElementById('btn-import-cancel').onclick = () => importModal.close();
      };
      reader.readAsText(file);
    });

    // Theme selector
    document.getElementById('select-theme').addEventListener('change', (e) => {
      state.data.theme = e.target.value;
      applyTheme(state.data.theme);
      saveCurrentState();
    });

    // Open full rules sheet from settings
    document.getElementById('btn-open-rules-full').addEventListener('click', () => {
      document.getElementById('modal-rules-info').showModal();
    });

    // Danger Reset Data with Double Confirmation
    document.getElementById('btn-danger-reset').addEventListener('click', () => {
      showConfirmDialog(
        'Delete All Workout Data?',
        'Warning: This action is irreversible. All your logged sets, custom exercise modifications, and schedule overrides will be permanently erased.',
        () => {
          showConfirmDialog(
            'Final Confirmation',
            'Are you 100% sure you want to reset everything back to fresh factory state?',
            () => {
              state.data = StorageService.resetAll();
              renderSettingsView();
              renderWeekStrip();
              renderActiveSession();
              alert('All data has been reset.');
            }
          );
        }
      );
    });

    // Chart controls
    const metric1rmBtn = document.getElementById('chart-metric-1rm');
    const metricWeightBtn = document.getElementById('chart-metric-weight');
    const selectEx = document.getElementById('progress-exercise-select');

    if (metric1rmBtn && metricWeightBtn) {
      metric1rmBtn.addEventListener('click', () => {
        state.chartMetric = '1rm';
        metric1rmBtn.classList.add('active');
        metricWeightBtn.classList.remove('active');
        renderStrengthChart();
      });

      metricWeightBtn.addEventListener('click', () => {
        state.chartMetric = 'weight';
        metricWeightBtn.classList.add('active');
        metric1rmBtn.classList.remove('active');
        renderStrengthChart();
      });
    }

    if (selectEx) {
      selectEx.addEventListener('change', (e) => {
        state.chartSelectedExerciseId = e.target.value;
        renderStrengthChart();
      });
    }
  }

  function wireRestTimerListeners() {
    document.getElementById('timer-btn-minus').addEventListener('click', () => adjustRestTimer(-15));
    document.getElementById('timer-btn-plus').addEventListener('click', () => adjustRestTimer(15));
    document.getElementById('timer-btn-toggle').addEventListener('click', pauseResumeRestTimer);
    document.getElementById('timer-btn-skip').addEventListener('click', stopRestTimer);
  }

  function wireEditModalListeners() {
    const editModal = document.getElementById('modal-edit-exercise');
    document.getElementById('btn-close-edit-modal').addEventListener('click', () => editModal.close());

    // Save customized exercise
    document.getElementById('form-edit-exercise').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!state.activeEditingExercise) return;
      const { sessionId, exercise } = state.activeEditingExercise;
      const overrides = getOrCreateSessionOverrides(sessionId);

      const sets = parseInt(document.getElementById('edit-target-sets').value, 10);
      const repRange = document.getElementById('edit-rep-range').value;
      const restSeconds = parseInt(document.getElementById('edit-rest-seconds').value, 10);
      const tip = document.getElementById('edit-personal-tip').value;
      const repSelect = document.getElementById('edit-select-replacement');
      const customName = document.getElementById('edit-custom-replace-name').value.trim();

      // Check replacement
      if (customName) {
        const slug = 'custom-' + customName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        overrides.replaced[exercise.id] = { id: slug, name: customName };
      } else if (repSelect.value) {
        const selectedOpt = repSelect.options[repSelect.selectedIndex];
        overrides.replaced[exercise.id] = { id: repSelect.value, name: selectedOpt.dataset.name };
      }

      // Save edited values
      if (!overrides.edited) overrides.edited = {};
      overrides.edited[exercise.id] = {
        targetSets: sets,
        repRange,
        restSeconds,
        restDisplay: restSeconds < 60 ? `${restSeconds}s` : `${Math.floor(restSeconds / 60)}m ${restSeconds % 60 ? (restSeconds % 60 + 's') : ''}`,
        tip
      };

      saveCurrentState();
      editModal.close();
      renderActiveSession();
    });

    // Hide exercise button
    document.getElementById('btn-hide-exercise').addEventListener('click', () => {
      if (!state.activeEditingExercise) return;
      const { sessionId, exercise } = state.activeEditingExercise;
      const overrides = getOrCreateSessionOverrides(sessionId);
      if (!overrides.hidden) overrides.hidden = [];
      if (!overrides.hidden.includes(exercise.id)) {
        overrides.hidden.push(exercise.id);
      }
      saveCurrentState();
      editModal.close();
      renderActiveSession();
    });

    // Reset this exercise to default
    document.getElementById('btn-reset-exercise').addEventListener('click', () => {
      if (!state.activeEditingExercise) return;
      const { sessionId, exercise } = state.activeEditingExercise;
      const overrides = getOrCreateSessionOverrides(sessionId);

      if (overrides.edited) delete overrides.edited[exercise.id];
      if (overrides.replaced) delete overrides.replaced[exercise.id];
      overrides.hidden = (overrides.hidden || []).filter(h => h !== exercise.id);

      saveCurrentState();
      editModal.close();
      renderActiveSession();
    });

    // Add exercise modal
    const addModal = document.getElementById('modal-add-exercise');
    document.getElementById('btn-close-add-modal').addEventListener('click', () => addModal.close());

    // Search input
    document.getElementById('search-exercise-pool').addEventListener('input', (e) => {
      if (!state.activeEditingExercise) return;
      renderExercisePoolSearch(e.target.value, state.activeEditingExercise.sessionId);
    });

    // Custom exercise create form
    document.getElementById('form-add-custom-exercise').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!state.activeEditingExercise) return;
      const sessionId = state.activeEditingExercise.sessionId;
      const name = document.getElementById('custom-ex-name').value.trim();
      const sets = parseInt(document.getElementById('custom-ex-sets').value, 10) || 3;
      const reps = document.getElementById('custom-ex-reps').value || '8–12';
      const rest = parseInt(document.getElementById('custom-ex-rest').value, 10) || 90;

      if (!name) return;
      const slug = 'custom-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const newEx = {
        id: slug,
        name,
        targetSets: sets,
        repRange: reps,
        repMin: 8,
        repMax: 12,
        restSeconds: rest,
        restDisplay: `${rest} s`,
        tip: 'Custom exercise added by user',
        alternatives: []
      };

      const overrides = getOrCreateSessionOverrides(sessionId);
      if (!overrides.added) overrides.added = [];
      overrides.added.push(newEx);

      saveCurrentState();
      addModal.close();
      renderActiveSession();
    });

    // Reschedule modal cancel & close
    const reschedModal = document.getElementById('modal-reschedule');
    document.getElementById('btn-close-reschedule').addEventListener('click', () => reschedModal.close());
    document.getElementById('btn-cancel-reschedule').addEventListener('click', () => reschedModal.close());

    // Generic confirm modal cancel
    document.getElementById('btn-confirm-cancel').addEventListener('click', () => {
      document.getElementById('modal-confirm').close();
    });
  }

  // Run app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
