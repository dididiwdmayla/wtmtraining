import * as THREE from 'three';
import {
  avancarProjetil,
  criarProjetil,
  norma,
  resolverImpacto,
  sub,
  tempoDeVoo,
} from '../core/index.js';
import type { Ammo, EstadoProjetil, ResultadoImpacto, Veiculo, Vec3 } from '../core/index.js';

export interface Marca {
  /** Superfície visível onde o furo aparece. */
  objeto: THREE.Object3D;
  ponto: THREE.Vector3;
  normal: THREE.Vector3;
}

export interface ImpactoDetectado {
  resultado: ResultadoImpacto;
  /** m, da boca do cano ao ponto de impacto. */
  distancia: number;
  marca: Marca | null;
}

export interface ProjetilRenderizado {
  /** Traçante que a cena adiciona e remove. */
  objeto: THREE.Object3D;
  /** Avança uma vez; só retorna impacto depois de cruzar uma placa. */
  atualizar(dt: number): ImpactoDetectado | 'errou' | null;
  destruir(): void;
}

type AlvoDoTiro = {
  group: THREE.Object3D;
  placas: THREE.Object3D;
  caixas: THREE.Object3D;
};

const raycaster = new THREE.Raycaster();
const inversa = new THREE.Quaternion();

/**
 * Distância da boca do cano até o alvo ao longo da linha de tiro.
 * `null` quando a linha não cruza nada — a retícula então flutua na
 * distância de referência.
 */
export function distanciaNaLinha(
  origem: THREE.Vector3,
  direcao: THREE.Vector3,
  placas: THREE.Object3D,
): number | null {
  raycaster.set(origem, direcao);
  raycaster.far = Infinity;
  const acertos = raycaster.intersectObject(placas, true);
  return acertos.length > 0 ? acertos[0].distance : null;
}

/**
 * Disparo encenado pela render, mas calculado pelo núcleo.
 *
 * A camada de render só converte vetores entre three.js e `Vec3`, desenha o
 * traçante e consulta a geometria da placa. Posição, velocidade herdada,
 * arrasto, gravidade e tempo de voo vêm todos de `src/core`.
 */
export function criarProjetilRenderizado(
  origem: THREE.Vector3,
  direcao: THREE.Vector3,
  velocidadeAtirador: THREE.Vector3,
  alvo: AlvoDoTiro,
  veiculo: Veiculo,
  municao: Ammo,
): ProjetilRenderizado {
  let projetil = criarProjetil(
    paraNucleo(origem),
    paraNucleo(direcao),
    paraNucleo(velocidadeAtirador),
    municao,
  );
  const tracante = criarTracante(origem);
  const centroAlvo = alvo.group.getWorldPosition(new THREE.Vector3());
  const distanciaDeReferencia = norma(sub(paraNucleo(centroAlvo), paraNucleo(origem)));
  const limiteDeVoo = tempoDeVoo(distanciaDeReferencia, municao);
  let encerrado = false;

  return {
    objeto: tracante.objeto,

    atualizar(dt) {
      if (encerrado || dt <= 0) return null;

      const anterior = projetil;
      projetil = avancarProjetil(projetil, municao, dt);

      const inicio = paraThree(anterior.posicao);
      const fim = paraThree(projetil.posicao);
      tracante.atualizar(inicio, fim);

      const segmento = fim.clone().sub(inicio);
      const comprimento = segmento.length();
      if (comprimento > 0) {
        const direcaoDoSegmento = segmento.multiplyScalar(1 / comprimento);
        const impacto = detectarImpacto(
          inicio,
          direcaoDoSegmento,
          comprimento,
          anterior,
          projetil,
          alvo,
          veiculo,
          municao,
        );
        if (impacto) {
          encerrado = true;
          return impacto;
        }
      }

      // Não existe resultado instantâneo: até um erro fica em cena durante
      // o tempo de voo que o núcleo calculou para aquela distância.
      if (projetil.tempoVoo >= limiteDeVoo) {
        encerrado = true;
        return 'errou';
      }

      return null;
    },

    destruir() {
      encerrado = true;
      tracante.destruir();
    },
  };
}

