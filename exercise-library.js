// Variant IDs describe loading conventions. Broad names remain separate legacy tracks.
const rows = [
  ['Chest press','Machine','Push','Chest','Triceps,Front shoulders','Adjust the seat so the handles start near mid-chest.','Press forward, then return until the upper arms reach a comfortable stretch.','Feet flat;Wrists over elbows;Control the return','Shrugging or arching to finish'],
  ['Seated cable row','Cable','Pull','Mid back,Lats','Biceps,Rear shoulders','Sit tall with feet braced and take hold of the low cable.','Pull the handle toward your lower ribs and return with control.','Stay tall;Lead with elbows;Let the shoulder blades move','Rocking backward to move the load'],
  ['Leg press','Machine','Squat','Quads,Glutes','Hamstrings','Set your back against the pad and place both feet on the platform.','Bend knees and hips to a comfortable depth, then press through the whole foot.','Knees follow toes;Keep hips on pad;Lower slowly','Going deep enough for the pelvis to roll off the pad'],
  ['Lateral Raise','Dumbbells','Raise','Side shoulders','Upper back','Stand with dumbbells at your sides and elbows slightly bent.','Raise your arms slightly forward of your sides to a comfortable height, then lower.','Soft elbows;Quiet torso;Lower slowly','Swinging, shrugging or forcing height'],
  ['Curls','Dumbbells','Curl','Biceps','Forearms','Stand tall holding the dumbbells with palms forward.','Bend the elbows to lift, then lower smoothly.','Keep wrists neutral;Elbows near sides;Lengthen under control','Throwing your hips forward'],
  ['Pallof press','Cable','Anti-rotation','Core','Glutes,Shoulders','Stand sideways to a chest-height cable with the handle against your sternum.','Press the handle straight out while resisting the cable’s rotation, then bring it back.','Ribs over pelvis;Stay square;Breathe while braced','Turning toward the anchor or leaning away'],
  ['Lat pulldown','Cable','Pull','Lats','Biceps,Mid back','Secure your thighs under the pads and take a comfortable grip.','Pull the bar toward your upper chest, then return overhead.','Lead elbows down;Stay tall;Use a smooth reach','Yanking behind the neck or leaning far back'],
  ['Incline dumbbell press','Dumbbells','Push','Chest','Front shoulders,Triceps','Set a low incline and start with a dumbbell on either side of your upper chest.','Press up and slightly inward, then lower until the shoulders reach a comfortable depth.','Feet planted;Forearms vertical;Lower slowly','Bouncing, flaring sharply or clanging the weights'],
  ['Romanian deadlift','Barbell','Hinge','Hamstrings,Glutes','Low back,Forearms','Stand with the bar at your thighs and unlock your knees slightly.','Send the hips back with the bar close, stop at a comfortable hamstring stretch, then stand.','Keep shins nearly vertical;Brace;Drag the bar close','Squatting down or reaching for the floor'],
  ['Rope triceps pressdown','Cable','Extend','Triceps','Forearms','Face a high pulley and hold the rope with elbows near your sides.','Straighten your elbows, then return without letting the upper arms drift.','Keep wrists neutral;Stay tall;Control the return','Leaning over the rope to move more weight'],
  ['Face pull','Cable','Pull','Rear shoulders,Mid back','Upper back,Rotator cuff','Attach a rope near eye level and step back until it is taut.','Row the rope toward your face, separating the ends, then return slowly.','Keep ribs down;Use a light load;Keep neck relaxed','Shrugging or arching to move the rope'],
  ['Dead bug','Bodyweight','Anti-extension','Core','Hip flexors','Lie on your back with arms up and hips and knees bent.','Reach opposite arm and leg away, then return and alternate.','Exhale on reach;Keep ribs down;Shorten the reach if your back arches','Moving farther than you can control'],
  ['Chest-supported row','Dumbbells','Pull','Mid back,Lats','Rear shoulders,Biceps','Lie chest-down on a low incline bench with arms hanging.','Row the weights toward your sides, then lower without leaving the pad.','Keep chest supported;Lead with elbows;Pause briefly','Lifting the chest or jerking the weights'],
  ['Hip thrust or glute bridge','Bodyweight','Hinge','Glutes','Hamstrings,Core','For a floor bridge, lie on your back with knees bent and feet flat.','Press through your feet to extend your hips, pause, then lower.','Keep ribs down;Squeeze glutes;Stop at a straight hip line','Arching the low back at the top'],
  ['Pec fly / chest fly','Machine','Fly','Chest','Front shoulders','Set the seat so the handles are near chest height with a slight elbow bend.','Bring the handles together in an arc, then slowly open to a comfortable stretch.','Keep the elbow bend steady;Avoid shrugging;Use a light load','Forcing the arms far behind the torso'],
  ['Rear-delt fly','Dumbbells','Fly','Rear shoulders','Mid back,Upper back','Hinge at the hips with light dumbbells and a soft elbow bend.','Sweep the arms outward, then lower without moving the torso.','Lead with elbows;Keep neck relaxed;Use a controlled range','Swinging the torso or shrugging'],
  ['Hammer curl','Dumbbells','Curl','Biceps,Forearms','Shoulders','Hold dumbbells at your sides with palms facing inward.','Curl without rotating the wrists, then lower slowly.','Elbows by ribs;Thumbs up;Stay tall','Swinging the torso to start the lift'],
  ['Farmer carry','Dumbbells','Carry','Forearms,Upper back','Core,Glutes','Take a weight in each hand and stand tall with space ahead.','Walk with controlled steps, then set the weights down under control.','Breathe steadily;Stay upright;Keep shoulders level','Rushing, leaning or dropping the weights'],
  ['Incline pushup','Bodyweight','Push','Chest','Triceps,Front shoulders,Core','Set hands against a stable raised surface and step back into a straight plank.','Lower your chest toward the support, then press away.','Keep ribs down;Elbows slightly tucked;Move as one unit','Sagging hips or using an unstable support'],
  ['Glute bridge','Bodyweight','Hinge','Glutes','Hamstrings,Core','Lie on your back with knees bent and feet flat.','Press through your feet to lift your hips, pause, then lower.','Keep ribs down;Squeeze glutes;Stop at a straight hip line','Arching the low back at the top'],
  ['Chair squat','Bodyweight','Squat','Quads,Glutes','Core,Hamstrings','Stand in front of a stable chair with your feet about hip-width apart.','Sit back until you lightly touch the seat, then stand.','Keep feet planted;Knees follow toes;Control the descent','Dropping onto the chair or rocking to stand'],
  ['Bird dog','Bodyweight','Anti-rotation','Core,Low back','Glutes,Shoulders','Start on hands and knees with hands under shoulders and knees under hips.','Reach opposite arm and leg, pause, then return and alternate.','Keep hips level;Reach long;Breathe','Twisting the torso or lifting the leg above the hips'],
  ['Prone W raise','Bodyweight','Raise','Mid back,Rear shoulders','Rotator cuff','Lie face down with elbows bent and arms forming a W.','Lift the hands and elbows a little, pause, then lower.','Keep neck neutral;Reach elbows wide;Use a small range','Craning the neck or lifting through the low back']
];

