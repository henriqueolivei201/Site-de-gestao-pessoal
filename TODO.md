# TODO - Hall da Fama + Eficiência (metas mensais/anual)

- [ ] Implementar helpers para calcular “ciclo atual” e “prazoFinal do ciclo” para metas `mensal` (30d) e `anual` (365d)
- [ ] Ajustar cálculo de eficiência no modal do calendário:
  - [ ] mensal/anual não entram no denominador, exceto no dia do prazoFinal do ciclo
  - [ ] se todas as obrigatórias do dia estiverem concluídas, eficiência = 100% (ignorando resposta/registro de bônus)
  - [ ] se meta mensal/anual já foi concluída antecipadamente no ciclo atual, remover obrigatoriedade naquele dia
- [ ] Atualizar render do checklist no modal com selo:
  - [ ] 🎯 Bônus (dentro do prazo, opcional)
  - [ ] ⚠️ Obrigatória hoje (dia exato do prazoFinal)
  - [ ] selo desaparece/oculta se concluída antecipadamente no ciclo atual
- [ ] Hall da Fama:
  - [ ] contador independente no localStorage por tipo (mensal e anual)
  - [ ] gatilho: completar mensal/anual antes do prazoFinal + dia perfeito confirmado (obrigatórias do dia)
  - [ ] card com título dinâmico: `[X]° Meta [Tipo] concluída antes do prazo + Dia perfeito!`
- [ ] Garantir que gráficos em Estatísticas não mudem layout (apenas computar internamente)
- [ ] Atualizar estilo CSS dos selos
- [ ] Testar manualmente no calendário:
  - [ ] meta mensal concluída antes do prazo não derruba eficiência no dia do prazo
  - [ ] Hall da Fama dispara somente quando “dia perfeito” estiver confirmado