/**
 * A colisão é contínua no segmento entre dois estados do núcleo: assim uma
 * flecha não atravessa uma placa mesmo quando o frame avança dezenas de m.
 */
function detectarImpacto(
  origem: THREE.Vector3,
  direcao: THREE.Vector3,
  alcance: number,
  anterior: EstadoProjetil,
  projetil: EstadoProjetil,
  alvo: AlvoDoTiro,
  veiculo: Veiculo,
  municao: Ammo,
): ImpactoDetectado | null {
  raycaster.set(origem, direcao);
  raycaster.far = alcance;
  const acertos = raycaster.intersectObject(alvo.placas, true);
  const acerto = acertos[0];
  if (!acerto) return null;

  const placa = veiculo.placas.find((p) => p.id === acerto.object.name);
  if (!placa) return null;

  const pontoLocal = alvo.group.worldToLocal(acerto.point.clone());
  alvo.group.getWorldQuaternion(inversa).invert();
  const direcaoDeImpacto = paraThree(projetil.velocidade).applyQuaternion(inversa).normalize();
  const distancia = anterior.distanciaPercorrida + acerto.distance;
  const resultado = resolverImpacto(
    placa,
    paraNucleo(pontoLocal),
    paraNucleo(direcaoDeImpacto),
    distancia,
    municao,
    veiculo,
  );

  return {
    resultado,
    distancia,
    marca: marcaNaCaixa(alvo.caixas, origem, direcao, acerto.distance),
  };
}

/**
 * A placa atingida está por dentro do caixote, então o furo tem que nascer na
 * superfície que o jogador enxerga — no mesmo segmento que atingiu a placa.
 */
function marcaNaCaixa(
  caixas: THREE.Object3D,
  origem: THREE.Vector3,
  direcao: THREE.Vector3,
  alcance: number,
): Marca | null {
  raycaster.set(origem, direcao);
  raycaster.far = alcance;
  const acertos = raycaster.intersectObject(caixas, true);
  const acerto = acertos.find((a) => a.face);
  if (!acerto || !acerto.face) return null;
  const normal = acerto.face.normal
    .clone()
    .applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(acerto.object.matrixWorld))
    .normalize();
  return { objeto: acerto.object, ponto: acerto.point.clone(), normal };
}

/** Traço curto e ponto luminoso: aparência apenas, sem regra balística. */
function criarTracante(posicao: THREE.Vector3): {
  objeto: THREE.Group;
  atualizar(inicio: THREE.Vector3, fim: THREE.Vector3): void;
  destruir(): void;
} {
  const objeto = new THREE.Group();
  objeto.name = 'tracante';

  const geometriaLinha = new THREE.BufferGeometry();
  const posicoes = new THREE.BufferAttribute(new Float32Array(6), 3);
  geometriaLinha.setAttribute('position', posicoes);
  const materialLinha = new THREE.LineBasicMaterial({
    color: 0xffd27a,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
  });
  const linha = new THREE.Line(geometriaLinha, materialLinha);
  linha.frustumCulled = false;
  objeto.add(linha);

  const geometriaPonto = new THREE.SphereGeometry(0.35, 8, 8);
  const materialPonto = new THREE.MeshBasicMaterial({ color: 0xfff1ba, depthTest: false });
  const ponto = new THREE.Mesh(geometriaPonto, materialPonto);
  ponto.frustumCulled = false;
  ponto.position.copy(posicao);
  objeto.add(ponto);

  return {
    objeto,
    atualizar(inicio, fim) {
      posicoes.setXYZ(0, inicio.x, inicio.y, inicio.z);
      posicoes.setXYZ(1, fim.x, fim.y, fim.z);
      posicoes.needsUpdate = true;
      ponto.position.copy(fim);
    },
    destruir() {
      geometriaLinha.dispose();
      materialLinha.dispose();
      geometriaPonto.dispose();
      materialPonto.dispose();
    },
  };
}

const paraNucleo = (v: THREE.Vector3): Vec3 => ({ x: v.x, y: v.y, z: v.z });
const paraThree = (v: Vec3): THREE.Vector3 => new THREE.Vector3(v.x, v.y, v.z);
