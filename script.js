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
            
            if (view === 'estatisticas') {
                renderEstatisticas();
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
        
        totalMetasEl.textContent = totalMetas;
        eficienciaEl.textContent = totalMetas ? Math.round((metasConcluidas / totalMetas) * 100) + '%' : '0%';
        diasAtivosEl.textContent = diasAtivos.size;
    }

    function renderEstatisticas() {
        atualizarEstatisticas();
        
        // Gráfico eficiência últimos 30 dias
        const ctx = chartCtx.getContext('2d');
        const agora = new Date();
        const dados30Dias = [];
        
        for (let i = 29; i >= 0; i--) {
            const dia = new Date(agora);
            dia.setDate(dia.getDate() - i);
            const dataStr = dia.toDateString();
            
            let completas = 0, total = 0;
            Object.keys(STORAGE_KEYS).forEach(key => {
                if (key === 'stats') return;
                const metas = JSON.parse(localStorage.getItem(STORAGE_KEYS[key]) || '[]');
                metas.forEach(meta => {
                    if (new Date(meta.dataCriacao).toDateString() === dataStr) {
                        total++;
                        if (meta.concluida) completas++;
                    }
                });
            });
            
            dados30Dias.push({
                label: dia.toLocaleDateString('pt-BR', {day: 'numeric', month: 'short'}),
                value: total ? Math.round((completas / total) * 100) : 0
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
    }

    // Inicialização
    initTema();
    atualizarDataAtual();
    carregarMetas('diario');
    atualizarEstatisticas();
    
    themeToggle.addEventListener('click', toggleTema);
    
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const temaSalvo = localStorage.getItem(STORAGE_THEME);
        if (!temaSalvo) {
            html.classList.toggle('dark-mode', e.matches);
            renderEstatisticas();
        }
    });
});
