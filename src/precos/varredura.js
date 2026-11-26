import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { geo, CONTORNO, JEJU, DMZ, LOJA } from './mapaCoreia.js';
import { PLANOS } from './planos.js';

gsap.registerPlugin(ScrollTrigger);

// "Rumo à loja" no estilo de um radar além do horizonte: a península coreana
// em nuvem de pontos, um radar em Busan abrindo um setor de 120° rumo ao
// norte, anéis de distância, varredura, relevo subindo em 3D com barras de
// sinal, o marcador da loja e, no fim, a câmera mergulha no marcador e a loja
// nasce ali mesmo, dentro da cena: piso de pontos, pedestais, cones de luz e
// os cartões de preço presos a cada pedestal.

// ---------------------------------------------------------------------------
// CONFIGS
// ---------------------------------------------------------------------------
export const VARREDURA = {
  telas: 7, // quanto de rolagem (alturas de tela) a seção fica presa
  passo: 3.4, // unidades entre os pontos da terra (menor = mais pontos)
  passoMar: 10, // unidades entre os pontos do mar
  abertura: 120, // graus do setor do radar
  alcance: 470, // unidades: raio máximo do setor
  aneis: [100, 200, 300, 400], // unidades dos anéis de distância (1 unidade ≈ 1 km)
  altura: 60, // unidades: relevo máximo quando sobe (etapa 3)
  sinais: 26, // barras de sinal no setor
  semente: 9,
};

// a loja dentro da cena (unidades do mundo; o marcador fica no centro)
export const LOJA3D = {
  espaco: 16, // distância entre os pedestais
  espacoCel: 27, // no celular: um cartão por vez na tela
  pedestal: [9, 6, 9], // largura, altura, profundidade
  cone: 46, // altura do cone de luz sobre cada pedestal
  raioCone: 7, // raio da base do cone
  piso: 78, // raio do piso de pontos
  passoPiso: 1.5, // distância entre os pontos do piso
  camera: { dist: 78, altura: 17, alvoY: 15 }, // onde a câmera para na loja
  parallax: 3.5, // unidades que a câmera desliza com o mouse
  cartaoMax: 0.95, // escala máxima dos cartões
};

// linha do tempo da rolagem (0..1 da seção presa)
const T = {
  pulso: [0, 0.11],
  cams: [[0.1, 0.22], [0.27, 0.39], [0.44, 0.54], [0.6, 0.74]], // pose 1, 2, 3 e a loja
  setor: [0.12, 0.24],
  relevo: [0.29, 0.41],
  marcador: [0.46, 0.54],
  painel: [0.58, 0.65], // painel da esquerda sai
  some: [0.6, 0.72], // terreno, setor e marcador se apagam
  loja: [0.63, 0.76], // piso abre e pedestais sobem
  cabeca: [0.68, 0.76], // letreiro + título da loja
  cartoes: [0.7, 0.8], // cartões sobem (com atraso por cartão)
  atrasoCartao: 0.02,
  passeio: [0.8, 0.97], // celular: câmera passa de pedestal em pedestal
  etapas: [0, 0.11, 0.28, 0.45], // início de cada etapa do painel
};

export const ETAPAS = [
  { titulo: 'Varredura iniciada', texto: 'O radar acorda em Busan e varre a península de ponta a ponta atrás do caminho até a sua camo.' },
  { titulo: 'Setor de 120° rumo ao norte', texto: 'Um setor de varredura cobre o terreno de Busan até a fronteira, anel por anel.' },
  { titulo: 'Relevo e DMZ', texto: 'O relevo sobe em 3D, a zona desmilitarizada aparece em vermelho e os sinais pulsam pelo mapa.' },
  { titulo: 'Loja identificada', texto: 'Sinal travado ao sul da DMZ. Continue rolando para entrar na loja e escolher a sua camo.' },
];
// contadores por etapa
const CONTADORES = [
  { alcance: 0, abertura: 0, armas: 0 },
  { alcance: 200, abertura: 120, armas: 0 },
  { alcance: 330, abertura: 120, armas: 33 },
  { alcance: 420, abertura: 120, armas: 33 },
];

const V = VARREDURA, L = LOJA3D;
const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const temMouse = window.matchMedia('(hover: hover)').matches;
const lim = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const suave = (t) => t * t * (3 - 2 * t);
const fase = (p, [a, b]) => suave(lim((p - a) / (b - a)));
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const pad = (n) => String(n).padStart(2, '0');
const mundo = (lon, lat) => { const [x, y] = geo(lon, lat); return [x - 500, y - 500]; };
const celular = () => innerWidth <= 860;

