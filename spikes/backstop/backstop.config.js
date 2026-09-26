module.exports = {
  id: 'cortex-backstop-native-comparison',
  viewports: [
    { label: 'desktop', width: 1440, height: 900 },
  ],
  scenarios: [
    {
      label: 'cortex-body',
      url: 'file:///home/user/cortex.html',
      selectors: ['body'],
      delay: 1000,
      postInteractionWait: 500,
      misMatchThreshold: 0.1,
      requireSameDimensions: true,
    },
  ],
  paths: {
    bitmaps_reference: 'spikes/backstop/bitmaps_reference',
    bitmaps_test: 'spikes/backstop/bitmaps_test',
    engine_scripts: 'spikes/backstop/engine_scripts',
    html_report: 'spikes/backstop/html_report',
    ci_report: 'spikes/backstop/ci_report',
  },
  report: ['CI'],
  engine: 'puppeteer',
  engineOptions: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
  asyncCaptureLimit: 1,
  asyncCompareLimit: 1,
  debug: false,
  debugWindow: false,
};
