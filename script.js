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
        mensal: 'metas_mensal',
        anual: 'metas_anual',
        stats: 'estatisticas_geral',
        ciclicas: 'ciclicas_tarefas_dia'
    };

    let prioridadeSelecionada = 'Média';

    // Prazo por tipo
    const PRAZO_DIAS = {
    diario: 1,
    semanal: 7,
    mensal: 30,
    anual: 365
};

// ← ADICIONAR AQUI

    // ===== DARK MODE =====
    function initTema() {
    const temaSalvo = localStorage.getItem(STORAGE_THEME);
    const prefereDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (temaSalvo === 'dark' || (!temaSalvo && prefereDark)) {
        html.classList.add('dark-mode');
        const btn = document.getElementById('theme-toggle');
        btn.setAttribute('data-theme', 'dark');
        btn.setAttribute('aria-pressed', 'true');
    }
}
   function toggleTema() {
    html.classList.toggle('dark-mode');
    const isDark = html.classList.contains('dark-mode');
    localStorage.setItem(STORAGE_THEME, isDark ? 'dark' : 'light');
    
    // Atualizar atributos do botão
    const btn = document.getElementById('theme-toggle');
    btn.setAttribute('data-theme', isDark ? 'dark' : 'light');
    btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    
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
            } else if (view === 'hall-fama') {
                carregarHallFama();
            } else if (view === 'calendario') {
                renderCalendar();
            } else {
                carregarMetas(view);
            }
            
            currentView = view; // Track para gráficos
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
        article.innerHTML = `
            <span class="goal-texto">${texto}</span>
            <span class="etiqueta-prioridade ${prioridade.toLowerCase()}">${prioridade}</span>
            <button class="btn-excluir" aria-label="Excluir meta">&times;</button>
        `;
        
        const deleteBtn = article.querySelector('.btn-excluir');
        
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
            container.appendChild(elemento);
        });
    }

// ===== CALENDÁRIO =====
const CALENDAR_STORAGE = 'calendario_dias';
const CALENDAR_TAREFAS = 'calendario_tarefas_dia'; // NOVO: Armazena status individual por tarefa por dia
const CICLICAS_STORAGE = 'ciclicas_tarefas_dia'; // NOVO: Armazena status de metas cíclicas (semanal/anual)
const HALL_FAMA_STORAGE = 'hall_fama_anual'; // NOVO: Conquistas anuais permanentes
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let diaSelecionado = null;

