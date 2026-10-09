import { GLOSSARY } from './cortex-copy.js';
import { createUiChromeController } from './cortex-ui-chrome.js';
import { createControllerFacades } from './cortex-controller-facades.js';

export function createChromeStack({ getSettingsController }) {
  const uiChromeController = createUiChromeController({ glossary: GLOSSARY });
  const {
    bindRegionInfoEvents,
    buildGlossary,
    closeDialog,
    openDialog,
    showToast,
  } = uiChromeController;

  const settings = createControllerFacades({
    getSettingsController,
  });

  return {
    chrome: {
      bindRegionInfoEvents,
      buildGlossary,
      closeDialog,
      openDialog,
      showToast,
    },
    settings,
  };
}
