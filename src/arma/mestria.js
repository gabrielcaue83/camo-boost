import { gsap } from 'gsap';
import { CAMOS } from './camos.js';
import { DESAFIOS } from './desafios.js';

// Trilha de mestria (à esquerda: os ícones em sequência, clicáveis) e ficha
// do desafio (canto direito: nome, desafio, quantidade com contador, losangos
// que acendem um a um e qual camo ela libera).

export const MESTRIA = {
  sai: 0.3, // s: textos da ficha saindo
  entra: 0.75, // s: textos da ficha entrando
  intervalo: 0.06, // s entre um texto e outro
  contador: 1.1, // s: o número correndo até a quantidade
  losangos: 0.9, // s: tempo total para acenderem todos
  maxLosangos: 36, // limite de losangos desenhados
};

const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad = (n) => String(n).padStart(2, '0');

export function montarMestria(secao, { amostras, aoEscolher }) {
  const N = CAMOS.length;

  // --- trilha
  const trilha = document.createElement('nav');
  trilha.className = 'trilha';
  trilha.setAttribute('aria-label', 'Trilha de camuflagens');
  trilha.innerHTML = `
    <span class="trilha__linha" aria-hidden="true"><span class="trilha__progresso"></span></span>
    <ol class="trilha__lista">
      ${CAMOS.map((c, i) => `
        <li>
          <button class="trilha__item" type="button" data-i="${i}" aria-label="Ver ${c.nome}">
            <span class="trilha__amostra"><img src="${amostras[i]}" alt="" /></span>
            <span class="trilha__textos">
              <b>${c.nome}</b>
              <small class="trilha__estado"></small>
            </span>
          </button>
        </li>`).join('')}
    </ol>`;
  secao.appendChild(trilha);
  const itens = [...trilha.querySelectorAll('.trilha__item')];
  const progressoEl = trilha.querySelector('.trilha__progresso');
  itens.forEach((b) => b.addEventListener('click', () => aoEscolher(Number(b.dataset.i))));

  // --- ficha
  const ficha = document.createElement('aside');
  ficha.className = 'ficha';
  ficha.setAttribute('aria-live', 'polite');
  ficha.innerHTML = `
    <div class="ficha__topo">
      <span class="ficha__mascara"><span class="ficha__num"></span></span>
      <span class="ficha__rotulo">Desafio</span>
    </div>
    <h3 class="ficha__nome ficha__mascara"><span></span></h3>
    <p class="ficha__texto ficha__mascara"><span></span></p>
    <div class="ficha__req">
      <strong class="ficha__qtd">0</strong>
      <span class="ficha__unidade ficha__mascara"><span></span></span>
    </div>
    <div class="ficha__losangos" aria-hidden="true"></div>
    <p class="ficha__libera ficha__mascara"><span></span></p>`;
  secao.appendChild(ficha);
  const el = {
    num: ficha.querySelector('.ficha__num'),
    nome: ficha.querySelector('.ficha__nome span'),
    texto: ficha.querySelector('.ficha__texto span'),
    qtd: ficha.querySelector('.ficha__qtd'),
    unidade: ficha.querySelector('.ficha__unidade span'),
    losangos: ficha.querySelector('.ficha__losangos'),
    libera: ficha.querySelector('.ficha__libera span'),
  };
  const blocos = [el.num, el.nome, el.texto, el.unidade, el.libera];
  const contador = { v: 0 };

  function preencher(i) {
    const c = CAMOS[i], d = DESAFIOS[i] || {};
    el.num.textContent = `${pad(i + 1)} / ${pad(N)}`;
    el.nome.textContent = c.nome;
    el.texto.textContent = d.desafio || '';
    el.unidade.textContent = d.unidade || '';
    const prox = CAMOS[i + 1];
    el.libera.innerHTML = prox
      ? `Libera <img src="${amostras[i + 1]}" alt="" /> <b>${prox.nome}</b>`
      : 'Libera <b>as camos de Mestria</b>';
    const total = Math.min(d.quantidade || 0, MESTRIA.maxLosangos);
    el.losangos.innerHTML = Array.from({ length: total }, () => '<i></i>').join('');
  }

  function acenderLosangos() {
    const l = el.losangos.children;
    if (!l.length) return;
    gsap.fromTo(l, { scale: 0.4, opacity: 0.2 }, {
      scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(3)',
      stagger: { each: MESTRIA.losangos / l.length, from: 'start' },
      onStart: () => [...l].forEach((x) => x.classList.remove('aceso')),
    });
    gsap.delayedCall(0.1, () => gsap.to({}, {
      duration: MESTRIA.losangos,
      onUpdate() { const k = Math.round(this.progress() * l.length); [...l].forEach((x, j) => x.classList.toggle('aceso', j < k)); },
    }));
  }

  let atual = -1;
  let tl;
  function mostrar(i) {
    if (i === atual) return;
    const primeira = atual < 0;
    atual = i;

    // estados da trilha
    itens.forEach((b, k) => {
      b.classList.toggle('feito', k < i);
      b.classList.toggle('atual', k === i);
      b.classList.toggle('bloqueado', k > i);
      b.querySelector('.trilha__estado').textContent = k < i ? 'Liberada' : k === i ? 'Em foco' : 'Bloqueada';
    });

    const d = DESAFIOS[i] || {};
    tl?.kill();
    if (reduzir || primeira) {
      preencher(i);
      contador.v = d.quantidade || 0;
      el.qtd.textContent = contador.v;
      if (!reduzir) acenderLosangos();
      return;
    }
    tl = gsap.timeline()
      .to(blocos, { yPercent: -110, opacity: 0, duration: MESTRIA.sai, ease: 'power2.in', stagger: MESTRIA.intervalo * 0.5 })
      .call(() => preencher(i))
      .fromTo(blocos, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: MESTRIA.entra, ease: 'expo.out', stagger: MESTRIA.intervalo })
      .to(contador, {
        v: d.quantidade || 0, duration: MESTRIA.contador, ease: 'power2.out',
        onUpdate: () => { el.qtd.textContent = Math.round(contador.v); },
      }, '<')
      .call(acenderLosangos, null, '<0.1');
  }

  /** p = progresso da rolagem na seção (0..1): enche a linha da trilha */
  function progresso(p) {
    progressoEl.style.transform = `scaleY(${Math.min(1, Math.max(0, p)).toFixed(4)})`;
  }

  return { mostrar, progresso };
}
