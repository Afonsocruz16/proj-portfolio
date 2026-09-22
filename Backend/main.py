import os
# pyrefly: ignore [missing-import]
import sqlite3
from fastapi  import  FastAPI,  Request, Response
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import subprocess
import sys
import datetime


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "DATA", "portfolio.db")

app = FastAPI(
    title="ProJ API",
    description="Backend para gestao de carteira pessoal de investimentos",
    version="1.0.0",
)

# Configuração do CORS para permitir pedidos de qualquer origem em ambiente local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite pedidos de qualquer origem em ambiente local
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # permite aceder às colunas por nome
    return conn

# linha temporal
def init_snapshots_table():
    """Garante que a tabela de histórico diário existe na base de dados."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS portfolio_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT UNIQUE,
            total_value REAL,
            invested_value REAL,
            profit_loss REAL
        )
    """)
    conn.commit()
    conn.close()

# Executar criação da tabela no arranque da API
init_snapshots_table()


def registar_snapshot_hoje(val_atual: float, inv_aberto: float, pl_aberto: float):
    """Regista ou atualiza a fotografia do dia de hoje (sem duplicar)."""
    if val_atual <= 0:
        return
    hoje = datetime.date.today().isoformat()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO portfolio_snapshots (date, total_value, invested_value, profit_loss)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
            total_value = excluded.total_value,
            invested_value = excluded.invested_value,
            profit_loss = excluded.profit_loss
    """, (hoje, round(val_atual, 2), round(inv_aberto, 2), round(pl_aberto, 2)))
    conn.commit()
    conn.close()



#ENDpoints

@app.get("/")
def raiz():
    """Rota de teste simples para verificar se o servidor está ativo."""
    return {"status": "online", "mensagem": "API ProJ a correr com sucesso!"}


@app.get("/api/portfolio")
def obter_portfolio():
    """
    Devolve a lista de posições em aberto a partir da tabela 'open_positions_summary'.
    Alimenta a tabela e o gráfico Donut da página 'Vista Atual'.
    """
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT 
            ticker,
            quantity,
            purchase_value,
            avg_purchase_price,
            current_price,
            current_value,
            p_l_eur,
            p_l_pct
        FROM open_positions_summary
        ORDER BY current_value DESC
    """)

    linhas = cursor.fetchall()
    conn.close()

    posicoes = [dict(linha) for linha in linhas]
    return posicoes


@app.get("/api/overview")
def obter_overview():
    """
    Devolve os totais acumulados da carteira para o Hero Card da Vista Atual
    e para os cards da página Overview.
    """
    conn = get_db()
    cursor = conn.cursor()
    # Totais das posições abertas
    cursor.execute("""
        SELECT 
            COALESCE(SUM(purchase_value), 0) as inv_aberto,
            COALESCE(SUM(current_value), 0) as val_atual,
            COALESCE(SUM(p_l_eur), 0) as pl_aberto
        FROM open_positions_summary
    """)
    row_open = cursor.fetchone()
    conn.close()
    inv_aberto = row_open["inv_aberto"]
    val_atual = row_open["val_atual"]
    pl_aberto = row_open["pl_aberto"]
    return {
        "total_investido": round(inv_aberto, 2),
        "valor_atual": round(val_atual, 2),
        "lucro_aberto": round(pl_aberto, 2),
    }
    
@app.get("/api/history")
def obter_historico():
    """
    Devolve a lista de operações fechadas da tabela 'closed_positions'.
    Alimenta o contador da barra lateral e a tabela do Histórico.
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            ticker,
            quantity,
            open_date,
            open_price,
            close_date,
            close_price,
            purchase_value,
            sale_value,
            gross_p_l
        FROM closed_positions
        WHERE ticker IS NOT NULL
        ORDER BY close_date DESC
    """)
    linhas = cursor.fetchall()
    conn.close()
    historico = [dict(linha) for linha in linhas]
    return historico

@app.get("/api/history/summary")
def obter_historico_resumo():
    """
    Devolve o resumo consolidado por ativo da tabela 'closed_positions_summary'.
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            ticker,
            quantity,
            purchase_value,
            sale_value,
            p_l_eur,
            p_l_pct
        FROM closed_positions_summary
        ORDER BY p_l_eur DESC
    """)
    linhas = cursor.fetchall()
    conn.close()
    return [dict(linha) for linha in linhas]

@app.post("/api/atualizar")
def atualizar_dados():
    scripts = [
        "tabelas_ligacaobc.py",
        "Apiyahoo.py",
        "new_open.py",
        "new_close.py"
    ]
    for script in scripts:
        caminho = os.path.join(BASE_DIR, "Backend", "codigo", script)
        subprocess.run([sys.executable, caminho], check=True, cwd=BASE_DIR)
    return {"status": "ok", "mensagem": "Base de dados atualizada!"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
