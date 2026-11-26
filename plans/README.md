# Planos de animação — vitrine e Maestria

Gerados pela auditoria `improve-animations` em 26/11/2026, sobre o commit `a035f5d` **mais as mudanças locais ainda não commitadas** (redesenho da Maestria: selo, trinca, estouro, ambientes). Cada plano é autossuficiente: pode ser executado por qualquer agente sem contexto desta conversa.

> Antes de executar: commite o estado atual. Os planos citam o código de trabalho de 26/11; se algo não bater, o executor deve parar e reportar.

| # | Plano | Gravidade | Status |
|---|---|---|---|
| 001 | [Carga do selo linear, com resposta imediata ao apertar](001-carga-do-selo-linear.md) | HIGH | DONE |
| 002 | [Segurar o selo sem repintar a tela inteira](002-segurar-sem-repintar-a-tela.md) | HIGH | DONE |
| 003 | [Saídas rápidas e com ease-out no nome e nas fichas](003-saidas-rapidas-nome-e-ficha.md) | MEDIUM | DONE |
| 004 | [Varredura da camo sem teleporte na rolagem rápida](004-varredura-sem-teleporte.md) | MEDIUM | DONE |
| 005 | [Respeitar "reduzir movimento" no CSS e no céu da Orion](005-movimento-reduzido-no-css.md) | MEDIUM | DONE |
| 006 | [Céu da Orion mais leve por quadro](006-ceu-da-orion-mais-leve.md) | LOW | DONE |
| 007 | [Entrada da Maestria em ordem de importância](007-entrada-da-maestria-por-importancia.md) | LOW | DONE |
| 008 | [Tokens de movimento no CSS e no GSAP](008-tokens-de-movimento.md) | LOW | DONE |

## Ordem recomendada

1. **001** e **002** juntos (os dois mexem no selo; 002 reescreve `aplicarCarga`, 001 só troca o ease de `carregar` — não conflitam, mas teste o segurar uma vez só, no fim dos dois).
2. **004** (independente).
3. **003** (independente).
4. **005**, depois **006** (006 tem um passo que preserva a variável `tc` criada pelo 005).
5. **007** (independente).
6. **008** por último: troca para tokens as strings `'expo.out'`/`'power3.inOut'` e os `cubic-bezier` que os planos 001, 003 e 007 criaram ou mantiveram.

## Dependências

- 006 → depois de 005 (passo 4 do 006).
- 008 → depois de 001, 003 e 007 (para converter também o que eles adicionam).
- 001 ↔ 002: mesmo arquivo (`maestria.js`) e mesmo elemento (`.selo`); executar em sequência, não em paralelo.

## Fora daqui (anotado, não planejado)

- Vibração curta (`navigator.vibrate`) no estouro do selo, no Android.
- Pequeno balanço de "quase" ao soltar o selo antes da hora.
