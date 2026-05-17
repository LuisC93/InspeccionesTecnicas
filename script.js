const API    = 'https://script.google.com/macros/s/AKfycbzi5uz_yXztApKTp-ie6RUBjsPOTbNkmoNdTPR2veWfFh3_9aRBMdpuQ_XPtxm5PttGOA/exec';
const API_AP = 'https://script.google.com/macros/s/AKfycbzi2ov6jkziVt4GO_GF_HZFfOHQQsz7J-MtZZ-rauthSFkPqUenJ84KJK_sl45I1NS_/exec';

const FASE_CFG = {
  'Fase 1': { color: 'var(--red)' },
  'Fase 2': { color: '#fd7e14' },
  'Fase 3': { color: 'var(--yellow)' },
  'Fase 4': { color: 'var(--green)' },
};

const PG = 25;
let RAW = [], DATA = [], AP_MAP = {}, curFase = '', filtered = [], page = 1;
let _dlCounter = 0;

function procesarData(raw) {
  // Solo registros con Fase CAPRES válida
  const conFase = raw.filter(r => {
    const f = r['Fase CAPRES'] || '';
    return f.startsWith('Fase');
  });
  const map = {};
  conFase.forEach((r) => {
    const ce = r['NOMBRE CE'] || r['Nombre de Centro Educativo'] || '';
    const vis = parseFloat(r['N° VISITA'] || r['# de Visita'] || '0') || 0;
    if (!map[ce] || vis > parseFloat(map[ce]['N° VISITA'] || map[ce]['# de Visita'] || '0')) {
      map[ce] = r;
    }
  });
  return Object.values(map);
}

function fetchJSONP(url) {
  return new Promise((resolve, reject) => {
    const cb = 'cb_' + Date.now();
    const script = document.createElement('script');
    const timer = setTimeout(() => {
      delete window[cb];
      document.body.removeChild(script);
      reject(new Error('JSONP timeout'));
    }, 20000);
    window[cb] = (data) => {
      clearTimeout(timer);
      delete window[cb];
      document.body.removeChild(script);
      resolve(data.centros || data.inspecciones || data.data || []);
    };
    script.src = url + '&callback=' + cb;
    script.onerror = () => reject(new Error('JSONP failed'));
    document.body.appendChild(script);
  });
}

async function cargarAP() {
  try {
    const res = await fetch(API_AP, { redirect: 'follow', mode: 'cors' });
    const json = await res.json();
    AP_MAP = {};
    (json.ap || []).forEach(item => {
      AP_MAP[String(item.codigo).trim()] = parseInt(item.cantidad) || 0;
    });
  } catch (e) {
    AP_MAP = {};
  }
}

function getAP(r) {
  const cod = (g(r, 'CÓD CE') || '').toString().trim() || (g(r, 'NOMBRE CE').match(/^(\d+)/) || [])[1] || '';
  if (cod && AP_MAP[cod] !== undefined) return AP_MAP[cod];
  return parseFloat(r['Cantidad de AP instalados']) || 0;
}

async function init() {
  renderL1skeleton();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    const res = await fetch(API, { signal: ctrl.signal, redirect: 'follow', mode: 'cors' });
    clearTimeout(t);
    const json = await res.json();
    RAW = json.centros || json.inspecciones || json.data || [];
    DATA = procesarData(RAW);
    setApi(true, `${DATA.length.toLocaleString()} centros · Matrix`);
  } catch (e) {
    try {
      const json = await fetchJSONP(API);
      RAW = json.centros || json.inspecciones || json.data || [];
      DATA = procesarData(RAW);
      setApi(true, `${DATA.length.toLocaleString()} centros`);
    } catch (e2) {
      setApi(false, 'Sin conexión');
      DATA = [];
    }
  }
  renderL1();
  cargarAP().then(() => {
    if (Object.keys(AP_MAP).length > 0) renderL1();
  });
}

function renderL1skeleton() {
  document.getElementById('kpi-row').innerHTML = Array(6).fill(0).map(() => `<div class="kpi" style="--kc:var(--blue)"><div style="width:28px;height:28px;background:var(--surface2);border-radius:6px;flex-shrink:0"></div><div class="kpi-right"><div style="width:60px;height:18px;background:var(--surface2);border-radius:4px;margin-bottom:4px"></div><div style="width:80px;height:10px;background:var(--surface3);border-radius:4px"></div></div></div>`).join('');
  document.getElementById('fases-grid').innerHTML = Array(4).fill(0).map(() => `<div class="fc" style="--fcolor:var(--border);pointer-events:none"><div class="fc-top"><div class="fc-school-icon" style="background:var(--surface2);border:1px solid var(--border);"><div class="spinner" style="width:24px;height:24px;border-width:2px"></div></div><div class="fc-info"><div style="width:50px;height:10px;background:var(--surface2);border-radius:4px;margin-bottom:8px"></div><div style="width:60px;height:36px;background:var(--surface2);border-radius:6px;margin-bottom:6px"></div><div style="width:100px;height:10px;background:var(--surface3);border-radius:4px"></div></div></div><div class="fc-bar"><div class="fc-fill" style="width:0%"></div></div><div class="fc-bottom">${Array(3).fill(0).map(() => `<div class="fc-stat2"><div style="width:40px;height:14px;background:var(--surface2);border-radius:4px;margin:0 auto 4px"></div><div style="width:50px;height:9px;background:var(--surface3);border-radius:4px;margin:0 auto"></div></div>`).join('')}</div></div>`).join('');
}

function setApi(ok, txt) {
    const c = ok ? 'var(--green)' : 'var(--red)';
    const el = document.getElementById('api-st');
    const dot = document.getElementById('api-dot');
    dot.style.background = c;
    dot.style.animation = ok ? 'blink 2s infinite' : 'none';
    document.getElementById('api-txt').textContent = txt;
    const finalColor = ok ? getComputedStyle(document.documentElement).getPropertyValue('--green') : getComputedStyle(document.documentElement).getPropertyValue('--red');
    el.style.borderColor = `${finalColor.trim()}50`;
    el.style.color = c;
}

