# 008 — Tokens de movimento (curvas compartilhadas no CSS e no GSAP)

- **Status**: DONE (26/11/2026)
- **Commit**: a035f5d + mudanças locais não commitadas (redesenho da Maestria de 26/11/2026)
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 arquivo novo + 4 arquivos editados, ~30 linhas (trocas mecânicas)

## Problem

As curvas estão espalhadas e digitadas à mão:

- **CSS** (`src/style.css`): 8 vezes `cubic-bezier(0.2, 0.8, 0.2, 1)` (ease-out fraco) e 2 vezes `cubic-bezier(0.7, 0, 0.2, 1)` (ease-in-out), sem nenhuma variável:
  ```css
  /* src/style.css — atual */
  177:  transition: transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.45s;
  183:  .trilha__textos { ... transition: transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.45s; }
  348:  .maestria__voltar span { ... transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1); }
  372:  transition: transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.3s, filter 0.4s;
  485:  transition: opacity 0.5s, visibility 0.5s, transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1);
  507:  transition: filter 0.35s, background 0.35s, scale 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
  765:  transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.3s;
  774:  .plano__icone { ... transition: transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1); }
  800:  transform: scaleX(0); transform-origin: right; transition: transform 0.55s cubic-bezier(0.7, 0, 0.2, 1);
  807:  .botao__rolo > span, .botao__rolo::after { display: block; transition: transform 0.5s cubic-bezier(0.7, 0, 0.2, 1); }
  ```
  (Os números de linha podem ter se deslocado se os planos 001, 002 ou 005 já foram executados — localize pelo texto `cubic-bezier(`.)
- **GSAP** (`src/arma/vitrine.js`, `src/arma/maestria.js`, `src/arma/mestria.js`): strings soltas `'expo.out'` (entradas) e `'power3.inOut'` (movimento da câmera/linha da trilha), sem fonte única.

## Target

Duas curvas, definidas uma vez em cada lado:

```css
/* target — src/style.css, dentro do :root (logo depois de --pincel) */
  /* curvas de movimento (mesmas do GSAP em src/movimento.js) */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1); /* entrando/saindo e respostas da interface */
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1); /* algo se movendo de um lugar a outro na tela */
```

```js
/* target — arquivo novo src/movimento.js */
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(CustomEase);

// Curvas de movimento do site, iguais às do CSS (--ease-out e --ease-in-out em style.css).
export const EASE = {
  saida: CustomEase.create('saida', 'M0,0 C0.23,1 0.32,1 1,1'), // entrando/saindo e respostas da interface
  move: CustomEase.create('move', 'M0,0 C0.77,0 0.175,1 1,1'), // algo se movendo de um lugar a outro na tela
};
```

## Repo conventions to follow

- Variáveis globais ficam no `:root` do topo de `src/style.css` (ex.: `--preto`, `--amarelo`, `--sans`).
- Módulos JS ficam em `src/`, com imports `import { gsap } from 'gsap';` e plugins registrados no topo (ex.: `gsap.registerPlugin(SplitText);` em `src/arma/maestria.js`). `gsap/CustomEase` já vem no pacote `gsap` instalado (não instale nada).

## Steps

1. Em `src/style.css`, no `:root`, depois da linha `--pincel: ...;`, adicione as duas variáveis do trecho "target".
2. Em `src/style.css`, troque TODAS as ocorrências de `cubic-bezier(0.2, 0.8, 0.2, 1)` por `var(--ease-out)` e de `cubic-bezier(0.7, 0, 0.2, 1)` por `var(--ease-in-out)`. Se o plano 001 já foi executado, troque também `cubic-bezier(0.23, 1, 0.32, 1)` da regra `.selo__svg` por `var(--ease-out)`. Depois disso, `grep -n "cubic-bezier(" src/style.css` só deve achar as duas definições no `:root`.
3. Crie `src/movimento.js` com o conteúdo "target".
4. Em `src/arma/vitrine.js`, `src/arma/maestria.js` e `src/arma/mestria.js`:
   - adicione `import { EASE } from '../movimento.js';` junto dos outros imports;
   - troque toda ocorrência de `ease: 'expo.out'` por `ease: EASE.saida`;
   - troque toda ocorrência de `ease: 'power3.inOut'` por `ease: EASE.move`.

## Boundaries

- NÃO troque estas, que são escolhas deliberadas: `'power2.inOut'` (varredura da camo e troca de cor da topografia — crossfade suave), `'back.out(...)'` (carimbo e losangos), `'steps(4)'` (interferência), `'power2.in'` do estouro do selo e do `sair` (embalo), `'power3.out'` do abalo, `'none'`/linear (carga do selo, entrada por rolagem).
- NÃO mude durações.
- NÃO toque em `src/arma/ambientes.js`, `src/hero.js`, `src/preloader.js`, `src/precos/*` (fora do escopo).
- As trocas no CSS afetam também os cartões da loja (`.plano`) e os botões (`.botao`), porque os tokens são globais — isso é intencional.
- Se o código não bater com os trechos acima, PARE e reporte.

## Verification

- **Mechanical**: `npm run build` termina com "✓ built". `grep -rn "expo.out\|power3.inOut" src/arma/vitrine.js src/arma/maestria.js src/arma/mestria.js` não acha nada. `grep -n "cubic-bezier(" src/style.css` mostra só as 2 definições.
- **Feel check**:
  - passe o mouse nos itens da trilha e nos botões: as respostas ficam um pouco mais "decididas" (a curva nova é mais forte no início), sem parecerem bruscas;
  - troque camos e entre na Maestria: entradas e o deslizar da câmera continuam com a mesma sensação (as curvas novas são muito próximas das antigas);
  - DevTools (Animations, 10%): as transições de hover usam `cubic-bezier(0.23, 1, 0.32, 1)`.
- **Done when**: há uma única definição de cada curva no CSS e no JS, e os arquivos do escopo só usam os tokens.
