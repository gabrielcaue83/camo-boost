import './style.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { iniciarHero } from './hero.js';
import { iniciarVitrine } from './arma/vitrine.js';
import { iniciarPreloader } from './preloader.js';
import { iniciarComoFunciona } from './comoFunciona.js';
import { iniciarPrecos } from './precos/precos.js';

gsap.registerPlugin(ScrollTrigger);

// sempre começa do topo (o preloader cobre a página)
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
scrollTo(0, 0);

const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Rolagem suave ligada ao ScrollTrigger (parada até o preloader sair)
const lenis = new Lenis({ lerp: 0.1 });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
lenis.stop();

// Espera as fontes: o SplitText precisa medir as letras já com a fonte final
const pronto = document.fonts.ready.then(() => {
  const hero = iniciarHero();
  const vitrine = iniciarVitrine(document.querySelector('.vitrine'), { topoHero: hero.topo, lenis });
  iniciarComoFunciona(document.querySelector('.missao'));
  iniciarPrecos(document.querySelector('.rumo'), { lenis });
  ScrollTrigger.refresh();
  if (import.meta.env.DEV) window.__site = { gsap, lenis, entrada: hero.entrada, vitrine, ScrollTrigger };
  return hero;
});

// O preloader começa na hora; quando sai, a hero entra e a rolagem libera
iniciarPreloader({
  reduzir,
  esperar: pronto,
  aoSair: (hero) => {
    lenis.start();
    if (!hero.reduzir) hero.entrada.play(0);
    ScrollTrigger.refresh();
  },
});