// ── Barra de info fija abajo ──
const FASE_INFO = {
  'Fase 1': { icon:'🔴', titulo:'Infraestructura deficiente', desc:'Esta escuela tiene problemas serios — puede que no tenga luz estable, el edificio esté en mal estado o simplemente no cuente con lo básico para instalar internet. Es la etapa más crítica.', tags:['Edificio en mal estado','Sin electricidad estable','Sin condiciones para red'], color:'#dc2626' },
  'Fase 2': { icon:'🟠', titulo:'Sin red interna', desc:'La escuela tiene el servicio de internet contratado y llega señal, pero adentro del edificio no hay cables ni antenas instaladas. Los alumnos y maestros no pueden conectarse.', tags:['Internet llega pero no se distribuye','Sin antenas Wi-Fi','Sin cables internos'], color:'#ea580c' },
  'Fase 3': { icon:'🟡', titulo:'Red instalada con fallas', desc:'Ya hay antenas y cables adentro de la escuela, pero la conexión no cubre todos los salones o la velocidad no es suficiente. Funciona a medias.', tags:['Antenas instaladas','Cobertura Wi-Fi incompleta','Velocidad insuficiente'], color:'#b45309' },
  'Fase 4': { icon:'🟢', titulo:'Completamente funcional', desc:'Esta escuela tiene todo en orden — internet estable, antenas cubriendo todos los salones y la velocidad contratada funcionando correctamente. Lista para aprender en línea.', tags:['Internet estable','Cobertura Wi-Fi completa','Red funcionando correctamente'], color:'#059669' },
};
let _ibt = null;

function showInfoBar(fase) {
  const d = FASE_INFO[fase]; if (!d) return;
  clearTimeout(_ibt);
  const bar = document.getElementById('info-bar');
  bar.style.borderTopColor = d.color;
  document.getElementById('info-bar-icon').textContent  = d.icon;
  document.getElementById('info-bar-title').textContent = fase + ' · ' + d.titulo;
  document.getElementById('info-bar-title').style.color = d.color;
  document.getElementById('info-bar-desc').textContent  = d.desc;
  document.getElementById('info-bar-tags').innerHTML = d.tags.map(t =>
    `<span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;background:${d.color}18;color:${d.color};border:1px solid ${d.color}35">● ${t}</span>`
  ).join('');
  bar.style.transform = 'translateY(0)';
  bar.style.pointerEvents = 'all';
}

