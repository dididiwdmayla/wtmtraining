/**
 * Sensibilidade da mira: quanto ÂNGULO vale um pixel de dedo.
 *
 * A regra é uma só: o dedo comanda a fração de tela que ele percorre,
 * e essa fração vale o ângulo que a tela mostra naquele eixo. Um
 * arraste que cruza a largura inteira gira exatamente o FOV horizontal;
 * um que cruza a altura inteira gira exatamente o FOV vertical. Como o
 * FOV de cada eixo já embute a razão de aspecto e o zoom, o mesmo
 * deslocamento angular do dedo produz a mesma rotação em retrato, em
 * paisagem, em terceira pessoa e na mira fechada — sem tabela de
 * calibração por aparelho.
 *
 * O que NÃO entra aqui, de propósito:
 *
 * - `devicePixelRatio`. `PointerEvent.clientX/Y` já vem em pixel CSS, e
 *   é em pixel CSS que a tela é medida. Multiplicar por dpr faria a
 *   sensibilidade depender da densidade do painel, que é acidente de
 *   hardware, não ergonomia.
 * - `dt` de quadro. O ângulo sai do DESLOCAMENTO, não da velocidade, e a
 *   soma dos deslocamentos de um gesto é a mesma a 30, 60 ou 120 Hz.
 *   A velocidade entra só como multiplicador da curva de ganho.
 *
 * Zero DOM, zero three.js: tudo aqui é número puro e testável.
 */

const GRAUS = Math.PI / 180;

/** Área realmente visível, em pixels CSS — a unidade do PointerEvent. */
export interface DimensaoTela {
  largura: number;
  altura: number;
}

/**
 * Curva de ganho por velocidade do dedo. Dedo lento entrega ganho 1 —
 * é o que permite ajustar frações de mrad; dedo rápido entrega até
 * `maximo` — é o que permite trocar de alvo sem levantar o dedo.
 *
 * As quebras estão em DIAGONAIS DE TELA por segundo, não em px/s: a
 * diagonal é a única medida que não muda quando o aparelho gira, então
 * a mesma velocidade de dedo cai no mesmo ponto da curva em qualquer
 * orientação e em qualquer tamanho de tela.
 */
export interface CurvaDeGanho {
  /** Multiplicador na ponta rápida, com intensidade 1. */
  maximo: number;
  /** Abaixo disto o multiplicador é exatamente 1. */
  lentaDiagonaisPorS: number;
  /** Acima disto o multiplicador é exatamente `maximo`. */
  rapidaDiagonaisPorS: number;
  /** Curvatura. 1 = reta; >1 segura o ganho baixo por mais tempo. */
  expoente: number;
}

export interface LimitesZoom {
  fovMaxGraus: number;
  fovMinGraus: number;
}

/** Os três números que o jogador mexe na tela de ajustes. */
export interface AjustesDeMira {
  /** 1 = arrastar a largura da tela gira o FOV horizontal inteiro. */
  sensibilidadeBase: number;
  /** 0 = curva desligada (ganho constante); 1 = curva cheia. */
  intensidadeGanho: number;
  /** Correção aplicada no zoom mais fechado. 1 = puro relativo à tela. */
  multiplicadorZoomMax: number;
}

const travar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Ângulo médio que um pixel CSS vale em cada eixo.
 *
 * `fovVerticalGraus` é o que o three.js guarda em `PerspectiveCamera.fov`.
 * O horizontal sai dele com a razão de aspecto — e é ESSE que precisa
 * escalar o eixo X. Usar o vertical nos dois eixos é o que fazia a
 * guinada mudar de comportamento quando o aparelho girava: o FOV
 * horizontal vai de ~27° em retrato a ~97° em paisagem sem que o
 * vertical mude um grau.
 *
 * A conta é o ângulo TOTAL do eixo dividido pelos pixels do eixo, não a
 * derivada no centro: assim "cruzar a tela inteira = girar o FOV
 * inteiro" vale exatamente, que é a propriedade que o jogador consegue
 * verificar. Nos FOV estreitos da mira as duas definições coincidem.
 */
export function radianosPorPixel(
  fovVerticalGraus: number,
  tela: DimensaoTela,
): { x: number; y: number } {
  if (tela.largura <= 0 || tela.altura <= 0) return { x: 0, y: 0 };
  const tanVertical = Math.tan((fovVerticalGraus * GRAUS) / 2);
  const tanHorizontal = tanVertical * (tela.largura / tela.altura);
  return {
    x: (2 * Math.atan(tanHorizontal)) / tela.largura,
    y: (2 * Math.atan(tanVertical)) / tela.altura,
  };
}

