import * as THREE from 'three';
import { gsap } from 'gsap';

// Ambientes das camos de Maestria: cada uma muda a luz do estúdio, o brilho que
// vaza da arma (bloom barato) e o fundo atrás dela.
// - Mercurial Drift: reflexos de líquido escorrendo, luz laranja por trás
// - Polyatomic Reforged: estilhaços de cristal flutuando, luz violeta por trás
// - Orion Reforged: céu noturno com a constelação de Órion, estúdio quase
//   apagado (a arma é a luz da cena) e apagões que passam pelo céu

// ---------------------------------------------------------------------------
// CONFIGS
// ---------------------------------------------------------------------------
export const AMBIENTES = {
  // id null = arsenal (como sempre foi)
  base: { env: 0.7, chave: 2.2, contra: '#ffd100', contraForca: 3.0, baixo: 0.6, brilho: 0 },
  4: { env: 0.55, chave: 1.5, contra: '#ff6a1f', contraForca: 3.4, baixo: 0.45, brilho: 0.35 }, // Mercurial
  5: { env: 0.6, chave: 1.6, contra: '#8a5cff', contraForca: 3.4, baixo: 0.55, brilho: 0.35 }, // Polyatomic
  6: { env: 0.12, chave: 0.3, contra: '#ff2a6a', contraForca: 1.8, baixo: 0.12, brilho: 0.95 }, // Orion
  troca: 1.4, // s: tempo da luz mudar
};

export const BRILHO = {
  reduz: 4, // o brilho é desenhado em 1/4 da resolução (mais rápido e já desfocado)
  filtro: 'brightness(0.85) contrast(2.4) saturate(1.3) blur(5px)', // só o que é claro vaza
};

export const CEU = {
  estrelas: 420, // estrelas de fundo
  desenho: 2.4, // s: a constelação se desenha linha por linha
  tamanho: 1.05, // fração do menor lado da tela ocupada pela constelação (passa além da arma)
  apagao: { ciclo: 13, raio: 0.32, manchas: 2 }, // s / fração da tela / quantas manchas passam
};

// Órion (x para a direita, y para baixo, 0..1): cabeça, ombros, cinturão, espada e pés
const ORION_ESTRELAS = [
  { n: 'Meissa', x: 0.49, y: 0.04, m: 2.2 },
  { n: 'Betelgeuse', x: 0.28, y: 0.17, m: 4.6, cor: '#ffb27a' },
  { n: 'Bellatrix', x: 0.68, y: 0.21, m: 3.2 },
  { n: 'Alnitak', x: 0.41, y: 0.52, m: 3.0 },
  { n: 'Alnilam', x: 0.5, y: 0.49, m: 3.2 },
  { n: 'Mintaka', x: 0.59, y: 0.46, m: 2.8 },
  { n: 'Espada1', x: 0.48, y: 0.61, m: 1.6 },
  { n: 'Espada2', x: 0.49, y: 0.68, m: 2.0, cor: '#ffc4e6' },
  { n: 'Saiph', x: 0.35, y: 0.88, m: 2.8 },
  { n: 'Rigel', x: 0.74, y: 0.85, m: 4.4, cor: '#cfe0ff' },
];
const ORION_LINHAS = [[0, 1], [0, 2], [1, 3], [2, 5], [3, 4], [4, 5], [3, 8], [5, 9], [4, 6], [6, 7]];

