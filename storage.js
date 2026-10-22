/**
 * storage.js - Complete persistence layer for Training Planner PWA
 * All storage operations are contained here.
 * Ready for future backend integration (e.g. Supabase, Firebase) without touching UI code.
 */

const STORAGE_KEY = 'training_planner_v1_data';

const DEFAULT_STORAGE = {
  version: 1,
  theme: 'auto', // 'auto' | 'dark' | 'light'
  lastBackup: null,
  weeks: {},     // Key: "2026-W43" -> { planType: "3-day-plan", scheduleOverrides: { 1: "rest" } }
  logs: {},      // Key: "2026-W43_1_strength-a" -> session log
  overrides: {}  // Key: "strength-a" -> { hidden: [], replaced: {}, edited: {}, added: [], order: [] }
};

const StorageService = {
  /**
   * Request persistent storage permission on supported browsers
   */
  async requestPersist() {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        console.log('[Storage] Persistent storage granted:', isPersisted);
        return isPersisted;
      }
    } catch (e) {
      console.warn('[Storage] Persistence request failed:', e);
    }
    return false;
  },

  /**
   * Load current state from localStorage. Always safe, never throws.
   */
  load() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return JSON.parse(JSON.stringify(DEFAULT_STORAGE));
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return JSON.parse(JSON.stringify(DEFAULT_STORAGE));
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return JSON.parse(JSON.stringify(DEFAULT_STORAGE));
      }
      return {
        version: parsed.version || 1,
        theme: parsed.theme || 'auto',
        lastBackup: parsed.lastBackup || null,
        weeks: parsed.weeks || {},
        logs: parsed.logs || {},
        overrides: parsed.overrides || {}
      };
    } catch (err) {
      console.error('[Storage] Error loading data from localStorage:', err);
      return JSON.parse(JSON.stringify(DEFAULT_STORAGE));
    }
  },

  /**
   * Save complete state to localStorage
   */
  save(data) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      const cleanData = {
        version: data.version || 1,
        theme: data.theme || 'auto',
        lastBackup: data.lastBackup || null,
        weeks: data.weeks || {},
        logs: data.logs || {},
        overrides: data.overrides || {}
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanData));
      return true;
    } catch (err) {
      console.error('[Storage] Error saving data to localStorage:', err);
      return false;
    }
  },

  /**
   * Get plan type for a given ISO week ('3-day-plan' or '2-day-fallback')
   */
  getWeekPlanType(data, isoWeek) {
    if (data.weeks && data.weeks[isoWeek] && data.weeks[isoWeek].planType) {
      return data.weeks[isoWeek].planType;
    }
    return '3-day-plan'; // default to 3-day plan
  },

  /**
   * Set plan type for a given ISO week
   */
  setWeekPlanType(data, isoWeek, planType) {
    if (!data.weeks[isoWeek]) {
      data.weeks[isoWeek] = { planType, scheduleOverrides: {} };
    } else {
      data.weeks[isoWeek].planType = planType;
    }
    this.save(data);
  },

  /**
   * Get resolved 7-day schedule for a given ISO week, considering weekly plan type and overrides
   */
  getResolvedWeekSchedule(data, isoWeek, planData) {
    const planType = this.getWeekPlanType(data, isoWeek);
    const basePlan = planData.weeklyPlans[planType] || planData.weeklyPlans['3-day-plan'];
    const baseSchedule = [...basePlan.schedule];

    // Apply schedule overrides if user moved sessions
    const weekEntry = data.weeks && data.weeks[isoWeek];
    if (weekEntry && weekEntry.scheduleOverrides) {
      for (const [dayIdx, sessionId] of Object.entries(weekEntry.scheduleOverrides)) {
        const idx = Number(dayIdx);
        if (idx >= 0 && idx < 7) {
          baseSchedule[idx] = sessionId;
        }
      }
    }
    return baseSchedule;
  },

  /**
   * Set schedule override for a specific day in a week
   */
  setScheduleOverride(data, isoWeek, dayIndex, sessionId) {
    if (!data.weeks[isoWeek]) {
      data.weeks[isoWeek] = {
        planType: this.getWeekPlanType(data, isoWeek),
        scheduleOverrides: {}
      };
    }
    if (!data.weeks[isoWeek].scheduleOverrides) {
      data.weeks[isoWeek].scheduleOverrides = {};
    }
    data.weeks[isoWeek].scheduleOverrides[dayIndex] = sessionId;
    this.save(data);
  },

  /**
   * Merge session overrides layer onto base session from plan.js.
   * NEVER mutates plan.js data.
   */
  resolveSessionWithOverrides(baseSession, overrides) {
    if (!baseSession) return null;
    const sessionOverrides = overrides && overrides[baseSession.id];
    if (!sessionOverrides) {
      return {
        ...baseSession,
        exercises: (baseSession.exercises || []).map(ex => ({ ...ex }))
      };
    }

    const hiddenSet = new Set(sessionOverrides.hidden || []);
    const replacedMap = sessionOverrides.replaced || {};
    const editedMap = sessionOverrides.edited || {};
    const addedList = sessionOverrides.added || [];

    // Map and filter base exercises
    let exercises = [];
    (baseSession.exercises || []).forEach(origEx => {
      if (hiddenSet.has(origEx.id)) return; // Skipped / hidden

      let ex = { ...origEx };

      // Apply replacement if exists
      if (replacedMap[origEx.id]) {
        ex = {
          ...ex,
          id: replacedMap[origEx.id].id,
          name: replacedMap[origEx.id].name,
          isReplaced: true,
          originalId: origEx.id
        };
      }

      // Apply field edits if exist
      if (editedMap[ex.id]) {
        const ed = editedMap[ex.id];
        ex = {
          ...ex,
          targetSets: ed.targetSets !== undefined ? Number(ed.targetSets) : ex.targetSets,
          repRange: ed.repRange !== undefined ? ed.repRange : ex.repRange,
          repMin: ed.repMin !== undefined ? Number(ed.repMin) : ex.repMin,
          repMax: ed.repMax !== undefined ? Number(ed.repMax) : ex.repMax,
          restSeconds: ed.restSeconds !== undefined ? Number(ed.restSeconds) : ex.restSeconds,
          restDisplay: ed.restDisplay !== undefined ? ed.restDisplay : ex.restDisplay,
          tip: ed.tip !== undefined ? ed.tip : ex.tip,
          isEdited: true
        };
      }

      exercises.push(ex);
    });

    // Append added custom exercises
    addedList.forEach(addEx => {
      if (!hiddenSet.has(addEx.id)) {
        exercises.push({ ...addEx, isCustomAdded: true });
      }
    });

    // Apply custom order if defined
    if (Array.isArray(sessionOverrides.order) && sessionOverrides.order.length > 0) {
      const orderMap = new Map();
      sessionOverrides.order.forEach((id, idx) => orderMap.set(id, idx));
      exercises.sort((a, b) => {
        const orderA = orderMap.has(a.id) ? orderMap.get(a.id) : 999;
        const orderB = orderMap.has(b.id) ? orderMap.get(b.id) : 999;
        return orderA - orderB;
      });
    }

    return {
      ...baseSession,
      hasOverrides: true,
      exercises
    };
  },

  /**
   * Find previous session logged values for a given exercise ID.
   * Walks logs backwards in chronological order.
   */
  getPreviousExercisePerformance(data, exerciseId) {
    if (!data.logs) return null;
    const logKeys = Object.keys(data.logs).sort().reverse();

    for (const key of logKeys) {
      const sessionLog = data.logs[key];
      if (!sessionLog || !sessionLog.exercises) continue;
      const exLog = sessionLog.exercises[exerciseId];
      if (exLog && Array.isArray(exLog.sets) && exLog.sets.length > 0) {
        const validSets = exLog.sets.filter(s => s && s.done && (s.weight > 0 || s.reps > 0));
        if (validSets.length > 0) {
          // Found most recent session with logged sets
          const firstSet = validSets[0];
          const topWeightSet = [...validSets].sort((a, b) => Number(b.weight) - Number(a.weight))[0];
          return {
            logKey: key,
            date: sessionLog.completedAt || null,
            firstWeight: firstSet.weight,
            firstReps: firstSet.reps,
            topWeight: topWeightSet.weight,
            topReps: topWeightSet.reps,
            sets: validSets,
            display: `${topWeightSet.weight || 0} kg × ${topWeightSet.reps || 0}`
          };
        }
      }
    }
    return null;
  },

  /**
   * Check if exercise is eligible for "Increase next time" hint
   */
  checkProgressHint(data, exercise) {
    if (!exercise || !exercise.id) return false;
    const prev = this.getPreviousExercisePerformance(data, exercise.id);
    if (!prev || !prev.sets) return false;

    // Check if targetSets were done at or above repMax
    const repMax = exercise.repMax || 0;
    if (repMax <= 0) return false;
    const targetSets = exercise.targetSets || 3;

    if (prev.sets.length < targetSets) return false;
    const completedAtTop = prev.sets.slice(0, targetSets).every(s => Number(s.reps) >= repMax && s.done);
    return completedAtTop;
  },

  /**
   * Export all app data as formatted JSON.
   * Downloads as file, records lastBackup, and invokes Web Share API if available.
   */
  async exportData(data) {
    try {
      const now = new Date();
      data.lastBackup = now.toISOString();
      this.save(data);

      const jsonStr = JSON.stringify(data, null, 2);
      const dateStamp = now.toISOString().split('T')[0];
      const filename = `training-backup-${dateStamp}.json`;
      const blob = new Blob([jsonStr], { type: 'application/json' });

      // Check if Web Share API with files is supported (e.g. iPhone Safari)
      let sharedSuccessfully = false;
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.share) {
        try {
          const file = new File([blob], filename, { type: 'application/json' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: 'Training Planner Backup',
              text: `Training Planner backup from ${dateStamp}`,
              files: [file]
            });
            sharedSuccessfully = true;
          }
        } catch (shareErr) {
          // If user cancelled or share failed, fallback to standard download
          console.log('[Storage] Web Share skipped or aborted, falling back to download:', shareErr);
        }
      }

      // Fallback: browser file download
      if (!sharedSuccessfully) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      return { success: true, date: data.lastBackup, filename };
    } catch (err) {
      console.error('[Storage] Export error:', err);
      throw new Error(`Failed to export data: ${err.message}`);
    }
  },

  /**
   * Import data from JSON string.
   * Validates structure, versions, and provides merge vs replace modes.
   */
  importData(currentData, jsonString, mode = 'merge') {
    let imported;
    try {
      imported = JSON.parse(jsonString);
    } catch (parseErr) {
      throw new Error('Invalid JSON format: the file could not be parsed.');
    }

    // Schema validation
    if (!imported || typeof imported !== 'object') {
      throw new Error('Invalid backup file: root must be a valid JSON object.');
    }

    if (!imported.version || typeof imported.version !== 'number') {
      throw new Error('Invalid backup schema: missing or invalid "version" field.');
    }

    if (mode === 'replace') {
      const newData = {
        version: imported.version || 1,
        theme: imported.theme || currentData.theme || 'auto',
        lastBackup: new Date().toISOString(),
        weeks: imported.weeks || {},
        logs: imported.logs || {},
        overrides: imported.overrides || {}
      };
      this.save(newData);
      return newData;
    } else {
      // Merge mode
      const merged = {
        version: Math.max(currentData.version || 1, imported.version || 1),
        theme: imported.theme || currentData.theme || 'auto',
        lastBackup: new Date().toISOString(),
        weeks: { ...(currentData.weeks || {}), ...(imported.weeks || {}) },
        logs: { ...(currentData.logs || {}), ...(imported.logs || {}) },
        overrides: { ...(currentData.overrides || {}), ...(imported.overrides || {}) }
      };

      // Deep merge overrides for each session if both exist
      if (currentData.overrides && imported.overrides) {
        for (const sessionId of Object.keys(imported.overrides)) {
          if (currentData.overrides[sessionId]) {
            merged.overrides[sessionId] = {
              hidden: Array.from(new Set([
                ...(currentData.overrides[sessionId].hidden || []),
                ...(imported.overrides[sessionId].hidden || [])
              ])),
              replaced: {
                ...(currentData.overrides[sessionId].replaced || {}),
                ...(imported.overrides[sessionId].replaced || {})
              },
              edited: {
                ...(currentData.overrides[sessionId].edited || {}),
                ...(imported.overrides[sessionId].edited || {})
              },
              added: [
                ...(currentData.overrides[sessionId].added || []),
                ...(imported.overrides[sessionId].added || []).filter(
                  item => !(currentData.overrides[sessionId].added || []).some(x => x.id === item.id)
                )
              ],
              order: imported.overrides[sessionId].order || currentData.overrides[sessionId].order || []
            };
          }
        }
      }

      this.save(merged);
      return merged;
    }
  },

  /**
   * Check if backup reminder should be shown (>14 days without export, and user has logs)
   */
  shouldShowBackupReminder(data) {
    const hasLogs = data.logs && Object.keys(data.logs).length > 0;
    if (!hasLogs) return false;

    if (!data.lastBackup) return true; // Has logs but never exported!
    try {
      const last = new Date(data.lastBackup).getTime();
      const now = Date.now();
      const daysSince = (now - last) / (1000 * 60 * 60 * 24);
      return daysSince >= 14;
    } catch {
      return true;
    }
  },

  /**
   * Reset all data back to factory defaults
   */
  resetAll() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('[Storage] Clear error:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_STORAGE));
  }
};

// Global export for vanilla scripts and modules
if (typeof window !== 'undefined') {
  window.StorageService = StorageService;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageService;
}
