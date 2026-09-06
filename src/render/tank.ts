import * as THREE from 'three';
import type { Veiculo } from '../core/index.js';
import { caixasDoVeiculo } from './boxes.js';
import { criarCaixa, criarCano } from './vehicle.js';

const GRAUS = Math.PI / 180;

const COR_CASCO = 0x44513a;
const COR_TORRE = 0x4f5c44;

/**
 * Ergonomia da torre, vinda de `data/controles.json`. O teto de
 * velocidade angular é do veículo; isto aqui é o quanto o comando pode
 * correr na frente dela.
 */
export interface ControleTorre {
  pendenciaMaxGraus: number;
}

/** O que o jogador pede num quadro. Ângulos em radianos. */
export interface ComandoBlindado {
  /** -1 (ré) a 1 (frente). Zero é soltar o acelerador. */
  acelerador: number;
  /** -1 (esquerda) a 1 (direita), giro do casco sobre o próprio eixo. */
  direcao: number;
  /** Delta pedido para a guinada da torre neste quadro, no mundo. */
  guinadaTorre: number;
  /** Delta pedido para a elevação do canhão neste quadro. */
  elevacao: number;
}

export interface EstadoBlindado {
  /** m/s, positiva à frente. */
  velocidade: number;
  /** rad, guinada do casco no mundo. */
  guinadaCasco: number;
  /** rad, guinada da torre no mundo — independente do casco. */
  guinadaTorre: number;
  /** rad, positiva para cima. */
  elevacao: number;
}

export interface Blindado {
  /** Casco: raiz da hierarquia, presa ao plano do chão. */
  casco: THREE.Group;
  /** Torre: filha do casco, com guinada própria. */
  torre: THREE.Group;
  /** Canhão: filho da torre, só eleva e deprime. */
  canhao: THREE.Group;
  /** Boca do cano. É daqui que todo tiro parte, em qualquer câmera. */
  boca: THREE.Object3D;
  estado: Readonly<EstadoBlindado>;
  atualizar(dt: number, comando: ComandoBlindado): void;
  /** Origem e direção do tiro, em coordenadas de mundo. */
  linhaDeTiro(origem: THREE.Vector3, direcao: THREE.Vector3): void;
}

/**
 * Modelo de dois corpos.
 *
 * O casco anda no chão e gira com velocidade angular limitada. A torre
 * é filha dele na hierarquia, mas a guinada que o jogador comanda é a
 * do MUNDO: quando o casco vira, a torre não vira junto, o ângulo
 * relativo é que muda. Sem isso não existe treino de mira — a mira
 * andaria sozinha toda vez que o casco corrigisse a direção.
 */
