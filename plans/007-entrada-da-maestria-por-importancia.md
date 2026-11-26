# 007 — Entrada da Maestria em ordem de importância, sem travar a rolagem até o fim

- **Status**: DONE (26/11/2026)
- **Commit**: a035f5d + mudanças locais não commitadas (redesenho da Maestria de 26/11/2026)
- **Severity**: LOW
- **Category**: Cohesion & tokens (coreografia)
- **Estimated scope**: 1 arquivo (`src/arma/maestria.js`), ~15 linhas

## Problem

Depois do estouro do selo, a interface da Maestria entra assim:

```js
/* src/arma/maestria.js:137–142 — atual */
  const entradas = [
    ...frente.querySelectorAll('.maestria__rotulo, .maestria__frente'),
    painel.querySelector('.mtrilha__linha'),
    ...painel.querySelectorAll('.mtrilha__lista > li'),
    ficha, voltar, frente.querySelector('.maestria__dica'),
  ];

/* src/arma/maestria.js:383 — atual (última linha da timeline do desbloqueio) */
      .fromTo(entradas, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 1.0, ease: 'expo.out', stagger: 0.06 }, 'estouro+=0.6');
```

E a rolagem só volta quando a timeline inteira termina:

```js
/* src/arma/maestria.js:345–349 — atual */
    const fim = () => {
      secao.classList.remove('desbloqueando');
      carga.v = 0; aplicarCarga();
      lenis?.start();
    };
```

Problemas:
- **Atraso uniforme** (0,06 s em ~10 elementos, na ordem do DOM): o grupo anda como um metrônomo, e a ficha — a coisa mais importante depois do título, com o botão "Quero essa camo" — entra só depois do rótulo, da frente, da linha e dos 4 itens da trilha (~0,5 s de espera extra).
- A página fica travada até o último elemento (dica "Arraste para girar") terminar de entrar, ~2,6 s depois do estouro. Coreografia não pode bloquear interação.

**Decisões já tomadas (não reabrir):** o estouro (clarão, onda, lascas), o título com peso e o carimbo 해제 ficam como estão. A duração longa é aceitável: é um momento raro.

## Target

Papéis: **título** (líder, já tem tween próprio) → **ficha** (apoio principal) → **trilha** (apoio, com atraso que diminui) → **rótulo/frente** → **voltar/dica** (fundo).

```js
/* target — no lugar da linha 383 */
      .fromTo(ficha, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: 'expo.out' }, 'estouro+=0.45')
      .fromTo(painel.querySelector('.mtrilha__linha'), { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'expo.out' }, 'estouro+=0.55')
      .fromTo(painel.querySelectorAll('.mtrilha__lista > li'), { y: 20, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: { amount: 0.16, ease: 'power2.out' },
      }, 'estouro+=0.55')
      .fromTo(frente.querySelectorAll('.maestria__rotulo, .maestria__frente'), { y: 14, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.08,
      }, 'estouro+=0.65')
      .fromTo([voltar, frente.querySelector('.maestria__dica')], { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'expo.out' }, 'estouro+=0.9')
      .call(() => lenis?.start(), null, 'estouro+=0.9'); // a rolagem volta assim que a ficha está na tela
```

(`stagger: { amount: 0.16, ease: 'power2.out' }` distribui 0,16 s entre os 4 itens com intervalos que vão encurtando — não uniforme.)

`fim` continua chamando `lenis?.start()` (inofensivo se já estiver ligado) para cobrir o caso de a timeline ser concluída de outro jeito.

## Repo conventions to follow

- A timeline do desbloqueio usa labels (`'estouro'`, `'estouro+=0.35'`) e `ease: 'expo.out'` nas entradas — siga o mesmo padrão.
- `entradas` continua existindo (é usada em `virar()` e no caminho `reduzir` para esconder/mostrar tudo de uma vez). NÃO apague a constante.

## Steps

1. Em `src/arma/maestria.js`, substitua APENAS a linha 383 (`.fromTo(entradas, { y: 26, opacity: 0 }, ...)` com o `;` final) pelo bloco "target". O último `.call(...)` do bloco termina com `;`.
2. Não altere `fim`, `virar`, nem o ramo `if (reduzir) { ... }`.

## Boundaries

- NÃO mude os tweens de `titulo`, `carimbo`, `clarao`, `onda`, `modo`, `selo`, `uTrinca`.
- NÃO mude `DESBLOQUEIO`.
- Se o código não bater com os trechos acima, PARE e reporte.

## Verification

- **Mechanical**: `npm run build` termina com "✓ built".
- **Feel check**: segure o selo até romper:
  - logo depois do título, a ficha (com "Quero essa camo") entra primeiro; a trilha vem quase junto, num leque que acelera; o rótulo e a linha "Frente Multiplayer" depois; "Voltar ao arsenal" e a dica por último, discretos;
  - ~1 s depois do estouro já dá para rolar a página (antes travava ~2,6 s);
  - DevTools (Animations, 25%): os itens da trilha NÃO entram com intervalos iguais.
- **Done when**: não existe mais `stagger: 0.06` sobre `entradas` e `lenis.start()` acontece em `'estouro+=0.9'`.
