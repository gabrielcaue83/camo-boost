// Península coreana estilizada, a partir de coordenadas aproximadas
// (longitude, latitude). Não é cartografia exata: é o desenho do terreno.
// Plano do mapa: 1000 × 1000 unidades (x para a direita/leste, y para baixo/sul).

const LON0 = 124, LAT0 = 43;
export const geo = (lon, lat) => [(lon - LON0) * 140, (LAT0 - lat) * 100];

// contorno (sentido horário, começando na foz do rio Yalu)
export const CONTORNO = [
  [124.3, 39.9], [125.0, 40.4], [126.0, 41.0], [126.9, 41.8], [127.5, 41.5], [128.1, 42.0],
  [128.9, 42.0], [129.6, 42.4], [130.0, 42.9], [130.6, 42.4],
  [129.8, 41.6], [129.7, 40.8], [128.9, 40.4], [128.0, 39.9], [127.5, 39.5], [127.6, 39.0],
  [128.3, 38.6], [128.6, 38.0], [129.1, 37.4], [129.4, 36.5], [129.5, 35.6], [129.2, 35.1],
  [128.6, 34.9], [127.9, 34.7], [127.3, 34.5], [126.5, 34.3], [126.3, 34.7],
  [126.4, 35.2], [126.6, 35.9], [126.4, 36.5], [126.2, 36.9], [126.7, 37.3], [126.2, 37.7],
  [125.6, 37.9], [125.0, 38.1], [124.8, 38.6], [125.3, 39.0], [125.4, 39.5], [124.9, 39.7],
];
export const JEJU = [126.55, 33.38];

// zona desmilitarizada (aproximada)
export const DMZ = [[126.1, 37.75], [126.7, 37.95], [127.2, 38.25], [128.0, 38.3], [128.4, 38.62]];

export const CIDADES = [
  { nome: 'Pyongyang', lonlat: [125.75, 39.03] },
  { nome: 'Seul', lonlat: [126.98, 37.57] },
  { nome: 'Daejeon', lonlat: [127.38, 36.35] },
  { nome: 'Daegu', lonlat: [128.6, 35.87] },
  { nome: 'Busan', lonlat: [129.07, 35.18] },
];

// trajeto da câmera, curto e rente ao chão: sul de Seul → loja (perto da DMZ)
export const TRAJETO = [[127.32, 36.98], [127.12, 37.18], [127.08, 37.42], [126.86, 37.6], [126.72, 37.86]];
export const LOJA = [126.72, 37.86];
