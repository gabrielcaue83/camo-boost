import * as THREE from 'three';
import { gsap } from 'gsap';
import { carregarArma, ouvirProgresso, ARMA } from './arma/modelo.js';
import { criarMateriais, CAMOS } from './arma/camos.js';
import { criarEstudio, distanciaCamera } from './arma/estudio.js';

// Preloader: o contorno da arma se desenha conforme o download real avança;
// quando chega, vira a arma 3D, que passa por todas as camos; a tela sobe
// como uma cortina e a hero entra por baixo. A arma NÃO sai: a da hero nasce
// na mesma pose e camo, então ela parece ficar no lugar (heroArma.js).

// ---------------------------------------------------------------------------
// CONFIGS
// ---------------------------------------------------------------------------
export const PRELOADER = {
  minimo: 1.4, // s: tempo mínimo do desenho do contorno (não pisca se estiver em cache)
  maximo: 15, // s: se nada chegar até aqui, sai mesmo assim
  suavidade: 6, // o número e o traço correm atrás do progresso real (maior = mais rápido)
  aparece: 0.7, // s: contorno vira a arma 3D
  segura: 0.35, // s: parado em cada camo antes da próxima troca
  troca: 0.5, // s: varredura de uma camo para a outra
  giro: -0.38, // rad: quanto a arma gira enquanto passa as camos
  saida: 1.1, // s: cortina subindo
  heroEntra: 0.4, // fração da saída em que a hero começa a entrar
  fov: 30,
  folga: 2.6, // tamanho da arma na tela (maior = menor)
};

