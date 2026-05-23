# Blotter.js LiquidDistortMaterial — Implementazione Tecnica

## Obiettivo

Replicare l'effetto di distorsione testuale liquida/fluida visto sul sito zermatt.qodeinteractive.com, applicabile a **qualsiasi testo** in qualsiasi progetto web. L'effetto usa WebGL per animare il testo con un displacement basato su Simplex Noise 3D.

---

## Stack Tecnico

| Libreria | Ruolo | Versione |
|---|---|---|
| `blotter.min.js` | Core renderer WebGL + canvas | 0.1.0 |
| `liquidDistortMaterial.js` | Shader GLSL con Simplex Noise 3D | **file separato** — va scaricato a parte |
| Three.js | Renderer WebGL sottostante (dipendenza di Blotter) | r89 (bundled) |

---

## Import — IMPORTANTE: nessun CDN disponibile

**Blotter.js non è disponibile su nessun CDN pubblico** (né cdnjs, né unpkg, né jsdelivr). Va scaricato localmente e servito come file statico.

### Step 1 — Scarica i file (sono DUE file separati)

```bash
# Core Blotter
curl -o blotter.min.js https://raw.githubusercontent.com/bradley/Blotter/master/build/blotter.min.js

# Materiale LiquidDistort — FILE SEPARATO, non incluso in blotter.min.js
curl -o liquidDistortMaterial.js https://raw.githubusercontent.com/bradley/Blotter/master/build/materials/liquidDistortMaterial.js
```

oppure scaricali manualmente:
```
https://raw.githubusercontent.com/bradley/Blotter/master/build/blotter.min.js
https://raw.githubusercontent.com/bradley/Blotter/master/build/materials/liquidDistortMaterial.js
```

### Step 2 — Importa localmente (ordine obbligatorio)

```html
<!-- blotter.min.js DEVE venire prima di liquidDistortMaterial.js -->
<script src="blotter.min.js"></script>
<script src="liquidDistortMaterial.js"></script>

<!-- Se i file sono in una sottocartella js/ -->
<script src="js/blotter.min.js"></script>
<script src="js/liquidDistortMaterial.js"></script>
```

### npm (progetti Node/bundler)

```bash
npm install blotter
```

```javascript
// Attenzione: Blotter non ha export ES module — usare require o import globale
// Verificare la compatibilità con il bundler in uso (Vite, Webpack, ecc.)
import 'blotter';
// window.Blotter sarà disponibile globalmente dopo l'import
```

> **Nota**: Blotter.js include già Three.js r89 al suo interno — non serve importarlo separatamente. Importare una versione separata di Three.js causerebbe conflitti.

> **ATTENZIONE**: `liquidDistortMaterial.js` NON è incluso in `blotter.min.js` — è un file separato che va scaricato e importato esplicitamente dopo il core. Senza di esso, `new Blotter.LiquidDistortMaterial()` lancia `is not a constructor`.

> **Verifica**: Prima di inizializzare, controllare che `typeof window.Blotter !== 'undefined'`. Se è `undefined`, il file non è stato caricato correttamente.

> **Server locale obbligatorio**: Blotter non funziona se il file HTML è aperto direttamente come `file:///` — WebGL ha restrizioni di sicurezza sui file locali. Usare sempre un server locale: `npx live-server`, `python -m http.server 8080`, o equivalente.

---

## Lo Shader (Cuore dell'Effetto)

Il materiale `LiquidDistortMaterial` esegue questo shader GLSL per ogni pixel del canvas:

```glsl
void mainImage( out vec4 mainImage, in vec2 fragCoord ) {
    // Normalizza coordinate pixel in range 0.0 → 1.0
    vec2 uv = fragCoord.xy / uResolution.xy;

    // z è l'asse temporale: avanza nel tempo creando animazione continua
    float z = uSeed + uGlobalTime * uSpeed;

    // Sposta le coordinate UV usando Simplex Noise 3D
    // snoise(vec3(uv, z)) restituisce un valore -1.0 → +1.0
    // moltiplicato per uVolatility determina l'entità dello spostamento
    uv += snoise(vec3(uv, z)) * uVolatility;

    // Legge il colore del testo nella posizione distorta
    mainImage = textTexture(uv);
}
```

