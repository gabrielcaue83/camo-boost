import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { carregarArma, ARMA } from './arma/modelo.js';
import { criarMateriais, CAMOS } from './arma/camos.js';
import { criarEstudio, distanciaCamera } from './arma/estudio.js';
import { PRELOADER } from './preloader.js';
import { EASE } from './movimento.js';

gsap.registerPlugin(ScrollTrigger);

// A arma da hero: é a continuação da arma do preloader. Nasce exatamente na
// pose, no tamanho e na camo em que o preloader termina (Divergência, mesma
// câmera), então a cortina sobe e a arma "fica". Depois cresce para a pose da
// hero, com o "GRIND" atrás dela, gira com o mouse e troca de camo devagar.
// Rolando, ela fica presa à tela (canvas fixo) e vai se encaixando na pose
// EXATA da arma da vitrine (lida ao vivo: posição, giro, tamanho, camo Ouro).
// A arma da vitrine fica escondida até a vitrine prender no topo; nesse
// instante as duas estão idênticas e uma troca pela outra: parece uma só.

// ---------------------------------------------------------------------------
// CONFIGS
// ---------------------------------------------------------------------------
export const ARMA_HERO = {
  escala: 1.32, // tamanho na hero em relação ao preloader (preloader = 1)
  cresce: 1.5, // s: do tamanho do preloader até o da hero
  atraso: 0.45, // s depois que a hero começa a entrar (espera a cortina passar da arma)
  desce: 0.42, // fração da altura do "GRIND": a arma fica na metade de baixo da palavra (o topo das letras aparece)
  troca: 10, // s parada em cada camo antes de trocar sozinha (dá tempo de curtir a camo)
  varredura: 1.9, // s: varredura de uma camo para a outra (a cortina de cor passa junto)
  giroBase: -0.3, // rad: pose de descanso (lado esquerdo da arma)
  balanco: 0.12, // rad: vai e volta sozinha devagar
  mouse: { y: 0.5, x: 0.16 }, // rad que o mouse gira (para os lados) e inclina (para cima/baixo)
  flutua: { altura: 0.1, vel: 1.0, balanco: 0.03 }, // unidades / ciclos por s / rad
  encaixe: [0.3, 1], // faixa da rolagem da hero em que a arma vai da pose da hero para a pose da vitrine
  troca: 0.995, // progresso da rolagem em que a arma da hero vira a da vitrine
  volta: { giros: 1, inclina: 0.22, sobe: 0.35 }, // caminho até a vitrine (a rolagem inteira da hero): voltas completas, em ritmo constante / rad de inclinação no meio / unidades que ela sobe no meio do arco
};

const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lim = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const suave = (t) => t * t * (3 - 2 * t);