const variants = [
  ['Dumbbell lateral raise','Lateral Raise'], ['Dumbbell curl','Curls'],
  ['Machine chest press','Chest press'], ['Barbell Romanian deadlift','Romanian deadlift'],
  ['Dumbbell chest-supported row','Chest-supported row'], ['Machine pec fly','Pec fly / chest fly'],
  ['Dumbbell rear-delt fly','Rear-delt fly'], ['Dumbbell farmer carry','Farmer carry']
];

const muscleWiki = slug => ({
  url: `https://musclewiki.com/exercise/${slug}`,source:'MuscleWiki',type:'external',license:'External link only'
});
const nasm = slug => ({
  url: `https://www.nasm.org/resource-center/exercise-library/${slug}`,source:'NASM',type:'external',license:'External link only'
});
const external = (source,url) => ({source,url,type:'external',license:'External link only'});
const sources = {
  'Chest press':muscleWiki('machine-chest-press'),
  'Seated cable row':{url:'https://www.acefitness.org/resources/everyone/exercise-library/48/seated-row/',source:'ACE',type:'external',license:'External link only'},
  'Leg press':muscleWiki('machine-leg-press'),
  'Lateral Raise':muscleWiki('dumbbell-lateral-raise'),
  Curls:muscleWiki('dumbbell-curl'),
  'Pallof press':muscleWiki('cable-pallof-press'),
  'Lat pulldown':external('Macros Inc','https://macrosinc.net/exercises/back/lat-pulldown/'),
  'Incline dumbbell press':muscleWiki('dumbbell-incline-bench-press'),
  'Romanian deadlift':muscleWiki('barbell-romanian-deadlift'),
  'Rope triceps pressdown':muscleWiki('cable-rope-pushdown'),
  'Face pull':nasm('face-pull'),
  'Dead bug':nasm('dead-bug'),
  'Chest-supported row':external('StrengthLog','https://www.strengthlog.com/chest-supported-dumbbell-row/'),
  'Hip thrust or glute bridge':muscleWiki('glute-bridge'),
  'Pec fly / chest fly':external('Fitbe','https://workouts.fitbe.io/exercises/pec-deck'),
  'Rear-delt fly':muscleWiki('dumbbell-rear-delt-fly'),
  'Hammer curl':muscleWiki('dumbbell-hammer-curl'),
  'Farmer carry':external('Muscle & Strength','https://www.muscleandstrength.com/node/48762'),
  'Incline pushup':muscleWiki('incline-push-up'),
  'Glute bridge':muscleWiki('glute-bridge'),
  'Chair squat':external('Health and Wellbeing Queensland','https://hw.qld.gov.au/physical-activity/chair-leg-squats/'),
  'Bird dog':nasm('bird-dog'),
  'Prone W raise':external('Prone W Raise on Vimeo','https://vimeo.com/1136636060')
};
const slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const EXERCISES = [...rows, ...variants.map(([name, base]) => [name,...rows.find(row => row[0] === base).slice(1)])]
  .map(([name,equipment,pattern,primary,secondary,setup,movement,cues,mistakes]) => ({
    id: slug(name), name, equipment, movementPattern: pattern, primary: primary.split(','), secondary: secondary.split(','),
    setup, movement, cues: cues.split(';'), mistakes, demonstration: sources[name] ?? sources[variants.find(([variant])=>variant===name)?.[1]] ?? null
  }));

