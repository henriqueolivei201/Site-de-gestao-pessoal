// Gestão Pessoal - script.js
// Dark mode: respeita preferência do usuário (não aplica dark por padrão)
if (!window.supabaseClient) {

  const SUPABASE_URL = 'https://yxavkjumdojxhlyxslgl.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4YXZranVtZG9qeGhseXhzbGdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MTY3ODYsImV4cCI6MjA5NDE5Mjc4Nn0.7Dydnonx88tEIpRDodvZ37yTB61XjJmB_O_1njWJi5Y'; 
  
  window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}
document.addEventListener('DOMContentLoaded', async function() {
    // Theme init (garante que CSS aplica antes de qualquer render):
    try {
        const temaSalvo = localStorage.getItem('tema-preferido');
        if (temaSalvo === 'dark') {
            document.documentElement.classList.add('dark-mode');
        }
    } catch (e) {}



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

    // Storage
    const STORAGE_THEME = 'tema-preferido';

    const STORAGE_KEYS = {
        diario: 'metas_diario',
        semanal: 'metas_semanal',
        mensal: 'metas_mensal',
        anual: 'metas_anual',
        stats: 'estatisticas_geral',
        ciclicas: 'ciclicas_tarefas_dia',
        pontuacao: 'historico_pontuaao'
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
    const before = html.classList.contains('dark-mode');
    

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

async function confirmarMeta() {
        const texto = metaInput.value.trim();
        if (!texto) {
            metaInput.style.borderColor = 'var(--danger)';
            setTimeout(() => metaInput.style.borderColor = '', 2000);
            return;
        }

        const secaoAtiva = document.querySelector('.goals-section.active:not(.stats-section)');
        const listaContainer = secaoAtiva.querySelector('.goals-container');
        const view = secaoAtiva.id.replace('secao-', '');

        // Cria o card imediatamente (mantém a UX), mas a fonte de verdade passa a ser o Supabase.
        const normalizarPrioridade = (valor) => (valor || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

        const novaMeta = criarElementoMeta(texto, normalizarPrioridade(prioridadeSelecionada), view, null);

        listaContainer.insertBefore(novaMeta, listaContainer.firstChild);


        try {
            await salvarMeta(view, texto, prioridadeSelecionada);
            // Garantia: Supabase já voltou com o estado atualizado e a UI foi re-renderizada.
            // (salvarMeta já chama carregarMetas(view), mas mantemos aqui explícito para evitar regressão)
            await carregarMetas(view);
            atualizarEstatisticas();
        } catch (e) {
            console.error('Erro ao confirmar meta:', e);
        } finally {
            fecharModal();
        }
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
        if (view === 'estatisticas' || view === 'calendario' || view === 'pontuacao') {
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
            } else if (view === 'pontuacao') {
                renderPontuacao();
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

function criarElementoMeta(texto, prioridade, view, supabaseId) {
        const article = document.createElement('article');
        article.className = 'goal-item';
        article.dataset.id = supabaseId;
        const labelPrioridade = {
            alta: 'ALTA',
            media: 'MÉDIA',
            baixa: 'BAIXA'
        };
        
        const classePrioridade = {
            alta: 'prioridade-alta',
            media: 'prioridade-media',
            baixa: 'prioridade-baixa'
        };

        const prioridadeNorm = String(prioridade || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const textoLabel = labelPrioridade[prioridadeNorm] || prioridade;
        const classePrior = classePrioridade[prioridadeNorm] || prioridadeNorm;

        article.innerHTML = `
            <span class="goal-texto">${texto}</span>
            <span class="etiqueta-prioridade ${classePrior}">${textoLabel}</span>
            <button class="btn-excluir" aria-label="Excluir meta">&times;</button>
        `;

        
        const deleteBtn = article.querySelector('.btn-excluir');
        
        deleteBtn.addEventListener('click', async () => {
            try {
                const tarefaId = article.dataset.id;
                if (!tarefaId) throw new Error('ID da tarefa não encontrado no elemento.');

                // mantém UI otimista: remove o card e em seguida deleta no Supabase
                article.remove();

                await window.supabaseClient
                    .from('tarefas')
                    .delete()
                    .eq('id', tarefaId)
                    .eq('user_id', window.userId);

                await carregarMetas(view);
            } catch (e) {
                console.error('Erro ao excluir meta (Supabase):', e);
                // recarrega para restaurar estado correto
                await carregarMetas(view);
            } finally {
                atualizarEstatisticas();
            }
        });
        
        return article;
    }


async function salvarMeta(view, texto, prioridade) {
        try {
            if (!window.userId) throw new Error('Usuário não autenticado.');

// tabela tarefas: titulo/tipo/prioridade/user_id

            const tipoMap = {
                diario: 'diaria',
                semanal: 'semanal',
                mensal: 'mensal',
                anual: 'anual'
            };

            const normalizarPrioridade = (valor) => (valor || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');

            const payload = {
                titulo: texto,
                tipo: tipoMap[view] || view,
                prioridade: normalizarPrioridade(prioridade),

                user_id: window.userId,
                // usar null aqui para bater com o exemplo do console (e evitar rejeição por constraint)
                criada_em: new Date().toISOString()
            };

            await window.supabaseClient
                .from('tarefas')
                .insert([payload]);

            // Recarrega metas para atualizar UI
            await carregarMetas(view);
        } catch (err) {
            console.error('Erro ao criar meta (Supabase):', err);
            alert(err?.message || 'Falha ao criar meta.');
        }
    }

    async function removerMeta(view, texto) {
        try {
            if (!window.userId) throw new Error('Usuário não autenticado.');

            // Remove todas linhas da tarefa que casam titulo/tipo e user
            // (como o app não usa uuid, remove por filtros lógicos)
            const { data: existentes, error: selErr } = await window.supabaseClient
                .from('tarefas')
                .select('id')
                .eq('user_id', window.userId)
                .eq('titulo', texto)
                .eq('tipo', view);

            if (selErr) throw selErr;

            const ids = (existentes || []).map(r => r.id);
            if (ids.length === 0) return;

            await window.supabaseClient
                .from('tarefas')
                .delete()
                .in('id', ids);

            await carregarMetas(view);
        } catch (err) {
            console.error('Erro ao remover meta (Supabase):', err);
            alert(err?.message || 'Falha ao remover meta.');
        }
    }

    function salvarEstadoCheckbox(article, concluida, texto, prioridade, view) {
        // Mantido para não mexer em lógica não usada no fluxo atual
        // (a migração de concluida global das metas é tratada pela tabela tarefas via etapas futuras)
    }

    async function carregarMetas(view) {
        const container = document.getElementById(`lista-${view}`);
        if (!container) return;

        try {
            container.innerHTML = '';
            if (!window.userId) return;

            const tipoMap = {
                diario: 'diaria',
                semanal: 'semanal',
                mensal: 'mensal',
                anual: 'anual'
            };

            const tipoUsado = tipoMap[view] || view;
            const { data: metas, error } = await window.supabaseClient
                .from('tarefas')
                .select('id, titulo, tipo, prioridade, criada_em')
                .eq('user_id', window.userId)
                .eq('tipo', tipoUsado);



        


            if (error) throw error;

            (metas || []).forEach((meta) => {
                const elemento = criarElementoMeta(meta.titulo, meta.prioridade, view, meta.id);
                container.appendChild(elemento);
            });

        } catch (err) {
            console.error('Erro ao carregar metas (Supabase):', err);
            container.innerHTML = '<p class="no-data-message">Falha ao carregar metas.</p>';
        }
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
    // Para metas anuais, a regra no app é aparecer em todos os dias do calendário.
    // Então consideramos “obrigatória” sempre.
    if (metaCiclica?.tipo === 'anual') return true;

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

// ===== PONTUAÇÃO (Histórico + Rank) =====
// STORAGE_KEYS já existe no código; adicionaremos a chave no objeto.

const RANKS = [
    { nome: 'Iniciante',    pontos: 0,    icon: '🐱', punicao: 1,   desc: 'Primeira semana de uso.' },
    { nome: 'Amador',       pontos: 300,  icon: '​🐺​', punicao: 1,   desc: '~3 meses de consistência.' },
    { nome: 'Esforçado',    pontos: 1000, icon: '🐯', punicao: 1,   desc: '~6-8 meses. O hábito está formado.' },
    { nome: 'Disciplinado', pontos: 2500, icon: '​🦁', punicao: 1.5, desc: '~1 ano. Você é referência.' },
    { nome: 'Imparável',    pontos: 4500, icon: '🐻', punicao: 2,   desc: 'A reta final (Rumo aos 2 anos).' },
    { nome: 'Lendário',     pontos: 6000, icon: '🐉👑', punicao: 3,   desc: 'Consagração Total.' }
];

const PONTOS_POR_TIPO = { diario: 1, semanal: 7, mensal: 30, anual: 365 };

function getRankAtual(pontuacaoTotal) {
    let rankAtual = RANKS[0];
    for (const rank of RANKS) {
        if (pontuacaoTotal >= rank.pontos) rankAtual = rank;
    }
    return rankAtual;
}

async function renderPontuacao() {
    const pontuacaoTotalDisplay = document.getElementById('pontuacao-total-display');
    const pontuacaoRankDisplay = document.getElementById('pontuacao-rank-display');
    const conquistasContainer = document.getElementById('conquistas-container');
    const canvasEl = document.getElementById('pontuacao-chart');

    if (!pontuacaoTotalDisplay || !pontuacaoRankDisplay || !conquistasContainer || !canvasEl) return;

    // Pontuação total calculada (fonte de cálculo)
    const pontuacaoTotal = await calcularPontuacaoTotal();
    const rankAtual = getRankAtual(Math.max(0, pontuacaoTotal));

    // Persistir no Supabase (fonte de verdade)
    let userData = null;
    try {
        const { data, error: selErr } = await window.supabaseClient
            .from('perfil_usuario')
            .select('pontos, rank')
            .eq('user_id', window.userId)
            .single();

        if (selErr) throw selErr;
        userData = data;


        const novosPontos = Math.round(pontuacaoTotal);
        const novoRank = rankAtual?.nome;

        // Update apenas se mudou (evita writes desnecessários)
        if (userData?.pontos !== novosPontos || userData?.rank !== novoRank) {
            const { error: updErr } = await window.supabaseClient
                .from('perfil_usuario')
                .update({ pontos: novosPontos, rank: novoRank })
                .eq('user_id', window.userId);

            if (updErr) throw updErr;
        }
    } catch (err) {
        console.error('Erro ao persistir pontuação no Supabase:', err);
    }

    // UI base (fonte de verdade: Supabase)
    const pontosSupabase = Number(userData?.pontos ?? pontuacaoTotal);
    const rankSupabase = userData?.rank ?? rankAtual?.nome;

    pontuacaoTotalDisplay.textContent = `${Math.max(0, Math.round(pontosSupabase))} pts`;

    // rankSupabase pode ser nome; garantir render com icon correto
    const rankObj = RANKS.find(r => r.nome === rankSupabase) || rankAtual;
    // FIX #2: Legenda (rank inferior) deve exibir rank atual e pontos atuais: "Iniciante (2 pts)"
    pontuacaoRankDisplay.innerHTML = `${rankObj.icon} <strong>${rankObj.nome} (${Math.max(0, Math.round(pontosSupabase))} pts)</strong>`;


    // Garantir chart limpo
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    // Atualizar histórico e gráfico
    let historico = await gerarHistoricoPontuacao();


    // FIX #3: gráfico vazio -> garantir uma “linha” com pelo menos 2 pontos (início + atual)
    if (!Array.isArray(historico) || historico.length === 0) {
        const hoje = new Date();
        const d0 = new Date(hoje);
        d0.setDate(d0.getDate() - 1);
        const pontosAtual = Math.max(0, Math.round(pontosSupabase ?? pontuacaoTotal));
        historico = [
            { dataKey: d0.toISOString().split('T')[0], pontosDia: 0, acumulado: pontosAtual },
            { dataKey: hoje.toISOString().split('T')[0], pontosDia: 0, acumulado: pontosAtual }
        ];
    }

    const dataAcumuladaRaw = historico.map(h => h.acumulado);
    const dataKeysRaw = historico.map(h => h.dataKey);

    // Suporte a histórico longo: agrupar X conforme quantidade de pontos.
    const pontosCount = historico.length;
    let labels = [];
    let dataAcumulada = [];


    if (pontosCount <= 30) {

        // Até 30 dias: mostra cada dia
        labels = dataKeysRaw.map(k => {
            const d = new Date(k + 'T00:00:00');
            return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        });
        dataAcumulada = dataAcumuladaRaw;
    } else if (pontosCount <= 180) {

        // 30 a 180 dias: agrupa por semana (pega o acumulado do último dia da semana)
        const stride = 7;
        for (let i = 0; i < pontosCount; i += stride) {
            const end = Math.min(i + stride - 1, pontosCount - 1);

            const k = dataKeysRaw[end];
            const d = new Date(k + 'T00:00:00');
            labels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }));
            dataAcumulada.push(dataAcumuladaRaw[end]);
        }
    } else {
        // > 180 dias: agrupa por mês (pega o acumulado do último dia do mês)
        const mapMes = new Map(); // key: YYYY-MM -> {label, idx}
        for (let i = 0; i < pontosCount; i++) {

            const k = dataKeysRaw[i];
            const [y, m] = k.split('-');
            const keyMes = `${y}-${m}`;
            mapMes.set(keyMes, i); // sobrescreve => fica no último dia do mês
        }

        const keysOrdenadas = Array.from(mapMes.keys()).sort();
        for (const keyMes of keysOrdenadas) {
            const idx = mapMes.get(keyMes);
            const k = dataKeysRaw[idx];
            const d = new Date(k + 'T00:00:00');
            labels.push(d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
            dataAcumulada.push(dataAcumuladaRaw[idx]);
        }
    }


    const maxPontos = Math.max(0, ...dataAcumulada.map(n => Number(n) || 0));
    console.log('[pontuacao-chart] Labels:', labels);
    console.log('[pontuacao-chart] Values:', dataAcumulada);
    console.log('[pontuacao-chart] MaxPontos:', maxPontos);



    const ctx = canvasEl.getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Pontuação Acumulada',
                data: dataAcumulada,
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4
            }]

        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 0,
                    beginAtZero: true,
                    // FIX #1: escala do eixo Y deve refletir os valores reais de pontos
                    // (evita ficar “preso” em 0..1)
                    max: (() => {
                        const maxPontosY = Math.max(0, ...dataAcumulada.map(n => Number(n) || 0));
                        return Math.ceil(maxPontosY * 1.2); // 20% acima do máximo
                    })(),
                    ticks: {
                        callback: (v) => `${v} pts`
                    },
                    grid: { color: 'rgba(0,0,0,0.08)' }
                },
                x: { grid: { display: false } }
            },
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (items) => items?.[0]?.label || '',
                        label: (ctx) => ` ${ctx.parsed.y} pts`
                    }
                }
            }
        }
    });


    // Hall da Fama: desbloqueios por rank (sem mexer em carregarHallFama)
    // Usa historico_pontuacao (pontuacao total atual) e RANKS.forEach
    const desbloqueadas = [];
    RANKS.forEach((r) => {
        const desbloqueada = pontuacaoTotal >= r.pontos;
            if (desbloqueada) desbloqueadas.push(r);

        // Se desbloqueou agora pela primeira vez, salva no Hall da Fama
        if (desbloqueada) {
            const hallFama = JSON.parse(localStorage.getItem(HALL_FAMA_STORAGE) || '[]');
            const idConquista = `rank_${r.nome}`;
            const jaExiste = hallFama.some(c => c.id === idConquista);
            if (!jaExiste) {
                hallFama.unshift({
                    id: idConquista,
                    texto: `Rank ${r.nome} desbloqueado!`,
                    prioridade: 'Alta',
                    dataConquista: new Date().toLocaleDateString('pt-BR', {
                        day: '2-digit', month: 'long', year: 'numeric', weekday: 'long'
                    }),
                    dataKey: new Date().toISOString().split('T')[0]
                });
                localStorage.setItem(HALL_FAMA_STORAGE, JSON.stringify(hallFama));
            }
        }
    });

    // Renderizar conquistas na seção de Pontuação (somente UI; Hall da Fama fica na outra aba)
    conquistasContainer.innerHTML = '';
    if (desbloqueadas.length === 0) {
        conquistasContainer.innerHTML = '<p class="no-data-message" style="text-align:center; color: var(--text-secondary);">Nenhum rank desbloqueado ainda.</p>';
    } else {
        const list = document.createElement('div');
        list.className = 'pontuacao-conquistas-list';
        desbloqueadas.slice().reverse().forEach(r => {
            const item = document.createElement('div');
            item.className = 'pontuacao-conquista-item';
            item.innerHTML = `${r.icon} ${r.nome} (${r.pontos} pts)`;
            list.appendChild(item);
        });
        conquistasContainer.appendChild(list);
    }

    // também atualiza a seção Estatísticas para refletir (se estiver aberta)
    // (não altera carregarHallFama)
    return;
}


