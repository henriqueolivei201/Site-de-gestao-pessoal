# TODO - Estatísticas + Expiração Metas

**Plano Aprovado:**

**Informações Reunidas:**
- Sidebar atual: Diário/Semanal/Anual + Dark toggle
- Metas persistem localStorage por período
- Modal nova meta funcional

**Plano:**
1. **index.html**: 
   - Sidebar: + '📊 Estatísticas'
   - Nova section #secao-estatisticas (canvas gráfico)
2. **script.js**:
   - Nova nav 'estatisticas'
   - Model meta: dataCriacao, prazoDias (1/7/365), historico cumprimento
   - Status expiração todas metas (badge Vencida/Ativa)
   - Gráfico eficiência: canvas line chart 30/100 dias % cumprimento
   - Stats: total/concluídas/eficiência por período
3. **style.css**: Stats section, canvas, badges status
4. Teste + completion

**Dependentes:** index.html, script.js, style.css

**Follow-up:** Instalar Chart.js? (CDN simples)
