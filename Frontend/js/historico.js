
// Variáveis para guardar os dados em memória
let dadosHistorico = [];
let dadosResumo = [];
let vistaAtual = 'ativos'; // 'ativos' ou 'transacoes'

async function inicializarHistorico() {
    try {
        // Carrega em paralelo: transações, resumo por ativo e posições abertas
        const [resHistorico, resResumo] = await Promise.all([
            fetch(`${API_BASE}/api/history`),
            fetch(`${API_BASE}/api/history/summary`),
        ]);

        dadosHistorico = await resHistorico.json();
        dadosResumo = await resResumo.json();

        // 1. Atualizar contadores
        const elCountAtivos = document.getElementById('contagem-ativos');
        if (elCountAtivos) elCountAtivos.textContent = dadosResumo.length;

        const elCountTrans = document.getElementById('contagem-transacoes');
        if (elCountTrans) elCountTrans.textContent = dadosHistorico.length;

        // 2. Calcular KPIs de topo (Lucro Total, Win Rate, Total de Vendas)
        let lucroTotal = 0;
        let operacoesGanhadoras = 0;
        for (let i = 0; i < dadosHistorico.length; i++) {
            const op = dadosHistorico[i];
            const pl = op.gross_p_l || 0;
            lucroTotal += pl;
            if (pl > 0) operacoesGanhadoras++;
        }

        const totalVendas = dadosHistorico.length;
        const winRate = totalVendas > 0 ? ((operacoesGanhadoras / totalVendas) * 100).toFixed(1) : 0;

        // KPI 1: Lucro Realizado Total
        const elLucro = document.getElementById('kpi-lucro-total');
        const isPosLucro = lucroTotal >= 0;
        elLucro.textContent = `${isPosLucro ? '+' : ''}${formatEUR(lucroTotal)}`;
        elLucro.className = `kpi-value ${isPosLucro ? 'val-positive' : 'val-negative'}`;

        // KPI 2: Win Rate
        document.getElementById('kpi-win-rate').textContent = `${winRate}%`;
        document.getElementById('kpi-win-rate-sub').textContent = `${operacoesGanhadoras} de ${totalVendas} operações com lucro`;

        // KPI 3: Total de Vendas
        document.getElementById('kpi-total-vendas').textContent = totalVendas;

        // KPI 4: Melhor Operação Real (o ativo mais lucrativo no resumo consolidado!)
        if (dadosResumo.length > 0) {
            const melhorAtivo = dadosResumo[0]; // já vem ordenado por p_l_eur DESC
            const cleanTicker = melhorAtivo.ticker.replace('.US', '').replace('.DE', '');
            const elMelhor = document.getElementById('kpi-melhor-trade');
            if (elMelhor) {
                elMelhor.textContent = `+${formatEUR(melhorAtivo.p_l_eur)}`;
                elMelhor.className = 'kpi-value val-positive';
            }
            const elMelhorSub = document.getElementById('kpi-melhor-trade-sub');
            if (elMelhorSub) {
                elMelhorSub.textContent = `${cleanTicker} (+${Number(melhorAtivo.p_l_pct).toFixed(1)}%)`;
            }
        }

        // 3. Renderizar os Destaques (Top 2 Ganhos e Top 2 Perdas por Ativo)
        renderizarDestaques(dadosResumo);

        // 4. Renderizar a Tabela na vista por defeito ('ativos')
        renderizarTabela();

    } catch (err) {
        console.error("Erro ao carregar dados do histórico:", err);
    }
}

// Destaques baseados no total ganho/perdido por cada empresa
function renderizarDestaques(resumo) {
    const ordenados = [...resumo].sort((a, b) => (b.p_l_eur || 0) - (a.p_l_eur || 0));

    const ganhos = ordenados.filter(item => (item.p_l_eur || 0) > 0).slice(0, 2);
    const perdas = ordenados.filter(item => (item.p_l_eur || 0) < 0).reverse().slice(0, 2);

    const elGanhos = document.getElementById('lista-melhores-trades');
    const elPerdas = document.getElementById('lista-piores-trades');

    if (elGanhos) {
        elGanhos.innerHTML = ganhos.map(item => criarItemDestaque(item, true)).join('');
    }
    if (elPerdas) {
        elPerdas.innerHTML = perdas.map(item => criarItemDestaque(item, false)).join('');
    }
}

