/**
 * HTML for the Welcome tour's demo screens and diagrams. Functions take a
 * strings object so each piece can be rendered once per locale.
 */

export const STR = {
  en: {
    date: 'TUESDAY, 14 MAY', hello: 'Hi, Maya', today: 'Today', habitsDone: 'habits done', habits: 'Your habits', all: 'See all',
    h1: 'Morning run', h1s: '5 km · 7:00', h2: 'Read 20 pages', h2s: 'Evening', h3: 'Drink water', h3s: '6 of 8 glasses', h4: 'Meditate', h4s: '10 min',
    week: 'THIS WEEK', streak: '12 day streak', tabs: ['Today', 'Habits', 'Stats', 'Profile'],
    design: 'You design here', exported: 'Exported', notExported: 'Not exported',
    tBase: 'Your design', tFormat: 'Format', tFormatNote: 'pins position & size', tLocale: 'Locale', tLocaleNote: 'adjusts on top', tBaseNote: 'shared by everything',
    layer: 'Layer', english: 'English', spanish: 'Spanish', def: 'Default', headline: 'Headline', subtitle: 'Subtitle', button: 'Button', shot: 'Screenshot',
  },
  es: {
    date: 'MARTES, 14 DE MAYO', hello: 'Hola, Maya', today: 'Hoy', habitsDone: 'hábitos hechos', habits: 'Tus hábitos', all: 'Ver todos',
    h1: 'Correr por la mañana', h1s: '5 km · 7:00', h2: 'Leer 20 páginas', h2s: 'Por la tarde', h3: 'Beber agua', h3s: '6 de 8 vasos', h4: 'Meditar', h4s: '10 min',
    week: 'ESTA SEMANA', streak: 'Racha de 12 días', tabs: ['Hoy', 'Hábitos', 'Datos', 'Perfil'],
    design: 'Aquí diseñas', exported: 'Se exporta', notExported: 'No se exporta',
    tBase: 'Tu diseño', tFormat: 'Formato', tFormatNote: 'fija posición y tamaño', tLocale: 'Idioma', tLocaleNote: 'ajusta por encima', tBaseNote: 'compartido por todo',
    layer: 'Capa', english: 'Inglés', spanish: 'Español', def: 'Default', headline: 'Titular', subtitle: 'Subtítulo', button: 'Botón', shot: 'Captura',
  },
}

const habit = (emoji, title, sub, done, tone = '') => `
  <div class="item">
    <div class="tile ${tone}">${emoji}</div>
    <div class="grow"><div class="h3">${title}</div><div class="sm muted">${sub}</div></div>
    <div class="check round ${done ? 'on' : ''}"><i class="ic s16">check</i></div>
  </div>`

export const homeScreen = (t) => `
<div class="screen">
  <div class="topbar">
    <div><div class="xs muted semi">${t.date}</div><div class="h1">${t.hello}</div></div>
    <div class="avatar">MJ</div>
  </div>
  <div class="card hero" style="padding:20px">
    <div class="row between">
      <div class="col g6">
        <div class="caps" style="opacity:.8">${t.today}</div>
        <div class="kpi num">4<span style="opacity:.6;font-size:28px"> / 6</span></div>
        <div class="sm semi" style="opacity:.85">${t.habitsDone}</div>
      </div>
      <div class="ring" style="--v:67;--size:112px;--thick:12px;--c:#fff"><div class="h2">67%</div></div>
    </div>
  </div>
  <div class="row between"><div class="h2">${t.habits}</div><div class="sm semi primary">${t.all}</div></div>
  <div class="list cards">
    ${habit('🏃', t.h1, t.h1s, true)}
    ${habit('📚', t.h2, t.h2s, true, 'accent')}
    ${habit('💧', t.h3, t.h3s, false, 'good')}
    ${habit('🧘', t.h4, t.h4s, true)}
  </div>
  <div class="card" style="padding:16px">
    <div class="row between" style="margin-bottom:12px">
      <div class="xs muted semi">${t.week}</div>
      <span class="badge accent">🔥 ${t.streak}</span>
    </div>
    <div class="bars" style="--h:74px">
      <i style="--v:60%"></i><i style="--v:82%"></i><i style="--v:45%"></i><i class="on" style="--v:100%"></i><i style="--v:70%"></i><i style="--v:30%"></i><i style="--v:18%"></i>
    </div>
  </div>
  <div class="tabbar">
    <div class="on"><i class="ic fill">today</i>${t.tabs[0]}</div>
    <div><i class="ic">checklist</i>${t.tabs[1]}</div>
    <div><i class="ic">insights</i>${t.tabs[2]}</div>
    <div><i class="ic">person</i>${t.tabs[3]}</div>
  </div>
  <div class="home-ind"></div>
</div>`

export const photo = (emoji, caption, sub, gradient) => `
<div class="photo" style="background:${gradient}">
  <div class="big">${emoji}</div>
  <div class="cap">${caption}</div>
  <div class="sub">${sub}</div>
</div>`

