(function () {
  const overlay = document.getElementById('legal-modal-overlay');
  const body = document.getElementById('legal-modal-body');
  const closeBtn = document.getElementById('legal-modal-close');
  const cache = {};

  function openModal() {
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  async function loadLegalPage(url) {
    if (cache[url]) return cache[url];
    const res = await fetch(url);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const h1 = doc.querySelector('h1');
    const content = doc.querySelector('.avis');
    const fragment = (h1 ? h1.outerHTML : '') + (content ? content.outerHTML : '');
    cache[url] = fragment;
    return fragment;
  }

  document.querySelectorAll('a[data-legal]').forEach((link) => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      body.textContent = window.i18n ? window.i18n.t('modal_carregant') : 'Carregant…';
      openModal();
      try {
        body.innerHTML = await loadLegalPage(link.getAttribute('href'));
        if (window.i18n) window.i18n.aplicar(body);
      } catch (err) {
        body.textContent = window.i18n ? window.i18n.t('modal_error') : "No s'ha pogut carregar el contingut.";
      }
    });
  });

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeModal();
  });
})();
