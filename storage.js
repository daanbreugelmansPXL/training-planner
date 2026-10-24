/**
 * storage.js - Complete Persistence Layer for Training Planner PWA (v2)
 * Local-first architecture with async interface, collection-based storage,
 * and automatic migration from v1. Ready for remote sync adapter.
 */

const STORAGE_V2_KEY = 'training_planner_v2_data';
const STORAGE_V1_KEY = 'training_planner_v1_data';

/**
 * Concise cues (max ~12 words) for the exercise library
 */
const SHORT_EXERCISE_TIPS = {
  'back-squat': 'Brace core firmly, keep chest proud, drive through mid-foot.',
  'bench-press': 'Retract shoulder blades, control bar down to lower chest.',
  'seated-cable-row': 'Pull shoulders back first, row elbows toward your hips.',
  'lat-pulldown': 'Grip outside shoulders, pull elbows down to collarbone.',
  'dumbbell-shoulder-press': 'Angle elbows slightly forward, press overhead without arching.',
  'romanian-deadlift-barbell': 'Hinge hips back with soft knees, feel deep hamstring tension.',
  'suitcase-carry': 'Stand tall with level shoulders, walk slowly resisting sideways tilt.',
  'bulgarian-split-squat': 'Drop back knee straight down, keep front foot grounded.',
  'dumbbell-swing-or-jump-squats': 'Snap hips explosively; absorb landing softly through hips.',
  'conventional-deadlift': 'Bar over mid-foot, brace lats and core, push floor away.',
  'pushups-or-bench-press': 'Keep full rigid plank, lower under control, lock out.',
  'cable-face-pulls': 'Pull toward nose, rotate hands back, squeeze rear delts.',
  'hanging-knee-raises': 'Roll pelvis upward toward ribcage; pause briefly at top.',
  'dumbbell-calf-raises': 'Full stretch at bottom, drive through big toes, pause at top.',
  'flat-dumbbell-bench-press': 'Dumbbells at 45 degrees, descend to deep chest stretch.',
  'one-arm-cable-row': 'Reach forward for lat stretch, row elbow backward to hip.',
  'goblet-squat': 'Keep dumbbell against chest, sink hips deep between feet.',
  'romanian-deadlift-dumbbells': 'Track weights down shins, push hips back into hamstrings.',
  'dumbbell-lateral-raises': 'Lead with elbows in scapular plane, avoid shrugging traps.',
  'superset-curls-triceps': 'Full supination on curls, then overhead extension with elbows tucked.',
  'conditioning-finisher-c': 'Maintain steady output; breathe calmly during recovery intervals.',
  'conditioning-finisher-fb': 'Work at high sustained effort; skip after heavy sparring.',
  'mobility-90-90': 'Sit tall, oscillate knees smoothly from side to side.',
  'mobility-couch-stretch': 'Squeeze glute of back leg to open front hip flexor.',
  'mobility-hamstring-stretch': 'Hinge forward with neutral spine, breathe into hamstring.',
  'mobility-frog-stretch': 'Knees wide on mat, sit back gently into adductors.',
  'mobility-wall-ankle': 'Drive knee forward past toes keeping heel pinned down.',
  'mobility-thoracic-rotations': 'Knees pinned at 90 degrees, sweep top arm wide.',
  'mobility-shoulder-dislocates': 'Keep elbows extended, rotate smoothly overhead and back.',
  'mobility-deep-squat-hold': 'Sit deep, push knees out with elbows, breathe into belly.',
  'mini-breathing': 'Inhale gently for 4s, exhale silently for 6s.',
  'mini-cat-cow': 'Move vertebra by vertebra between flexion and gentle extension.',
  'mini-90-90': 'Rotate both knees from side to side staying seated tall.',
  'mini-ankle': 'Drive knee forward over second toe keeping heel pinned.',
  'mini-hamstring-hip': 'Hold gentle tension without forcing range; breathe deeply.'
};

/**
 * Seed Library and Templates from window.PLAN_DATA
 */