### Parametri Uniforms

| Uniform | Tipo | Default | Descrizione |
|---|---|---|---|
| `uSpeed` | `float` | `1.0` | Velocità dell'animazione. Range consigliato: `0.1` (lento/elegante) → `3.0` (frenetico) |
| `uVolatility` | `float` | `0.15` | Intensità della distorsione. Range consigliato: `0.05` (sottile) → `0.5` (estremo) |
| `uSeed` | `float` | `0.1` | Offset del noise. Cambiarlo cambia la "forma" della distorsione. Range: `0.0` → `10.0` |

---

## Implementazione Base (HTML Vanilla)

```html
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      margin: 0;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }

    /* Il testo originale viene nascosto — Blotter lo sostituisce con un canvas */
    .blotter-text {
      font-family: 'DM Sans', sans-serif;
      font-size: 200px;
      font-weight: 700;
      color: #000000;
      /* NON usare display:none — Blotter deve poter leggere le dimensioni */
      /* Blotter aggiunge automaticamente visibility:hidden al testo originale */
    }
  </style>
</head>
<body>

  <!-- Il testo da distorcere: può essere qualsiasi parola/frase -->
  <span class="blotter-text" id="my-text">TESTO</span>

  <script src="blotter.min.js"></script><!-- file locale scaricato da GitHub -->
  <script>
    // 1. Seleziona l'elemento DOM contenente il testo
    var textEl = document.getElementById('my-text');

    // 2. Crea il testo Blotter con font e stile identici al CSS
    // Tutti i parametri disponibili (confermati dal sorgente blotter.min.js):
    var text = new Blotter.Text(textEl.innerText, {
      family       : "'DM Sans', sans-serif", // font-family CSS
      size         : 200,                     // font-size in px (deve corrispondere al CSS)
      weight       : 700,                     // font-weight (400, 700, ecc.)
      style        : "normal",                // font-style ("normal" | "italic" | "oblique")
      leading      : 1.5,                     // line-height: numero = moltiplicatore, "16px" o "150%" accettati
      fill         : "#000000",               // colore del testo (qualsiasi valore CSS valido)
      padding      : 10,                      // padding uniforme su tutti i lati (evita clipping ai bordi)
      paddingTop   : 0,                       // padding individuale — sovrascrive `padding` per quel lato
      paddingRight : 0,
      paddingBottom: 0,
      paddingLeft  : 0
    });

    // 3. Crea il materiale con i parametri di distorsione
    var material = new Blotter.LiquidDistortMaterial();

    // 4. Imposta i parametri dello shader
    material.uniforms.uSpeed.value      = 0.6;   // velocità animazione
    material.uniforms.uVolatility.value = 0.15;  // intensità distorsione
    material.uniforms.uSeed.value       = 0.1;   // variante del noise

    // 5. Crea il renderer Blotter
    var blotter = new Blotter(material, {
      texts: text
    });

    // 6. Ottieni il scope per questo specifico testo
    var scope = blotter.forText(text);

    // 7. Aggancia il canvas WebGL all'elemento DOM
    // Blotter nasconde l'elemento originale e inserisce il canvas al suo posto
    scope.appendTo(textEl.parentElement);

    // Oppure, per sostituire l'elemento direttamente:
    // scope.appendTo(document.body);
  </script>
</body>
</html>
```

---

## Implementazione Multi-Testo (più elementi nella stessa pagina)

