import * as THREE from 'three';

/**
 * Camada só do clarão. A câmera de terceira pessoa a habilita; a de
 * mira não — ela nasce na raiz do canhão e a labareda, a 5 m à frente,
 * cobriria a tela inteira em qualquer zoom.
 */
export const CAMADA_CLARAO = 1;

const DURACAO_S = 0.08;
const ESCALA_M = 2.6;

export interface Clarao {
  /** Acende no mesmo quadro do disparo. */
  disparar(): void;
  atualizar(dt: number): void;
}

/**
 * Clarão de boca. Sprite aditivo preso ao mesmo objeto de onde o tiro
 * parte — se a boca se move, o clarão vai junto, sem cálculo à parte.
 */
export function criarClarao(boca: THREE.Object3D): Clarao {
  const material = new THREE.SpriteMaterial({
    map: textura(),
    color: 0xffd7a0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0,
  });
  const sprite = new THREE.Sprite(material);
  sprite.name = 'clarao';
  sprite.layers.set(CAMADA_CLARAO);
  sprite.scale.setScalar(ESCALA_M);
  sprite.visible = false;
  boca.add(sprite);

  let restante = 0;

  return {
    disparar() {
      restante = DURACAO_S;
      material.opacity = 1;
      sprite.scale.setScalar(ESCALA_M);
      sprite.visible = true;
    },
    atualizar(dt: number) {
      if (restante <= 0) return;
      restante -= dt;
      if (restante <= 0) {
        sprite.visible = false;
        material.opacity = 0;
        return;
      }
      const t = restante / DURACAO_S;
      material.opacity = t;
      // Cresce enquanto apaga: labareda expandindo, não bola sumindo.
      sprite.scale.setScalar(ESCALA_M * (1.6 - 0.6 * t));
    },
  };
}

/**
 * Textura gerada aqui mesmo: um gradiente radial. Nada de asset externo
 * — a regra do projeto vale para som e imagem do mesmo jeito.
 */
function textura(): THREE.CanvasTexture {
  const lado = 64;
  const canvas = document.createElement('canvas');
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradiente = ctx.createRadialGradient(lado / 2, lado / 2, 0, lado / 2, lado / 2, lado / 2);
    gradiente.addColorStop(0, 'rgba(255,255,240,1)');
    gradiente.addColorStop(0.28, 'rgba(255,214,140,0.85)');
    gradiente.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = gradiente;
    ctx.fillRect(0, 0, lado, lado);
  }
  return new THREE.CanvasTexture(canvas);
}
