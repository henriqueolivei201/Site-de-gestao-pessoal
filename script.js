// Gestão Pessoal - script.js
// Completo com Estatísticas + Expiração + Gráfico

document.addEventListener('DOMContentLoaded', function() {
    // Chart.js
    const chartCtx = document.getElementById('eficiencia-chart');
    let chartInstance = null;

    // Elementos DOM
    const navItems = document.querySelectorAll('.nav-item');
    const goalsSections = document.querySelectorAll('.goals-section');
    const btnNovaMeta = document.getElementById('btn-nova-meta');
    const dataAtualEl = document.getElementById('data-atual');
    const themeToggle = document.getElementById('theme-toggle');
    
    // Modal
    const modalOverlay = document.getElementById('modal-overlay');
    const metaInput = document.getElementById('meta-input');
    const prioridadeBtns = document.querySelectorAll('.prioridade-btn');
    const btnConfirmar = document.getElementById('btn-confirmar');
    const btnCancelar = document.getElementById('btn-cancelar');
    
    // Stats
    const totalMetasEl = document.getElementById('total-metas');
    const eficienciaEl = document.getElementById('metas-concluidas');
    const diasAtivosEl = document.getElementById('dias-ativos');
    
    // Dark Mode
    const html = document.documentElement;
    const STORAGE_THEME = 'tema-preferido';
    
    // Storage
    const STORAGE_KEYS = {
        diario: 'metas_diario',
        semanal: 'metas_semanal',
        anual: 'metas_anual',
        stats: 'estatisticas_geral'
    };

    let prioridadeSelecionada = 'Média';

    // Prazo por tipo
    const PRAZO_DIAS = {
        diario: 1,
        semanal: 7,
        anual: 365
    };

    // ===== DARK MODE =====
    function initTema() {
        const temaSalvo = localStorage.getItem(STORAGE_THEME);
        const prefereDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (temaSalvo === 'dark' || (!temaSalvo && prefereDark)) {
            html.classList.add('dark-mode');
        }
    }
    
    function toggleTema() {
        html.classList.toggle('dark-mode');
        const isDark = html.classList.contains('dark-mode');
        localStorage.setItem(STORAGE_THEME, isDark ? 'dark' : 'light');
        if (chartInstance) chartInstance.destroy();
        renderEstatisticas();
    }

    // ===== MODAL =====
    prioridadeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            prioridadeSelecionada = btn.dataset.prioridade;
            prioridadeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    function abrirModal() {
        metaInput.value = '';
        metaInput.focus();
        modalOverlay.classList.add('active');
        prioridadeSelecionada = 'Média';
        prioridadeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.prioridade === 'Média'));
    }

    function fecharModal() {
        modalOverlay.classList.remove('active');
    }

    function confirmarMeta() {
        const texto = metaInput.value.trim();
        if (!texto) {
            metaInput.style.borderColor = 'var(--danger)';
            setTimeout(() => metaInput.style.borderColor = '', 2000);
            return;
        }

        const secaoAtiva = document.querySelector('.goals-section.active:not(.stats-section)');
        const listaContainer = secaoAtiva.querySelector('.goals-container');
        const view = secaoAtiva.id.replace('secao-', '');

        const novaMeta = criarElementoMeta(texto, prioridadeSelecionada, view);
        listaContainer.insertBefore(novaMeta, listaContainer.firstChild);
        salvarMeta(view, texto, prioridadeSelecionada);
        atualizarEstatisticas();
        fecharModal();
    }

    // Event listeners
    btnNovaMeta.addEventListener('click', abrirModal);
    btnConfirmar.addEventListener('click', confirmarMeta);
    btnCancelar.addEventListener('click', fecharModal);
    modalOverlay.addEventListener('click', (e) => e.target === modalOverlay && fecharModal());
    metaInput.addEventListener('keypress', (e) => e.key === 'Enter' && confirmarMeta());