async function calcularPontuacaoTotal() {
  const { data: registros, error: errReg } = await window.supabaseClient
    .from('registros')
    .select('status, tarefa_id')
    .eq('user_id', window.userId)

  const { data: tarefas, error: errTar } = await window.supabaseClient
    .from('tarefas')
    .select('id, tipo')
    .eq('user_id', window.userId)

  if (errReg || errTar || !registros || !tarefas) return 0

  const pontos = { diaria: 1, semanal: 7, mensal: 30, anual: 365 }
  let total = 0

  registros.forEach(r => {
    const tarefa = tarefas.find(t => t.id === r.tarefa_id)
    if (!tarefa) return
    if (r.status === true) total += pontos[tarefa.tipo] || 0
    if (r.status === false) total -= pontos[tarefa.tipo] || 0
  })

  return Math.max(0, total)
}


// --- Fim do calcularPontuacaoTotal() ---




async function gerarHistoricoPontuacao() {
    const hoje = new Date();

    // 1) Definir dataInicio como a primeira data com qualquer registro
    let dataInicio = hoje.toISOString().split('T')[0];
    try {
        const { data: primeiroRegistro } = await window.supabaseClient
            .from('registros')
            .select('data')
            .eq('user_id', window.userId)
            .order('data', { ascending: true })
            .limit(1);

        dataInicio = primeiroRegistro?.[0]?.data || dataInicio;
    } catch (e) {
        // fallback: hoje
    }

    // 2) Buscar registros do Supabase (fonte de verdade)
    //    Calcularemos pontos por dia a partir do status true/false e do tipo da tarefa.
    const pontosPorTipo = { diaria: 1, semanal: 7, mensal: 30, anual: 365 };

    const { data: registros } = await window.supabaseClient
        .from('registros')
        .select('data, status, tarefas(tipo)')
        .eq('user_id', window.userId)
        .order('data', { ascending: true });

    // Se não houver registros, retorna linha zerada (2 pontos, coerente com FIX #3)
    if (!Array.isArray(registros) || registros.length === 0) {
        return [];
    }

    // Agrupar registros por data (YYYY-MM-DD)
    const registrosPorDia = registros.reduce((acc, r) => {
        const dataKey = r?.data;
        if (!dataKey) return acc;
        acc[dataKey] = acc[dataKey] || [];
        acc[dataKey].push(r);
        return acc;
    }, {});

    const historico = [];
    let acumulado = 0;

    const dataInicialObj = new Date(dataInicio + 'T00:00:00');
    const dataHojeObj = new Date(hoje.toISOString().split('T')[0] + 'T00:00:00');

    for (let cursor = new Date(dataInicialObj); cursor <= dataHojeObj; cursor.setDate(cursor.getDate() + 1)) {
        const dataKey = cursor.toISOString().split('T')[0];

        // multiplicador baseado no acumulado real até este ponto
        const mult = getRankAtual(Math.max(0, acumulado)).punicao;

        const registrosDia = registrosPorDia[dataKey] || [];
        let pontosDia = 0;

        registrosDia.forEach(r => {
            const tipo = r?.tarefas?.tipo;
            if (!tipo || !(pontosPorTipo[tipo] !== undefined)) return;

            const basePontos = pontosPorTipo[tipo];
            if (r.status === true) pontosDia += basePontos;
            if (r.status === false) pontosDia -= basePontos * mult;
        });

        acumulado += pontosDia;
        historico.push({ dataKey, pontosDia, acumulado });
    }

    return historico;
}