function hideInfoBar(delay) {
  _ibt = setTimeout(() => {
    const bar = document.getElementById('info-bar');
    bar.style.transform = 'translateY(100%)';
    bar.style.pointerEvents = 'none';
  }, delay || 0);
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') hideInfoBar(0); });

function renderL1() {
  const n = DATA.length;          // Total con Fase CAPRES válida
  const nd = DATA.length;
  const op = DATA.filter((r) => g(r, 'Estado de enlace').includes('Operativo')).length;
  const fall = DATA.filter((r) => g(r, 'Estado de enlace').includes('Down') || g(r, 'Estado de enlace') === 'CFO').length;
  const ctrl = DATA.filter((r) => g(r, 'Estado de enlace').includes('Operativo')).length;
  const ap = DATA.reduce((s, r) => s + (parseFloat(getAP(r)) || 0), 0);
  const ab = DATA.reduce((s, r) => s + (parseFloat(g(r, 'Ancho de Banda')) || 0), 0);
  document.getElementById('l1-sub').textContent = `${n.toLocaleString()} centros escolares · Fase CAPRES`;
  const kpiSVGs = {
    school: `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 200 175" fill="none"><line x1="100" y1="28" x2="100" y2="8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><polygon points="100,8 114,13 100,19" fill="currentColor"/><rect x="58" y="28" width="84" height="10" rx="2" fill="currentColor" fill-opacity="0.25" stroke="currentColor" stroke-width="2"/><rect x="64" y="38" width="72" height="108" rx="3" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-width="2.5"/><rect x="72" y="46" width="56" height="13" rx="2.5" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="1.5"/><rect x="70" y="68" width="16" height="16" rx="2.5" fill="currentColor" fill-opacity="0.2" stroke="currentColor" stroke-width="1.8"/><line x1="78" y1="68" x2="78" y2="84" stroke="currentColor" stroke-width="1.1"/><line x1="70" y1="76" x2="86" y2="76" stroke="currentColor" stroke-width="1.1"/><rect x="92" y="68" width="16" height="16" rx="2.5" fill="currentColor" fill-opacity="0.2" stroke="currentColor" stroke-width="1.8"/><line x1="100" y1="68" x2="100" y2="84" stroke="currentColor" stroke-width="1.1"/><line x1="92" y1="76" x2="108" y2="76" stroke="currentColor" stroke-width="1.1"/><rect x="114" y="68" width="16" height="16" rx="2.5" fill="currentColor" fill-opacity="0.2" stroke="currentColor" stroke-width="1.8"/><line x1="122" y1="68" x2="122" y2="84" stroke="currentColor" stroke-width="1.1"/><line x1="114" y1="76" x2="130" y2="76" stroke="currentColor" stroke-width="1.1"/><rect x="70" y="94" width="16" height="14" rx="2" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="1.5"/><rect x="114" y="94" width="16" height="14" rx="2" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="1.5"/><rect x="88" y="112" width="24" height="34" rx="12" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-width="2"/><circle cx="108" cy="130" r="1.8" fill="currentColor"/><rect x="28" y="72" width="38" height="74" rx="2" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="2"/><rect x="35" y="82" width="12" height="12" rx="2" fill="currentColor" fill-opacity="0.2" stroke="currentColor" stroke-width="1.5"/><line x1="41" y1="82" x2="41" y2="94" stroke="currentColor" stroke-width="1"/><rect x="50" y="82" width="12" height="12" rx="2" fill="currentColor" fill-opacity="0.2" stroke="currentColor" stroke-width="1.5"/><rect x="35" y="102" width="12" height="11" rx="2" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="1.3"/><rect x="50" y="102" width="12" height="11" rx="2" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="1.3"/><rect x="134" y="72" width="38" height="74" rx="2" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="2"/><rect x="141" y="82" width="12" height="12" rx="2" fill="currentColor" fill-opacity="0.2" stroke="currentColor" stroke-width="1.5"/><line x1="147" y1="82" x2="147" y2="94" stroke="currentColor" stroke-width="1"/><rect x="156" y="82" width="12" height="12" rx="2" fill="currentColor" fill-opacity="0.2" stroke="currentColor" stroke-width="1.5"/><rect x="141" y="102" width="12" height="11" rx="2" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="1.3"/><rect x="156" y="102" width="12" height="11" rx="2" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="1.3"/><rect x="28" y="145" width="144" height="5" rx="2" fill="currentColor" fill-opacity="0.28"/><rect x="78" y="150" width="44" height="4" rx="1.5" fill="currentColor" fill-opacity="0.18"/></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 80 110" fill="none"><path d="M6,50 Q40,10 74,50" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M14,62 Q40,30 66,62" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M22,74 Q40,54 58,74" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="40" cy="86" r="5" fill="currentColor"/><circle cx="62" cy="24" r="14" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-width="2.5"/><polyline points="55,24 60,30 70,18" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,
    alert: `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 80 110" fill="none"><path d="M6,50 Q40,10 74,50" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-opacity="0.3"/><path d="M14,62 Q40,30 66,62" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-opacity="0.3"/><path d="M22,74 Q40,54 58,74" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-opacity="0.3"/><circle cx="40" cy="86" r="5" fill="currentColor" fill-opacity="0.3"/><circle cx="62" cy="24" r="14" fill="currentColor" fill-opacity="0.12" stroke="currentColor" stroke-width="2.5"/><line x1="55" y1="17" x2="69" y2="31" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><line x1="69" y1="17" x2="55" y2="31" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
    ctrl: `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 80 100" fill="none"><rect x="4" y="30" width="72" height="32" rx="8" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="2.5"/><line x1="20" y1="30" x2="14" y2="6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="14" cy="4" r="3" fill="currentColor"/><line x1="60" y1="30" x2="66" y2="6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="66" cy="4" r="3" fill="currentColor"/><circle cx="18" cy="46" r="4" fill="currentColor" fill-opacity="0.9"/><circle cx="32" cy="46" r="4" fill="currentColor" fill-opacity="0.5"/><circle cx="46" cy="46" r="4" fill="currentColor" fill-opacity="0.3"/><rect x="55" y="40" width="14" height="10" rx="2" fill="currentColor" fill-opacity="0.25" stroke="currentColor" stroke-width="1.5"/><line x1="58" y1="42" x2="58" y2="48" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><line x1="62" y1="42" x2="62" y2="48" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><line x1="66" y1="42" x2="66" y2="48" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><line x1="40" y1="62" x2="40" y2="74" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><rect x="28" y="74" width="24" height="10" rx="3" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-width="2"/></svg>`,
    ap: `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 80 120" fill="none"><line x1="40" y1="100" x2="40" y2="48" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><rect x="24" y="98" width="32" height="6" rx="3" fill="currentColor" fill-opacity="0.25" stroke="currentColor" stroke-width="2"/><rect x="30" y="104" width="20" height="4" rx="2" fill="currentColor" fill-opacity="0.15"/><line x1="20" y1="60" x2="60" y2="60" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M20,46 Q10,60 20,74" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/><path d="M60,46 Q70,60 60,74" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/><path d="M28,38 Q40,28 52,38" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" stroke-opacity="0.6"/><path d="M20,28 Q40,14 60,28" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" stroke-opacity="0.35"/><path d="M12,18 Q40,0 68,18" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" stroke-opacity="0.2"/></svg>`,
    bolt: `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 80 110" fill="none"><polygon points="48,6 20,58 38,58 30,104 62,46 42,46 60,6" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><line x1="42" y1="30" x2="36" y2="58" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.4"/></svg>`,
  };
  document.getElementById('kpi-row').innerHTML = [
    { ico: 'school', val: n.toLocaleString(),                lbl: 'Total Escuelas',        sub: 'Registradas en CAPRES',       kc: 'var(--blue)'   },
    { ico: 'check',  val: op.toLocaleString(),               lbl: 'Escuelas con Internet',  sub: pct(op, nd) + '% del total',   kc: 'var(--green)'  },
    { ico: 'alert',  val: fall.toLocaleString(),             lbl: 'Sin Conexión',           sub: pct(fall, nd) + '% del total', kc: 'var(--red)'    },
    { ico: 'ctrl',   val: ctrl.toLocaleString(),             lbl: 'Red Verificada',         sub: pct(ctrl, nd) + '% del total', kc: '#f97316'       },
    { ico: 'ap',     val: Math.round(ap).toLocaleString(),   lbl: 'Antenas Wi-Fi',          sub: 'Total instaladas',            kc: 'var(--purple)' },
    { ico: 'bolt',   val: (ab / 1000).toFixed(2) + ' Gbps', lbl: 'Velocidad Total',        sub: 'Suma de todas las escuelas',  kc: 'var(--cyan)'   },
  ].map(k => `<div class="kpi" style="--kc:${k.kc}"><div class="kpi-ico" style="color:${k.kc};width:32px;flex-shrink:0">${kpiSVGs[k.ico]}</div><div class="kpi-right"><div class="kpi-val">${k.val}</div><div class="kpi-lbl">${k.lbl}</div><div class="kpi-sub">${k.sub}</div></div></div>`).join('');
  document.getElementById('fases-grid').innerHTML = ['Fase 1', 'Fase 2', 'Fase 3', 'Fase 4'].map(fase => {
    const items = DATA.filter(r => getFase(r) === fase);
    const schoolIcon = (color) => `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 144 160" fill="none">
      <line x1="72" y1="28" x2="72" y2="8" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>
      <polygon points="72,8 86,13 72,19" fill="${color}"/>
      <rect x="30" y="28" width="84" height="10" rx="2" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="2"/>
      <rect x="36" y="38" width="72" height="108" rx="3" fill="${color}" fill-opacity="0.07" stroke="${color}" stroke-width="2.5"/>
      <rect x="44" y="46" width="56" height="13" rx="2.5" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="1.5"/>
      <rect x="42" y="68" width="16" height="16" rx="2.5" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1.8"/>
      <line x1="50" y1="68" x2="50" y2="84" stroke="${color}" stroke-width="1.1"/>
      <line x1="42" y1="76" x2="58" y2="76" stroke="${color}" stroke-width="1.1"/>
      <rect x="64" y="68" width="16" height="16" rx="2.5" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1.8"/>
      <line x1="72" y1="68" x2="72" y2="84" stroke="${color}" stroke-width="1.1"/>
      <line x1="64" y1="76" x2="80" y2="76" stroke="${color}" stroke-width="1.1"/>
      <rect x="86" y="68" width="16" height="16" rx="2.5" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1.8"/>
      <line x1="94" y1="68" x2="94" y2="84" stroke="${color}" stroke-width="1.1"/>
      <line x1="86" y1="76" x2="102" y2="76" stroke="${color}" stroke-width="1.1"/>
      <rect x="42" y="94" width="16" height="14" rx="2" fill="${color}" fill-opacity="0.14" stroke="${color}" stroke-width="1.5"/>
      <rect x="86" y="94" width="16" height="14" rx="2" fill="${color}" fill-opacity="0.14" stroke="${color}" stroke-width="1.5"/>
      <rect x="60" y="112" width="24" height="34" rx="12" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="2"/>
      <circle cx="80" cy="130" r="1.8" fill="${color}"/>
      <rect x="0" y="72" width="38" height="74" rx="2" fill="${color}" fill-opacity="0.06" stroke="${color}" stroke-width="2"/>
      <rect x="7" y="82" width="12" height="12" rx="2" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1.5"/>
      <line x1="13" y1="82" x2="13" y2="94" stroke="${color}" stroke-width="1"/>
      <rect x="22" y="82" width="12" height="12" rx="2" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1.5"/>
      <rect x="7" y="102" width="12" height="11" rx="2" fill="${color}" fill-opacity="0.13" stroke="${color}" stroke-width="1.3"/>
      <rect x="22" y="102" width="12" height="11" rx="2" fill="${color}" fill-opacity="0.13" stroke="${color}" stroke-width="1.3"/>
      <rect x="106" y="72" width="38" height="74" rx="2" fill="${color}" fill-opacity="0.06" stroke="${color}" stroke-width="2"/>
      <rect x="113" y="82" width="12" height="12" rx="2" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1.5"/>
      <line x1="119" y1="82" x2="119" y2="94" stroke="${color}" stroke-width="1"/>
      <rect x="128" y="82" width="12" height="12" rx="2" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1.5"/>
      <rect x="113" y="102" width="12" height="11" rx="2" fill="${color}" fill-opacity="0.13" stroke="${color}" stroke-width="1.3"/>
      <rect x="128" y="102" width="12" height="11" rx="2" fill="${color}" fill-opacity="0.13" stroke="${color}" stroke-width="1.3"/>
      <rect x="0" y="145" width="144" height="5" rx="2" fill="${color}" fill-opacity="0.28"/>
      <rect x="50" y="150" width="44" height="4" rx="1.5" fill="${color}" fill-opacity="0.18"/>
      <rect x="56" y="154" width="32" height="3" rx="1" fill="${color}" fill-opacity="0.12"/>
    </svg>`;
    const cfg = FASE_CFG[fase] || { color: 'var(--muted)' };
    const p = pct(items.length, nd);
    const opF = items.filter(r => g(r, 'Estado de enlace').includes('Operativo')).length;
    const abF = items.reduce((s, r) => s + (parseFloat(g(r, 'Ancho de Banda')) || 0), 0);
    const apF = items.reduce((s, r) => s + (parseFloat(getAP(r)) || 0), 0);
    const fNum = fase.replace('Fase ', '');
    
    return `<div class="fc" style="--fcolor:${cfg.color}" onclick="goL2('${fase}')" onmouseenter="showInfoBar('${fase}')" onmouseleave="hideInfoBar(300)"><div class="fc-top"><div class="fc-school-icon">${schoolIcon(cfg.color)}</div><div class="fc-info"><div class="fc-label">FASE ${fNum}</div><div class="fc-num">${items.length.toLocaleString()}</div><div class="fc-desc">Centros Escolares</div></div></div><div class="fc-bar"><div class="fc-fill" style="width:${p}%"></div></div><div class="fc-bottom"><div class="fc-stat2"><div class="fc-stat2-v" style="color:${cfg.color}">${opF.toLocaleString()}</div><div class="fc-stat2-l">Operativos</div></div><div class="fc-stat2"><div class="fc-stat2-v" style="color:${cfg.color}">${(abF/1000).toFixed(1)} Gbps</div><div class="fc-stat2-l">Ancho de Banda</div></div><div class="fc-stat2"><div class="fc-stat2-v" style="color:${cfg.color}">${Math.round(apF).toLocaleString()}</div><div class="fc-stat2-l">AP Instalados</div></div></div><div class="fc-pct">${p}% del total</div><div class="fc-arrow">›</div></div>`;
  }).join('');
}

function goL2(fase) {
  if (fase) curFase = fase;
  page = 1;
  const cfg = FASE_CFG[curFase] || { color: 'var(--blue)' };
  const FASE_DESC = {
    'Fase 1': {
      titulo: '⚠️ Infraestructura deficiente',
      desc: 'Esta escuela tiene problemas serios — puede que no tenga luz estable, el edificio esté en mal estado o simplemente no cuente con lo básico para instalar internet. Es la etapa más crítica.',
      tags: ['Edificio en mal estado', 'Sin electricidad estable', 'Sin condiciones para instalar red'],
    },
    'Fase 2': {
      titulo: '📦 Sin red interna',
      desc: 'La escuela tiene el servicio de internet contratado y llega señal, pero adentro del edificio no hay cables ni antenas instaladas. Los alumnos y maestros no pueden conectarse.',
      tags: ['Internet llega pero no se distribuye', 'Sin antenas Wi-Fi', 'Sin cables de red internos'],
    },
    'Fase 3': {
      titulo: '🔧 Red instalada con fallas',
      desc: 'Ya hay antenas y cables adentro de la escuela, pero la conexión no cubre todos los salones o la velocidad no es suficiente. Funciona a medias.',
      tags: ['Antenas instaladas', 'Cobertura Wi-Fi incompleta', 'Velocidad insuficiente'],
    },
    'Fase 4': {
      titulo: '✅ Completamente funcional',
      desc: 'Esta escuela tiene todo en orden — internet estable, antenas cubriendo todos los salones y la velocidad contratada funcionando correctamente. Lista para aprender en línea.',
      tags: ['Internet estable', 'Cobertura Wi-Fi completa', 'Red funcionando correctamente'],
    },
  };

  const fd = DATA.filter(r => getFase(r) === curFase);
  document.getElementById('l2-h').textContent = 'Centros Escolares — ' + curFase;
  badge('l2-badge', curFase, cfg.color);

  // Banner descriptivo de la fase
  const desc = FASE_DESC[curFase] || {};
  const bannerEl = document.getElementById('fase-banner');
  if (bannerEl && desc.titulo) {
    bannerEl.style.display = 'block';
    bannerEl.style.borderColor = cfg.color;
    bannerEl.innerHTML = `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="font-size:15px;font-weight:700;color:${cfg.color};margin-bottom:6px">${desc.titulo}</div>
          <div style="font-size:13px;color:var(--muted);line-height:1.6">${desc.desc}</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start;padding-top:2px">
          ${(desc.tags||[]).map(t => `<span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;background:${cfg.color}14;color:${cfg.color};border:1px solid ${cfg.color}30">● ${t}</span>`).join('')}
        </div>
      </div>`;
  }

  fillSel('f-dep', [...new Set(fd.map(r => g(r, 'DEPTO')).filter(Boolean))].sort(), 'Todos los departamentos');
  fillSel('f-enl', [...new Set(fd.map(r => g(r, 'Estado de enlace')).filter(Boolean))].sort(), 'Estado enlace');
  const catNorm = v => (v.includes('Integral') || v.includes('Falta instalar 1')) ? 'Completa' : v;
  const catOpts = [...new Set(fd.map(r => catNorm(g(r, 'Categoria Instalacion WIFI'))).filter(Boolean))].sort();
  fillSel('f-cat', catOpts, 'Categoría');
  document.getElementById('srch').value = '';
  setBc([{ txt: 'Vista General', fn: 'goL1()' }, { txt: curFase, active: true }]);
  show('v2');
  renderTbl();
}

function renderTbl() {
  const srch = document.getElementById('srch').value.toLowerCase();
  const dep = document.getElementById('f-dep').value;
  const enl = document.getElementById('f-enl').value;
  const cat = document.getElementById('f-cat').value;
  filtered = DATA.filter(r => {
    const fase = getFase(r);
    if (fase !== curFase) return false;
    if (dep && g(r, 'DEPTO') !== dep) return false;
    if (enl && g(r, 'Estado de enlace') !== enl) return false;
    if (cat) { const normCat = (g(r, 'Categoria Instalacion WIFI').includes('Integral') || g(r, 'Categoria Instalacion WIFI').includes('Falta instalar 1')) ? 'Completa' : g(r, 'Categoria Instalacion WIFI'); if (normCat !== cat) return false; }
    if (srch) { const nm = g(r, 'NOMBRE CE').toLowerCase(); const dp = g(r, 'DEPTO').toLowerCase(); const cod = g(r, 'CÓD CE').toLowerCase(); if (!nm.includes(srch) && !dp.includes(srch) && !cod.includes(srch)) return false; }
    return true;
  });
  const op = filtered.filter(r => g(r, 'Estado de enlace').includes('Operativo')).length;
  const comp = filtered.filter(r => g(r, 'Categoria Instalacion WIFI').includes('Integral')).length;
  const ap = filtered.reduce((s, r) => s + (parseFloat(getAP(r)) || 0), 0);
  const ab = filtered.reduce((s, r) => s + (parseFloat(g(r, 'Ancho de Banda')) || 0), 0);
  const miniIcos = [
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  ];
  document.getElementById('minis').innerHTML = [
    { v: filtered.length,                    l: 'Total Escuelas'       },
    { v: op,                                 l: 'Con Internet'         },
    { v: filtered.length - op,               l: 'Sin Conexión'         },
    { v: comp,                               l: 'Instalación Completa' },
    { v: (ab / 1000).toFixed(2) + ' Gbps',  l: 'Velocidad Total'      },
  ].map((s, i) => `
    <div class="mini">
      <div style="display:flex;align-items:center;justify-content:center;gap:6px">
        ${miniIcos[i]}
        <div class="mini-v">${typeof s.v === 'number' ? s.v.toLocaleString() : s.v}</div>
      </div>
      <div class="mini-l">${s.l}</div>
    </div>`).join('');
  const tot = Math.ceil(filtered.length / PG);
  if (page > tot) page = 1;
  const sl = filtered.slice((page - 1) * PG, page * PG);
  document.getElementById('tbl-info').textContent = `Mostrando ${((page-1)*PG+1).toLocaleString()}–${Math.min(page*PG,filtered.length).toLocaleString()} de ${filtered.length.toLocaleString()} centros`;
  document.getElementById('tbody').innerHTML = sl.map((r, i) => {
    const idx = (page - 1) * PG + i;
    const enlVal = g(r, 'Estado de enlace');
    const ep = enlVal.includes('Operativo') ? pill('✓ Con Internet', 'var(--green)') : enlVal === 'CFO' ? pill('⚠ Fuera de Servicio', '#f97316') : enlVal.includes('Down') ? pill('✗ Sin Conexión', 'var(--red)') : pill(enlVal || '—', 'var(--muted)');
    const ctrlVal = g(r, 'Estado de enlace');
    const cp = ctrlVal === 'ON' ? pill('ON', 'var(--green)') : ctrlVal === 'OFF' ? pill('OFF', 'var(--red)') : pill('—', 'var(--muted)');
    const catv = g(r, 'Categoria Instalacion WIFI');
    const catLabel = (catv.includes('Integral') || catv.includes('Falta instalar 1')) ? 'Completa' : (catv.includes('defic') || catv.includes('Varias')) ? 'Deficiente' : catv ? catv.substring(0, 14) + '…' : '—';
    const catColor = (catv.includes('Integral') || catv.includes('Falta instalar 1')) ? 'var(--green)' : (catv.includes('defic') || catv.includes('Varias')) ? 'var(--red)' : 'var(--muted)';
    const catp = pill(catLabel, catColor);
    const ab2 = parseFloat(g(r, 'Ancho de Banda')) || 0;
    const vis = g(r, 'N° VISITA') || '1';
    const codigo = g(r, 'CÓD CE') || '—';
    const nombreLimpio = g(r, 'Nombre de CE') || g(r, 'NOMBRE CE').replace(/^\d+\s*/, '');
    return `<tr class="row" onclick="goL3(${idx})">
        <td style="font-family:monospace;font-size:12px;color:var(--purple);white-space:nowrap;font-weight:600">${codigo}</td>
        <td title="${g(r,'NOMBRE CE')}" style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nombreLimpio.substring(0,38)}</td>
        <td>${g(r,'DEPTO')||'—'}</td><td>${ep}</td><td>${cp}</td>
        <td style="text-align:center">${getAP(r)||'—'}</td><td>${ab2>0?ab2.toFixed(1)+' Mbps':'—'}</td>
        <td>${catp}</td><td>${pill(g(r,'Bloque')||'—','var(--blue)')}</td>
        <td><span style="font-size:11px;color:var(--purple);font-weight:600">#${parseFloat(vis)||1}</span></td>
        <td style="color:var(--muted)">›</td></tr>`;
  }).join('');
  renderPg(tot);
}

function renderPg(tot) {
  let h = `<button class="pgb" onclick="chPg(${page - 1})" ${page === 1 ? 'disabled' : ''}>‹</button>`;
  for (let i = 1; i <= tot; i++) { if (tot > 7 && i > 2 && i < tot - 1 && Math.abs(i - page) > 1) { if (i === 3 || i === tot - 2) h += `<span style="color:var(--muted);padding:0 3px">…</span>`; continue; } h += `<button class="pgb ${i === page ? 'on' : ''}" onclick="chPg(${i})">${i}</button>`; }
  h += `<button class="pgb" onclick="chPg(${page + 1})" ${page === tot || tot === 0 ? 'disabled' : ''}>›</button>`;
  document.getElementById('pg').innerHTML = h;
}

function chPg(p) { const tot = Math.ceil(filtered.length / PG); if (p < 1 || p > tot) return; page = p; renderTbl(); document.querySelector('.tbl-card').scrollIntoView({ behavior: 'smooth', block: 'start' }); }

function goL3(idx) {
  const r = filtered[idx];
  const cfg = FASE_CFG[getFase(r)] || { color: 'var(--blue)' };
  const nm = g(r, 'NOMBRE CE').replace(/^\d+ /, '');
  const vis = parseFloat(g(r, 'N° VISITA')) || 1;
  const ab = parseFloat(g(r, 'Ancho de Banda')) || 0;
  const enl = g(r, 'Estado de enlace');
  const enok = enl.includes('Operativo');
  const codigoL3 = g(r, 'CÓD CE') || '';
  const nombreL3 = g(r, 'Nombre de CE') || nm;
  // Formateador de fecha limpio
  const fmtDate = (val) => {
    if (!val) return 'Sin fecha';
    const d = new Date(val);
    if (isNaN(d)) return val;
    return d.toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const fechaFmt = fmtDate(g(r, 'FECHA DE VISITA'));

  document.getElementById('l3-name').textContent = (codigoL3 ? codigoL3 + ' · ' : '') + nombreL3;
  document.getElementById('l3-meta').textContent = `${g(r,'DEPTO')||''} · ${fechaFmt}${g(r,'Persona que recibe en CE')?' · Recibe: '+g(r,'Persona que recibe en CE'):''}`;
  document.getElementById('l3-visita').textContent = '📋 Visita #' + (parseFloat(vis) || 1) + ' (última)';
  badge('l3-badge', getFase(r) || '', cfg.color);
  setBc([{ txt: 'Vista General', fn: 'goL1()' }, { txt: curFase, fn: `goL2('${curFase}')` }, { txt: nm.substring(0, 28) + '…', active: true }]);
  
  const driveLinks = (val, label) => {
    label = label || '';
    if (!val) return '<span style="color:var(--muted);font-size:12px">Sin archivos</span>';
    const links = val.split(',').map(l => l.trim()).filter(l => l.startsWith('http'));
    if (!links.length) return '<span style="color:var(--muted);font-size:12px">Sin archivos</span>';
    const regKey = '_dlreg_' + (++_dlCounter);
    window[regKey] = links;
    let html = '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">';
    links.forEach((l, i) => {
      let id = (l.match(/[?&]id=([^&]+)/) || l.match(/\/d\/([^/?]+)/) || [])[1] || null;
      const thumb = id ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w400' : '';
      const lbl = label || ('Archivo ' + (i + 1));
      const gradId = 'ag' + regKey + '_' + i;
      const pdfSVG = `<svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="${gradId}" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse"><stop stop-color="#B30000"/><stop offset="1" stop-color="#800000"/></linearGradient></defs><rect width="44" height="44" rx="10" fill="url(#${gradId})"/><polygon points="22,10 15,30 18,30 20,25 24,25 26,30 29,30" fill="white"/><polygon points="20.5,22 23.5,22 22,17" fill="#B30000"/><text x="22" y="39" text-anchor="middle" font-size="6" font-weight="900" font-family="Arial,sans-serif" fill="white" letter-spacing="1.5">PDF</text></svg>`;
      const pdfStyleObj = `width:150px;height:110px;border-radius:8px;border:1px solid rgba(220,53,69,.4);cursor:pointer;background:#ffffff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;transition:all .2s;flex-shrink:0`;
      const safeOpen = type => `openLightbox('${type}',window['${regKey}'][${i}],'${lbl.replace(/"/g,'')}')`;
      if (!thumb) { html += `<div style="${pdfStyleObj}" onclick="${safeOpen('pdf')}">${pdfSVG}<span style="font-size:10px;color:#6c757d">${lbl}</span></div>`; } 
      else {
        const divId = 'dc_' + i + '_' + Date.now();
        const pdfCard = pdfSVG + `<span style="font-size:10px;color:#6c757d">${lbl}</span>`;
        window[regKey + '_card_' + i] = pdfCard; window[regKey + '_style'] = pdfStyleObj;
        const errHandler = `var p=this.parentElement;p.innerHTML=window['${regKey}_card_${i}'];p.style.cssText=window['${regKey}_style'];p.style.overflow='visible';p.onclick=function(){${safeOpen('pdf')}};`;
        html += `<div id="${divId}" style="width:150px;height:110px;border-radius:8px;overflow:hidden;border:1px solid var(--border);cursor:pointer;transition:transform .2s;flex-shrink:0;background:var(--surface2)" onclick="${safeOpen('img')}" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'"><img src="${thumb}" alt="${lbl}" style="width:100%;height:100%;object-fit:cover;display:block" onerror="${errHandler}"/></div>`;
      }
    });
    return html + '</div>';
  };
  
  const chk = (val, okVals = ['Correcto', 'Correcta', 'Correctos', 'Si', 'Si Cumple', 'Cumple', 'Si Cuenta', 'Completa']) => { if (!val) return `<span class="chk chk-neu">—</span>`; const ok = okVals.some(v => val.toLowerCase().includes(v.toLowerCase())); return `<span class="chk ${ok?'chk-ok':'chk-bad'}">${val}</span>`; };
  
  document.getElementById('l3-grid').innerHTML = `
    <div class="card">
      <div class="card-t" style="display:flex;align-items:center;gap:6px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        ESTADO OPERATIVO
      </div>
      <div class="bstat"><div class="bstat-v" style="color:${enok?'var(--green)':'var(--red)'}">${enok?'En Línea':'Sin Señal'}</div><div class="bstat-l">${enl||'—'}</div></div>
      <div class="irow"><span class="ik">Verificación de red</span><span class="iv">${chk(g(r,'Estado de enlace'),['ON'])}</span></div>
      <div class="irow"><span class="ik">Servicio Eléctrico</span><span class="iv">${chk(g(r,'Cuenta con Servicio Electrico'))}</span></div>
      <div class="irow"><span class="ik">Infraestructura Eléctrica</span><span class="iv">${chk(g(r,'Hay infraestructura de Electricidad'))}</span></div>
      <div class="irow"><span class="ik">Estado del Edificio</span><span class="iv">${g(r,'Estado Actual Infraestructura')||'—'}</span></div>
      <div class="irow"><span class="ik">Internet Satelital</span><span class="iv">${(g(r,'Enlace Starlink')||g(r,'STARLINK')||'—').replace('NO cuenta con antena Starlink','Sin Starlink')}</span></div>
      <div class="irow"><span class="ik">Batería de Respaldo (UPS)</span><span class="iv">${chk(g(r,'UPS de Gabinete principal cuenta con puerto de Monitoreo')||g(r,'UPS Monitoreo'))}</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
        <div class="bstat" style="background:rgba(124,58,237,.08);border-radius:8px;padding:8px 4px">
          <div class="bstat-v" style="color:var(--purple);font-size:26px">${getAP(r)||0}</div>
          <div class="bstat-l" style="display:flex;align-items:center;justify-content:center;gap:4px">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" stroke-width="2"><path d="M5 12a7 7 0 1 1 14 0 7 7 0 0 1-14 0Z"/><circle cx="12" cy="12" r="3"/><path d="M12 5v1M12 18v1M5 12H4M20 12h-1"/></svg>
            AP Instalados
          </div>
        </div>
        <div class="bstat" style="background:rgba(8,145,178,.08);border-radius:8px;padding:8px 4px">
          <div class="bstat-v" style="color:var(--cyan);font-size:${ab>=100?'20px':'26px'}">${ab>0?ab.toFixed(1):'—'}</div>
          <div class="bstat-l" style="display:flex;align-items:center;justify-content:center;gap:4px">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            Mbps contratados
          </div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-t" style="display:flex;align-items:center;gap:6px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        INFORMACIÓN GENERAL
      </div>
      <div class="irow"><span class="ik">Departamento</span><span class="iv">${g(r,'DEPTO')||'—'}</span></div>
      <div class="irow"><span class="ik">Fase del Proyecto</span><span class="iv" style="font-weight:600;color:${cfg.color}">${getFase(r)||'—'}</span></div>
      <div class="irow"><span class="ik">Grupo de Trabajo</span><span class="iv">${g(r,'Bloque')||'—'}</span></div>
      <div class="irow"><span class="ik">Empresa Instaladora</span><span class="iv">${g(r,'Instalador')||'—'}</span></div>
      <div class="irow"><span class="ik">Técnico Responsable</span><span class="iv">${g(r,'TECNICO')||'—'}</span></div>
      <div class="irow"><span class="ik">Número de Visita</span><span class="iv" style="color:var(--purple)">#${vis} (última registrada)</span></div>
      <div class="irow"><span class="ik">Fecha de Visita</span><span class="iv">${fechaFmt}</span></div>
    </div>
    <div class="card" style="grid-row: span 2; overflow-y:auto">
      <div class="card-t" style="display:flex;align-items:center;gap:6px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        EVIDENCIA Y DOCUMENTACIÓN
      </div>
      <div style="display:flex;flex-direction:column;gap:18px">
        ${[
          ['Foto CE Panorámica', 'Fotografía de CE panoramica'],
          ['Documentación Instalación', 'Documentación de instalacion'],
          ['Foto Router (CTRL)', 'Foto de Router (indicador CTRL)'],
          ['Evidencia Ancho de Banda', 'Ancho de Banda Evidencia'],
        ].map(([lbl, key]) => {
          const val = g(r, key);
          const hasFiles = val && val.split(',').map(l => l.trim()).some(l => l.startsWith('http'));
          if (!hasFiles) return '';
          return `<div>
              <div style="font-size:10px;color:var(--muted);margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.06em">${lbl}</div>
              ${driveLinks(val)}
            </div>`;
        }).join('')}
      </div>
    </div>`;
  // *** FIN DEL CÓDIGO RESTAURADO ***
  
  show('v3');
}