// ===== METAS =====
    // Track current view for chart cleanup
    let currentView = 'diario';
    
    // Destroy all charts when leaving statistics section to improve performance
    function destroyAllCharts() {
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
        Object.keys(individualCharts).forEach(id => {
            if (individualCharts[id]) {
                individualCharts[id].destroy();
                individualCharts[id] = null;
            }
        });
    }

    function atualizarDataAtual() {
        const opcoes = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const data = new Date().toLocaleDateString('pt-BR', opcoes);
        dataAtualEl.textContent = `Hoje - ${data}`;
    }

navItems.forEach(item => {
    item.addEventListener('click', () => {
        const view = item.dataset.view;
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        goalsSections.forEach(section => section.classList.remove('active'));
        const targetSection = document.getElementById(`secao-${view}`);
        if (targetSection) targetSection.classList.add('active');
        
        // Mostrar/esconder botão Nova Meta
        if (view === 'estatisticas' || view === 'calendario') {
            btnNovaMeta.style.display = 'none';
        } else {
            btnNovaMeta.style.display = 'block';
        }
        
if (view === 'estatisticas') {
                renderEstatisticas();
            } else if (view === 'calendario') {
                renderCalendar();
            } else {
                carregarMetas(view);
            }
    });
});


    function getPrazoDias(view) {
        return PRAZO_DIAS[view] || 1;
    }

    function isMetaVencida(meta, view) {
        const prazoDias = getPrazoDias(view);
        const dataCriacao = new Date(meta.dataCriacao);
        const hoje = new Date();
        const diasPassados = Math.floor((hoje - dataCriacao) / (1000 * 60 * 60 * 24));
        return diasPassados > prazoDias && !meta.concluida;
    }

    function criarElementoMeta(texto, prioridade, view) {
        const article = document.createElement('article');
        article.className = 'goal-item';
        const vencida = false; // Para novas sempre falsa
        article.innerHTML = `
            <input type="checkbox" class="checkbox-meta" ${false ? 'checked' : ''}>
            <label class="goal-text">${texto}</label>
            <span class="etiqueta-prioridade ${prioridade.toLowerCase()}">${prioridade}</span>
            ${isMetaVencida({dataCriacao: new Date().toISOString()}, view) ? `<span class="status-badge status-vencida">Vencida</span>` : ''}
            <button class="btn-excluir" aria-label="Excluir meta">&times;</button>
        `;
        
        const checkbox = article.querySelector('.checkbox-meta');
        const goalTextEl = article.querySelector('.goal-text');
        const deleteBtn = article.querySelector('.btn-excluir');
        
        checkbox.addEventListener('change', () => {
            goalTextEl.classList.toggle('concluida', checkbox.checked);
            salvarEstadoCheckbox(article, checkbox.checked, texto, prioridade, view);
            atualizarEstatisticas();
        });
        
        deleteBtn.addEventListener('click', () => {
            removerMeta(view, texto);
            article.remove();
            atualizarEstatisticas();
        });
        
        return article;
    }

    function salvarMeta(view, texto, prioridade) {
        let metas = JSON.parse(localStorage.getItem(STORAGE_KEYS[view]) || '[]');
        metas.unshift({
            texto,
            prioridade, 
            concluida: false,
            dataCriacao: new Date().toISOString(),
            prazoDias: getPrazoDias(view)
        });
        localStorage.setItem(STORAGE_KEYS[view], JSON.stringify(metas));
    }

    function removerMeta(view, texto) {
        let metas = JSON.parse(localStorage.getItem(STORAGE_KEYS[view]) || '[]');
        metas = metas.filter(meta => meta.texto !== texto);
        localStorage.setItem(STORAGE_KEYS[view], JSON.stringify(metas));
    }

    function salvarEstadoCheckbox(article, concluida, texto, prioridade, view) {
        let metas = JSON.parse(localStorage.getItem(STORAGE_KEYS[view]) || '[]');
        const index = metas.findIndex(m => m.texto === texto && m.prioridade === prioridade);
        if (index !== -1) {
            metas[index].concluida = concluida;
            if (concluida) metas[index].concluidaData = new Date().toISOString();
            localStorage.setItem(STORAGE_KEYS[view], JSON.stringify(metas));
        }
    }

    function carregarMetas(view) {
        const container = document.getElementById(`lista-${view}`);
        if (!container) return;

        container.innerHTML = '';
        const metas = JSON.parse(localStorage.getItem(STORAGE_KEYS[view]) || '[]');
        
        metas.forEach(meta => {
            const elemento = criarElementoMeta(meta.texto, meta.prioridade, view);
            const checkbox = elemento.querySelector('.checkbox-meta');
            const goalText = elemento.querySelector('.goal-text');
            
            checkbox.checked = meta.concluida || false;
            if (meta.concluida) goalText.classList.add('concluida');
            
            // Status badge
            if (isMetaVencida(meta, view)) {
                const badge = document.createElement('span');
                badge.className = 'status-badge status-vencida';
                badge.textContent = 'Vencida';
                elemento.querySelector('.etiqueta-prioridade').after(badge);
            }
            
            container.appendChild(elemento);
        });
    }

