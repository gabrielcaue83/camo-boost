import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { criarTopo } from './topo.js';
import { criarArmaHero } from './heroArma.js';
import { EASE } from './movimento.js';

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
  numeros: 1.0, // s: os números do grind sobem e começam a contar
  conta: 1.1, // s: tempo dos números correndo até o valor
  risca: 2.25, // s: a barra amarela risca os números (o grind foi "pulado")
  riscaStagger: 0.14, // s entre um risco e outro
  oferta: 1.6, // s: linha do serviço e botão "Ver preços" entram
};

// Cortina de cor: quando a arma troca de camo, uma cortina passa pela tela
// (indo e voltando) e pinta tudo que é amarelo na hero com a cor da camo nova:
// a pincelada, os riscos dos números, o botão, o brilho da topografia e um halo atrás da arma.
export const CENA = {
  cores: ['#ffd100', '#e3e8ef', '#ff2b3f', '#b9a8ff'], // Ouro (o amarelo da marca), Platina, Harmonic Break, Divergência
  tintaLinhas: 0.22, // 0..1: quanto as curvas da topografia puxam para a cor da camo
  linha: '#e9e9e4', // cor base das curvas (igual ao CORES.linha da topografia)
  nevoa: 140, // px: largura da borda esfumaçada da troca de cor (a cortina é uma névoa, não um corte)
  inclinacao: 0.45, // a cortina passa em diagonal ("/"): px de deslocamento por px de altura (0 = vertical)
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

const rgbDe = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const misturar = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function montarCortina(hero, topo) {
  const elementos = () => [...hero.querySelectorAll('.titulo__pincel > span, .hero__risco, .hero__oferta .botao')];
  const linhaCortina = hero.querySelector('.hero__cortina');
  let atual = CENA.cores[0];
  let tl;
  return function trocar(id, dur, sentido) {
    const nova = CENA.cores[id] || CENA.cores[0];
    if (nova === atual) return;
    const velha = atual;
    atual = nova;
    tl?.progress(1);
    const linhaNova = misturar(rgbDe(CENA.linha), rgbDe(nova), CENA.tintaLinhas);
    hero.style.setProperty('--acento', nova); // halo atrás da arma (transição pelo CSS)
    if (!dur) { // sem movimento: troca direto
      hero.style.setProperty('--esq', nova); hero.style.setProperty('--dir', nova);
      topo.estado.destaque = rgbDe(nova); topo.estado.linha = linhaNova;
      return;
    }
    // o lado por onde a cortina entra recebe a cor nova
    hero.style.setProperty('--esq', sentido > 0 ? nova : velha);
    hero.style.setProperty('--dir', sentido > 0 ? velha : nova);
    // cada elemento: onde a reta inclinada cruza o meio dele, medido ao longo do degradê (que tem o mesmo ângulo)
    const K = CENA.inclinacao, h = innerHeight;
    const ang = Math.atan(K), sx = Math.cos(ang), sy = Math.sin(ang);
    const els = elementos(), caixas = els.map((el) => {
      const r = el.getBoundingClientRect();
      return { esq: r.left, w: r.width, meioY: r.top + r.height / 2, L: r.width * sx + r.height * sy };
    });
    const e = topo.estado;
    e.corNova = rgbDe(nova); e.linhaNova = linhaNova; e.cortinaLado = sentido; e.cortinaInclina = K;
    const F = CENA.nevoa + (h / 2) * K; // passa da tela mesmo nos cantos (a reta é inclinada)
    const c = { x: sentido > 0 ? -F : innerWidth + F };
    const giro = `${(ang * 180 / Math.PI).toFixed(2)}deg`;
    const aplicar = () => {
      e.cortina = c.x;
      els.forEach((el, i) => {
        const b = caixas[i];
        const xc = c.x - (b.meioY - h / 2) * K - b.esq; // x da reta na altura do meio do elemento
        el.style.setProperty('--corte', `${((xc - b.w / 2) * sx + b.L / 2).toFixed(1)}px`);
      });
      linhaCortina.style.transform = `translate3d(${c.x.toFixed(1)}px, 0, 0) rotate(${giro})`;
    };
    aplicar();
    linhaCortina.style.setProperty('--cor', nova);
    tl = gsap.timeline({
      onComplete: () => {
        hero.style.setProperty('--esq', nova); hero.style.setProperty('--dir', nova);
        e.destaque = rgbDe(nova); e.linha = linhaNova; e.cortinaLado = 0;
      },
    })
      .to(linhaCortina, { opacity: 1, duration: dur * 0.3, ease: 'sine.out' }, 0)
      .to(c, { x: sentido > 0 ? innerWidth + F : -F, duration: dur, ease: 'sine.inOut', onUpdate: aplicar }, 0)
      .to(linhaCortina, { opacity: 0, duration: dur * 0.35, ease: 'sine.in' }, dur * 0.65);
  };
}

function montarMovimento(hero, topo, arma) {
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

    arma.quadro(dt, par);

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

function criarEntrada(hero, topo, arma) {
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

  // a arma do preloader cresce para a pose da hero
  arma.entrar(tl, 0);

  // números do grind: sobem, correm até o valor e a barra amarela risca cada um
  const itens = hero.querySelectorAll('.hero__grind > div');
  const numeros = [...hero.querySelectorAll('.hero__grind b')];
  const riscos = hero.querySelectorAll('.hero__risco');
  const formatar = (el, v) => {
    el.textContent = Math.round(v).toLocaleString('pt-BR') + (el.dataset.mais != null ? '+' : '');
  };
  tl.from(itens, { y: 24, opacity: 0, duration: 0.9, ease: EASE.saida, stagger: 0.08 }, E.numeros);
  numeros.forEach((el, i) => {
    const alvo = Number(el.dataset.numero);
    const c = { v: 0 };
    formatar(el, 0);
    tl.to(c, { v: alvo, duration: E.conta, ease: 'power2.out', onUpdate: () => formatar(el, c.v) }, E.numeros + 0.05 + i * 0.08);
  });
  tl.fromTo(riscos, { scaleX: 0 }, { scaleX: 1, duration: 0.32, ease: EASE.saida, stagger: E.riscaStagger, immediateRender: false }, E.risca)
    .to(numeros, { opacity: 0.5, duration: 0.4, stagger: E.riscaStagger }, E.risca + 0.12);

  // linha do serviço e botão
  tl.from(hero.querySelectorAll('.hero__linha, .hero__oferta .botao'), { y: 18, opacity: 0, duration: 0.9, ease: EASE.saida, stagger: 0.1 }, E.oferta);

  return tl;
}

export function iniciarHero() {
  const hero = document.querySelector('.hero');
  const topo = criarTopo(hero.querySelector('.topo'));
  const trocarCena = montarCortina(hero, topo);
  const arma = criarArmaHero(hero, { aoTrocar: trocarCena });
  montarMovimento(hero, topo, arma);
  const entrada = criarEntrada(hero, topo, arma);

  if (reduzir) {
    // sem movimento: estado final direto
    entrada.progress(1);
    gsap.set(hero, { visibility: 'visible' });
  }
  return { entrada, reduzir, topo, arma };
}
