# TODO - Integração Supabase (tarefas) no calendário/checkbox

- [ ] Atualizar `abrirModalEficiencia(dataKey, dia)` para buscar no Supabase `tarefas` com `.eq('data', dataKey)` e renderizar `.tarefas-lista` a partir do resultado (em vez de localStorage).
- [ ] No render dos itens do modal, armazenar o uuid `tarefas.id` em `dataset.taskId` (ou outro dataset, ex. `data-task-uuid`) para persistir ✓/✗ no Supabase corretamente.
- [ ] Atualizar `handleTaskToggle` para fazer `update({concluida: isCheck}).eq('id', taskUuid)` usando o uuid do item do modal.
- [ ] Adicionar logs conforme pedido:
  - `console.log("Buscando tarefas para a data:", dataSelecionada)`
  - `console.log("Tarefas encontradas:", data)`
  - logar erros da query no console.
- [ ] Atualizar pós-alteração: chamar `renderCalendar()` e `renderEstatisticas()`/`renderIndividualCharts()` quando necessário.
- [ ] Testar: clicar em dias diferentes e confirmar lista do modal aparece e ✓/✗ persiste no Supabase.

