import type { Ammo, EstadoAlvo, EstadoAtirador, SolucaoDeTiro, Vec3 } from './types.js';

export const G = 9.81;

export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const norma = (a: Vec3) => Math.sqrt(dot(a, a));
export const normalizar = (a: Vec3): Vec3 => {
  const n = norma(a);
  return n === 0 ? { x: 0, y: 0, z: 0 } : { x: a.x / n, y: a.y / n, z: a.z / n };
};
export const cruz = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

/** Converte um deslocamento lateral a uma distância para erro angular. */
export const paraMrad = (deslocamento: number, distancia: number) =>
  distancia === 0 ? 0 : Math.atan2(deslocamento, distancia) * 1000;

/** Caminho inverso: quantos metros valem N mrad naquela distância. */
export const mradParaMetros = (mrad: number, distancia: number) =>
  Math.tan(mrad / 1000) * distancia;

/**
 * Tempo de voo com arrasto quadrático, integrado passo a passo.
 *
 * Não existe fórmula fechada para dv/dt = -k*v² somada à distância
 * percorrida de forma que valha a pena aqui; a integração é barata e
 * o erro fica abaixo do que o jogador consegue perceber.
 */
export function tempoDeVoo(distancia: number, municao: Ammo, dt = 0.001): number {
  if (distancia <= 0) return 0;
  let v = municao.v0;
  let s = 0;
  let t = 0;
  const limite = 30; // segundos; trava de segurança
  while (s < distancia && t < limite) {
    // ATGM acelera até a velocidade de cruzeiro em vez de só desacelerar.
    if (municao.tipo === 'ATGM' && municao.aceleracao && v < municao.v0) {
      v += municao.aceleracao * dt;
    } else {
      v -= municao.arrasto * v * v * dt;
    }
    if (v <= 0) break;
    s += v * dt;
    t += dt;
  }
  return t;
}

/** Queda por gravidade no tempo de voo. ATGM guiado não cai. */
export function queda(tempoVoo: number, municao: Ammo): number {
  if (municao.tipo === 'ATGM') return 0;
  return 0.5 * G * tempoVoo * tempoVoo;
}

/**
 * Solução de tiro completa.
 *
 * O ponto central do treino: a velocidade que gera lead é a RELATIVA,
 * ou seja, a do alvo MENOS a sua. Atirar em movimento não é o mesmo
 * problema que atirar parado contra um alvo em movimento, e é por isso
 * que o estabilizador não resolve nada — ele segura a vertical, e o
 * erro real mora na horizontal.
 */
export function solucaoDeTiro(
  atirador: EstadoAtirador,
  alvo: EstadoAlvo,
  municao: Ammo,
): SolucaoDeTiro {
  const separacao = sub(alvo.posicao, atirador.posicao);
  const distancia = norma(separacao);
  const direcao = normalizar(separacao);

  const t = tempoDeVoo(distancia, municao);
  const q = queda(t, municao);

  // Velocidade relativa: alvo menos atirador.
  const vRel = sub(alvo.velocidade, atirador.velocidade);

  // Eixo lateral: perpendicular à linha de visada e ao "para cima".
  const cima: Vec3 = { x: 0, y: 1, z: 0 };
  const lateral = normalizar(cruz(cima, direcao));

  // Componente da velocidade relativa em cada eixo.
  const vLateral = dot(vRel, lateral);
  const vVertical = dot(vRel, cima);

  // ATGM é guiado: o lead não é do atirador, é do sistema.
  const fator = municao.tipo === 'ATGM' ? 0 : 1;

  return {
    tempoVoo: t,
    leadHorizontalMrad: paraMrad(vLateral * t * fator, distancia),
    leadVerticalMrad: paraMrad(vVertical * t * fator + q, distancia),
    quedaM: q,
    velocidadeLateralRelativa: vLateral,
  };
}

/** Interpola a curva de penetração da munição naquela distância. */
export function penetracaoNaDistancia(municao: Ammo, distancia: number): number {
  const pts = municao.penetracao;
  if (pts.length === 0) return 0;
  if (distancia <= pts[0][0]) return pts[0][1];
  const ultimo = pts[pts.length - 1];
  if (distancia >= ultimo[0]) return ultimo[1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [d0, p0] = pts[i];
    const [d1, p1] = pts[i + 1];
    if (distancia >= d0 && distancia <= d1) {
      const f = (distancia - d0) / (d1 - d0);
      return p0 + (p1 - p0) * f;
    }
  }
  return ultimo[1];
}
