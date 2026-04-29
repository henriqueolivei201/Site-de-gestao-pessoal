// Gestão Pessoal - script.js
// Funcionalidades básicas do site de metas

document.addEventListener('DOMContentLoaded', function() {
    // Elementos DOM
    const navItems = document.querySelectorAll('.nav-item');
    const goalsSections = document.querySelectorAll('.goals-section');
    const btnNovaMeta = document.getElementById('btn-nova-meta');
    const dataAtual = document.getElementById('data-atual');
    
    // Chaves LocalStorage
    const STORAGE_KEYS = {
        diario: 'metas_diario',
        semanal: 'metas_semanal',
        anual: 'metas_anual'
    };

    // Atualizar data atual
    function atualizarDataAtual() {
        const opcoes = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const data = new Date().toLocaleDateString('pt-BR', opcoes);
        dataAtual.textContent = `Hoje - ${data}`;
    }

    // Alternar visualizações
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            
            // Atualizar navegação ativa
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Mostrar seção correspondente
            goalsSections.forEach(section => {
                section.classList.remove('active');
                if (section.id === `secao-${view}`) {
                    section.classList.add('active');
                }
            });
            
            // Carregar metas da visualização
            carregarMetas(view);
        });
    });

    // Nova meta
    btnNovaMeta.addEventListener('click', adicionarNovaMeta);

    function adicionarNovaMeta() {
        const texto = prompt('Digite o texto da meta:');
        if (!texto) return;

        const prioridade = prompt('Prioridade (Alta/Média/Baixa):') || 'Média';
        
        // Determinar seção ativa
        const secaoAtiva = document.querySelector('.goals-section.active');
        const listaContainer = secaoAtiva.querySelector('.goals-container');
        const view = secaoAtiva.id.replace('secao-', '');
        
        if (listaContainer && texto) {
            const novaMeta = criarElementoMeta(texto, prioridade);
            listaContainer.insertBefore(novaMeta, listaContainer.firstChild);
            
            // Salvar no LocalStorage
            salvarMeta(view, texto, prioridade);
        }
    }

    // Criar elemento HTML de meta
    function criarElementoMeta(texto, prioridade) {
        const article = document.createElement('article');
        article.className = 'goal-item';
        article.innerHTML = `
            <input type="checkbox" class="checkbox-meta">
            <label class="goal-text">${texto}</label>
            <span class="etiqueta-prioridade ${prioridade.toLowerCase()}">${prioridade}</span>
            <button class="btn-excluir" aria-label="Excluir meta">&times;</button>
        `;
        
        // Event listeners
        const checkbox = article.querySelector('.checkbox-meta');
        const deleteBtn = article.querySelector('.btn-excluir');
        
        checkbox.addEventListener('change', () => {
            const goalText = article.querySelector('.goal-text');
            goalText.classList.toggle('concluida', checkbox.checked);
        });
        
        deleteBtn.addEventListener('click', () => {
            const view = document.querySelector('.goals-section.active').id.replace('secao-', '');
            removerMeta(view, texto);
            article.remove();
        });
        
        return article;
    }

    // Salvar meta no LocalStorage
    function salvarMeta(view, texto, prioridade) {
        let metas = JSON.parse(localStorage.getItem(STORAGE_KEYS[view]) || '[]');
        metas.unshift({ texto, prioridade, concluida: false });
        localStorage.setItem(STORAGE_KEYS[view], JSON.stringify(metas));
    }

    // Remover meta
    function removerMeta(view, texto) {
        let metas = JSON.parse(localStorage.getItem(STORAGE_KEYS[view]) || '[]');
        metas = metas.filter(meta => meta.texto !== texto);
        localStorage.setItem(STORAGE_KEYS[view], JSON.stringify(metas));
    }

    // Carregar metas de uma visualização
    function carregarMetas(view) {
        const container = document.getElementById(`lista-${view}`);
        if (!container) return;

        // Limpar container
        container.innerHTML = '';

        // Carregar do LocalStorage
        const metas = JSON.parse(localStorage.getItem(STORAGE_KEYS[view]) || '[]');
        metas.forEach(meta => {
            const elemento = criarElementoMeta(meta.texto, meta.prioridade);
            const checkbox = elemento.querySelector('.checkbox-meta');
            const goalText = elemento.querySelector('.goal-text');
            
            if (meta.concluida) {
                checkbox.checked = true;
                goalText.classList.add('concluida');
            }
            
            container.appendChild(elemento);
        });

        // Adicionar exemplos se vazio
        if (metas.length === 0 && view === 'diario') {
            container.appendChild(criarElementoMeta('Estudar React por 2 horas', 'Alta'));
            container.appendChild(criarElementoMeta('Fazer exercício físico 30min', 'Média'));
        }
    }

    // Inicialização
    atualizarDataAtual();
    carregarMetas('diario');

    // Salvar estado dos checkboxes ao mudar
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('checkbox-meta')) {
            const article = e.target.closest('.goal-item');
            const goalText = article.querySelector('.goal-text').textContent;
            const view = document.querySelector('.goals-section.active').id.replace('secao-', '');
            const prioridade = article.querySelector('.etiqueta-prioridade').textContent;
            
            let metas = JSON.parse(localStorage.getItem(STORAGE_KEYS[view]) || '[]');
            const index = metas.findIndex(m => m.texto === goalText && m.prioridade === prioridade);
            if (index !== -1) {
                metas[index].concluida = e.target.checked;
                localStorage.setItem(STORAGE_KEYS[view], JSON.stringify(metas));
            }
        }
    });
});