export function exerciseGuide(name) {
  return EXERCISES.find(item => item.id === slug(String(name ?? ''))) ?? null;
}

export const ambiguousLoading = new Set([
  'chest-press','lateral-raise','curls','romanian-deadlift','chest-supported-row','hip-thrust-or-glute-bridge',
  'pec-fly-chest-fly','rear-delt-fly','farmer-carry'
]);

// Original front/back schematic. Regions are approximate.
const regions = {
  Chest: [0, 'M37 31Q49 25 57 32V45L36 42Z M63 32Q71 25 83 31L84 42 63 45Z'],
  'Front shoulders': [0,'M28 30L36 29 34 42 25 43Z M84 29L92 30 95 43 86 42Z'],
  'Side shoulders': [0,'M23 35L29 29 33 36 28 48 20 45Z M91 29L97 35 100 45 92 48 87 36Z'],
  Shoulders: [0,'M23 35L29 29 33 36 28 48 20 45Z M91 29L97 35 100 45 92 48 87 36Z'],
  Biceps: [0,'M24 46L32 45 28 59 20 58Z M88 45L96 46 100 58 92 59Z'],
  Forearms: [0,'M18 61L26 62 20 77 13 77Z M94 62L102 61 107 77 100 77Z'],
  Core: [0,'M42 46L78 46 75 65 45 65Z'],
  'Hip flexors': [0,'M40 66L57 67 53 77 40 74Z M63 67L80 66 80 74 67 77Z'],
  Quads: [0,'M39 76L55 80 53 97 39 95Z M65 80L81 76 81 95 67 97Z'],
  'Upper back': [1,'M37 34L60 24 83 34 60 48Z'],
  'Mid back': [1,'M41 40L79 40 71 57 49 57Z'],
  'Rear shoulders': [1,'M27 31L38 31 36 42 24 45Z M82 31L93 31 96 45 84 42Z'],
  'Rotator cuff': [1,'M34 33L49 36 46 43 33 42Z M71 36L86 33 87 42 74 43Z'],
  Lats: [1,'M35 43L47 45 54 62 42 59Z M73 45L85 43 78 59 66 62Z'],
  Triceps: [1,'M24 46L32 45 28 59 20 58Z M88 45L96 46 100 58 92 59Z'],
  'Low back': [1,'M51 54L69 54 73 67 47 67Z'],
  Glutes: [1,'M41 66L57 68 58 79 39 77Z M63 68L79 66 81 77 62 79Z'],
  Hamstrings: [1,'M39 79L55 81 53 97 39 95Z M65 81L81 79 81 95 67 97Z']
};

