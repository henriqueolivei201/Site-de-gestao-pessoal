# TODO - Ajuste Lógica de Pontuação (Confirmar Dia)

- [ ] Criar função `obterFatorPunicao(scoreAtual)` (se não existir) ou localizar a versão já criada.
- [ ] Ajustar loop do clique em `#btn-confirmar-dia` para:
  - [ ] Capturar `tipo` da meta via `tarefa.dataset.tipo` (ou equivalente no DOM atual).
  - [ ] Verificar status da resposta (Sim/Não) via `tarefa.dataset.concluida`.
  - [ ] Aplicar pesos `diaria:1, semanal:7, mensal:30, anual:365`.
  - [ ] Ao responder `Não`, multiplicar a perda com `obterFatorPunicao(scoreAtual)`.
- [ ] Garantir que semanal/mensal/ anual deixem de ser ignoradas no cálculo/atualização de pontuação.
- [ ] Testar fluxos: marcar diário, semanal, mensal, anual como Sim e como Não.