function formatDataKeyYYYYMMDD(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getCicloAtualBase(metaCiclica, dataKeyAtual) {
    const intervalDias = metaCiclica.tipo === 'mensal' ? PRAZO_DIAS.mensal
                       : metaCiclica.tipo === 'anual'  ? PRAZO_DIAS.anual : 0;
    if (!intervalDias) return null;
    const base = new Date(metaCiclica.dataCriacao);
    const hoje = new Date(dataKeyAtual + 'T00:00:00');
    const diffDays = Math.floor((hoje - base) / (1000 * 60 * 60 * 24));
    const k = Math.max(0, Math.floor(diffDays / intervalDias));
    const start = new Date(base);
    start.setDate(start.getDate() + (k * intervalDias));
    const prazoFinal = new Date(base);
    prazoFinal.setDate(prazoFinal.getDate() + ((k + 1) * intervalDias));
    return { start, prazoFinal };
}

function isObrigatoriaHoje(metaCiclica, dataKeyAtual) {
    const ciclo = getCicloAtualBase(metaCiclica, dataKeyAtual);
    if (!ciclo) return false;
    return formatDataKeyYYYYMMDD(ciclo.prazoFinal) === dataKeyAtual;
}

function isConcluidaAntecipadamenteNoCiclo(metaCiclica, dataKeyAtual) {
    const ciclo = getCicloAtualBase(metaCiclica, dataKeyAtual);
    if (!ciclo) return false;
    const prazoKey = formatDataKeyYYYYMMDD(ciclo.prazoFinal);
    const startKey = formatDataKeyYYYYMMDD(ciclo.start);
    const tarefasCalendar = JSON.parse(localStorage.getItem(CICLICAS_STORAGE) || '{}');
    const taskId = metaCiclica.cyclicTaskId;
    for (const k of Object.keys(tarefasCalendar)) {
        if (tarefasCalendar[k]?.[taskId] === true && k >= startKey && k < prazoKey) return true;
    }
    return false;
}

function getCalendarData() {
return JSON.parse(localStorage.getItem(CALENDAR_STORAGE) || '{}');
}

function saveCalendarData(data) {
    localStorage.setItem(CALENDAR_STORAGE, JSON.stringify(data));
}

// NOVA: Função para obter status das tarefas de um dia específico
function getTarefasDoDia(dataKey) {
    const tarefasDia = JSON.parse(localStorage.getItem(CALENDAR_TAREFAS) || '{}');
    return tarefasDia[dataKey] || {};
}

// NOVA: Função para salvar status das tarefas de um dia específico
function saveTarefasDoDia(dataKey, tarefasStatus) {
    const tarefasDia = JSON.parse(localStorage.getItem(CALENDAR_TAREFAS) || '{}');
    tarefasDia[dataKey] = tarefasStatus;
    localStorage.setItem(CALENDAR_TAREFAS, JSON.stringify(tarefasDia));
}

// NOVA: Função para salvar estado de uma tarefa específica de um dia
function salvarEstadoTarefaDia(dataKey, taskId, concluida) {
    const tarefasDia = getTarefasDoDia(dataKey);
    tarefasDia[taskId] = concluida;
    saveTarefasDoDia(dataKey, tarefasDia);
}

// ===== NOVAS FUNÇÕES PARA METAS CÍCLICAS =====
// Verifica se dataKey é dia de ciclo para meta mensal (mesmo dia do mês)
function isDiaCicloMensal(meta, dataKey) {
    const dataHoje = new Date(dataKey + 'T00:00:00');
    const mesHoje = String(dataHoje.getMonth() + 1).padStart(2, '0');
    const diaHoje = String(dataHoje.getDate()).padStart(2, '0');
    const dataCicloEsperada = `${dataHoje.getFullYear()}-${mesHoje}-${diaHoje}`;
    // Meta mensal criada em 15/10 aparece todo dia 15 de cada mês
    return dataKey.startsWith(dataHoje.getFullYear() + '-' + mesHoje + '-' + diaHoje);
}

// Verifica se dataKey é dia de ciclo para meta semanal (mesmo dia da semana da criação)
function isDiaCicloSemanal(meta, dataKey) {
    const dataCriacao = new Date(meta.dataCriacao);
    const dataHoje = new Date(dataKey + 'T00:00:00');
    return dataCriacao.getDay() === dataHoje.getDay();
}

// Verifica se dataKey é dia de ciclo para meta anual (mesma data)
function isDiaCicloAnual(meta, dataKey) {
    const dataHoje = new Date(dataKey + 'T00:00:00');
    const anoHoje = dataHoje.getFullYear();
    const mesHoje = String(dataHoje.getMonth() + 1).padStart(2, '0');
    const diaHoje = String(dataHoje.getDate()).padStart(2, '0');
    const dataCicloEsperada = `${anoHoje}-${mesHoje}-${diaHoje}`;
    // Meta anual criada em 02/05 aparece todo 02/05, independentemente do ano
    return dataKey.startsWith(`${anoHoje}-${mesHoje}-${diaHoje}`);
}

// Gera taskId único para metas cíclicas: 'cyc_[texto-prioridade]_[dataCriacao curta]'
function getCyclicTaskId(meta) {
    const dataCurta = meta.dataCriacao.split('T')[0].replace(/-/g, '');
    return `cyc_${meta.texto.replace(/[^a-zA-Z0-9]/g, '_')}-${meta.prioridade}_${dataCurta}`;
}

// ===== FUNÇÃO PRINCIPAL: renderizarMetasCiclicas(dataKey) =====
/**
 * Retorna metas semanal/anual elegíveis para checklist NO EXATO dataKey
 * - Semanal: mesmo dia da semana da criação
 * - Anual: mesma data (DD/MM) independente do ano
 * Formato: [{texto, prioridade, tipo: 'semanal'|'anual', cyclicTaskId, dataOrigem}]
 */
function renderizarMetasCiclicas(dataKey) {
    const metasCiclicas = [];

    // Carregar metas_mensal
    const metasMensais = JSON.parse(localStorage.getItem(STORAGE_KEYS.mensal) || '[]');
    metasMensais.forEach(meta => {
        if (isDiaCicloMensal(meta, dataKey)) {
            metasCiclicas.push({
                ...meta,
                tipo: 'mensal',
                cyclicTaskId: getCyclicTaskId(meta)
            });
        }
    });

    // Carregar metas_semanal
    const metasSemanais = JSON.parse(localStorage.getItem(STORAGE_KEYS.semanal) || '[]');
    metasSemanais.forEach(meta => {
        if (isDiaCicloSemanal(meta, dataKey)) {
            metasCiclicas.push({
                ...meta,
                tipo: 'semanal',
                cyclicTaskId: getCyclicTaskId(meta)
            });
        }
    });

    // Carregar metas_anual
    const metasAnuais = JSON.parse(localStorage.getItem(STORAGE_KEYS.anual) || '[]');
    metasAnuais.forEach(meta => {
        if (isDiaCicloAnual(meta, dataKey)) {
            metasCiclicas.push({
                ...meta,
                tipo: 'anual',
                cyclicTaskId: getCyclicTaskId(meta)
            });
        }
    });

    return metasCiclicas;
}

// ===== HELPERS PARA STORAGE CÍCLICO (Paralelo ao Daily) =====
function getTarefasCiclicasDoDia(dataKey) {
    const tarefasCiclicas = JSON.parse(localStorage.getItem(CICLICAS_STORAGE) || '{}');
    return tarefasCiclicas[dataKey] || {};
}

function saveTarefasCiclicasDoDia(dataKey, tarefasStatus) {
    const tarefasCiclicas = JSON.parse(localStorage.getItem(CICLICAS_STORAGE) || '{}');
    tarefasCiclicas[dataKey] = tarefasStatus;
    localStorage.setItem(CICLICAS_STORAGE, JSON.stringify(tarefasCiclicas));
}

function salvarEstadoTarefaCyclicDia(dataKey, cyclicTaskId, concluida, meta = null) {
    const tarefasCiclicasDia = getTarefasCiclicasDoDia(dataKey);
    tarefasCiclicasDia[cyclicTaskId] = concluida;
    saveTarefasCiclicasDoDia(dataKey, tarefasCiclicasDia);
    
    // REMOVIDO: Hall da Fama agora só no CONFIRMAR do modal
}

function salvarHallFamaConquista(meta, dataKey) {
    let hallFama = JSON.parse(localStorage.getItem(HALL_FAMA_STORAGE) || '[]');
    
    const conquista = {
        id: getCyclicTaskId(meta),
        texto: meta.texto,
        prioridade: meta.prioridade,
        dataConquista: new Date().toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: 'long', 
            year: 'numeric',
            weekday: 'long'
        }),
        dataKey: dataKey
    };
    
    // Evitar duplicatas
    hallFama = hallFama.filter(c => c.id !== conquista.id);
    hallFama.unshift(conquista);
    
    localStorage.setItem(HALL_FAMA_STORAGE, JSON.stringify(hallFama));
}

function carregarHallFama() {
    const container = document.getElementById('hall-fama-container');
    if (!container) return;
    
    const hallFama = JSON.parse(localStorage.getItem(HALL_FAMA_STORAGE) || '[]');
    
    if (hallFama.length === 0) {
        container.innerHTML = '<p class="no-data-message" style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">Nenhuma conquista anual ainda. Crie história! 🏆</p>';
        return;
    }
    
    container.innerHTML = '';
    
    hallFama.forEach(conquista => {
        const card = document.createElement('div');
        card.className = 'hall-fama-card';
        card.dataset.id = conquista.id;
        card.innerHTML = `
            <div class="trofeu">🏆</div>
            <h4 class="conquista-texto">${conquista.texto}</h4>
            <div class="conquista-prioridade">${conquista.prioridade}</div>
            <div class="data-conquista">${conquista.dataConquista}</div>
            <div class="card-actions">
                <button class="btn-editar" data-id="${conquista.id}">✏️ Editar</button>
                <button class="btn-excluir" data-id="${conquista.id}">🗑️</button>
            </div>
        `;
        container.appendChild(card);
    });

    // Event listeners para botões
    container.querySelectorAll('.btn-editar').forEach(btn => {
        btn.addEventListener('click', editarConquista);
    });
    container.querySelectorAll('.btn-excluir').forEach(btn => {
        btn.addEventListener('click', excluirConquista);
    });
}

function excluirConquista(e) {
    const id = e.target.dataset.id;
    if (!confirm('Tem certeza que deseja excluir esta conquista do Hall da Fama?')) return;

    let hallFama = JSON.parse(localStorage.getItem(HALL_FAMA_STORAGE) || '[]');
    hallFama = hallFama.filter(c => c.id !== id);
    localStorage.setItem(HALL_FAMA_STORAGE, JSON.stringify(hallFama));
    carregarHallFama();
}

