/* ═══════════════════════════════════════════════════════
   FASHION PORTFOLIO — INTERACTIONS
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Navbar scroll behaviour (home page only) ──── */

  const navbar    = document.getElementById('navbar');
  const hero      = document.getElementById('hero');
  const scrollHint = document.getElementById('scrollHint');

  if (navbar && hero) {
    const heroH = hero.offsetHeight;

    const onScroll = () => {
      const y = window.scrollY;

      // Dark bar appears after scrolling past hero
      if (y > heroH * 0.65) {
        navbar.classList.add('is-scrolled');
      } else {
        navbar.classList.remove('is-scrolled');
      }

      // Hide scroll hint when user starts scrolling
      if (scrollHint) {
        scrollHint.style.opacity = y > 60 ? '0' : '1';
        scrollHint.style.transition = 'opacity 0.5s';
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // run once on load
  }


  /* ── Carousel helpers ──────────────────────────── */

  /**
   * Bind arrow buttons to a given scroll container.
   * The step is one "page" worth of the container's visible width.
   *
   * @param {HTMLElement} container  – the .carousel-scroll element
   * @param {HTMLElement} prevBtn
   * @param {HTMLElement} nextBtn
   */
  function bindCarousel(container, prevBtn, nextBtn) {
    if (!container) return;

    const step = () => Math.round(container.clientWidth * 0.72);

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        container.scrollBy({ left: -step(), behavior: 'smooth' });
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        container.scrollBy({ left: step(), behavior: 'smooth' });
      });
    }

    /* ── Drag-to-scroll ── */
    let isDragging = false;
    let startX     = 0;
    let scrollLeft = 0;

    container.addEventListener('mousedown', (e) => {
      isDragging = true;
      container.classList.add('is-dragging');
      startX     = e.pageX - container.offsetLeft;
      scrollLeft = container.scrollLeft;
    });

    container.addEventListener('mouseleave', () => {
      isDragging = false;
      container.classList.remove('is-dragging');
    });

    container.addEventListener('mouseup', () => {
      isDragging = false;
      container.classList.remove('is-dragging');
    });

    container.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const x    = e.pageX - container.offsetLeft;
      const walk = (x - startX) * 1.4; // multiplier for feel
      container.scrollLeft = scrollLeft - walk;
    });

    /* ── Touch support ── */
    let touchStartX = 0;
    let touchScrollLeft = 0;

    container.addEventListener('touchstart', (e) => {
      touchStartX    = e.touches[0].pageX;
      touchScrollLeft = container.scrollLeft;
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      const dx = touchStartX - e.touches[0].pageX;
      container.scrollLeft = touchScrollLeft + dx;
    }, { passive: true });
  }


  /* ── Init all carousels on the page ───────────── */

  // Home page
  const homeCarousel = document.getElementById('homeCarousel');
  if (homeCarousel) {
    const wrap = homeCarousel.closest('.carousel-wrap');
    bindCarousel(
      homeCarousel,
      wrap.querySelector('.arrow-prev'),
      wrap.querySelector('.arrow-next')
    );
  }

  // Projects page — Commercial
  const commercialCarousel = document.getElementById('commercialCarousel');
  if (commercialCarousel) {
    const wrap = commercialCarousel.closest('.carousel-wrap');
    bindCarousel(
      commercialCarousel,
      wrap.querySelector('.arrow-prev'),
      wrap.querySelector('.arrow-next')
    );
  }

  // Projects page — Editorial
  const editorialCarousel = document.getElementById('editorialCarousel');
  if (editorialCarousel) {
    const wrap = editorialCarousel.closest('.carousel-wrap');
    bindCarousel(
      editorialCarousel,
      wrap.querySelector('.arrow-prev'),
      wrap.querySelector('.arrow-next')
    );
  }


  /* ── Intersection observer for fade-in on inner pages ── */

  const fadeEls = document.querySelectorAll('.fade-in');

  if (fadeEls.length) {
    // On inner pages the elements are already in view; just un-hide them
    // with a slight stagger via their existing CSS animation.
    // Nothing extra needed — CSS handles it.
  }

})();


/* ══════════════════════════════════════════════════════════
   FATTURA STUDIO LOGO — Blotter.js LiquidDistortMaterial
   ══════════════════════════════════════════════════════════

   Spec di riferimento: blotter-liquid-distort-spec2.md
   Shader GLSL: snoise(vec3(uv, time × uSpeed)) × uVolatility
   → displacement UV → textTexture(uv_distorto) → canvas WebGL

   Struttura multi-testo ottimizzata:
   tutti i testi (FATTURA + S T U D I O) condividono
   un'unica istanza Blotter → un solo contesto WebGL.
   ══════════════════════════════════════════════════════════ */