function getCalendarData() {
return JSON.parse(localStorage.getItem(CALENDAR_STORAGE) || '{}');
}

function saveCalendarData(data) {
    localStorage.setItem(CALENDAR_STORAGE, JSON.stringify(data));
}

// NOVA: Função para obter status das tarefas de um dia específico (Supabase)
// OBS: 'tarefas' não tem coluna 'data' no seu schema atual.
// Então: buscamos as tarefas do usuário (UUID + titulo/prioridade)
// e cruzamos com os registros do dia em `registros`.
async function getTarefasDoDia(dataKey) {
    try {
        if (!window.userId) return {};

        // 1) Tarefas (sem filtro de data)
        const { data: tarefas, error: tarefasErr } = await window.supabaseClient
            .from('tarefas')
            .select('id, titulo, prioridade, tipo');

        if (tarefasErr) throw tarefasErr;

        // 2) Registros do dia (status por tarefa_id)
        const { data: registros, error: registrosErr } = await window.supabaseClient
            .from('registros')
            .select('tarefa_id, status')
            .eq('user_id', window.userId)
            .eq('data', dataKey);

        if (registrosErr) throw registrosErr;

        const tarefasDia = {};

        // Converte registros: tarefa_id -> status
        const registrosByTaskId = {};
        (registros || []).forEach(r => {
            if (r?.tarefa_id) registrosByTaskId[r.tarefa_id] = r.status;
        });

        // Mantém formato esperado pelo app: { [taskId]: boolean }
        (tarefas || []).forEach(row => {
            const titulo = row.titulo ?? '';
            const prioridade = row.prioridade ?? '';
            const taskId = `${titulo}-${prioridade}`;

            if (Object.prototype.hasOwnProperty.call(registrosByTaskId, row.id)) {
                tarefasDia[taskId] = registrosByTaskId[row.id];
            }
        });

        return tarefasDia;
    } catch (err) {
        console.error('Erro ao obter tarefas do dia (Supabase):', err);
        return {};
    }
}