function muscleDiagram(guide) {
  const groups = [[guide.secondary,'#6ee7d1'], [guide.primary,'#ffd34e']];
  return `<svg class="muscle-map" viewBox="0 0 244 140" role="img" aria-label="Front and back muscle map, yellow primary and teal secondary">
    ${[0,1].map(side => `<g transform="translate(${side*124} 0)"><circle cx="60" cy="14" r="9" fill="#405474"/>
      <path d="M54 22H66L91 28 102 48 110 78 99 82 89 59 83 46 79 63 84 76 80 100 77 125H65L60 84 55 125H43L40 100 36 76 41 63 37 46 31 59 21 82 10 78 18 48 29 28Z" fill="#405474"/>
      ${groups.flatMap(([muscles,color]) => muscles.filter(muscle => regions[muscle]?.[0] === side)
        .map(muscle => `<path d="${regions[muscle][1]}" fill="${color}"/>`)).join('')}
      <text x="60" y="138" text-anchor="middle" fill="currentColor" font-size="11">${side ? 'Back' : 'Front'}</text></g>`).join('')}</svg>`;
}

export function guideMarkup(name) {
  const guide = exerciseGuide(name);
  const content = guide ? `<p><strong>${guide.equipment} variation</strong></p>
    ${guide.demonstration ? `<a href="${guide.demonstration.url}" target="_blank" rel="noopener noreferrer">Watch Demonstration · ${guide.demonstration.source}</a>` :
      '<p class="muted">A matching external demonstration is unavailable.</p>'}
    <h4>Setup</h4><p>${guide.setup}</p><h4>Movement</h4><p>${guide.movement}</p>
    <h4>Key cues</h4><ul>${guide.cues.map(cue => `<li>${cue}</li>`).join('')}</ul>
    <h4>Common mistakes</h4><p>${guide.mistakes}</p>
    ${muscleDiagram(guide)}<p><strong>Primary (yellow)</strong> · ${guide.primary.join(', ')}<br>
    <strong>Secondary (teal)</strong> · ${guide.secondary.join(', ')}</p>
    <small>Original Varsity technique notes and muscle illustration. Work through a comfortable range and stop if a movement causes pain.</small>` :
    '<p>No guide is available for this saved variant. Keep the load manageable and use a comfortable range.</p>';
  return `<details class="exercise-guide" name="exercise-guides"><summary>Form &amp; Muscles</summary>${content}</details>`;
}