function goL1() { show('v1'); setBc([{ txt: 'Vista General', active: true }]); }
function goL2back() { show('v2'); setBc([{ txt: 'Vista General', fn: 'goL1()' }, { txt: curFase, active: true }]); }

function show(id) { document.querySelectorAll('.view').forEach(v => v.classList.remove('active')); document.getElementById(id).classList.add('active'); window.scrollTo(0, 0); }

function setBc(items) { document.getElementById('bc').innerHTML = items.map((it, i) => { const sep = i < items.length - 1 ? '<span class="bc-sep">›</span>' : ''; return it.active ? `<span class="bc-active">${it.txt}</span>${sep}` : `<span class="bc-link" onclick="${it.fn}">${it.txt}</span>${sep}`; }).join(''); }

function badge(id, txt, color) { const el = document.getElementById(id); el.textContent = txt; el.style.color = color; el.style.borderColor = color; el.style.background = `${color.replace('var(','').replace(')','')}1A`; }

function fillSel(id, opts, ph) { const el = document.getElementById(id); el.innerHTML = `<option value="">${ph}</option>`; opts.forEach(o => { el.innerHTML += `<option value="${o}">${o}</option>`; }); }

function pill(txt, color) { const finalColor = color.startsWith('var(') ? color : `#${color}`; const bgColor = `${finalColor.replace('var(','').replace(')','')}1A`; return `<span class="pill" style="background:${bgColor};color:${finalColor}">${txt}</span>`; }

