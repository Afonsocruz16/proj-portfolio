# # pyrefly: ignore [missing-import]
import streamlit as st
import pandas as pd
import sqlite3
# pyrefly: ignore [missing-import]
import plotly.express as px
import subprocess
import os
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


#CONFIGURAÇÃO DA PÁGINA
st.set_page_config(
    page_title="SmartOpTrack",
    layout="wide"
)

#FUNÇÃO: LER DA BASE DE DADOS
def carregar_dados():
    conn = sqlite3.connect(os.path.join(BASE_DIR, 'data', 'portfolio.db'))

    df_open = pd.read_sql_query("SELECT * FROM open_positions_summary", conn)
    df_close = pd.read_sql_query("SELECT * FROM closed_positions_summary", conn)
    df_deposits = pd.read_sql_query("SELECT * FROM deposits", conn)

    conn.close()
    return df_open, df_close, df_deposits
 
#FUNÇÃO: ATUALIZAR DADOS (CORRE OS 4 SCRIPTS)
def atualizar_dados():
    with st.spinner("A importar dados da corretora..."):
        subprocess.run(["python", os.path.join(BASE_DIR, "codigo", "tabelas_ligacaobc.py")], check=True, cwd=BASE_DIR)
    with st.spinner("A buscar cotações ao Yahoo Finance..."):
        subprocess.run(["python", os.path.join(BASE_DIR, "codigo", "Apiyahoo.py")], check=True, cwd=BASE_DIR)
    with st.spinner("A calcular posições abertas..."):
        subprocess.run(["python", os.path.join(BASE_DIR, "codigo", "new_open.py")], check=True, cwd=BASE_DIR)
    with st.spinner("A calcular histórico de vendas..."):
        subprocess.run(["python", os.path.join(BASE_DIR, "codigo", "new_close.py")], check=True, cwd=BASE_DIR)


#titulo
st.title(" O Meu Portfólio de Investimentos")

#BOTÃO ATUALIZAR
if st.button("🔄 Atualizar Dados"):
    atualizar_dados()
    st.success("Dados atualizados com sucesso!")
    st.rerun()

#CARREGAR DADOS
df_open, df_close, df_deposits = carregar_dados()

#SEPARADORES
tab1, tab2, tab3 = st.tabs(["💼 Portfólio Atual", "📋 Histórico de Vendas","📊 Desempenho Global"])



# SEPARADOR 1: PORTFÓLIO ATUAL
with tab1:

    #KPIs de Topo
    total_investido = df_open['purchase_value'].sum()
    total_atual     = df_open['current_value'].sum()
    lucro_atual     = df_open['p_l_eur'].sum()
    lucro_pct       = (lucro_atual / total_investido * 100) if total_investido > 0 else 0

    col1, col2, col3 = st.columns(3)
    col1.metric("💰 Total Investido(Compras abertas)",    f"{total_investido:,.2f} €")
    col2.metric("📊 Valor Atual",         f"{total_atual:,.2f} €")
    col3.metric("💹 Lucro / Perda Atual", f"{lucro_atual:+,.2f} €", f"{lucro_pct:+.2f}%")

    st.divider()

    #Gráficos
    col_graf1, col_graf2 = st.columns(2)

    with col_graf1:
        st.subheader("🍩 Alocação da Carteira")
        fig_donut = px.pie(
            df_open,
            names='ticker',
            values='current_value',
            hole=0.5,
        )
        fig_donut.update_traces(textposition='inside', textinfo='percent+label')
        st.plotly_chart(fig_donut, use_container_width=True)

    with col_graf2:
        st.subheader("🏆 Desempenho por Ativo (%)")
        df_sorted = df_open.sort_values('p_l_pct', ascending=True)
        fig_barras = px.bar(
            df_sorted,
            x='p_l_pct',
            y='ticker',
            orientation='h',
            color='p_l_pct',
            color_continuous_scale=['red', 'lightgray', 'green'],
            color_continuous_midpoint=0,
            labels={'p_l_pct': 'Rentabilidade (%)', 'ticker': 'Ativo'}
        )
        st.plotly_chart(fig_barras, use_container_width=True)

    st.divider()

    #Tabela de Posições
    st.subheader("📋 Detalhe das Posições Abertas")
    st.dataframe(
        df_open[[
            'ticker', 'quantity', 'purchase_value',
            'current_price', 'current_value', 'p_l_eur', 'p_l_pct'
        ]].rename(columns={
            'ticker':         'Ativo',
            'quantity':       'Qtd.',
            'purchase_value': 'Investido (€)',
            'current_price':  'Preço Atual (€)',
            'current_value':  'Valor Atual (€)',
            'p_l_eur':        'Lucro/Perda (€)',
            'p_l_pct':        'Rentab. (%)'
        }),
        use_container_width=True,
        hide_index=True
    )


