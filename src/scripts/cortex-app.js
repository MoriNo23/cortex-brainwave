import { createCortexApp } from '../lib/cortex-app-composition.js';

const app = createCortexApp();
app.mountDebugSurface();
app.init();
