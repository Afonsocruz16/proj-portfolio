import pandas as pd
import sqlite3


conn = sqlite3.connect('data/portfolio.db')


df_open = pd.read_excel('DATA/open_raw.xlsx', header=10)
df_closed = pd.read_excel('DATA/closed_raw.xlsx', header=4)
df_deposits = pd.read_excel('DATA/livro2.xlsx', header=4)

df_open = df_open.rename(columns={
    'Ticker': 'ticker',
    'Volume': 'quantity',
    'Open time (UTC)': 'open_date',
    'Open price': 'open_price',
    'Current price': 'market_price',
    'Value': 'current_value',    #value corresponde ao valor comprado multiplicado por o valor atual da açao
    'Gross Profit': 'gross_p_l'
})

df_open['purchase_value'] = df_open['current_value'] - df_open['gross_p_l']


df_closed = df_closed.rename(columns={
    'Ticker': 'ticker',
    'Volume': 'quantity',
    'Open Time (UTC)': 'open_date',
    'Open Price': 'open_price',
    'Close Time (UTC)': 'close_date',
    'Close Price': 'close_price',
    'Purchase Value': 'purchase_value',
    'Sale Value': 'sale_value',
    'Gross Profit': 'gross_p_l'
})

df_deposits = df_deposits.rename(columns={
    'Type': 'tipo',
    'Amount': 'valor'
}
)


colunas_finais_open = ['ticker', 'quantity', 'open_date', 'open_price', 'market_price', 'purchase_value', 'gross_p_l']
colunas_finais_closed = ['ticker', 'quantity', 'open_date', 'open_price', 'close_date', 'close_price', 'purchase_value', 'sale_value', 'gross_p_l']
colunas_finais_deposits = ['tipo', 'valor']

#Filtrar para ler so depositos e filtrar so para ler os type buy(agregava todas as posiçoes e metia dados duplicados, onde agregava nao tinha type buy)
df_deposits = df_deposits[df_deposits['tipo'] == 'Deposit']
df_open = df_open[df_open['Type'] == 'BUY']

df_open = df_open[colunas_finais_open]
df_closed = df_closed[colunas_finais_closed]
df_deposits = df_deposits[colunas_finais_deposits]

cursor = conn.cursor()

cursor.execute("DROP TABLE IF EXISTS open_positions")

cursor.execute("""
CREATE TABLE open_positions (
    ticker TEXT,
    quantity REAL,
    open_date TEXT,
    open_price REAL,
    market_price REAL,
    purchase_value REAL,
    gross_p_l REAL
)
""")

cursor.execute("DROP TABLE IF EXISTS closed_positions")

cursor.execute("""
CREATE TABLE closed_positions (
    ticker TEXT,
    quantity REAL,
    open_date TEXT,
    open_price REAL,
    close_date TEXT,
    close_price REAL,
    purchase_value REAL,
    sale_value REAL,
    gross_p_l REAL
)
""")

cursor.execute("DROP TABLE IF EXISTS deposits")

cursor.execute("""
CREATE TABLE deposits (
    tipo TEXT,
    valor REAL
)
""")


df_open.to_sql('open_positions', conn, if_exists='append', index=False)
df_closed.to_sql('closed_positions', conn, if_exists='append', index=False)
df_deposits.to_sql('deposits', conn, if_exists='append', index=False)

conn.close()

print("Sucesso!.")