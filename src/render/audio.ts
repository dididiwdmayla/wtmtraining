/**
 * Sons de disparo, um por munição.
 *
 * Web Audio com cada buffer decodificado UMA vez, no carregamento. Cada
 * tiro só cria um BufferSource e chama start(): o custo é de
 * microssegundos e o som sai no mesmo quadro do clarão. Um
 * `new Audio()` por tiro decodifica na hora e o atraso aparece na tela.
 */
export interface Sons {
  /**
   * Toca o som daquela munição. Silencioso — e nunca lança — se o
   * buffer não veio ou o id não existe.
   */
  disparo(id: string): void;
  /**
   * Política de autoplay: o contexto nasce suspenso e só sai disso
   * dentro de um gesto do usuário. Chame no primeiro toque.
   */
  destravar(): void;
  destruir(): void;
}

const VOLUME = 0.85;

/** `fontes` é `{ id da munição: url do mp3 }`. */
export function criarSons(fontes: Record<string, string>): Sons {
  const Contexto: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!Contexto) {
    return { disparo() {}, destravar() {}, destruir() {} };
  }

  const contexto = new Contexto();
  const saida = contexto.createGain();
  saida.gain.value = VOLUME;
  saida.connect(contexto.destination);

  const buffers = new Map<string, AudioBuffer>();

  // Pré-carga: busca e decodifica já, antes do primeiro tiro. O
  // contexto pode estar suspenso — decodificar não depende disso.
  for (const [id, url] of Object.entries(fontes)) {
    void fetch(url)
      .then((resposta) => {
        if (!resposta.ok) throw new Error(`áudio ${url}: ${resposta.status}`);
        return resposta.arrayBuffer();
      })
      .then((dados) => contexto.decodeAudioData(dados))
      .then((decodificado) => {
        buffers.set(id, decodificado);
      })
      .catch((erro) => {
        // Sem som é degradação aceitável; travar o treino não é.
        console.warn(`som de disparo indisponível (${id})`, erro);
      });
  }

  return {
    disparo(id) {
      const buffer = buffers.get(id);
      if (!buffer) return;
      if (contexto.state !== 'running') void contexto.resume();
      const fonte = contexto.createBufferSource();
      fonte.buffer = buffer;
      fonte.connect(saida);
      fonte.start();
    },
    destravar() {
      if (contexto.state !== 'running') void contexto.resume();
    },
    destruir() {
      void contexto.close();
    },
  };
}
