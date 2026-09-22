// ── CONFIGURAÇÕES GLOBAIS ──
const API_BASE = 'http://localhost:8000';

// Mapeamento de ISINs para obter logos de ETFs europeus na Parqet
const ETF_ISINS = {
    'EUNL': 'IE00B4L5Y983',
    'QDVE': 'IE00B3WJKG14'
};

// ── FORMATAÇÃO MONETÁRIA EM EUROS ──
function formatEUR(val) {
    return Number(val || 0).toLocaleString('pt-PT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + ' €';
}

// ── FORMATAÇÃO DE DATAS (YYYY-MM-DD -> DD/MM/YYYY) ──
function formatData(dataStr) {
    if (!dataStr) return '-';
    const dataPura = dataStr.split(' ')[0];
    const partes = dataPura.split('-');
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return dataStr;
}

// ── CÉLULA VISUAL DO ATIVO (LOGO DA PARQET + AVATAR FALLBACK) ──
function renderizarCelulaAtivo(ticker) {
    const clean = (ticker || '').replace('.US', '').replace('.DE', '').replace('.NL', '').replace('.PT', '');
    const avatar = clean.substring(0, 2);
    const tipo = (ticker || '').endsWith('.DE') ? 'ETF' : 'Ações';
    const logoUrl = ETF_ISINS[clean]
        ? `https://assets.parqet.com/logos/isin/${ETF_ISINS[clean]}`
        : `https://assets.parqet.com/logos/symbol/${clean}`;

    return `
        <div class="asset-cell">
            <div class="asset-avatar">
                <img src="${logoUrl}" alt="${clean}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <span style="display: none;">${avatar}</span>
            </div>
            <div class="asset-info">
                <span class="asset-name">${clean}</span>
                <span class="asset-class">${tipo}</span>
            </div>
        </div>
    `;
}
