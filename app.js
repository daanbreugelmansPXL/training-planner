/**
 * Training Planner PWA - Main Application Controller (v2)
 * Quiet, fast, local-first workout tracker.
 * Zero external dependencies.
 */

(function () {
  'use strict';

  // Day Name Constants
  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Application State
  const state = {
    data: null,             // Full data object from StorageService
    currentIsoWeek: '',     // e.g. "2026-W43"
    selectedDayIndex: 0,    // 0 = Mon ... 6 = Sun
    todayIsoWeek: '',
    todayDayIndex: 0,
    activeTab: 'plan',      // 'plan' | 'templates' | 'progress'
    activeTemplateId: null, // For template editor
    inSessionEditMode: false,
    sessionOverridesToday: {}, // Temporary "Just today" overrides: { [exerciseId]: {...} }
    timer: {
      active: false,
      paused: false,
      targetEndTime: 0,
      remainingSeconds: 0,
      intervalId: null
    },
    audioCtx: null,
    toastTimerId: null,
    undoCallback: null,
    expandedProgressExerciseId: null
  };

  /* ==========================================================================
     Calendar & Date Helpers
     ========================================================================== */

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

  function parseIsoWeek(isoStr) {
    const parts = isoStr.split('-W');
    return {
      year: parseInt(parts[0], 10),
      weekNumber: parseInt(parts[1], 10)
    };
  }

  function getWeekDates(isoStr) {
    const { year, weekNumber } = parseIsoWeek(isoStr);
    const simple = new Date(Date.UTC(year, 0, 4));
    const day = (simple.getUTCDay() + 6) % 7;
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

  function shiftIsoWeek(isoStr, offset) {
    const dates = getWeekDates(isoStr);
    const midWeek = new Date(dates[3].valueOf());
    midWeek.setDate(midWeek.getDate() + offset * 7);
    return getIsoWeekString(midWeek);
  }

  /* ==========================================================================
     Audio & Haptics Feedback
     ========================================================================== */

  function unlockAudioContext() {
    if (!state.audioCtx) {
      try {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (AudioClass) state.audioCtx = new AudioClass();
      } catch (e) {
        // Ignored
      }
    }
    if (state.audioCtx && state.audioCtx.state === 'suspended') {
      state.audioCtx.resume();
    }
  }

  function playRestTimerChime() {
    try {
      unlockAudioContext();
      if (!state.audioCtx) return;

      const now = state.audioCtx.currentTime;
      const osc = state.audioCtx.createOscillator();
      const gain = state.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1320, now + 0.16);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(state.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }

  function triggerVibrate() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([180, 80, 180]);
      } catch (e) {}
    }
  }

  /* ==========================================================================
     Toast & Undo Notifications
     ========================================================================== */

  function showToast(message, undoCallback, durationMs = 5000) {
    const toast = document.getElementById('toast-bar');
    const msgEl = document.getElementById('toast-message');
    const undoBtn = document.getElementById('btn-toast-undo');
    if (!toast || !msgEl) return;

    clearTimeout(state.toastTimerId);
    state.undoCallback = undoCallback || null;

    msgEl.textContent = message;
    if (undoCallback) {
      undoBtn.style.display = 'inline-block';
    } else {
      undoBtn.style.display = 'none';
    }

    toast.classList.add('visible');

    state.toastTimerId = setTimeout(() => {
      hideToast();
    }, durationMs);
  }

  function hideToast() {
    const toast = document.getElementById('toast-bar');
    if (toast) toast.classList.remove('visible');
    state.undoCallback = null;
  }

  /* ==========================================================================
     Rest Timer Controller (Timestamp Based - Survives Lock/Background)
     ========================================================================== */

  function startRestTimer(seconds) {
    unlockAudioContext();
    const dur = Math.max(10, parseInt(seconds, 10) || 90);

    clearInterval(state.timer.intervalId);
    state.timer.active = true;
    state.timer.paused = false;
    state.timer.remainingSeconds = dur;
    state.timer.targetEndTime = Date.now() + dur * 1000;

    const timerEl = document.getElementById('docked-rest-timer');
    if (timerEl) timerEl.classList.add('active');

    updateTimerDisplay();

    state.timer.intervalId = setInterval(() => {
      if (state.timer.paused) return;

      const diff = Math.max(0, Math.round((state.timer.targetEndTime - Date.now()) / 1000));
      state.timer.remainingSeconds = diff;
      updateTimerDisplay();

      if (diff <= 0) {
        stopRestTimer();
        playRestTimerChime();
        triggerVibrate();
      }
    }, 250);
  }

  function stopRestTimer() {
    clearInterval(state.timer.intervalId);
    state.timer.active = false;
    state.timer.paused = false;
    const timerEl = document.getElementById('docked-rest-timer');
    if (timerEl) timerEl.classList.remove('active');
  }

  function togglePauseRestTimer() {
    if (!state.timer.active) return;
    const toggleBtn = document.getElementById('btn-timer-toggle');

    if (state.timer.paused) {
      // Resume
      state.timer.paused = false;
      state.timer.targetEndTime = Date.now() + state.timer.remainingSeconds * 1000;
      if (toggleBtn) toggleBtn.textContent = 'Pause';
    } else {
      // Pause
      state.timer.paused = true;
      if (toggleBtn) toggleBtn.textContent = 'Resume';
    }
  }

  function adjustRestTimer(deltaSec) {
    if (!state.timer.active) return;
    if (state.timer.paused) {
      state.timer.remainingSeconds = Math.max(5, state.timer.remainingSeconds + deltaSec);
    } else {
      state.timer.targetEndTime += deltaSec * 1000;
      state.timer.remainingSeconds = Math.max(0, Math.round((state.timer.targetEndTime - Date.now()) / 1000));
    }
    updateTimerDisplay();
  }

  function updateTimerDisplay() {
    const digits = document.getElementById('timer-digits');
    if (!digits) return;
    const s = state.timer.remainingSeconds;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    digits.textContent = `${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  }

  /* ==========================================================================
     Schedule & Session Resolution
     ========================================================================== */

  function getWeekSchedule(isoWeek) {
    const weekEntry = state.data.weeks[isoWeek] || {};
    const variant = weekEntry.planVariant || '3-day';

    // Base schedule from PLAN_DATA
    const basePlan = window.PLAN_DATA?.weeklyPlans?.[variant === '2-day' ? '2-day-fallback' : '3-day-plan'];
    const schedule = basePlan ? [...basePlan.schedule] : [
      'muay-thai-1', 'strength-a', 'muay-thai-2', 'strength-b', 'rest', 'strength-c', 'aerobic-base-mobility'
    ];

    // Apply rescheduled moves
    if (weekEntry.moves) {
      const dayMap = {};
      schedule.forEach((sessId, idx) => { dayMap[idx] = sessId; });

      Object.keys(weekEntry.moves).forEach(sessId => {
        const targetDay = weekEntry.moves[sessId];
        if (targetDay >= 0 && targetDay < 7) {
          dayMap[targetDay] = sessId;
        }
      });

      for (let i = 0; i < 7; i++) {
        schedule[i] = dayMap[i] || 'rest';
      }
    }

    return schedule;
  }

  function getSessionLogKey(isoWeek, dayIndex, sessionId) {
    return `${isoWeek}_${dayIndex}_${sessionId}`;
  }

  function getOrCreateLog(isoWeek, dayIndex, sessionId) {
    const key = getSessionLogKey(isoWeek, dayIndex, sessionId);
    if (!state.data.logs[key]) {
      const template = state.data.templates[sessionId] || { main: [], warmup: [], cooldown: [] };
      state.data.logs[key] = {
        id: key,
        isoWeek,
        dayIndex,
        sessionId,
        completed: false,
        completedAt: null,
        templateSnapshot: JSON.parse(JSON.stringify(template)),
        exercises: [],
        sessionNote: '',
        rpe: null,
        feeling: null,
        sleepHours: null,
        duration: null,
        distance: null,
        avgHr: null,
        variant: null,
        warmupDone: [],
        cooldownDone: [],
        miniMobilityDone: []
      };
    }
    return state.data.logs[key];
  }

  /* ==========================================================================
     Day Strip Rendering & Safe Scrolling (Strictly scroll only itself)
     ========================================================================== */

  function renderDayStrip() {
    const strip = document.getElementById('day-strip-container');
    if (!strip) return;
    strip.innerHTML = '';

    const weekDates = getWeekDates(state.currentIsoWeek);
    const schedule = getWeekSchedule(state.currentIsoWeek);
    const { weekNumber } = parseIsoWeek(state.currentIsoWeek);

    // Update week label
    const labelWeek = document.getElementById('label-week-current');
    if (labelWeek) labelWeek.textContent = `Week ${weekNumber}`;

    // Update 3-Day vs 2-Day toggle buttons
    const weekEntry = state.data.weeks[state.currentIsoWeek] || {};
    const variant = weekEntry.planVariant || '3-day';
    const btn3Day = document.getElementById('btn-variant-3day');
    const btn2Day = document.getElementById('btn-variant-2day');
    if (btn3Day && btn2Day) {
      btn3Day.classList.toggle('active', variant === '3-day');
      btn3Day.setAttribute('aria-checked', variant === '3-day' ? 'true' : 'false');
      btn2Day.classList.toggle('active', variant === '2-day');
      btn2Day.setAttribute('aria-checked', variant === '2-day' ? 'true' : 'false');
    }

    weekDates.forEach((date, dayIdx) => {
      const sessId = schedule[dayIdx];
      const isSelected = (dayIdx === state.selectedDayIndex);
      const isToday = (state.currentIsoWeek === state.todayIsoWeek && dayIdx === state.todayDayIndex);

      const logKey = getSessionLogKey(state.currentIsoWeek, dayIdx, sessId);
      const log = state.data.logs[logKey];
      const isDone = log && log.completed;
      const isPartial = log && !log.completed && hasLogActivity(log);

      const pill = document.createElement('div');
      pill.className = `day-pill ${isSelected ? 'active' : ''} ${isToday ? 'is-today' : ''}`;
      pill.setAttribute('role', 'tab');
      pill.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      pill.dataset.dayIndex = dayIdx;

      pill.innerHTML = `
        <span class="day-pill-name">${DAY_SHORT[dayIdx]}</span>
        <span class="day-pill-num">${date.getDate()}</span>
        <div class="day-pill-dot ${isDone ? 'done' : (isPartial ? 'partial' : '')}"></div>
      `;

      pill.addEventListener('click', () => {
        unlockAudioContext();
        selectDay(dayIdx);
      });

      strip.appendChild(pill);
    });

    // Scroll ONLY the day strip horizontally to keep selected pill visible
    scrollDayStripToSelected(false);
  }

  function scrollDayStripToSelected(smooth = true) {
    const strip = document.getElementById('day-strip-container');
    if (!strip) return;
    const activePill = strip.querySelector(`.day-pill[data-day-index="${state.selectedDayIndex}"]`);
    if (!activePill) return;

    // Calculate scroll offset inside the strip container ONLY
    const pillLeft = activePill.offsetLeft;
    const pillWidth = activePill.offsetWidth;
    const stripWidth = strip.clientWidth;
    const targetScrollLeft = pillLeft - (stripWidth / 2) + (pillWidth / 2);

    strip.scrollTo({
      left: Math.max(0, targetScrollLeft),
      behavior: smooth ? 'smooth' : 'auto'
    });
  }

  function hasLogActivity(log) {
    if (!log) return false;
    if (log.sessionNote && log.sessionNote.trim()) return true;
    if (log.feeling || log.sleepHours) return true;
    if (log.warmupDone && log.warmupDone.some(Boolean)) return true;
    if (log.cooldownDone && log.cooldownDone.some(Boolean)) return true;
    if (log.exercises && log.exercises.some(ex => ex.sets && ex.sets.some(s => s.done))) return true;
    return false;
  }

  function selectDay(dayIdx) {
    state.selectedDayIndex = dayIdx;
    state.sessionOverridesToday = {}; // Reset one-off session overrides
    renderDayStrip();
    renderSessionView();
  }

  /* ==========================================================================
     Session View Rendering (Strict Copy Diet, 3-Tap Logging)
     ========================================================================== */

  function renderSessionView() {
    const container = document.getElementById('session-container');
    if (!container) return;

    const schedule = getWeekSchedule(state.currentIsoWeek);
    const sessionId = schedule[state.selectedDayIndex];
    const log = getOrCreateLog(state.currentIsoWeek, state.selectedDayIndex, sessionId);

    // Check if session has started
    const hasStarted = (log.exercises && log.exercises.length > 0) || log.completed;

    // Get session model: from snapshot if started, otherwise live template
    let template = null;
    if (hasStarted && log.templateSnapshot) {
      template = log.templateSnapshot;
    } else {
      template = state.data.templates[sessionId] || {
        id: sessionId,
        name: sessionId,
        durationDisplay: '60 min',
        main: [],
        warmup: [],
        cooldown: []
      };
    }

    // Apply any in-session "Just today" overrides
    const effectiveMain = (template.main || []).filter(item => {
      const ov = state.sessionOverridesToday[item.exerciseId];
      return !(ov && ov.removed);
    }).map(item => {
      const ov = state.sessionOverridesToday[item.exerciseId];
      if (!ov) return item;
      return { ...item, ...ov };
    });

    // Populate log exercises list if empty
    if (!log.exercises || log.exercises.length === 0) {
      log.exercises = effectiveMain.map(item => {
        const lib = state.data.library[item.exerciseId] || {};
        const lastKg = lib.lastWeightKg || null;
        const setsCount = item.sets || 3;
        const sets = [];
        for (let i = 0; i < setsCount; i++) {
          sets.push({ kg: lastKg, reps: item.repMax || 10, done: false });
        }
        return {
          exerciseId: item.exerciseId,
          name: item.name || lib.name || item.exerciseId,
          weightKg: lastKg,
          sets,
          note: ''
        };
      });
    }

    // Header HTML
    const title = template.shortTitle || template.name || sessionId;
    const duration = template.durationDisplay || (template.durationMin ? `${template.durationMin} min` : '');
    const goal = template.goal || '';
    const when = template.when || '';

    container.innerHTML = `
      <div class="session-header">
        <div class="session-headline-row">
          <h1 class="session-title">${title}</h1>
          <span class="session-duration">${duration}</span>
        </div>

        <div class="session-actions-row">
          <div class="session-action-group">
            ${goal || when ? `
              <span id="btn-toggle-info" class="info-row-toggle">
                <span>Info</span>
                <span class="chevron-sm">▾</span>
              </span>
            ` : ''}
          </div>

          <div class="session-action-group">
            ${sessionId !== 'muay-thai-1' && sessionId !== 'muay-thai-2' ? `
              <button id="btn-session-move" class="btn-action-text">Move</button>
            ` : ''}
            ${template.kind === 'strength' ? `
              <button id="btn-session-edit" class="btn-action-text ${state.inSessionEditMode ? 'active' : ''}">Edit</button>
            ` : ''}
          </div>
        </div>

        ${goal || when ? `
          <div id="session-info-content" class="info-row-content">
            ${goal ? `<p><strong>Goal:</strong> ${goal}</p>` : ''}
            ${when ? `<p style="margin-top: 4px;"><strong>Timing:</strong> ${when}</p>` : ''}
          </div>
        ` : ''}
      </div>

      <div id="session-body"></div>
    `;

    // Wire Header Info Toggle
    const btnInfo = document.getElementById('btn-toggle-info');
    const infoContent = document.getElementById('session-info-content');
    if (btnInfo && infoContent) {
      btnInfo.addEventListener('click', () => {
        infoContent.classList.toggle('open');
      });
    }

    // Wire Move Button
    const btnMove = document.getElementById('btn-session-move');
    if (btnMove) {
      btnMove.addEventListener('click', () => {
        openRescheduleSheet(sessionId);
      });
    }

    // Wire In-Session Edit Button
    const btnEdit = document.getElementById('btn-session-edit');
    if (btnEdit) {
      btnEdit.addEventListener('click', () => {
        state.inSessionEditMode = !state.inSessionEditMode;
        btnEdit.classList.toggle('active', state.inSessionEditMode);
        renderSessionView();
      });
    }

    // Render Body according to kind
    const bodyEl = document.getElementById('session-body');
    if (template.kind === 'muay-thai') {
      renderMuayThaiSession(bodyEl, sessionId, log);
    } else if (template.kind === 'cardio-mobility') {
      renderCardioSession(bodyEl, template, log);
    } else if (template.kind === 'rest') {
      renderRestSession(bodyEl, log);
    } else {
      renderStrengthSession(bodyEl, template, log, effectiveMain);
    }
  }

  /* ==========================================================================
     Muay Thai Session View
     ========================================================================== */

  function renderMuayThaiSession(container, sessionId, log) {
    const isDone = log.completed;
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: var(--space-4);">
        <p style="font-size: 14px; color: var(--text-muted);">
          Club technical session (Mon/Wed 20:00–21:30). High intensity sparring and clinch work.
        </p>

        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Effort (RPE 1–10)</span>
          <div style="display: flex; gap: 4px;">
            ${[6, 7, 8, 9, 10].map(r => `
              <button class="btn-action-text btn-rpe-select ${log.rpe === r ? 'active' : ''}" data-rpe="${r}">${r}</button>
            `).join('')}
          </div>
        </div>

        <button id="btn-toggle-mt-done" class="btn-primary-block" style="${isDone ? 'background: var(--line-hairline); color: var(--text);' : ''}">
          ${isDone ? 'Completed ✓' : 'Mark Done'}
        </button>

        <div style="margin-top: var(--space-2);">
          <input type="text" id="input-session-note" class="input-exercise-note" placeholder="Session note..." value="${log.sessionNote || ''}">
        </div>
      </div>
    `;

    container.querySelectorAll('.btn-rpe-select').forEach(btn => {
      btn.addEventListener('click', () => {
        unlockAudioContext();
        log.rpe = parseInt(btn.dataset.rpe, 10);
        saveState();
        renderSessionView();
      });
    });

    const doneBtn = document.getElementById('btn-toggle-mt-done');
    doneBtn.addEventListener('click', () => {
      unlockAudioContext();
      log.completed = !log.completed;
      log.completedAt = log.completed ? new Date().toISOString() : null;
      saveState();
      renderDayStrip();
      renderSessionView();
    });

    const noteInp = document.getElementById('input-session-note');
    if (noteInp) {
      noteInp.addEventListener('input', () => {
        log.sessionNote = noteInp.value;
        saveState();
      });
    }
  }

  /* ==========================================================================
     Cardio & Mobility Session View
     ========================================================================== */

  function renderCardioSession(container, template, log) {
    const isDone = log.completed;
    const variant = log.variant || template.cardio?.variant || 'run-7km';

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: var(--space-4);">
        <div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
          ${[
            { id: 'run-7km', label: 'Run 7.5km' },
            { id: 'cross-trainer', label: 'Cross trainer' },
            { id: 'home-trainer', label: 'Home trainer' },
            { id: 'bag-intervals', label: 'Bag intervals' }
          ].map(v => `
            <button class="btn-action-text btn-cardio-var ${variant === v.id ? 'active' : ''}" data-variant="${v.id}">${v.label}</button>
          `).join('')}
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-2);">
          <div>
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Duration (min)</span>
            <input type="number" id="cardio-duration" class="set-reps-input" value="${log.duration || 40}">
          </div>
          <div>
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Distance (km)</span>
            <input type="text" id="cardio-distance" class="set-reps-input" value="${log.distance || ''}">
          </div>
          <div>
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Avg HR</span>
            <input type="number" id="cardio-hr" class="set-reps-input" value="${log.avgHr || ''}">
          </div>
        </div>

        <!-- Mobility Checklist -->
        <div class="collapsible-row open" style="margin-top: var(--space-2);">
          <div class="collapsible-row-header">
            <span>Mobility Routine (15–20 min)</span>
            <svg class="chevron-icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
          <div class="collapsible-row-body">
            ${(template.main || []).map((m, idx) => {
              const checked = log.miniMobilityDone && log.miniMobilityDone[idx];
              return `
                <div class="check-item ${checked ? 'done' : ''}" data-mobility-idx="${idx}">
                  <div class="check-square">
                    ${checked ? '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                  </div>
                  <span>${m.name}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <button id="btn-toggle-cardio-done" class="btn-primary-block" style="${isDone ? 'background: var(--line-hairline); color: var(--text);' : ''}">
          ${isDone ? 'Completed ✓' : 'Mark Done'}
        </button>

        <input type="text" id="input-session-note" class="input-exercise-note" placeholder="Session note..." value="${log.sessionNote || ''}">
      </div>
    `;

    container.querySelectorAll('.btn-cardio-var').forEach(btn => {
      btn.addEventListener('click', () => {
        unlockAudioContext();
        log.variant = btn.dataset.variant;
        saveState();
        renderSessionView();
      });
    });

    ['cardio-duration', 'cardio-distance', 'cardio-hr'].forEach(id => {
      const inp = document.getElementById(id);
      if (inp) {
        inp.addEventListener('input', () => {
          log.duration = document.getElementById('cardio-duration').value;
          log.distance = document.getElementById('cardio-distance').value;
          log.avgHr = document.getElementById('cardio-hr').value;
          saveState();
        });
      }
    });

    container.querySelectorAll('[data-mobility-idx]').forEach(item => {
      item.addEventListener('click', () => {
        unlockAudioContext();
        const idx = parseInt(item.dataset.mobilityIdx, 10);
        if (!log.miniMobilityDone) log.miniMobilityDone = [];
        log.miniMobilityDone[idx] = !log.miniMobilityDone[idx];
        saveState();
        renderSessionView();
      });
    });

    const doneBtn = document.getElementById('btn-toggle-cardio-done');
    doneBtn.addEventListener('click', () => {
      unlockAudioContext();
      log.completed = !log.completed;
      log.completedAt = log.completed ? new Date().toISOString() : null;
      saveState();
      renderDayStrip();
      renderSessionView();
    });

    const noteInp = document.getElementById('input-session-note');
    if (noteInp) {
      noteInp.addEventListener('input', () => {
        log.sessionNote = noteInp.value;
        saveState();
      });
    }
  }

  /* ==========================================================================
     Rest Day View
     ========================================================================== */

  function renderRestSession(container, log) {
    const isDone = log.completed;
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: var(--space-4);">
        <p style="font-size: 14px; color: var(--text-muted);">
          Rest and recovery. Hydrate, prioritize 8+ hours sleep, and take an easy walk.
        </p>

        <button id="btn-toggle-rest-done" class="btn-action-text" style="width: 100%; min-height: 44px; font-weight: 700;">
          ${isDone ? 'Rest Day Acknowledged ✓' : 'Mark Done'}
        </button>

        <input type="text" id="input-session-note" class="input-exercise-note" placeholder="Daily note..." value="${log.sessionNote || ''}">
      </div>
    `;

    const doneBtn = document.getElementById('btn-toggle-rest-done');
    doneBtn.addEventListener('click', () => {
      unlockAudioContext();
      log.completed = !log.completed;
      log.completedAt = log.completed ? new Date().toISOString() : null;
      saveState();
      renderDayStrip();
      renderSessionView();
    });

    const noteInp = document.getElementById('input-session-note');
    if (noteInp) {
      noteInp.addEventListener('input', () => {
        log.sessionNote = noteInp.value;
        saveState();
      });
    }
  }

  /* ==========================================================================
     Strength Workout Session View (3-Tap Logging, Single Weight Entry)
     ========================================================================== */

  function renderStrengthSession(container, template, log, effectiveMain) {
    // 1. Warmup collapsed row
    const warmupItems = template.warmup || [];
    const warmupHtml = warmupItems.length > 0 ? `
      <div class="collapsible-row" id="row-warmup">
        <div class="collapsible-row-header" role="button" tabindex="0">
          <span>Warm-up · ${Math.max(5, warmupItems.length)} min</span>
          <svg class="chevron-icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="collapsible-row-body">
          ${warmupItems.map((item, idx) => {
            const checked = log.warmupDone && log.warmupDone[idx];
            return `
              <div class="check-item ${checked ? 'done' : ''}" data-warmup-idx="${idx}">
                <div class="check-square">
                  ${checked ? '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                </div>
                <span>${item.name}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : '';

    // 2. Exercises list
    const exercisesHtml = effectiveMain.map((item, exIdx) => {
      const exId = item.exerciseId;
      const lib = state.data.library[exId] || {};
      const exLog = log.exercises.find(e => e.exerciseId === exId) || {
        exerciseId: exId,
        weightKg: lib.lastWeightKg || null,
        sets: [],
        note: ''
      };

      // Weight value
      const weightVal = exLog.weightKg !== null && exLog.weightKg !== undefined ? exLog.weightKg : (lib.lastWeightKg || '');
      const sets = exLog.sets || [];

      // Check if eligible for +2.5 hint:
      // If previous session reached top of rep range on all sets
      const canBump = checkEligibleForWeightBump(exId, item.repMax);

      // Alternatives
      const alts = (lib.alternatives || []).map(altId => state.data.library[altId]).filter(Boolean);

      // Pinned note
      const pinnedNote = lib.pinnedNote || '';

      return `
        <div class="exercise-block" data-exercise-id="${exId}">
          <!-- Header line -->
          <div class="exercise-header-line">
            <div class="exercise-title-group">
              <span class="exercise-name">${item.name || lib.name || exId}</span>
              <button class="btn-info-pop" data-drawer-toggle="${exId}" title="Coaching cue & alternatives">i</button>
            </div>
            <span class="exercise-target">${item.sets || 3} × ${item.repRange || '8–12'} · ${formatRestTime(item.restSec || 90)}</span>
          </div>

          <!-- Pinned Note (if exists) -->
          ${pinnedNote ? `
            <div class="pinned-note-banner">
              <span>📌 ${pinnedNote}</span>
              <button class="btn-dismiss-note" data-dismiss-note="${exId}">×</button>
            </div>
          ` : ''}

          <!-- Drawer (Tip + Alternatives) -->
          <div class="exercise-drawer" id="drawer-${exId}">
            ${lib.tip ? `<p class="exercise-tip-text">"${lib.tip}"</p>` : ''}
            ${alts.length > 0 ? `
              <div class="alternatives-row">
                <span style="font-size: 11px; text-transform: uppercase; color: var(--text-dim);">Alts:</span>
                ${alts.map(alt => `
                  <button class="btn-swap-alt" data-swap-to="${alt.id}">${alt.name}</button>
                `).join('')}
              </div>
            ` : ''}
          </div>

          <!-- Weight Bar (One input fills all sets) -->
          <div class="exercise-weight-bar">
            <div class="weight-input-wrap">
              <input type="text" class="input-main-weight" inputmode="decimal" placeholder="0" value="${weightVal}" data-exercise-id="${exId}">
              <span class="weight-unit-label">kg</span>
            </div>
            <button class="btn-stepper" data-step="-2.5" data-exercise-id="${exId}">-2.5</button>
            <button class="btn-stepper" data-step="+2.5" data-exercise-id="${exId}">+2.5</button>
            ${canBump ? `
              <button class="btn-hint-bump" data-hint-bump="+2.5" data-exercise-id="${exId}">+2.5 kg hint</button>
            ` : ''}
          </div>

          <!-- Sets Table -->
          <div class="set-list">
            ${sets.map((s, sIdx) => {
              const isOverridden = s.kg !== null && s.kg !== undefined && s.kg !== exLog.weightKg;
              const displayKg = s.kg !== null && s.kg !== undefined ? s.kg : (weightVal || '—');
              return `
                <div class="set-row">
                  <span class="set-idx">${sIdx + 1}</span>
                  <span class="set-weight-tap ${isOverridden ? 'overridden' : ''}" data-override-set="${sIdx}" data-exercise-id="${exId}" title="Tap to override weight for this set only">
                    ${displayKg} kg
                  </span>
                  <input type="number" class="set-reps-input" inputmode="numeric" placeholder="${item.repMax || 10}" value="${s.reps !== null && s.reps !== undefined ? s.reps : ''}" data-set-idx="${sIdx}" data-exercise-id="${exId}">
                  <button class="btn-set-check ${s.done ? 'done' : ''}" data-set-idx="${sIdx}" data-exercise-id="${exId}" data-rest="${item.restSec || 90}">
                    <div class="set-check-box">
                      ${s.done ? '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                    </div>
                  </button>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Set Controls -->
          <div class="set-controls-row">
            <button class="set-btn-link" data-add-set="${exId}">+ Set</button>
            ${sets.length > 1 ? `<button class="set-btn-link" data-remove-set="${exId}">- Remove set</button>` : ''}
          </div>

          <!-- Exercise Note Line -->
          <div class="exercise-note-line">
            <input type="text" class="input-exercise-note" placeholder="Exercise note..." value="${exLog.note || ''}" data-exercise-id="${exId}">
            <label class="pin-note-label">
              <input type="checkbox" ${pinnedNote ? 'checked' : ''} data-pin-note="${exId}">
              <span>Pin next time</span>
            </label>
          </div>

          <!-- In-Session Edit Box (Visible when Edit header button is toggled) -->
          <div class="in-session-edit-box ${state.inSessionEditMode ? 'open' : ''}">
            <div style="display: flex; gap: var(--space-2); align-items: center;">
              <input type="text" class="input-quick-add" placeholder="Replace exercise..." data-typeahead-replace="${exId}">
              <button class="btn-action-text" data-remove-exercise="${exId}" style="color: var(--accent);">Remove</button>
            </div>
            <div id="typeahead-results-${exId}" class="typeahead-results" style="display: none;"></div>

            <div class="edit-scope-toggle">
              <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                <input type="checkbox" checked data-just-today="${exId}">
                <span>Just today (do not change template)</span>
              </label>
              <button class="set-btn-link" data-jump-template="${template.id}">Edit template ↗</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // 3. Cooldown collapsed row
    const cooldownItems = template.cooldown || [];
    const cooldownHtml = cooldownItems.length > 0 ? `
      <div class="collapsible-row" id="row-cooldown" style="margin-top: var(--space-3);">
        <div class="collapsible-row-header" role="button" tabindex="0">
          <span>Cooldown · ${Math.max(3, cooldownItems.length)} min</span>
          <svg class="chevron-icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="collapsible-row-body">
          ${cooldownItems.map((item, idx) => {
            const checked = log.cooldownDone && log.cooldownDone[idx];
            return `
              <div class="check-item ${checked ? 'done' : ''}" data-cooldown-idx="${idx}">
                <div class="check-square">
                  ${checked ? '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                </div>
                <span>${item.name}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : '';

    container.innerHTML = `
      ${warmupHtml}
      <div class="exercises-container">${exercisesHtml}</div>
      ${cooldownHtml}

      <!-- Daily Feeling, Sleep, and Free Note -->
      <div style="margin-top: var(--space-5); padding-top: var(--space-3); border-top: 1px solid var(--line-hairline); display: flex; flex-direction: column; gap: var(--space-3);">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">How do I feel?</span>
          <div style="display: flex; gap: 4px;">
            ${[1, 2, 3, 4, 5].map(f => `
              <button class="btn-action-text btn-feel ${log.feeling === f ? 'active' : ''}" data-feeling="${f}">${f}</button>
            `).join('')}
          </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Sleep (hrs)</span>
          <input type="number" id="input-sleep" step="0.5" class="set-reps-input" style="width: 80px;" placeholder="8.0" value="${log.sleepHours || ''}">
        </div>

        <input type="text" id="input-session-note" class="input-exercise-note" placeholder="Session note..." value="${log.sessionNote || ''}">
      </div>
    `;

    // Wire Warm-up toggle & checks
    const warmupRow = document.getElementById('row-warmup');
    if (warmupRow) {
      warmupRow.querySelector('.collapsible-row-header').addEventListener('click', () => {
        warmupRow.classList.toggle('open');
      });
      warmupRow.querySelectorAll('[data-warmup-idx]').forEach(it => {
        it.addEventListener('click', () => {
          unlockAudioContext();
          const idx = parseInt(it.dataset.warmupIdx, 10);
          if (!log.warmupDone) log.warmupDone = [];
          log.warmupDone[idx] = !log.warmupDone[idx];
          saveState();
          renderSessionView();
        });
      });
    }

    // Wire Cooldown toggle & checks
    const cooldownRow = document.getElementById('row-cooldown');
    if (cooldownRow) {
      cooldownRow.querySelector('.collapsible-row-header').addEventListener('click', () => {
        cooldownRow.classList.toggle('open');
      });
      cooldownRow.querySelectorAll('[data-cooldown-idx]').forEach(it => {
        it.addEventListener('click', () => {
          unlockAudioContext();
          const idx = parseInt(it.dataset.cooldownIdx, 10);
          if (!log.cooldownDone) log.cooldownDone = [];
          log.cooldownDone[idx] = !log.cooldownDone[idx];
          saveState();
          renderSessionView();
        });
      });
    }

    // Wire Exercise Block Interactions
    container.querySelectorAll('.exercise-block').forEach(block => {
      const exId = block.dataset.exerciseId;
      const exLog = log.exercises.find(e => e.exerciseId === exId);
      if (!exLog) return;

      // "i" info drawer toggle
      const btnDrawer = block.querySelector('[data-drawer-toggle]');
      const drawer = block.querySelector(`#drawer-${exId}`);
      if (btnDrawer && drawer) {
        btnDrawer.addEventListener('click', () => {
          drawer.classList.toggle('open');
          btnDrawer.classList.toggle('active');
        });
      }

      // Alternative swap in
      block.querySelectorAll('[data-swap-to]').forEach(altBtn => {
        altBtn.addEventListener('click', () => {
          unlockAudioContext();
          const newAltId = altBtn.dataset.swapTo;
          const newLib = state.data.library[newAltId];
          if (newLib) {
            exLog.exerciseId = newAltId;
            exLog.name = newLib.name;
            exLog.weightKg = newLib.lastWeightKg || exLog.weightKg;
            saveState();
            renderSessionView();
          }
        });
      });

      // Dismiss pinned note
      const dismissBtn = block.querySelector('[data-dismiss-note]');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
          if (state.data.library[exId]) {
            state.data.library[exId].pinnedNote = '';
            saveState();
            renderSessionView();
          }
        });
      }

      // Main weight input (fills all sets automatically)
      const weightInput = block.querySelector('.input-main-weight');
      if (weightInput) {
        weightInput.addEventListener('change', () => {
          const val = parseFloat(weightInput.value.replace(',', '.'));
          const kg = isNaN(val) ? null : val;
          exLog.weightKg = kg;
          if (state.data.library[exId]) {
            state.data.library[exId].lastWeightKg = kg;
          }
          // Update all sets that don't have an individual override
          exLog.sets.forEach(s => {
            s.kg = kg;
          });
          saveState();
          renderSessionView();
        });
      }

      // Steppers (-2.5, +2.5)
      block.querySelectorAll('.btn-stepper').forEach(stepBtn => {
        stepBtn.addEventListener('click', () => {
          unlockAudioContext();
          const delta = parseFloat(stepBtn.dataset.step);
          const current = parseFloat(exLog.weightKg) || 0;
          const next = Math.max(0, current + delta);
          exLog.weightKg = next;
          if (state.data.library[exId]) {
            state.data.library[exId].lastWeightKg = next;
          }
          exLog.sets.forEach(s => { s.kg = next; });
          saveState();
          renderSessionView();
        });
      });

      // Hint Bump button (+2.5 kg)
      const bumpBtn = block.querySelector('[data-hint-bump]');
      if (bumpBtn) {
        bumpBtn.addEventListener('click', () => {
          unlockAudioContext();
          const current = parseFloat(exLog.weightKg) || 0;
          const next = current + 2.5;
          exLog.weightKg = next;
          if (state.data.library[exId]) {
            state.data.library[exId].lastWeightKg = next;
          }
          exLog.sets.forEach(s => { s.kg = next; });
          saveState();
          renderSessionView();
        });
      }

      // Set individual weight override
      block.querySelectorAll('[data-override-set]').forEach(overrideSpan => {
        overrideSpan.addEventListener('click', () => {
          const sIdx = parseInt(overrideSpan.dataset.overrideSet, 10);
          const currentKg = exLog.sets[sIdx]?.kg || exLog.weightKg || 0;
          const entered = prompt(`Set ${sIdx + 1} weight override (kg):`, currentKg);
          if (entered !== null) {
            const parsed = parseFloat(entered.replace(',', '.'));
            if (!isNaN(parsed)) {
              exLog.sets[sIdx].kg = parsed;
              saveState();
              renderSessionView();
            }
          }
        });
      });

      // Set reps inputs
      block.querySelectorAll('.set-reps-input').forEach(repsInput => {
        repsInput.addEventListener('change', () => {
          const sIdx = parseInt(repsInput.dataset.setIdx, 10);
          const val = parseInt(repsInput.value, 10);
          if (exLog.sets[sIdx]) {
            exLog.sets[sIdx].reps = isNaN(val) ? null : val;
            saveState();
          }
        });
      });

      // Set Done checkmark (starts Rest Timer!)
      block.querySelectorAll('.btn-set-check').forEach(checkBtn => {
        checkBtn.addEventListener('click', () => {
          unlockAudioContext();
          const sIdx = parseInt(checkBtn.dataset.setIdx, 10);
          const restSec = parseInt(checkBtn.dataset.rest, 10) || 90;
          const s = exLog.sets[sIdx];
          if (!s) return;

          const wasDone = s.done;
          s.done = !wasDone;

          // If weight/reps empty, fill default
          if (s.kg === null || s.kg === undefined) s.kg = exLog.weightKg;
          if (s.reps === null || s.reps === undefined) s.reps = 8;

          // If marked done, launch rest timer
          if (!wasDone) {
            startRestTimer(restSec);
          }

          // Check if whole session is completed
          checkAutoSessionComplete(log);
          saveState();
          renderDayStrip();
          renderSessionView();
        });
      });

      // Add Set / Remove Set
      const addSetBtn = block.querySelector('[data-add-set]');
      if (addSetBtn) {
        addSetBtn.addEventListener('click', () => {
          unlockAudioContext();
          const lastSet = exLog.sets[exLog.sets.length - 1];
          exLog.sets.push({
            kg: exLog.weightKg,
            reps: lastSet?.reps || 8,
            done: false
          });
          saveState();
          renderSessionView();
        });
      }

      const removeSetBtn = block.querySelector('[data-remove-set]');
      if (removeSetBtn) {
        removeSetBtn.addEventListener('click', () => {
          unlockAudioContext();
          if (exLog.sets.length > 1) {
            exLog.sets.pop();
            saveState();
            renderSessionView();
          }
        });
      }

      // Exercise note input
      const exNoteInput = block.querySelector('.input-exercise-note');
      if (exNoteInput) {
        exNoteInput.addEventListener('input', () => {
          exLog.note = exNoteInput.value;
          saveState();
        });
      }

      // Pin note toggle
      const pinToggle = block.querySelector('[data-pin-note]');
      if (pinToggle) {
        pinToggle.addEventListener('change', () => {
          if (state.data.library[exId]) {
            state.data.library[exId].pinnedNote = pinToggle.checked ? (exLog.note || 'Focus on form') : '';
            saveState();
          }
        });
      }

      // In-session typeahead replace
      const replaceInp = block.querySelector('[data-typeahead-replace]');
      const resultsDiv = block.querySelector(`#typeahead-results-${exId}`);
      if (replaceInp && resultsDiv) {
        replaceInp.addEventListener('input', () => {
          const query = replaceInp.value.trim().toLowerCase();
          if (!query) {
            resultsDiv.style.display = 'none';
            return;
          }

          const matches = Object.values(state.data.library).filter(item => {
            return item.name && item.name.toLowerCase().includes(query);
          }).slice(0, 6);

          let html = matches.map(m => `
            <div class="typeahead-item" data-choose-lib="${m.id}">${m.name}</div>
          `).join('');

          html = `<div class="typeahead-item" data-choose-custom="${replaceInp.value}">Add "${replaceInp.value}"</div>` + html;

          resultsDiv.innerHTML = html;
          resultsDiv.style.display = 'flex';

          resultsDiv.querySelectorAll('[data-choose-lib]').forEach(itemEl => {
            itemEl.addEventListener('click', () => {
              const targetId = itemEl.dataset.chooseLib;
              applyExerciseReplacement(exId, targetId, template.id, block);
            });
          });

          resultsDiv.querySelectorAll('[data-choose-custom]').forEach(itemEl => {
            itemEl.addEventListener('click', () => {
              const customName = itemEl.dataset.chooseCustom;
              const slug = 'custom-' + customName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              state.data.library[slug] = {
                id: slug,
                name: customName,
                tip: '',
                defaultSets: 3,
                repMin: 8,
                repMax: 12,
                repRange: '8–12',
                restSec: 90,
                lastWeightKg: null,
                pinnedNote: '',
                alternatives: []
              };
              applyExerciseReplacement(exId, slug, template.id, block);
            });
          });
        });
      }

      // In-session remove exercise
      const removeExBtn = block.querySelector('[data-remove-exercise]');
      if (removeExBtn) {
        removeExBtn.addEventListener('click', () => {
          const justToday = block.querySelector(`[data-just-today="${exId}"]`)?.checked ?? true;
          if (justToday) {
            state.sessionOverridesToday[exId] = { removed: true };
          } else {
            // Remove permanently from template
            template.main = template.main.filter(m => m.exerciseId !== exId);
            saveState();
          }
          log.exercises = log.exercises.filter(e => e.exerciseId !== exId);
          saveState();
          renderSessionView();
        });
      }

      // In-session jump to template
      const jumpTemplateBtn = block.querySelector('[data-jump-template]');
      if (jumpTemplateBtn) {
        jumpTemplateBtn.addEventListener('click', () => {
          openTemplateEditor(template.id);
        });
      }
    });

    // Feeling pills
    container.querySelectorAll('.btn-feel').forEach(btn => {
      btn.addEventListener('click', () => {
        unlockAudioContext();
        log.feeling = parseInt(btn.dataset.feeling, 10);
        saveState();
        renderSessionView();
      });
    });

    // Sleep input
    const sleepInp = document.getElementById('input-sleep');
    if (sleepInp) {
      sleepInp.addEventListener('input', () => {
        log.sleepHours = sleepInp.value;
        saveState();
      });
    }

    // Session note input
    const noteInp = document.getElementById('input-session-note');
    if (noteInp) {
      noteInp.addEventListener('input', () => {
        log.sessionNote = noteInp.value;
        saveState();
      });
    }
  }

  function applyExerciseReplacement(origExId, newExId, templateId, block) {
    const justToday = block.querySelector(`[data-just-today="${origExId}"]`)?.checked ?? true;
    const newLib = state.data.library[newExId];
    if (!newLib) return;

    if (justToday) {
      state.sessionOverridesToday[origExId] = {
        exerciseId: newExId,
        name: newLib.name,
        sets: newLib.defaultSets || 3,
        repMin: newLib.repMin || 8,
        repMax: newLib.repMax || 12,
        restSec: newLib.restSec || 90
      };
    } else {
      const template = state.data.templates[templateId];
      if (template && template.main) {
        const item = template.main.find(m => m.exerciseId === origExId);
        if (item) {
          item.exerciseId = newExId;
          item.name = newLib.name;
          item.sets = newLib.defaultSets || item.sets;
          item.repMin = newLib.repMin || item.repMin;
          item.repMax = newLib.repMax || item.repMax;
          item.restSec = newLib.restSec || item.restSec;
        }
      }
    }

    // Update log
    const log = getOrCreateLog(state.currentIsoWeek, state.selectedDayIndex, templateId);
    const exLog = log.exercises.find(e => e.exerciseId === origExId);
    if (exLog) {
      exLog.exerciseId = newExId;
      exLog.name = newLib.name;
      exLog.weightKg = newLib.lastWeightKg || exLog.weightKg;
    }

    saveState();
    renderSessionView();
  }

  function checkAutoSessionComplete(log) {
    if (!log.exercises || log.exercises.length === 0) return;
    const allDone = log.exercises.every(ex => ex.sets && ex.sets.length > 0 && ex.sets.every(s => s.done));
    log.completed = allDone;
    if (allDone && !log.completedAt) {
      log.completedAt = new Date().toISOString();
    }
  }

  function checkEligibleForWeightBump(exerciseId, targetRepMax) {
    if (!targetRepMax || targetRepMax <= 0) return false;
    const logKeys = Object.keys(state.data.logs || {}).sort().reverse();

    for (const k of logKeys) {
      const log = state.data.logs[k];
      if (!log || !log.exercises) continue;
      const ex = log.exercises.find(e => e.exerciseId === exerciseId);
      if (ex && ex.sets && ex.sets.length > 0) {
        const doneSets = ex.sets.filter(s => s.done);
        if (doneSets.length >= 3 && doneSets.every(s => Number(s.reps) >= targetRepMax)) {
          return true;
        }
        return false;
      }
    }
    return false;
  }

  function formatRestTime(seconds) {
    if (!seconds || seconds <= 0) return 'None';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (s === 0) return `${m} min`;
    if (m === 0) return `${s}s`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /* ==========================================================================
     Reschedule Engine (One-Tap Bottom Sheet, Undo Toast)
     ========================================================================== */

  function openRescheduleSheet(sourceSessionId) {
    const sheet = document.getElementById('sheet-reschedule');
    const list = document.getElementById('reschedule-days-list');
    if (!sheet || !list) return;

    const schedule = getWeekSchedule(state.currentIsoWeek);
    const weekDates = getWeekDates(state.currentIsoWeek);

    list.innerHTML = schedule.map((sessId, dayIdx) => {
      const isCurrent = (dayIdx === state.selectedDayIndex);
      const isMuayThai = (sessId === 'muay-thai-1' || sessId === 'muay-thai-2');
      const occupantTemplate = state.data.templates[sessId] || { name: 'Rest' };
      const date = weekDates[dayIdx];

      // Subtle red dot if heavy session is adjacent to Muay Thai
      const isAdjacentToMT = (dayIdx === 1 || dayIdx === 3);

      return `
        <div class="reschedule-day-row ${isMuayThai ? 'locked' : ''} ${isCurrent ? 'current' : ''}" data-target-day="${dayIdx}">
          <div>
            <strong>${DAY_NAMES[dayIdx]}</strong> (${date.getDate()} ${date.toLocaleString('en-US', { month: 'short' })})
            ${isAdjacentToMT && sessId.startsWith('strength') ? '<span class="day-heavy-dot"></span>' : ''}
          </div>
          <span style="font-size: 13px; color: var(--text-muted);">${occupantTemplate.shortTitle || occupantTemplate.name}</span>
        </div>
      `;
    }).join('');

    sheet.classList.add('open');
    document.body.style.overflow = 'hidden';

    list.querySelectorAll('.reschedule-day-row:not(.locked)').forEach(row => {
      row.addEventListener('click', () => {
        unlockAudioContext();
        const targetDay = parseInt(row.dataset.targetDay, 10);
        if (targetDay === state.selectedDayIndex) {
          closeRescheduleSheet();
          return;
        }

        const sourceDay = state.selectedDayIndex;
        const targetSessionId = schedule[targetDay];

        // Perform swap
        if (!state.data.weeks[state.currentIsoWeek]) {
          state.data.weeks[state.currentIsoWeek] = {
            id: state.currentIsoWeek,
            planVariant: '3-day',
            moves: {}
          };
        }
        const moves = state.data.weeks[state.currentIsoWeek].moves || {};
        const prevSourceMove = moves[sourceSessionId];
        const prevTargetMove = moves[targetSessionId];

        moves[sourceSessionId] = targetDay;
        moves[targetSessionId] = sourceDay;
        state.data.weeks[state.currentIsoWeek].moves = moves;

        closeRescheduleSheet();
        saveState();

        selectDay(targetDay);

        // Show Undo toast
        showToast(`Moved to ${DAY_NAMES[targetDay]}`, () => {
          // Undo swap
          if (prevSourceMove !== undefined) moves[sourceSessionId] = prevSourceMove; else delete moves[sourceSessionId];
          if (prevTargetMove !== undefined) moves[targetSessionId] = prevTargetMove; else delete moves[targetSessionId];
          saveState();
          selectDay(sourceDay);
        });
      });
    });
  }

  function closeRescheduleSheet() {
    const sheet = document.getElementById('sheet-reschedule');
    if (sheet) sheet.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ==========================================================================
     Templates Tab & Inline Template Editor (Set once, applies everywhere)
     ========================================================================== */

  function renderTemplatesList() {
    const container = document.getElementById('templates-list-container');
    if (!container) return;

    document.getElementById('templates-index-view').style.display = 'block';
    document.getElementById('template-editor-view').classList.remove('open');

    // List all template records
    const templateIds = [
      'strength-a', 'strength-b', 'strength-c',
      'fb-strength-1', 'fb-strength-2',
      'aerobic-base-mobility', 'mini-mobility'
    ];

    container.innerHTML = templateIds.map(id => {
      const t = state.data.templates[id];
      if (!t) return '';
      const count = (t.main || []).length;
      return `
        <div class="template-row-item" data-template-id="${id}">
          <span class="template-item-title">${t.shortTitle || t.name}</span>
          <span class="template-item-meta">${count} items ›</span>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.template-row-item').forEach(item => {
      item.addEventListener('click', () => {
        unlockAudioContext();
        openTemplateEditor(item.dataset.templateId);
      });
    });
  }

  function openTemplateEditor(templateId) {
    state.activeTemplateId = templateId;
    const template = state.data.templates[templateId];
    if (!template) return;

    // Switch view
    document.getElementById('templates-index-view').style.display = 'none';
    const editor = document.getElementById('template-editor-view');
    editor.classList.add('open');

    document.getElementById('editor-template-title').textContent = template.shortTitle || template.name;

    renderTemplateEditorSections();
  }

  function renderTemplateEditorSections() {
    const templateId = state.activeTemplateId;
    const template = state.data.templates[templateId];
    if (!template) return;

    // 1. Warmup list
    const warmupEl = document.getElementById('editor-warmup-container');
    warmupEl.innerHTML = (template.warmup || []).map((w, idx) => `
      <div class="editor-row">
        <input type="text" class="input-quick-add" value="${w.name}" data-edit-warmup-idx="${idx}" style="font-size: 13px;">
        <div class="editor-reorder-btns">
          <button class="btn-reorder" data-reorder-warmup="${idx}" data-dir="-1">▲</button>
          <button class="btn-reorder" data-reorder-warmup="${idx}" data-dir="1">▼</button>
          <button class="btn-reorder" data-delete-warmup="${idx}" style="color: var(--accent);">✕</button>
        </div>
      </div>
    `).join('');

    // 2. Main exercises list
    const mainEl = document.getElementById('editor-main-container');
    mainEl.innerHTML = (template.main || []).map((m, idx) => `
      <div class="editor-row">
        <div class="editor-row-content">
          <input type="text" class="input-quick-add" value="${m.name}" data-edit-main-name="${idx}" style="font-weight: 700;">
          <input type="number" class="set-reps-input" style="width: 44px; height: 32px;" value="${m.sets || 3}" data-edit-main-sets="${idx}" title="Sets">
          <input type="text" class="set-reps-input" style="width: 60px; height: 32px;" value="${m.repRange || '8–12'}" data-edit-main-reps="${idx}" title="Reps">
          <input type="number" class="set-reps-input" style="width: 52px; height: 32px;" value="${m.restSec || 90}" data-edit-main-rest="${idx}" step="15" title="Rest (s)">
        </div>
        <div class="editor-reorder-btns">
          <button class="btn-reorder" data-reorder-main="${idx}" data-dir="-1">▲</button>
          <button class="btn-reorder" data-reorder-main="${idx}" data-dir="1">▼</button>
          <button class="btn-reorder" data-delete-main="${idx}" style="color: var(--accent);">✕</button>
        </div>
      </div>
    `).join('');

    // 3. Cooldown list
    const cooldownEl = document.getElementById('editor-cooldown-container');
    cooldownEl.innerHTML = (template.cooldown || []).map((c, idx) => `
      <div class="editor-row">
        <input type="text" class="input-quick-add" value="${c.name}" data-edit-cooldown-idx="${idx}" style="font-size: 13px;">
        <div class="editor-reorder-btns">
          <button class="btn-reorder" data-reorder-cooldown="${idx}" data-dir="-1">▲</button>
          <button class="btn-reorder" data-reorder-cooldown="${idx}" data-dir="1">▼</button>
          <button class="btn-reorder" data-delete-cooldown="${idx}" style="color: var(--accent);">✕</button>
        </div>
      </div>
    `).join('');

    bindTemplateEditorEvents(template);
  }

  function bindTemplateEditorEvents(template) {
    // Warm-up edits
    document.querySelectorAll('[data-edit-warmup-idx]').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = parseInt(inp.dataset.editWarmupIdx, 10);
        template.warmup[idx].name = inp.value;
        saveTemplateState();
      });
    });

    document.querySelectorAll('[data-reorder-warmup]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.reorderWarmup, 10);
        const dir = parseInt(btn.dataset.dir, 10);
        if (swapArrayItems(template.warmup, idx, idx + dir)) {
          saveTemplateState();
          renderTemplateEditorSections();
        }
      });
    });

    document.querySelectorAll('[data-delete-warmup]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.deleteWarmup, 10);
        const removed = template.warmup.splice(idx, 1)[0];
        saveTemplateState();
        renderTemplateEditorSections();
        showToast(`Removed "${removed.name}"`, () => {
          template.warmup.splice(idx, 0, removed);
          saveTemplateState();
          renderTemplateEditorSections();
        });
      });
    });

    // Main exercise edits
    document.querySelectorAll('[data-edit-main-name]').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = parseInt(inp.dataset.editMainName, 10);
        template.main[idx].name = inp.value;
        saveTemplateState();
      });
    });

    document.querySelectorAll('[data-edit-main-sets]').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = parseInt(inp.dataset.editMainSets, 10);
        template.main[idx].sets = parseInt(inp.value, 10) || 3;
        saveTemplateState();
      });
    });

    document.querySelectorAll('[data-edit-main-reps]').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = parseInt(inp.dataset.editMainReps, 10);
        template.main[idx].repRange = inp.value;
        saveTemplateState();
      });
    });

    document.querySelectorAll('[data-edit-main-rest]').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = parseInt(inp.dataset.editMainRest, 10);
        template.main[idx].restSec = parseInt(inp.value, 10) || 90;
        saveTemplateState();
      });
    });

    document.querySelectorAll('[data-reorder-main]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.reorderMain, 10);
        const dir = parseInt(btn.dataset.dir, 10);
        if (swapArrayItems(template.main, idx, idx + dir)) {
          saveTemplateState();
          renderTemplateEditorSections();
        }
      });
    });

    document.querySelectorAll('[data-delete-main]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.deleteMain, 10);
        const removed = template.main.splice(idx, 1)[0];
        saveTemplateState();
        renderTemplateEditorSections();
        showToast(`Removed "${removed.name}"`, () => {
          template.main.splice(idx, 0, removed);
          saveTemplateState();
          renderTemplateEditorSections();
        });
      });
    });

    // Cooldown edits
    document.querySelectorAll('[data-edit-cooldown-idx]').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = parseInt(inp.dataset.editCooldownIdx, 10);
        template.cooldown[idx].name = inp.value;
        saveTemplateState();
      });
    });

    document.querySelectorAll('[data-reorder-cooldown]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.reorderCooldown, 10);
        const dir = parseInt(btn.dataset.dir, 10);
        if (swapArrayItems(template.cooldown, idx, idx + dir)) {
          saveTemplateState();
          renderTemplateEditorSections();
        }
      });
    });

    document.querySelectorAll('[data-delete-cooldown]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.deleteCooldown, 10);
        const removed = template.cooldown.splice(idx, 1)[0];
        saveTemplateState();
        renderTemplateEditorSections();
        showToast(`Removed "${removed.name}"`, () => {
          template.cooldown.splice(idx, 0, removed);
          saveTemplateState();
          renderTemplateEditorSections();
        });
      });
    });
  }

  function swapArrayItems(arr, i, j) {
    if (j < 0 || j >= arr.length) return false;
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
    return true;
  }

  function saveTemplateState() {
    const indicator = document.getElementById('editor-save-indicator');
    if (indicator) indicator.textContent = '…';
    saveState().then(() => {
      if (indicator) indicator.textContent = '✓';
    });
  }

  /* ==========================================================================
     Progress & Consistency View (Minimal SVG Chart)
     ========================================================================== */

  function renderProgressView() {
    // 1. Streak and Total
    let totalCompleted = 0;
    Object.values(state.data.logs || {}).forEach(log => {
      if (log.completed) totalCompleted++;
    });

    const streak = calculateWeeklyStreak();
    const streakLabel = document.getElementById('progress-streak-label');
    const totalLabel = document.getElementById('progress-total-label');
    if (streakLabel) streakLabel.textContent = `Streak: ${streak} wks`;
    if (totalLabel) totalLabel.textContent = `Done: ${totalCompleted} sessions`;

    // 2. Exercise List
    const listEl = document.getElementById('progress-exercise-list');
    if (!listEl) return;

    // Collect all exercises with logged data
    const exMap = new Map();
    Object.values(state.data.logs || {}).forEach(log => {
      (log.exercises || []).forEach(ex => {
        if (!exMap.has(ex.exerciseId)) {
          exMap.set(ex.exerciseId, ex.name || state.data.library[ex.exerciseId]?.name || ex.exerciseId);
        }
      });
    });

    // Default core lifts if empty
    if (exMap.size === 0) {
      exMap.set('back-squat', 'Barbell back squat');
      exMap.set('bench-press', 'Barbell bench press');
      exMap.set('conventional-deadlift', 'Conventional deadlift');
    }

    listEl.innerHTML = Array.from(exMap.entries()).map(([id, name]) => {
      const isExpanded = (state.expandedProgressExerciseId === id);
      return `
        <div class="progress-item-wrapper">
          <div class="progress-item-row" data-progress-toggle="${id}">
            <strong style="font-size: 14px; color: var(--text);">${name}</strong>
            <span style="font-size: 12px; color: var(--text-dim);">${isExpanded ? '▲' : '▼'}</span>
          </div>
          ${isExpanded ? `<div class="progress-chart-box" id="chart-box-${id}"></div>` : ''}
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('[data-progress-toggle]').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.progressToggle;
        state.expandedProgressExerciseId = state.expandedProgressExerciseId === id ? null : id;
        renderProgressView();
        if (state.expandedProgressExerciseId) {
          drawMinimalSvgChart(state.expandedProgressExerciseId);
        }
      });
    });

    if (state.expandedProgressExerciseId) {
      drawMinimalSvgChart(state.expandedProgressExerciseId);
    }
  }

  function calculateWeeklyStreak() {
    let streak = 0;
    let cur = state.todayIsoWeek;

    for (let i = 0; i < 52; i++) {
      const schedule = getWeekSchedule(cur);
      let weekDone = false;
      schedule.forEach((sessId, dIdx) => {
        const key = getSessionLogKey(cur, dIdx, sessId);
        if (state.data.logs[key]?.completed) weekDone = true;
      });

      if (weekDone) {
        streak++;
        cur = shiftIsoWeek(cur, -1);
      } else {
        break;
      }
    }
    return streak;
  }

  function drawMinimalSvgChart(exerciseId) {
    const box = document.getElementById(`chart-box-${exerciseId}`);
    if (!box) return;

    // Collect chronological points
    const points = [];
    const logKeys = Object.keys(state.data.logs || {}).sort();

    logKeys.forEach(k => {
      const log = state.data.logs[k];
      const ex = (log.exercises || []).find(e => e.exerciseId === exerciseId);
      if (ex && ex.sets && ex.sets.length > 0) {
        const doneSets = ex.sets.filter(s => s.done && Number(s.kg) > 0 && Number(s.reps) > 0);
        if (doneSets.length > 0) {
          let topKg = 0;
          let best1RM = 0;
          doneSets.forEach(s => {
            const kg = Number(s.kg);
            const r = Number(s.reps);
            const epley = Math.round(kg * (1 + r / 30));
            if (kg > topKg) topKg = kg;
            if (epley > best1RM) best1RM = epley;
          });

          const d = log.completedAt ? new Date(log.completedAt) : null;
          const dateStr = d ? `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}` : k.split('_')[0];
          points.push({ dateStr, kg: topKg, epley: best1RM });
        }
      }
    });

    if (points.length === 0) {
      box.innerHTML = `<p style="font-size: 13px; color: var(--text-dim); text-align: center; padding: var(--space-3);">No data yet</p>`;
      return;
    }

    const W = 400;
    const H = 160;
    const padL = 40;
    const padR = 20;
    const padT = 20;
    const padB = 30;

    const values = points.map(p => p.kg);
    const minVal = Math.max(0, Math.floor(Math.min(...values) * 0.9));
    const maxVal = Math.ceil(Math.max(...values) * 1.1) || 100;
    const range = (maxVal - minVal) || 1;

    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const getX = (idx) => points.length === 1 ? padL + chartW / 2 : padL + (idx / (points.length - 1)) * chartW;
    const getY = (val) => padT + chartH - ((val - minVal) / range) * chartH;

    let pathD = '';
    points.forEach((p, idx) => {
      const x = getX(idx);
      const y = getY(p.kg);
      pathD += (idx === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
    });

    const circles = points.map((p, idx) => {
      const x = getX(idx);
      const y = getY(p.kg);
      return `<circle cx="${x}" cy="${y}" r="4" fill="var(--accent)" />
              <text x="${x}" y="${H - 10}" fill="var(--text-dim)" font-size="10" text-anchor="middle">${p.dateStr}</text>`;
    }).join('');

    box.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" style="width: 100%; height: auto; max-height: 180px;">
        <line x1="${padL}" y1="${getY(minVal)}" x2="${W - padR}" y2="${getY(minVal)}" stroke="var(--line-subtle)" stroke-width="1" />
        <line x1="${padL}" y1="${getY(maxVal)}" x2="${W - padR}" y2="${getY(maxVal)}" stroke="var(--line-subtle)" stroke-width="1" />
        <text x="${padL - 6}" y="${getY(minVal) + 4}" fill="var(--text-dim)" font-size="10" text-anchor="end">${minVal}</text>
        <text x="${padL - 6}" y="${getY(maxVal) + 4}" fill="var(--text-dim)" font-size="10" text-anchor="end">${maxVal}</text>
        <path d="${pathD}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" />
        ${circles}
      </svg>
    `;
  }

  /* ==========================================================================
     Settings View & Backups
     ========================================================================== */

  function renderSettingsSheet() {
    const backupLabel = document.getElementById('label-last-backup');
    if (backupLabel) {
      if (state.data.settings?.lastBackup) {
        const d = new Date(state.data.settings.lastBackup);
        backupLabel.textContent = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      } else {
        backupLabel.textContent = 'Never';
      }
    }

    const selectTheme = document.getElementById('select-theme');
    if (selectTheme) {
      selectTheme.value = state.data.settings?.theme || 'auto';
    }
  }

  /* ==========================================================================
     Global State & Event Wiring
     ========================================================================== */

  async function saveState() {
    return StorageService.saveState(state.data);
  }

  function switchTab(tabId) {
    state.activeTab = tabId;

    // View panes
    document.querySelectorAll('.view-pane').forEach(p => p.classList.remove('active'));
    const targetPane = document.getElementById(`view-${tabId}`);
    if (targetPane) targetPane.classList.add('active');

    // Desktop nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.tab === tabId);
    });

    // Mobile tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    if (tabId === 'plan') {
      renderDayStrip();
      renderSessionView();
    } else if (tabId === 'templates') {
      renderTemplatesList();
    } else if (tabId === 'progress') {
      renderProgressView();
    }
  }

  function initApp() {
    // 1. Load data
    state.data = StorageService.getStateSync();

    // 2. Set current date & ISO week
    const now = new Date();
    state.todayIsoWeek = getIsoWeekString(now);
    state.todayDayIndex = (now.getDay() + 6) % 7;
    state.currentIsoWeek = state.todayIsoWeek;
    state.selectedDayIndex = state.todayDayIndex;

    // 3. Apply theme
    applyTheme(state.data.settings?.theme || 'auto');

    // 4. Register Service Worker & handle one-time controllerchange reload
    if ('serviceWorker' in navigator) {
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(console.warn);
      });
    }
    StorageService.requestPersist();

    // 5. Wire Navigation Events
    document.querySelectorAll('[data-tab]').forEach(el => {
      el.addEventListener('click', () => {
        unlockAudioContext();
        switchTab(el.dataset.tab);
      });
    });

    // Week navigation buttons
    document.getElementById('btn-prev-week').addEventListener('click', () => {
      state.currentIsoWeek = shiftIsoWeek(state.currentIsoWeek, -1);
      renderDayStrip();
      renderSessionView();
    });

    document.getElementById('btn-next-week').addEventListener('click', () => {
      state.currentIsoWeek = shiftIsoWeek(state.currentIsoWeek, 1);
      renderDayStrip();
      renderSessionView();
    });

    document.getElementById('label-week-current').addEventListener('click', () => {
      state.currentIsoWeek = state.todayIsoWeek;
      state.selectedDayIndex = state.todayDayIndex;
      renderDayStrip();
      renderSessionView();
    });

    // 3-Day vs 2-Day toggle
    document.getElementById('btn-variant-3day').addEventListener('click', () => {
      if (!state.data.weeks[state.currentIsoWeek]) {
        state.data.weeks[state.currentIsoWeek] = { id: state.currentIsoWeek, planVariant: '3-day', moves: {} };
      }
      state.data.weeks[state.currentIsoWeek].planVariant = '3-day';
      saveState();
      renderDayStrip();
      renderSessionView();
    });

    document.getElementById('btn-variant-2day').addEventListener('click', () => {
      if (!state.data.weeks[state.currentIsoWeek]) {
        state.data.weeks[state.currentIsoWeek] = { id: state.currentIsoWeek, planVariant: '2-day', moves: {} };
      }
      state.data.weeks[state.currentIsoWeek].planVariant = '2-day';
      saveState();
      renderDayStrip();
      renderSessionView();
    });

    // Rest timer buttons
    document.getElementById('btn-timer-sub15').addEventListener('click', () => adjustRestTimer(-15));
    document.getElementById('btn-timer-add15').addEventListener('click', () => adjustRestTimer(15));
    document.getElementById('btn-timer-toggle').addEventListener('click', togglePauseRestTimer);
    document.getElementById('btn-timer-skip').addEventListener('click', stopRestTimer);

    // Reschedule sheet close
    document.getElementById('btn-close-reschedule').addEventListener('click', closeRescheduleSheet);

    // Settings sheet open/close
    document.getElementById('btn-open-settings').addEventListener('click', () => {
      renderSettingsSheet();
      document.getElementById('sheet-settings').classList.add('open');
      document.body.style.overflow = 'hidden';
    });
    document.getElementById('btn-close-settings').addEventListener('click', () => {
      document.getElementById('sheet-settings').classList.remove('open');
      document.body.style.overflow = '';
    });

    // Theme selector
    document.getElementById('select-theme').addEventListener('change', (e) => {
      state.data.settings.theme = e.target.value;
      applyTheme(e.target.value);
      saveState();
    });

    // Export / Import
    document.getElementById('btn-export-backup').addEventListener('click', async () => {
      await StorageService.exportData();
      renderSettingsSheet();
    });

    const fileInput = document.getElementById('input-import-file');
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (re) => {
        try {
          const mode = confirm('Choose import mode:\nClick OK to MERGE with existing data.\nClick CANCEL to REPLACE everything.') ? 'merge' : 'replace';
          state.data = await StorageService.importData(re.target.result, mode);
          alert('Data imported successfully.');
          document.getElementById('sheet-settings').classList.remove('open');
          document.body.style.overflow = '';
          switchTab('plan');
        } catch (err) {
          alert(`Import failed: ${err.message}`);
        }
      };
      reader.readAsText(file);
    });

    // Reset All Templates
    document.getElementById('btn-reset-all-templates').addEventListener('click', async () => {
      if (confirm('Reset all templates to default? This will overwrite your custom templates.')) {
        await StorageService.resetAllTemplates();
        state.data = await StorageService.getState();
        alert('All templates reset to default.');
        renderTemplatesList();
      }
    });

    // Delete All Data
    document.getElementById('btn-delete-all-data').addEventListener('click', async () => {
      if (confirm('Warning: This will delete ALL workout history, templates, and settings. Are you sure?')) {
        if (confirm('Final confirmation: Delete all data permanently?')) {
          await StorageService.resetAll();
          state.data = await StorageService.getState();
          alert('All data deleted.');
          window.location.reload();
        }
      }
    });

    // Toast Undo button
    document.getElementById('btn-toast-undo').addEventListener('click', () => {
      if (typeof state.undoCallback === 'function') {
        state.undoCallback();
      }
      hideToast();
    });

    // Template Editor Back button
    document.getElementById('btn-back-to-templates').addEventListener('click', () => {
      renderTemplatesList();
    });

    // Template Editor Quick Add inputs
    setupQuickAddInputs();

    // Reset individual template button
    document.getElementById('btn-reset-template').addEventListener('click', async () => {
      if (!state.activeTemplateId) return;
      if (confirm(`Reset "${state.activeTemplateId}" to original default?`)) {
        await StorageService.resetTemplate(state.activeTemplateId);
        state.data = await StorageService.getState();
        openTemplateEditor(state.activeTemplateId);
      }
    });

    // 6. Initial Render
    switchTab('plan');
  }

  function setupQuickAddInputs() {
    // Quick add warmup
    const qWarmup = document.getElementById('quick-add-warmup');
    if (qWarmup) {
      qWarmup.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = qWarmup.value.trim();
          if (!val) return;
          const template = state.data.templates[state.activeTemplateId];
          if (template) {
            if (!template.warmup) template.warmup = [];
            val.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
              template.warmup.push({ name: line });
            });
            qWarmup.value = '';
            saveTemplateState();
            renderTemplateEditorSections();
          }
        }
      });
    }

    // Quick add main exercises
    const qMain = document.getElementById('quick-add-main');
    if (qMain) {
      qMain.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = qMain.value.trim();
          if (!val) return;
          const template = state.data.templates[state.activeTemplateId];
          if (template) {
            if (!template.main) template.main = [];
            val.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
              const parsed = StorageService.parseQuickAdd(line, state.data.library);
              if (parsed) {
                // Ensure in library
                if (!state.data.library[parsed.exerciseId]) {
                  state.data.library[parsed.exerciseId] = {
                    id: parsed.exerciseId,
                    name: parsed.name,
                    tip: '',
                    defaultSets: parsed.sets,
                    repMin: parsed.repMin,
                    repMax: parsed.repMax,
                    repRange: parsed.repRange,
                    restSec: parsed.restSec,
                    lastWeightKg: null,
                    pinnedNote: '',
                    alternatives: []
                  };
                }
                template.main.push(parsed);
              }
            });
            qMain.value = '';
            saveTemplateState();
            renderTemplateEditorSections();
          }
        }
      });
    }

    // Quick add cooldown
    const qCooldown = document.getElementById('quick-add-cooldown');
    if (qCooldown) {
      qCooldown.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = qCooldown.value.trim();
          if (!val) return;
          const template = state.data.templates[state.activeTemplateId];
          if (template) {
            if (!template.cooldown) template.cooldown = [];
            val.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
              template.cooldown.push({ name: line });
            });
            qCooldown.value = '';
            saveTemplateState();
            renderTemplateEditorSections();
          }
        }
      });
    }
  }

  function applyTheme(theme) {
    document.body.className = `theme-${theme}`;
  }

  // Start app
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