/** PixelDeck icon mark (the two cards from public/logo.svg). */
export const logoMark = () => `
<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 36" width="100%" height="100%" fill="none">
  <defs>
    <linearGradient id="l" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b49eff"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient>
    <linearGradient id="r" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9d6ef6"/><stop offset="100%" stop-color="#ec4899"/></linearGradient>
  </defs>
  <rect x="2" y="3" width="14" height="30" rx="3.5" fill="url(#l)"/>
  <rect x="4.5" y="10" width="9" height="1.8" rx="0.9" fill="white" fill-opacity="0.6"/>
  <rect x="4.5" y="13.5" width="6.5" height="1.8" rx="0.9" fill="white" fill-opacity="0.35"/>
  <rect x="4.5" y="18" width="9" height="9" rx="1.5" fill="white" fill-opacity="0.15"/>
  <rect x="18" y="3" width="14" height="30" rx="3.5" fill="url(#r)"/>
  <rect x="20.5" y="10" width="9" height="1.8" rx="0.9" fill="white" fill-opacity="0.6"/>
  <rect x="20.5" y="13.5" width="6.5" height="1.8" rx="0.9" fill="white" fill-opacity="0.35"/>
  <rect x="20.5" y="18" width="9" height="9" rx="1.5" fill="white" fill-opacity="0.15"/>
</svg></div>`

/** Base → iPhone / Android. Mini canvases keep the real aspect ratios. */
export const formatsDiagram = (t) => `
<div class="dg">
  <div class="box violet" style="width:170px;height:324px">
    <div class="mini" style="width:88px;height:190px"></div>
    <div class="name">Base</div><div class="note">1290 × 2796</div>
    <span class="tag t-violet">${t.design}</span>
  </div>
  <div class="arrow">arrow_forward</div>
  <div class="box amber" style="width:170px;height:324px">
    <div class="mini" style="width:88px;height:190px"></div>
    <div class="name">iPhone</div><div class="note">1320 × 2868</div>
    <span class="tag t-amber">${t.exported}</span>
  </div>
  <div class="box amber" style="width:170px;height:324px">
    <div class="mini" style="width:107px;height:190px"></div>
    <div class="name">Android</div><div class="note">1080 × 1920</div>
    <span class="tag t-amber">${t.exported}</span>
  </div>
</div>`

/** The three tiers, stacked: base, then format pins, then locale adjusts. */
const tier = (tone, name, note) => `
  <div class="box ${tone}" style="width:100%;flex:1;flex-direction:row;justify-content:space-between;padding:0 22px">
    <div class="name">${name}</div><div class="note" style="font-size:15px">${note}</div>
  </div>`

export const tiersDiagram = (t) => `
<div class="dg" style="flex-direction:column;gap:10px;padding:4px">
  ${tier('violet', 'Base', t.tBaseNote)}
  ${tier('amber', `+ ${t.tFormat}`, t.tFormatNote)}
  ${tier('teal', `+ ${t.tLocale}`, t.tLocaleNote)}
</div>`

export const tableDiagram = (t) => `
<div class="tbl"><div class="sheet">
  <div class="r head"><div>${t.layer}</div><div><span class="dot" style="background:#a78bfa"></span>EN · ${t.def}</div><div><span class="dot" style="background:#22d3c5"></span>ES</div></div>
  <div class="r"><div class="k">${t.headline}</div><div>Build habits</div><div class="es">Crea hábitos</div></div>
  <div class="r"><div class="k">${t.subtitle}</div><div>Day by day</div><div class="es">Día a día</div></div>
  <div class="r"><div class="k">${t.button}</div><div>Start</div><div class="es">Empezar<span class="ai">AI</span></div></div>
  <div class="r"><div class="k">${t.shot}</div><div>home-en.png</div><div class="es">home-es.png</div></div>
</div></div>`

const pngs = (n) => `${'<div class="png"></div>'.repeat(3)}<span class="more">+${n}</span>`

/** locale × format grid. `n` = screenshots per cell beyond the three drawn. */
export const matrixDiagram = (n) => `
<div class="mx">
  <div></div>
  <div class="h dg t-amber">iPhone</div><div class="h dg t-amber">Android</div>
  <div class="h dg t-teal">EN</div><div class="cell">${pngs(n)}</div><div class="cell">${pngs(n)}</div>
  <div class="h dg t-teal">ES</div><div class="cell">${pngs(n)}</div><div class="cell">${pngs(n)}</div>
</div>`

const mini = (name, gradient, ink = '#fff') => `
  <div style="width:112px;height:214px;border-radius:18px;background:${gradient};display:flex;align-items:flex-end;padding:12px;box-shadow:0 14px 30px rgba(0,0,0,.35)">
    <div style="font-family:var(--display);font-weight:700;font-size:16px;color:${ink}">${name}</div>
  </div>`

/** Five mini covers standing in for the bundled templates. */
export const galleryDiagram = () => `
<div class="dg" style="gap:14px">
  ${mini('Pulse', 'linear-gradient(160deg,#1a2114,#0b0d0c 60%),#0b0d0c', '#c8f53c')}
  ${mini('Ledgr', 'linear-gradient(160deg,#3b2a8c,#0b1030)')}
  ${mini('Flowly', 'linear-gradient(160deg,#eef2ff,#c7d2fe)', '#312e81')}
  ${mini('Brightly', 'linear-gradient(160deg,#ffd75e,#ff9f43)', '#4c1d95')}
  ${mini('Basket', 'linear-gradient(160deg,#fff8ee,#f6d9b8)', '#14532d')}
</div>`
