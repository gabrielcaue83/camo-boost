import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { CAMOS } from './camos.js';
import { gerarAmostras } from './amostras.js';
import { MODOS, CAMOS_MAESTRIA } from './camosMaestria.js';

gsap.registerPlugin(SplitText);

// Camos de Maestria: um SEGUNDO ESTADO da vitrine, não uma seção à parte.
// Quando a Divergência está em foco, a ficha mostra a trava ("segure para
// desbloquear"). Segurando até o fim: a interface do arsenal sai com
// interferência, a tela apaga e mostra 해제 ("liberado"), e volta já em modo
// Maestria (fundo, mira, telemetria de Seul, trilha e ficha), com a varredura
// vermelha trocando a Divergência pela primeira camo de maestria. A arma e a
// cena 3D são as da vitrine; este módulo só cuida da interface e da sequência.

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
  nome: { sai: 0.45, entra: 1.0, intervalo: 0.03, desfoque: 12 }, // troca do nome gigante
  ficha: { sai: 0.28, entra: 0.7, intervalo: 0.05, contador: 1.1 },
};

export const DESBLOQUEIO = {
  segurar: 1.3, // s segurando a trava até abrir
  solta: 0.35, // s: o anel esvazia se soltar antes da hora
  tremor: 0.03, // rad: a arma treme enquanto a trava carrega
  some: 0.35, // s: interface do arsenal sai com interferência
  apaga: 0.3, // s: a tela escurece
  segura: 0.35, // s: tempo com a tela apagada depois que 해제 e os textos assentam
  acende: 0.6, // s: a tela volta (já em modo Maestria)
  varredura: 1.8, // s: Divergência -> primeira camo de maestria
  enquadra: 1.4, // s: a arma desliza para dar lugar à ficha
  sair: 0.9, // s: "Voltar ao arsenal"
};

const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad = (n) => String(n).padStart(2, '0');
const DIVERGENCIA = 3;
const AMARELO = [1.0, 0.82, 0.0];

const CADEADO = `<svg class="trava__cadeado" viewBox="0 0 24 24" aria-hidden="true">
  <path class="trava__arco" d="M7.5 11V8a4.5 4.5 0 0 1 9 0v3" />
  <rect x="5" y="11" width="14" height="10" rx="1.5" /><path d="M12 15v2.5" /></svg>`;

/**
 * Monta a Maestria dentro da vitrine.
 * - U: uniforms do material da arma; varrer(id, dur): varredura da vitrine
 * - modo: { k } 0 = arsenal, 1 = maestria (a vitrine usa no enquadramento e no giro)
 * - arsenal: elementos da interface do arsenal que somem no desbloqueio
 * - ficha: ficha do arsenal, onde a trava aparece (quando a Divergência está em foco)
 * - aoSair: a vitrine devolve a camo do arsenal
 */