/**
 * Velocidade do dedo na única unidade que sobrevive a girar o aparelho:
 * a diagonal da tela é a mesma em retrato e em paisagem.
 */
export function diagonaisPorSegundo(velocidadePxS: number, tela: DimensaoTela): number {
  const diagonal = Math.hypot(tela.largura, tela.altura);
  return diagonal > 0 ? velocidadePxS / diagonal : 0;
}

/**
 * Multiplicador da curva para a velocidade daquela amostra de toque.
 * Sempre ≥ 1: a curva acelera, nunca freia abaixo da base.
 */
export function ganhoDeVelocidade(
  curva: CurvaDeGanho,
  velocidadeDiagonaisPorS: number,
  intensidade: number,
): number {
  const faixa = curva.rapidaDiagonaisPorS - curva.lentaDiagonaisPorS;
  const bruto =
    faixa > 0 ? (velocidadeDiagonaisPorS - curva.lentaDiagonaisPorS) / faixa : 1;
  const t = Math.pow(travar(bruto, 0, 1), curva.expoente);
  const cheio = 1 + (curva.maximo - 1) * t;
  return 1 + (cheio - 1) * travar(intensidade, 0, 1);
}

/**
 * Correção de sensibilidade pelo zoom, POR CIMA do que a escala de FOV
 * já faz sozinha.
 *
 * `radianosPorPixel` já derruba o ganho angular junto com o FOV, então
 * a sensibilidade aparente na tela é a mesma em qualquer ampliação.
 * Só que "a mesma na tela" nem sempre é o que o jogador quer no zoom
 * fechado, e é isso que este multiplicador ajusta: vale 1 no FOV mais
 * aberto e `multiplicadorNoMaximo` no mais fechado, interpolado em
 * escala logarítmica porque zoom se percebe multiplicando, não somando.
 *
 * Em terceira pessoa o FOV é maior que o teto da mira, o travamento
 * devolve 1 e o multiplicador some — como tem que ser.
 */
export function multiplicadorDeZoom(
  fovGraus: number,
  limites: LimitesZoom,
  multiplicadorNoMaximo: number,
): number {
  const { fovMaxGraus, fovMinGraus } = limites;
  if (!(fovMaxGraus > fovMinGraus) || fovMinGraus <= 0) return 1;
  const fov = travar(fovGraus, fovMinGraus, fovMaxGraus);
  const t = Math.log(fovMaxGraus / fov) / Math.log(fovMaxGraus / fovMinGraus);
  return Math.pow(Math.max(multiplicadorNoMaximo, 0), t);
}

export interface ArrasteDeMira {
  /** Deslocamento da amostra, em pixels CSS. */
  dx: number;
  dy: number;
  /** Velocidade MEDIDA daquela amostra, em px/s. */
  velocidadePxS: number;
  /** FOV vertical da câmera que está na tela, em graus. */
  fovAtivoGraus: number;
  tela: DimensaoTela;
  curva: CurvaDeGanho;
  zoom: LimitesZoom;
  /** Trim do eixo vertical. 1 mantém os dois eixos coerentes. */
  razaoVertical: number;
  ajustes: AjustesDeMira;
}

/**
 * Uma amostra de arraste vira ângulo aqui, na hora — sem filtro, sem
 * lerp, sem esperar o próximo quadro. É a função inteira do input.
 *
 * Sinal: dedo para a direita gira para a direita (guinada negativa no
 * referencial do three.js), dedo para cima levanta o cano.
 */
export function anguloDoArraste(entrada: ArrasteDeMira): {
  guinada: number;
  elevacao: number;
} {
  const porPixel = radianosPorPixel(entrada.fovAtivoGraus, entrada.tela);
  const ganho = ganhoDeVelocidade(
    entrada.curva,
    diagonaisPorSegundo(entrada.velocidadePxS, entrada.tela),
    entrada.ajustes.intensidadeGanho,
  );
  const zoom = multiplicadorDeZoom(
    entrada.fovAtivoGraus,
    entrada.zoom,
    entrada.ajustes.multiplicadorZoomMax,
  );
  const comum = Math.max(entrada.ajustes.sensibilidadeBase, 0) * ganho * zoom;

  return {
    guinada: -entrada.dx * porPixel.x * comum,
    elevacao: -entrada.dy * porPixel.y * comum * entrada.razaoVertical,
  };
}
