# ✅ Ajustes Gráficos - Cards Individuais

## 📋 **Plano de implementação:**

**Informações coletadas (script.js):**
- `renderIndividualCharts`: Chama `gerarJanela10Dias` (diário) | `gerarJanela4Semanas` (semanal)
- `gerarJanela4Semanas`: Offsets fixos [21,14,7,0] dias ← **ERRADO**
- `getTaskStatus`: Compatível com cíclico via `isWeekly + meta`
- Mensal já incluso em `allGoals`

**Plano detalhado:**
```
1. Criar gerarJanelaCicloReal(meta, numCiclos):
   ├── Calcula dataCriacao da meta
   ├── Gera N ciclos recorrentes ANTES da data atual
   ├── Ex: Semanal criada sáb(2): [sáb(-21),sáb(-14),sáb(-7),sáb(2)]
   └── Usa getTaskStatus com fallback cíclico
   
2. Atualizar renderIndividualCharts:
   ├── if view=='diario': gerarJanela10Dias (10d fixo ✓)
   ├── if view=='semanal': gerarJanelaCicloReal(meta, 4) 
   └── if view=='mensal':  gerarJanelaCicloReal(meta, 4) 
   
3. gerarJanela4Semanas → DEPRECATED (remove)

**Dependências:** getTaskStatus (já compatível)
**Followup:** Testar com meta semanal/mensal + marcar calendário → flip card correto
```

**Confirma este plano antes de editar?**