```javascript
// Seleziona tutti gli elementi con classe .liquid-text
var elements = document.querySelectorAll('.liquid-text');

var material = new Blotter.LiquidDistortMaterial();
material.uniforms.uSpeed.value      = 0.6;
material.uniforms.uVolatility.value = 0.15;
material.uniforms.uSeed.value       = 0.1;

// Crea un array di oggetti Blotter.Text
var blotterTexts = Array.from(elements).map(function(el) {
  var computed = window.getComputedStyle(el);
  return new Blotter.Text(el.innerText, {
    family  : computed.fontFamily,
    size    : parseFloat(computed.fontSize),
    weight  : computed.fontWeight,
    fill    : computed.color,
    padding : 10
  });
});

// Un singolo renderer per tutti i testi (più efficiente — un solo contesto WebGL)
var blotter = new Blotter(material, {
  texts: blotterTexts
});

// Aggancia ogni canvas al proprio elemento
elements.forEach(function(el, i) {
  var scope = blotter.forText(blotterTexts[i]);
  scope.appendTo(el.parentElement);
});
```

---

## Struttura DOM Risultante

Blotter trasforma questa struttura:

```html
<!-- PRIMA -->
<div class="container">
  <span id="my-text">TESTO</span>
</div>
```

In questa:

```html
<!-- DOPO (generato da Blotter) -->
<div class="container">
  <span id="my-text" style="visibility: hidden;">TESTO</span>
  <canvas class="b-canvas"
          width="[larghezza_reale]"
          height="[altezza_reale]"
          style="width: [larghezza_display]px; height: [altezza_display]px;">
  </canvas>
</div>
```

Il canvas viene inserito come **sibling** dell'elemento originale, che viene nascosto con `visibility: hidden` (non `display: none` — così mantiene il suo spazio nel layout).

---

## Pattern con Device Pixel Ratio (Display Retina)

Il canvas viene automaticamente creato a risoluzione doppia su display HiDPI:

```
canvas width/height  = dimensione logica × devicePixelRatio
canvas style width/height = dimensione logica (CSS pixels)
```

Esempio osservato nel sito originale:
- BRU: canvas `1275×385`, stile `729×220px` → ratio ~1.75
- MIND: canvas `1524×385`, stile `871×220px` → ratio ~1.75

Blotter gestisce questo automaticamente — non serve configurazione aggiuntiva.

---

## Parametri Visivi: Guida alla Taratura

### Effetto sottile (elegante, quasi impercettibile)
```javascript
material.uniforms.uSpeed.value      = 0.3;
material.uniforms.uVolatility.value = 0.05;
material.uniforms.uSeed.value       = 2.4;
```

### Effetto medio (come il sito originale)
```javascript
material.uniforms.uSpeed.value      = 0.6;
material.uniforms.uVolatility.value = 0.15;
material.uniforms.uSeed.value       = 0.1;
```

### Effetto intenso (distorsione marcata)
```javascript
material.uniforms.uSpeed.value      = 1.2;
material.uniforms.uVolatility.value = 0.35;
material.uniforms.uSeed.value       = 5.0;
```

### Effetto freeze (distorto ma fermo — no animazione)
```javascript
material.uniforms.uSpeed.value      = 0.0;   // fermo nel tempo
material.uniforms.uVolatility.value = 0.2;
material.uniforms.uSeed.value       = 3.7;   // cambia questo per variare la forma
```

---

## Animazione on Hover (attiva solo al passaggio del mouse)

```javascript
var scope = blotter.forText(text);
scope.appendTo(container);

// Stato: distorsione a zero quando idle
material.uniforms.uVolatility.value = 0.0;

var canvas = container.querySelector('canvas');

canvas.addEventListener('mouseenter', function() {
  material.uniforms.uVolatility.value = 0.15;
});

canvas.addEventListener('mouseleave', function() {
  material.uniforms.uVolatility.value = 0.0;
});
```

---

## Animazione con Transizione Fluida (lerp)

Per transizioni morbide tra stati invece di cambi bruschi:

