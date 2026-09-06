import { describe, expect, it } from 'vitest';
import {
  avancarProjetil,
  criarProjetil,
  paraMrad,
  penetracaoNaDistancia,
  queda,
  solucaoDeTiro,
  tempoDeVoo,
} from './ballistics.js';
import { anguloDeImpacto, espessuraEfetiva, raioCaixa, ricocheteou } from './armor.js';
import type { Ammo, EstadoAlvo, EstadoAtirador } from './types.js';

const flecha: Ammo = {
  id: 'apfsds-teste',
  nome: 'APFSDS de teste',
  tipo: 'APFSDS',
  v0: 1600,
  arrasto: 0.00005,
  normalizacaoGraus: 5,
  ricocheteGraus: 80,
  penetracao: [
    [10, 560],
    [1000, 530],
    [2000, 500],
  ],
};

const missil: Ammo = {
  id: 'atgm-teste',
  nome: 'Míssil de teste',
  tipo: 'ATGM',
  v0: 350,
  arrasto: 0,
  aceleracao: 200,
  normalizacaoGraus: 0,
  ricocheteGraus: 88,
  penetracao: [[10, 600]],
};

const parado: EstadoAtirador = {
  posicao: { x: 0, y: 0, z: 0 },
  velocidade: { x: 0, y: 0, z: 0 },
  mira: { x: 0, y: 0, z: 1 },
};

describe('tempo de voo', () => {
  it('cresce com a distância', () => {
    expect(tempoDeVoo(2000, flecha)).toBeGreaterThan(tempoDeVoo(1000, flecha));
  });

  it('fica perto de distância/v0 e um pouco acima, por causa do arrasto', () => {
    const t = tempoDeVoo(1000, flecha);
    const ideal = 1000 / flecha.v0;
    expect(t).toBeGreaterThan(ideal);
    expect(t).toBeLessThan(ideal * 1.3);
  });

  it('míssil é muito mais lento que flecha', () => {
    expect(tempoDeVoo(1000, missil)).toBeGreaterThan(tempoDeVoo(1000, flecha) * 3);
  });
});

describe('queda', () => {
  it('míssil guiado não cai', () => {
    expect(queda(3, missil)).toBe(0);
  });

  it('flecha cai proporcional ao quadrado do tempo', () => {
    expect(queda(1, flecha)).toBeCloseTo(4.905, 3);
    expect(queda(2, flecha)).toBeCloseTo(19.62, 2);
  });
});

describe('solução de tiro — o coração do treino', () => {
  const alvoCruzando: EstadoAlvo = {
    posicao: { x: 0, y: 0, z: 1000 },
    velocidade: { x: 10, y: 0, z: 0 },
    guinada: 0,
  };

  it('alvo cruzando exige lead horizontal', () => {
    const s = solucaoDeTiro(parado, alvoCruzando, flecha);
    expect(Math.abs(s.leadHorizontalMrad)).toBeGreaterThan(1);
  });

  it('alvo indo direto para você não exige lead horizontal', () => {
    const s = solucaoDeTiro(parado, {
      ...alvoCruzando,
      velocidade: { x: 0, y: 0, z: -10 },
    }, flecha);
    expect(Math.abs(s.leadHorizontalMrad)).toBeLessThan(0.01);
  });

  it('MOVER JUNTO COM O ALVO ZERA O LEAD — este é o teste que importa', () => {
    // Você e o alvo cruzando na mesma direção e velocidade:
    // a velocidade relativa é zero, então não há antecipação nenhuma.
    const atiradorEmMovimento: EstadoAtirador = {
      ...parado,
      velocidade: { x: 10, y: 0, z: 0 },
    };
    const s = solucaoDeTiro(atiradorEmMovimento, alvoCruzando, flecha);
    expect(Math.abs(s.leadHorizontalMrad)).toBeLessThan(0.01);
  });

  it('mover no sentido contrário DOBRA o lead', () => {
    const contrario: EstadoAtirador = { ...parado, velocidade: { x: -10, y: 0, z: 0 } };
    const parado_ = solucaoDeTiro(parado, alvoCruzando, flecha);
    const movendo = solucaoDeTiro(contrario, alvoCruzando, flecha);
    expect(Math.abs(movendo.leadHorizontalMrad)).toBeCloseTo(
      Math.abs(parado_.leadHorizontalMrad) * 2,
      1,
    );
  });

  it('o erro horizontal é o que o estabilizador não resolve', () => {
    const s = solucaoDeTiro(parado, alvoCruzando, flecha);
    // Sem componente vertical de velocidade, a vertical é só queda.
    expect(s.leadVerticalMrad).toBeGreaterThan(0);
    expect(Math.abs(s.leadHorizontalMrad)).toBeGreaterThan(0);
  });

  it('míssil guiado não pede antecipação do jogador', () => {
    const s = solucaoDeTiro(parado, alvoCruzando, missil);
    expect(s.leadHorizontalMrad).toBe(0);
  });
});