# SEPARADOR 2: HISTÓRICO DE VENDAS
with tab2:

    #KPIs de Topo
    lucro_realizado      = df_close['p_l_eur'].sum()
    total_investido_hist = df_close['purchase_value'].sum()
    total_vendido        = df_close['sale_value'].sum()

    col4, col5, col6 = st.columns(3)
    col4.metric("✅ Lucro Realizado",       f"{lucro_realizado:+,.2f} €")
    col5.metric("📤 Total já Vendido",      f"{total_vendido:,.2f} €")
    col6.metric("📥 Total que Investiste que foi vendido",  f"{total_investido_hist:,.2f} €")

    st.divider()

    #Tabela de Histórico
    st.subheader("📋 Detalhe das Vendas Realizadas")
    st.dataframe(
        df_close[[
            'ticker', 'quantity', 'purchase_value',
            'sale_value', 'p_l_eur', 'p_l_pct'
        ]].rename(columns={
            'ticker':         'Ativo',
            'quantity':       'Qtd. Vendida',
            'purchase_value': 'Custo (€)',
            'sale_value':     'Valor de Venda (€)',
            'p_l_eur':        'Lucro/Perda (€)',
            'p_l_pct':        'Rentab. (%)'
        }),
        use_container_width=True,
        hide_index=True
    )

with tab3:
    total_comprado_sempre =df_open['purchase_value'].sum() + df_close['purchase_value'].sum()
    total_ganho_sempre = df_open['p_l_eur'].sum() + df_close['p_l_eur'].sum()

    rentab_global = (total_ganho_sempre / total_comprado_sempre * 100) if total_comprado_sempre > 0 else 0
    total_depositado = df_deposits['valor'].sum()

    col7, col10 , col_dep = st.columns(3)
    col7.metric("🛒 Total Comprado (Sempre)",     f"{total_comprado_sempre:,.2f} €")
    col10.metric("💰 Lucro Total (Tudo)",          f"{total_ganho_sempre:+,.2f} €", f"{rentab_global:+.2f}%")
    col_dep.metric("🏦 Total Depositado",       f"{total_depositado:,.2f} €")

    st.divider()

    st.subheader("📋 Rentabilidade por Ativo (Abertas + Fechadas)")

    # Preparar os dois DataFrames para juntar
    df_open_tab = df_open[['ticker', 'purchase_value', 'current_value', 'p_l_eur']].rename(columns={
        'purchase_value': 'investido_aberto',
        'current_value':  'valor_atual',
        'p_l_eur':        'lucro_aberto'
    })
    df_close_tab = df_close[['ticker', 'purchase_value', 'p_l_eur']].rename(columns={
        'purchase_value': 'investido_fechado',
        'p_l_eur':        'lucro_realizado'
    })
    # Juntar os dois por ticker
    df_global = pd.merge(df_open_tab, df_close_tab, on='ticker', how='outer').fillna(0)

    # Calcular totais combinados
    df_global['total_investido'] = df_global['investido_aberto'] + df_global['investido_fechado']
    df_global['lucro_total']     = df_global['lucro_aberto'] + df_global['lucro_realizado']
    df_global['rentab_total_pct'] = (df_global['lucro_total'] / df_global['total_investido'] * 100).round(2)
    df_global['lucro_total']      = df_global['lucro_total'].round(2)
    df_global['total_investido']  = df_global['total_investido'].round(2)

    # Status do ativo
    def status(row):
        if row['investido_aberto'] > 0 and row['investido_fechado'] > 0:
            return '🔄 Misto'
        elif row['investido_aberto'] > 0:
            return '🟢 Aberto'
        else:
            return '🔴 Fechado'
    df_global['status'] = df_global.apply(status, axis=1)

    # Ordenar por lucro total
    df_global = df_global.sort_values('lucro_total', ascending=False)
    st.dataframe(
        df_global[[
            'ticker', 'status', 'total_investido',
            'lucro_aberto', 'lucro_realizado', 'lucro_total', 'rentab_total_pct'
        ]].rename(columns={
            'ticker':           'Ativo',
            'status':           'Estado',
            'total_investido':  'Total Investido (€)',
            'lucro_aberto':     'Lucro Aberto (€)',
            'lucro_realizado':  'Lucro Realizado (€)',
            'lucro_total':      'Lucro Total (€)',
            'rentab_total_pct': 'Rentab. Total (%)'
        }),
        use_container_width=True,
        hide_index=True
        
    )