```javascript
var targetVolatility = 0.0;
var currentVolatility = 0.0;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function animate() {
  currentVolatility = lerp(currentVolatility, targetVolatility, 0.08);
  material.uniforms.uVolatility.value = currentVolatility;
  requestAnimationFrame(animate);
}
animate();

canvas.addEventListener('mouseenter', function() { targetVolatility = 0.15; });
canvas.addEventListener('mouseleave', function() { targetVolatility = 0.0;  });
```

---

## Integrazione in React

```jsx
import { useEffect, useRef } from 'react';

// Blotter deve essere caricato come script globale (non ha export ES module)
// Aggiungi nel public/index.html:
// <script src="/blotter.min.js"></script>

function LiquidText({ children, speed = 0.6, volatility = 0.15, seed = 0.1, style = {} }) {
  const containerRef = useRef(null);
  const blotterRef   = useRef(null);

  useEffect(() => {
    if (!window.Blotter || !containerRef.current) return;

    const el = containerRef.current;
    const computed = window.getComputedStyle(el);

    const text = new window.Blotter.Text(children, {
      family  : computed.fontFamily,
      size    : parseFloat(computed.fontSize),
      weight  : computed.fontWeight,
      fill    : computed.color,
      padding : 10
    });

    const material = new window.Blotter.LiquidDistortMaterial();
    material.uniforms.uSpeed.value      = speed;
    material.uniforms.uVolatility.value = volatility;
    material.uniforms.uSeed.value       = seed;

    const blotter = new window.Blotter(material, { texts: text });
    const scope   = blotter.forText(text);
    scope.appendTo(el.parentElement);

    blotterRef.current = blotter;

    return () => {
      // Cleanup: rimuovi canvas al dismount
      const canvas = el.parentElement?.querySelector('canvas.b-canvas');
      if (canvas) canvas.remove();
    };
  }, [children, speed, volatility, seed]);

  return (
    <span
      ref={containerRef}
      style={{ fontFamily: 'DM Sans', fontSize: '200px', fontWeight: 700, ...style }}
    >
      {children}
    </span>
  );
}

// Uso:
// <LiquidText speed={0.6} volatility={0.15}>QUALSIASI TESTO</LiquidText>
```

---

## Problemi Noti e Soluzioni

### Canvas non appare / testo scompare
**Causa**: Il container ha `overflow: hidden` o dimensioni zero.
**Fix**: Assicurarsi che il parent abbia dimensioni esplicite e `overflow: visible`.

### Testo sfocato su Retina
**Causa**: Il canvas non viene scalato correttamente.
**Fix**: Blotter lo gestisce automaticamente — verificare che `devicePixelRatio` non venga sovrascritto nel CSS.

### Performance degradata con molti testi
**Causa**: Ogni istanza `new Blotter()` crea un contesto WebGL separato. I browser limitano il numero di contesti WebGL attivi (tipicamente 8-16).
**Fix**: Passare tutti i `Blotter.Text` a una singola istanza `new Blotter(material, { texts: [text1, text2, text3] })`.

### Font non caricato al momento dell'init
**Causa**: Blotter legge le dimensioni del font al momento della creazione — se il font non è ancora caricato, le misure saranno sbagliate.
**Fix**:
```javascript
document.fonts.ready.then(function() {
  // inizializza Blotter qui
});
```

### L'effetto non si vede su mobile
**Causa**: Alcuni dispositivi mobile disabilitano WebGL o hanno performance insufficienti.
**Fix**: Usare la feature detection e fallback al testo normale:
```javascript
var canvas = document.createElement('canvas');
var hasWebGL = !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));

if (hasWebGL) {
  // inizializza Blotter
} else {
  // mostra testo normale
}
```

---

## File da includere nel progetto

```
progetto/
├── index.html
├── js/
│   ├── blotter.min.js              ← https://raw.githubusercontent.com/bradley/Blotter/master/build/blotter.min.js
│   └── liquidDistortMaterial.js    ← https://raw.githubusercontent.com/bradley/Blotter/master/build/materials/liquidDistortMaterial.js
└── css/
    └── style.css
```