// ===== CALENDÁRIO =====
const CALENDAR_STORAGE = 'calendario_dias';
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let diaSelecionado = null;

function getCalendarData() {
return JSON.parse(localStorage.getItem(CALENDAR_STORAGE) || '{}');
}

function saveCalendarData(data) {
    localStorage.setItem(CALENDAR_STORAGE, JSON.stringify(data));
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const monthYearEl = document.getElementById('calendar-month-year');
    if (!grid || !monthYearEl) return;

    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    monthYearEl.textContent = `${meses[currentMonth]} ${currentYear}`;

    grid.innerHTML = '';
    const primeiroDia = new Date(currentYear, currentMonth, 1).getDay();
    const diasNoMes = new Date(currentYear, currentMonth + 1, 0).getDate();
    const hoje = new Date();
    const calendarData = getCalendarData();

    // Dias vazios antes
    for (let i = 0; i < primeiroDia; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        grid.appendChild(empty);
    }

    // Dias do mês
    for (let dia = 1; dia <= diasNoMes; dia++) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.textContent = dia;

        const dataKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const eficiencia = calendarData[dataKey];

        if (eficiencia !== undefined) {
            if (eficiencia === 100) dayEl.classList.add('high-100');
            else if (eficiencia >= 75) dayEl.classList.add('high-75');
            else if (eficiencia >= 50) dayEl.classList.add('high-50');
            else if (eficiencia >= 25) dayEl.classList.add('high-25');
            else dayEl.classList.add('high-0');

            const label = document.createElement('span');
            label.className = 'efficiency-label';
            label.textContent = `${eficiencia}%`;
            dayEl.appendChild(label);
        }

        if (hoje.getDate() === dia && hoje.getMonth() === currentMonth && hoje.getFullYear() === currentYear) {
            dayEl.classList.add('today');
        }

        // Clique abre modal eficiência
        const isFuturo = new Date(currentYear, currentMonth, dia) > hoje;
        if (!isFuturo) {
            dayEl.addEventListener('click', () => abrirModalEficiencia(dataKey, dia));
        } else {
            dayEl.style.opacity = '0.4';
            dayEl.style.cursor = 'default';
        }

        grid.appendChild(dayEl);
    }
}

