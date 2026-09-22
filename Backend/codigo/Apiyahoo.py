# pyrefly: ignore [missing-import]
import yfinance as yf
import pandas as pd
import sqlite3  

#Ligar bd
conn = sqlite3.connect('data/portfolio.db')
cursor = conn.cursor()

#Vai buscar tickers as open positions
cursor.execute("SELECT DISTINCT ticker FROM open_positions WHERE TICKER IS NOT NULL")
tickers_abertos = [row[0] for row in cursor.fetchall()]

cambio_eurusd = yf.Ticker('EURUSD=X').fast_info['lastPrice']

dados_cotacoes = []

for ticker in tickers_abertos:
    ticker_yahoo = ticker.replace('.US', '')

    # Obtém o preço atual
    try:
        ativo = yf.Ticker(ticker_yahoo)
        preco_atual = ativo.fast_info['lastPrice']
        if ticker.endswith('.US'):
            preco_atual = preco_atual / cambio_eurusd
        preco_atual = round(preco_atual, 3)

        print(f"Ticker: {ticker} -> Preço Atual: {preco_atual:.2f}")
    except:
        print(f"Não foi possível obter o preço para o ticker: {ticker}")

    dados_cotacoes.append({
        'ticker': ticker,
        'ticker_yahoo': ticker_yahoo,
        'current_price': preco_atual
    })

df_precos = pd.DataFrame(dados_cotacoes)
df_precos.to_sql('market_prices', conn, if_exists='replace', index=False)


conn.close()

print("Preços atualizados e guardados com sucesso.")