function editarConquista(e) {
    const id = e.target.dataset.id;
    const conquista = JSON.parse(localStorage.getItem(HALL_FAMA_STORAGE) || '[]').find(c => c.id === id);
    if (!conquista) return;

    // Reutilizar modal existente ou criar
    let modal = document.getElementById('modal-hall-edit');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-hall-edit';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <h3>Editar Conquista</h3>
                <input type="text" id="edit-texto" placeholder="Texto da conquista" maxlength="100">
                <select id="edit-prioridade">
                    <option value="Alta">Alta</option>
                    <option value="Média">Média</option>
                    <option value="Baixa">Baixa</option>
                </select>
                <input type="date" id="edit-data">
                <div class="modal-actions">
                    <button class="btn-cancelar" id="btn-cancelar-edit">Cancelar</button>
                    <button class="btn-confirmar" id="btn-salvar-edit">Salvar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Event listeners
        document.getElementById('btn-cancelar-edit').addEventListener('click', () => modal.classList.remove('active'));
        document.getElementById('btn-salvar-edit').addEventListener('click', () => salvarEdicao(modal.dataset.editingId));
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
    }

    // Preencher form
    document.getElementById('edit-texto').value = conquista.texto;
    document.getElementById('edit-prioridade').value = conquista.prioridade;
    const dataParts = conquista.dataKey.split('-');
    document.getElementById('edit-data').value = `${dataParts[0]}-${dataParts[1]}-${dataParts[2]}`;
    modal.dataset.editingId = id;
    modal.classList.add('active');
}

function salvarEdicao(id) {
    const texto = document.getElementById('edit-texto').value.trim();
    const prioridade = document.getElementById('edit-prioridade').value;
    const dataKey = document.getElementById('edit-data').value;

    if (!texto) return;

    let hallFama = JSON.parse(localStorage.getItem(HALL_FAMA_STORAGE) || '[]');
    const index = hallFama.findIndex(c => c.id === id);
    if (index !== -1) {
        hallFama[index] = {
            ...hallFama[index],
            texto,
            prioridade,
            dataConquista: new Date(dataKey + 'T00:00:00').toLocaleDateString('pt-BR', { 
                day: '2-digit', 
                month: 'long', 
                year: 'numeric',
                weekday: 'long'
            }),
            dataKey
        };
        localStorage.setItem(HALL_FAMA_STORAGE, JSON.stringify(hallFama));
        document.getElementById('modal-hall-edit').classList.remove('active');
        carregarHallFama();
    }
}

function isAnualConcluidaDia(dataKey, cyclicTaskId) {
    const tarefasCiclicas = getTarefasCiclicasDoDia(dataKey);
    return tarefasCiclicas[cyclicTaskId] === true;
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
        
// Limpar - remove a eficiência do dia E as tarefas individuais
        modal.querySelector('#btn-limpar-dia').addEventListener('click', () => {
            const currentDataKey = modal.dataset.currentDataKey;
            
            // 1. Remove eficiência do dia em calendario_dias
            const data = getCalendarData();
// CORREÇÃO: Verificar explicitamente !== undefined para lidar com eficiência 0%
            if (currentDataKey && data[currentDataKey] !== undefined) {
                delete data[currentDataKey];
                saveCalendarData(data);
            }
            
// 2. Remove daily tasks deste dia
            const tarefasDia = JSON.parse(localStorage.getItem(CALENDAR_TAREFAS) || '{}');
            if (tarefasDia[currentDataKey]) {
                delete tarefasDia[currentDataKey];
                localStorage.setItem(CALENDAR_TAREFAS, JSON.stringify(tarefasDia));
            }
            
            // 3. Remove cyclic tasks deste dia
            const tarefasCiclicas = JSON.parse(localStorage.getItem(CICLICAS_STORAGE) || '{}');
            if (tarefasCiclicas[currentDataKey]) {
                delete tarefasCiclicas[currentDataKey];
                localStorage.setItem(CICLICAS_STORAGE, JSON.stringify(tarefasCiclicas));
            }
            
            // 3. Atualiza os gráficos após a limpeza
            modal.classList.remove('active');
            renderCalendar();
            renderEstatisticas(); // Atualiza gráficos automaticamente (inclui individual charts)
        });
        
// Confirmar - salva o status das tarefas E atualiza os gráficos
        modal.querySelector('#btn-confirmar-dia').addEventListener('click', () => {
            const currentDataKey = modal.dataset.currentDataKey;
            const tarefasContainer = modal.querySelector('.tarefas-lista');
            const tarefas = tarefasContainer.querySelectorAll('.tarefa-item');
            let total = 0;
            let conclusas = 0;
            
            tarefas.forEach(tarefa => {
                const metaTipo = tarefa.dataset.metaTipo || '';
                const taskIdLocalForMeta = tarefa.dataset.taskId;

                // Para diárias e semanais: conta normalmente
               if (metaTipo === 'diaria' || metaTipo === 'semanal' || metaTipo === '') {
                    total++;
                    if (tarefa.dataset.concluida === 'true') conclusas++;
                    return;
                }

                // Para mensal/anual: só entra se
                // - Obrigatória hoje
                // - Não concluída antecipadamente no ciclo atual
                if (metaTipo === 'mensal' || metaTipo === 'anual') {
                    const cyclicTaskIdLocal = taskIdLocalForMeta;
                    const metasCiclicasNoDia = renderizarMetasCiclicas(currentDataKey);
                    const metaCiclica = metasCiclicasNoDia.find(m => m.cyclicTaskId === cyclicTaskIdLocal);

                    if (
                        metaCiclica &&
                        isObrigatoriaHoje(metaCiclica, currentDataKey) &&
                        !isConcluidaAntecipadamenteNoCiclo(metaCiclica, currentDataKey)
                    ) {
                        total++;
                        if (tarefa.dataset.concluida === 'true') conclusas++;
                    }
                    return;
                }

                // Caso não tenha metaTipo esperado, não altera
            });
            
            const eficiencia = total > 0 ? Math.round((conclusas / total) * 100) : 0;
            const data = getCalendarData();
            if (currentDataKey) {
                data[currentDataKey] = eficiencia;
                saveCalendarData(data);
            }
            
            // ✅ FINAL: Processar conquistas anuais pendentes APENAS se final=true no CONFIRMAR
            if (window.pendingAnnualStates) {
                Object.entries(window.pendingAnnualStates).forEach(([cyclicTaskId, isFinalCheck]) => {
                    if (isFinalCheck) {
                        const todasCiclicas = renderizarMetasCiclicas(currentDataKey);
                        const meta = todasCiclicas.find(m => m.cyclicTaskId === cyclicTaskId);
                        if (meta) {
                            salvarHallFamaConquista(meta, currentDataKey);
                        }
                    }
                });
                // Limpar states após processar
                window.pendingAnnualStates = {};
            }
            
            modal.classList.remove('active');
            renderCalendar();
            renderEstatisticas(); // Atualiza gráficos automaticamente (inclui individual charts)
        });
    }

// Buscar tarefas DIÁRIAS do localStorage (todas, não filtrar por data)
    // O usuário pode customizar qualquer dia, mesmo que tenha esquecido de acessar
    const todasMetas = JSON.parse(localStorage.getItem(STORAGE_KEYS['diario']) || '[]');
    
    // NOVO: Buscar metas cíclicas elegíveis para HOJE
    const metasCiclicas = renderizarMetasCiclicas(dataKey);
    
    // NOVO: Buscar estados cíclicos salvos para este dia
    const tarefasCiclicasSalvas = getTarefasCiclicasDoDia(dataKey);

