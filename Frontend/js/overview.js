
// Variáveis de Estado
let todosAtivos = [];
let filtroAtual = 'todos';
let chartEvolucaoInstance = null;
let chartTopAtivosInstance = null;

async function inicializarOverview() {
    try {
        // 1. Carregar dados em paralelo da API
        const [resAbertas, resResumoFechadas, resHistorico] = await Promise.all([
            fetch(`${API_BASE}/api/portfolio`),
            fetch(`${API_BASE}/api/history/summary`),
            fetch(`${API_BASE}/api/history`)
        ]);

        const abertas = await resAbertas.json();
        const resumoFechadas = await resResumoFechadas.json();
        const transacoes = await resHistorico.json();

        // 2. Cruzar Ativos Abertos e Fechados
        let totalInvestidoGlobal = 0;
        let plRealizadoTotal = 0;
        let plLatenteTotal = 0;
        const mapa = {};

        // 1. Guardar as fechadas
        resumoFechadas.forEach(f => {
            const pl = f.p_l_eur || 0;
            const inv = f.purchase_value || 0;
            plRealizadoTotal += pl;
            totalInvestidoGlobal += inv;

            mapa[f.ticker] = {
                ticker: f.ticker,
                estado: 'Fechada',
                plRealizado: f.p_l_eur,
                plLatente: null,
                investidoTotal: inv
            };
        });

        // 2. Cruzar com as abertas
        abertas.forEach(a => {
            const pl = a.p_l_eur || 0;
            const inv = a.purchase_value || 0;
            plLatenteTotal += pl;
            totalInvestidoGlobal += inv;

            if (mapa[a.ticker]) {
                // Já existia nas fechadas! É Mista!
                mapa[a.ticker].estado = 'Mista';
                mapa[a.ticker].plLatente = a.p_l_eur;
                mapa[a.ticker].investidoTotal += inv;
            } else {
                // Só existe nas abertas!
                mapa[a.ticker] = {
                    ticker: a.ticker,
                    estado: 'Aberta',
                    plRealizado: null,
                    plLatente: a.p_l_eur,
                    investidoTotal: inv
                };
            }
        });

        // 3. Criar a lista final com P/L Total e Rentabilidade %
        todosAtivos = Object.values(mapa).map(item => {
            const plTotal = (item.plRealizado || 0) + (item.plLatente || 0);
            const retornoPct = item.investidoTotal > 0 ? (plTotal / item.investidoTotal) * 100 : 0;
            return {
                ...item,
                plTotal,
                retornoPct
            };
        });

        todosAtivos.sort((a, b) => b.plTotal - a.plTotal);

        // 3. Atualizar os 4 KPIs de Topo
        const plGlobal = plRealizadoTotal + plLatenteTotal;
        const elPlTotal = document.getElementById('kpi-pl-total');
        const isPosGlobal = plGlobal >= 0;
        elPlTotal.textContent = `${isPosGlobal ? '+' : ''}${formatEUR(plGlobal)}`;
        elPlTotal.className = `kpi-value ${isPosGlobal ? 'val-positive' : 'val-negative'}`;

        const retornoGlobalPct = totalInvestidoGlobal > 0 ? (plGlobal / totalInvestidoGlobal) * 100 : 0;
        document.getElementById('kpi-pl-sub').textContent = `${retornoGlobalPct >= 0 ? '↗ +' : '↘ '}${retornoGlobalPct.toFixed(1)}% retorno global`;

        // Divisão do Lucro (Barra proporcional)
        document.getElementById('split-val-realized').textContent = `+${formatEUR(plRealizadoTotal)}`;
        document.getElementById('split-val-unrealized').textContent = `${plLatenteTotal >= 0 ? '+' : ''}${formatEUR(plLatenteTotal)}`;

        const baseRealizado = Math.max(0, plRealizadoTotal);
        const baseLatente = Math.max(0, plLatenteTotal);
        const somaBase = baseRealizado + baseLatente;
        const pctRealizado = somaBase > 0 ? ((baseRealizado / somaBase) * 100).toFixed(0) : 50;
        const pctLatente = 100 - pctRealizado;

        document.getElementById('split-bar-realized').style.width = `${pctRealizado}%`;
        document.getElementById('split-bar-unrealized').style.width = `${pctLatente}%`;

        // Capital Total e Taxa de Ativos no Verde
        document.getElementById('kpi-capital-alocado').textContent = formatEUR(totalInvestidoGlobal);
        const ativosPositivos = todosAtivos.filter(a => a.plTotal > 0).length;
        const pctPositivos = ((ativosPositivos / todosAtivos.length) * 100).toFixed(1);
        document.getElementById('kpi-taxa-lucro').textContent = `${pctPositivos}%`;
        document.getElementById('kpi-taxa-sub').textContent = `${ativosPositivos} de ${todosAtivos.length} ativos com lucro líquido`;

        // Atualizar contadores dos botões de filtro
        document.getElementById('count-todos').textContent = todosAtivos.length;
        document.getElementById('count-mistas').textContent = todosAtivos.filter(a => a.estado === 'Mista').length;
        document.getElementById('count-abertas').textContent = todosAtivos.filter(a => a.estado === 'Aberta').length;
        document.getElementById('count-fechadas').textContent = todosAtivos.filter(a => a.estado === 'Fechada').length;

        // 4. Renderizar Gráfico 1: Curva Temporal de Lucro Acumulado
        renderizarGraficoEvolucao(transacoes, plRealizadoTotal);

        // 5. Renderizar Gráfico 2: Top Ativos (Realizado vs Latente)
        renderizarGraficoTopAtivos(todosAtivos);

        // 6. Renderizar a Tabela Raio-X
        renderizarTabela();

    } catch (err) {
        console.error("Erro ao inicializar o Overview:", err);
    }
}

