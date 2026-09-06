import { dot, normalizar, penetracaoNaDistancia, sub } from './ballistics.js';
import type { Ammo, Modulo, Placa, ResultadoImpacto, Veiculo, Vec3 } from './types.js';

const GRAUS = 180 / Math.PI;

/**
 * Ângulo de impacto: 0° é acerto perpendicular (o melhor caso),
 * 90° é raspão.
 */
export function anguloDeImpacto(direcaoTiro: Vec3, normalPlaca: Vec3): number {
  const d = normalizar(direcaoTiro);
  const n = normalizar(normalPlaca);
  // O tiro entra pela frente da placa, então usamos -d contra n.
  const cos = Math.abs(dot({ x: -d.x, y: -d.y, z: -d.z }, n));
  return Math.acos(Math.min(1, Math.max(0, cos))) * GRAUS;
}

/**
 * Espessura efetiva = nominal / cos(ângulo - normalização).
 *
 * A normalização é o que faz a flecha "endireitar" ao tocar a placa:
 * uma APFSDS enxerga menos inclinação do que a geometria sugere.
 */
export function espessuraEfetiva(
  espessuraMm: number,
  anguloGraus: number,
  normalizacaoGraus: number,
): number {
  const efetivo = Math.max(0, anguloGraus - normalizacaoGraus);
  const cos = Math.cos(efetivo / GRAUS);
  if (cos <= 0.02) return Number.POSITIVE_INFINITY;
  return espessuraMm / cos;
}

export const ricocheteou = (anguloGraus: number, municao: Ammo): boolean =>
  anguloGraus >= municao.ricocheteGraus;

/**
 * Interseção raio × caixa alinhada aos eixos (slab method).
 * Retorna a distância até a entrada, ou null.
 */
export function raioCaixa(
  origem: Vec3,
  direcao: Vec3,
  centro: Vec3,
  tamanho: Vec3,
): number | null {
  const eixos: Array<keyof Vec3> = ['x', 'y', 'z'];
  let tMin = -Infinity;
  let tMax = Infinity;

  for (const eixo of eixos) {
    const meio = tamanho[eixo] / 2;
    const min = centro[eixo] - meio;
    const max = centro[eixo] + meio;
    const d = direcao[eixo];

    if (Math.abs(d) < 1e-9) {
      if (origem[eixo] < min || origem[eixo] > max) return null;
      continue;
    }
    let t0 = (min - origem[eixo]) / d;
    let t1 = (max - origem[eixo]) / d;
    if (t0 > t1) [t0, t1] = [t1, t0];
    tMin = Math.max(tMin, t0);
    tMax = Math.min(tMax, t1);
    if (tMin > tMax) return null;
  }
  return tMax < 0 ? null : Math.max(tMin, 0);
}

/**
 * Quais módulos o projétil atravessa depois de furar a placa,
 * em ordem de profundidade. Isto é o que transforma "hitbox enorme"
 * em "área certa é bem específica".
 */
export function modulosNaLinha(
  pontoEntrada: Vec3,
  direcao: Vec3,
  modulos: Modulo[],
): Modulo[] {
  const acertos: Array<{ m: Modulo; t: number }> = [];
  for (const m of modulos) {
    const t = raioCaixa(pontoEntrada, direcao, m.centro, m.tamanho);
    if (t !== null) acertos.push({ m, t });
  }
  return acertos.sort((a, b) => a.t - b.t).map((a) => a.m);
}

/**
 * Resolve um impacto já confirmado numa placa.
 * A decisão de qual placa foi atingida é da camada de render,
 * que tem o raycast contra a geometria; aqui a gente só decide
 * o que acontece depois.
 */
export function resolverImpacto(
  placa: Placa,
  pontoImpacto: Vec3,
  direcaoTiro: Vec3,
  distancia: number,
  municao: Ammo,
  veiculo: Veiculo,
): ResultadoImpacto {
  const angulo = anguloDeImpacto(direcaoTiro, placa.normal);

  if (ricocheteou(angulo, municao)) {
    return { tipo: 'ricochete', placaId: placa.id, anguloImpacto: angulo };
  }

  const efetiva = espessuraEfetiva(placa.espessuraMm, angulo, municao.normalizacaoGraus);
  const pen = penetracaoNaDistancia(municao, distancia);

  if (pen < efetiva) {
    return {
      tipo: 'nao-penetrou',
      placaId: placa.id,
      espessuraEfetivaMm: efetiva,
      penetracaoMm: pen,
    };
  }

  const atingidos = modulosNaLinha(pontoImpacto, direcaoTiro, veiculo.modulos);
  return {
    tipo: 'penetrou',
    placaId: placa.id,
    espessuraEfetivaMm: efetiva,
    penetracaoMm: pen,
    modulosAtingidos: atingidos.map((m) => m.id),
    valor: atingidos.reduce((s, m) => s + m.valor, 0),
  };
}

export { sub };
