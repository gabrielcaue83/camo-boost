import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { CAMOS } from './camos.js';
import { gerarAmostras } from './amostras.js';
import { MODOS, CAMOS_MAESTRIA } from './camosMaestria.js';
import { EASE } from '../movimento.js';

gsap.registerPlugin(SplitText);

// Camos de Maestria: um SEGUNDO ESTADO da vitrine, não uma seção à parte.
// Quando a Divergência está em foco, o selo aparece embaixo da arma; rompido,
// a seção vira Maestria (fundo e luz da camo, trilha, ficha e telemetria de Seul). A arma e a
// cena 3D são as da vitrine; este módulo cuida da interface e da sequência.
//
// O desbloqueio é um SELO (losango com as 3 camos de Maestria trancadas):
// segurando, a Divergência racha e vaza a luz das camos de Maestria, a câmera
// chega perto e o fundo escurece. Completo: a casca estoura em lascas de
// cristal, clarão e onda de choque, e a arma já aparece na Mercurial Drift.

// ---------------------------------------------------------------------------
// CONFIGS
// ---------------------------------------------------------------------------
export const MAESTRIA = {
  troca: 1.1, // s: varredura de uma camo de maestria para outra
  balanco: 0.32, // rad: em modo Maestria a arma vira devagar sozinha para os lados
  balancoVel: 0.16, // ciclos por segundo desse balanço
  arraste: { forcaY: 0.004, limiteX: 0.5, volta: 0.35 }, // inclinação vertical ao arrastar / máx. / volta ao descanso
  desloca: { x: 0.06, y: 0.03, celularY: 0.1 }, // fração da tela: tira a arma do centro para dar lugar à ficha
  encolheBaixinho: 0.2, // celular com menos de 760px de altura: a arma fica 20% menor em modo Maestria
  corVarredura: [1.0, 0.12, 0.32], // linha da varredura dentro da Maestria (vermelho-magenta)
  nome: { sai: 0.22, intervaloSai: 0.01, entra: 1.0, intervalo: 0.03, desfoque: 12 }, // troca do nome gigante
  ficha: { sai: 0.18, entra: 0.7, intervalo: 0.05, contador: 1.1 },
};

export const DESBLOQUEIO = {
  segurar: 1.6, // s segurando o selo até romper
  solta: 0.35, // s: a carga esvazia se soltar antes da hora
  some: 0.35, // s: interface do arsenal sai com interferência
  estoura: 0.45, // s: a trinca abre de vez e fica branca antes de estourar
  clarao: 0.9, // s: o clarão do estouro apaga
  onda: 1.2, // s: a onda de choque se espalha
  enquadra: 1.4, // s: a arma desliza para dar lugar à ficha
  sair: 0.9, // s: "Voltar ao arsenal"
};

const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad = (n) => String(n).padStart(2, '0');
const DIVERGENCIA = 3;
const AMARELO = [1.0, 0.82, 0.0];

const CADEADO = `<svg class="selo__cadeado" viewBox="0 0 24 24" aria-hidden="true">
  <path class="selo__arco" d="M7.5 11V8a4.5 4.5 0 0 1 9 0v3" />
  <rect x="5" y="11" width="14" height="10" rx="1.5" /><path d="M12 15v2.5" /></svg>`;

/**
 * Monta a Maestria dentro da vitrine.
 * - U: uniforms do material da arma; varrer(id, dur): varredura da vitrine
 * - modo: { k } 0 = arsenal, 1 = maestria (a vitrine usa no enquadramento e no giro)
 * - arsenal: elementos da interface do arsenal que somem no desbloqueio
 * - aoEstilhacar: a vitrine estoura a casca da arma em lascas 3D
 * - aoAmbiente(id): a vitrine troca luz/fundo para a camo de Maestria (null = arsenal)
 * - aoSair: a vitrine devolve a camo do arsenal
 */