// --- relevo: máscara da terra (canvas) + ruído; altura medida em qualquer ponto
function criarRelevo() {
  const N = 1024, k = N / 1000;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
  g.filter = 'blur(8px)'; g.fillStyle = '#fff';
  g.beginPath();
  CONTORNO.forEach(([lo, la], i) => { const [x, y] = geo(lo, la); i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k); });
  g.closePath(); g.fill();
  const [jx, jy] = geo(...JEJU);
  g.beginPath(); g.ellipse(jx * k, jy * k, 40 * k, 14 * k, 0, 0, Math.PI * 2); g.fill();
  const d = g.getImageData(0, 0, N, N).data;
  const terraEm = (x, z) => {
    const u = Math.round(((x + 500) / 1000) * (N - 1)), v = Math.round(((z + 500) / 1000) * (N - 1));
    if (u < 0 || v < 0 || u >= N || v >= N) return 0;
    return d[(v * N + u) * 4] / 255;
  };
  const hash = (x, y) => { let h = x * 374761393 + y * 668265263 + 11 * 982451653; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; };
  const sv = (t) => t * t * (3 - 2 * t);
  const valor = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sv(x - xi), yf = sv(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), cc = hash(xi, yi + 1), dd = hash(xi + 1, yi + 1);
    return a + (b - a) * xf + (cc - a) * yf + (a - b - cc + dd) * xf * yf;
  };
  const ruido = (x, y) => valor(x, y) * 0.6 + valor(x * 2.3 + 7, y * 2.3 + 3) * 0.4;
  const alturaEm = (x, z) => {
    const t = terraEm(x, z);
    if (t <= 0) return 0;
    const leste = 0.45 + 0.55 * lim((x + 120) / 380);
    return Math.pow(t, 1.5) * (0.2 + 0.8 * ruido(x * 0.014, z * 0.014)) * leste;
  };
  return { terraEm, alturaEm };
}

const distSegmento = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az;
  const t = lim(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
};