describe('trajetória real do projétil', () => {
  it('herda o movimento lateral do casco durante todo o voo', () => {
    // Este teste não olha só o lead calculado: avança a flecha como a render
    // faz. Com o cano exatamente no centro de um alvo parado, a flecha passa
    // à direita porque saiu com os 14 m/s do casco.
    const atiradorLateral: EstadoAtirador = {
      ...parado,
      velocidade: { x: 14, y: 0, z: 0 },
    };
    const alvoParado: EstadoAlvo = {
      posicao: { x: 0, y: 0, z: 1000 },
      velocidade: { x: 0, y: 0, z: 0 },
      guinada: 0,
    };
    const voo = tempoDeVoo(1000, flecha);
    let projetil = criarProjetil(
      atiradorLateral.posicao,
      atiradorLateral.mira,
      atiradorLateral.velocidade,
      flecha,
    );

    // Cruzar o plano do alvo é o instante do impacto neste cenário simples.
    while (projetil.posicao.z < alvoParado.posicao.z) {
      projetil = avancarProjetil(projetil, flecha, 0.001);
    }

    const deslocamentoEsperado = atiradorLateral.velocidade.x * voo;
    expect(voo).toBeGreaterThan(0.6);
    expect(voo).toBeLessThan(0.7);
    expect(projetil.tempoVoo).toBeCloseTo(voo, 2);
    expect(projetil.posicao.x).toBeGreaterThan(0);
    expect(projetil.posicao.x).toBeGreaterThan(deslocamentoEsperado * 0.97);
    expect(projetil.posicao.x).toBeLessThan(deslocamentoEsperado * 1.01);
    expect(projetil.posicao.z).toBeGreaterThanOrEqual(alvoParado.posicao.z);
  });
});

describe('conversão angular', () => {
  it('1 metro a 1000 metros é ~1 mrad', () => {
    expect(paraMrad(1, 1000)).toBeCloseTo(1, 2);
  });
});

describe('blindagem', () => {
  it('impacto perpendicular é 0 grau', () => {
    expect(anguloDeImpacto({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 })).toBeCloseTo(0, 5);
  });

  it('placa a 60 graus quase dobra a espessura efetiva', () => {
    // Sem normalização, para isolar a geometria.
    expect(espessuraEfetiva(100, 60, 0)).toBeCloseTo(200, 1);
  });

  it('normalização reduz a espessura efetiva', () => {
    expect(espessuraEfetiva(100, 60, 5)).toBeLessThan(espessuraEfetiva(100, 60, 0));
  });

  it('acima do limite, ricocheteia', () => {
    expect(ricocheteou(85, flecha)).toBe(true);
    expect(ricocheteou(70, flecha)).toBe(false);
  });

  it('penetração cai com a distância', () => {
    expect(penetracaoNaDistancia(flecha, 2000)).toBeLessThan(
      penetracaoNaDistancia(flecha, 100),
    );
  });

  it('interpola no meio da curva', () => {
    expect(penetracaoNaDistancia(flecha, 1500)).toBeCloseTo(515, 0);
  });
});

describe('módulos internos', () => {
  it('raio acerta caixa à frente', () => {
    const t = raioCaixa(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 5 },
      { x: 1, y: 1, z: 1 },
    );
    expect(t).toBeCloseTo(4.5, 5);
  });

  it('raio erra caixa deslocada', () => {
    const t = raioCaixa(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 10, y: 0, z: 5 },
      { x: 1, y: 1, z: 1 },
    );
    expect(t).toBeNull();
  });
});
