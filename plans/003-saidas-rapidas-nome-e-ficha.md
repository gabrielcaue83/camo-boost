# 003 — Saídas rápidas e com ease-out no nome gigante e nas fichas

- **Status**: DONE (26/11/2026)
- **Commit**: a035f5d + mudanças locais não commitadas (redesenho da Maestria de 26/11/2026)
- **Severity**: MEDIUM
- **Category**: Easing & duration
- **Estimated scope**: 3 arquivos, ~12 linhas (só configs e strings de ease)

## Problem

Em cada troca de camo, o conteúdo antigo sai com uma curva que começa devagar (`power3.in` / `power2.in`) e o novo só entra DEPOIS que a saída termina. Resultado: a informação nova chega atrasada.

- Nome gigante do arsenal: saída de 0,5 s + 0,035 s por letra (≈14 letras) → quase 1 s até o nome novo aparecer.
- Nome gigante da Maestria: 0,45 s + 0,03 s por letra.
- Ficha do arsenal e ficha da Maestria: 0,3 s / 0,28 s com `power2.in` antes do texto novo.

```js
/* src/arma/vitrine.js:39 — atual */
  nome: { sai: 0.5, entra: 1.1, intervalo: 0.035, desfoque: 12 }, // troca do nome: s de saída / s de entrada / s entre letras / px de desfoque
/* src/arma/vitrine.js:146–148 — atual */
    nomeTl = gsap.to(letras.chars, {
      yPercent: -45, opacity: 0, filter: `blur(${N.desfoque}px)`,
      duration: N.sai, ease: 'power3.in', stagger: { each: N.intervalo, from: 'start' },

/* src/arma/maestria.js:30–31 — atual */
  nome: { sai: 0.45, entra: 1.0, intervalo: 0.03, desfoque: 12 }, // troca do nome gigante
  ficha: { sai: 0.28, entra: 0.7, intervalo: 0.05, contador: 1.1 },
/* src/arma/maestria.js:163–165 — atual */
    nomeTl = gsap.to(letras.chars, {
      yPercent: -45, opacity: 0, filter: `blur(${N.desfoque}px)`,
      duration: N.sai, ease: 'power3.in', stagger: { each: N.intervalo },
/* src/arma/maestria.js:206 — atual */
      .to(blocos, { yPercent: -110, opacity: 0, duration: F.sai, ease: 'power2.in', stagger: F.intervalo * 0.5 })

/* src/arma/mestria.js:10 — atual */
  sai: 0.3, // s: textos da ficha saindo
/* src/arma/mestria.js:148 — atual */
      .to(blocos, { yPercent: -110, opacity: 0, duration: MESTRIA.sai, ease: 'power2.in', stagger: MESTRIA.intervalo * 0.5 })
```

**Decisão já tomada (não reabrir):** o usuário pediu explicitamente uma animação de SAÍDA nos nomes ("tá chapado demais"). A saída continua existindo, com o mesmo desenho (sobe, desfoca e some). Só fica mais curta e com ease-out.

## Target

- Toda saída usa `expo.out` (ease-out forte, já usado no projeto nas entradas).
- Nomes: saída de 0,22 s por letra, com 0,01 s entre letras (nova chave `intervaloSai`); entrada fica igual.
- Fichas: saída de 0,18 s, com 0,015 s entre blocos.

```js
/* target — vitrine.js:39 */
  nome: { sai: 0.22, intervaloSai: 0.01, entra: 1.1, intervalo: 0.035, desfoque: 12 }, // s de saída / s entre letras na saída / s de entrada / s entre letras na entrada / px de desfoque
/* target — maestria.js:30–31 */
  nome: { sai: 0.22, intervaloSai: 0.01, entra: 1.0, intervalo: 0.03, desfoque: 12 }, // troca do nome gigante
  ficha: { sai: 0.18, entra: 0.7, intervalo: 0.05, contador: 1.1 },
/* target — mestria.js:10 */
  sai: 0.18, // s: textos da ficha saindo
```

## Repo conventions to follow

- Tempos ficam nos objetos de config em MAIÚSCULAS no topo de cada arquivo, com comentário em português dizendo o que cada número muda. Exemplo: `VITRINE` em `src/arma/vitrine.js:19`.
- Entradas já usam `ease: 'expo.out'` (ex.: `src/arma/vitrine.js:155`). Use a mesma string nas saídas.

## Steps

1. `src/arma/vitrine.js:39`: troque a linha de `nome` pela versão "target".
2. `src/arma/vitrine.js:148`: troque `duration: N.sai, ease: 'power3.in', stagger: { each: N.intervalo, from: 'start' },` por `duration: N.sai, ease: 'expo.out', stagger: { each: N.intervaloSai, from: 'start' },`. NÃO mexa na entrada (linha 155).
3. `src/arma/maestria.js:30–31`: troque `nome` e `ficha` pelas versões "target".
4. `src/arma/maestria.js:165`: troque `duration: N.sai, ease: 'power3.in', stagger: { each: N.intervalo },` por `duration: N.sai, ease: 'expo.out', stagger: { each: N.intervaloSai },`.
5. `src/arma/maestria.js:206`: troque `ease: 'power2.in', stagger: F.intervalo * 0.5` por `ease: 'expo.out', stagger: 0.015`.
6. `src/arma/mestria.js:10`: `sai: 0.3` → `sai: 0.18` (mantenha o comentário).
7. `src/arma/mestria.js:148`: troque `ease: 'power2.in', stagger: MESTRIA.intervalo * 0.5` por `ease: 'expo.out', stagger: 0.015`.

## Boundaries

- NÃO mude as entradas (`gsap.from` / `fromTo` com `expo.out`), o desfoque, nem o movimento (`yPercent`).
- NÃO toque em `selo`, `desbloquear`, `sair` (o `power2.in` de `sair` em maestria.js e o do selo no estouro são intencionais).
- Se o código não bater com os trechos acima, PARE e reporte.

## Verification

- **Mechanical**: `npm run build` termina com "✓ built". `grep -n "power3.in\|power2.in" src/arma/vitrine.js src/arma/mestria.js` não acha nada; em `maestria.js` só sobram as ocorrências do estouro (`selo`, `uTrinca`, `abalo`) e de `sair` (`frente`).
- **Feel check**: role pelas 4 camos e troque as camos de Maestria:
  - o nome antigo ainda sobe e desfoca, mas some quase de imediato e o novo aparece em ~0,3 s;
  - a ficha troca sem "buraco" vazio perceptível;
  - DevTools (Animations, 10%): a saída começa rápida (sem arrancada lenta).
- **Done when**: nenhuma saída de nome/ficha usa `.in`, e a troca completa leva menos de 0,4 s até o texto novo começar a entrar.