function createSeedData() {
  const plan = (typeof window !== 'undefined' && window.PLAN_DATA) ? window.PLAN_DATA : null;
  const now = new Date().toISOString();

  const library = {};
  const templates = {};

  if (!plan) {
    return {
      version: 2,
      library,
      templates,
      logs: {},
      weeks: {},
      settings: { theme: 'auto', lastBackup: null, updatedAt: now }
    };
  }

  // 1. Build library from all exercises in plan.js
  Object.values(plan.sessions || {}).forEach(sess => {
    (sess.exercises || []).forEach(ex => {
      if (!library[ex.id]) {
        library[ex.id] = {
          id: ex.id,
          name: ex.name,
          tip: SHORT_EXERCISE_TIPS[ex.id] || (ex.tip ? ex.tip.split('.')[0] + '.' : ''),
          defaultSets: ex.targetSets || 3,
          repMin: ex.repMin || 8,
          repMax: ex.repMax || 12,
          repRange: ex.repRange || '8–12',
          restSec: ex.restSeconds || 90,
          lastWeightKg: null,
          pinnedNote: '',
          alternatives: (ex.alternatives || []).map(a => a.id),
          updatedAt: now
        };
      }
      // Also register alternatives in library
      (ex.alternatives || []).forEach(alt => {
        if (!library[alt.id]) {
          library[alt.id] = {
            id: alt.id,
            name: alt.name,
            tip: SHORT_EXERCISE_TIPS[alt.id] || '',
            defaultSets: ex.targetSets || 3,
            repMin: ex.repMin || 8,
            repMax: ex.repMax || 12,
            repRange: ex.repRange || '8–12',
            restSec: ex.restSeconds || 90,
            lastWeightKg: null,
            pinnedNote: '',
            alternatives: [ex.id],
            updatedAt: now
          };
        }
      });
    });
  });

  // 2. Build templates from plan.js sessions
  Object.values(plan.sessions || {}).forEach(sess => {
    const isStrength = sess.type === 'strength';
    const isCardio = sess.type === 'cardio-mobility';

    templates[sess.id] = {
      id: sess.id,
      name: sess.title || sess.id,
      shortTitle: sess.shortTitle || sess.title,
      kind: sess.type,
      durationMin: parseInt(sess.duration, 10) || (sess.type === 'rest' ? 0 : 60),
      durationDisplay: sess.duration || '60 min',
      goal: sess.goal || '',
      when: sess.when || '',
      warmup: (sess.warmup || []).map(text => ({ name: text })),
      main: (sess.exercises || []).map(ex => ({
        exerciseId: ex.id,
        name: ex.name,
        sets: ex.targetSets || 3,
        repMin: ex.repMin || 8,
        repMax: ex.repMax || 12,
        repRange: ex.repRange || '8–12',
        restSec: ex.restSeconds || 90
      })),
      cooldown: (sess.cooldown || []).map(text => ({ name: text })),
      cardio: isCardio ? {
        variant: 'run-7km',
        durationMin: 40,
        distanceKm: 7.5
      } : null,
      updatedAt: now
    };
  });

  return {
    version: 2,
    library,
    templates,
    logs: {},
    weeks: {},
    settings: {
      theme: 'auto',
      lastBackup: null,
      updatedAt: now
    }
  };
}

/**
 * Migration from v1 to v2 schema
 */