// NOVA: Função para salvar estado de uma tarefa específica de um dia (Supabase)
// NOVO: salva status por dia na tabela `registros`
// - taskId é UUID de `tarefas`
// - status: boolean (true=feita, false=não feita)
//
// IMPORTANTE: o modal deve setar tarefaEl.dataset.tarefaId
async function salvarEstadoRegistroDia(dataKey, tarefaId, statusBoolean) {
    try {
        if (!window.userId) throw new Error('Usuário não autenticado.');
        if (!tarefaId) throw new Error('tarefaId (UUID) não encontrado.');
        if (typeof statusBoolean !== 'boolean') throw new Error('statusBoolean deve ser boolean.');

        const { error } = await window.supabaseClient
            .from('registros')
            .upsert(
                {
                    tarefa_id: tarefaId,
                    user_id: window.userId,
                    data: dataKey,
                    status: statusBoolean
                },
                {
                    // UNIQUE(tarefa_id, data, user_id)
                    onConflict: 'tarefa_id,data,user_id'
                }
            );

        if (error) throw error;
    } catch (err) {
        console.error('Erro ao salvar estado da tarefa no registro (Supabase):', err);
    }
}

// ===== NOVAS FUNÇÕES PARA METAS CÍCLICAS =====
// Verifica se dataKey é dia de ciclo para meta mensal (mesmo dia do mês)
function isDiaCicloMensal(meta, dataKey) {
    const origemIso = meta.criada_em || meta.dataCriacao;
    const dataCriacao = new Date(origemIso);
    const dataHoje = new Date(dataKey + 'T00:00:00');

    const diaDoMesCriacao = dataCriacao.getDate();
    const diaDoMesDataKey = dataHoje.getDate();

    const resultado = diaDoMesCriacao === diaDoMesDataKey;

    // LOG (para confirmar o bug do mensal no modal do calendário)
    if (meta?.tipo === 'mensal') {
        console.log('Mensal:', {
            titulo: meta?.titulo,
            criada_em: meta?.criada_em,
            diaMes_criacao: diaDoMesCriacao,
            diaMes_modal: diaDoMesDataKey,
            passa: resultado
        });
    }

    return resultado;
}

// Verifica se dataKey é dia de ciclo para meta semanal (mesmo dia da semana da criação)
function isDiaCicloSemanal(meta, dataKey) {
    const criadoEm = new Date(meta.criada_em || meta.dataCriacao);
    const dataHoje = new Date(dataKey + 'T00:00:00');
    return criadoEm.getDay() === dataHoje.getDay();
}

// Verifica se dataKey é dia de ciclo para meta anual
// Regra do app: metas anuais aparecem em TODOS os dias do calendário (sem filtro por data)
function isDiaCicloAnual(meta, dataKey) {
    return true;
}





// Gera taskId único para metas cíclicas: 'cyc_[texto-prioridade]_[dataCriacao curta]'
function getCyclicTaskId(meta) {
    const criadoEmIso = meta.criada_em || meta.dataCriacao;
    const titulo = meta.titulo || meta.texto;
    const prioridade = meta.prioridade || meta.tipo;

    if (!criadoEmIso || !titulo || !prioridade) {
        console.warn('[getCyclicTaskId] meta inválida para criar id:', meta);
        return null;
    }

    const dataCurta = new Date(criadoEmIso).toISOString().split('T')[0].replace(/-/g, '');
    return `cyc_${titulo.replace(/[^a-zA-Z0-9]/g, '_')}-${prioridade}_${dataCurta}`;
}


// ===== FUNÇÃO PRINCIPAL: renderizarMetasCiclicas(dataKey) =====
/**
 * Retorna metas semanal/anual elegíveis para checklist NO EXATO dataKey
 * - Semanal: mesmo dia da semana da criação
 * - Anual: mesma data (DD/MM) independente do ano
 * Formato: [{texto, prioridade, tipo: 'semanal'|'anual', cyclicTaskId, dataOrigem}]
 */