function abrirModalEficiencia(dataKey, dia) {
    const calendarData = getCalendarData();
    const currentEff = calendarData[dataKey];

    // Modal existente reutilizar
    let modal = document.getElementById('modal-eficiencia');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-eficiencia';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal modal-dia">
                <h3>Eficiência do Dia</h3>
                <p class="efficiency-date"></p>
                <div class="efficiency-resultado">
                    <span class="eficiencia-valor">0%</span>
                </div>
                <div class="tarefas-lista"></div>
<div class="modal-actions">
                    <button class="btn-limpar" id="btn-limpar-dia">Limpar</button>
                    <button class="btn-cancelar" id="btn-cancelar-dia">Cancelar</button>
                    <button class="btn-confirmar" id="btn-confirmar-dia">Confirmar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

modal.querySelector('#btn-cancelar-dia').addEventListener('click', () => modal.classList.remove('active'));
        modal.addEventListener('click', (e) => e.target === modal && modal.classList.remove('active'));
        
        // Limpar - remove a eficiência do dia
        modal.querySelector('#btn-limpar-dia').addEventListener('click', () => {
            const currentDataKey = modal.dataset.currentDataKey;
            const data = getCalendarData();
            if (currentDataKey && data[currentDataKey]) {
                delete data[currentDataKey];
                saveCalendarData(data);
            }
            modal.classList.remove('active');
            renderCalendar();
        });
        
// Confirmar - salva o status das tarefas
        modal.querySelector('#btn-confirmar-dia').addEventListener('click', () => {
            const currentDataKey = modal.dataset.currentDataKey;
            const tarefasContainer = modal.querySelector('.tarefas-lista');
            const tarefas = tarefasContainer.querySelectorAll('.tarefa-item');
            let total = 0;
            let conclusas = 0;
            
            tarefas.forEach(tarefa => {
                total++;
                if (tarefa.dataset.concluida === 'true') conclusas++;
            });
            
            const eficiencia = total > 0 ? Math.round((conclusas / total) * 100) : 0;
            const data = getCalendarData();
            if (currentDataKey) {
                data[currentDataKey] = eficiencia;
                saveCalendarData(data);
            }
            modal.classList.remove('active');
            renderCalendar();
        });
    }

// Buscar tarefas DIÁRIAS do localStorage (todas, não filtrar por data)
    // O usuário pode customizar qualquer dia, mesmo que tenha esquecido de acessar
    const todasMetas = JSON.parse(localStorage.getItem(STORAGE_KEYS['diario']) || '[]');

    // Armazenar o dataKey atual no modal
    modal.dataset.currentDataKey = dataKey;
    
    const el = modal;
