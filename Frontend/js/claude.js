
// Função do Botão de Privacidade (Olho )
let oculto = false;
let valorGuardado = '';

// Função Principal que carrega os dados e atualiza a interface
async function inicializarDashboard() {
    try {
        // Pedir apenas as posições em aberto ao FastAPI
        const res = await fetch(`${API_BASE}/api/portfolio`);
        const posicoes = await res.json();

        let totalAbertas = 0;
        let custoTotal = 0;
        for (let i = 0; i < posicoes.length; i++) {
            totalAbertas += (posicoes[i].current_value || 0);
            custoTotal += (posicoes[i].purchase_value || 0);
        }
        // 1. Atualizar contador de posições abertas na barra lateral
        document.getElementById('tab-count-open').textContent = posicoes.length;

        const lucroAberto = totalAbertas - custoTotal;
        const rentabTotal = custoTotal > 0 ? ((lucroAberto / custoTotal) * 100).toFixed(2) : 0;

        valorGuardado = formatEUR(totalAbertas);
        document.getElementById('kpi-valor-total').textContent = oculto ? '••••••••' : formatEUR(totalAbertas)
        document.getElementById('kpi-custo-total').textContent = formatEUR(custoTotal);
        document.getElementById('kpi-num-posicoes').textContent = posicoes.length;

        // P/L e Badges de Rentabilidade
        const plEl = document.getElementById('kpi-pl-aberto');
        const badgeRentab = document.getElementById('kpi-rentab-badge');
        const subLucro = document.getElementById('kpi-lucro-sub');

        const isPos = lucroAberto >= 0;
        const sinal = isPos ? '+' : '';

        plEl.textContent = `${sinal}${formatEUR(lucroAberto)}`;
        plEl.className = `hero-stat-val ${isPos ? 'val-positive' : 'val-negative'}`;

        badgeRentab.textContent = `${sinal}${rentabTotal}%`;
        badgeRentab.className = isPos ? 'badge-pill-positive' : 'badge-pill-negative';

        subLucro.textContent = `${sinal}${formatEUR(lucroAberto)} total`;

        // 3. Renderizar Gráfico de Rosca (Donut)
        renderizarGraficoAlocacao(posicoes, totalAbertas);

        // 4. Renderizar Linhas da Tabela
        renderizarTabela(posicoes);

    } catch (err) {
        console.error("Erro ao carregar dados do backend:", err);
    }
}

// Configuração e desenho do Gráfico de Rosca com Chart.js
function renderizarGraficoAlocacao(posicoes, totalAbertas) {
    const ctx = document.getElementById('donutChart').getContext('2d');
    const labels = posicoes.map(p => p.ticker);
    const data = posicoes.map(p => p.current_value);


    // Paleta de cores moderna para os ativos
    const cores = [
        '#09090b', '#3b82f6', '#10b981', '#f59e0b',
        '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'
    ];

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: cores,
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        font: { size: 11, family: "'Plus Jakarta Sans', sans-serif", weight: '600' },
                        color: '#52525b',
                        padding: 12
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const val = context.parsed;
                            const pct = totalAbertas > 0 ? ((val / totalAbertas) * 100).toFixed(1) : 0;
                            return ` ${context.label}: ${formatEUR(val)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Preenchimento dinâmico da tabela HTML
function renderizarTabela(posicoes) {
    const tbody = document.getElementById('tabela-posicoes-body');
    tbody.innerHTML = '';

    posicoes.forEach(p => {
        const tr = document.createElement('tr');
        const isPos = p.p_l_eur >= 0;
        const arrow = isPos ? '↑' : '↓';
        const colorClass = isPos ? 'val-positive' : 'val-negative';
        const sinal = isPos ? '+' : '';

        tr.innerHTML = `
            <td>${renderizarCelulaAtivo(p.ticker)}</td>
            <td>${Number(p.quantity).toLocaleString('pt-PT', { maximumFractionDigits: 4 })}</td>
            <td>${formatEUR(p.avg_purchase_price)}</td>
            <td>${formatEUR(p.current_price)}</td>
            <td style="font-weight: 700;">${formatEUR(p.current_value)}</td>
            <td class="${colorClass}">
                ${sinal}${Number(p.p_l_pct).toFixed(2)}% ${arrow}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Iniciar quando a página for aberta
inicializarDashboard();


function taparDinheiro() {
    const el = document.getElementById('kpi-valor-total');
    if (!el) return;

    oculto = !oculto;
    el.textContent = oculto ? '••••••••' : valorGuardado;
}

// Função chamada ao clicar no botão de Atualizar
async function recarregarDados() {
    const btn = document.getElementById('btn-refresh');
    const txt = document.getElementById('btn-refresh-text');

    if (btn) btn.classList.add('loading');
    if (txt) txt.textContent = 'A atualizar...';

    try {
        // 1. Manda o backend correr os 4 scripts Python em segundo plano
        await fetch(`${API_BASE}/api/atualizar`, { method: 'POST' });
        // 2. Recarrega os números, tabela e gráfico no ecrã com os novos dados
        await inicializarDashboard();
    } catch (err) {
        console.error("Erro ao atualizar dados:", err);
        alert("Ocorreu um erro ao atualizar os dados. Verifica o terminal do backend.");
    } finally {
        if (btn) btn.classList.remove('loading');
        if (txt) txt.textContent = 'Atualizar';
    }
}

