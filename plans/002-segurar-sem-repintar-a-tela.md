# 002 — Segurar o selo sem repintar a tela inteira a cada quadro

- **Status**: DONE (26/11/2026)
- **Commit**: a035f5d + mudanças locais não commitadas (redesenho da Maestria de 26/11/2026)
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 2 arquivos, ~25 linhas

## Problem

Enquanto o usuário segura o selo, `aplicarCarga` escreve `--carga` na `<section class="vitrine">` inteira a cada quadro. Essa variável dirige efeitos caros em elementos de tela cheia:

```js
/* src/arma/maestria.js:275–281 — atual */
  const aplicarCarga = () => {
    secao.style.setProperty('--carga', carga.v.toFixed(3));
    U.uTrinca.value = carga.v; // a camo racha junto
    selo.classList.toggle('j1', carga.v > 0.25);
    selo.classList.toggle('j2', carga.v > 0.55);
    selo.classList.toggle('j3', carga.v > 0.85);
  };
```

```css
/* src/style.css:250 — atual: sombra interna com desfoque de até 28vmin, repintada todo quadro */
.vitrine.carregando .vitrine__vinheta { box-shadow: inset 0 0 calc(var(--carga, 0) * 28vmin) rgba(224, 24, 80, calc(var(--carga, 0) * 0.6)); }

/* src/style.css:532–534 — atual: filtro na tela toda + transição de 0,4 s brigando com a atualização por quadro */
.vitrine__fundo, .vitrine__topo { transition: filter 0.4s, transform 0.4s; }
.vitrine.carregando .vitrine__fundo { filter: brightness(calc(1 - var(--carga, 0) * 0.65)) saturate(calc(1 - var(--carga, 0) * 0.5)); }
.vitrine.carregando .vitrine__topo { transform: scale(calc(1 - var(--carga, 0) * 0.14)) rotate(calc(var(--carga, 0) * 5deg)); }
```

Problemas: (1) mudar uma variável na seção recalcula estilo de todos os filhos; (2) `box-shadow` com desfoque animado e `filter` em tela cheia repintam a área toda a cada quadro; (3) a transição de 0,4 s faz o efeito ficar sempre atrasado em relação à carga. Isso acontece justamente quando o shader da trinca também está pesando a GPU — o risco de engasgar está no momento mais importante.

## Target

- `--carga` passa a ser escrita só no próprio botão `.selo` (as regras `.selo__*` que leem a variável continuam funcionando, porque são filhas dele).
- O escurecimento do fundo e a borda magenta viram UMA camada de sobreposição (`.vitrine__apaga`) que só muda de `opacity` (composta na GPU, sem repintar).
- A topografia recebe `transform` direto no elemento, sem transição.

```css
/* target: nova camada (fica em cima do fundo e da topografia, embaixo da arma) */
.vitrine__apaga {
  position: absolute; inset: 0; z-index: 1; pointer-events: none; opacity: 0;
  background:
    radial-gradient(ellipse 80% 75% at 50% 50%, transparent 40%, rgba(224, 24, 80, 0.6) 100%),
    rgba(10, 10, 11, 0.6);
}
```

```js
/* target: aplicarCarga */
  const aplicarCarga = () => {
    const v = carga.v;
    selo.style.setProperty('--carga', v.toFixed(3));
    apaga.style.opacity = v.toFixed(3);
    topoEl.style.transform = v > 0 ? `scale(${(1 - v * 0.14).toFixed(4)}) rotate(${(v * 5).toFixed(2)}deg)` : '';
    U.uTrinca.value = v; // a camo racha junto
    selo.classList.toggle('j1', v > 0.25);
    selo.classList.toggle('j2', v > 0.55);
    selo.classList.toggle('j3', v > 0.85);
  };
```

## Repo conventions to follow

- Elementos extras da Maestria são criados em JS dentro de `montarMaestria` (exemplo: `const selo = document.createElement('button'); ... secao.appendChild(selo);` em `src/arma/maestria.js`). Faça o mesmo para a camada.
- Comentários em português explicando o porquê.

## Steps

1. Em `src/arma/maestria.js`, logo ANTES de `const carga = { v: 0 };`, crie a camada e pegue a topografia:
   ```js
   // segurando o selo: o fundo apaga por uma camada que só muda de opacidade (barato)
   const apaga = document.createElement('div');
   apaga.className = 'vitrine__apaga';
   apaga.setAttribute('aria-hidden', 'true');
   secao.querySelector('.vitrine__vinheta').after(apaga);
   const topoEl = secao.querySelector('.vitrine__topo');
   ```
2. Substitua o corpo de `aplicarCarga` pelo trecho "target" acima.
3. Em `src/style.css`, apague a linha 250 inteira (`.vitrine.carregando .vitrine__vinheta { box-shadow: ... }`) e o comentário logo acima dela (`/* segurando o selo: a borda da vitrine esquenta */`).
4. Em `src/style.css`, apague as três linhas 532–534 (`.vitrine__fundo, .vitrine__topo { transition ... }`, `.vitrine.carregando .vitrine__fundo {...}`, `.vitrine.carregando .vitrine__topo {...}`) e o comentário logo acima (`/* segurando o selo: o fundo apaga e a topografia se fecha em volta da arma */`).
5. No lugar das linhas apagadas no passo 4, cole o CSS da `.vitrine__apaga` (trecho "target").

## Boundaries

- NÃO mude os valores visuais (0,65 de escurecimento ≈ opacity 1 da camada; 0,14 de escala; 5° de giro; magenta `rgba(224, 24, 80, 0.6)`).
- NÃO remova as classes `carregando`/`desbloqueando` do JS (outras regras usam `desbloqueando`).
- NÃO toque no shader nem em `ambientes.js`.
- Se o código não bater com os trechos acima, PARE e reporte.

## Verification

- **Mechanical**: `npm run build` termina com "✓ built". `grep -n "carga, 0) \* 28vmin" src/style.css` não acha nada.
- **Feel check**: segure o selo na Divergência:
  - o fundo escurece e a borda fica magenta acompanhando o anel, sem atraso;
  - soltar faz tudo voltar junto com o anel;
  - DevTools → Performance: grave 2 s segurando. Não deve haver blocos longos de "Recalculate Style"/"Paint" de tela cheia a cada quadro; em Rendering → "Paint flashing", a tela inteira NÃO deve piscar verde enquanto segura.
- **Done when**: nenhuma regra CSS de tela cheia lê `--carga`, e a variável é escrita só no `.selo`.