function migrateV1toV2(v1Data) {
  const v2 = createSeedData();
  const now = new Date().toISOString();

  if (!v1Data || typeof v1Data !== 'object') return v2;

  // Settings migration
  if (v1Data.theme) v2.settings.theme = v1Data.theme;
  if (v1Data.lastBackup) v2.settings.lastBackup = v1Data.lastBackup;

  // Weeks migration
  if (v1Data.weeks) {
    Object.keys(v1Data.weeks).forEach(isoWeek => {
      const w = v1Data.weeks[isoWeek];
      const planVariant = w.planType === '2-day-fallback' ? '2-day' : '3-day';
      const moves = {};
      if (w.scheduleOverrides) {
        Object.keys(w.scheduleOverrides).forEach(dayIdx => {
          const sessId = w.scheduleOverrides[dayIdx];
          moves[sessId] = Number(dayIdx);
        });
      }
      v2.weeks[isoWeek] = {
        id: isoWeek,
        planVariant,
        moves,
        updatedAt: now
      };
    });
  }

  // Apply v1 overrides into templates/library
  if (v1Data.overrides) {
    Object.keys(v1Data.overrides).forEach(sessId => {
      const template = v2.templates[sessId];
      const ov = v1Data.overrides[sessId];
      if (!template || !ov) return;

      const hidden = new Set(ov.hidden || []);
      const replaced = ov.replaced || {};
      const edited = ov.edited || {};
      const added = ov.added || [];

      // Filter hidden and apply replacements / edits
      template.main = template.main.filter(item => !hidden.has(item.exerciseId)).map(item => {
        let exId = item.exerciseId;
        let name = item.name;

        if (replaced[exId]) {
          const rep = replaced[exId];
          exId = rep.id;
          name = rep.name;
          if (!v2.library[exId]) {
            v2.library[exId] = {
              id: exId,
              name,
              tip: '',
              defaultSets: item.sets,
              repMin: item.repMin,
              repMax: item.repMax,
              repRange: item.repRange,
              restSec: item.restSec,
              lastWeightKg: null,
              pinnedNote: '',
              alternatives: [],
              updatedAt: now
            };
          }
        }

        const ed = edited[exId] || {};
        return {
          exerciseId: exId,
          name,
          sets: ed.targetSets !== undefined ? Number(ed.targetSets) : item.sets,
          repMin: ed.repMin !== undefined ? Number(ed.repMin) : item.repMin,
          repMax: ed.repMax !== undefined ? Number(ed.repMax) : item.repMax,
          repRange: ed.repRange || item.repRange,
          restSec: ed.restSeconds !== undefined ? Number(ed.restSeconds) : item.restSec
        };
      });

      // Add custom additions
      added.forEach(addEx => {
        if (!v2.library[addEx.id]) {
          v2.library[addEx.id] = {
            id: addEx.id,
            name: addEx.name,
            tip: addEx.tip || '',
            defaultSets: addEx.targetSets || 3,
            repMin: addEx.repMin || 8,
            repMax: addEx.repMax || 12,
            repRange: addEx.repRange || '8–12',
            restSec: addEx.restSeconds || 90,
            lastWeightKg: null,
            pinnedNote: '',
            alternatives: [],
            updatedAt: now
          };
        }
        template.main.push({
          exerciseId: addEx.id,
          name: addEx.name,
          sets: addEx.targetSets || 3,
          repMin: addEx.repMin || 8,
          repMax: addEx.repMax || 12,
          repRange: addEx.repRange || '8–12',
          restSec: addEx.restSeconds || 90
        });
      });

      // Custom order
      if (Array.isArray(ov.order) && ov.order.length > 0) {
        const orderMap = new Map();
        ov.order.forEach((id, idx) => orderMap.set(id, idx));
        template.main.sort((a, b) => {
          const ordA = orderMap.has(a.exerciseId) ? orderMap.get(a.exerciseId) : 999;
          const ordB = orderMap.has(b.exerciseId) ? orderMap.get(b.exerciseId) : 999;
          return ordA - ordB;
        });
      }
    });
  }

  // Logs migration
  if (v1Data.logs) {
    Object.keys(v1Data.logs).forEach(logKey => {
      const oldLog = v1Data.logs[logKey];
      if (!oldLog) return;

      const parts = logKey.split('_');
      const isoWeek = oldLog.isoWeek || (parts.length >= 1 ? parts[0] : '');
      const dayIndex = oldLog.dayIndex !== undefined ? Number(oldLog.dayIndex) : (parts.length >= 2 ? Number(parts[1]) : 0);
      const sessionId = oldLog.sessionId || (parts.length >= 3 ? parts[2] : 'strength-a');

      const exercises = [];
      if (oldLog.exercises) {
        Object.keys(oldLog.exercises).forEach(exId => {
          const exData = oldLog.exercises[exId];
          const sets = (exData.sets || []).map(s => ({
            kg: s.weight !== undefined && s.weight !== '' ? Number(s.weight) : null,
            reps: s.reps !== undefined && s.reps !== '' ? Number(s.reps) : null,
            done: !!s.done
          }));

          // Top / first weight for library lastWeightKg
          const firstKgSet = sets.find(s => s.kg !== null && s.kg > 0);
          if (firstKgSet && v2.library[exId]) {
            v2.library[exId].lastWeightKg = firstKgSet.kg;
          }

          exercises.push({
            exerciseId: exId,
            name: exData.swappedWith ? exData.swappedWith.name : (v2.library[exId]?.name || exId),
            weightKg: firstKgSet ? firstKgSet.kg : null,
            sets,
            note: ''
          });
        });
      }

      v2.logs[logKey] = {
        id: logKey,
        date: oldLog.completedAt || null,
        isoWeek,
        dayIndex,
        sessionId,
        completed: !!oldLog.completed,
        completedAt: oldLog.completedAt || null,
        templateSnapshot: null,
        exercises,
        sessionNote: oldLog.notes || '',
        rpe: oldLog.rpe || null,
        feeling: oldLog.feeling || null,
        sleepHours: oldLog.sleepHours || null,
        duration: oldLog.duration || null,
        distance: oldLog.distance || null,
        avgHr: oldLog.avgHr || null,
        variant: oldLog.variant || null,
        warmupDone: oldLog.warmup || [],
        cooldownDone: oldLog.cooldown || [],
        miniMobilityDone: oldLog.miniMobility || [],
        updatedAt: now
      };
    });
  }

  return v2;
}