el.querySelector('.efficiency-date').textContent = `${dia} de ${new Date(currentYear, currentMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
    
    // Renderizar lista de tarefas
    const tarefasContainer = el.querySelector('.tarefas-lista');
    tarefasContainer.innerHTML = '';
    
    if (todasMetas.length === 0) {
        tarefasContainer.innerHTML = '<p class="sem-tarefas">Nenhuma tarefa para este dia.</p>';
        el.querySelector('.efficiency-resultado').innerHTML = '<span class="eficiencia-valor">--%</span>';
    } else {
        let conclusas = 0;
        todasMetas.forEach((meta, index) => {
            const tarefaEl = document.createElement('div');
            tarefaEl.className = 'tarefa-item';
            const jaConcluida = meta.concluida;
            if (jaConcluida) conclusas++;
            
            tarefaEl.innerHTML = `
                <span class="tarefa-texto">${meta.texto}</span>
                <div class="tarefa-botoes">
                    <button class="btn-v ${jaConcluida ? 'active' : ''}" data-index="${index}">✓</button>
                    <button class="btn-x ${!jaConcluida ? 'active' : ''}" data-index="${index}">✗</button>
                </div>
            `;
            
            // Armazenar estado inicial
            tarefaEl.dataset.concluida = jaConcluida ? 'true' : 'false';
            
            tarefaEl.querySelector('.btn-v').addEventListener('click', function() {
                const item = this.closest('.tarefa-item');
                item.classList.add('concluida');
                item.querySelector('.btn-v').classList.add('active');
                item.querySelector('.btn-x').classList.remove('active');
                item.dataset.concluida = 'true';
                atualizarEficienciaModal(modal);
            });
            
            tarefaEl.querySelector('.btn-x').addEventListener('click', function() {
                const item = this.closest('.tarefa-item');
                item.classList.remove('concluida');
                item.querySelector('.btn-x').classList.add('active');
                item.querySelector('.btn-v').classList.remove('active');
                item.dataset.concluida = 'false';
                atualizarEficienciaModal(modal);
            });
            
            tarefasContainer.appendChild(tarefaEl);
        });
        
        // Calcular eficiência inicial
        const eficiencia = Math.round((conclusas / todasMetas.length) * 100);
        atualizarDisplayEficiencia(el, eficiencia);
    }
    
    el.classList.add('active');
}

function atualizarEficienciaModal(modal) {
    // Atualiza cálculo quando usuario muda status
    const tarefas = modal.querySelectorAll('.tarefa-item');
    let total = 0;
    let conclusas = 0;
    
    tarefas.forEach(t => {
        total++;
        if (t.dataset.concluida === 'true') conclusas++;
    });
    
    const eficiencia = total > 0 ? Math.round((conclusas / total) * 100) : 0;
    atualizarDisplayEficiencia(modal, eficiencia);
}

function atualizarDisplayEficiencia(modal, eficiencia) {
    const resultadoEl = modal.querySelector('.efficiency-resultado');
    const hsl = getEficienciaHSL(eficiencia);
    resultadoEl.innerHTML = `<span class="eficiencia-valor" style="color: ${hsl}">${eficiencia}%</span>`;
}

function getEficienciaHSL(percent) {
    let h, s, l;
    
    if (percent <= 24) {
        // Vermelho: 0% = mais escuro, 24% = mais claro
        h = 0;
        s = 70 + (percent / 24) * 30; // 70% a 100%
        l = 20 + (percent / 24) * 20; // 20% a 40%
    } else if (percent <= 50) {
        // Laranja
        h = 30;
        const t = (percent - 25) / 25;
        s = 70 + t * 30;
        l = 25 + t * 20;
    } else if (percent <= 75) {
        // Verde claro
        h = 90;
        const t = (percent - 51) / 24;
        s = 50 + t * 40;
        l = 30 + t * 20;
    } else {
        // Verde escuro (76-100)
        h = 140;
        const t = (percent - 76) / 24;
        s = 40 + t * 30;
        l = 25 + t * 25;
    }
    
    return `hsl(${h}, ${s}%, ${l}%)`;
}

// ===== CALENDAR NAVIGATION SETUP =====
function setupCalendarNavigation() {
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentMonth--;
            if (currentMonth < 0) { currentMonth = 11; currentYear--; }
            renderCalendar();
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentMonth++;
            if (currentMonth > 11) { currentMonth = 0; currentYear++; }
            renderCalendar();
        });
    }
}

// ===== ESTATÍSTICAS =====
function atualizarEstatisticas() {
        let totalMetas = 0;
        let metasConcluidas = 0;
        let diasAtivos = new Set();
        
        Object.keys(STORAGE_KEYS).forEach(key => {
            if (key === 'stats') return;
            const metas = JSON.parse(localStorage.getItem(STORAGE_KEYS[key]) || '[]');
            totalMetas += metas.length;
            metasConcluidas += metas.filter(m => m.concluida).length;
            
            metas.forEach(meta => {
                if (meta.dataCriacao) {
                    const data = new Date(meta.dataCriacao).toDateString();
                    diasAtivos.add(data);
                }
            });
        });
        
        const eficiencia = totalMetas ? Math.round((metasConcluidas / totalMetas) * 100) : 0;
        
        // Update stats bar fixa
        const statTotal = document.getElementById('stat-total');
        const statEficiencia = document.getElementById('stat-eficiencia');
        const statDias = document.getElementById('stat-dias');
        const statStreak = document.getElementById('stat-streak');
        
        if (statTotal) statTotal.textContent = totalMetas;
        if (statEficiencia) statEficiencia.textContent = eficiencia + '%';
        if (statDias) statDias.textContent = diasAtivos.size;
        if (statStreak) statStreak.textContent = calcularStreak();
        
        // Update stats section
        totalMetasEl.textContent = totalMetas;
        eficienciaEl.textContent = eficiencia + '%';
        diasAtivosEl.textContent = diasAtivos.size;
    }
    
    function calcularStreak() {
        const calendarData = getCalendarData();
        const hoje = new Date();
        let streak = 0;
        
        for (let i = 0; i < 365; i++) {
            const dia = new Date(hoje);
            dia.setDate(dia.getDate() - i);
            const dataKey = dia.toISOString().split('T')[0];
            const eficiencia = calendarData[dataKey];
            
            if (eficiencia !== undefined && eficiencia > 0) {
                streak++;
            } else if (i > 0) {
                break;
            }
        }
        return streak;
    }

function renderEstatisticas() {
        atualizarEstatisticas();
        
        // Gráfico eficiência últimos 30 dias - LÊ EXCLUSIVAMENTE DO CALENDÁRIO
        const ctx = chartCtx.getContext('2d');
        const calendarData = getCalendarData(); // Lê do Calendário
        const agora = new Date();
        const dados30Dias = [];
        
        for (let i = 29; i >= 0; i--) {
            const dia = new Date(agora);
            dia.setDate(dia.getDate() - i);
            
            // Formato: YYYY-MM-DD (mesmo do Calendário)
            const dataKey = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
            const eficiencia = calendarData[dataKey];
            
            dados30Dias.push({
                label: dia.toLocaleDateString('pt-BR', {day: 'numeric', month: 'short'}),
                value: eficiencia !== undefined ? eficiencia : 0
            });
        }
        
        if (chartInstance) chartInstance.destroy();
        
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dados30Dias.map(d => d.label),
                datasets: [{
                    label: 'Eficiência (%)',
                    data: dados30Dias.map(d => d.value),
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: 'rgb(59, 130, 246)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(0,0,0,0.1)' }
                    },
                    x: { grid: { display: false } }
                },
plugins: {
                    legend: { display: false }
                }
            }
        });
        
        // Individual goal charts
        renderIndividualCharts();
    }

    // ===== GRÁFICOS POR META =====
    const individualCharts = {};
    
    function renderIndividualCharts() {
        const container = document.getElementById('individual-charts-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Get all unique goals from all views
        const allGoals = new Map();
        Object.keys(STORAGE_KEYS).forEach(key => {
            if (key === 'stats') return;
            const metas = JSON.parse(localStorage.getItem(STORAGE_KEYS[key]) || '[]');
            metas.forEach(meta => {
                const id = `${meta.texto}-${meta.prioridade}`;
                if (!allGoals.has(id)) {
                    allGoals.set(id, { ...meta, view: key });
                }
            });
        });
        
        if (allGoals.size === 0) {
            container.innerHTML = '<p class="no-goals">Nenhuma meta cadastrada ainda.</p>';
            return;
        }
        
        allGoals.forEach((meta, id) => {
            const chartContainer = document.createElement('div');
            chartContainer.className = 'individual-chart-card';
            chartContainer.innerHTML = `
                <h4>${meta.texto}</h4>
                <p class="meta-info">${meta.prioridade} - ${meta.view.charAt(0).toUpperCase() + meta.view.slice(1)}</p>
                <canvas id="chart-${id.replace(/[^a-zA-Z0-9]/g, '-')}" width="300" height="150"></canvas>
            `;
            container.appendChild(chartContainer);
            
            // Render individual chart
            setTimeout(() => {
                const ctx = document.getElementById(`chart-${id.replace(/[^a-zA-Z0-9]/g, '-')}`);
                if (!ctx) return;
                
                // Get data for this specific goal
                const goalHistory = getGoalHistory(meta.texto, meta.prioridade, meta.view);
                
                if (individualCharts[id]) {
                    individualCharts[id].destroy();
                }
                
                const isDark = html.classList.contains('dark-mode');
                const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
                const textColor = isDark ? '#fff' : '#333';
                
                individualCharts[id] = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels:goalHistory.dates,
                        datasets: [{
                            label: 'Concluída',
                            data: goalHistory.values,
                            backgroundColor: goalHistory.values.map(v => v === 1 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
                            borderColor: goalHistory.values.map(v => v === 1 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'),
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: 1,
                                ticks: {
                                    stepSize: 1,
                                    callback: (val) => val === 1 ? 'Sim' : 'Não'
                                },
                                grid: { color: gridColor }
                            },
                            x: {
                                grid: { display: false }
                            }
                        },
                        plugins: {
                            legend: { display: false }
                        }
                    }
                });
            }, 100);
        });
    }
    
function getGoalHistory(texto, prioridade, view) {
        const dias = [];
        const valores = [];
        const calendarData = getCalendarData(); // Lê do Calendário
        
        for (let i = 29; i >= 0; i--) {
            const dia = new Date();
            dia.setDate(dia.getDate() - i);
            const dataStr = dia.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
            
            dias.push(dataStr);
            
            // Formato: YYYY-MM-DD (mesmo do Calendário)
            const dataKey = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
            const eficiencia = calendarData[dataKey];
            
// Se a eficiência do dia for > 50%, considera-se que a tarefa foi Productivity
            // (lógica simples baseada no dado do Calendário)
            if (eficiencia !== undefined && eficiencia > 50) {
                valores.push(1);
            } else if (eficiencia !== undefined && eficiencia > 0) {
                valores.push(0.5); // Parcialmente completa
            } else {
                valores.push(0);
            }
        }
        
        return { dates: dias, values: valores };
    }

    // ===== AUTO-EXPIRAÇÃO ===== (runs at midnight)
    function setupMidnightCheck() {
        const ULTIMO_RESET = 'ultimo_reset_dia';
        const hoje = new Date().toDateString();
        const ultimoReset = localStorage.getItem(ULTIMO_RESET);
        
        if (ultimoReset !== hoje) {
            // New day - expire unfinished metas
            Object.keys(STORAGE_KEYS).forEach(key => {
                if (key === 'stats') return;
                const metas = JSON.parse(localStorage.getItem(STORAGE_KEYS[key]) || '[]');
                const prazoDias = getPrazoDias(key);
                
                const atualizadas = metas.map(meta => {
                    const dataCriacao = new Date(meta.dataCriacao);
                    const diasPassados = Math.floor((new Date() - dataCriacao) / (1000 * 60 * 60 * 24));
                    
                    if (diasPassados >= prazoDias && !meta.concluida) {
                        // Meta não concluída expirou - registra 0% no calendário
                        const dataKey = new Date().toISOString().split('T')[0].replace(/-/g, '-');
                        const calendarData = getCalendarData();
                        calendarData[dataKey] = 0;
                        saveCalendarData(calendarData);
                        return { ...meta, vencida: true };
                    }
                    return meta;
                });
                
                localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(atualizadas));
            });
            
            localStorage.setItem(ULTIMO_RESET, hoje);
        }
    }

// Inicialização
    initTema();
    atualizarDataAtual();
    carregarMetas('diario');
    atualizarEstatisticas();
    setupMidnightCheck();
    setupCalendarNavigation();
    
    themeToggle.addEventListener('click', toggleTema);
    
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const temaSalvo = localStorage.getItem(STORAGE_THEME);
        if (!temaSalvo) {
            html.classList.toggle('dark-mode', e.matches);
            renderEstatisticas();
        }
    });
});
