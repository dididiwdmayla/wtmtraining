import * as THREE from 'three';

const vertexShader = `
varying vec3 vWorldPosition;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const fragmentShader = `
varying vec3 vWorldPosition;
uniform vec3 corTopo;
uniform vec3 corHorizonte;
uniform float alturaLimite;
void main() {
  float h = normalize(vWorldPosition).y;
  float t = clamp(h / alturaLimite, 0.0, 1.0);
  gl_FragColor = vec4(mix(corHorizonte, corTopo, t), 1.0);
}
`;

/** Céu em gradiente por shader: sem textura, uma esfera grande vista de dentro. */
export function createSky(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(5000, 32, 16);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      corTopo: { value: new THREE.Color(0x2f5d8a) },
      corHorizonte: { value: new THREE.Color(0xcbd9df) },
      alturaLimite: { value: 0.55 },
    },
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(geometry, material);
  sky.name = 'ceu';
  return sky;
}