export function iniciarVarredura(secao, { lenis } = {}) {
  const { terraEm, alturaEm } = criarRelevo();
  const [bx, bz] = mundo(129.07, 35.18); // radar em Busan
  const [lx, lz] = mundo(...LOJA);
  const ly = alturaEm(lx, lz) * V.altura;
  const rumoLoja = Math.atan2(lx - bx, -(lz - bz)); // ângulo a partir do norte (sentido horário)
  const dmz = DMZ.map(([lo, la]) => mundo(lo, la));

  // ---------------- pontos (terra + mar)
  const pos = [], h = [], tipo = [];
  for (let z = -500; z <= 450; z += V.passo) {
    for (let x = -480; x <= 420; x += V.passo) {
      const jx = x + (Math.sin(z * 12.9898) * 0.5) * V.passo * 0.3; // leve desalinho
      const t = terraEm(jx, z);
      if (t < 0.12) continue;
      let ty = 0; // 0 terra, 1 costa, 2 DMZ
      if (t < 0.4) ty = 1;
      for (let i = 0; i < dmz.length - 1; i++) if (distSegmento(jx, z, ...dmz[i], ...dmz[i + 1]) < 4.5) ty = 2;
      pos.push(jx, 0, z); h.push(alturaEm(jx, z)); tipo.push(ty);
    }
  }
  for (let z = -560; z <= 560; z += V.passoMar) {
    for (let x = -560; x <= 560; x += V.passoMar) {
      if (terraEm(x, z) > 0.05 || Math.hypot(x - bx, z - bz) > 820) continue;
      pos.push(x, 0, z); h.push(0); tipo.push(3); // 3 = mar
    }
  }
  const geoPts = new THREE.BufferGeometry();
  geoPts.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geoPts.setAttribute('aAltura', new THREE.Float32BufferAttribute(h, 1));
  geoPts.setAttribute('aTipo', new THREE.Float32BufferAttribute(tipo, 1));
  const U = {
    uBase: { value: new THREE.Vector2(bx, bz) },
    uRumo: { value: rumoLoja },
    uAbertura: { value: THREE.MathUtils.degToRad(V.abertura) / 2 },
    uSetor: { value: 0 }, // 0..1: raio do setor revelado
    uAlcance: { value: V.alcance },
    uVarre: { value: 0 }, // ângulo da varredura
    uPulso: { value: 0 }, // raio do pulso circular (etapa 1)
    uRelevo: { value: 0 }, // 0..1: relevo subindo
    uAlturaMax: { value: V.altura },
    uTamanho: { value: 2.2 },
    uDpr: { value: Math.min(devicePixelRatio || 1, 1.5) },
    uLojaPos: { value: new THREE.Vector2(lx, lz) },
    uSome: { value: 0 }, // 0..1: terreno se apaga em volta da loja
  };
  const materialPts = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aAltura; attribute float aTipo;
      uniform vec2 uBase, uLojaPos; uniform float uRumo, uAbertura, uSetor, uAlcance, uVarre, uPulso, uRelevo, uAlturaMax, uTamanho, uDpr, uSome;
      varying vec3 vCor; varying float vAlfa;
      const float PI = 3.14159265;
      void main() {
        vec3 p = position;
        p.y = aAltura * uAlturaMax * uRelevo;
        vec2 d = p.xz - uBase;
        float dist = length(d);
        float ang = atan(d.x, -d.y); // a partir do norte, sentido horário
        float dAng = abs(mod(ang - uRumo + PI, 2.0 * PI) - PI);
        float noSetor = step(dAng, uAbertura) * step(dist, uSetor * uAlcance);
        // varredura: faixa que gira dentro do setor
        float dVarre = abs(mod(ang - uVarre + PI, 2.0 * PI) - PI);
        float varre = (1.0 - smoothstep(0.0, 0.07, dVarre)) * noSetor;
        float pulso = exp(-pow((dist - uPulso) / 18.0, 2.0)) * step(0.5, uPulso);
        vec3 amarelo = vec3(1.0, 0.82, 0.0), branco = vec3(0.92, 0.92, 0.88), vermelho = vec3(1.0, 0.2, 0.25);
        float alt = aAltura;
        vec3 cor; float a;
        if (aTipo > 2.5) { cor = vec3(0.35, 0.37, 0.42); a = 0.22; }                 // mar
        else if (aTipo > 1.5) { cor = vermelho; a = 0.95; }                          // DMZ
        else if (aTipo > 0.5) { cor = amarelo; a = 0.9; }                            // costa
        else { cor = mix(vec3(0.45), branco, 0.3 + alt * 0.9); a = 0.35 + alt * 0.5; } // terra
        cor = mix(cor, amarelo, noSetor * (aTipo < 0.5 ? 0.55 : 0.2) * (1.0 - uSome));
        a = max(a, noSetor * 0.75);
        cor = mix(cor, vec3(1.0, 0.95, 0.7), varre + pulso);
        a = max(a, max(varre, pulso));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // na loja: o terreno some em volta dela e perto da câmera, e fica de horizonte apagado
        float dl = length(p.xz - uLojaPos);
        a *= 1.0 - uSome * (1.0 - 0.6 * smoothstep(55.0, 190.0, dl));
        a *= mix(1.0, smoothstep(40.0, 140.0, -mv.z), uSome);
        vCor = cor; vAlfa = a;
        gl_PointSize = uTamanho * uDpr * (420.0 / -mv.z) * (aTipo > 2.5 ? 0.8 : 1.0) * (1.0 + varre * 0.8);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCor; varying float vAlfa;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float r = length(c);
        if (r > 0.5 || vAlfa < 0.004) discard;
        gl_FragColor = vec4(vCor, vAlfa * (1.0 - smoothstep(0.3, 0.5, r)));
      }`,
  });
  const nuvem = new THREE.Points(geoPts, materialPts);

  // ---------------- setor: bordas e anéis (linhas), barras de sinal, marcador da loja
  const cena = new THREE.Scene();
  cena.add(nuvem);
  const amareloLinha = new THREE.LineBasicMaterial({ color: 0xffd100, transparent: true, opacity: 0.85 });
  const tracejado = new THREE.LineDashedMaterial({ color: 0xffd100, transparent: true, opacity: 0.7, dashSize: 6, gapSize: 5 });
  const meia = THREE.MathUtils.degToRad(V.abertura) / 2;
  const pontoSetor = (ang, r, y = 1) => v3(bx + Math.sin(ang) * r, y, bz - Math.cos(ang) * r);
  const setor = new THREE.Group();
  const bordas = new THREE.BufferGeometry().setFromPoints([pontoSetor(rumoLoja - meia, V.alcance), pontoSetor(0, 0), pontoSetor(rumoLoja + meia, V.alcance)]);
  setor.add(new THREE.Line(bordas, amareloLinha));
  const aneis = V.aneis.map((r) => {
    const pts = [];
    for (let i = 0; i <= 48; i++) pts.push(pontoSetor(rumoLoja - meia + (i / 48) * meia * 2, r));
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), tracejado);
    l.computeLineDistances();
    setor.add(l);
    return l;
  });
  cena.add(setor);

  // barras de sinal: dentro do setor, em terra
  let s = V.semente;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const barras = new THREE.Group();
  for (let n = 0, tent = 0; n < V.sinais && tent < 600; tent++) {
    const ang = rumoLoja + (rnd() * 2 - 1) * meia * 0.95, r = 60 + rnd() * (V.alcance - 80);
    const x = bx + Math.sin(ang) * r, z = bz - Math.cos(ang) * r;
    if (terraEm(x, z) < 0.5 || Math.hypot(x - lx, z - lz) < 70) continue; // longe da loja
    const alto = 18 + rnd() * 50;
    const geoB = new THREE.BufferGeometry().setFromPoints([v3(0, 0, 0), v3(0, alto, 0)]);
    const barra = new THREE.Line(geoB, new THREE.LineBasicMaterial({ color: rnd() < 0.3 ? 0xffd100 : 0xf4f4f1, transparent: true, opacity: 0 }));
    barra.position.set(x, alturaEm(x, z) * V.altura, z);
    barra.userData.atraso = rnd() * 0.5;
    barras.add(barra);
    n++;
  }
  cena.add(barras);

  // marcador da loja: losango + haste + anel pulsando
  const marcador = new THREE.Group();
  marcador.position.set(lx, ly, lz);
  const haste = new THREE.Line(new THREE.BufferGeometry().setFromPoints([v3(0, 0, 0), v3(0, 34, 0)]), new THREE.LineBasicMaterial({ color: 0xffd100 }));
  const losango = new THREE.Mesh(new THREE.OctahedronGeometry(4.2, 0), new THREE.MeshBasicMaterial({ color: 0xffd100 }));
  losango.position.y = 38;
  const anelLoja = new THREE.Mesh(new THREE.RingGeometry(7, 8.2, 48), new THREE.MeshBasicMaterial({ color: 0xffd100, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  anelLoja.rotation.x = -Math.PI / 2;
  anelLoja.position.y = 0.5;
  marcador.add(haste, losango, anelLoja);
  marcador.scale.setScalar(0.001);
  cena.add(marcador);
  // radar em Busan: pequeno losango fixo
  const base = new THREE.Mesh(new THREE.OctahedronGeometry(3.2, 0), new THREE.MeshBasicMaterial({ color: 0xffd100 }));
  base.position.set(bx, 4, bz);
  cena.add(base);

  // ---------------- a loja, dentro da cena, no lugar do marcador
  const loja = new THREE.Group();
  loja.position.set(lx, ly, lz);
  loja.visible = false;
  cena.add(loja);

  // piso de pontos: abre em círculo, com grade mais forte e uma onda de scanner
  const pisoPos = [];
  for (let z = -L.piso; z <= L.piso; z += L.passoPiso) {
    for (let x = -L.piso; x <= L.piso; x += L.passoPiso) if (Math.hypot(x, z) <= L.piso) pisoPos.push(x, 0, z);
  }
  const geoPiso = new THREE.BufferGeometry();
  geoPiso.setAttribute('position', new THREE.Float32BufferAttribute(pisoPos, 3));
  const UP = { uAbre: { value: 0 }, uTempo: { value: 0 }, uRaio: { value: L.piso }, uDpr: U.uDpr };
  const piso = new THREE.Points(geoPiso, new THREE.ShaderMaterial({
    uniforms: UP, transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uAbre, uTempo, uRaio, uDpr;
      varying float vA, vScan;
      void main() {
        float r = length(position.xz);
        float raio = uAbre * uRaio * 1.15;
        float a = (1.0 - smoothstep(raio - 8.0, raio, r)) * (1.0 - smoothstep(uRaio * 0.45, uRaio, r));
        float onda = fract(uTempo * 0.22) * uRaio;
        float scan = exp(-pow((r - onda) / 2.5, 2.0)) * (1.0 - r / uRaio);
        vec2 g = abs(fract(position.xz / 8.0 + 0.5) - 0.5) * 8.0;
        float linha = 1.0 - smoothstep(0.0, 0.8, min(g.x, g.y));
        vA = a * (0.14 + linha * 0.4 + scan * 0.7);
        vScan = scan;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (1.0 + linha * 0.6) * uDpr * (260.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA, vScan;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        if (length(c) > 0.5 || vA < 0.004) discard;
        gl_FragColor = vec4(mix(vec3(1.0, 0.82, 0.0), vec3(1.0, 0.96, 0.75), vScan), vA);
      }`,
  }));
  loja.add(piso);

  // pedestais com arestas amarelas, tampo aceso e cone de luz do spot
  const [pw, ph, pd] = L.pedestal;
  const geoCorpo = new THREE.BoxGeometry(pw, ph, pd);
  const geoArestas = new THREE.EdgesGeometry(geoCorpo);
  const geoCone = new THREE.ConeGeometry(L.raioCone, L.cone, 48, 1, true);
  const materialCone = (destaque) => new THREE.ShaderMaterial({
    uniforms: { uCor: { value: new THREE.Color(destaque ? 0xffd100 : 0xfff1c9) }, uForca: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying float vY, vFrente;
      void main() {
        vY = uv.y; // 1 no topo (spot), 0 na base
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vFrente = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCor; uniform float uForca;
      varying float vY, vFrente;
      void main() {
        float a = pow(1.0 - vY, 1.3) * pow(vFrente, 2.0) * 0.17 * uForca;
        gl_FragColor = vec4(uCor, a);
      }`,
  });
  const xs = PLANOS.map(() => 0);
  const espalhar = () => { const e = celular() ? L.espacoCel : L.espaco; xs.forEach((_, i) => { xs[i] = (i - (xs.length - 1) / 2) * e; }); };
  espalhar();
  const pedestais = xs.map((x, i) => {
    const destaque = !!PLANOS[i].destaque;
    const g = new THREE.Group();
    g.position.x = x;
    const corpo = new THREE.Mesh(geoCorpo, new THREE.MeshBasicMaterial({ color: 0x0f0f11 }));
    corpo.position.y = ph / 2;
    const arestas = new THREE.LineSegments(geoArestas, new THREE.LineBasicMaterial({ color: 0xffd100, transparent: true, opacity: destaque ? 0.95 : 0.5 }));
    arestas.position.y = ph / 2;
    const tampo = new THREE.Mesh(new THREE.PlaneGeometry(pw - 1.4, pd - 1.4), new THREE.MeshBasicMaterial({
      color: destaque ? 0xffd100 : 0xfff1c9, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    tampo.rotation.x = -Math.PI / 2;
    tampo.position.y = ph + 0.05;
    const cone = new THREE.Mesh(geoCone, materialCone(destaque));
    cone.position.y = ph + L.cone / 2;
    g.add(corpo, arestas, tampo, cone);
    g.scale.y = 0.001;
    loja.add(g);
    return { g, tampo, cone, destaque, forca: 0, alvo: 1 };
  });

  // ---------------- renderizador e câmera
  const canvas = secao.querySelector('.rumo__cena');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(U.uDpr.value);
  renderer.setClearColor(0x0a0a0b, 1);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 6000);
  let W = 1, H = 1, desvio = -1;
  const medir = () => {
    W = innerWidth; H = innerHeight;
    espalhar();
    pedestais.forEach((pe, i) => { pe.g.position.x = xs[i]; });
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    desvio = -1;
  };
  // empurra a cena para a direita do painel (no celular, para baixo); some na loja
  const ajustarDesvio = (t) => {
    const d = Math.round((1 - t) * 1000) / 1000;
    if (d === desvio) return;
    desvio = d;
    if (W > 860) camera.setViewOffset(W, H, -W * 0.2 * d, 0, W, H);
    else camera.setViewOffset(W, H, 0, -H * 0.16 * d, W, H);
    camera.updateProjectionMatrix();
  };
  medir();

  // ---------------- poses da câmera — alvo e posição
  const centro = v3(...(() => { const [x, z] = mundo(127.6, 37.6); return [x, 0, z]; })());
  const poses = [
    { alvo: centro.clone(), pos: v3(centro.x + 60, 1150, centro.z + 260) }, // 1: quase de cima
    { alvo: v3((bx + lx) / 2, 0, (bz + lz) / 2), pos: v3(bx + 420, 520, bz + 360) }, // 2: setor em perspectiva
    { alvo: v3((bx + lx) / 2 - 30, 20, (bz + lz) / 2 - 40), pos: v3(bx + 160, 120, bz + 170) }, // 3: rente, relevo
    { alvo: v3(lx, ly + 22, lz), pos: v3(lx + 90, ly + 70, lz + 120) }, // 4: no marcador
  ];
  const poseLoja = { pos: new THREE.Vector3(), alvo: new THREE.Vector3() };
  const pCam = new THREE.Vector3(), pAlvo = new THREE.Vector3();
  const mouse = { x: 0, y: 0, ax: 0, ay: 0 };

  // ---------------- painel e camada da loja (HTML)
  const painel = secao.querySelector('.rumo__painel');
  const numEl = secao.querySelector('.rumo__num');
  const tituloEtapa = secao.querySelector('.rumo__etapa-titulo');
  const textoEtapa = secao.querySelector('.rumo__etapa-texto');
  const etapaCaixa = secao.querySelector('.rumo__etapa');
  const conts = { alcance: secao.querySelector('[data-cont="alcance"]'), abertura: secao.querySelector('[data-cont="abertura"]'), armas: secao.querySelector('[data-cont="armas"]') };
  const valores = { alcance: 0, abertura: 0, armas: 0 };
  const rotuloLoja = secao.querySelector('.rumo__rotulo-loja');
  const rotulosAneis = [...secao.querySelectorAll('.rumo__anel')];
  const cabeca = secao.querySelector('.rumo__loja-cabeca');
  const letreiro = secao.querySelector('.rumo__letreiro');
  const cartoes = [...secao.querySelectorAll('.rumo__vitrines .plano')];
  let etapa = -1;

  function mostrarEtapa(i) {
    if (i === etapa) return;
    const primeira = etapa < 0;
    etapa = i;
    const e = ETAPAS[i];
    const trocar = () => {
      numEl.textContent = `${pad(i + 1)} / ${pad(ETAPAS.length)}`;
      tituloEtapa.textContent = e.titulo;
      textoEtapa.textContent = e.texto;
    };
    if (primeira || reduzir) trocar();
    else {
      gsap.timeline()
        .to(etapaCaixa, { opacity: 0, y: -10, duration: 0.22, ease: 'power2.in' })
        .call(trocar)
        .fromTo(etapaCaixa, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' });
    }
    gsap.to(valores, {
      ...CONTADORES[i], duration: reduzir ? 0 : 1.1, ease: 'power2.out', overwrite: true,
      onUpdate: () => { for (const k in conts) conts[k].textContent = Math.round(valores[k]); },
    });
  }

  const proj = new THREE.Vector3();
  const naTela = (x, y, z) => {
    proj.set(x, y, z).project(camera);
    return { x: (proj.x * 0.5 + 0.5) * W, y: (-proj.y * 0.5 + 0.5) * H, ok: proj.z < 1 };
  };
  const posicionar = (el, x, y, z, visivel) => {
    const q = naTela(x, y, z);
    const ok = visivel && q.ok;
    el.style.opacity = ok ? '1' : '0';
    if (ok) el.style.transform = `translate(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px)`;
  };

  // estado que a rolagem decide (aplicar) e o quadro usa
  let p = 0;
  const E = { marc: 0, some: 0, loja: 0, cab: 0, passeio: 0, cams: [0, 0, 0, 0], cart: cartoes.map(() => 0) };

  function aplicar() {
    E.cams = T.cams.map((c) => fase(p, c));
    let et = 0;
    T.etapas.forEach((inicio, i) => { if (p >= inicio) et = i; });
    mostrarEtapa(et);

    // etapa 1: pulso circular a partir de Busan
    U.uPulso.value = p < T.pulso[1] + 0.03 ? lim(p / T.pulso[1]) * 900 : 0;
    // etapa 2: setor abrindo anel por anel
    const tSetor = fase(p, T.setor);
    E.some = fase(p, T.some);
    U.uSetor.value = tSetor;
    U.uSome.value = E.some;
    setor.visible = tSetor > 0.01 && E.some < 0.99;
    amareloLinha.opacity = 0.85 * (1 - E.some);
    tracejado.opacity = 0.7 * (1 - E.some);
    aneis.forEach((a, k) => { a.visible = tSetor * V.alcance >= V.aneis[k]; });
    // etapa 3: relevo sobe, barras de sinal crescem
    const tRel = fase(p, T.relevo);
    U.uRelevo.value = tRel;
    barras.children.forEach((b) => {
      const k = lim((tRel - b.userData.atraso) / 0.5);
      b.scale.y = Math.max(0.001, k);
      b.position.y = alturaEm(b.position.x, b.position.z) * V.altura * tRel;
      b.material.opacity = k * 0.9 * (1 - E.some);
    });
    base.position.y = 4 + alturaEm(bx, bz) * V.altura * tRel;
    // etapa 4: marcador da loja (some quando a loja nasce)
    E.marc = fase(p, T.marcador);
    marcador.scale.setScalar(Math.max(0.001, E.marc * (1 - E.some)));
    marcador.visible = E.marc * (1 - E.some) > 0.01;
    marcador.position.y = ly * tRel;

    // painel sai
    const tPainel = fase(p, T.painel);
    painel.style.opacity = String(1 - tPainel);
    painel.style.translate = `${(-50 * tPainel).toFixed(1)}px 0`;
    painel.style.visibility = tPainel > 0.99 ? 'hidden' : 'visible';

    // a loja: piso abre, pedestais sobem um a um, cones acendem
    E.loja = fase(p, T.loja);
    loja.visible = E.loja > 0.001;
    UP.uAbre.value = E.loja;
    pedestais.forEach((pe, i) => {
      const k = suave(lim((E.loja - 0.3 - i * 0.1) / 0.4));
      pe.g.scale.y = Math.max(0.001, k);
    });
    E.cab = fase(p, T.cabeca);
    letreiro.classList.toggle('aceso', E.cab > 0.6);
    E.cart = cartoes.map((_, i) => fase(p, [T.cartoes[0] + i * T.atrasoCartao, T.cartoes[1] + i * T.atrasoCartao]));
    E.passeio = fase(p, T.passeio);
  }

  function quadro() {
    const cel = celular();
    // câmera: encadeia as poses; a última (loja) acompanha o mouse e, no celular, o passeio
    pCam.copy(poses[0].pos); pAlvo.copy(poses[0].alvo);
    for (let k = 1; k < poses.length; k++) { pCam.lerp(poses[k].pos, E.cams[k - 1]); pAlvo.lerp(poses[k].alvo, E.cams[k - 1]); }
    const C = L.camera;
    let px = 0;
    if (cel) {
      const seg = E.passeio * (xs.length - 1), i = Math.min(xs.length - 2, Math.floor(seg));
      px = THREE.MathUtils.lerp(xs[i], xs[i + 1], suave(lim((seg - i - 0.2) / 0.6)));
    }
    poseLoja.alvo.set(lx + px, ly + C.alvoY, lz);
    poseLoja.pos.set(lx + px + mouse.ax * L.parallax, ly + C.altura - mouse.ay * L.parallax * 0.6, lz + C.dist);
    const t4 = E.cams[3];
    pCam.lerp(poseLoja.pos, t4); pAlvo.lerp(poseLoja.alvo, t4);
    camera.position.copy(pCam);
    camera.lookAt(pAlvo);
    ajustarDesvio(t4);
    camera.updateMatrixWorld();

    // rótulos HTML presos ao 3D
    rotulosAneis.forEach((el, k) => posicionar(el, ...pontoSetor(rumoLoja + meia, V.aneis[k], 2).toArray(), aneis[k].visible && E.some < 0.05));
    posicionar(rotuloLoja, lx, marcador.position.y + 46 * E.marc, lz, E.marc > 0.5 && E.some < 0.15 && !cel);

    // cartões em pé na frente de cada pedestal
    if (E.loja > 0.001) {
      const a0 = naTela(lx + xs[0], ly + ph, lz + pd / 2), a1 = naTela(lx + xs[1], ly + ph, lz + pd / 2);
      const largura = cartoes[0]?.offsetWidth || 280;
      let escala = Math.min(L.cartaoMax, (Math.abs(a1.x - a0.x) - 18) / largura);
      if (cel) escala = Math.min(escala, (W - 48) / largura);
      escala = Math.max(0.55, escala);
      let topo = Infinity;
      cartoes.forEach((el, i) => {
        const k = E.cart[i];
        const q = naTela(lx + xs[i], ly + ph, lz + pd / 2);
        el.style.opacity = k.toFixed(3);
        el.style.visibility = k > 0.01 ? 'visible' : 'hidden';
        el.style.pointerEvents = k > 0.6 ? 'auto' : 'none';
        el.style.transform = `translate3d(${q.x.toFixed(1)}px, ${(q.y - 10 + (1 - k) * 70).toFixed(1)}px, 0) translate(-50%, -100%) scale(${escala.toFixed(3)})`;
        topo = Math.min(topo, q.y - 10 - el.offsetHeight * escala);
      });
      // letreiro + título logo acima dos cartões (no celular, preso no alto pelo CSS)
      cabeca.style.opacity = E.cab.toFixed(3);
      cabeca.style.visibility = E.cab > 0.01 ? 'visible' : 'hidden';
      if (!cel) {
        const c = naTela(lx, ly + ph, lz);
        cabeca.style.transform = `translate(${c.x.toFixed(1)}px, ${(topo - 28 + (1 - E.cab) * 30).toFixed(1)}px)`;
      } else cabeca.style.transform = '';
    } else {
      cabeca.style.visibility = 'hidden';
      cartoes.forEach((el) => { el.style.visibility = 'hidden'; el.style.pointerEvents = 'none'; });
    }
  }

  // hover no cartão acende o spot do pedestal dele
  cartoes.forEach((el, i) => {
    el.addEventListener('pointerenter', () => { pedestais[i].alvo = 2; });
    el.addEventListener('pointerleave', () => { pedestais[i].alvo = 1; });
  });
  if (temMouse && !reduzir) {
    secao.addEventListener('pointermove', (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1; });
    secao.addEventListener('pointerleave', () => { mouse.x = 0; mouse.y = 0; });
  }

  addEventListener('resize', () => { medir(); aplicar(); quadro(); });
  aplicar();
  quadro();

  let visivel = false;
  new IntersectionObserver(([en]) => { visivel = en.isIntersecting; }).observe(secao);
  let antes = 0;
  gsap.ticker.add((tt) => {
    if (!visivel) return;
    const dt = Math.min(0.05, tt - antes || 0.016);
    antes = tt;
    const k = 1 - Math.exp(-dt * 4);
    mouse.ax += (mouse.x - mouse.ax) * k;
    mouse.ay += (mouse.y - mouse.ay) * k;
    U.uVarre.value = rumoLoja - meia + ((tt * 0.45) % 1) * meia * 2; // varre de uma borda à outra
    UP.uTempo.value = tt;
    losango.rotation.y = tt * 1.2;
    anelLoja.scale.setScalar(1 + ((tt * 0.8) % 1) * 1.6);
    anelLoja.material.opacity = 1 - ((tt * 0.8) % 1);
    pedestais.forEach((pe, i) => {
      pe.forca += (pe.alvo - pe.forca) * (1 - Math.exp(-dt * 6));
      const aceso = E.cart[i];
      pe.cone.material.uniforms.uForca.value = pe.forca * aceso * (pe.destaque ? 1.25 : 1);
      pe.tampo.material.opacity = (pe.destaque ? 0.55 : 0.28) * aceso * (0.7 + pe.forca * 0.3);
    });
    quadro();
    renderer.render(cena, camera);
  });

  const tween = gsap.to({ v: 0 }, {
    v: 1, ease: 'none',
    onUpdate() { p = this.targets()[0].v; aplicar(); },
    scrollTrigger: { trigger: secao, start: 'top top', end: () => `+=${innerHeight * V.telas}`, pin: true, scrub: reduzir ? true : 0.8 },
  });

  // "Ver preços" e links para #loja: rolam até a loja dentro da cena
  const irParaLoja = (e) => {
    e.preventDefault();
    const st = tween.scrollTrigger;
    const alvo = st.start + (st.end - st.start) * 0.86;
    if (lenis) lenis.scrollTo(alvo, { duration: reduzir ? 0 : 2.4 });
    else window.scrollTo({ top: alvo, behavior: reduzir ? 'auto' : 'smooth' });
  };
  document.querySelectorAll('a[href="#loja"]').forEach((a) => a.addEventListener('click', irParaLoja));

  if (!reduzir) {
    gsap.from(secao.querySelectorAll('.rumo__titulo > span > span, .rumo__rotulo'), {
      yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.08,
      scrollTrigger: { trigger: secao, start: 'top 70%' },
    });
  }
  if (import.meta.env.DEV) window.__rumo = { definir: (v) => { p = v; aplicar(); quadro(); renderer.render(cena, camera); }, tween };
}