function getFase(r) { return r['Fase CAPRES'] || ''; }

const FIELD_ALIAS = { 'Nombre de Centro Educativo': 'NOMBRE CE', 'Departamento': 'DEPTO', 'Valor # Ancho de banda': 'Ancho de Banda', 'Categoría Instalacion': 'Categoria Instalacion WIFI', 'Categoria de Instalacion': 'Categoria Instalacion WIFI', '# de Visita': 'N° VISITA', 'Fecha de Visita': 'FECHA DE VISITA', 'Nombre de Tecnico': 'TECNICO', 'Revisado Por': 'TECNICO', 'ID INFRA': 'CÓD CE', 'Norma Cobertura WIFI': 'Cobertura WIFI', 'Estado Enlace ISP': 'Estado de enlace', 'Cuenta con Servicio Electrico': 'Servicio Electrico', 'Enlace Starlink': 'STARLINK', 'UPS Monitoreo': 'UPS', 'Existen equipos dañados': 'Hardware Dañado', };
function g(r, key) { const alias = FIELD_ALIAS[key]; const val = (alias ? r[alias] : undefined) ?? r[key] ?? r[key.trim()] ?? ''; return typeof val === 'string' ? val.trim() : String(val); }

function pct(a, b) { return b === 0 ? 0 : Math.round((a / b) * 100); }