export function iniciarPreloader({ esperar, aoSair, reduzir }) {
  const el = document.querySelector('.preloader');
  const raiz = document.documentElement;
  const terminar = () => {
    el?.remove();
    raiz.classList.remove('carregando');
  };
  if (!el || reduzir) {
    terminar();
    esperar.then(aoSair);
    return;
  }
  el.classList.remove('preloader--espera');

  const P = PRELOADER;
  const svg = el.querySelector('.preloader__contorno');
  const tracos = [...svg.querySelectorAll('path')];
  const numero = el.querySelector('.preloader__numero');
  const nome = el.querySelector('.preloader__nome');
  const canvas = el.querySelector('.preloader__arma');

  // fundo preto liso: a topografia só aparece depois, com a hero

  // --- arma 3D (mesmo estúdio e materiais da vitrine)
  const { renderer, cena } = criarEstudio(canvas);
  const camera = new THREE.PerspectiveCamera(P.fov, 1, 0.1, 100);
  const materiais = criarMateriais();
  const U = materiais.uniforms;
  const pivo = new THREE.Group();
  cena.add(pivo);
  let arma = null;
  carregarArma(materiais).then(({ grupo }) => { arma = grupo; pivo.add(grupo); renderer.compile(cena, camera); })
    .catch((e) => console.error('[preloader] arma não carregou', e));

  // contorno em cima da arma: projeta a caixa da arma na tela
  const canto = new THREE.Vector3();
  const medir = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.set(0, 0, distanciaCamera(P.fov, camera.aspect, ARMA.comprimento, P.folga, 6.4 * P.folga / 1.18));
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    canto.set(-ARMA.comprimento / 2, ARMA.altura / 2, 0).project(camera);
    const x0 = (canto.x * 0.5 + 0.5) * w, y0 = (-canto.y * 0.5 + 0.5) * h;
    canto.set(ARMA.comprimento / 2, -ARMA.altura / 2, 0).project(camera);
    const x1 = (canto.x * 0.5 + 0.5) * w, y1 = (-canto.y * 0.5 + 0.5) * h;
    Object.assign(svg.style, { left: `${x0}px`, top: `${y0}px`, width: `${x1 - x0}px`, height: `${y1 - y0}px` });
    nome.style.top = `${y1 + h * 0.05}px`;
  };
  medir();
  addEventListener('resize', medir);

  // --- progresso: real (download) limitado pelo tempo mínimo, suavizado
  let real = 0;
  const pararDeOuvir = ouvirProgresso((p) => { real = p; });
  let mostrado = 0;
  let tempo = 0;
  let fase = 'desenho';
  let textoNumero = '';

  const laco = (_, dtMs) => {
    const dt = Math.min(dtMs / 1000, 0.5); // tempo real (aba lenta não estica o preloader)
    tempo += dt;
    U.uTempo.value = tempo;

    if (fase === 'desenho') {
      const alvo = Math.min(real, tempo / P.minimo);
      mostrado += (alvo - mostrado) * (1 - Math.exp(-dt * P.suavidade));
      if (alvo >= 1 && mostrado > 0.995) mostrado = 1;
      tracos.forEach((t, i) => {
        // cada traço começa um pouquinho depois do anterior
        const local = Math.min(1, Math.max(0, mostrado * 1.25 - (i / tracos.length) * 0.25));
        t.style.strokeDashoffset = (1 - local).toFixed(4);
      });
      const txt = String(Math.round(mostrado * 100)).padStart(3, '0');
      if (txt !== textoNumero) { numero.textContent = txt; textoNumero = txt; }
      if (mostrado === 1 && arma) { fase = 'camos'; mostrarCamos(); }
      if (tempo > P.maximo) { fase = 'saindo'; sair(); }
    }

    renderer.render(cena, camera);
  };
  gsap.ticker.add(laco);

  // --- arma aparece e passa por todas as camos
  function mostrarCamos() {
    pararDeOuvir();
    nome.textContent = CAMOS[0].nome;
    const tl = gsap.timeline({ onComplete: () => esperar.then(sair) });
    tl.to(canvas, { opacity: 1, duration: P.aparece, ease: 'power2.out' }, 0)
      .to(svg, { opacity: 0, duration: P.aparece, ease: 'power2.inOut' }, 0)
      .fromTo(pivo.scale, { x: 0.95, y: 0.95, z: 0.95 }, { x: 1, y: 1, z: 1, duration: P.aparece * 1.6, ease: 'expo.out' }, 0)
      .to(nome, { opacity: 1, duration: 0.4 }, P.aparece * 0.5);
    let t = P.aparece + P.segura;
    const voltas = CAMOS.length - 1;
    tl.to(pivo.rotation, { y: P.giro, duration: voltas * (P.troca + P.segura) + P.segura, ease: 'sine.inOut' }, P.aparece * 0.5);
    for (let i = 1; i < CAMOS.length; i++) {
      tl.call(() => { U.uCamoB.value = i; }, null, t)
        .fromTo(U.uTransicao, { value: 0 }, { value: 1, duration: P.troca, ease: 'power2.inOut', immediateRender: false }, t)
        .call(() => { U.uCamoA.value = i; U.uTransicao.value = 0; }, null, t + P.troca)
        .to(nome, { opacity: 0, y: -6, duration: P.troca * 0.4, ease: 'power2.in' }, t)
        .call(() => { nome.textContent = CAMOS[i].nome; }, null, t + P.troca * 0.4)
        .fromTo(nome, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: P.troca * 0.6, ease: 'power2.out', immediateRender: false }, t + P.troca * 0.4);
      t += P.troca + P.segura;
    }
  }

  // --- saída: a tela sobe como cortina e a hero entra por baixo
  let saiu = false;
  function sair() {
    if (saiu) return;
    saiu = true;
    fase = 'saindo';
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.ticker.remove(laco);
        removeEventListener('resize', medir);
        renderer.dispose();
        renderer.forceContextLoss();
        terminar();
      },
    });
    tl.to(el, { clipPath: 'inset(0% 0% 100% 0%)', duration: P.saida, ease: 'power3.inOut' }, 0)
      .to([nome, el.querySelector('.preloader__contador')], { opacity: 0, y: -20, duration: P.saida * 0.4, ease: 'power2.in' }, 0)
      .call(() => esperar.then(aoSair), null, P.saida * P.heroEntra);
  }
}