/**
 * Quick Add Line Parser:
 * E.g.: "Bench press 3x6-10 2min" -> { name: "Bench press", sets: 3, repMin: 6, repMax: 10, restSec: 120 }
 */
function parseQuickAddString(rawText, library = {}) {
  let text = (rawText || '').trim();
  if (!text) return null;

  let restSec = null;
  let sets = null;
  let repMin = null;
  let repMax = null;

  // 1. Match rest time: "2min", "2:00", "90s", "90 sec"
  const restMinMatch = text.match(/(\d+)\s*min(?:ute)?s?/i);
  if (restMinMatch) {
    restSec = parseInt(restMinMatch[1], 10) * 60;
    text = text.replace(restMinMatch[0], '');
  } else {
    const colonMatch = text.match(/(\d+):(\d{2})/);
    if (colonMatch) {
      restSec = parseInt(colonMatch[1], 10) * 60 + parseInt(colonMatch[2], 10);
      text = text.replace(colonMatch[0], '');
    } else {
      const secMatch = text.match(/(\d+)\s*s(?:ec)?(?:onds?)?/i);
      if (secMatch) {
        restSec = parseInt(secMatch[1], 10);
        text = text.replace(secMatch[0], '');
      }
    }
  }

  // 2. Match sets × reps: "3x6-10", "3 x 8", "4*5", "3×10–12"
  const setsRepsMatch = text.match(/(\d+)\s*[xX*×]\s*(\d+)(?:\s*[-–—]\s*(\d+))?/);
  if (setsRepsMatch) {
    sets = parseInt(setsRepsMatch[1], 10);
    repMin = parseInt(setsRepsMatch[2], 10);
    repMax = setsRepsMatch[3] ? parseInt(setsRepsMatch[3], 10) : repMin;
    text = text.replace(setsRepsMatch[0], '');
  }

  // Clean exercise name
  let name = text.replace(/\s+/g, ' ').replace(/^[-•,]+|[-•,]+$/g, '').trim();
  if (!name) name = 'Custom Exercise';

  // Check if exercise exists in library
  const nameLower = name.toLowerCase();
  const existingKey = Object.keys(library).find(k => library[k].name && library[k].name.toLowerCase() === nameLower);
  const existing = existingKey ? library[existingKey] : null;

  const exerciseId = existing ? existing.id : 'custom-' + nameLower.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const finalSets = sets || (existing ? existing.defaultSets : 3);
  const finalRepMin = repMin || (existing ? existing.repMin : 8);
  const finalRepMax = repMax || (existing ? existing.repMax : 12);
  const finalRestSec = restSec !== null ? restSec : (existing ? existing.restSec : 90);

  return {
    exerciseId,
    name: existing ? existing.name : name,
    sets: finalSets,
    repMin: finalRepMin,
    repMax: finalRepMax,
    repRange: finalRepMin === finalRepMax ? `${finalRepMin}` : `${finalRepMin}–${finalRepMax}`,
    restSec: finalRestSec
  };
}