export function montarMaestria(secao, { U, varrer, modo, arsenal, lenis, aoSair, aoEstilhacar, aoAmbiente }) {
  const frenteOp = MODOS[0]; // por enquanto só o Multiplayer
  const camos = frenteOp.camos.map((id) => CAMOS_MAESTRIA.find((c) => c.id === id));
  const amostras = gerarAmostras([DIVERGENCIA, ...frenteOp.camos]); // [Divergência, M1, M2, M3]
  const atras = secao.querySelector('.maestria-atras');
  const frente = secao.querySelector('.maestria-frente');
  const clarao = secao.querySelector('.clarao');
  const raios = clarao.querySelector('.clarao__raios');
  const onda = secao.querySelector('.onda');
  const nomeEl = atras.querySelector('.maestria__nome span');
  const voltar = frente.querySelector('.maestria__voltar');

  // --- cabeçalho e telemetria
  frente.querySelector('.maestria__frente').innerHTML =
    `Frente <b>${frenteOp.nome}</b> <span class="maestria__sep">·</span> ${frenteOp.local} <span lang="ko">${frenteOp.hangul}</span>`;
  atras.querySelector('.maestria__coords').textContent = `${frenteOp.local.toUpperCase()} ${frenteOp.coords}`;
  const horaEl = atras.querySelector('.maestria__hora');
  const relogio = new Intl.DateTimeFormat('pt-BR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const marcarHora = () => { horaEl.textContent = relogio.format(new Date()); };
  marcarHora();
  setInterval(marcarHora, 1000);

  // --- painel: trilha (Divergência -> M1 -> M2 -> M3) + ficha
  const painel = frente.querySelector('.maestria__painel');
  painel.innerHTML = `
    <nav class="mtrilha" aria-label="Camos de Maestria do ${frenteOp.nome}">
      <span class="mtrilha__linha" aria-hidden="true"><span class="mtrilha__progresso"></span></span>
      <ol class="mtrilha__lista">
        <li class="mtrilha__item mtrilha__item--requisito feito">
          <span class="mtrilha__amostra"><img src="${amostras[0]}" alt="" /></span>
          <span class="mtrilha__textos"><small>Requisito</small><b>${CAMOS[DIVERGENCIA].nome}</b></span>
        </li>
        ${camos.map((c, i) => `
        <li>
          <button class="mtrilha__item" type="button" data-i="${i}" aria-pressed="false">
            <span class="mtrilha__amostra"><img src="${amostras[i + 1]}" alt="" /></span>
            <span class="mtrilha__textos"><small>Maestria ${pad(c.nivel)}</small><b>${c.nome}</b></span>
          </button>
        </li>`).join('')}
      </ol>
    </nav>
    <aside class="mficha" aria-live="polite">
      <div class="mficha__topo">
        <span class="mficha__mascara"><span class="mficha__num"></span></span>
        <span class="mficha__rotulo">Desafio</span>
      </div>
      <h3 class="mficha__nome mficha__mascara"><span></span></h3>
      <p class="mficha__texto mficha__mascara"><span></span></p>
      <div class="mficha__req">
        <strong class="mficha__qtd"></strong>
        <span class="mficha__unidade mficha__mascara"><span></span></span>
      </div>
      <p class="mficha__libera mficha__mascara"><span></span></p>
      <a class="botao botao--amarelo mficha__botao" href="#contratar">
        <span class="botao__rolo" data-texto="Quero essa camo"><span>Quero essa camo</span></span>
      </a>
    </aside>`;
  const botoes = [...painel.querySelectorAll('button.mtrilha__item')];
  const progressoEl = painel.querySelector('.mtrilha__progresso');
  const ficha = painel.querySelector('.mficha');
  const el = {
    num: ficha.querySelector('.mficha__num'),
    nome: ficha.querySelector('.mficha__nome span'),
    texto: ficha.querySelector('.mficha__texto span'),
    qtd: ficha.querySelector('.mficha__qtd'),
    req: ficha.querySelector('.mficha__req'),
    unidade: ficha.querySelector('.mficha__unidade span'),
    libera: ficha.querySelector('.mficha__libera span'),
    botao: ficha.querySelector('.mficha__botao'),
  };
  const blocos = [el.num, el.nome, el.texto, el.unidade, el.libera];

  // o que entra em cascata depois do estouro (título e carimbo entram à parte)
  const titulo = frente.querySelectorAll('.maestria__titulo > span > span');
  const carimbo = frente.querySelector('.maestria__carimbo');
  const entradas = [
    ...frente.querySelectorAll('.maestria__rotulo, .maestria__frente'),
    painel.querySelector('.mtrilha__linha'),
    ...painel.querySelectorAll('.mtrilha__lista > li'),
    ficha, voltar, frente.querySelector('.maestria__dica'),
  ];

  // fundo na cor da camo (variáveis registradas no CSS: a cor transiciona sozinha)
  const pintarFundo = (c) => {
    secao.style.setProperty('--m-centro', c.fundo.centro);
    secao.style.setProperty('--m-borda', c.fundo.borda);
  };

  // nome gigante: letras antigas sobem e desfocam, as novas sobem de baixo
  let nomeTl, letras;
  const mostrarNome = (nome) => {
    nomeEl.textContent = nome;
    nomeEl.style.fontSize = `min(12vw, 24vh, ${(66 / nome.length).toFixed(2)}vw)`; // nomes longos encolhem até caber entre a cabeça e a ficha
  };
  const trocarNome = (nome, imediato) => {
    nomeTl?.kill();
    letras?.revert();
    letras = null;
    if (reduzir || imediato || !nomeEl.textContent) { mostrarNome(nome); return; }
    const N = MAESTRIA.nome;
    letras = SplitText.create(nomeEl, { type: 'chars' });
    nomeTl = gsap.to(letras.chars, {
      yPercent: -45, opacity: 0, filter: `blur(${N.desfoque}px)`,
      duration: N.sai, ease: EASE.saida, stagger: { each: N.intervaloSai },
      onComplete: () => {
        letras.revert();
        mostrarNome(nome);
        letras = SplitText.create(nomeEl, { type: 'chars' });
        nomeTl = gsap.from(letras.chars, {
          yPercent: 60, opacity: 0, filter: `blur(${N.desfoque}px)`,
          duration: N.entra, ease: EASE.saida, stagger: { each: N.intervalo },
          onComplete: () => { letras.revert(); letras = null; },
        });
      },
    });
  };

  // ficha: preenche e anima (textos saem por cima, entram por baixo, contador corre)
  const contador = { v: 0 };
  let fichaTl;
  const preencher = (i) => {
    const c = camos[i], prox = camos[i + 1];
    el.num.textContent = `Maestria ${pad(c.nivel)} / ${pad(camos.length)}`;
    el.nome.textContent = c.nome;
    el.texto.textContent = c.desafio;
    el.unidade.textContent = c.unidade || '';
    el.req.hidden = c.quantidade == null;
    el.libera.innerHTML = prox
      ? `Libera <img src="${amostras[i + 2]}" alt="" /> <b>${prox.nome}</b>`
      : `Fecha a frente <b>${frenteOp.nome}</b>`;
    el.botao.dataset.camo = c.nome;
  };
  const mostrarFicha = (i, imediato) => {
    const c = camos[i];
    fichaTl?.kill();
    if (reduzir || imediato) {
      preencher(i);
      contador.v = c.quantidade || 0;
      el.qtd.textContent = contador.v;
      gsap.set(blocos, { yPercent: 0, opacity: 1 });
      return;
    }
    const F = MAESTRIA.ficha;
    fichaTl = gsap.timeline()
      .to(blocos, { yPercent: -110, opacity: 0, duration: F.sai, ease: EASE.saida, stagger: 0.015 })
      .call(() => { preencher(i); contador.v = 0; el.qtd.textContent = '0'; })
      .fromTo(blocos, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: F.entra, ease: EASE.saida, stagger: F.intervalo })
      .to(contador, {
        v: c.quantidade || 0, duration: F.contador, ease: 'power2.out',
        onUpdate: () => { el.qtd.textContent = Math.round(contador.v); },
      }, '<');
  };

  // linha da trilha: enche do requisito até a camo escolhida
  const encherLinha = (i, dur) => {
    gsap.to(progressoEl, { scaleX: (i + 1) / camos.length, duration: reduzir ? 0 : dur, ease: EASE.move, overwrite: true });
  };

  let escolhida = -1;
  const escolher = (i, { dur = MAESTRIA.troca } = {}) => {
    if (i === escolhida) return;
    const primeira = escolhida < 0;
    escolhida = i;
    botoes.forEach((b, k) => {
      b.classList.toggle('atual', k === i);
      b.classList.toggle('feito', k < i);
      b.setAttribute('aria-pressed', String(k === i));
    });
    varrer(camos[i].id, dur);
    trocarNome(camos[i].nome);
    pintarFundo(camos[i]);
    aoAmbiente?.(camos[i].id);
    mostrarFicha(i, false);
    encherLinha(i, primeira ? dur : 0.7);
  };
  botoes.forEach((b) => b.addEventListener('click', () => escolher(Number(b.dataset.i))));
  // setas do teclado andam pela trilha
  painel.querySelector('.mtrilha').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = Math.max(0, Math.min(camos.length - 1, (escolhida < 0 ? 0 : escolhida) + (e.key === 'ArrowRight' ? 1 : -1)));
    escolher(i);
    botoes[i].focus();
    e.preventDefault();
  });

  // --- selo: aparece embaixo da arma quando a Divergência está em foco
  const selo = document.createElement('button');
  selo.type = 'button';
  selo.className = 'selo';
  selo.setAttribute('aria-label', 'Segure para romper o selo e liberar as camos de Maestria');
  const marcas = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2, r1 = 57, r2 = i % 4 === 0 ? 51 : 54;
    return `<line x1="${(60 + Math.sin(a) * r1).toFixed(1)}" y1="${(60 - Math.cos(a) * r1).toFixed(1)}" x2="${(60 + Math.sin(a) * r2).toFixed(1)}" y2="${(60 - Math.cos(a) * r2).toFixed(1)}" />`;
  }).join('');
  selo.innerHTML = `
    <span class="selo__emblema" aria-hidden="true">
      <span class="selo__brilho"></span>
      <svg class="selo__svg" viewBox="0 0 120 120">
        <g class="selo__marcas">${marcas}</g>
        <path class="selo__aro" d="M60 6 L114 60 L60 114 L6 60 Z" />
        <path class="selo__trilho" d="M60 15 L105 60 L60 105 L15 60 Z" pathLength="1" />
        <path class="selo__progresso" d="M60 15 L105 60 L60 105 L15 60 Z" pathLength="1" />
      </svg>
      ${camos.map((c, i) => `<span class="selo__joia selo__joia--${i + 1}"><img src="${amostras[i + 1]}" alt="" /></span>`).join('')}
      <span class="selo__centro">${CADEADO}</span>
    </span>
    <span class="selo__textos">
      <b>Maestria</b>
      <small>${reduzir ? 'Toque para romper o selo' : 'Segure para romper o selo'}</small>
    </span>`;
  secao.appendChild(selo);

  // segurando o selo: o fundo apaga por uma camada que só muda de opacidade (barato)
  const apaga = document.createElement('div');
  apaga.className = 'vitrine__apaga';
  apaga.setAttribute('aria-hidden', 'true');
  secao.querySelector('.vitrine__vinheta').after(apaga);
  const topoEl = secao.querySelector('.vitrine__topo');

  const carga = { v: 0 };
  const aplicarCarga = () => {
    const v = carga.v;
    selo.style.setProperty('--carga', v.toFixed(3));
    apaga.style.opacity = v.toFixed(3);
    topoEl.style.transform = v > 0 ? `scale(${(1 - v * 0.14).toFixed(4)}) rotate(${(v * 5).toFixed(2)}deg)` : '';
    if (!ativa) U.uTrinca.value = v; // a camo racha junto (no estouro quem manda na trinca é a sequência)
    selo.classList.toggle('j1', v > 0.25);
    selo.classList.toggle('j2', v > 0.55);
    selo.classList.toggle('j3', v > 0.85);
  };
  let enchendo;
  const carregar = () => {
    if (ativa) return;
    enchendo?.kill();
    secao.classList.add('carregando');
    enchendo = gsap.to(carga, {
      v: 1, duration: (1 - carga.v) * DESBLOQUEIO.segurar, ease: 'none', // segurar = tempo passando: linear
      onUpdate: aplicarCarga, onComplete: desbloquear,
    });
  };
  const soltar = () => {
    if (ativa || carga.v >= 1) return;
    enchendo?.kill();
    secao.classList.remove('carregando');
    enchendo = gsap.to(carga, { v: 0, duration: carga.v * DESBLOQUEIO.solta, ease: 'power2.out', onUpdate: aplicarCarga });
  };
  if (reduzir) {
    selo.addEventListener('click', () => desbloquear());
  } else {
    selo.addEventListener('pointerdown', (e) => { if (e.button === 0) { selo.setPointerCapture(e.pointerId); carregar(); } });
    selo.addEventListener('pointerup', soltar);
    selo.addEventListener('pointercancel', soltar);
    selo.addEventListener('lostpointercapture', soltar);
    selo.addEventListener('contextmenu', (e) => e.preventDefault()); // segurar no celular não abre menu
    selo.addEventListener('keydown', (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      if (!e.repeat) carregar();
    });
    selo.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') soltar(); });
    selo.addEventListener('blur', soltar);
  }
  /** chama a atenção para o selo (pela trilha do arsenal) */
  const chamar = () => {
    selo.classList.remove('chamando');
    void selo.offsetWidth; // reinicia a animação do CSS
    selo.classList.add('chamando');
  };

  // --- estado inicial: tudo escondido
  gsap.set([atras, frente, clarao, onda], { autoAlpha: 0 });
  gsap.set(progressoEl, { scaleX: 0 });

  // --- desbloqueio: a trinca abre de vez -> estouro (lascas, clarão, onda) -> Maestria
  let ativa = false;
  let sequencia;
  function desbloquear() {
    if (ativa) return;
    ativa = true;
    sequencia?.kill();
    enchendo?.kill();
    lenis?.stop(); // a sequência acontece com a página parada
    escolhida = -1;
    const D = DESBLOQUEIO;

    const virar = () => { // embaixo do clarão: a seção já vira Maestria
      secao.classList.add('em-maestria');
      secao.classList.remove('carregando');
      frente.inert = false;
      gsap.set([atras, frente], { autoAlpha: 1 });
      gsap.set([...entradas, ...titulo, carimbo], { opacity: 0 });
      U.uCorVarredura.value.set(...MAESTRIA.corVarredura);
      trocarNome(CAMOS[DIVERGENCIA].nome, true);
    };
    const fim = () => {
      secao.classList.remove('desbloqueando');
      carga.v = 0; aplicarCarga();
      lenis?.start();
    };

    if (reduzir) {
      gsap.set([arsenal, selo], { autoAlpha: 0 });
      virar();
      gsap.set([...entradas, ...titulo, carimbo], { opacity: 1 });
      modo.k = 1;
      escolher(0, { dur: 0 });
      fim();
      return;
    }

    secao.classList.add('desbloqueando');
    sequencia = gsap.timeline({ onComplete: fim })
      .to(arsenal, { autoAlpha: 0, duration: D.some, ease: 'steps(4)' }, 0)
      .to(selo, { scale: 1.3, autoAlpha: 0, duration: D.estoura, ease: 'power2.in' }, 0)
      .to(U.uTrinca, { value: 1.45, duration: D.estoura, ease: 'power2.in' }, 0)
      .to(modo, { abalo: 1, duration: D.estoura, ease: 'power2.in' }, 0)
      .addLabel('estouro')
      .call(() => {
        aoEstilhacar?.();
        U.uTrinca.value = 0;
        // a carga desce suave: o tremor, a câmera perto e o estúdio apagado voltam junto com o clarão (sem parada seca)
        gsap.to(carga, { v: 0, duration: 0.8, ease: EASE.saida, onUpdate: aplicarCarga });
        // a troca de interface (DOM, SplitText, ficha) fica para o quadro seguinte: o clarão já cobre
        requestAnimationFrame(() => {
          if (!ativa) return;
          varrer(camos[0].id, 0); // por baixo do clarão, a arma já é a Mercurial Drift
          requestAnimationFrame(() => { // e a interface no quadro seguinte
            if (!ativa) return;
            virar();
            escolher(0, { dur: 0 });
          });
        });
      }, null, 'estouro')
      // clarão: acende de uma vez, treme a luz, expande e some; os raios giram enquanto isso
      .set(clarao, { autoAlpha: 1, scale: 0.35 }, 'estouro')
      .to(clarao, { scale: 1.25, duration: D.clarao, ease: EASE.saida }, 'estouro')
      .to(clarao, {
        keyframes: [{ opacity: 0.72, duration: 0.07 }, { opacity: 1, duration: 0.06 }, { opacity: 0, duration: D.clarao - 0.13, ease: 'power2.out' }],
      }, 'estouro')
      .set(clarao, { visibility: 'hidden' }, `estouro+=${D.clarao}`)
      .fromTo(raios, { rotate: 0, scale: 0.8 }, { rotate: 38, scale: 1.15, duration: D.clarao + 0.2, ease: EASE.saida }, 'estouro')
      .fromTo(onda, { scale: 0.05, autoAlpha: 1 }, { scale: 1, autoAlpha: 0, duration: D.onda, ease: EASE.saida }, 'estouro')
      .to(modo, { abalo: 0, duration: 1.0, ease: 'power3.out' }, 'estouro')
      .to(modo, { k: 1, duration: D.enquadra, ease: EASE.move }, 'estouro+=0.35')
      .fromTo(titulo, { opacity: 0, scale: 1.7, filter: 'blur(18px)' }, {
        opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.9, ease: EASE.saida, stagger: 0.1,
      }, 'estouro+=0.25')
      .fromTo(carimbo, { opacity: 0, scale: 2.6, rotate: -24 }, { opacity: 1, scale: 1, rotate: -8, duration: 0.45, ease: 'back.out(2.2)' }, 'estouro+=0.85')
      // depois do título: ficha (com o botão) -> trilha em leque -> rótulo/frente -> voltar e dica
      .fromTo(ficha, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: EASE.saida }, 'estouro+=0.45')
      .fromTo(painel.querySelector('.mtrilha__linha'), { opacity: 0 }, { opacity: 1, duration: 0.6, ease: EASE.saida }, 'estouro+=0.55')
      .fromTo(painel.querySelectorAll('.mtrilha__lista > li'), { y: 20, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.8, ease: EASE.saida, stagger: { amount: 0.16, ease: 'power2.out' },
      }, 'estouro+=0.55')
      .fromTo(frente.querySelectorAll('.maestria__rotulo, .maestria__frente'), { y: 14, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.8, ease: EASE.saida, stagger: 0.08,
      }, 'estouro+=0.65')
      .fromTo([voltar, frente.querySelector('.maestria__dica')], { opacity: 0 }, { opacity: 1, duration: 0.6, ease: EASE.saida }, 'estouro+=0.9')
      .call(() => lenis?.start(), null, 'estouro+=0.9'); // a rolagem volta assim que a ficha está na tela
  }

  // --- voltar ao arsenal (botão, ou rolando para trás da Divergência)
  function sair({ rapido = false } = {}) {
    if (!ativa) return;
    ativa = false;
    sequencia?.kill();
    secao.classList.remove('desbloqueando', 'carregando');
    carga.v = 0; aplicarCarga();
    lenis?.start();
    frente.inert = true;
    if (frente.contains(document.activeElement)) selo.focus({ preventScroll: true });
    U.uCorVarredura.value.set(...AMARELO);
    U.uTrinca.value = 0;
    modo.abalo = 0;
    gsap.set([clarao, onda], { autoAlpha: 0 }); // se saiu no meio do estouro
    aoAmbiente?.(null);
    gsap.set(selo, { clearProps: 'opacity,visibility,transform' });
    aoSair();
    const k = reduzir ? 0 : (rapido ? 0.5 : 1) * DESBLOQUEIO.sair;
    sequencia = gsap.timeline({ onComplete: () => secao.classList.remove('em-maestria') })
      .to(frente, { autoAlpha: 0, duration: k * 0.35, ease: 'power2.in' }, 0)
      .to(atras, { autoAlpha: 0, duration: k * 0.7, ease: 'power2.inOut' }, k * 0.1)
      .to(modo, { k: 0, duration: k, ease: EASE.move }, 0)
      .to(arsenal, { autoAlpha: 1, duration: k * 0.6, ease: 'power2.out' }, k * 0.35);
  }
  voltar.addEventListener('click', () => sair());
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && ativa) sair(); });

  return {
    escolher, desbloquear, sair, chamar,
    ativa: () => ativa,
    carga: () => carga.v,
    /** true quando o fundo da Maestria cobre a vitrine inteira (a topografia pode parar) */
    cobrindo: () => ativa && Number(gsap.getProperty(atras, 'opacity')) >= 1,
  };
}