export function criarArmaHero(hero, { aoTrocar } = {}) {
  const A = ARMA_HERO, P = PRELOADER;
  const canvas = hero.querySelector('.hero__arma');
  const grind = hero.querySelector('.titulo__grind');

  const { renderer, cena } = criarEstudio(canvas);
  const camera = new THREE.PerspectiveCamera(P.fov, 1, 0.1, 100);
  const materiais = criarMateriais();
  const U = materiais.uniforms;
  const DIVERGENCIA = CAMOS.length - 1;
  U.uCamoA.value = DIVERGENCIA; // começa onde o preloader termina
  U.uCamoB.value = DIVERGENCIA;
  const pivo = new THREE.Group();
  pivo.rotation.y = P.giro;
  cena.add(pivo);
  carregarArma(materiais)
    .then(({ grupo }) => { pivo.add(grupo); renderer.compile(cena, camera); })
    .catch((e) => console.error('[hero] a arma não carregou', e));

  // --- enquadramento: mesma câmera do preloader; a arma desce até o "GRIND"
  let alvoY = 0;
  let dCamera = 10; // distância da câmera da hero (para converter a pose da vitrine)
  const medir = () => {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const d = distanciaCamera(P.fov, camera.aspect, ARMA.comprimento, P.folga, 6.4 * P.folga / 1.18);
    camera.position.set(0, 0, d);
    dCamera = d;
    camera.updateProjectionMatrix();
    const porPx = (2 * d * Math.tan(THREE.MathUtils.degToRad(P.fov / 2))) / h;
    const r = grind.getBoundingClientRect(), topoHero = hero.getBoundingClientRect().top;
    const dy = r.top - topoHero + r.height * (0.5 + A.desce) - h / 2; // a hero no topo da página
    alvoY = -dy * porPx;
  };
  medir();
  addEventListener('resize', medir);

  // --- troca de camo (varredura do cano à coronha, como na vitrine)
  // a cada troca a varredura muda de sentido (vai do cano à coronha, volta da
  // coronha ao cano) e avisa a hero, que passa a cortina de cor junto
  let idCamo = DIVERGENCIA, troca = null, proxima = Infinity, sentido = 1;
  const varrer = (id, dur = A.varredura) => {
    if (id === idCamo || troca?.isActive()) return;
    const velho = idCamo;
    idCamo = id;
    const d = reduzir ? 0 : dur;
    aoTrocar?.(id, d, sentido);
    if (sentido > 0) { // nova entra pelo cano (esquerda)
      U.uCamoA.value = velho; U.uCamoB.value = id;
      troca = gsap.fromTo(U.uTransicao, { value: 0 }, {
        value: 1, duration: d, ease: 'power2.inOut',
        onComplete: () => { U.uCamoA.value = id; U.uTransicao.value = 0; },
      });
    } else { // nova entra pela coronha (direita): A = nova, B = velha, o corte volta
      U.uCamoA.value = id; U.uCamoB.value = velho;
      troca = gsap.fromTo(U.uTransicao, { value: 1 }, {
        value: 0, duration: d, ease: 'power2.inOut',
        onComplete: () => { U.uTransicao.value = 0; U.uCamoB.value = id; },
      });
    }
    sentido = -sentido;
  };

  // --- estado: cresce (0 = pose do preloader, 1 = pose da hero) e rolagem
  const est = { cresce: reduzir ? 1 : 0, p: 0 };
  let vitrine = null; // { pivo, camera, canvas } da vitrine, ligado depois que ela existe
  /** liga a arma da vitrine: a da hero se encaixa nela e as duas trocam de lugar */
  function ligarVitrine(v) {
    vitrine = { pivo: v.pivo, camera: v.camera, canvas: document.querySelector('.vitrine__canvas') };
    aplicarTroca();
  }
  // antes da troca só a arma da hero aparece; depois, só a da vitrine
  let trocou = null;
  const aplicarTroca = () => {
    const agora = est.p >= A.troca;
    if (agora === trocou || !vitrine) return;
    trocou = agora;
    canvas.style.visibility = agora ? 'hidden' : 'visible';
    vitrine.canvas.style.opacity = agora ? '' : '0';
  };
  if (reduzir) varrer(0, 0);

  /** entra na timeline da hero (t0 = quando a hero começa a entrar) */
  function entrar(tl, t0 = 0) {
    tl.to(est, { cresce: 1, duration: A.cresce, ease: EASE.move }, t0 + A.atraso)
      .call(() => { proxima = tempo + A.troca * 0.6; }, null, t0 + A.atraso + A.cresce);
  }

  // --- rolagem: desce junto com a tela e some onde a arma da vitrine aparece
  ScrollTrigger.create({
    trigger: hero, start: 'top top', end: 'bottom top', scrub: true,
    onUpdate: (st) => { est.p = st.progress; aplicarTroca(); },
  });

  let visivel = true;
  new IntersectionObserver(([e]) => { visivel = e.isIntersecting; }).observe(hero);

  let tempo = 0;
  /** chamado pelo laço da hero; par = mouse suavizado (-1..1) */
  function quadro(dt, par) {
    tempo += dt;
    U.uTempo.value = tempo;
    // troca sozinha enquanto está na hero; rolando, vai para a Ouro (a primeira camo da vitrine)
    if (est.p > 0.04) { proxima = Infinity; if (idCamo !== 0) varrer(0, 0.6); }
    else if (est.cresce >= 1 && proxima === Infinity && !reduzir) proxima = tempo + A.troca;
    if (tempo > proxima) { proxima = tempo + A.troca + A.varredura; varrer((idCamo + 1) % CAMOS.length); }

    const k = est.cresce, F = A.flutua;
    const t = reduzir ? 0 : tempo;
    // pose da hero
    let s = 1 + (A.escala - 1) * k;
    let x = 0, y = alvoY * k + Math.sin(t * F.vel) * F.altura * k;
    let rx = (par.y * A.mouse.x + Math.sin(t * F.vel * 0.7) * F.balanco) * k;
    let ry = P.giro + (A.giroBase - P.giro) * k + (par.x * A.mouse.y + Math.sin(t * 0.35) * A.balanco) * k;
    let rz = Math.sin(t * F.vel * 0.8) * F.balanco * k;
    // rolando: encaixa na pose da arma da vitrine (convertida para a câmera da hero)
    const [a, b] = A.encaixe;
    const m = vitrine ? suave(lim((est.p - a) / (b - a))) : 0;
    if (m > 0) {
      const vp = vitrine.pivo, conv = dCamera / vitrine.camera.position.z;
      s += (vp.scale.x * conv - s) * m;
      x += (vp.position.x * conv - x) * m;
      y += (vp.position.y * conv - y) * m;
      rx += (vp.rotation.x - rx) * m;
      ry += (vp.rotation.y - ry) * m;
      rz += (vp.rotation.z - rz) * m;
    }
    // o caminho inteiro até a vitrine é o giro: as voltas são distribuídas por toda a rolagem da hero, em ritmo
    // constante (a arma nunca fica parada enquanto rola) e terminam numa volta completa = a mesma pose da vitrine.
    // No meio do caminho ela inclina e sobe um pouco (arco).
    if (est.p > 0) {
      const V = A.volta, meio = Math.sin(est.p * Math.PI);
      const conv = vitrine ? dCamera / vitrine.camera.position.z : 1;
      ry += Math.PI * 2 * V.giros * est.p;
      rx += meio * V.inclina;
      y += meio * V.sobe * conv;
    }
    pivo.scale.setScalar(s);
    pivo.position.set(x, y, 0);
    pivo.rotation.set(rx, ry, rz);
    if (visivel && !trocou) renderer.render(cena, camera);
  }

  return { entrar, quadro, ligarVitrine };
}
