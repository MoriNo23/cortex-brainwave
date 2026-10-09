export function createUiChromeController({ glossary }) {
  const regionNames = {
    frontal: 'Lóbulo frontal — planificación, foco, movimiento voluntario.',
    parietal: 'Lóbulo parietal — integración sensorial, atención, orientación espacial.',
    temporal: 'Lóbulo temporal — audición, memoria, procesamiento emocional.',
    occipital: 'Lóbulo occipital — procesamiento visual.',
    deep: 'Estructuras profundas — sistema límbico, tronco encefálico. Asociado a estados de sueño profundo.',
  };

  let toastTimer;

  function openDialog(dialog) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  function buildGlossary() {
    const container = document.getElementById('glossary');
    container.innerHTML = glossary.map((g, i) => `
      <div class="gloss-item" data-idx="${i}">
        <div class="gloss-head">
          <span class="gloss-term">${g.term}</span>
          <span class="gloss-toggle">+</span>
        </div>
        <div class="gloss-body"><div class="gloss-body-inner">${g.body}</div></div>
      </div>
    `).join('');

    container.querySelectorAll('.gloss-head').forEach((head) => {
      head.addEventListener('click', () => head.parentElement.classList.toggle('open'));
    });
  }

  function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  function bindRegionInfoEvents() {
    document.querySelectorAll('.region').forEach((el) => {
      el.addEventListener('click', () => {
        const region = el.dataset.region;
        showToast(regionNames[region] || region);
      });
    });
  }

  return {
    bindRegionInfoEvents,
    buildGlossary,
    closeDialog,
    openDialog,
    showToast,
  };
}
