# TODO - Fix Gráfico Semanal ✅ CONCLUÍDO

Status: ✅ Completo

## Resumo das Correções:

✅ **1.** Added `getTaskStatus()` helper - checks both storages
✅ **2.** `gerarJanela10Dias(taskId, meta)` & `gerarJanela4Semanas(taskId, meta)` now use cyclic fallback for weekly
✅ **3.** `renderIndividualCharts()` passes `meta` correctly  
✅ **4.** Logic verified: weekly checklist data now flows to stats graphs
✅ **5.** No structural changes - pure data flow fix

**Teste:** 
1. Crie meta semanal
2. Vá Calendário → marque ✓ na tarefa cíclica
3. Vá Estatísticas → gráfico individual da meta semanal agora mostra dados!

**Problema identificado e corrigido:** Dados iam para `ciclicas_tarefas_dia[cyc_ID]` mas gráficos liam `calendario_tarefas_dia[simple_ID]` → mismatch resolvido.