/**
 * Storage Service with clean Async Interface
 */
const StorageService = {
  _cache: null,

  async requestPersist() {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
        return await navigator.storage.persist();
      }
    } catch (e) {
      console.warn('[Storage] Persistence request failed:', e);
    }
    return false;
  },

  /**
   * Load state from localStorage. Handles v1 -> v2 migration.
   */
  async getState() {
    if (this._cache) return this._cache;

    if (typeof window === 'undefined' || !window.localStorage) {
      this._cache = createSeedData();
      return this._cache;
    }

    try {
      const v2Raw = localStorage.getItem(STORAGE_V2_KEY);
      if (v2Raw) {
        const parsed = JSON.parse(v2Raw);
        if (parsed && parsed.version === 2) {
          this._cache = parsed;
          return this._cache;
        }
      }

      // Check if v1 exists for migration
      const v1Raw = localStorage.getItem(STORAGE_V1_KEY);
      if (v1Raw) {
        console.log('[Storage] Migrating from v1 schema to v2...');
        const v1Parsed = JSON.parse(v1Raw);
        const migrated = migrateV1toV2(v1Parsed);
        this._cache = migrated;
        await this.saveState(migrated);
        return this._cache;
      }

      // Fresh seed
      const seeded = createSeedData();
      this._cache = seeded;
      await this.saveState(seeded);
      return this._cache;
    } catch (err) {
      console.error('[Storage] Error loading data, returning seed:', err);
      this._cache = createSeedData();
      return this._cache;
    }
  },

  /**
   * Synchronous load for immediate startup render
   */
  getStateSync() {
    if (this._cache) return this._cache;

    try {
      const v2Raw = localStorage.getItem(STORAGE_V2_KEY);
      if (v2Raw) {
        const parsed = JSON.parse(v2Raw);
        if (parsed && parsed.version === 2) {
          this._cache = parsed;
          return this._cache;
        }
      }
      const v1Raw = localStorage.getItem(STORAGE_V1_KEY);
      if (v1Raw) {
        const v1Parsed = JSON.parse(v1Raw);
        const migrated = migrateV1toV2(v1Parsed);
        this._cache = migrated;
        localStorage.setItem(STORAGE_V2_KEY, JSON.stringify(migrated));
        return this._cache;
      }
    } catch (e) {
      console.warn('[Storage] Sync load error:', e);
    }

    this._cache = createSeedData();
    return this._cache;
  },

  /**
   * Save complete state
   */
  async saveState(state) {
    this._cache = state;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_V2_KEY, JSON.stringify(state));
      }
      return true;
    } catch (err) {
      console.error('[Storage] Save error:', err);
      return false;
    }
  },

  /**
   * Upsert a record into a collection
   */
  async upsert(collection, record) {
    const state = await this.getState();
    if (!state[collection]) state[collection] = {};
    record.updatedAt = new Date().toISOString();
    state[collection][record.id] = record;
    await this.saveState(state);
    return record;
  },

  /**
   * Soft-delete a record from a collection
   */
  async remove(collection, id) {
    const state = await this.getState();
    if (state[collection] && state[collection][id]) {
      state[collection][id].deletedAt = new Date().toISOString();
      await this.saveState(state);
      return true;
    }
    return false;
  },

  /**
   * Hard reset a template to default plan.js
   */
  async resetTemplate(sessionId) {
    const state = await this.getState();
    const seed = createSeedData();
    if (seed.templates[sessionId]) {
      state.templates[sessionId] = JSON.parse(JSON.stringify(seed.templates[sessionId]));
      await this.saveState(state);
      return state.templates[sessionId];
    }
    return null;
  },

  /**
   * Hard reset all templates to default
   */
  async resetAllTemplates() {
    const state = await this.getState();
    const seed = createSeedData();
    state.templates = JSON.parse(JSON.stringify(seed.templates));
    await this.saveState(state);
    return state.templates;
  },

  /**
   * Reset all data (factory reset)
   */
  async resetAll() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(STORAGE_V2_KEY);
      }
    } catch (e) {
      console.warn('[Storage] Reset error:', e);
    }
    this._cache = createSeedData();
    await this.saveState(this._cache);
    return this._cache;
  },

  /**
   * Export all app collections as JSON
   */
  async exportData() {
    const state = await this.getState();
    const now = new Date();
    state.settings.lastBackup = now.toISOString();
    await this.saveState(state);

    const jsonStr = JSON.stringify(state, null, 2);
    const dateStamp = now.toISOString().split('T')[0];
    const filename = `training-backup-${dateStamp}.json`;
    const blob = new Blob([jsonStr], { type: 'application/json' });

    let shared = false;
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.share) {
      try {
        const file = new File([blob], filename, { type: 'application/json' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Training Planner Backup',
            text: `Backup ${dateStamp}`,
            files: [file]
          });
          shared = true;
        }
      } catch (e) {
        // Fallback to download
      }
    }

    if (!shared) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return { success: true, date: state.settings.lastBackup, filename };
  },

  /**
   * Import data from JSON string (Merge or Replace)
   */
  async importData(jsonString, mode = 'merge') {
    let imported;
    try {
      imported = JSON.parse(jsonString);
    } catch (e) {
      throw new Error('Invalid JSON file format.');
    }

    if (!imported || typeof imported !== 'object') {
      throw new Error('Invalid backup file: not a JSON object.');
    }

    // Support importing v1 or v2 format
    let validV2Data;
    if (imported.version === 1) {
      validV2Data = migrateV1toV2(imported);
    } else if (imported.version === 2) {
      validV2Data = imported;
    } else {
      throw new Error('Unsupported backup schema version.');
    }

    const current = await this.getState();
    const now = new Date().toISOString();

    if (mode === 'replace') {
      validV2Data.settings.lastBackup = now;
      await this.saveState(validV2Data);
      return validV2Data;
    } else {
      // Merge
      const merged = {
        version: 2,
        library: { ...current.library, ...(validV2Data.library || {}) },
        templates: { ...current.templates, ...(validV2Data.templates || {}) },
        logs: { ...current.logs, ...(validV2Data.logs || {}) },
        weeks: { ...current.weeks, ...(validV2Data.weeks || {}) },
        settings: {
          theme: validV2Data.settings?.theme || current.settings?.theme || 'auto',
          lastBackup: now,
          updatedAt: now
        }
      };
      await this.saveState(merged);
      return merged;
    }
  },

  /**
   * Backup reminder check: > 14 days without export and has logs
   */
  shouldShowBackupReminder(state) {
    const hasLogs = state.logs && Object.keys(state.logs).length > 0;
    if (!hasLogs) return false;
    if (!state.settings?.lastBackup) return true;

    try {
      const last = new Date(state.settings.lastBackup).getTime();
      const diffDays = (Date.now() - last) / (1000 * 60 * 60 * 24);
      return diffDays >= 14;
    } catch {
      return true;
    }
  },

  /**
   * Parser exposed on storage service
   */
  parseQuickAdd(rawText, library) {
    return parseQuickAddString(rawText, library);
  }
};

// Global export for vanilla browser scripts and modules
if (typeof window !== 'undefined') {
  window.StorageService = StorageService;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageService;
}
