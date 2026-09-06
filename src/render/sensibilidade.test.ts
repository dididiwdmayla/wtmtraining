import { describe, expect, it } from 'vitest';
import {
  anguloDoArraste,
  diagonaisPorSegundo,
  ganhoDeVelocidade,
  multiplicadorDeZoom,
  radianosPorPixel,
  type AjustesDeMira,
  type CurvaDeGanho,
  type DimensaoTela,
  type LimitesZoom,
} from './sensibilidade.js';

const GRAUS = Math.PI / 180;
const graus = (rad: number) => rad / GRAUS;

const PAISAGEM: DimensaoTela = { largura: 852, altura: 393 };
const RETRATO: DimensaoTela = { largura: 393, altura: 852 };
const QUADRADA: DimensaoTela = { largura: 600, altura: 600 };

const CURVA: CurvaDeGanho = {
  maximo: 3,
  lentaDiagonaisPorS: 0.08,
  rapidaDiagonaisPorS: 1.8,
  expoente: 1.6,
};

const ZOOM: LimitesZoom = { fovMaxGraus: 12, fovMinGraus: 1.5 };

/** Curva desligada: isola a geometria do ganho por velocidade. */
const SEM_CURVA: AjustesDeMira = {
  sensibilidadeBase: 1,
  intensidadeGanho: 0,
  multiplicadorZoomMax: 1,
};

/** FOV horizontal que o three.js mostra para um FOV vertical e uma tela. */
const fovHorizontal = (fovVerticalGraus: number, tela: DimensaoTela) =>
  graus(2 * Math.atan(Math.tan((fovVerticalGraus * GRAUS) / 2) * (tela.largura / tela.altura)));

const arrastar = (
  dx: number,
  dy: number,
  tela: DimensaoTela,
  fovGraus: number,
  ajustes: AjustesDeMira = SEM_CURVA,
  velocidadePxS = 0,
) =>
  anguloDoArraste({
    dx,
    dy,
    velocidadePxS,
    fovAtivoGraus: fovGraus,
    tela,
    curva: CURVA,
    zoom: ZOOM,
    razaoVertical: 1,
    ajustes,
  });

describe('ângulo por pixel — cada eixo pela sua dimensão', () => {
  it('cruzar a largura inteira gira o FOV HORIZONTAL, não o vertical', () => {
    for (const tela of [PAISAGEM, RETRATO, QUADRADA]) {
      const { guinada } = arrastar(tela.largura, 0, tela, 55);
      expect(graus(Math.abs(guinada))).toBeCloseTo(fovHorizontal(55, tela), 6);
    }
  });

  it('cruzar a altura inteira gira o FOV VERTICAL', () => {
    for (const tela of [PAISAGEM, RETRATO, QUADRADA]) {
      const { elevacao } = arrastar(0, -tela.altura, tela, 55);
      expect(graus(Math.abs(elevacao))).toBeCloseTo(55, 6);
    }
  });

  it('numa tela quadrada os dois eixos coincidem; numa deitada, não', () => {
    const quadrada = radianosPorPixel(55, QUADRADA);
    expect(quadrada.x).toBeCloseTo(quadrada.y, 12);

    const deitada = radianosPorPixel(55, PAISAGEM);
    // Em paisagem a tela mostra mais ângulo por pixel na horizontal.
    expect(deitada.x).toBeGreaterThan(deitada.y * 0.7);
    expect(radianosPorPixel(55, RETRATO).x).toBeLessThan(deitada.x);
  });
});

describe('invariância de orientação — o requisito', () => {
  it('o mesmo deslocamento ANGULAR do dedo gira o mesmo tanto em pé ou deitado', () => {
    // Dez graus de tela percorridos em cada orientação: em paisagem
    // isso são muito mais pixels que em retrato, porque o FOV
    // horizontal é muito maior. A rotação tem que sair igual.
    const alvoGraus = 10;
    const pixels = (tela: DimensaoTela) => alvoGraus / radianosPorPixel(55, tela).x / (1 / GRAUS);

    const deitado = arrastar(pixels(PAISAGEM), 0, PAISAGEM, 55);
    const emPe = arrastar(pixels(RETRATO), 0, RETRATO, 55);

    expect(graus(Math.abs(deitado.guinada))).toBeCloseTo(alvoGraus, 6);
    expect(graus(Math.abs(emPe.guinada))).toBeCloseTo(alvoGraus, 6);
  });

  it('a mesma fração de tela gira a mesma fração do FOV daquele eixo', () => {
    for (const tela of [PAISAGEM, RETRATO]) {
      const { guinada } = arrastar(tela.largura * 0.25, 0, tela, 55);
      expect(graus(Math.abs(guinada))).toBeCloseTo(fovHorizontal(55, tela) * 0.25, 6);
    }
  });

  it('a velocidade do dedo cai no mesmo ponto da curva nas duas orientações', () => {
    // A diagonal é a única dimensão que não muda quando o aparelho gira.
    expect(diagonaisPorSegundo(900, PAISAGEM)).toBeCloseTo(
      diagonaisPorSegundo(900, RETRATO),
      12,
    );
  });
});

