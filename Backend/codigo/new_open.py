import pandas as pd
import sqlite3


conn = sqlite3.connect('data/portfolio.db')
cursor = conn.cursor()

#Ler posicoes abertas e ler preços atuais yahoo
df_abertos = pd.read_sql_query("SELECT * FROM open_positions WHERE TICKER IS NOT NULL", conn)
df_precos = pd.read_sql_query("SELECT ticker,current_price FROM market_prices", conn)

#Agrupar por ticker
df_resumo = df_abertos.groupby("ticker",as_index=False).agg({
    'quantity' : 'sum',
    'purchase_value' : 'sum',
})

#Calcular preco media de compra de cada um dos ativos
df_resumo['avg_purchase_price'] = df_resumo['purchase_value'] / df_resumo['quantity']

#juntar na tabela do yahoo
df_resumo = pd.merge(df_resumo, df_precos, on='ticker', how='left')

#criar atributos
df_resumo['current_value'] = df_resumo['quantity'] * df_resumo['current_price']

df_resumo['p_l_eur'] = df_resumo['current_value'] - df_resumo['purchase_value']

df_resumo['p_l_pct'] = (df_resumo['p_l_eur'] / df_resumo['purchase_value']) * 100

#arrendondar valores
df_resumo['current_value'] = df_resumo['current_value'].round(2)
df_resumo['p_l_eur'] = df_resumo['p_l_eur'].round(2)
df_resumo['p_l_pct'] = df_resumo['p_l_pct'].round(2)
df_resumo['purchase_value'] = df_resumo['purchase_value'].round(2)

#total geral(ainda nao esta na bd)
total_investido = df_resumo['purchase_value'].sum()
total_atual = df_resumo['current_value'].sum()
lucro_total = df_resumo['p_l_eur'].sum()
rentabilidade_global = (lucro_total / total_investido) * 100



df_resumo.to_sql('open_positions_summary', conn, if_exists='replace', index=False)
conn.close()