// Armazenar o dataKey atual no modal
    modal.dataset.currentDataKey = dataKey;
    
    const el = modal;
    el.querySelector('.efficiency-date').textContent = `${dia} de ${new Date(currentYear, currentMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
    
    // NOVO: Buscar estado salvo das tarefas deste dia específico
    const tarefasDiaSalvo = getTarefasDoDia(dataKey);
    
    // Renderizar lista de tarefas
    const tarefasContainer = el.querySelector('.tarefas-lista');
    tarefasContainer.innerHTML = '';
    
    const totalTasks = todasMetas.length + metasCiclicas.length;
    if (totalTasks === 0) {
        tarefasContainer.innerHTML = '<p class="sem-tarefas">Nenhuma tarefa para este dia.</p>';
        el.querySelector('.efficiency-resultado').innerHTML = '<span class="eficiencia-valor">--%</span>';
    } else {
        let conclusas = 0;
        
        // 1. RENDER DAILY TASKS PRIMEIRO (preservar ordem)
        todasMetas.forEach((meta) => {
            const tarefaEl = document.createElement('div');
            tarefaEl.className = 'tarefa-item';
            
            const taskId = `${meta.texto}-${meta.prioridade}`;
            const concluidaDia = tarefasDiaSalvo[taskId];
            
            if (concluidaDia === true) conclusas++;
            
            tarefaEl.innerHTML = `
                <span class="tarefa-texto">${meta.texto} <small style="opacity: 0.7">(Diária)</small></span>
                <div class="tarefa-botoes">
                    <button class="btn-v ${concluidaDia === true ? 'active' : ''}" data-is-cyclic="false" data-task-id="${taskId}">✓</button>
                    <button class="btn-x ${concluidaDia === false ? 'active' : ''}" data-is-cyclic="false" data-task-id="${taskId}">✗</button>
                </div>
            `;
            
            tarefaEl.dataset.concluida = concluidaDia === true ? 'true' : concluidaDia === false ? 'false' : 'neutral';
            tarefaEl.dataset.taskId = taskId;
            tarefaEl.dataset.isCyclic = 'false';
            
            // Event listeners para daily (delegated)
            tarefaEl.querySelector('.btn-v').addEventListener('click', handleTaskToggle);
            tarefaEl.querySelector('.btn-x').addEventListener('click', handleTaskToggle);
            
            tarefasContainer.appendChild(tarefaEl);
        });
        
        // 2. SEPARADOR VISUAL (opcional)
        if (metasCiclicas.length > 0) {
            const separador = document.createElement('div');
            separador.innerHTML = '<hr style="margin: 1rem 0; opacity: 0.3;">';
            tarefasContainer.appendChild(separador);
        }
        
            // ===== UI helpers (apenas exibição de selo) =====
            function getPrazoDiasAtualPorTipo(tipo) {
                // UI apenas: segue PRAZO_DIAS do código (diário=1, semanal=7, mensal=30, anual=365)
                switch (tipo) {
                    case 'mensal':
                        return getPrazoDias('mensal');
                    case 'anual':
                        return getPrazoDias('anual');
                    default:
                        return 0;
                }
            }

            function getSeloCicloMensalAnual(meta, dataKeyDia, concluidaDia) {
                // Regras: mostrar selo só se não foi concluída antecipadamente no ciclo atual
                // - Bônus: data atual é anterior ao prazo final
                // - Obrigatória hoje: data atual é igual ao dia do prazo final
                // - Sem selo/oculta se já foi concluída antecipadamente no ciclo atual
                if (meta.tipo !== 'mensal' && meta.tipo !== 'anual') return '';

                // Se já foi concluída no ciclo atual, não exibir selo
                if (concluidaDia === true) return '';

                const prazoDias = getPrazoDiasAtualPorTipo(meta.tipo);
                const dataCriacao = new Date(meta.dataCriacao);
                const dataDia = new Date(dataKeyDia + 'T00:00:00');

                // Prazo final: data de criação + prazoDias (mesma referência do código: diasPassados >= prazoDias)
                const dataPrazo = new Date(dataCriacao);
                dataPrazo.setDate(dataPrazo.getDate() + prazoDias);

                // Normalizar para comparar somente data
                const dataDiaMidnight = new Date(dataDia);
                const dataPrazoMidnight = new Date(dataPrazo);
                dataDiaMidnight.setHours(0, 0, 0, 0);
                dataPrazoMidnight.setHours(0, 0, 0, 0);

                if (dataDiaMidnight.getTime() < dataPrazoMidnight.getTime()) {
                    return `<span class="selo-ciclico selo-bonus" title="Bônus">🎯 Bônus</span>`;
                }

                if (dataDiaMidnight.getTime() === dataPrazoMidnight.getTime()) {
                    return `<span class="selo-ciclico selo-obrigatoria" title="Obrigatória hoje">⚠️ Obrigatória hoje</span>`;
                }

                return '';
            }

            // 3. RENDER CÍCLICAS DEPOIS
            metasCiclicas.forEach((meta) => {
                const tarefaEl = document.createElement('div');
                tarefaEl.className = 'tarefa-item cyclic-task';
                tarefaEl.dataset.metaTipo = meta.tipo;
                
                const cyclicTaskId = meta.cyclicTaskId;
                const concluidaDia = tarefasCiclicasSalvas[cyclicTaskId];
                
                if (concluidaDia === true) conclusas++;

                const seloHtml = getSeloCicloMensalAnual(meta, dataKey, concluidaDia);
                
                tarefaEl.innerHTML = `
                    <span class="tarefa-texto">${meta.texto} <small style="opacity: 0.7; color: var(--primary-blue-30)">(${meta.tipo})</small>${seloHtml}</span>
                    <div class="tarefa-botoes">
                        <button class="btn-v ${concluidaDia === true ? 'active' : ''}" data-is-cyclic="true" data-task-id="${cyclicTaskId}">✓</button>
                        <button class="btn-x ${concluidaDia === false ? 'active' : ''}" data-is-cyclic="true" data-task-id="${cyclicTaskId}">✗</button>
                    </div>
                `;
            
                tarefaEl.dataset.concluida = concluidaDia === true ? 'true' : concluidaDia === false ? 'false' : 'neutral';
                tarefaEl.dataset.taskId = cyclicTaskId;
                tarefaEl.dataset.isCyclic = 'true';
            
                // Event listeners para cyclic (delegated)
                tarefaEl.querySelector('.btn-v').addEventListener('click', handleTaskToggle);
                tarefaEl.querySelector('.btn-x').addEventListener('click', handleTaskToggle);
            
                tarefasContainer.appendChild(tarefaEl);
            });
        
        // ✅ UNIFICAR: Handler global para todos os toggles (já delegados)
        function handleTaskToggle(e) {
            const btn = e.target;
            const tarefaEl = btn.closest('.tarefa-item');
            const isCheck = btn.classList.contains('btn-v');
            
            tarefaEl.classList.toggle('concluida', isCheck);
            tarefaEl.querySelector('.btn-v').classList.toggle('active', isCheck);
            tarefaEl.querySelector('.btn-x').classList.toggle('active', !isCheck);
            tarefaEl.dataset.concluida = isCheck ? 'true' : 'false';
            
            atualizarEficienciaModal(modal);
            
            // Salvar baseado no tipo - SEMPRE salva em calendario_tarefas_dia[taskId normal] para gráficos
            const dataKeyLocal = modal.dataset.currentDataKey;
            const taskIdLocal = tarefaEl.dataset.taskId;
            const isCyclicLocal = tarefaEl.dataset.isCyclic === 'true';
            const metaTipoLocal = tarefaEl.dataset.metaTipo || '';
            
            // SALVAR SEMPRE EM CALENDAR_TAREFAS para compatibilidade com gráficos individuais
            salvarEstadoTarefaDia(dataKeyLocal, taskIdLocal, isCheck);
            
            if (isCyclicLocal) {
                // ADICIONAL: Salvar também em cyclic se necessário (sem hall da fama aqui)
                const todasCiclicas = renderizarMetasCiclicas(dataKeyLocal);
                const meta = todasCiclicas.find(m => m.cyclicTaskId === taskIdLocal);
                if (meta) {
                    salvarEstadoTarefaCyclicDia(dataKeyLocal, taskIdLocal, isCheck, meta);
                }
                
                // Coleta anual pendente para confirmar depois (track state)
                if (metaTipoLocal === 'anual') {
                    // Sempre track anual tasks, but only trigger on final true
                    if (typeof window.pendingAnnualStates === 'undefined') {
                        window.pendingAnnualStates = {};
                    }
                    window.pendingAnnualStates[taskIdLocal] = isCheck;
                    
                    if (isCheck) {
                        // Animação e toast apenas quando marcado como feito
                        if (window.confetti) {
                            confetti({
                                particleCount: 100,
                                spread: 70,
                                origin: { y: 0.6 },
                                colors: ['#fbbf24', '#f59e0b', '#d97706']
                            });
                        }
                        const toast = document.createElement('div');
                        toast.className = 'motivacao-toast';
                        toast.textContent = '🏆 Conquista anual marcada! Confirme para eternizar! 🔥';
                        document.body.appendChild(toast);
                        setTimeout(() => toast.remove(), 3500);
                    }
                }
            }
            
            // FORCE UPDATE GRÁFICOS - destroy + recreate garante dados frescos
            if (chartInstance) chartInstance.destroy();
            renderIndividualCharts();
        }
        
        // Calcular eficiência inicial baseada no total (daily + cyclic)
        const eficiencia = totalTasks > 0 ? Math.round((conclusas / totalTasks) * 100) : 0;
        atualizarDisplayEficiencia(el, eficiencia);
    }
    
    // Inicializar pending states para este modal
    if (typeof window.pendingAnnualStates === 'undefined') {
        window.pendingAnnualStates = {};
    } else {
        window.pendingAnnualStates = {};
    }
    
    el.classList.add('active');
}

function atualizarEficienciaModal(modal) {
    const tarefas = modal.querySelectorAll('.tarefa-item');
    const dataKey = modal.dataset.currentDataKey;
    let total = 0;
    let conclusas = 0;

    tarefas.forEach(t => {
        const metaTipo = t.dataset.metaTipo || 'diaria';

        if (metaTipo === 'mensal' || metaTipo === 'anual') {
            const cyclicTaskId = t.dataset.taskId;
            const todasCiclicas = renderizarMetasCiclicas(dataKey);
            const metaCiclica = todasCiclicas.find(m => m.cyclicTaskId === cyclicTaskId);

            if (
                metaCiclica &&
                isObrigatoriaHoje(metaCiclica, dataKey) &&
                !isConcluidaAntecipadamenteNoCiclo(metaCiclica, dataKey)
            ) {
                total++;
                if (t.dataset.concluida === 'true') conclusas++;
            }
            return;
        }

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
window.onload = setupCalendarNavigation;
// ===== ESTATÍSTICAS =====
function atualizarEstatisticas() {
        // Total de metas cadastradas (apenas goals: diario, semanal, anual)
        let totalMetas = 0;
        const goalKeys = ['diario', 'semanal', 'mensal', 'anual'];
        goalKeys.forEach(key => {
            const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS[key]) || '[]');
            const metas = Array.isArray(raw) ? raw : [];
            totalMetas += metas.length;
        });

        // Calcular estatísticas a partir do CALENDÁRIO
        const calendarData = getCalendarData();

        let diasAtivos = new Set();
        let somaEficiencias = 0;

        Object.keys(calendarData).forEach(dataKey => {
            const eficiencia = (calendarData[dataKey] || 0);
            if (eficiencia !== undefined) {
                diasAtivos.add(dataKey);
                somaEficiencias += eficiencia;
            }
        });

        const eficiencia = diasAtivos.size > 0 ? Math.round(somaEficiencias / diasAtivos.size) : 0;

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

        // Dados para o gráfico principal (últimos 30 dias)
        const agora = new Date();
        const labels = [];
        const data = [];

        for (let i = 29; i >= 0; i--) {
            const dia = new Date(agora);
            dia.setDate(dia.getDate() - i);

            const dataKey = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
            const eficienciaDia = calendarData[dataKey];

            labels.push(
                dia.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
            );

            data.push(eficienciaDia !== undefined ? eficienciaDia : null);
        }

        // Se não tiver nenhum registro real (todos null) => retornar arrays vazios
        const temRegistroReal = data.some(v => v !== null && v !== undefined);
        if (!temRegistroReal) {
            return { labels: [], datasets: [] };
        }

        return {
            labels,
            datasets: [
                {
                    label: 'Eficiência (%)',
                    data,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: 'rgb(59, 130, 246)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6
                }
            ]
        };
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
        try {
            // Identificação do canvas (segura)
            const ctx = document.getElementById('eficiencia-chart')?.getContext('2d');

            if (!ctx) {
                console.warn('[renderEstatisticas] Canvas #eficiencia-chart não existe.');
                return;
            }

            // Gestão de instância: evita sobreposição e bugs de hover
            if (chartInstance) {
                chartInstance.destroy();
                chartInstance = null;
            }

            const dados = atualizarEstatisticas();

            const temDados = Array.isArray(dados?.labels) && dados.labels.length > 0 &&
                Array.isArray(dados?.datasets) && dados.datasets.length > 0;

            // Tratamento de dados vazios
            if (!temDados) {
                const statsSection = document.getElementById('secao-estatisticas');
                if (statsSection) {
                    let msg = document.getElementById('estatisticas-sem-dados');
                    if (!msg) {
                        msg = document.createElement('p');
                        msg.id = 'estatisticas-sem-dados';
                        msg.style.marginTop = '1rem';
                        msg.style.color = 'var(--text-secondary)';
                        msg.style.textAlign = 'center';
                        msg.textContent = 'Sem dados para este período';
                        statsSection.appendChild(msg);
                    } else {
                        msg.textContent = 'Sem dados para este período';
                    }
                }

                // Ainda assim, renderiza cards individuais
                renderIndividualCharts();
                return;
            }

            // Se chegou aqui, tem dados: remove mensagem antiga
            const msgAntiga = document.getElementById('estatisticas-sem-dados');
            msgAntiga?.remove();

            // new Chart(...) explícito e visível
            chartInstance = new Chart(ctx, {
                type: 'line',
                data: dados,
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

            renderIndividualCharts();
        } catch (error) {
            console.error('ERRO NA RENDERIZAÇÃO:', error);
        }
    }

    // ===== GRÁFICOS POR META =====
    const individualCharts = {};
    
    function renderIndividualCharts() {
        const container = document.getElementById('individual-charts-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Get all unique goals from daily/semanal/mensal (anual → Hall da Fama)
        const allGoals = new Map();
        ['diario', 'semanal', 'mensal'].forEach(key => {
            const metas = JSON.parse(localStorage.getItem(STORAGE_KEYS[key]) || '[]');
            metas.forEach(meta => {
                const id = `${meta.texto}-${meta.prioridade}`;
                if (!allGoals.has(id)) {
                    allGoals.set(id, { ...meta, view: key });
                }
            });
        });
        
        if (allGoals.size === 0) {
            container.innerHTML = '<p class="no-data-message">Nenhuma meta cadastrada ainda.</p>';
            return;
        }
        

allGoals.forEach((meta, id) => {
            const taskId = `${meta.texto}-${meta.prioridade}`;
            const flipContainer = document.createElement('div');
            flipContainer.className = 'flip-card';
            flipContainer.dataset.taskId = taskId;
            
            let dadosJanela;
            if (meta.view === 'diario') {
                dadosJanela = gerarJanela10Dias(taskId, meta);
            } else {
                // Semanal e mensal usam ciclo real (4 pontos)
                dadosJanela = gerarJanelaCicloReal(meta, 4);
            }
            const chartId = `chart-${id.replace(/[^a-zA-Z0-9]/g, '-')}`;
            
            flipContainer.innerHTML = `
                <div class="flip-card-inner">
                    <div class="flip-card-front">
                        <div class="chart-header">${meta.texto}<br><small>${meta.prioridade} - ${meta.view.charAt(0).toUpperCase() + meta.view.slice(1)}</small></div>
                        <canvas id="${chartId}" width="300" height="150"></canvas>
                    </div>
                    <div class="flip-card-back">
                        <!-- Stats injected on flip -->
                    </div>
                </div>
            `;
            container.appendChild(flipContainer);

            
// Render individual chart com JANELA DESLIZANTE FIXA


            // Add click handler after canvas ready
            flipContainer.addEventListener('click', (e) => {
                flipCardToggle(flipContainer);
            });
            
            setTimeout(() => {
                const ctx = document.getElementById(chartId);
                if (!ctx) return;
                
                if (individualCharts[id]) {
                    individualCharts[id].destroy();
                }

                
                const isDark = html.classList.contains('dark-mode');
                const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
                
                // Arrays fixos de 10 posições sempre
                const labels = dadosJanela.map(d => d.data);
                const values = dadosJanela.map(d => d.valor);
                const explicitamenteNao = dadosJanela.map(d => d.explicitamenteNao);
                const temRegistro = dadosJanela.map(d => d.temRegistro);
                
                // Função RIGOROSA para cor do ponto individualmente
                // VERDE: Se o valor for 1
                // VERMELHO: Se o valor for 0 E existe chave no localStorage indicando que o usuário marcou 'Não'
                // CINZA: Se o valor for 0 E NÃO existe nenhuma entrada/chave no localStorage para esse dia (dia ignorado)
                const getPointColor = (valor, temReg, explicitNao) => {
                    if (valor === 1) {
                        return 'rgb(75, 192, 192)'; // Verde - Tarefa realizada
                    } else if (temReg === true && explicitNao === true) {
                        return 'rgb(255, 99, 132)'; // Vermelho - Marcado explicitamente como Não
                    } else if (temReg === false) {
                        return 'rgb(189, 189, 189)'; // Cinza - Dia em branco/sem registro
                    } else {
                        return 'rgb(255, 99, 132)'; // Vermelho fallback
                    }
                };
                
                // Preparar array de cores dos pontos
                const pointColors = values.map((v, i) => getPointColor(v, temRegistro[i], explicitamenteNao[i]));
                
individualCharts[id] = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Concluída',
                            data: values,
                            borderWidth: 3,
                            stepped: 'middle',
                            tension: 0,
                            fill: true,
                            backgroundColor: 'rgba(75, 192, 192, 0.2)',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            pointRadius: 6,
                            pointHoverRadius: 8,
                            spanGaps: true,
                            segment: {
                                borderColor: (ctx) => ctx.p0.parsed.y === 1 ? 'rgb(75, 192, 192)' : 'rgb(255, 99, 132)',
                                backgroundColor: (ctx) => ctx.p0.parsed.y === 1 ? 'rgba(75, 192, 192, 0.25)' : 'rgba(255, 99, 132, 0.1)'
                            },
                            pointBackgroundColor: pointColors
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        layout: {
                            padding: {
                                bottom: 20
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: 1,
                                ticks: {
                                    stepSize: 1,
                                    callback: (val) => val === 1 ? 'Sim' : (val === 0 ? 'Não' : '')
                                },
                                grid: { 
                                    color: gridColor 
                                }
                            },
                            x: {
                                grid: { display: false },
                                ticks: {
                                    maxRotation: 45,
                                    minRotation: 45,
                                    autoSkip: true,
                                    font: {
                                        size: 10
                                    }
                                }
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
    
// ===== FUNÇÃO 1: encontrarDataOrigemGlobal() =====
// Encontra a primeira data com QUALQUER registro (0 ou 1) no histórico global
// Esta é a "Data de Origem" ÚNICA usada por TODOS os gráficos
function encontrarDataOrigemGlobal() {
    const tarefasCalendar = JSON.parse(localStorage.getItem(CALENDAR_TAREFAS) || '{}');
    const datasComDados = Object.keys(tarefasCalendar);
    
    // Se não há dados, usar hoje - 9 dias (últimos 10 dias)
    if (datasComDados.length === 0) {
        const hoje = new Date();
        hoje.setDate(hoje.getDate() - 9);
        return hoje.toISOString().split('T')[0];
    }
    
    let primeiraData = null;
    let menorDiff = Infinity;
    
    // Procurar a data mais antiga com ALGUM registro (de qualquer tarefa)
    for (let i = 0; i < datasComDados.length; i++) {
        const dataKey = datasComDados[i];
        const diaData = tarefasCalendar[dataKey];
        
        // Verificar se este dia tem ALGUM registro (não importa o valor)
        if (diaData && Object.keys(diaData).length > 0) {
            const dataObj = new Date(dataKey);
            const diffDias = Math.floor((new Date() - dataObj) / (1000 * 60 * 60 * 24));
            
            if (diffDias < menorDiff) {
                menorDiff = diffDias;
                primeiraData = dataKey;
            }
        }
    }
    
    // Se não encontrou nenhuma data com dados, usar hoje - 9 dias
    if (!primeiraData) {
        const hoje = new Date();
        hoje.setDate(hoje.getDate() - 9);
        return hoje.toISOString().split('T')[0];
    }
    
    return primeiraData;
}

// ===== FUNÇÃO 2: gerarDadosGrafico() =====
// USA .slice(-10) PARA LIMITAR A 10 DIAS conforme solicitado
// 1. Gerar TODOS os dados desde o primeiro registro
// 2. Aplicar .slice(-10) para pegar os ÚLTIMOS 10 dias
function gerarDadosGrafico(texto, prioridade, view) {
    const taskId = `${texto}-${prioridade}`;
    const tarefasCalendar = JSON.parse(localStorage.getItem(CALENDAR_TAREFAS) || '{}');
    
    // 1. Obter a Data de Origem ÚNICA (global)
    const dataOrigem = encontrarDataOrigemGlobal();
    const dataInicio = new Date(dataOrigem);
    const hoje = new Date();
    
    // 2. Calcular total de dias desde a data de origem até hoje
    let diffTotal = Math.floor((hoje - dataInicio) / (1000 * 60 * 60 * 24));
    const maxDias = Math.max(diffTotal, 1);  // Pelo menos 1 dia
    
    // 3. Gerar TODOS os dadosbrutos desde a data de origem
    const dadosbrutos = [];
    
    for (let i = 0; i <= maxDias; i++) {
        const dia = new Date(dataInicio);
        dia.setDate(dia.getDate() + i);
        const dataKey = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
        const diaData = tarefasCalendar[dataKey];
        
        // Lógica binária: 0 ou 1, NUNCA null
        let valor = 0;
        if (diaData && diaData[taskId] !== undefined) {
            valor = diaData[taskId] === true ? 1 : 0;
        }
        
        dadosbrutos.push({
            data: dia.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
            valor: valor
        });
    }
    
    // 4. APLICAR .slice(-10) CONFORME SOLICITADO
    const dadosLimitados = dadosbrutos.slice(-10);
    
    return dadosLimitados;
}

// ===== FUNÇÃO 3: getGoalHistory() (compatibilidade) =====
function getGoalHistory(texto, prioridade, view) {
    const dados = gerarDadosGrafico(texto, prioridade, view);
    
    return {
        dates: dados.map(d => d.data),
        values: dados.map(d => d.valor),
        temDados: true,
        primeiroRegistroIndex: 0
    };
}

// ===== HELPER: Get task status from BOTH storages =====

/**
 * Checks task status in calendario_tarefas_dia first, then ciclicas_tarefas_dia
 * @param {string} dataKey - YYYY-MM-DD
 * @param {string} simpleTaskId - texto-prioridade
 * @param {boolean} isWeekly - if true, also check cyclic ID
 * @param {object} meta - meta object for cyclicId reconstruction
 * @returns {object} {valor: 0/1, temRegistro: bool, explicitamenteNao: bool}
 */
function getTaskStatus(dataKey, simpleTaskId, isWeekly = false, meta = null) {
    // 1. Check daily storage first (always)
    const tarefasDia = JSON.parse(localStorage.getItem('calendario_tarefas_dia') || '{}');
    let status = tarefasDia[dataKey]?.[simpleTaskId];
    if (status !== undefined) {
        return {
            valor: status === true ? 1 : 0,
            temRegistro: true,
            explicitamenteNao: status === false
        };
    }

    if (isWeekly && meta) {
        // 2. Fallback: reconstruct cyclic ID and check cyclic storage
        const cyclicTaskId = getCyclicTaskId(meta);
        const tarefasCiclicas = JSON.parse(localStorage.getItem('ciclicas_tarefas_dia') || '{}');
        status = tarefasCiclicas[dataKey]?.[cyclicTaskId];
        if (status !== undefined) {
            return {
                valor: status === true ? 1 : 0,
                temRegistro: true,
                explicitamenteNao: status === false
            };
        }
    }

    // 3. No record
    return { valor: 0, temRegistro: false, explicitamenteNao: false };
}

/**
 * Flip Card Functions for ESTATÍSTICAS
 */
function calculateGoalStats(taskId) {
    const tarefasDia = JSON.parse(localStorage.getItem('calendario_tarefas_dia') || '{}');
    const history = [];
    
    // Collect ALL dates where this taskId has ANY record
    Object.keys(tarefasDia).forEach(dataKey => {
        const diaData = tarefasDia[dataKey];
        if (diaData && diaData[taskId] !== undefined) {
            history.push({
                date: dataKey,
                value: diaData[taskId] === true ? 1 : 0
            });
        }
    });
    
    if (history.length === 0) {
        console.log(`No data for ${taskId}`);
        return {
            eficiencia: 0,
            maxStreak: 0,
            totalSim: 0,
            totalRecords: 0,
            noData: true
        };
    }
    
    // Sort chronological (oldest first)
    history.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let trueCount = 0;
    let totalRecords = history.length;
    let currentStreak = 0;
    let maxStreak = 0;
    
    // Traverse REVERSE (newest last) for streak
    for (let i = history.length - 1; i >= 0; i--) {
        const record = history[i];
        if (record.value === 1) {
            currentStreak++;
            maxStreak = Math.max(maxStreak, currentStreak);
        } else {
            // Explicit false resets streak (gaps already filtered out)
            currentStreak = 0;
        }
    }
    
    trueCount = history.filter(r => r.value === 1).length;
    const eficiencia = totalRecords > 0 ? Math.round((trueCount / totalRecords) * 100) : 0;
    
    const stats = {
        eficiencia,
        maxStreak,
        totalSim: trueCount,
        totalRecords,
        noData: false
    };
    
    console.log(`Stats ${taskId}:`, stats);
    return stats;
}

function flipCardToggle(flipCardEl) {
    flipCardEl.classList.toggle('flipped');
    const backEl = flipCardEl.querySelector('.flip-card-back');
    if (!backEl) return;
    
    backEl.innerHTML = ''; // Clean slate, no canvas leak
    
    const taskId = flipCardEl.dataset.taskId;
    const stats = calculateGoalStats(taskId);
    
    if (stats.noData) {
        backEl.innerHTML = `
            <div class="no-data">
                Sem registros para análise<br>
                <small>Marque dias no calendário</small>
            </div>
        `;
        return;
    }
    
    backEl.innerHTML = `
        <div class="stats-item">
            <span class="stats-label">Eficiência</span>
            <span class="stats-value">${stats.eficiencia}%</span>
        </div>
        <div class="stats-item">
            <span class="stats-label">Maior Streak</span>
            <span class="stats-value">${stats.maxStreak} dias</span>
        </div>
        <div class="stats-item">
            <span class="stats-label">Total Sim</span>
            <span class="stats-value">${stats.totalSim}</span>
        </div>
    `;
}


// ===== JANELA DESLIZANTE FIXA DE 10 DIAS (Daily) =====
/**
 * Gera janela deslizante fixa de 10 dias (Hoje-9 até Hoje) - DAILY ONLY
 */
function gerarJanela10Dias(taskId, meta) {
    const hoje = new Date();
    const janela = [];
    
    for (let i = 9; i >= 0; i--) {
        const dia = new Date(hoje);
        dia.setDate(dia.getDate() - i);
        const dataKey = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
        
        const status = getTaskStatus(dataKey, taskId, false, null);
        
        const dataFormatada = dia.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short'
        }).replace('.', '');
        
        janela.push({
            data: dataFormatada,
            dataKey: dataKey,
            valor: status.valor,
            temRegistro: status.temRegistro,
            explicitamenteNao: status.explicitamenteNao
        });
    }
    
    return janela;
}


/**
 * Gera N pontos de ciclo recorrente baseados na dataCriacao da meta
 * @param {object} meta - meta com dataCriacao
 * @param {number} numCiclos - 4 para semanal/mensal
 * @returns Array de 4 datas cíclicas + status
 */
function gerarJanelaCicloReal(meta, numCiclos = 4) {
    const dataCriacao = new Date(meta.dataCriacao);
    const taskId = `${meta.texto}-${meta.prioridade}`;
    const hoje = new Date();
    const janela = [];
    
    const view = meta.view || '';
    let intervaloDias = 0;
    
    // Determinar intervalo baseado no tipo
    switch (view) {
        case 'semanal': intervaloDias = 7; break;
        case 'mensal': intervaloDias = 30; break; // ~1 mês
        default: return []; // Só semanal/mensal
    }
    
    // Encontrar último ciclo <= hoje
    let dataAtual = new Date(hoje);
    while (dataAtual > dataCriacao) {
        dataAtual.setDate(dataAtual.getDate() - intervaloDias);
    }
    
    // Gerar numCiclos pontos para trás da data de criação
    for (let i = numCiclos - 1; i >= 0; i--) {
        const dataCiclo = new Date(dataCriacao);
        dataCiclo.setDate(dataCiclo.getDate() - (i * intervaloDias));
        
        const dataKey = `${dataCiclo.getFullYear()}-${String(dataCiclo.getMonth() + 1).padStart(2, '0')}-${String(dataCiclo.getDate()).padStart(2, '0')}`;
        
        const status = getTaskStatus(dataKey, taskId, true, meta);
        
        const dataFormatada = dataCiclo.toLocaleDateString('pt-BR', {
            day: '2-digit', 
            month: 'short'
        }).replace('.', '');
        
        janela.push({
            data: dataFormatada,
            dataKey: dataKey,
            valor: status.valor,
            temRegistro: status.temRegistro,
            explicitamenteNao: status.explicitamenteNao
        });
    }
    
    return janela;
}


/**
 * Obtém dados formatados para o gráfico (arrays separados)
 * @param {string} taskId - ID da tarefa (texto-prioridade)
 */
function getDadosGrafico10Dias(taskId) {
    const janela = gerarJanela10Dias(taskId);
    
    return {
        labels: janela.map(d => d.data),
        values: janela.map(d => d.valor),
        dataKeys: janela.map(d => d.dataKey)
    };
}

// ===== FUNÇÃO 4: getDataOrigem() (exportar para uso externo) =====
function getDataOrigem() {
    return encontrarDataOrigemGlobal();
}

    // ===== AUTO-EXPIRAÇÃO ===== (runs at midnight)
    function setupMidnightCheck() {
    const ULTIMO_RESET = 'ultimo_reset_dia';
    const hoje = new Date().toDateString();
    const ultimoReset = localStorage.getItem(ULTIMO_RESET);

    // Helpers de segurança (não muda a estrutura geral do código)
    function safeParseJsonArray(raw, fallback = null) {
        try {
            if (raw === null || raw === undefined) return fallback;
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : fallback;
        } catch (e) {
            console.warn('[setupMidnightCheck] JSON inválido para array:', e);
            return fallback;
        }
    }

    if (ultimoReset !== hoje) {
        Object.keys(STORAGE_KEYS).forEach(key => {
            if (key === 'stats') return;

            const prazoDias = getPrazoDias(key);

            const storageKey = STORAGE_KEYS[key];
            const rawValue = localStorage.getItem(storageKey);

            // Preservar sempre se não for array válido
            const metas = safeParseJsonArray(rawValue, null);
            if (!metas) {
                console.info(`[setupMidnightCheck] Preservando (não é array válido): ${storageKey}`);
                return;
            }
            if (metas.length === 0) return;

            // Transformação (NUNCA produz [] porque é map), mas guardamos contra cenários inesperados
            const atualizadas = metas.map(meta => {
                const dataCriacao = new Date(meta.dataCriacao);
                const diasPassados = Math.floor((new Date() - dataCriacao) / (1000 * 60 * 60 * 24));

                if (diasPassados >= prazoDias && !meta.concluida) {
                    const dataKey = new Date().toISOString().split('T')[0].replace(/-/g, '-');
                    const calendarData = getCalendarData();
                    calendarData[dataKey] = 0;
                    saveCalendarData(calendarData);
                    return { ...meta, vencida: true };
                }
                return meta;
            });

            // Guarda extra: se por qualquer motivo a transformação vier vazia, não sobrescreve
            if (Array.isArray(atualizadas) && atualizadas.length === 0 && metas.length > 0) {
                console.warn(`[setupMidnightCheck] Não sobrescrevendo com []: ${storageKey}`);
                return;
            }

            localStorage.setItem(storageKey, JSON.stringify(atualizadas));
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
    
    // Garantir dark mode toggle sempre funciona
document.addEventListener('click', (e) => {
    if (e.target.id === 'theme-toggle' || e.target.closest('#theme-toggle')) {
        toggleTema();
    }
});
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const temaSalvo = localStorage.getItem(STORAGE_THEME);
        if (!temaSalvo) {
            html.classList.toggle('dark-mode', e.matches);
            if (document.getElementById('secao-estatisticas').classList.contains('active')) {
                renderEstatisticas();
            }
        }
    });
});

