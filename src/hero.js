import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { criarTopo } from './topo.js';

gsap.registerPlugin(SplitText);

// ---------------------------------------------------------------------------
// CONFIGS (tudo que dá para ajustar rápido fica aqui)
// ---------------------------------------------------------------------------

const ENTRADA = {
  mapa: 0, // s: a topografia começa a se desenhar do centro para fora
  mapaDura: 2.6, // s: duração do desenho do mapa
  linha1: 0.4, // s: "PULE O" sobe letra por letra
  linha1Stagger: 0.04, // s entre cada letra
  grind: 0.6, // s: barra amarela cobre o "GRIND"
  grindCobre: 0.55, // s: barra cobrindo (power3.in, arranca)
  grindSai: 0.8, // s: barra saindo (expo.out)
  pincel: 1.25, // s: "부스트" é pincelado, sílaba por sílaba
  pincelDura: 0.42, // s de cada pincelada
  pincelStagger: 0.16, // s entre uma sílaba e outra
  luz: 1.3, // s: o brilho amarelo do mouse liga no mapa
};

const PARALLAX = {
  titulo: { x: 14, y: 10 }, // px que o título anda (contra o mouse)
  pincel: { x: 10, y: 8 }, // px a mais que a pincelada anda (dá profundidade)
  mapa: { x: 30, y: 20 }, // px que a topografia anda (a favor do mouse)
  suavidade: 4, // maior = segue mais rápido (suavização exponencial por segundo)
  mouse: 6, // suavidade do brilho amarelo seguindo o mouse
};

// ---------------------------------------------------------------------------

const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const temMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

function montarMovimento(hero, topo) {
  const titulo = hero.querySelector('.titulo');
  const pincel = hero.querySelector('.titulo__pincel');

  const mouse = { x: 0.5, y: 0.5, dentro: false };
  const par = { x: 0, y: 0 };
  const luz = { x: innerWidth / 2, y: innerHeight / 2 };
  let tempo = 0;

  hero.addEventListener('pointermove', (e) => {
    mouse.x = e.clientX / innerWidth;
    mouse.y = e.clientY / innerHeight;
    mouse.dentro = true;
  });
  hero.addEventListener('pointerleave', () => { mouse.dentro = false; });

  const set = (el, prop) => gsap.quickSetter(el, prop, 'px');
  const tituloX = set(titulo, 'x'), tituloY = set(titulo, 'y');
  const pincelX = set(pincel, 'x'), pincelY = set(pincel, 'y');

  gsap.ticker.add((_, dtMs) => {
    const dt = Math.min(dtMs / 1000, 0.05);
    tempo += dt;

    const ativo = mouse.dentro && temMouse && !reduzir;
    const k = 1 - Math.exp(-dt * PARALLAX.suavidade);
    par.x += ((ativo ? mouse.x * 2 - 1 : 0) - par.x) * k;
    par.y += ((ativo ? mouse.y * 2 - 1 : 0) - par.y) * k;

    tituloX(-par.x * PARALLAX.titulo.x);
    tituloY(-par.y * PARALLAX.titulo.y);
    pincelX(-par.x * PARALLAX.pincel.x);
    pincelY(-par.y * PARALLAX.pincel.y);

    // sem mouse, o brilho passeia devagar em volta do centro
    const alvoX = ativo ? mouse.x * innerWidth : innerWidth * (0.5 + Math.sin(tempo * 0.35) * 0.22);
    const alvoY = ativo ? mouse.y * innerHeight : innerHeight * (0.5 + Math.sin(tempo * 0.48) * 0.16);
    const km = 1 - Math.exp(-dt * PARALLAX.mouse);
    luz.x += (alvoX - luz.x) * km;
    luz.y += (alvoY - luz.y) * km;

    const e = topo.estado;
    e.mouseX = luz.x;
    e.mouseY = luz.y;
    e.deslocX = par.x * PARALLAX.mapa.x;
    e.deslocY = par.y * PARALLAX.mapa.y;
    topo.quadro();
  });
}

function criarEntrada(hero, topo) {
  const E = ENTRADA;
  const linha1 = SplitText.create(hero.querySelector('.titulo__linha1'), { type: 'chars', mask: 'chars' });
  const grind = hero.querySelector('.titulo__grind');
  const barra = hero.querySelector('.titulo__barra');
  const silabas = hero.querySelectorAll('.titulo__pincel > span');

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });

  // mostra tudo no instante 0 (funciona tanto com play() quanto pulando para um tempo)
  tl.set(hero, { visibility: 'visible', immediateRender: false }, 0);

  tl.fromTo(topo.estado, { entrada: 0 }, { entrada: 1, duration: E.mapaDura, ease: 'power2.inOut' }, E.mapa);

  // "PULE O": letras sobem de dentro da máscara
  tl.from(linha1.chars, { yPercent: 115, duration: 1.3, stagger: E.linha1Stagger }, E.linha1);

  // "GRIND": barra amarela cobre, sai, e o espaçamento das letras assenta
  const revela = E.grind + E.grindCobre;
  tl.set(grind, { autoAlpha: 0 }, 0)
    .fromTo(barra, { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: E.grindCobre, ease: 'power3.in', immediateRender: false }, E.grind)
    .set(grind, { autoAlpha: 1 }, revela)
    .set(barra, { transformOrigin: 'right center' }, revela)
    .to(barra, { scaleX: 0, duration: E.grindSai }, revela)
    .from(grind, { letterSpacing: '0.08em', scale: 0.94, duration: 1.6 }, revela);

  // "부스트": cada sílaba é pincelada da esquerda para a direita, com um tranco
  tl.fromTo(
    silabas,
    { clipPath: 'inset(-20% 100% -20% 0%)', x: -14, scale: 1.12 },
    { clipPath: 'inset(-20% 0% -20% 0%)', x: 0, scale: 1, duration: E.pincelDura, ease: 'power2.out', stagger: E.pincelStagger, immediateRender: true },
    E.pincel,
  );

  tl.fromTo(topo.estado, { luz: 0 }, { luz: 1, duration: 1.6, ease: 'power2.out' }, E.luz);

  return tl;
}

export function iniciarHero() {
  const hero = document.querySelector('.hero');
  const topo = criarTopo(hero.querySelector('.topo'));
  montarMovimento(hero, topo);
  const entrada = criarEntrada(hero, topo);

  if (reduzir) {
    // sem movimento: estado final direto
    entrada.progress(1);
    gsap.set(hero, { visibility: 'visible' });
  }
  return { entrada, reduzir, topo };
}