function criarItemDestaque(item, isGanho) {
    const cleanTicker = item.ticker.replace('.US', '').replace('.DE', '');
    const avatar = cleanTicker.substring(0, 2);
    const tipoSub = item.ticker.endsWith('.DE') ? 'ETF' : 'Ações';
    const sinal = isGanho ? '+' : '';
    const colorClass = isGanho ? 'val-positive' : 'val-negative';

    return `
        <div class="highlight-item">
            <div class="highlight-left">
                <span class="asset-avatar-sm">${avatar}</span>
                <div>
                    <div class="asset-name">${cleanTicker}</div>
                    <div class="asset-class">${tipoSub}</div>
                </div>
            </div>
            <div class="highlight-right ${colorClass}">
                ${sinal}${formatEUR(item.p_l_eur)} (${sinal}${Number(item.p_l_pct).toFixed(1)}%)
            </div>
        </div>
    `;
}

// Função que alterna entre a vista 'ativos' e 'transacoes'
function alternarVista(tipo) {
    vistaAtual = tipo;

    const btnAtivos = document.getElementById('btn-view-ativos');
    const btnTrans = document.getElementById('btn-view-transacoes');
    const titulo = document.getElementById('tabela-titulo');

    if (tipo === 'ativos') {
        btnAtivos.classList.add('active');
        btnTrans.classList.remove('active');
        titulo.textContent = 'Posições Fechadas (Por Ativo)';
    } else {
        btnTrans.classList.add('active');
        btnAtivos.classList.remove('active');
        titulo.textContent = 'Registo de Todas as Vendas';
    }

    renderizarTabela();
}

function renderizarTabela() {
    const thead = document.getElementById('tabela-historico-thead');
    const tbody = document.getElementById('tabela-historico-body');
    tbody.innerHTML = '';

    if (vistaAtual === 'ativos') {
        // Cabeçalho para a vista Por Ativo
        thead.innerHTML = `
            <tr>
                <th>Ativo</th>
                <th>Qtd. Total</th>
                <th>Total Investido</th>
                <th>Total Realizado</th>
                <th>P/L Total</th>
                <th>Retorno (%)</th>
            </tr>
        `;

        dadosResumo.forEach(item => {
            const tr = document.createElement('tr');
            const isPos = (item.p_l_eur || 0) >= 0;
            const colorClass = isPos ? 'val-positive' : 'val-negative';
            const sinal = isPos ? '+' : '';
            const arrow = isPos ? '↗' : '↘';

            tr.innerHTML = `
                <td>${renderizarCelulaAtivo(item.ticker)}</td>
                <td>${Number(item.quantity).toLocaleString('pt-PT', { maximumFractionDigits: 4 })}</td>
                <td>${formatEUR(item.purchase_value)}</td>
                <td>${formatEUR(item.sale_value)}</td>
                <td class="${colorClass}" style="font-weight: 700;">
                    ${sinal}${formatEUR(item.p_l_eur)} ${arrow}
                </td>
                <td class="${colorClass}">
                    ${sinal}${Number(item.p_l_pct).toFixed(2)}%
                </td>
            `;
            tbody.appendChild(tr);
        });

    } else {
        // Cabeçalho para a vista de Todas as Transações individuais
        thead.innerHTML = `
            <tr>
                <th>Ativo</th>
                <th>Abertura</th>
                <th>Fecho</th>
                <th>Qtd.</th>
                <th>Preço Compra</th>
                <th>Preço Venda</th>
                <th>P/L Realizado</th>
            </tr>
        `;

        dadosHistorico.forEach(op => {
            const tr = document.createElement('tr');
            const isPos = (op.gross_p_l || 0) >= 0;
            const arrow = isPos ? '↗' : '↘';
            const colorClass = isPos ? 'val-positive' : 'val-negative';
            const sinal = isPos ? '+' : '';

            tr.innerHTML = `
                <td>${renderizarCelulaAtivo(op.ticker)}</td>
                <td>${formatData(op.open_date)}</td>
                <td>${formatData(op.close_date)}</td>
                <td>${Number(op.quantity).toLocaleString('pt-PT', { maximumFractionDigits: 4 })}</td>
                <td>${formatEUR(op.open_price)}</td>
                <td>${formatEUR(op.close_price)}</td>
                <td class="${colorClass}" style="font-weight: 700;">
                    ${sinal}${formatEUR(op.gross_p_l)} ${arrow}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// Iniciar a página
inicializarHistorico();
