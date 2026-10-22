/**
 * Personal Training Planner - Plan Data & Scheduling Rules
 * All plan content is defined here as plain structured JS data.
 * No content is hardcoded anywhere else in the application.
 */

const PLAN_DATA = {
  version: 1,

  // Session type definitions with badges, colors and icons
  sessionTypes: {
    'muay-thai': {
      label: 'Muay Thai',
      color: '#ef4444',
      bgLight: 'rgba(239, 68, 68, 0.15)',
      icon: '🥊'
    },
    'strength': {
      label: 'Strength',
      color: '#3b82f6',
      bgLight: 'rgba(59, 130, 246, 0.15)',
      icon: '🏋️'
    },
    'cardio-mobility': {
      label: 'Cardio / Mobility',
      color: '#10b981',
      bgLight: 'rgba(16, 185, 129, 0.15)',
      icon: '🏃'
    },
    'rest': {
      label: 'Rest & Recovery',
      color: '#8b5cf6',
      bgLight: 'rgba(139, 92, 246, 0.15)',
      icon: '💤'
    }
  },

  // Weekly plan structures (Monday = index 0 ... Sunday = index 6)
  weeklyPlans: {
    '3-day-plan': {
      id: '3-day-plan',
      name: '3-Day Strength Plan',
      description: 'Standard week: 3 strength days, 2 Muay Thai club sessions, 1 aerobic base & mobility, 1 rest day.',
      schedule: [
        'muay-thai-1',          // Mon
        'strength-a',           // Tue
        'muay-thai-2',          // Wed
        'strength-b',           // Thu
        'rest',                 // Fri
        'strength-c',           // Sat
        'aerobic-base-mobility' // Sun
      ]
    },
    '2-day-fallback': {
      id: '2-day-fallback',
      name: '2-Day Fallback Plan',
      description: 'Low-friction week for exams, busy periods, heavy Muay Thai soreness, or when 2 strength days were missed.',
      schedule: [
        'muay-thai-1',          // Mon
        'rest',                 // Tue
        'muay-thai-2',          // Wed
        'fb-strength-1',        // Thu
        'rest',                 // Fri
        'fb-strength-2',        // Sat
        'aerobic-base-mobility' // Sun
      ]
    }
  },

  // Detailed session configurations
  sessions: {
    'muay-thai-1': {
      id: 'muay-thai-1',
      type: 'muay-thai',
      title: 'Muay Thai 1 (20:00–21:30, club)',
      shortTitle: 'Muay Thai 1',
      goal: 'Club technical training, pad work, clinching, conditioning, and situational sparring.',
      duration: '90 min',
      when: 'Monday evening (20:00–21:30) at the club.',
      isClubSession: true,
      notes: 'External club session. Counts toward total weekly systemic load. Avoid heavy leg loading right before or after this session.',
      exercises: []
    },

    'muay-thai-2': {
      id: 'muay-thai-2',
      type: 'muay-thai',
      title: 'Muay Thai 2 (20:00–21:30, club)',
      shortTitle: 'Muay Thai 2',
      goal: 'Club technical drills, heavy bag/pad rounds, defense, fight conditioning.',
      duration: '90 min',
      when: 'Wednesday evening (20:00–21:30) at the club.',
      isClubSession: true,
      notes: 'External club session. Prioritize recovery and nutrition after sparring.',
      exercises: []
    },

    'strength-a': {
      id: 'strength-a',
      type: 'strength',
      title: 'Strength A — Upper body strength',
      shortTitle: 'Strength A (Upper)',
      goal: 'General upper body strength, chest, back, shoulders, and solid athletic base.',
      duration: '60–75 min',
      when: 'Day after Muay Thai 1, before Muay Thai 2.',
      warmup: [
        '3 min cross trainer, home trainer, or brisk walk',
        '10 reps World\'s Greatest Stretch per side',
        '10 bodyweight squats',
        '10 band pull-aparts or light cable face pulls',
        '8 light push-ups or light bench reps',
        '2 build-up sets of Barbell back squat'
      ],
      cooldown: [
        '2 min easy bike or walk',
        'Couch stretch (45 s per side)',
        'Doorway chest stretch (45 s)',
        'Lat stretch (45 s per side)',
        '1 min calm nasal diaphragmatic breathing'
      ],
      exercises: [
        {
          id: 'back-squat',
          name: 'Barbell back squat',
          targetSets: 3,
          repRange: '5–8',
          repMin: 5,
          repMax: 8,
          restSeconds: 180,
          restDisplay: '2–3 min',
          tip: 'Brace core firmly before descent, keep chest proud, and drive the floor away through your mid-foot.',
          alternatives: [
            { id: 'dumbbell-front-squat', name: 'Dumbbell front squat' },
            { id: 'goblet-squat', name: 'Goblet squat' }
          ]
        },
        {
          id: 'bench-press',
          name: 'Barbell or dumbbell bench press',
          targetSets: 3,
          repRange: '6–10',
          repMin: 6,
          repMax: 10,
          restSeconds: 180,
          restDisplay: '2–3 min',
          tip: 'Retract and depress shoulder blades, maintain a stable arch, and control the bar down to your lower chest.',
          alternatives: [
            { id: 'push-ups', name: 'Push-ups' },
            { id: 'dumbbell-floor-press', name: 'Dumbbell floor press' }
          ]
        },
        {
          id: 'seated-cable-row',
          name: 'Seated cable row',
          targetSets: 3,
          repRange: '8–12',
          repMin: 8,
          repMax: 12,
          restSeconds: 90,
          restDisplay: '90 s',
          tip: 'Set your shoulders down and back first, then row elbows toward your hips without torso rocking.',
          alternatives: [
            { id: 'one-arm-dumbbell-row', name: 'One-arm dumbbell row' },
            { id: 'bent-over-dumbbell-row', name: 'Bent-over dumbbell row' }
          ]
        },
        {
          id: 'lat-pulldown',
          name: 'Lat pulldown',
          targetSets: 3,
          repRange: '8–12',
          repMin: 8,
          repMax: 12,
          restSeconds: 90,
          restDisplay: '90 s',
          tip: 'Grip slightly wider than shoulders, pull elbows down toward your back pockets, and squeeze at the collarbone.',
          alternatives: [
            { id: 'straight-arm-pulldown', name: 'Straight-arm pulldown' },
            { id: 'dumbbell-pullover', name: 'Dumbbell pullover' }
          ]
        },
        {
          id: 'dumbbell-shoulder-press',
          name: 'Dumbbell shoulder press',
          targetSets: 3,
          repRange: '8–12',
          repMin: 8,
          repMax: 12,
          restSeconds: 90,
          restDisplay: '90 s',
          tip: 'Angle elbows slightly forward (~30° in scapular plane) and press overhead without overarching lower back.',
          alternatives: [
            { id: 'arnold-press', name: 'Arnold press' },
            { id: 'seated-dumbbell-press', name: 'Seated dumbbell press' }
          ]
        },
        {
          id: 'romanian-deadlift-barbell',
          name: 'Romanian deadlift with barbell',
          targetSets: 3,
          repRange: '8–12',
          repMin: 8,
          repMax: 12,
          restSeconds: 120,
          restDisplay: '2 min',
          tip: 'Hinge hips backwards with soft knees, feel deep hamstring loading, and keep barbell skimming your legs.',
          alternatives: [
            { id: 'romanian-deadlift-dumbbells', name: 'RDL with dumbbells' },
            { id: 'hip-thrust', name: 'Hip thrust' }
          ]
        },
        {
          id: 'suitcase-carry',
          name: 'Suitcase carry with dumbbell',
          targetSets: 3,
          repRange: '20–40 steps/side',
          repMin: 20,
          repMax: 40,
          restSeconds: 90,
          restDisplay: '60–90 s',
          tip: 'Hold one heavy dumbbell, stand tall with square shoulders, and walk deliberately resisting any sideways tilt.',
          alternatives: [
            { id: 'side-plate-hold', name: 'Side plank' },
            { id: 'bird-dog', name: 'Bird dog' }
          ]
        }
      ]
    },

    'strength-b': {
      id: 'strength-b',
      type: 'strength',
      title: 'Strength B — Legs, power and posterior chain',
      shortTitle: 'Strength B (Legs & Power)',
      goal: 'Strong legs, explosive hip extension, grip, balance, and kicking/clinch power.',
      duration: '60–75 min',
      when: 'After Muay Thai 2, followed by a rest day before Strength C.',
      warmup: [
        '3 min bike, cross trainer, or brisk walk',
        '10 reps World\'s Greatest Stretch per side',
        '10 bodyweight squats',
        '10 walking lunges (no weight)',
        '5 light dumbbell Romanian deadlifts',
        '2 build-up sets of Bulgarian split squat'
      ],
      cooldown: [
        '2 min easy bike or walk',
        'Hamstring stretch (45 s per side)',
        'Figure-four glute stretch (45 s per side)',
        'Wall ankle mobility drill (30 s per side)',
        '1 min calm nasal breathing'
      ],
      exercises: [
        {
          id: 'bulgarian-split-squat',
          name: 'Bulgarian split squat with dumbbells',
          targetSets: 3,
          repRange: '6–10 / leg',
          repMin: 6,
          repMax: 10,
          restSeconds: 120,
          restDisplay: '2 min',
          tip: 'Elevate back foot on bench, descend straight down until back knee hovers above floor, keep front foot grounded.',
          alternatives: [
            { id: 'reverse-lunges', name: 'Reverse lunges' },
            { id: 'step-ups', name: 'Step-ups' }
          ]
        },
        {
          id: 'dumbbell-swing-or-jump-squats',
          name: 'Dumbbell swing (indoor) / Dumbbell jump squats (outdoor)',
          targetSets: 4,
          repRange: '5–8 indoor / 3–5 outdoor',
          repMin: 5,
          repMax: 8,
          restSeconds: 120,
          restDisplay: '90–120 s',
          tip: 'Snap hips explosively to generate float. If doing jump squats outdoors, absorb landing softly through hips.',
          alternatives: [
            { id: 'explosive-split-squat', name: 'Explosive split squat with knee drive' },
            { id: 'fast-concentric-goblet-squat', name: 'Fast-concentric goblet squat' }
          ]
        },
        {
          id: 'conventional-deadlift',
          name: 'Conventional deadlift with barbell',
          targetSets: 3,
          repRange: '5–8',
          repMin: 5,
          repMax: 8,
          restSeconds: 180,
          restDisplay: '2–3 min',
          tip: 'Set bar over mid-foot, brace lats and core tight, push the floor away before pulling hips forward.',
          alternatives: [
            { id: 'trap-bar-deadlift', name: 'Trap bar deadlift' },
            { id: 'romanian-deadlift-barbell', name: 'Barbell Romanian deadlift' }
          ]
        },
        {
          id: 'pushups-or-bench-press',
          name: 'Push-ups or dumbbell bench press',
          targetSets: 3,
          repRange: '8–15',
          repMin: 8,
          repMax: 15,
          restSeconds: 90,
          restDisplay: '90 s',
          tip: 'Maintain a rigid plank or stable arch, move through full range of motion, and finish strong at lockout.',
          alternatives: [
            { id: 'incline-push-ups', name: 'Incline push-ups' },
            { id: 'dumbbell-floor-press', name: 'Dumbbell floor press' }
          ]
        },
        {
          id: 'cable-face-pulls',
          name: 'Cable face pulls from upper pulley',
          targetSets: 3,
          repRange: '12–20',
          repMin: 12,
          repMax: 20,
          restSeconds: 90,
          restDisplay: '60–90 s',
          tip: 'Pull rope toward nose while externally rotating hands back and up, squeezing the rear deltoids and rotators.',
          alternatives: [
            { id: 'band-pull-aparts', name: 'Band pull-aparts' },
            { id: 'dumbbell-reverse-flyes', name: 'Dumbbell reverse flyes' }
          ]
        },
        {
          id: 'hanging-knee-raises',
          name: 'Hanging knee raises',
          targetSets: 3,
          repRange: '8–15',
          repMin: 8,
          repMax: 15,
          restSeconds: 90,
          restDisplay: '60–90 s',
          tip: 'Initiate by rolling pelvis upward toward ribcage rather than just swinging legs; hold top for a split second.',
          alternatives: [
            { id: 'lying-leg-raises', name: 'Lying leg raises' },
            { id: 'dead-bugs', name: 'Dead bugs' }
          ]
        },
        {
          id: 'dumbbell-calf-raises',
          name: 'Dumbbell calf raises',
          targetSets: 3,
          repRange: '12–20',
          repMin: 12,
          repMax: 20,
          restSeconds: 60,
          restDisplay: '60 s',
          tip: 'Full stretch at bottom, push up on big toes for full peak contraction, pause for 1 second at top.',
          alternatives: [
            { id: 'single-leg-calf-raises', name: 'Single-leg calf raises' },
            { id: 'calf-raises-raised-surface', name: 'Calf raises on a raised surface' }
          ]
        }
      ]
    },

    'rest': {
      id: 'rest',
      type: 'rest',
      title: 'Rest / recovery',
      shortTitle: 'Rest Day',
      goal: 'Deep muscle and central nervous system recovery, replenishment, and tissue rebuilding.',
      duration: 'All day',
      when: 'Take it easy. Prioritize 8+ hours sleep and good nutrition.',
      notes: 'No structured lifting today. Enjoy a light 20–30 minute walk or the optional 10-minute mini mobility module.',
      exercises: []
    },

    'strength-c': {
      id: 'strength-c',
      type: 'strength',
      title: 'Strength C — Full body hypertrophy + conditioning',
      shortTitle: 'Strength C (Full Body)',
      goal: 'Extra muscle growth (chest, back, shoulders, arms) plus glycolytic conditioning.',
      duration: '60–75 min (without intervals) / ~90 min (with bag intervals)',
      when: 'After a rest day, preferably before the aerobic-base day.',
      hasConditioningWarning: true,
      warmup: [
        '3 min cross trainer or home trainer',
        '10 reps World\'s Greatest Stretch per side',
        '10 bodyweight squats',
        '10 light push-ups',
        '10 light cable rows',
        '2 build-up sets of flat dumbbell bench press'
      ],
      cooldown: [
        '2 min very easy bike or walk',
        'Hip flexor stretch (45 s per side)',
        'Chest stretch against doorway (45 s)',
        'Biceps and triceps stretch (30 s per side)',
        '1 min calm breathing'
      ],
      exercises: [
        {
          id: 'flat-dumbbell-bench-press',
          name: 'Flat dumbbell bench press',
          targetSets: 3,
          repRange: '8–12',
          repMin: 8,
          repMax: 12,
          restSeconds: 120,
          restDisplay: '2 min',
          tip: 'Hold dumbbells at a slight 45° angle, lower smoothly until deep chest stretch, press up and converge slightly.',
          alternatives: [
            { id: 'push-ups', name: 'Push-ups' },
            { id: 'bench-press', name: 'Barbell bench press' }
          ]
        },
        {
          id: 'one-arm-cable-row',
          name: 'One-arm cable row',
          targetSets: 3,
          repRange: '10–12 / side',
          repMin: 10,
          repMax: 12,
          restSeconds: 90,
          restDisplay: '90 s',
          tip: 'Stabilize in split stance, reach forward for full lat stretch, row elbow backward tight to ribcage.',
          alternatives: [
            { id: 'seated-cable-row', name: 'Seated cable row' },
            { id: 'one-arm-dumbbell-row', name: 'One-arm dumbbell row' }
          ]
        },
        {
          id: 'goblet-squat',
          name: 'Goblet squat with dumbbell',
          targetSets: 3,
          repRange: '10–15',
          repMin: 10,
          repMax: 15,
          restSeconds: 90,
          restDisplay: '90 s',
          tip: 'Hold dumbbell vertically against upper sternum, sink hips deep between feet with an upright spine.',
          alternatives: [
            { id: 'dumbbell-front-squat', name: 'Dumbbell front squat' },
            { id: 'tempo-bodyweight-squat', name: 'Tempo bodyweight squat' }
          ]
        },
        {
          id: 'romanian-deadlift-dumbbells',
          name: 'Romanian deadlift with dumbbells',
          targetSets: 3,
          repRange: '10–12',
          repMin: 10,
          repMax: 12,
          restSeconds: 90,
          restDisplay: '90 s',
          tip: 'Keep weights brushing down shins, push hips back until glutes and hamstrings reach full loaded stretch.',
          alternatives: [
            { id: 'single-leg-rdl', name: 'Single-leg RDL' },
            { id: 'cable-hip-hinge', name: 'Cable hip hinge' }
          ]
        },
        {
          id: 'dumbbell-lateral-raises',
          name: 'Dumbbell lateral raises',
          targetSets: 3,
          repRange: '12–20',
          repMin: 12,
          repMax: 20,
          restSeconds: 60,
          restDisplay: '60 s',
          tip: 'Lean forward 5 degrees, lead with elbows up and out in scapular plane, avoid shrugging traps.',
          alternatives: [
            { id: 'cable-lateral-raises', name: 'Cable lateral raises' },
            { id: 'dumbbell-upright-rows', name: 'Light dumbbell upright rows' }
          ]
        },
        {
          id: 'superset-curls-triceps',
          name: 'Superset: Dumbbell curls + Overhead triceps extension',
          targetSets: 3,
          repRange: '10–15 each',
          repMin: 10,
          repMax: 15,
          restSeconds: 90,
          restDisplay: '60–90 s (after superset)',
          tip: 'Perform curls to full supination, then immediately overhead extension with elbows tucked. Rest only after both.',
          alternatives: [
            { id: 'superset-hammer-pushdowns', name: 'Hammer curls + cable pushdowns' }
          ]
        },
        {
          id: 'conditioning-finisher-c',
          name: 'Conditioning finisher (choose one)',
          targetSets: 1,
          repRange: 'Finisher protocol',
          repMin: 1,
          repMax: 8,
          restSeconds: 90,
          restDisplay: '90 s',
          tip: 'Options: Heavy home-trainer intervals 8 × (30 s hard + 90 s easy) OR Bag intervals 6 × (2 min work + 1 min rest) OR Cross trainer.',
          alternatives: [
            { id: 'home-trainer-intervals', name: 'Heavy bike: 8 × 30 s hard + 90 s easy' },
            { id: 'bag-intervals-finisher', name: 'Bag intervals: 6 × 2 min work + 1 min rest' },
            { id: 'cross-trainer-intervals', name: 'Cross trainer: 8 × 30 s hard + 90 s easy' }
          ]
        }
      ]
    },

    'aerobic-base-mobility': {
      id: 'aerobic-base-mobility',
      type: 'cardio-mobility',
      title: 'Aerobic base + mobility',
      shortTitle: 'Aerobic Base & Mobility',
      goal: 'Oxidative conditioning, systemic flush, flexibility, and hip/shoulder mobility.',
      duration: '50–65 min',
      when: 'After Strength C, preferably the day before Muay Thai 1.',
      isCardioMobilitySession: true,
      notes: 'No short version for aerobic base: if tight on time, reschedule or skip this week rather than rushing.',
      cardioOptions: [
        {
          id: 'run-7km',
          name: 'Outdoor Run: 7.5 km in ~40 min in one go (steady conversational pace)'
        },
        {
          id: 'cross-trainer-indoor',
          name: 'Indoors: 35–45 min cross trainer or home trainer at conversational pace'
        },
        {
          id: 'bag-intervals-variant',
          name: 'Optional interval variant (max 1×/week, REPLACES steady aerobic): ~30 min Bag intervals (5 min shadow warm-up + 6 rounds of [2 min bag @ 80% + 1 min rest] + 5 min shadow cool-down)'
        }
      ],
      exercises: [
        {
          id: 'mobility-90-90',
          name: '90/90 hip rotations',
          targetSets: 1,
          repRange: '2 min',
          repMin: 1,
          repMax: 2,
          restSeconds: 30,
          restDisplay: '30 s',
          tip: 'Sit tall on floor, smoothly oscillate knees from side to side feeling internal and external hip rotation.',
          alternatives: [
            { id: 'wgs-mobility', name: 'World\'s greatest stretch' },
            { id: 'hip-circles', name: 'Hip circles' }
          ]
        },
        {
          id: 'mobility-couch-stretch',
          name: 'Couch stretch or half-kneeling hip flexor stretch',
          targetSets: 1,
          repRange: '2 min / side',
          repMin: 1,
          repMax: 2,
          restSeconds: 30,
          restDisplay: '30 s',
          tip: 'Squeeze glute of trailing leg to posteriorly tilt pelvis, opening up the deep hip flexor and psoas.',
          alternatives: [
            { id: 'half-kneeling-stretch', name: 'Half-kneeling hip flexor stretch' },
            { id: 'lunge-stretch', name: 'Lunge stretch' }
          ]
        },
        {
          id: 'mobility-hamstring-stretch',
          name: 'Hamstring stretch',
          targetSets: 1,
          repRange: '2 min / side',
          repMin: 1,
          repMax: 2,
          restSeconds: 30,
          restDisplay: '30 s',
          tip: 'Hinge forward with neutral spine rather than rounding your upper back; breathe deeply into hamstring belly.',
          alternatives: [
            { id: 'band-hamstring-stretch', name: 'Band hamstring stretch' },
            { id: 'standing-forward-fold', name: 'Standing forward fold with bent knees' }
          ]
        },
        {
          id: 'mobility-frog-stretch',
          name: 'Frog stretch or adductor stretch',
          targetSets: 1,
          repRange: '2 min',
          repMin: 1,
          repMax: 2,
          restSeconds: 30,
          restDisplay: '30 s',
          tip: 'Place knees wide on padded mat, feet turned out, sit back gently into adductors without lower back arching.',
          alternatives: [
            { id: 'butterfly-stretch', name: 'Butterfly stretch' },
            { id: 'lateral-lunge-hold', name: 'Lateral lunge hold' }
          ]
        },
        {
          id: 'mobility-wall-ankle',
          name: 'Wall ankle mobility drill',
          targetSets: 1,
          repRange: '1 min / side',
          repMin: 1,
          repMax: 1,
          restSeconds: 30,
          restDisplay: '30 s',
          tip: 'Drive knee forward past toes while keeping heel firmly glued to floor, tracking over second toe.',
          alternatives: [
            { id: 'knee-to-wall', name: 'Knee-to-wall drill' },
            { id: 'calf-stretch-stair', name: 'Calf stretch on a stair' }
          ]
        },
        {
          id: 'mobility-thoracic-rotations',
          name: 'Thoracic rotations / open book',
          targetSets: 1,
          repRange: '2 min',
          repMin: 1,
          repMax: 2,
          restSeconds: 30,
          restDisplay: '30 s',
          tip: 'Side-lying with knees pinned together at 90°, sweep top arm open like a book, gazing at hand.',
          alternatives: [
            { id: 'cat-cow', name: 'Cat-cow' },
            { id: 'thread-needle', name: 'Thread the needle' }
          ]
        },
        {
          id: 'mobility-shoulder-dislocates',
          name: 'Shoulder dislocates with band or stick',
          targetSets: 1,
          repRange: '2 min',
          repMin: 1,
          repMax: 2,
          restSeconds: 30,
          restDisplay: '30 s',
          tip: 'Keep elbows extended, rotate smoothly from front to back without shrugging shoulder blades upward.',
          alternatives: [
            { id: 'wall-slides', name: 'Wall slides' },
            { id: 'band-pull-aparts', name: 'Band pull-aparts' }
          ]
        },
        {
          id: 'mobility-deep-squat-hold',
          name: 'Deep squat hold',
          targetSets: 1,
          repRange: '2 min',
          repMin: 1,
          repMax: 2,
          restSeconds: 30,
          restDisplay: '30 s',
          tip: 'Sit at lowest comfortable squat depth, use elbows to gently push knees outward, breathe into belly.',
          alternatives: [
            { id: 'goblet-squat-hold', name: 'Goblet squat hold' },
            { id: 'assisted-deep-squat', name: 'Assisted deep squat holding a post' }
          ]
        }
      ]
    },

    'fb-strength-1': {
      id: 'fb-strength-1',
      type: 'strength',
      title: 'Fallback Strength 1 — Full body strength',
      shortTitle: 'Fallback 1 (Strength)',
      goal: 'Total body heavy compound strength foundation when running on limited weekly time.',
      duration: '60 min',
      when: 'Thursday on fallback week (after Muay Thai 2, before rest day).',
      warmup: [
        '3 min bike or brisk walk',
        '10 reps World\'s Greatest Stretch per side',
        '10 bodyweight squats',
        '10 light push-ups',
        '2 build-up sets of Barbell back squat and Bench press'
      ],
      cooldown: [
        '2 min easy walk',
        'Couch stretch (45 s per side)',
        'Hamstring stretch (45 s per side)',
        '1 min calm breathing'
      ],
      exercises: [
        {
          id: 'back-squat',
          name: 'Barbell back squat',
          targetSets: 3,
          repRange: '5–8',
          repMin: 5,
          repMax: 8,
          restSeconds: 180,
          restDisplay: '2–3 min',
          tip: 'Brace core firmly before descent, keep chest proud, and drive the floor away through your mid-foot.',
          alternatives: [
            { id: 'dumbbell-front-squat', name: 'Dumbbell front squat' },
            { id: 'goblet-squat', name: 'Goblet squat' }
          ]
        },
        {
          id: 'bench-press',
          name: 'Barbell or dumbbell bench press',
          targetSets: 3,
          repRange: '6–10',
          repMin: 6,
          repMax: 10,
          restSeconds: 180,
          restDisplay: '2–3 min',
          tip: 'Retract scapulae, maintain stable arch, control the eccentric to mid-chest.',
          alternatives: [
            { id: 'push-ups', name: 'Push-ups' },
            { id: 'dumbbell-floor-press', name: 'Dumbbell floor press' }
          ]
        },
        {
          id: 'seated-cable-row',
          name: 'Seated cable row',
          targetSets: 3,
          repRange: '8–12',
          repMin: 8,
          repMax: 12,
          restSeconds: 90,
          restDisplay: '90 s',
          tip: 'Pull shoulders back first, drive elbows toward hip crease, avoid excessive torso swing.',
          alternatives: [
            { id: 'one-arm-dumbbell-row', name: 'One-arm dumbbell row' }
          ]
        },
        {
          id: 'romanian-deadlift-barbell',
          name: 'Romanian deadlift with barbell',
          targetSets: 3,
          repRange: '8–12',
          repMin: 8,
          repMax: 12,
          restSeconds: 120,
          restDisplay: '2 min',
          tip: 'Soft knees, hinge back pushing hips toward rear wall until deep hamstring tension, keep bar glued to thighs.',
          alternatives: [
            { id: 'romanian-deadlift-dumbbells', name: 'RDL with dumbbells' }
          ]
        },
        {
          id: 'dumbbell-shoulder-press',
          name: 'Dumbbell shoulder press',
          targetSets: 3,
          repRange: '8–12',
          repMin: 8,
          repMax: 12,
          restSeconds: 90,
          restDisplay: '90 s',
          tip: 'Press with elbows slightly angled in scapular plane (~30° forward), lock out without arching lower back.',
          alternatives: [
            { id: 'arnold-press', name: 'Arnold press' }
          ]
        },
        {
          id: 'suitcase-carry',
          name: 'Suitcase carry with dumbbell',
          targetSets: 3,
          repRange: '20–40 steps/side',
          repMin: 20,
          repMax: 40,
          restSeconds: 90,
          restDisplay: '60–90 s',
          tip: 'Stand tall, resist lateral flexion, walk in a slow measured cadence keeping shoulders level.',
          alternatives: [
            { id: 'side-plate-hold', name: 'Side plank' },
            { id: 'bird-dog', name: 'Bird dog' }
          ]
        }
      ]
    },

    'fb-strength-2': {
      id: 'fb-strength-2',
      type: 'strength',
      title: 'Fallback Strength 2 — Hypertrophy, power & conditioning',
      shortTitle: 'Fallback 2 (Hypertrophy & Power)',
      goal: 'Full body hypertrophy, explosive power, and athletic conditioning.',
      duration: '60–75 min',
      when: 'Saturday on fallback week (after Friday rest).',
      warmup: [
        '3 min bike or brisk walk',
        '10 reps World\'s Greatest Stretch per side',
        '10 bodyweight squats',
        '10 light push-ups',
        '10 light cable rows',
        '2 build-up sets of Bulgarian split squat and dumbbell press'
      ],
      cooldown: [
        '2 min easy walk',
        'Hamstring stretch (45 s per side)',
        'Hip flexor stretch (45 s per side)',
        '1 min calm breathing'
      ],
      exercises: [
        {
          id: 'bulgarian-split-squat',
          name: 'Bulgarian split squat with dumbbells',
          targetSets: 3,
          repRange: '8–12 / leg',
          repMin: 8,
          repMax: 12,
          restSeconds: 120,
          restDisplay: '2 min',
          tip: 'Elevate back foot, drop knee straight down, keep front heel planted firmly.',
          alternatives: [
            { id: 'reverse-lunges', name: 'Reverse lunges' },
            { id: 'step-ups', name: 'Step-ups' }
          ]
        },
        {
          id: 'dumbbell-swing-or-jump-squats',
          name: 'Dumbbell swing (indoor) / Dumbbell jump squats (outdoor)',
          targetSets: 4,
          repRange: '5–8 indoor / 3–5 outdoor',
          repMin: 5,
          repMax: 8,
          restSeconds: 120,
          restDisplay: '90–120 s',
          tip: 'Snap hips explosively. Prioritize deceleration and soft landing mechanics.',
          alternatives: [
            { id: 'explosive-split-squat', name: 'Explosive split squat' },
            { id: 'fast-concentric-goblet-squat', name: 'Fast goblet squat' }
          ]
        },
        {
          id: 'one-arm-cable-row',
          name: 'One-arm cable row',
          targetSets: 3,
          repRange: '10–12 / side',
          repMin: 10,
          repMax: 12,
          restSeconds: 90,
          restDisplay: '90 s',
          tip: 'Brace with non-working hand or staggered stance, stretch lat forward then row elbow to hip.',
          alternatives: [
            { id: 'seated-cable-row', name: 'Seated cable row' },
            { id: 'one-arm-dumbbell-row', name: 'One-arm dumbbell row' }
          ]
        },
        {
          id: 'flat-dumbbell-bench-press',
          name: 'Flat dumbbell bench press',
          targetSets: 3,
          repRange: '8–12',
          repMin: 8,
          repMax: 12,
          restSeconds: 120,
          restDisplay: '2 min',
          tip: 'Dumbbells at slight 45° angle, descend until chest stretch, press up and converge slightly.',
          alternatives: [
            { id: 'push-ups', name: 'Push-ups' },
            { id: 'bench-press', name: 'Barbell bench press' }
          ]
        },
        {
          id: 'lat-pulldown',
          name: 'Lat pulldown',
          targetSets: 3,
          repRange: '8–12',
          repMin: 8,
          repMax: 12,
          restSeconds: 90,
          restDisplay: '90 s',
          tip: 'Grip outside shoulder width, pull elbows straight down, pause briefly at collarbone.',
          alternatives: [
            { id: 'straight-arm-pulldown', name: 'Straight-arm pulldown' }
          ]
        },
        {
          id: 'dumbbell-lateral-raises',
          name: 'Dumbbell lateral raises',
          targetSets: 3,
          repRange: '12–20',
          repMin: 12,
          repMax: 20,
          restSeconds: 60,
          restDisplay: '60 s',
          tip: 'Slight forward torso lean, raise arms in scapular plane with pinkies slightly above thumbs.',
          alternatives: [
            { id: 'cable-lateral-raises', name: 'Cable lateral raises' }
          ]
        },
        {
          id: 'superset-curls-triceps',
          name: 'Superset: Dumbbell curls + Overhead triceps extension',
          targetSets: 3,
          repRange: '10–15 each',
          repMin: 10,
          repMax: 15,
          restSeconds: 90,
          restDisplay: '60–90 s (after superset)',
          tip: 'Superset without rest between exercises; take 60–90 seconds rest only after the triceps.',
          alternatives: [
            { id: 'superset-hammer-pushdowns', name: 'Hammer curls + cable pushdowns' }
          ]
        },
        {
          id: 'conditioning-finisher-fb',
          name: 'Optional finisher: Bag intervals or Heavy bike',
          targetSets: 1,
          repRange: '6 rounds',
          repMin: 1,
          repMax: 6,
          restSeconds: 60,
          restDisplay: '60 s',
          tip: 'Optional: Bag intervals 6 × (2 min work + 1 min rest) OR Heavy bike 8 × (30 s hard + 90 s easy). Skip this after a heavy Muay Thai week.',
          alternatives: [
            { id: 'heavy-bike-fb', name: 'Heavy bike: 8 × 30 s hard + 90 s easy' },
            { id: 'bag-intervals-fb', name: 'Bag intervals: 6 × 2 min work + 1 min rest' }
          ]
        }
      ]
    },

    'mini-mobility': {
      id: 'mini-mobility',
      type: 'cardio-mobility',
      title: 'Mini mobility routine',
      shortTitle: 'Mini Mobility',
      goal: 'Daily joint prep, relaxation, ankle and hip decompression (10 min, 3–5×/week).',
      duration: '10 min',
      when: 'Any day as an optional recovery supplement.',
      isMiniMobility: true,
      exercises: [
        {
          id: 'mini-breathing',
          name: 'Calm nasal breathing (4 s in / 6 s out)',
          targetSets: 1,
          repRange: '2 min',
          repMin: 1,
          repMax: 2,
          restSeconds: 0,
          restDisplay: 'None',
          tip: 'Inhale gently through nose for 4 counts expanding lower ribs; exhale silently for 6 counts dropping shoulders.',
          alternatives: [
            { id: 'box-breathing', name: 'Box breathing 4-4-4-4' },
            { id: 'supine-diaphragmatic', name: 'Supine diaphragmatic breathing' },
            { id: 'easy-walk', name: 'Easy walk without phone' }
          ]
        },
        {
          id: 'mini-cat-cow',
          name: 'Cat-cow',
          targetSets: 1,
          repRange: '1 min',
          repMin: 1,
          repMax: 1,
          restSeconds: 0,
          restDisplay: 'None',
          tip: 'Move slowly vertebra by vertebra between spinal flexion and gentle extension, syncing with breath.',
          alternatives: [
            { id: 'thread-needle', name: 'Thread the needle' },
            { id: 'floor-thoracic-rotations', name: 'Floor thoracic rotations' },
            { id: 'wall-slides', name: 'Wall slides' }
          ]
        },
        {
          id: 'mini-90-90',
          name: '90/90 hip rotations',
          targetSets: 1,
          repRange: '2 min',
          repMin: 1,
          repMax: 2,
          restSeconds: 0,
          restDisplay: 'None',
          tip: 'Rotate both knees from side to side staying seated tall on the floor.',
          alternatives: [
            { id: 'wgs-mini', name: 'World\'s greatest stretch' },
            { id: 'hip-circles', name: 'Hip circles' },
            { id: 'frog-rock', name: 'Frog rock' }
          ]
        },
        {
          id: 'mini-ankle',
          name: 'Wall ankle mobility drill',
          targetSets: 1,
          repRange: '2 min',
          repMin: 1,
          repMax: 2,
          restSeconds: 0,
          restDisplay: 'None',
          tip: 'Drive knees forward over second toe while keeping heels pinned down.',
          alternatives: [
            { id: 'knee-to-wall', name: 'Knee-to-wall drill' },
            { id: 'calf-raises', name: 'Calf raises' },
            { id: 'ankle-circles', name: 'Ankle circles' }
          ]
        },
        {
          id: 'mini-hamstring-hip',
          name: 'Hamstring or hip flexor stretch',
          targetSets: 1,
          repRange: '3 min',
          repMin: 1,
          repMax: 3,
          restSeconds: 0,
          restDisplay: 'None',
          tip: 'Pick whichever area feels tighter today; hold gentle tension without forcing range.',
          alternatives: [
            { id: 'couch-stretch', name: 'Couch stretch' },
            { id: 'standing-forward-fold', name: 'Standing forward fold' },
            { id: 'figure-four-stretch', name: 'Figure-four stretch' }
          ]
        }
      ]
    }
  },

  // Scheduling Rules & Warnings (Section 6)
  rules: {
    canRescheduleSession(sessionId) {
      // Muay Thai always has priority and is an external club session that cannot be moved
      if (sessionId === 'muay-thai-1' || sessionId === 'muay-thai-2') {
        return {
          allowed: false,
          reason: 'Muay Thai is a fixed club session (Mon/Wed 20:00–21:30) and cannot be moved.'
        };
      }
      return { allowed: true };
    },

    getAllowedDaysForSession(sessionId, currentWeekSchedule) {
      // Return list of days [0..6] (Mon=0..Sun=6) that the session could technically be placed on
      // Monday (0) and Wednesday (2) are reserved for Muay Thai
      const days = [0, 1, 2, 3, 4, 5, 6];
      return days.map(dayIndex => {
        const existingSessionId = currentWeekSchedule[dayIndex];
        const isClubDay = (dayIndex === 0 || dayIndex === 2);
        const warnings = [];

        // Check if day already has Muay Thai
        if (isClubDay && sessionId !== 'rest') {
          warnings.push('Muay Thai club training is already scheduled on this day. Heavy strength or conditioning should not share the same day.');
        }

        // Check Strength B and Strength C rule: keep at least 1 easy/light day between them
        if (sessionId === 'strength-c') {
          const strengthBDay = currentWeekSchedule.indexOf('strength-b');
          if (strengthBDay !== -1 && Math.abs(dayIndex - strengthBDay) <= 1) {
            warnings.push('Rule: Keep at least one easy or light day between Strength B and Strength C.');
          }
          // Strength C with intervals directly before Muay Thai
          if (dayIndex === 6 || dayIndex === 1) { // Sunday (before Mon) or Tuesday (before Wed)
            warnings.push('Rule warning: Strength C with intervals directly before Muay Thai can impair sparring sharpness.');
          }
        }

        if (sessionId === 'strength-b') {
          const strengthCDay = currentWeekSchedule.indexOf('strength-c');
          if (strengthCDay !== -1 && Math.abs(dayIndex - strengthCDay) <= 1) {
            warnings.push('Rule: Keep at least one easy or light day between Strength B and Strength C.');
          }
        }

        return {
          dayIndex,
          occupiedBy: existingSessionId,
          warnings
        };
      });
    },

    generalRulesList: [
      'Muay Thai always has priority and is never moved by the app (club training).',
      'Keep at least one easy or light day between Strength B and Strength C.',
      'Heavy strength always comes before conditioning on the same day.',
      'If one strength day is missed, move it to the next free day. If two are missed, switch to the 2-Day Fallback plan.',
      'With little time: keep the first 3–4 exercises of a session; shorten accessories and conditioning first.',
      'No heavy leg work or hard conditioning directly before or after a heavy Muay Thai session.',
      'Strength C with intervals directly before Muay Thai shows a warning.',
      'Aerobic base: no "short version"; move or skip if time is limited.'
    ]
  },

  // Progression Rules (Section 7)
  progression: {
    guidelines: [
      {
        title: 'Overload Rule',
        text: 'Increase weight only when all target sets are completed at the top of the rep range with good form.'
      },
      {
        title: 'Single-Leg Movements',
        text: 'For Bulgarian split squats and lunges: first increase reps within the range, then increase weight.'
      },
      {
        title: 'Explosive Exercises',
        text: 'For dumbbell swings and jump squats: improve speed, height and landing mechanics first; add weight later.'
      },
      {
        title: 'Reps in Reserve (RIR)',
        text: 'Train with 1–2 reps in reserve on compound lifts; failure is not needed for consistent progress.'
      },
      {
        title: 'Logging Discipline',
        text: 'Log every session: exercise, weight, reps, and rate of perceived exertion (RPE).'
      }
    ],

    checkShouldIncreaseWeight(exercise, loggedSets) {
      if (!loggedSets || loggedSets.length < exercise.targetSets) return false;
      const targetRepMax = exercise.repMax;
      if (!targetRepMax) return false;

      // Check if all target sets reached repMax and were completed
      let allAtTop = true;
      for (let i = 0; i < exercise.targetSets; i++) {
        const s = loggedSets[i];
        if (!s || !s.done || Number(s.reps) < targetRepMax) {
          allAtTop = false;
          break;
        }
      }
      return allAtTop;
    }
  }
};

// Expose globally for vanilla browser scripts and export for modules
if (typeof window !== 'undefined') {
  window.PLAN_DATA = PLAN_DATA;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PLAN_DATA;
}
