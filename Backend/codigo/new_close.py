from numpy._core import defchararray
import pandas as pd
import sqlite3

conn = sqlite3.connect('data/portfolio.db')
cursor = conn.cursor()

df_fechados = pd.read_sql_query("SELECT * FROM closed_positions WHERE TICKER IS NOT NULL", conn)

# criar primeiro um atributo para depois dar sum quando for no groupby por ticker
df_fechados['p_l_eur'] = df_fechados['sale_value'] - df_fechados['purchase_value']

df_resumo_fechados = df_fechados.groupby('ticker', as_index=False).agg({
    'quantity': 'sum',
    'purchase_value': 'sum',
    'sale_value': 'sum',
    'p_l_eur': 'sum',
})

df_resumo_fechados['p_l_pct'] = (df_resumo_fechados['p_l_eur'] / df_resumo_fechados['purchase_value']) * 100

#arredondar valores
df_resumo_fechados['purchase_value'] = df_resumo_fechados['purchase_value'].round(2)
df_resumo_fechados['sale_value'] = df_resumo_fechados['sale_value'].round(2)
df_resumo_fechados['p_l_eur'] = df_resumo_fechados['p_l_eur'].round(2)
df_resumo_fechados['p_l_pct'] = df_resumo_fechados['p_l_pct'].round(2)


# Totais
total_vendido = df_resumo_fechados['sale_value'].sum()
total_investido_fechados = df_resumo_fechados['purchase_value'].sum()
lucro_realizado = df_resumo_fechados['p_l_eur'].sum()

# Win Rate
trades_vencedores = (df_fechados['p_l_eur'] > 0).sum()
total_trades = len(df_fechados)
win_rate = (trades_vencedores / total_trades) * 100


df_resumo_fechados.to_sql('closed_positions_summary', conn, if_exists='replace', index=False)
conn.close()
print("\nTabela 'closed_positions_summary' guardada com sucesso!")