> Blotter.js su npm: `npm install blotter`
> Repository ufficiale: https://github.com/bradley/Blotter
> **Nota**: altri materiali disponibili nella stessa cartella `/build/materials/` della repo (es. `channelSplitMaterial.js`, `rollingDistortMaterial.js`, ecc.)

---

---

## Comportamento di appendTo — Dettaglio DOM

`scope.appendTo(element)` inserisce il canvas come **ultimo figlio** dell'elemento passato, e aggiunge automaticamente i listener per gli eventi mouse (`mousedown`, `mouseup`, `mousemove`, `mouseenter`, `mouseleave`) che vengono re-emessi dal canvas stesso.

```javascript
// appendTo(parent) — il canvas viene inserito come figlio di `parent`
scope.appendTo(textEl.parentElement);

// Dopo la chiamata, il DOM diventa:
// <div class="container">          ← parent passato ad appendTo
//   <span id="my-text"             ← elemento originale
//         style="visibility:hidden">TESTO</span>
//   <canvas class="b-canvas"       ← canvas inserito da Blotter
//           width="..." height="...">TESTO</canvas>
// </div>
```

> **Attenzione**: `appendTo` non rimuove l'elemento originale — lo nasconde con `visibility: hidden`. L'elemento occupa ancora spazio nel layout. Se serve rimuoverlo fisicamente, farlo manualmente dopo l'inizializzazione.

---

## Device Pixel Ratio — Come Blotter lo Calcola

Blotter calcola il ratio esatto leggendo sia `window.devicePixelRatio` che il `backingStorePixelRatio` del contesto Canvas 2D (con fallback sui vendor prefix `ms`, `moz`, `webkit`, `o`):

```javascript
// Logica interna di Blotter (da blotter.min.js):
var devicePixelRatio  = window.devicePixelRatio || 1;
var backingStoreRatio = ctx.backingStorePixelRatio
                     || ctx.webkitBackingStorePixelRatio
                     || ctx.mozBackingStorePixelRatio
                     || ctx.msBackingStorePixelRatio
                     || ctx.oBackingStorePixelRatio
                     || 1;
var ratio = devicePixelRatio / backingStoreRatio;
```

Questo spiega i canvas a risoluzione doppia osservati nel sito originale (ratio ~1.75 su display HiDPI). Il canvas viene creato a `larghezza × ratio` pixel, ma visualizzato a `larghezza` CSS pixel — garantendo nitidezza su Retina senza configurazione manuale.

---

## WebGL — Requisito e Gestione Errori

Blotter verifica la disponibilità di WebGL all'avvio usando `Detector.webgl` (incluso in blotter.min.js). Se WebGL non è disponibile, **lancia un errore esplicito** invece di degradare silenziosamente:

```javascript
// Comportamento interno di Blotter se WebGL manca:
// Blotter.Messaging.throwError("Blotter", false, "device does not support webgl")
// → throw "Blotter: device does not support webgl"
```

**Pattern consigliato** — verificare prima di inizializzare:

```javascript
// Detector è incluso in blotter.min.js e disponibile globalmente
if (typeof Blotter === 'undefined') {
  console.error('blotter.min.js non caricato');
} else if (!Detector.webgl) {
  // fallback: mostra testo normale senza effetto
  console.warn('WebGL non disponibile — effetto disabilitato');
} else {
  // sicuro inizializzare Blotter
  var text = new Blotter.Text('TESTO', { ... });
  // ...
}
```

## Sintesi del Meccanismo

```
Font CSS → Blotter.Text (config) → LiquidDistortMaterial (shader GLSL)
                                          ↓
                              snoise(vec3(uv.x, uv.y, time × speed)) × volatility
                                          ↓
                              UV distorte → textTexture(uv_distorto)
                                          ↓
                              Canvas WebGL (sostituisce il tag testo nel DOM)
                                          ↓
                              requestAnimationFrame → loop continuo
```