function renderizarMetasCiclicas(dataKey, tarefasSupabase = []) {
    const metasCiclicas = [];

    // Fonte das metas cíclicas:
    // - Se tarefasSupabase foi fornecido (modal do calendário), filtrar por tipo aqui
    // - Caso contrário, manter fallback para localStorage
    const metasMensais = tarefasSupabase.length ? (tarefasSupabase || []).filter(t => t.tipo === 'mensal') : JSON.parse(localStorage.getItem(STORAGE_KEYS.mensal) || '[]');
    const metasSemanais = tarefasSupabase.length ? (tarefasSupabase || []).filter(t => t.tipo === 'semanal') : JSON.parse(localStorage.getItem(STORAGE_KEYS.semanal) || '[]');
    const metasAnuais = tarefasSupabase.length ? (tarefasSupabase || []).filter(t => t.tipo === 'anual') : JSON.parse(localStorage.getItem(STORAGE_KEYS.anual) || '[]');
    metasMensais.forEach(meta => {
        const ehDia = isDiaCicloMensal(meta, dataKey);
        console.log('[DEBUG renderizarMetasCiclicas] mensal', {
            dataKey,
            meta: { texto: meta?.texto, prioridade: meta?.prioridade, dataCriacao: meta?.dataCriacao },
            isDiaCicloMensal: ehDia
        });

        if (ehDia) {
            metasCiclicas.push({
                ...meta,
                tipo: 'mensal',
                cyclicTaskId: getCyclicTaskId(meta)
            });
        }
    });

    // Carregar metas_semanal
    metasSemanais.forEach(meta => {
        const ehDia = isDiaCicloSemanal(meta, dataKey);

        // DEBUG solicitado: logar semanal para entender parse/comparação
        if (meta?.tipo === 'semanal') {
            const dataCriacao = new Date(meta.criada_em);
            const dataModal = new Date(dataKey);
            console.log('Semanal:', {
                titulo: meta.titulo,
                criada_em: meta.criada_em,
                diaSemana_criacao: dataCriacao.getDay(),
                diaSemana_modal: dataModal.getDay(),
                passa: dataCriacao.getDay() === dataModal.getDay()
            });
        }

        console.log('[DEBUG renderizarMetasCiclicas] semanal', {
            dataKey,
            meta: { titulo: meta?.titulo, prioridade: meta?.prioridade, criada_em: meta?.criada_em },
            isDiaCicloSemanal: ehDia
        });

        if (ehDia) {
            metasCiclicas.push({
                ...meta,
                tipo: 'semanal',
                cyclicTaskId: getCyclicTaskId(meta)
            });
        }
    });


    // Carregar metas_anual
    metasAnuais.forEach(meta => {
        const ehDia = isDiaCicloAnual(meta, dataKey);
        console.log('[DEBUG renderizarMetasCiclicas] anual', {
            dataKey,
            meta: { texto: meta?.texto, prioridade: meta?.prioridade, dataCriacao: meta?.dataCriacao },
            isDiaCicloAnual: ehDia
        });

        if (ehDia) {
            metasCiclicas.push({
                ...meta,
                tipo: 'anual',
                cyclicTaskId: getCyclicTaskId(meta)
            });
        }
    });

    const tiposCount = metasCiclicas.reduce((acc, m) => {
        acc[m.tipo] = (acc[m.tipo] || 0) + 1;
        return acc;
    }, {});

    console.log('[DEBUG renderizarMetasCiclicas] retorno', {
        dataKey,
        totalCiclicas: metasCiclicas.length,
        tipos: tiposCount,
        exemplos: metasCiclicas.slice(0, 10).map(m => ({
            tipo: m.tipo,
            texto: m.texto,
            prioridade: m.prioridade,
            cyclicTaskId: m.cyclicTaskId
        }))
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

async function abrirModalEficiencia(dataKey, dia) {
    const calendarData = getCalendarData();

    // Busca também via Supabase (fonte de verdade)
    // - tarefas (para obter UUIDs)
    // - registros do dia (status por tarefa_id)

    if (!window.userId) return;

    let registrosDoDiaById = {};
    try {
        const { data: registrosDoDia, error: registrosErr } = await window.supabaseClient
            .from('registros')
            .select('tarefa_id, status')
            .eq('user_id', window.userId)
            .eq('data', dataKey);

        if (registrosErr) throw registrosErr;

        (registrosDoDia || []).forEach(r => {
            if (r?.tarefa_id) registrosDoDiaById[r.tarefa_id] = r.status;
        });
    } catch (e) {
        console.error('Erro ao buscar registros do dia (Supabase):', e);
    }


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
        modal.querySelector('#btn-limpar-dia').addEventListener('click', async () => {
            const currentDataKey = modal.dataset.currentDataKey;

            try {
                // 0) Remove registros do dia em Supabase (fonte de verdade)
                if (currentDataKey && window.userId) {
                    const { error: delErr } = await window.supabaseClient
                        .from('registros')
                        .delete()
                        .eq('user_id', window.userId)
                        .eq('data', currentDataKey);
                    if (delErr) throw delErr;
                }
            } catch (e) {
                console.error('Erro ao limpar registros (Supabase):', e);
            }

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

            // Atualiza UI
            modal.classList.remove('active');
            renderCalendar();
            renderEstatisticas(); // Atualiza gráficos automaticamente (inclui individual charts)
        });
        
// Confirmar - salva o status das tarefas E atualiza os gráficos
        modal.querySelector('#btn-confirmar-dia').addEventListener('click', () => {
            const currentDataKey = modal.dataset.currentDataKey;
            const tarefasContainer = modal.querySelector('.tarefas-lista');
            const tarefas = tarefasContainer.querySelectorAll('.tarefa-item');

            // remove handlers duplicados caso o modal tenha sido recriado
            // (mantém o comportamento sem afetar a lógica do checklist)

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

// Buscar tarefas/Metas via Supabase (fonte de verdade)
    // 1) Limpa chaves antigas que podem interferir
    try {
        localStorage.removeItem('metas_diario');
        localStorage.removeItem('metas_semanal');
        localStorage.removeItem('metas_mensal');
        localStorage.removeItem('metas_anual');
        localStorage.removeItem('calendario_tarefas_dia');
        localStorage.removeItem('ciclicas_tarefas_dia');
    } catch (e) {}

    // 2) Carrega metas diárias cadastradas (tarefas tipo=diaria) para compor a lista do modal
            const { data: tarefasSupabase, error: metasErr } = await window.supabaseClient

        .from('tarefas')
                .select('id, titulo, tipo, prioridade')
        .eq('user_id', window.userId)
        .in('tipo', ['diaria']);

    if (metasErr) throw metasErr;

    const todasMetas = (tarefasSupabase || [])
        .filter(t => t.tipo === 'diaria');

    // NOVO: Buscar metas cíclicas elegíveis para HOJE
    // IMPORTANTE: para semanal/mensal/anual aparecerem corretamente no modal,
    // precisamos alimentar a renderização com os registros do Supabase.
    // Então vamos carregar TODAS as tarefas do usuário (sem filtrar por tipo)
    // e passar para renderizarMetasCiclicas via argumento.

    const { data: tarefasModal, error: tarefasModalErr } = await window.supabaseClient
        .from('tarefas')
.select('id, titulo, tipo, prioridade, criada_em')
        .eq('user_id', window.userId);

    if (tarefasModalErr) throw tarefasModalErr;

    

    const metasCiclicas = renderizarMetasCiclicas(dataKey, tarefasModal || []);


    
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
            // status por UUID vinda de `registros`
            const tarefaId = meta.id;
            const concluidaDia = registrosDoDiaById[tarefaId];

            
            if (concluidaDia === true) conclusas++;
            
            tarefaEl.innerHTML = `
                <span class="tarefa-texto">${meta.titulo ?? meta.texto} <small style="opacity: 0.7">(Diária)</small></span>

                <div class="tarefa-botoes">
                    <button class="btn-v ${concluidaDia === true ? 'active' : ''}" data-is-cyclic="false" data-task-id="${taskId}">✓</button>
                    <button class="btn-x ${concluidaDia === false ? 'active' : ''}" data-is-cyclic="false" data-task-id="${taskId}">✗</button>
                </div>
            `;
            
            tarefaEl.dataset.concluida = concluidaDia === true ? 'true' : concluidaDia === false ? 'false' : 'neutral';
            tarefaEl.dataset.taskId = taskId;
            tarefaEl.dataset.tarefaId = tarefaId;
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
                const tarefaIdUuid = meta.id; // UUID de `tarefas`

                // Estado do dia vem de `registros` (via registrosDoDiaById)
                const concluidaDiaRegistro = tarefaIdUuid ? registrosDoDiaById[tarefaIdUuid] : undefined;

                // fallback caso algum fluxo antigo ainda preencha localStorage (não é fonte de verdade)
                const concluidaDiaLegacy = tarefasCiclicasSalvas[cyclicTaskId];
                const concluidaDia = concluidaDiaRegistro !== undefined ? concluidaDiaRegistro : concluidaDiaLegacy;

                if (concluidaDia === true) conclusas++;

                const seloHtml = getSeloCicloMensalAnual(meta, dataKey, concluidaDia);

                tarefaEl.innerHTML = `
                    <span class="tarefa-texto">${meta.titulo ?? meta.texto} <small style="opacity: 0.7; color: var(--primary-blue-30)">(${meta.tipo})</small>${seloHtml}</span>

                    <div class="tarefa-botoes">
                        <button class="btn-v ${concluidaDia === true ? 'active' : ''}" data-is-cyclic="true" data-task-id="${cyclicTaskId}">✓</button>
                        <button class="btn-x ${concluidaDia === false ? 'active' : ''}" data-is-cyclic="true" data-task-id="${cyclicTaskId}">✗</button>
                    </div>
                `;

                tarefaEl.dataset.concluida = concluidaDia === true ? 'true' : concluidaDia === false ? 'false' : 'neutral';
                tarefaEl.dataset.taskId = cyclicTaskId;
                tarefaEl.dataset.tarefaId = tarefaIdUuid; // garante persistência em `registros`
                tarefaEl.dataset.isCyclic = 'true';

                // Event listeners para cyclic (delegated)
                tarefaEl.querySelector('.btn-v').addEventListener('click', handleTaskToggle);
                tarefaEl.querySelector('.btn-x').addEventListener('click', handleTaskToggle);

                tarefasContainer.appendChild(tarefaEl);
            });
        
        // ✅ UNIFICAR: Handler global para todos os toggles (já delegados)
        async function handleTaskToggle(e) {

            const btn = e.target;
            const tarefaEl = btn.closest('.tarefa-item');
            const isCheck = btn.classList.contains('btn-v');
            
            tarefaEl.classList.toggle('concluida', isCheck);
            tarefaEl.querySelector('.btn-v').classList.toggle('active', isCheck);
            tarefaEl.querySelector('.btn-x').classList.toggle('active', !isCheck);
            tarefaEl.dataset.concluida = isCheck ? 'true' : 'false';
            
            atualizarEficienciaModal(modal);
            
            const dataKeyLocal = modal.dataset.currentDataKey;
            const tarefaId = tarefaEl.dataset.tarefaId;
            const isCyclicLocal = tarefaEl.dataset.isCyclic === 'true';
            const metaTipoLocal = tarefaEl.dataset.metaTipo || '';

            // Novo modelo: salva na tabela `registros` (histórico diário)
            // UNIQUE(tarefa_id, data, user_id)
            await salvarEstadoRegistroDia(dataKeyLocal, tarefaId, isCheck);


            if (isCyclicLocal) {
                // Cíclicas agora são baseadas em UUID (tarefaEl.dataset.tarefaId)
                // O storage cíclico local ainda existe no código legado, mas não é fonte de verdade.
                // A fonte de verdade para persistência no dia já é feita via salvarEstadoRegistroDia.
                // Mantemos apenas a lógica de "pending" para anual.
            
                
                // Coleta anual pendente para confirmar depois (track state)
                if (metaTipoLocal === 'anual') {
                    // Sempre track anual tasks, but only trigger on final true
                    if (typeof window.pendingAnnualStates === 'undefined') {
                        window.pendingAnnualStates = {};
                    }
                    // Usa UUID da tarefa (meta.id) para anual
                    window.pendingAnnualStates[tarefaId] = isCheck;
                    
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
            // Pontuação/graphs na aba de pontuação devem atualizar apenas ao clicar em CONFIRMAR

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

    console.log('[DEBUG atualizarEficienciaModal] dataKey', dataKey, 'tarefas', tarefas.length);

    // Para debug/observabilidade: listar quantas anuais existem no modal
    const anuaisNoModal = Array.from(tarefas).filter(t => (t.dataset.metaTipo || '') === 'anual');
    console.log('[DEBUG atualizarEficienciaModal] anuaisNoModal', anuaisNoModal.map(t => t.dataset.taskId));

    const metasCiclicasNoDiaCache = renderizarMetasCiclicas(dataKey);


    tarefas.forEach(t => {
        const metaTipo = t.dataset.metaTipo || 'diaria';

        if (metaTipo === 'mensal' || metaTipo === 'anual') {
            const cyclicTaskId = t.dataset.taskId;
            const todasCiclicas = renderizarMetasCiclicas(dataKey);
            const metaCiclica = todasCiclicas.find(m => m.cyclicTaskId === cyclicTaskId);

            if (
                metaCiclica &&
                metaCiclica.tipo === 'anual'
            ) {
                // Meta anual aparece todos os dias na lista, mas NÃO entra no cálculo de eficiência diária.
                return;
            }

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
}https://zero.click/fc309272-8b2b-42f7-ac40-6547f1e4b4a0
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
async function atualizarEstatisticas() {
        // Total de metas cadastradas (fonte de verdade: Supabase `tarefas`)
        let totalMetas = 0;

        // Busca o total real no Supabase (evita ficar 0 por localStorage)
        try {
            if (window.userId) {
                const { data: tarefasTotal, error: tarefasTotalErr } = await window.supabaseClient
                    .from('tarefas')
                    .select('id')
                    .eq('user_id', window.userId);

                if (!tarefasTotalErr) {
                    totalMetas = tarefasTotal?.length || 0;
                }
            }
        } catch (e) {
            totalMetas = 0;
        }

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

        // Corrigir stat-total: fonte de verdade é o Supabase (tarefas da tabela `tarefas`)
        try {
            if (window.userId && statTotal) {
                const { data: tarefas } = await window.supabaseClient
                    .from('tarefas')
                    .select('id')
                    .eq('user_id', window.userId);

                statTotal.textContent = tarefas?.length || 0;
            }
        } catch (e) {
            // fallback: mantém totalMetas calculado por localStorage
        }

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
        
        for (let i = 8; i>= 0; i--) {
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

async function renderEstatisticas() {
       
        try {
            // Exibir apenas desempenho de metas diárias e semanais
            // (mensais não entram nos gráficos/estatísticas)

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

            const dados = await atualizarEstatisticas();


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
    
async function renderIndividualCharts() {
        const container = document.getElementById('individual-charts-list');
        if (!container) return;

        container.innerHTML = '';

        // ========= NOVO: carregar dados via JOIN =========
        let dados = [];
        try {
            if (!window.userId) {
                container.innerHTML = '<p class="no-data-message">Faça login para ver o desempenho.</p>';
                return;
            }

            const { data, error } = await window.supabaseClient
                .from('registros')
.select('*, tarefas(titulo, tipo, prioridade, criada_em)')
                .eq('user_id', window.userId);

            if (error) throw error;
            dados = data || [];
        } catch (e) {
            console.error('Erro ao buscar dados (join) para Desempenho por Meta:', e);
        }

    

        // ========= Continuação: renderizar cards usando os dados do JOIN =========
        // Agrupa por tarefa_id para renderizar 1 card por tarefa única
        const tarefaMap = new Map();

        dados.forEach(r => {
            if (!r?.tarefa_id) return;
            if (!tarefaMap.has(r.tarefa_id)) {
                tarefaMap.set(r.tarefa_id, {
                    tarefaId: r.tarefa_id,
                    titulo: r.tarefas?.titulo,
                    prioridade: r.tarefas?.prioridade,
                    tipo: r.tarefas?.tipo,
                    criada_em: r.tarefas?.criada_em,
                    registros: []
                });
            }
            tarefaMap.get(r.tarefa_id).registros.push(r);
        });

        if (tarefaMap.size === 0) {
            container.innerHTML = '<p class="no-data-message">Nenhuma meta cadastrada ainda.</p>';
            return;
        }

        // Cache para o verso do card (streak/eficiência), fonte de verdade: meta.registros (JOIN)
        window.__tarefasSupabaseCacheById = {};
        tarefaMap.forEach((tarefa, tarefaId) => {
            window.__tarefasSupabaseCacheById[tarefaId] = tarefa;
        });

        tarefaMap.forEach((tarefa, tarefaId) => {
            const taskId = tarefaId;

            const flipContainer = document.createElement('div');
            flipContainer.className = 'flip-card';
            flipContainer.dataset.taskId = taskId;

            let dadosJanela;
            // `tarefa.tipo` vem do join: 'diaria' / 'semanal' / 'mensal' / 'anual'
            if (tarefa.tipo === 'diaria') {
                dadosJanela = gerarJanela10Dias(taskId, tarefa);
            } else {
                // Semanal usa janela de ciclo real
                dadosJanela = gerarJanelaCicloReal(tarefa, 4);
            }
            const chartId = `chart-${tarefaId.replace(/[^a-zA-Z0-9]/g, '-')}`;
            
            const formatarPrioridade = (p) => ({
                alta: 'Alta',
                media: 'Média',
                baixa: 'Baixa'
            })[p] || p;

            const formatarTipo = (t) => ({
                diaria: 'Diária',
                semanal: 'Semanal',
                mensal: 'Mensal',
                anual: 'Anual'
            })[t] || t;

            flipContainer.innerHTML = `
                <div class="flip-card-inner">
                    <div class="flip-card-front">
                        <div class="chart-header">${tarefa.titulo}<br><small>${formatarPrioridade(tarefa.prioridade)} - ${formatarTipo(tarefa.tipo)}</small></div>

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
                
                if (individualCharts[tarefaId]) {
                    individualCharts[tarefaId].destroy();
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
                
individualCharts[tarefaId] = new Chart(ctx, {
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

    // Para cíclicas (semanal/mensal/anual), o app pode ter salvo no calendário_tarefas_dia
    // usando o cyclicTaskId (ex: cyc_texto-Prioridade_YYYYMMDD). Então tentamos ambos.
    let status = tarefasDia[dataKey]?.[simpleTaskId];

    if (isWeekly && meta) {
        const cyclicTaskId = getCyclicTaskId(meta);
        if (tarefasDia[dataKey] && Object.prototype.hasOwnProperty.call(tarefasDia[dataKey], cyclicTaskId)) {
            status = tarefasDia[dataKey][cyclicTaskId];
        }
    }


    // DEBUG: verificar keys existentes
    // (Evita spam: só loga quando houver meta e o cálculo for semanal/cíclico)
    try {
        if (isWeekly && meta) {
            const cyclicTaskId = getCyclicTaskId(meta);
            const tarefasCiclicas = JSON.parse(localStorage.getItem('ciclicas_tarefas_dia') || '{}');
            const hasSimple = tarefasDia?.[dataKey]?.hasOwnProperty?.(simpleTaskId);
            const hasCyclic = tarefasCiclicas?.[dataKey]?.hasOwnProperty?.(cyclicTaskId);
            if (hasSimple || hasCyclic) {
                console.warn('[DEBUG getTaskStatus]', {
                    dataKey,
                    simpleTaskId,
                    cyclicTaskId,
                    hasSimple,
                    hasCyclic,
                    statusSimple: tarefasDia?.[dataKey]?.[simpleTaskId],
                    statusCyclic: tarefasCiclicas?.[dataKey]?.[cyclicTaskId]
                });
            } else {
                // DEBUG: log quando NÃO acha nada, para confirmar se a função está sendo chamada
                console.warn('[DEBUG getTaskStatus - no records]', {
                    dataKey,
                    simpleTaskId,
                    cyclicTaskId,
                    hasSimple,
                    hasCyclic
                });
            }

        }
    } catch (e) {
        console.error('[DEBUG getTaskStatus] error', e);
    }

    if (status !== undefined) {
        return {
            valor: status === true ? 1 : 0,
            temRegistro: true,
            explicitamenteNao: status === false
        };
    }

    if (isWeekly && meta) {
        // 2. Fallback: reconstruct cyclic ID and check cyclic storage
        //    IMPORTANTE: as metas semanal/mensal/anual são salvas em ciclicas_tarefas_dia
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

    // Fonte de verdade: meta.registros (JOIN do Supabase)
    // Ao virar, usamos os mesmos registros usados no gráfico.
    const tarefaCache = window.__tarefasSupabaseCacheById || {};
    const tarefa = tarefaCache[taskId];
    const registros = tarefa?.registros || [];
    const avaliados = registros.filter(r => r.status !== null && r.status !== undefined);
    const concluidos = registros.filter(r => r.status === true);

    const eficiencia = avaliados.length > 0
        ? Math.round((concluidos.length / avaliados.length) * 100)
        : 0;

    // Streak — dias consecutivos (até hoje) com status true
    let streak = 0;
    const registrosOrdenados = [...registros].sort((a, b) => String(b.data).localeCompare(String(a.data)));
    for (const r of registrosOrdenados) {
        if (r.status === true) streak++;
        else break;
    }

    // Validação visual (mantém estilo existente)
    if (avaliados.length === 0) {
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
            <span class="stats-label">Streak</span>
            <span class="stats-value">${streak} dias</span>
        </div>
        <div class="stats-item">
            <span class="stats-label">Eficiência</span>
            <span class="stats-value">${eficiencia}%</span>
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

        const dataFormatada = dia.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short'
        }).replace('.', '');

        // Busca registro do dia nos registros já retornados pelo JOIN
        const registro = meta?.registros?.find(r => r.data === dataKey);
        const temRegistro = registro !== undefined;

        janela.push({
            data: dataFormatada,
            dataKey,
            valor: temRegistro ? (registro.status === true ? 1 : 0) : null,
            temRegistro,
            explicitamenteNao: registro?.status === false
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
    // A fonte de verdade para o cálculo vem do JOIN do Supabase.
    // O join já entrega `criada_em` e `prioridade` no objeto `meta`.
    const criadaEm = meta.criada_em;
    const dataCriacao = new Date(criadaEm);
    const janela = [];

    const tipo = meta.tipo || '';
    // Gerar pontos do ciclo a partir de criada_em (meta), voltando numCiclos períodos
    // Força timezone UTC para evitar Invalid Date quando a string não vem com 'Z'.
    const criadaEmStr = meta.criada_em?.endsWith('Z')
      ? meta.criada_em
      : meta.criada_em + 'Z';
    const dataBase = new Date(criadaEmStr);

    if (tipo === 'mensal') {
        // Para mensal deve respeitar o MESMO DIA do mês (ex: 31/01 -> 31/12 e 30/11)
        // Usar setMonth ao invés de setDate para evitar “30 dias fixos”.
        for (let i = numCiclos - 1; i >= 0; i--) {
            const dataCiclo = new Date(dataBase);
            dataCiclo.setMonth(dataCiclo.getMonth() - i);

            const dataKey = `${dataCiclo.getFullYear()}-${String(dataCiclo.getMonth() + 1).padStart(2, '0')}-${String(dataCiclo.getDate()).padStart(2, '0')}`;

            const registro = meta?.registros?.find(r => r.data === dataKey);
            const temRegistro = registro !== undefined;

            const dataFormatada = dataCiclo.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short'
            }).replace('.', '');

            janela.push({
                data: dataFormatada,
                dataKey,
                valor: temRegistro ? (registro.status === true ? 1 : 0) : null,
                temRegistro,
                explicitamenteNao: registro?.status === false
            });
        }
        return janela;
    }

    let intervaloDias = 0;
    switch (tipo) {
        case 'semanal':
            intervaloDias = 7;
            break;
        default:
            return [];
    }

    for (let i = numCiclos - 1; i >= 0; i--) {
        const dataCiclo = new Date(dataBase);
        dataCiclo.setDate(dataCiclo.getDate() - (i * intervaloDias));

        const dataKey = `${dataCiclo.getFullYear()}-${String(dataCiclo.getMonth() + 1).padStart(2, '0')}-${String(dataCiclo.getDate()).padStart(2, '0')}`;

        const registro = meta?.registros?.find(r => r.data === dataKey);
        const temRegistro = registro !== undefined;

        const dataFormatada = dataCiclo.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short'
        }).replace('.', '');

        janela.push({
            data: dataFormatada,
            dataKey,
            valor: temRegistro ? (registro.status === true ? 1 : 0) : null,
            temRegistro,
            explicitamenteNao: registro?.status === false
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


// Auth gating + Inicialização
function ensureSupabaseReady(){
        // Se o client não estiver pronto, tentamos falhar com mensagem mais acionável.
        // (Em muitos projetos, o supabaseClient é criado em outro arquivo; aqui garantimos só a existência.)
        if (!window.supabaseClient) {
            // Não lançamos mais erro hard aqui: apenas deixamos a UI de login aparecer.
            // A primeira chamada de auth vai falhar e mostrar a mensagem correspondente.
            return false;
        }
        if (!window.supabaseClient.auth) {
            return false;
        }
        return true;
    }

    async function iniciarApp(){
        const ok = ensureSupabaseReady();
        if (!ok) {
            // Falha silenciosa: sem cliente Supabase não inicializa o app.
            return;
        }
        // Logout button
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) btnLogout.style.display = 'block';

        initTema();
        atualizarDataAtual();
        carregarMetas('diario');
        atualizarEstatisticas();
        setupMidnightCheck();
        setupCalendarNavigation();
        
        // Garantir dark mode toggle sempre funciona
        document.addEventListener('click', (e) => {
            const isThemeBtn = e.target.id === 'theme-toggle' || e.target.closest('#theme-toggle');
            if (isThemeBtn) {
                toggleTema();
            }
        });
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            const temaSalvo = localStorage.getItem(STORAGE_THEME);
            if (!temaSalvo) {
                html.classList.toggle('dark-mode', e.matches);
                if (document.getElementById('secao-estatisticas')?.classList.contains('active')) {
                    renderEstatisticas();
                }
            }
        });
    }

    function exibirTelaLogin(){
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) loginScreen.classList.remove('is-hidden');
    }

    function ocultarTelaLogin(){
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) loginScreen.classList.add('is-hidden');
    }

    function mostrarErro(msg){
        const el = document.getElementById('auth-error');
        if (!el) return;
        el.textContent = msg;
        el.style.display = 'block';
    }

    function limparErro(){
        const el = document.getElementById('auth-error');
        if (!el) return;
        el.textContent = '';
        el.style.display = 'none';
    }

    const loginEmailEl = document.getElementById('login-email');
    const loginPasswordEl = document.getElementById('login-password');
    const btnLogin = document.getElementById('btn-login');
    const btnSignup = document.getElementById('btn-signup');
    const btnLoginGoogle = document.getElementById('btn-login-google');
    const btnLogout = document.getElementById('btn-logout');

    if (btnLogout) btnLogout.addEventListener('click', async () => {
        const confirmar = confirm('Deseja realmente sair?');
        if (!confirmar) return;

        try {
            ensureSupabaseReady();
            const { error } = await window.supabaseClient.auth.signOut();
            if (error) throw error;
            window.userId = null;
            if (btnLogout) btnLogout.style.display = 'none';
            ocultarTelaLogin();
            exibirTelaLogin();
        } catch (err) {
            mostrarErro(err?.message || 'Falha ao sair.');
        }
    });

    // Wire buttons login
    if (btnLogin) btnLogin.addEventListener('click', async () => {
        limparErro();
        const email = loginEmailEl?.value?.trim();
        const password = loginPasswordEl?.value;
        if (!email || !password) return mostrarErro('Informe email e senha.');
        try {
            ensureSupabaseReady();
            const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (!session) throw new Error('Sessão não encontrada após login.');
            window.userId = session.user.id;
            ocultarTelaLogin();
            await iniciarApp();
        } catch (err) {
            mostrarErro(err?.message || 'Falha ao entrar.');
        }
    });

    if (btnSignup) btnSignup.addEventListener('click', async () => {
        limparErro();
        const email = loginEmailEl?.value?.trim();
        const password = loginPasswordEl?.value;
        if (!email || !password) return mostrarErro('Informe email e senha.');
        try {
            ensureSupabaseReady();
            const { error } = await window.supabaseClient.auth.signUp({ email, password });
            if (error) throw error;

            // Após signUp, tentar pegar a sessão (depende do projeto: pode exigir confirmação).
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (!session) {
                // Mesmo sem sessão, usuário pode estar em fluxo de confirmação.
                mostrarErro('Cadastro realizado. Verifique seu email para confirmar (se necessário).');
                return;
            }

            window.userId = session.user.id;
            await window.supabaseClient
                .from('perfil_usuario')
                .insert([
                    {
                        rank: 'Iniciante',
                        pontos: 0,
                        dias_ativos: 0,
                        streak: 0,
                        user_id: window.userId
                    }
                ]);

            ocultarTelaLogin();
            await iniciarApp();
        } catch (err) {
            mostrarErro(err?.message || 'Falha ao cadastrar.');
        }
    });

    if (btnLoginGoogle) btnLoginGoogle.addEventListener('click', async () => {
        limparErro();
        try {
            ensureSupabaseReady();
            const { error } = await window.supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin }
            });
            if (error) throw error;
        } catch (err) {
            mostrarErro(err?.message || 'Falha ao iniciar Google.');
        }
    });

    // ===== DETECTAR SESSÃO AO CARREGAR =====
    try {
        ensureSupabaseReady();
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session) {
            window.userId = session.user.id;
            ocultarTelaLogin();
            // garante logout visível e inicializa apenas quando logado
            await iniciarApp();
        } else {
            window.userId = null;
            exibirTelaLogin();
        }
    } catch (err) {
        window.userId = null;
        exibirTelaLogin();
        mostrarErro(err?.message || 'Falha ao verificar sessão.');
    }

    // (o resto da inicialização foi movido para iniciarApp())
    // initTema();
    
    // remove qualquer inicialização antiga duplicada
    // atualizarDataAtual();
    // carregarMetas('diario');
    // atualizarEstatisticas();
    // setupMidnightCheck();
    // setupCalendarNavigation();
    // (inicialização movida para iniciarApp)
    
    // Garantir dark mode toggle sempre funciona
// Listener do theme-toggle já está vinculado no botão/atalho via iniciarApp()
// (mantemos apenas uma fonte para evitar double-toggle)

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