describe('independência de taxa de quadros', () => {
  it('um arraste partido em N amostras soma o mesmo que em uma só', () => {
    const total = 240;
    const inteiro = arrastar(total, 0, PAISAGEM, 55);

    for (const n of [2, 4, 8, 30, 120]) {
      let soma = 0;
      for (let i = 0; i < n; i++) soma += arrastar(total / n, 0, PAISAGEM, 55).guinada;
      expect(soma).toBeCloseTo(inteiro.guinada, 12);
    }
  });

  it('com a curva ligada, a velocidade medida é que manda — não o número de amostras', () => {
    // Mesma velocidade de dedo, mesmo deslocamento total, número de
    // amostras diferente: o ângulo tem que bater. É isto que faz o
    // resultado não variar entre 30, 60 e 120 Hz.
    const ajustes: AjustesDeMira = { ...SEM_CURVA, intensidadeGanho: 1 };
    const velocidade = 700;
    const total = 240;

    const inteiro = arrastar(total, 0, PAISAGEM, 55, ajustes, velocidade).guinada;
    for (const n of [3, 12, 60]) {
      let soma = 0;
      for (let i = 0; i < n; i++) {
        soma += arrastar(total / n, 0, PAISAGEM, 55, ajustes, velocidade).guinada;
      }
      expect(soma).toBeCloseTo(inteiro, 12);
    }
  });
});

describe('curva de ganho por velocidade', () => {
  it('vale 1 no dedo lento e `maximo` no dedo rápido', () => {
    expect(ganhoDeVelocidade(CURVA, 0, 1)).toBeCloseTo(1, 12);
    expect(ganhoDeVelocidade(CURVA, CURVA.lentaDiagonaisPorS, 1)).toBeCloseTo(1, 12);
    expect(ganhoDeVelocidade(CURVA, CURVA.rapidaDiagonaisPorS, 1)).toBeCloseTo(CURVA.maximo, 12);
    expect(ganhoDeVelocidade(CURVA, 99, 1)).toBeCloseTo(CURVA.maximo, 12);
  });

  it('é contínua e monótona: nenhum degrau, nenhum modo escondido', () => {
    let anterior = 0;
    for (let v = 0; v <= 2; v += 0.02) {
      const g = ganhoDeVelocidade(CURVA, v, 1);
      expect(g).toBeGreaterThanOrEqual(anterior - 1e-12);
      anterior = g;
    }
  });

  it('intensidade 0 desliga a curva inteira', () => {
    for (const v of [0, 0.5, 1, 5]) {
      expect(ganhoDeVelocidade(CURVA, v, 0)).toBeCloseTo(1, 12);
    }
  });

  it('intensidade intermediária fica entre os dois extremos', () => {
    const cheio = ganhoDeVelocidade(CURVA, 1.8, 1);
    const meio = ganhoDeVelocidade(CURVA, 1.8, 0.5);
    expect(meio).toBeGreaterThan(1);
    expect(meio).toBeLessThan(cheio);
  });
});

describe('multiplicador de zoom', () => {
  it('não faz nada no FOV mais aberto e vale o pedido no mais fechado', () => {
    expect(multiplicadorDeZoom(ZOOM.fovMaxGraus, ZOOM, 2.5)).toBeCloseTo(1, 12);
    expect(multiplicadorDeZoom(ZOOM.fovMinGraus, ZOOM, 2.5)).toBeCloseTo(2.5, 12);
  });

  it('some em terceira pessoa, cujo FOV é maior que o teto da mira', () => {
    expect(multiplicadorDeZoom(55, ZOOM, 4)).toBeCloseTo(1, 12);
  });

  it('vale 1 em qualquer zoom quando o ajuste é 1', () => {
    for (const fov of [12, 8, 4, 1.5]) {
      expect(multiplicadorDeZoom(fov, ZOOM, 1)).toBeCloseTo(1, 12);
    }
  });
});

describe('escala pelo FOV da câmera ativa', () => {
  it('fechar o zoom pela metade derruba o ângulo por pixel pela metade', () => {
    const aberto = radianosPorPixel(12, PAISAGEM);
    const fechado = radianosPorPixel(6, PAISAGEM);
    expect(aberto.x / fechado.x).toBeCloseTo(2, 1);
    expect(aberto.y / fechado.y).toBeCloseTo(2, 1);
  });

  it('a mira fechada é muito mais fina que a terceira pessoa', () => {
    const terceira = arrastar(100, 0, PAISAGEM, 55).guinada;
    const mira = arrastar(100, 0, PAISAGEM, 1.5).guinada;
    expect(Math.abs(mira)).toBeLessThan(Math.abs(terceira) / 20);
  });
});

describe('sinal do comando', () => {
  it('dedo para a direita gira para a direita; dedo para cima levanta o cano', () => {
    // Guinada negativa é giro à direita no referencial do three.js.
    expect(arrastar(50, 0, PAISAGEM, 55).guinada).toBeLessThan(0);
    expect(arrastar(-50, 0, PAISAGEM, 55).guinada).toBeGreaterThan(0);
    expect(arrastar(0, -50, PAISAGEM, 55).elevacao).toBeGreaterThan(0);
    expect(arrastar(0, 50, PAISAGEM, 55).elevacao).toBeLessThan(0);
  });
});

describe('bordas', () => {
  it('tela degenerada não vira NaN nem divisão por zero', () => {
    const zerada = radianosPorPixel(55, { largura: 0, altura: 0 });
    expect(zerada.x).toBe(0);
    expect(zerada.y).toBe(0);
    expect(diagonaisPorSegundo(500, { largura: 0, altura: 0 })).toBe(0);
    const angulo = arrastar(10, 10, { largura: 0, altura: 0 }, 55);
    expect(Number.isFinite(angulo.guinada)).toBe(true);
    expect(Number.isFinite(angulo.elevacao)).toBe(true);
  });

  it('sensibilidade negativa não inverte o comando', () => {
    const angulo = arrastar(50, 0, PAISAGEM, 55, {
      ...SEM_CURVA,
      sensibilidadeBase: -3,
    });
    expect(angulo.guinada).toBe(-0);
  });
});