export function criarBlindado(
  veiculo: Veiculo,
  inicial: { x: number; z: number; guinada: number },
  controle: ControleTorre,
): Blindado {
  const envelopes = caixasDoVeiculo(veiculo);
  // Teto do que a mira pode ficar "devendo" ao dedo. Sem ele, um
  // arrasto rápido acumula meia volta e a torre segue girando sozinha
  // depois que o dedo parou — isso, sim, é atraso entre dedo e imagem.
  const pendenciaMax = controle.pendenciaMaxGraus * GRAUS;

  const casco = new THREE.Group();
  casco.name = 'casco';
  casco.position.set(inicial.x, 0, inicial.z);
  casco.rotation.y = inicial.guinada;
  casco.add(criarCaixa(envelopes.casco, COR_CASCO, 'caixa-casco'));

  // O eixo de guinada da torre passa pelo centro da própria torre.
  const torre = new THREE.Group();
  torre.name = 'torre';
  torre.position.set(0, 0, envelopes.torre.centro.z);
  torre.add(
    criarCaixa(
      {
        centro: new THREE.Vector3(envelopes.torre.centro.x, envelopes.torre.centro.y, 0),
        tamanho: envelopes.torre.tamanho,
      },
      COR_TORRE,
      'caixa-torre',
    ),
  );
  casco.add(torre);

  const canhao = new THREE.Group();
  canhao.name = 'canhao';
  canhao.position.set(
    veiculo.canhao.pivo.x,
    veiculo.canhao.pivo.y,
    veiculo.canhao.pivo.z - envelopes.torre.centro.z,
  );
  canhao.add(criarCano(veiculo.canhao));
  torre.add(canhao);

  const boca = new THREE.Object3D();
  boca.name = 'boca';
  boca.position.set(0, 0, veiculo.canhao.comprimento);
  canhao.add(boca);

  const dinamica = veiculo.dinamica;
  const elevacaoMax = veiculo.canhao.elevacaoMaxGraus * GRAUS;
  const depressaoMax = veiculo.canhao.depressaoMaxGraus * GRAUS;

  const estado: EstadoBlindado = {
    velocidade: 0,
    guinadaCasco: inicial.guinada,
    guinadaTorre: inicial.guinada,
    elevacao: 0,
  };
  let guinadaPedida = inicial.guinada;
  let elevacaoPedida = 0;

  casco.updateMatrixWorld(true);

  return {
    casco,
    torre,
    canhao,
    boca,
    estado,

    atualizar(dt, comando) {
      // --- casco: anda e gira no plano do chão, nunca sai dele ---
      const alvoVelocidade =
        comando.acelerador >= 0
          ? comando.acelerador * dinamica.velocidadeMax
          : comando.acelerador * dinamica.velocidadeMaxRe;
      const taxa = escolherTaxa(estado.velocidade, alvoVelocidade, dinamica);
      estado.velocidade = aproximar(estado.velocidade, alvoVelocidade, taxa * dt);

      estado.guinadaCasco -= comando.direcao * dinamica.guinadaGrausPorS * GRAUS * dt;
      const avanco = estado.velocidade * dt;
      casco.position.x += Math.sin(estado.guinadaCasco) * avanco;
      casco.position.z += Math.cos(estado.guinadaCasco) * avanco;
      casco.position.y = 0;
      casco.rotation.y = estado.guinadaCasco;

      // --- torre: guinada de mundo, com teto de velocidade ---
      guinadaPedida =
        estado.guinadaTorre +
        travar(
          diferencaAngular(guinadaPedida + comando.guinadaTorre, estado.guinadaTorre),
          pendenciaMax,
        );
      const passoTorre = veiculo.torre.guinadaGrausPorS * GRAUS * dt;
      estado.guinadaTorre += travar(diferencaAngular(guinadaPedida, estado.guinadaTorre), passoTorre);
      // O relativo é consequência: o casco virou, a mira ficou onde estava.
      torre.rotation.y = diferencaAngular(estado.guinadaTorre, estado.guinadaCasco);

      // --- canhão: só elevação e depressão, dentro do limite do veículo ---
      elevacaoPedida = Math.min(
        elevacaoMax,
        Math.max(-depressaoMax, elevacaoPedida + comando.elevacao),
      );
      const passoCanhao = veiculo.canhao.grausPorS * GRAUS * dt;
      estado.elevacao += travar(elevacaoPedida - estado.elevacao, passoCanhao);
      canhao.rotation.x = -estado.elevacao;

      casco.updateMatrixWorld(true);
    },

    linhaDeTiro(origem, direcao) {
      boca.getWorldPosition(origem);
      direcao.set(0, 0, 1).applyQuaternion(boca.getWorldQuaternion(new THREE.Quaternion()));
    },
  };
}

function escolherTaxa(
  velocidade: number,
  alvo: number,
  dinamica: Veiculo['dinamica'],
): number {
  if (alvo === 0) return dinamica.atrito;
  if (velocidade !== 0 && Math.sign(alvo) !== Math.sign(velocidade)) return dinamica.frenagem;
  return Math.abs(alvo) > Math.abs(velocidade) ? dinamica.aceleracao : dinamica.frenagem;
}

const aproximar = (atual: number, alvo: number, passo: number): number =>
  atual + travar(alvo - atual, passo);

const travar = (valor: number, limite: number): number =>
  Math.max(-limite, Math.min(limite, valor));

/** Diferença de ângulos dobrada para (-π, π]. */
function diferencaAngular(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