function openLightbox(type, url, title) {
    const lb = document.getElementById('lightbox'); const lbTitle = document.getElementById('lb-title'); const lbBody = document.getElementById('lb-body');
    lbTitle.textContent = title || '';
    const id = (url.match(/[?&]id=([^&]+)/) || url.match(/\/d\/([^/?]+)/) || [])[1] || null;
    const driveLink = id ? `https://drive.google.com/file/d/${id}/view` : url;
    const embedUrl = id ? `https://drive.google.com/file/d/${id}/preview?usp=sharing` : url;
    const thumbUrl = id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1600` : url;
    const driveBtn = `<div style="text-align:center;margin-top:12px"><a href="${driveLink}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--blue);text-decoration:none;padding:7px 16px;border-radius:8px;border:1px solid var(--border);background:var(--surface);">↗ Abrir en Drive</a></div>`;
    if (type === 'pdf') { lbBody.innerHTML = `<div style="position:relative"><iframe id="lb-iframe" src="${embedUrl}" style="width:100%;height:74vh;border:none;border-radius:8px;background:#ffffff" allow="autoplay" allowfullscreen></iframe>${driveBtn}</div>`; } 
    else {
        lbBody.innerHTML = `<div id="lb-img-wrap" style="text-align:center"><div id="lb-spinner" style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--muted);font-size:13px;gap:10px"><div style="width:20px;height:20px;border:2px solid var(--border);border-top-color:var(--blue);border-radius:50%;animation:spin 1s linear infinite"></div>Cargando...</div><img id="lb-img" src="${thumbUrl}" alt="${title}" style="max-width:100%;max-height:74vh;border-radius:8px;object-fit:contain;display:none;margin:0 auto;cursor:zoom-in" onclick="window.open('${driveLink}','_blank')"/>${driveBtn}</div><div id="lb-iframe-wrap" style="display:none"><iframe src="${embedUrl}" style="width:100%;height:74vh;border:none;border-radius:8px;background:#ffffff" allow="autoplay" allowfullscreen></iframe>${driveBtn}</div>`;
        const imgEl = document.getElementById('lb-img'); const spinner = document.getElementById('lb-spinner');
        if (imgEl) { imgEl.onload = () => { spinner.style.display = 'none'; imgEl.style.display = 'block'; }; imgEl.onerror = () => { document.getElementById('lb-img-wrap').style.display = 'none'; document.getElementById('lb-iframe-wrap').style.display = 'block'; }; }
    }
    lb.classList.add('active'); document.body.style.overflow = 'hidden';
}

function closeLightbox() { document.getElementById('lightbox').classList.remove('active'); document.getElementById('lb-body').innerHTML = ''; document.body.style.overflow = ''; }

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
document.addEventListener('DOMContentLoaded', init);