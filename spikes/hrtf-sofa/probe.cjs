const fs = require('fs');
const path = require('path');

const cortex = fs.readFileSync(path.join(process.cwd(), 'cortex.html'), 'utf8');
const result = {
  status: 'NOT_EXECUTED',
  productionIntegration: false,
  humanListeningRequired: true,
  headphonesRequiredForHRTFClaim: true,
  cortexContainsStereoPanner: cortex.includes('createStereoPanner'),
  cortexContainsSofaParser: /SOFA|libmysofa|Omnitone/i.test(cortex),
  claims: {
    validWav: false,
    stereoSeparation: false,
    stereoPannerNode: false,
    visualSnapshot: false,
    provesHRTF: false,
  },
  reason: 'No SOFA parser, HRTF dataset, delay/FIR convolution renderer, or listening session is installed in the isolated spike.',
};

const output = path.join(process.cwd(), 'artifacts', 'hrtf-sofa-probe.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
