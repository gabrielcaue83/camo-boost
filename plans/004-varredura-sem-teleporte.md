# 004 — Varredura da camo sem teleporte quando a rolagem é rápida

- **Status**: DONE (26/11/2026)
- **Commit**: a035f5d + mudanças locais não commitadas (redesenho da Maestria de 26/11/2026)
- **Severity**: MEDIUM
- **Category**: Interruptibility
- **Estimated scope**: 1 arquivo, ~20 linhas

## Problem

A troca de camo na arma é uma varredura do cano à coronha (uniform `uTransicao` de 0 a 1 no shader, entre a camo A e a B). Se uma nova troca chega no meio da anterior (rolagem rápida pelas camos), `progress(1)` pula a varredura atual direto para o fim — a arma "teleporta" para a camo intermediária e então começa a próxima. Dá para ver o pulo.

```js
/* src/arma/vitrine.js:113–123 — atual */
  let idArma = 0; // camo que está na arma (ids do arsenal e da Maestria)
  let troca;
  const varrer = (id, dur = VITRINE.troca) => {
    if (id === idArma) return;
    idArma = id;
    troca?.progress(1); // termina a anterior na hora
    U.uCamoB.value = id;
    troca = gsap.fromTo(U.uTransicao, { value: 0 }, {
      value: 1, duration: reduzir ? 0 : dur, ease: 'power2.inOut',
      onComplete: () => { U.uCamoA.value = id; U.uTransicao.value = 0; },
    });
  };
```

O shader só sabe misturar duas camos por vez (A e B), então não dá para "redirecionar" a varredura no meio. A solução é terminar a atual depressa (em vez de pular) e enfileirar a próxima.

Atenção: `varrer(id, 0)` é chamado com duração zero pelo desbloqueio da Maestria (debaixo do clarão a arma precisa virar Mercurial Drift NA HORA). Esse caso deve continuar imediato.

## Target

```js
/* target */
  let idArma = 0; // camo que está na arma (ids do arsenal e da Maestria)
  let troca;
  let fila = null; // próxima varredura, se chegou outra no meio da atual
  const iniciarVarredura = (id, dur) => {
    U.uCamoB.value = id;
    troca = gsap.fromTo(U.uTransicao, { value: 0 }, {
      value: 1, duration: reduzir ? 0 : dur, ease: 'power2.inOut',
      onComplete: () => {
        U.uCamoA.value = id; U.uTransicao.value = 0;
        if (fila) { const f = fila; fila = null; iniciarVarredura(f.id, f.dur); }
      },
    });
  };
  const varrer = (id, dur = VITRINE.troca) => {
    if (id === idArma) return;
    idArma = id;
    if (dur === 0 || reduzir) { // troca imediata (desbloqueio da Maestria, movimento reduzido)
      troca?.kill(); fila = null;
      U.uCamoA.value = id; U.uCamoB.value = id; U.uTransicao.value = 0;
      return;
    }
    if (troca?.isActive()) {
      // no meio de outra: termina a atual depressa (~0,15 s) e a próxima entra na fila
      fila = { id, dur };
      const resta = troca.duration() * (1 - troca.progress());
      troca.timeScale(Math.max(1, resta / 0.15));
      return;
    }
    iniciarVarredura(id, dur);
  };
```

## Repo conventions to follow

- Comentários curtos em português explicando o porquê (como `// termina a anterior na hora`).
- `reduzir` já existe no arquivo (`const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;`).

## Steps

1. Em `src/arma/vitrine.js`, substitua o bloco das linhas 113–123 (de `let idArma = 0;` até o `};` que fecha `varrer`) pelo trecho "target".
2. Confirme que nenhum outro lugar usa `troca` além desse bloco (`grep -n "troca" src/arma/vitrine.js` deve mostrar só `VITRINE.troca` na config, o bloco novo e `VITRINE.topoTroca`).

## Boundaries

- NÃO mude o shader, a duração padrão (`VITRINE.troca`) nem o ease `power2.inOut` da varredura.
- NÃO mude quem chama `varrer` (vitrine.js `trocarPara`, `aoSair`, e maestria.js `escolher`).
- Se o código não bater com o trecho acima, PARE e reporte.

## Verification

- **Mechanical**: `npm run build` termina com "✓ built".
- **Feel check**:
  - role rápido do Ouro até a Divergência: a arma passa pelas camos com varreduras curtas e contínuas, sem nenhum quadro pulando direto para uma camo;
  - role devagar: cada varredura leva o tempo normal (~1 s);
  - na Maestria, clique rápido em Mercurial → Polyatomic → Orion: nenhuma varredura "teleporta";
  - segure o selo até romper: debaixo do clarão a arma já aparece na Mercurial Drift (troca imediata continua funcionando).
- **Done when**: `progress(1)` não existe mais em `varrer`, e trocas rápidas não pulam.