// ── GRÁFICO 1: EVOLUÇÃO TEMPORAL ──
function renderizarGraficoEvolucao(transacoes, totalRealizado) {
    const elBadge = document.getElementById('badge-total-acumulado');
    if (elBadge) elBadge.textContent = `+${formatEUR(totalRealizado)}`;

    // Agrupar lucro por mês cronologicamente
    const ordenadas = [...transacoes].reverse();

    const lucrosPorMes = {};

    ordenadas.forEach(op => {
        if (!op.close_date) return;
        const mesAno = op.close_date.substring(0, 7); // 'YYYY-MM'
        lucrosPorMes[mesAno] = (lucrosPorMes[mesAno] || 0) + (op.gross_p_l || 0);
    });

    const meses = Object.keys(lucrosPorMes).sort();
    let acumulado = 0;
    const labels = [];
    const dados = [];

    const nomesMeses = {
        '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
        '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez'
    };

    meses.forEach(m => {
        acumulado += lucrosPorMes[m];
        const [ano, mes] = m.split('-');
        labels.push(`${nomesMeses[mes]} '${ano.substring(2)}`);
        dados.push(Number(acumulado.toFixed(2)));
    });

    const ctx = document.getElementById('chartEvolucaoLucro').getContext('2d');
    if (chartEvolucaoInstance) chartEvolucaoInstance.destroy();

    chartEvolucaoInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Lucro Fechado Acumulado',
                data: dados,
                borderColor: '#003125',
                backgroundColor: 'rgba(0, 49, 37, 0.08)',
                borderWidth: 2.5,
                fill: true,
                tension: 0.35,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#003125'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` Acumulado: +${formatEUR(ctx.parsed.y)}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#71717a', font: { size: 11 } }
                },
                y: {
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        color: '#71717a',
                        font: { size: 11 },
                        callback: (val) => `${val} €`
                    }
                }
            }
        }
    });
}

// ── GRÁFICO 2: TOP ATIVOS (BARRAS EMPILHADAS) ──
function renderizarGraficoTopAtivos(ativos) {
    // Pega nos 7 ativos com maior lucro total
    const top7 = ativos.slice(0, 7);

    const labels = top7.map(a => a.ticker.split('.')[0]);
    const dadosRealizados = top7.map(a => Math.max(0, a.plRealizado || 0));
    const dadosLatentes = top7.map(a => Math.max(0, a.plLatente || 0));

    const ctx = document.getElementById('chartTopAtivos').getContext('2d');
    if (chartTopAtivosInstance) chartTopAtivosInstance.destroy();

    chartTopAtivosInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Realizado (Bolso)',
                    data: dadosRealizados,
                    backgroundColor: '#003125',
                    borderRadius: 4
                },
                {
                    label: 'Latente (Aberto)',
                    data: dadosLatentes,
                    backgroundColor: '#10b981',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        color: '#71717a',
                        font: { size: 11, weight: '600' }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.dataset.label}: +${formatEUR(ctx.parsed.y)}`
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { color: '#09090b', font: { size: 11, weight: '600' } }
                },
                y: {
                    stacked: true,
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        color: '#71717a',
                        font: { size: 11 },
                        callback: (val) => `${val} €`
                    }
                }
            }
        }
    });
}

// ── FILTROS DA TABELA ──
function filtrarTabela(tipo) {
    filtroAtual = tipo;

    const botoes = {
        'todos': document.getElementById('btn-filtro-todos'),
        'mista': document.getElementById('btn-filtro-mistas'),
        'aberta': document.getElementById('btn-filtro-abertas'),
        'fechada': document.getElementById('btn-filtro-fechadas')
    };

    Object.keys(botoes).forEach(k => {
        if (botoes[k]) botoes[k].classList.toggle('active', k === tipo);
    });

    renderizarTabela();
}

// ── RENDERIZAR TABELA RAIO-X ──
// Função auxiliar para formatar os valores de lucro na tabela
function formatarPL(val) {
    if (val === null) return '<span class="val-muted">—</span>';
    const isPos = val >= 0;
    return `<span class="${isPos ? 'val-positive' : 'val-negative'}">${isPos ? '+' : ''}${formatEUR(val)}</span>`;
}

// ── RENDERIZAR TABELA RAIO-X ──
function renderizarTabela() {
    const tbody = document.getElementById('tabela-overview-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const lista = filtroAtual === 'todos'
        ? todosAtivos
        : todosAtivos.filter(a => a.estado.toLowerCase() === filtroAtual);

    lista.forEach(item => {
        const tr = document.createElement('tr');
        const isPosTotal = item.plTotal >= 0;
        const colorTotal = isPosTotal ? 'val-positive' : 'val-negative';
        const sinalTotal = isPosTotal ? '+' : '';
        const badgeClass = `badge-${item.estado.toLowerCase()}`;

        tr.innerHTML = `
            <td>${renderizarCelulaAtivo(item.ticker)}</td>
            <td><span class="badge-status ${badgeClass}">${item.estado}</span></td>
            <td>${formatarPL(item.plRealizado)}</td>
            <td>${formatarPL(item.plLatente)}</td>
            <td class="${colorTotal}" style="font-weight: 800;">
                ${sinalTotal}${formatEUR(item.plTotal)}
            </td>
            <td class="${colorTotal}">
                ${sinalTotal}${item.retornoPct.toFixed(2)}%
            </td>
        `;

        tbody.appendChild(tr);
    });
}


// Iniciar ao carregar a página
inicializarOverview();
