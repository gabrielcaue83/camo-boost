import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { carregarArma } from './modelo.js';
import { criarEstudio, distanciaCamera } from './estudio.js';
import { criarMateriais, CAMOS } from './camos.js';
import { criarTopo } from '../topo.js';
import { gerarAmostras } from './amostras.js';
import { montarMestria } from './mestria.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

// ---------------------------------------------------------------------------
// CONFIGS
// ---------------------------------------------------------------------------

const VITRINE = {
  telasPorCamo: 0.8, // quanto de rolagem (em alturas de tela) cada camo segura a seção presa
  troca: 1.0, // s: duração da varredura de uma camo para outra
  balanco: 0.42, // rad: quanto a arma balança para os lados com a rolagem (nunca fica de perfil fino)
  balancoCiclos: 1.5, // quantas idas e voltas ao longo da rolagem toda
  giroInicial: -0.32, // rad: ângulo de partida (mostra o lado esquerdo, igual à referência)
  flutua: { altura: 0.12, vel: 1.1, balanco: 0.03 }, // unidades / ciclos por s / rad
  mouse: { y: 0.28, x: 0.16, suavidade: 4 }, // rad que o mouse inclina a arma
  arraste: { forca: 0.008, atrito: 3.2, volta: 0.9 }, // rad por px / desaceleração / quão rápido volta ao ângulo da rolagem
  comprimento: 7.6, // unidades: tamanho da arma (para enquadrar no celular)
  folga: { tela: 1.62, celular: 1.2 }, // arma menor que a tela para caber a trilha e a ficha (maior = menor)
  fov: 30,
  emenda: 0.5, // fração da tela: altura do degradê entre a hero (preta) e a vitrine (cor da camo)
  reflexo: 0.7, // força do ambiente refletido (estúdio)
  topoForca: 2.2, // força das linhas pretas da topografia sobre o fundo colorido (1 = igual à hero)
  topoTroca: 1.2, // s: tempo da topografia trocar de cor junto com a camo
  nome: { sai: 0.5, entra: 1.1, intervalo: 0.035, desfoque: 12 }, // troca do nome: s de saída / s de entrada / s entre letras / px de desfoque
};

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function iniciarVitrine(secao, { topoHero, lenis } = {}) {
  const canvas = secao.querySelector('.vitrine__canvas');
  const nomeEl = secao.querySelector('.vitrine__nome span');
  let ultimaEmenda = -1;
  let alturaHero = document.querySelector('.hero')?.offsetHeight || innerHeight;
  addEventListener('resize', () => { alturaHero = document.querySelector('.hero')?.offsetHeight || innerHeight; });

  // --- cena
  const { renderer, cena } = criarEstudio(canvas, { reflexo: VITRINE.reflexo });
  const camera = new THREE.PerspectiveCamera(VITRINE.fov, 1, 0.1, 100);

  const materiais = criarMateriais();

  // topografia viva atrás da arma (mesma da hero), com as cores da camo
  const topo = criarTopo(secao.querySelector('.vitrine__topo'), { forca: VITRINE.topoForca });
  topo.estado.forcaTopo = 1; // na emenda, linhas com a força da hero
  const pintarTopo = (i, dur) => {
    const c = CAMOS[i].topo;
    gsap.to(topo.estado.linha, { endArray: rgb(c.linha), duration: dur, ease: 'power2.inOut', overwrite: true });
    gsap.to(topo.estado.destaque, { endArray: rgb(c.destaque), duration: dur, ease: 'power2.inOut', overwrite: true });
    gsap.to(topo.estado, { iris: c.iris, duration: dur, ease: 'power2.inOut', overwrite: 'auto' });
    const f = CAMOS[i].fundo;
    secao.style.setProperty('--fundo-centro', f.centro);
    secao.style.setProperty('--fundo-borda', f.borda);
    secao.style.setProperty('--cor-camo', 'rgba(255, 255, 255, 0.12)');
  };
  pintarTopo(0, 0);
  const pivo = new THREE.Group(); // pivô: flutuação e giro sem mexer na geometria
  cena.add(pivo);
  // o GLB chega depois; a Promise fica exposta para o preloader esperar por ela
  const carregado = carregarArma(materiais)
    .then(({ grupo }) => { pivo.add(grupo); })
    .catch((e) => console.error('[vitrine] não carregou a arma', e));

  // --- enquadramento: no celular a câmera afasta até a arma caber na largura
  const medir = () => {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const celular = camera.aspect < 0.9;
    const folga = celular ? VITRINE.folga.celular : VITRINE.folga.tela;
    camera.position.set(0, 0, distanciaCamera(VITRINE.fov, camera.aspect, VITRINE.comprimento, folga, 6.4 * folga / 1.18));
    camera.updateProjectionMatrix();
  };
  medir();
  addEventListener('resize', medir);

  // --- troca de camo (varredura do cano à coronha)
  const U = materiais.uniforms;
  let atual = 0;
  let troca;
  const trocarPara = (i) => {
    if (i === atual) return;
    atual = i;
    troca?.progress(1); // termina a anterior na hora
    U.uCamoB.value = i;
    troca = gsap.fromTo(U.uTransicao, { value: 0 }, {
      value: 1, duration: reduzir ? 0 : VITRINE.troca, ease: 'power2.inOut',
      onComplete: () => { U.uCamoA.value = i; U.uTransicao.value = 0; },
    });
    trocarNome(i);
    pintarTopo(i, reduzir ? 0 : VITRINE.topoTroca);
    mestria.mostrar(i);
  };

  // troca do nome letra a letra: as antigas sobem e se desfazem (desfocando),
  // as novas sobem de baixo e assentam. Interromper no meio não quebra nada.
  let nomeTl;
  let letras;
  const trocarNome = (i) => {
    nomeTl?.kill();
    letras?.revert();
    if (reduzir) { mostrarNome(i); return; }
    const N = VITRINE.nome;
    letras = SplitText.create(nomeEl, { type: 'chars' });
    nomeTl = gsap.to(letras.chars, {
      yPercent: -45, opacity: 0, filter: `blur(${N.desfoque}px)`,
      duration: N.sai, ease: 'power3.in', stagger: { each: N.intervalo, from: 'start' },
      onComplete: () => {
        letras.revert();
        mostrarNome(i);
        letras = SplitText.create(nomeEl, { type: 'chars' });
        nomeTl = gsap.from(letras.chars, {
          yPercent: 60, opacity: 0, filter: `blur(${N.desfoque}px)`,
          duration: N.entra, ease: 'expo.out', stagger: { each: N.intervalo, from: 'start' },
          onComplete: () => { letras.revert(); letras = null; },
        });
      },
    });
  };
  // nomes longos ("Harmonic Break") encolhem para caber na largura
  function mostrarNome(i) {
    const nome = CAMOS[i].nome;
    nomeEl.textContent = nome;
    nomeEl.style.fontSize = `min(15vw, 30vh, ${(92 / (nome.length * 0.92)).toFixed(2)}vw)`;
  }
  mostrarNome(0);

  // trilha de mestria + ficha do desafio (ícones gerados pelo próprio shader)
  let rolagem = null;
  const mestria = montarMestria(secao, {
    amostras: gerarAmostras(),
    aoEscolher: (i) => {
      if (!rolagem) return;
      const alvo = rolagem.start + (rolagem.end - rolagem.start) * ((i + 0.5) / CAMOS.length);
      if (lenis) lenis.scrollTo(alvo, { duration: 1.2 });
      else scrollTo({ top: alvo, behavior: 'smooth' });
    },
  });
  mestria.mostrar(0);

  // --- rolagem: prende a seção e cada trecho mostra uma camo
  const estado = { progresso: 0, entrada: 0 };
  rolagem = ScrollTrigger.create({
    trigger: secao,
    start: 'top top',
    end: () => `+=${innerHeight * VITRINE.telasPorCamo * CAMOS.length}`,
    pin: true,
    scrub: true,
    onUpdate: (st) => {
      estado.progresso = st.progress;
      mestria.progresso(st.progress);
      trocarPara(Math.min(CAMOS.length - 1, Math.floor(st.progress * CAMOS.length)));
    },
  });
  // chegando na seção: a arma sobe e gira para a posição
  gsap.fromTo(estado, { entrada: 0 }, {
    entrada: 1, ease: 'none',
    scrollTrigger: { trigger: secao, start: 'top bottom', end: 'top top', scrub: true },
  });

  // --- interação: mouse inclina, arrastar gira (com inércia), depois volta
  const mouse = { x: 0, y: 0 };
  const incl = { x: 0, y: 0 };
  const arr = { ang: 0, vel: 0, segurando: false, ultimoX: 0 };
  secao.addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = (e.clientY / innerHeight) * 2 - 1;
    if (arr.segurando) {
      const dx = e.clientX - arr.ultimoX;
      arr.ultimoX = e.clientX;
      arr.ang += dx * VITRINE.arraste.forca;
      arr.vel = dx * VITRINE.arraste.forca * 60;
    }
  });
  canvas.addEventListener('pointerdown', (e) => {
    arr.segurando = true;
    arr.ultimoX = e.clientX;
    arr.vel = 0;
    canvas.setPointerCapture(e.pointerId);
    secao.classList.add('segurando');
  });
  const soltar = () => { arr.segurando = false; secao.classList.remove('segurando'); };
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', soltar);

  // --- desenha só quando a seção está na tela
  let visivel = false;
  new IntersectionObserver(([e]) => { visivel = e.isIntersecting; }).observe(secao);

  const debug = { pose: null, adiantar: 0 }; // testes pelo console: pose [x, y, z] trava a arma; adiantar (s) avança o relógio das camos
  let tempo = 0;
  gsap.ticker.add((_, dtMs) => {
    if (!visivel) return;
    const dt = Math.min(dtMs / 1000, 0.05);
    tempo += dt;
    U.uTempo.value = tempo + debug.adiantar;

    // arraste: inércia depois de soltar, e aos poucos volta ao ângulo da rolagem
    if (!arr.segurando) {
      arr.ang += arr.vel * dt;
      arr.vel *= Math.exp(-dt * VITRINE.arraste.atrito);
      arr.ang *= Math.exp(-dt * VITRINE.arraste.volta);
    }

    const k = 1 - Math.exp(-dt * VITRINE.mouse.suavidade);
    incl.x += (mouse.x - incl.x) * k;
    incl.y += (mouse.y - incl.y) * k;

    const F = VITRINE.flutua;
    const ent = estado.entrada;
    const t = reduzir ? 0 : tempo;
    pivo.position.y = Math.sin(t * F.vel) * F.altura - (1 - ent) * 1.2;
    pivo.rotation.set(
      incl.y * VITRINE.mouse.x + Math.sin(t * F.vel * 0.7) * F.balanco,
      VITRINE.giroInicial + Math.sin(estado.progresso * Math.PI * 2 * VITRINE.balancoCiclos) * VITRINE.balanco + incl.x * VITRINE.mouse.y + arr.ang - (1 - ent) * 1.4,
      Math.sin(t * F.vel * 0.8) * F.balanco,
    );
    pivo.scale.setScalar(0.82 + ent * 0.18);
    if (debug.pose) { pivo.position.set(0, 0, 0); pivo.rotation.set(...debug.pose); pivo.scale.setScalar(1); } // só para testes

    // emenda com a hero: o degradê existe enquanto a seção sobe e some quando ela prende no topo
    const emenda = innerHeight * VITRINE.emenda * Math.min(1, Math.max(0, (1 - ent) * 2.5));
    if (Math.abs(emenda - ultimaEmenda) > 0.5) { secao.style.setProperty('--emenda', `${emenda.toFixed(1)}px`); ultimaEmenda = emenda; }
    const te = topo.estado;
    te.entrada = 1; // o mapa já está desenhado (continua o da hero)
    te.origemY = alturaHero; // mesmo mapa da hero, continuando logo abaixo dela
    te.emenda = emenda;
    te.luz = 1;
    te.mouseX = (incl.x * 0.5 + 0.5) * innerWidth;
    te.mouseY = (incl.y * 0.5 + 0.5) * innerHeight;
    // parallax: na emenda copia o da hero (as linhas batem), depois de entrar usa o próprio
    const hx = topoHero?.estado.deslocX || 0, hy = topoHero?.estado.deslocY || 0;
    const e2 = ent * ent;
    te.deslocX = hx + (incl.x * 24 - hx) * e2;
    te.deslocY = hy + (incl.y * 16 - hy) * e2;
    topo.quadro();

    if (canvas.clientWidth !== renderer.domElement.width / renderer.getPixelRatio()) medir();
    renderer.render(cena, camera);
  });

  return { cena, camera, pivo, materiais, trocarPara, debug, carregado, topo };
}
