/**
 * CONTRATO DO NÚCLEO — não alterar sem versionar.
 *
 * Tudo aqui é geometria e número puro. Nenhum import de three.js,
 * nenhum DOM. A camada de render consome estes tipos; o núcleo nunca
 * consome nada da camada de render.
 *
 * Unidades, sempre:
 *   distância      metros
 *   velocidade     m/s
 *   ângulo         graus (nas entradas legíveis por humano e nos JSON)
 *   erro angular   milirradianos (mrad) — 1 mrad = 1 m a 1000 m
 *   tempo          segundos
 *   espessura      milímetros
 */

export type Vec3 = { x: number; y: number; z: number };

/**
 * Modelo de dois corpos: o casco anda no plano do chão, a torre gira
 * por cima dele. Cada placa e cada módulo pertence a um dos dois — é
 * isto que permite a torre manter a mira no mundo enquanto o casco vira.
 */
export type ParteVeiculo = 'casco' | 'torre';

/** APFSDS = flecha cinética. ATGM = míssil guiado. */
export type AmmoKind = 'APFSDS' | 'ATGM';

export interface Ammo {
  id: string;
  nome: string;
  tipo: AmmoKind;
  /** Velocidade inicial. */
  v0: number;
  /** Coeficiente de arrasto do modelo dv/dt = -k*v². Zero = sem perda. */
  arrasto: number;
  /** Ângulo de normalização: quanto a flecha "endireita" ao tocar a placa. */
  normalizacaoGraus: number;
  /** Acima deste ângulo de impacto o projétil ricocheteia. */
  ricocheteGraus: number;
  /**
   * Curva de penetração: pares [distância, mm]. Interpolação linear
   * entre pontos, extrapolação travada nos extremos.
   */
  penetracao: Array<[distancia: number, mm: number]>;
  /** Só para ATGM: aceleração até a velocidade de cruzeiro. */
  aceleracao?: number;
}

/** Uma placa de blindagem. Também é o que a render desenha. */
export interface Placa {
  id: string;
  /** A que corpo a placa pertence. */
  parte: ParteVeiculo;
  /** Centro da placa, em coordenadas locais do veículo. */
  centro: Vec3;
  /** Largura e altura da placa no seu próprio plano. */
  tamanho: { largura: number; altura: number };
  /** Normal da placa em coordenadas locais. Define a inclinação. */
  normal: Vec3;
  espessuraMm: number;
}

/**
 * Módulo interno. É isto que separa "acertou o tanque" de
 * "acertou o lugar certo". Caixa alinhada aos eixos locais.
 */
export interface Modulo {
  id: string;
  /** A que corpo o módulo pertence. */
  parte: ParteVeiculo;
  tipo: 'municao' | 'motor' | 'transmissao' | 'tripulante' | 'culatra' | 'combustivel';
  centro: Vec3;
  tamanho: Vec3;
  /** Peso na pontuação. Munição vale mais que combustível. */
  valor: number;
}

/** Como o casco se move. Nenhum destes números vive no código. */
export interface DinamicaCasco {
  /** m/s, à frente. */
  velocidadeMax: number;
  /** m/s, à ré. */
  velocidadeMaxRe: number;
  /** m/s², acelerando. */
  aceleracao: number;
  /** m/s², freando. */
  frenagem: number;
  /** m/s², desaceleração natural sem acelerador. */
  atrito: number;
  /** graus/s, giro do casco sobre o próprio eixo. */
  guinadaGrausPorS: number;
}

/** A torre é o segundo corpo: guinada própria, com teto de velocidade. */
export interface Torre {
  /** graus/s. É o que dá inércia à mira: a torre não gruda no dedo. */
  guinadaGrausPorS: number;
}

/** O canhão é filho da torre: só eleva e deprime. */
export interface Canhao {
  /** Articulação, em coordenadas locais do veículo. */
  pivo: Vec3;
  /** m, do pivô à boca. É de onde o tiro sai. */
  comprimento: number;
  /** m. */
  raio: number;
  /** graus acima da horizontal. */
  elevacaoMaxGraus: number;
  /** graus abaixo da horizontal. */
  depressaoMaxGraus: number;
  /** graus/s. */
  grausPorS: number;
}

export interface Veiculo {
  id: string;
  nome: string;
  placas: Placa[];
  modulos: Modulo[];
  /** Altura do centro de massa, usada pela render e pela mira. */
  alturaCentro: number;
  dinamica: DinamicaCasco;
  torre: Torre;
  canhao: Canhao;
}

/** Estado do alvo num instante. */
export interface EstadoAlvo {
  posicao: Vec3;
  velocidade: Vec3;
  /** Rotação do casco em torno do eixo vertical. */
  guinada: number;
}

/** Estado de quem atira. O movimento próprio é metade do problema. */
export interface EstadoAtirador {
  posicao: Vec3;
  velocidade: Vec3;
  /** Direção da mira. */
  mira: Vec3;
}

export interface SolucaoDeTiro {
  /** Tempo de voo até o alvo. */
  tempoVoo: number;
  /**
   * Antecipação necessária, em mrad, decomposta.
   * Com estabilizador, `vertical` tende a zero e `horizontal` é
   * onde o tiro se ganha ou se perde.
   */
  leadHorizontalMrad: number;
  leadVerticalMrad: number;
  /** Queda do projétil no trajeto, em metros. */
  quedaM: number;
  /** Velocidade lateral relativa que gerou o lead. */
  velocidadeLateralRelativa: number;
}

export type ResultadoImpacto =
  | { tipo: 'errou'; erroHorizontalMrad: number; erroVerticalMrad: number }
  | { tipo: 'ricochete'; placaId: string; anguloImpacto: number }
  | { tipo: 'nao-penetrou'; placaId: string; espessuraEfetivaMm: number; penetracaoMm: number }
  | {
      tipo: 'penetrou';
      placaId: string;
      espessuraEfetivaMm: number;
      penetracaoMm: number;
      modulosAtingidos: string[];
      valor: number;
    };

/** Uma tentativa registrada. É daqui que sai a curva de evolução. */
export interface RegistroTiro {
  timestamp: number;
  modo: 'lead' | 'ponto-fraco' | 'tracking';
  distancia: number;
  municao: string;
  /** Erro do jogador em relação à solução ideal. */
  erroHorizontalMrad: number;
  erroVerticalMrad: number;
  /** Tempo entre o alvo aparecer e o disparo. */
  tempoAteDisparo: number;
  resultado: ResultadoImpacto;
}