(function initBlotterLogo() {
  'use strict';

  /* ── 1. Feature detection: WebGL ──────────────────────── */
  var probe = document.createElement('canvas');
  var hasWebGL = !!(probe.getContext('webgl') || probe.getContext('experimental-webgl'));

  if (!hasWebGL) {
    // Fallback silenzioso: le span originali rimangono visibili
    return;
  }

  /* ── 2. document.fonts.ready → garantisce font caricato ──
     Blotter misura le metriche font al momento dell'init:
     se Montserrat non è ancora pronto, la misura è sbagliata. */
  document.fonts.ready.then(function () {

    /* ── 3. requestAnimationFrame ─────────────────────────
       Anche dopo fonts.ready il browser potrebbe non aver
       ancora calcolato il layout (offsetWidth/Height degli
       span potrebbero essere 0).
       Un singolo rAF garantisce almeno un ciclo completo
       di reflow/paint prima di procedere.                  */
    requestAnimationFrame(function () {

      /* ── 4. Guard: Blotter deve essere caricato ───────── */
      if (typeof window.Blotter === 'undefined') {
        console.warn('[Blotter] blotter.min.js non caricato — effetto disabilitato.');
        return;
      }

      /* ── 5. Elementi DOM ──────────────────────────────── */
      var fatturaEl = document.getElementById('logoFattura');
      var letterEls = Array.from(document.querySelectorAll('.logo-studio-letter'));

      // Guard: solo nella home (gli altri pagine non hanno questi el.)
      if (!fatturaEl || letterEls.length !== 6) return;

      /* ── 6. DIAGNOSTICA DIMENSIONI ────────────────────────
         Questo è il check chiave: se offsetWidth/Height è 0,
         Blotter non riesce a costruire il canvas correttamente.
         Apri DevTools → Console per vedere i valori.          */
      var fw = fatturaEl.offsetWidth;
      var fh = fatturaEl.offsetHeight;
      console.log('[Blotter] FATTURA span →', fw + 'px ×', fh + 'px');

      letterEls.forEach(function (el, i) {
        console.log(
          '[Blotter] STUDIO[' + i + '] "' + el.textContent.trim() + '" →',
          el.offsetWidth + 'px ×', el.offsetHeight + 'px'
        );
      });

      /* Se FATTURA ha dimensioni zero il layout non è pronto:
         il parent potrebbe avere display:none, height:0,
         o un overflow che nasconde il contenuto.             */
      if (fw === 0 || fh === 0) {
        console.error(
          '[Blotter] ⚠ FATTURA span ha offsetWidth=' + fw +
          ' offsetHeight=' + fh +
          ' — layout non pronto, Blotter non inizializzato.' +
          ' Verifica: .hero-logo visibile? .hero overflow:hidden?' +
          ' font-size applicato?'
        );
        return;
      }

      /* ── 7. Blotter.Text per FATTURA ──────────────────── */
      var fc = window.getComputedStyle(fatturaEl);

      var fatturaText = new window.Blotter.Text('FATTURA', {
        family  : fc.fontFamily,           // 'Montserrat', Helvetica Neue, …
        size    : parseFloat(fc.fontSize), // 120 px  (letto da CSS)
        weight  : fc.fontWeight,           // 300
        fill    : 'rgba(255,255,255,0.93)',
        padding     : 16,  // top / right / bottom — mantiene canvas compatto
        paddingLeft : 80   // solo sinistra: buffer per la "F" con uVolatility 0.10
                           // max distorsione = 0.10 × 649px = 64.9px < 80px → nessun taglio
      });

      /* ── 8. Blotter.Text per ogni lettera STUDIO ──────── */
      var studioLetters = ['S', 'T', 'U', 'D', 'I', 'O'];

      var studioTexts = letterEls.map(function (el, i) {
        var lc = window.getComputedStyle(el);
        return new window.Blotter.Text(studioLetters[i], {
          family  : lc.fontFamily,
          size    : parseFloat(lc.fontSize),   // 20 px
          weight  : lc.fontWeight,             // 300
          fill    : 'rgba(255,255,255,0.93)',
          padding : 0   // nessun padding → niente gap tra lettere →
                        // altezza totale STUDIO = altezza FATTURA ✓
        });
      });

      /* ── 9a. Material per FATTURA ───────────────────────
         uVolatility calibrata sulla larghezza canvas FATTURA (≈649 px):
         0.10 × 649 = 65 px di displacement massimo → effetto visibile */
      var materialFattura = new window.Blotter.LiquidDistortMaterial();
      materialFattura.uniforms.uSpeed.value      = 0.50;
      materialFattura.uniforms.uVolatility.value = 0.10;
      materialFattura.uniforms.uSeed.value       = 1.80;

      /* ── 9b. Material per STUDIO ────────────────────────
         Canvas di ogni lettera ≈ 20 px di larghezza.
         Per ottenere lo stesso displacement VISIVO di FATTURA
         (≈ 6–8 px) serve uVolatility ≈ 6/20 = 0.30.
         uSpeed e uSeed identici → animazione sincronizzata. */
      var materialStudio = new window.Blotter.LiquidDistortMaterial();
      materialStudio.uniforms.uSpeed.value      = 0.50;  // stesso ritmo
      materialStudio.uniforms.uVolatility.value = 0.30;  // calibrata per canvas piccoli
      materialStudio.uniforms.uSeed.value       = 1.80;  // stesso seed → stessa forma

      /* ── 10. Due istanze Blotter separate ───────────────
          Istanza A: solo FATTURA (material calibrato per tela larga)
          Istanza B: solo STUDIO  (material calibrato per tele strette)
          Totale: 2 contesti WebGL — dentro il limite sicuro del browser */
      var blotterFattura = new window.Blotter(materialFattura, { texts: [fatturaText] });
      var blotterStudio  = new window.Blotter(materialStudio,  { texts: studioTexts  });

      /* ── 11. Aggancia canvas FATTURA ──────────────────── */
      var fatturaScope = blotterFattura.forText(fatturaText);
      fatturaScope.appendTo(document.getElementById('fatturaWrap'));
      fatturaEl.style.visibility = 'hidden';

      /* ── 12. Aggancia canvas per ogni lettera STUDIO ─── */
      studioTexts.forEach(function (blotterText, i) {
        var scope = blotterStudio.forText(blotterText);
        scope.appendTo(letterEls[i].parentElement); // .logo-letter-cell
        letterEls[i].style.visibility = 'hidden';
      });

      console.log('[Blotter] ✓ LiquidDistort inizializzato — 2 istanze, 7 canvas WebGL attivi.');

    }); // end requestAnimationFrame

  }); // end document.fonts.ready

}());
