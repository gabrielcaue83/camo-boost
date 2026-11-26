// Planos da loja (ordem igual à de CAMOS).
// ⚠ PROVISÓRIO: preços e itens de exemplo. Troque pelos do seu serviço.
//   preco:    valor principal do cartão
//   por:      o que esse preço cobre
//   itens:    o que está incluso (3 linhas curtas)
//   destaque: true mostra a etiqueta "Mais pedido"

export const PLANOS = [
  { preco: 'R$ 29,90', por: 'por arma', itens: ['Camos militares + Ouro', 'Entrega em até 24h', 'Acompanhamento ao vivo'] },
  { preco: 'R$ 149,90', por: 'por classe', itens: ['Ouro em toda a classe', 'Desafio de Platina', 'Prioridade na fila'], destaque: true },
  { preco: 'R$ 499,90', por: 'todas as armas', itens: ['Platina nas 33 armas', 'Desafios Harmonic Break', 'Booster dedicado'] },
  { preco: 'R$ 899,90', por: 'mestria completa', itens: ['Divergência nas 33 armas', 'Abre as camos de Mestria', 'Suporte VIP'] },
];