export function montarMaestria(secao, { U, varrer, modo, arsenal, ficha: fichaArsenal, lenis, aoSair }) {
  const frenteOp = MODOS[0]; // por enquanto só o Multiplayer
  const camos = frenteOp.camos.map((id) => CAMOS_MAESTRIA.find((c) => c.id === id));
  const amostras = gerarAmostras([DIVERGENCIA, ...frenteOp.camos]); // [Divergência, M1, M2, M3]
  const atras = secao.querySelector('.maestria-atras');
  const frente = secao.querySelector('.maestria-frente');
  const tela = secao.querySelector('.desbloqueio');
  const nomeEl = atras.querySelector('.maestria__nome span');
  const voltar = frente.querySelector('.maestria__voltar');

  // --- cabeçalho, telemetria e tela do desbloqueio
  frente.querySelector('.maestria__frente').innerHTML =
    `Frente <b>${frenteOp.nome}</b> <span class="maestria__sep">·</span> ${frenteOp.local} <span lang="ko">${frenteOp.hangul}</span>`;
  atras.querySelector('.maestria__coords').textContent = `${frenteOp.local.toUpperCase()} ${frenteOp.coords}`;
  tela.querySelector('.desbloqueio__sub').textContent = `Frente ${frenteOp.nome} · ${frenteOp.local} ${frenteOp.coords}`;
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

  // o que entra em cascata quando a tela acende
  const entradas = [
    ...frente.querySelectorAll('.maestria__rotulo, .maestria__titulo > span > span, .maestria__frente'),
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
      duration: N.sai, ease: 'power3.in', stagger: { each: N.intervalo },
      onComplete: () => {
        letras.revert();
        mostrarNome(nome);
        letras = SplitText.create(nomeEl, { type: 'chars' });
        nomeTl = gsap.from(letras.chars, {
          yPercent: 60, opacity: 0, filter: `blur(${N.desfoque}px)`,
          duration: N.entra, ease: 'expo.out', stagger: { each: N.intervalo },
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
      .to(blocos, { yPercent: -110, opacity: 0, duration: F.sai, ease: 'power2.in', stagger: F.intervalo * 0.5 })
      .call(() => { preencher(i); contador.v = 0; el.qtd.textContent = '0'; })
      .fromTo(blocos, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: F.entra, ease: 'expo.out', stagger: F.intervalo })
      .to(contador, {
        v: c.quantidade || 0, duration: F.contador, ease: 'power2.out',
        onUpdate: () => { el.qtd.textContent = Math.round(contador.v); },
      }, '<');
  };

  // linha da trilha: enche do requisito até a camo escolhida
  const encherLinha = (i, dur) => {
    gsap.to(progressoEl, { scaleX: (i + 1) / camos.length, duration: reduzir ? 0 : dur, ease: 'power3.inOut', overwrite: true });
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

  // --- trava: aparece na ficha do arsenal quando a Divergência está em foco
  const trava = document.createElement('button');
  trava.type = 'button';
  trava.className = 'trava';
  trava.setAttribute('aria-label', 'Segure para desbloquear as camos de Maestria');
  trava.innerHTML = `
    <span class="trava__carga" aria-hidden="true"></span>
    <span class="trava__anel" aria-hidden="true">
      <svg viewBox="0 0 48 48"><circle class="trava__trilho" cx="24" cy="24" r="21" /><circle class="trava__progresso" cx="24" cy="24" r="21" pathLength="1" /></svg>
      ${CADEADO}
    </span>
    <span class="trava__textos">
      <b>Camos de Maestria</b>
      <small>${reduzir ? 'Toque para desbloquear' : 'Segure para desbloquear'}</small>
    </span>`;
  fichaArsenal.appendChild(trava);

  const carga = { v: 0 };
  const aplicarCarga = () => { secao.style.setProperty('--carga', carga.v.toFixed(3)); };
  let enchendo;
  const carregar = () => {
    if (ativa) return;
    enchendo?.kill();
    secao.classList.add('carregando');
    enchendo = gsap.to(carga, {
      v: 1, duration: (1 - carga.v) * DESBLOQUEIO.segurar, ease: 'none',
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
    trava.addEventListener('click', () => desbloquear());
  } else {
    trava.addEventListener('pointerdown', (e) => { if (e.button === 0) { trava.setPointerCapture(e.pointerId); carregar(); } });
    trava.addEventListener('pointerup', soltar);
    trava.addEventListener('pointercancel', soltar);
    trava.addEventListener('lostpointercapture', soltar);
    trava.addEventListener('contextmenu', (e) => e.preventDefault()); // segurar no celular não abre menu
    trava.addEventListener('keydown', (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      if (!e.repeat) carregar();
    });
    trava.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') soltar(); });
    trava.addEventListener('blur', soltar);
  }
  /** chama a atenção para a trava (pela trilha do arsenal) */
  const chamar = () => {
    trava.classList.remove('chamando');
    void trava.offsetWidth; // reinicia a animação do CSS
    trava.classList.add('chamando');
  };

  // --- estado inicial: tudo escondido
  gsap.set([atras, frente, tela], { autoAlpha: 0 });
  gsap.set(progressoEl, { scaleX: 0 });

  // --- desbloqueio: interferência -> tela apaga com 해제 -> acende em modo Maestria
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
    const hangul = tela.querySelectorAll('.desbloqueio__hangul span');
    const linhas = tela.querySelectorAll('.desbloqueio__linha');

    const virar = () => { // atrás da tela apagada: a seção já vira Maestria
      secao.classList.add('em-maestria');
      secao.classList.remove('carregando');
      frente.inert = false;
      gsap.set([atras, frente], { autoAlpha: 1 });
      gsap.set(entradas, { opacity: 0 });
      U.uCorVarredura.value.set(...MAESTRIA.corVarredura);
      pintarFundo(CAMOS[DIVERGENCIA]);
      trocarNome(CAMOS[DIVERGENCIA].nome, true);
    };
    const fim = () => {
      secao.classList.remove('desbloqueando');
      carga.v = 0; aplicarCarga();
      lenis?.start();
    };

    if (reduzir) {
      gsap.set(arsenal, { autoAlpha: 0 });
      virar();
      gsap.set(entradas, { opacity: 1 });
      modo.k = 1;
      escolher(0, { dur: 0 });
      fim();
      return;
    }

    secao.classList.add('desbloqueando');
    sequencia = gsap.timeline({ onComplete: fim })
      .to(arsenal, { autoAlpha: 0, duration: D.some, ease: 'steps(4)' }, 0)
      .to(tela, { autoAlpha: 1, duration: D.apaga, ease: 'power2.out' }, D.some * 0.7)
      .fromTo(hangul, { yPercent: 35, opacity: 0, filter: 'blur(14px)' }, {
        yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 0.7, ease: 'expo.out', stagger: 0.12,
      }, '>-0.1')
      .fromTo(linhas, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'expo.out', stagger: 0.08 }, '<0.2')
      .call(virar, null, '<')
      .addLabel('acende', `+=${D.segura}`)
      .call(() => escolher(0, { dur: D.varredura }), null, 'acende')
      .to(hangul, { yPercent: -30, opacity: 0, filter: 'blur(14px)', duration: D.acende, ease: 'power2.in', stagger: 0.06 }, 'acende')
      .to(linhas, { opacity: 0, duration: D.acende * 0.6 }, 'acende')
      .to(tela, { autoAlpha: 0, duration: D.acende, ease: 'power2.inOut' }, 'acende+=0.15')
      .to(modo, { k: 1, duration: D.enquadra, ease: 'power3.inOut' }, 'acende')
      .fromTo(entradas, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 1.0, ease: 'expo.out', stagger: 0.06 }, 'acende+=0.45');
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
    if (frente.contains(document.activeElement)) trava.focus({ preventScroll: true });
    U.uCorVarredura.value.set(...AMARELO);
    aoSair();
    const k = reduzir ? 0 : (rapido ? 0.5 : 1) * DESBLOQUEIO.sair;
    sequencia = gsap.timeline({ onComplete: () => secao.classList.remove('em-maestria') })
      .to(frente, { autoAlpha: 0, duration: k * 0.35, ease: 'power2.in' }, 0)
      .to(tela, { autoAlpha: 0, duration: k * 0.2 }, 0)
      .to(atras, { autoAlpha: 0, duration: k * 0.7, ease: 'power2.inOut' }, k * 0.1)
      .to(modo, { k: 0, duration: k, ease: 'power3.inOut' }, 0)
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
