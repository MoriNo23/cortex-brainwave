export const STOP_BEHAVIOR_DEFAULTS = Object.freeze({ targetBand: 'alpha', fadeSeconds: 2 });
export const STROBE_DEFAULTS = Object.freeze({ mode: 'sync', customHz: 10, presentation: 'integrated', active: false });

export const BANDS = {
  delta:  { name:'Delta',   range:'0.5 – 4 Hz',  desc:'Sueño profundo sin sueños. Restauración física, sanación, inconsciencia. El cerebro está en su estado más lento.', regions:['deep'] },
  theta:  { name:'Theta',   range:'4 – 8 Hz',    desc:'Estado de duermevela, sueño REM, meditación profunda. Procesamiento emocional, consolidación de memoria, creatividad.', regions:['temporal','deep'] },
  alpha:  { name:'Alpha',   range:'8 – 12 Hz',   desc:'Relajación despierta. Creatividad, flow, meditación ligera. Predomina con los ojos cerrados pero sin dormir.', regions:['parietal','occipital'] },
  beta:   { name:'Beta',    range:'13 – 30 Hz',  desc:'Pensamiento activo, foco, resolución de problemas. Presente durante trabajo, decisiones, tareas cognitivas.', regions:['frontal'] },
  gamma:  { name:'Gamma',   range:'30+ Hz',      desc:'Procesamiento rápido, aprendizaje, memoria. Sincroniza áreas distantes del cerebro. El estado más rápido.', regions:['frontal','parietal','occipital'] }
};

export const BUILTIN_PRESETS = [
  { id:'builtin-delta', band:'delta', freq:2, emoji:'🌙', name:'Delta' },
  { id:'builtin-theta', band:'theta', freq:6, emoji:'🌀', name:'Theta' },
  { id:'builtin-alpha', band:'alpha', freq:10, emoji:'🌿', name:'Alpha' },
  { id:'builtin-beta', band:'beta', freq:20, emoji:'⚡', name:'Beta' },
  { id:'builtin-gamma', band:'gamma', freq:40, emoji:'✨', name:'Gamma' },
];

export const PRESET_DEFAULTS = {
  delta: { amod:30, binaural:20, stereo:0, fmod:0, noise:10 },
  theta: { amod:35, binaural:25, stereo:10, fmod:0, noise:5 },
  alpha: { amod:25, binaural:30, stereo:15, fmod:0, noise:0 },
  beta:  { amod:20, binaural:20, stereo:10, fmod:5, noise:0 },
  gamma: { amod:15, binaural:15, stereo:10, fmod:10, noise:0 },
};

export const AVAILABLE_EMOTES = ['🌙','🌀','🌿','⚡','✨','🧘','🎯','🌊','🎵','🧠','☁️','🌌','😴','🚀'];
export const AUDIO_KEYS = ['brainwave','carrier','amod','binaural','stereo','fmod','noise','mix'];

export function createAppState() {
  return {
    brainwave: 10,
    carrier: 200,
    amod: 0,
    binaural: 0,
    stereo: 0,
    fmod: 0,
    noise: 0,
    mix: 80,
    playing: false,
    band: 'alpha',
    dockExpanded: false,
    stopBehavior: { ...STOP_BEHAVIOR_DEFAULTS },
    strobe: { ...STROBE_DEFAULTS },
  };
}

export function createTimelineState() {
  return {
    steps: [],
    loop: false,
    transition: { enabled: true, seconds: 2 },
    durationUnits: { step: 's', transition: 's' },
  };
}
