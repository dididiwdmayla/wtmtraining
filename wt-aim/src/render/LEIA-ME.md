# Camada de render

Vazia de propósito. É a primeira tarefa do agente de render.

O que ela pode fazer: desenhar, ouvir toque, mostrar HUD.
O que ela não pode fazer: calcular balística, penetração ou pontuação.
Isso é do núcleo, e o núcleo já está testado.

Primeira entrega sugerida:

1. Construir a malha do veículo a partir de `data/vehicles/*.json`.
   As placas do JSON viram os planos visíveis. Nada de `.glb`.
2. Raycast do toque contra as placas, entregando placa + ponto de
   impacto para `resolverImpacto`.
3. Retícula em SVG, com a marcação de lead em mrad.