const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lim = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export function criarAmbientes(secao, { cena, canvas }) {
  // --- luzes do estúdio (as três direcionais de estudio.js)
  const [chave, contra, baixo] = cena.children.filter((o) => o.isDirectionalLight);
  const luz = {
    env: cena.environmentIntensity, chave: chave.intensity, contraForca: contra.intensity, baixo: baixo.intensity,
    contra: new THREE.Color(AMBIENTES.base.contra), brilho: 0,
  };
  let fator = 1; // segurando o selo, o estúdio apaga aos poucos
  const aplicarLuz = () => {
    cena.environmentIntensity = luz.env * fator;
    chave.intensity = luz.chave * fator;
    contra.intensity = luz.contraForca;
    contra.color.copy(luz.contra);
    baixo.intensity = luz.baixo;
  };

  // --- brilho: cópia pequena e filtrada do canvas da arma, somada por cima
  const brilho = document.createElement('canvas');
  brilho.className = 'vitrine__brilho';
  brilho.setAttribute('aria-hidden', 'true');
  canvas.after(brilho);
  const bctx = brilho.getContext('2d');

  // --- camadas de fundo (ficam dentro de .maestria-atras, atrás da arma)
  const atras = secao.querySelector('.maestria-atras');
  const camada = (cls) => {
    const el = document.createElement('div');
    el.className = `amb ${cls}`;
    atras.querySelector('.maestria__fundo').after(el);
    return el;
  };
  // Mercurial: manchas de tinta desfocadas escorrendo + filetes de reflexo
  const mercurial = camada('amb--mercurial');
  mercurial.innerHTML = '<i></i><i></i><i></i><i></i><i></i><span class="amb__filetes"></span>';
  // Polyatomic: lascas de cristal flutuando em profundidades diferentes
  const poly = camada('amb--polyatomic');
  let semente = 7;
  const rnd = () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647; };
  poly.innerHTML = Array.from({ length: 18 }, () => {
    const z = rnd(); // 0 longe .. 1 perto
    const tam = 30 + z * 110;
    const x = rnd() * 100, y = rnd() * 100;
    const forma = [
      `polygon(50% 0, 100% ${60 + rnd() * 40}%, ${rnd() * 30}% 100%)`,
      `polygon(0 ${rnd() * 40}%, 100% 0, ${40 + rnd() * 60}% 100%)`,
      `polygon(${rnd() * 50}% 0, 100% 50%, 0 100%)`,
    ][Math.floor(rnd() * 3)];
    const cores = ['#6b3cff', '#3d52ff', '#b9a6ff', '#e8e6ff', '#2a1a70'];
    return `<i style="--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}%;--t:${tam.toFixed(0)}px;--r:${(rnd() * 360).toFixed(0)}deg;--d:${(9 + rnd() * 10).toFixed(1)}s;--a:${(-rnd() * 10).toFixed(1)}s;--b:${((1 - z) * 6).toFixed(1)}px;--o:${(0.25 + z * 0.55).toFixed(2)};--c:${cores[Math.floor(rnd() * cores.length)]};clip-path:${forma}"></i>`;
  }).join('');
  // Orion: céu noturno desenhado num canvas
  const orion = camada('amb--orion');
  const ceu = document.createElement('canvas');
  orion.appendChild(ceu);
  const cctx = ceu.getContext('2d');
  const fundoEstrelas = Array.from({ length: CEU.estrelas }, () => ({
    x: Math.random(), y: Math.random(), r: Math.random() ** 3 * 1.6 + 0.3, f: Math.random() * 6.28, v: 0.4 + Math.random() * 1.6,
  }));

  const camadas = { 4: mercurial, 5: poly, 6: orion };
  let atual = null;
  const desenho = { v: 0 }; // 0..1: constelação se desenhando

  /** troca o ambiente (id da camo de Maestria, ou null = arsenal) */
  function mudar(id) {
    if (id === atual) return;
    atual = id;
    const a = AMBIENTES[id] || AMBIENTES.base;
    const dur = reduzir ? 0 : AMBIENTES.troca;
    gsap.to(luz, { env: a.env, chave: a.chave, contraForca: a.contraForca, baixo: a.baixo, brilho: a.brilho, duration: dur, ease: 'power2.inOut', overwrite: true, onUpdate: aplicarLuz });
    const c = new THREE.Color(a.contra);
    gsap.to(luz.contra, { r: c.r, g: c.g, b: c.b, duration: dur, ease: 'power2.inOut', overwrite: true });
    Object.entries(camadas).forEach(([k, el]) => el.classList.toggle('ativo', String(id) === k));
    secao.dataset.ambiente = id ?? '';
    if (id === 6) gsap.fromTo(desenho, { v: 0 }, { v: 1, duration: reduzir ? 0 : CEU.desenho, ease: 'power2.inOut', delay: reduzir ? 0 : 0.5, overwrite: true });
  }

  // apagão do céu: manchas que passam devagar, no mesmo ritmo do apagão da camo
  const manchas = Array.from({ length: CEU.apagao.manchas }, (_, i) => ({ fase: i / CEU.apagao.manchas, x: 0.2 + 0.6 * Math.random(), y: 0.2 + 0.6 * Math.random() }));
  // a mancha muda de lugar uma vez, no começo de cada ciclo (não a cada estrela)
  const moverManchas = (t) => {
    manchas.forEach((m) => {
      const volta = Math.floor(t / CEU.apagao.ciclo + m.fase);
      if (volta !== m.volta) { m.volta = volta; m.x = 0.15 + 0.7 * Math.random(); m.y = 0.15 + 0.7 * Math.random(); }
    });
  };
  const apagaEm = (x, y, t) => {
    let a = 0;
    manchas.forEach((m) => {
      const ciclo = (t / CEU.apagao.ciclo + m.fase) % 1;
      const env = lim(ciclo / 0.4) * (1 - lim((ciclo - 0.7) / 0.28));
      const d = Math.hypot(x - m.x, (y - m.y) * 0.8) / CEU.apagao.raio;
      a = Math.max(a, env * (1 - lim((d - 0.35) / 0.65)));
    });
    return a;
  };

  // centro da arma na tela (muda só com a media query de celular): lido no resize, não a cada quadro
  let mx = 0.44, my = 0.47;
  const medirCentro = () => {
    const cs = getComputedStyle(secao);
    mx = parseFloat(cs.getPropertyValue('--mx')) / 100 || 0.44;
    my = parseFloat(cs.getPropertyValue('--my')) / 100 || 0.47;
  };
  medirCentro();
  addEventListener('resize', medirCentro);

  function desenharCeu(t) {
    const w = ceu.clientWidth, h = ceu.clientHeight;
    if (!w) return;
    if (ceu.width !== w || ceu.height !== h) { ceu.width = w; ceu.height = h; }
    cctx.clearRect(0, 0, w, h);
    // poeira da Via Láctea: faixa diagonal bem suave
    const g = cctx.createLinearGradient(0, h, w, 0);
    g.addColorStop(0.3, 'rgba(255, 60, 140, 0)');
    g.addColorStop(0.5, 'rgba(255, 70, 150, 0.07)');
    g.addColorStop(0.7, 'rgba(120, 60, 255, 0)');
    cctx.fillStyle = g;
    cctx.fillRect(0, 0, w, h);
    // estrelas de fundo (cintilam devagar e apagam nas manchas do apagão)
    moverManchas(t);
    const tc = reduzir ? 0 : t; // movimento reduzido: as estrelas não cintilam
    cctx.fillStyle = '#fff';
    fundoEstrelas.forEach((s) => {
      const a = (0.45 + 0.55 * Math.sin(tc * s.v + s.f) ** 2) * (1 - apagaEm(s.x, s.y, t) * 0.92);
      cctx.globalAlpha = a * 0.9;
      const x = s.x * w, y = s.y * h;
      if (s.r < 1) cctx.fillRect(x - s.r, y - s.r, s.r * 2, s.r * 2); // pontinho: quadrado basta
      else { cctx.beginPath(); cctx.arc(x, y, s.r, 0, 6.2832); cctx.fill(); }
    });
    cctx.globalAlpha = 1;
    // constelação de Órion atrás da arma
    const L = Math.min(w, h) * CEU.tamanho;
    const px = (e) => [mx * w + (e.x - 0.5) * L * 0.8, my * h + (e.y - 0.5) * L];
    const d = desenho.v;
    cctx.lineWidth = 1;
    ORION_LINHAS.forEach(([a, b], i) => {
      const k = lim(d * ORION_LINHAS.length - i); // uma linha depois da outra
      if (k <= 0) return;
      const [x1, y1] = px(ORION_ESTRELAS[a]), [x2, y2] = px(ORION_ESTRELAS[b]);
      const ap = 1 - apagaEm(x1 / w, y1 / h, t) * 0.85;
      cctx.strokeStyle = `rgba(255, 190, 220, ${(0.35 * ap).toFixed(3)})`;
      cctx.setLineDash([4, 5]);
      cctx.beginPath(); cctx.moveTo(x1, y1); cctx.lineTo(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k); cctx.stroke();
    });
    cctx.setLineDash([]);
    ORION_ESTRELAS.forEach((e, i) => {
      const k = lim(d * ORION_ESTRELAS.length - i * 0.8);
      if (k <= 0) return;
      const [x, y] = px(e);
      const ap = 1 - apagaEm(x / w, y / h, t) * 0.8;
      const pulso = 0.85 + 0.15 * Math.sin(t * 1.3 + i);
      const r = e.m * k * pulso;
      const halo = cctx.createRadialGradient(x, y, 0, x, y, r * 7);
      halo.addColorStop(0, e.cor || '#ffe9f4');
      halo.addColorStop(0.15, `${e.cor || '#ffd0e6'}88`);
      halo.addColorStop(1, 'rgba(255, 120, 180, 0)');
      cctx.globalAlpha = ap;
      cctx.fillStyle = halo;
      cctx.beginPath(); cctx.arc(x, y, r * 7, 0, 6.2832); cctx.fill();
      // brilho em cruz nas mais fortes
      if (e.m > 3) {
        cctx.strokeStyle = 'rgba(255, 240, 248, 0.55)';
        cctx.beginPath(); cctx.moveTo(x - r * 6, y); cctx.lineTo(x + r * 6, y); cctx.moveTo(x, y - r * 6); cctx.lineTo(x, y + r * 6); cctx.stroke();
      }
      cctx.fillStyle = '#fff';
      cctx.beginPath(); cctx.arc(x, y, r * 0.55, 0, 6.2832); cctx.fill();
    });
    cctx.globalAlpha = 1;
  }

  /** chamado logo depois de renderizar a arma (no mesmo quadro) */
  function quadro(t) {
    // brilho que vaza
    if (luz.brilho > 0.01) {
      const w = Math.max(1, Math.round(canvas.clientWidth / BRILHO.reduz)), h = Math.max(1, Math.round(canvas.clientHeight / BRILHO.reduz));
      if (brilho.width !== w || brilho.height !== h) { brilho.width = w; brilho.height = h; }
      bctx.clearRect(0, 0, w, h);
      bctx.filter = BRILHO.filtro;
      bctx.drawImage(canvas, 0, 0, w, h);
      brilho.style.opacity = luz.brilho.toFixed(3);
    } else if (brilho.style.opacity !== '0') brilho.style.opacity = '0';
    if (atual === 6) desenharCeu(t);
  }

  /** c = carga do selo (0..1): o estúdio apaga enquanto a arma racha */
  function segurar(c) {
    const f = 1 - c * 0.75;
    if (Math.abs(f - fator) < 0.001) return;
    fator = f;
    aplicarLuz();
  }

  return { mudar, quadro, segurar };
}
