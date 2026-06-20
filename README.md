# Controle de Abastecimento ARLA - Potencial Florestal

Este é um sistema profissional e acessível desenvolvido sob medida para frentistas nas UPBs de Limeira e Tatuí registrarem abastecimentos de ARLA de forma rápida, simples e confiável. Ele é totalmente otimizado para celulares Android, e funciona **100% offline (Modo Offline e cache PWA)** com sincronização automática quando a rede retorna.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React + Vite + PWA (Service Workers + IndexedDB para dados locais e cache completo)
- **Estilo**: CSS Vanilla moderno, responsivo (mobile-first), com botões grandes e suporte nativo a modo escuro.
- **Backend**: Node.js + Express (sincronização automática, agregação de dados e filtros administrativos)
- **Banco de Dados**: SQLite (centralizado no backend) + IndexedDB (local no navegador/celular)

---

## 🚀 Como Executar o Projeto Localmente

Certifique-se de ter o [Node.js](https://nodejs.org/) instalado.

1. **Instalar Dependências** (baixa concorrentemente as dependências da raiz, frontend e backend):
   ```bash
   npm install
   ```
   *(Caso ocorra restrição de scripts PowerShell no Windows, utilize `npm.cmd install`)*

2. **Iniciar o Ambiente de Desenvolvimento**:
   ```bash
   npm run dev
   ```
   Este comando iniciará concorrentemente:
   - **Frontend (Vite)**: na porta `http://localhost:5173`
   - **Backend (Express)**: na porta `http://localhost:5000` (com proxy automático configurado no Vite)

---

## 📱 Funcionamento e Funcionalidades

### 1. Registro de Abastecimento (Tela Principal)
- **UPB**: Botão de alternância rápida entre **Limeira** e **Tatuí** (salva a escolha do frentista para os próximos abastecimentos).
- **Placa do Veículo**: Autocomplete integrado. Ao selecionar, preenche automaticamente os campos **Frota** e **Empresa**.
- **Quantidade de ARLA**: Entrada com teclado numérico e botões rápidos (+5L, +10L, +20L).
- **Gravação**: Botão verde gigante. Ao salvar, é emitido um **feedback visual de sucesso** e um **feedback sonoro (beep duplo)** sintetizado pela Web Audio API, que funciona perfeitamente offline. O formulário limpa-se automaticamente, pronto para o próximo veículo.

### 2. Funcionamento Offline Integrado (Obrigatório)
- **PWA**: Pode ser instalado no Android como um aplicativo nativo adicionando-o à tela inicial.
- **IndexedDB**: Todos os abastecimentos realizados sem internet são armazenados localmente com o status `Pendente`.
- **Autocomplete Offline**: Ao carregar a aplicação online pela primeira vez, ela baixa a lista de veículos cadastrados e a armazena localmente no IndexedDB. Assim, o preenchimento automático continua funcionando mesmo no meio da floresta ou sem sinal de rede.
- **Indicador Visual**: O cabeçalho exibe um indicador claro em tempo real: `Online` (Verde) ou `Offline` (Amarelo).
- **Sincronização Automática**: Quando o celular restabelece conexão com a internet, o sistema envia automaticamente em segundo plano todos os abastecimentos pendentes, evitando duplicidades através de chaves únicas (UUIDs) geradas no cliente.

### 3. Painel Administrativo (Acesso Protegido)
- **Senha padrão**: `admin123`
- **Filtros e Pesquisas**: Filtre por período de data, placa, motorista, frota, empresa ou UPB.
- **Ações**: Permite **Editar** (ajustar quantidade, observações) ou **Excluir** registros direto na tabela.
- **Cadastro de Veículos**: Sub-aba dedicada para cadastrar novas placas, frotas e empresas de forma amigável para alimentar o autocomplete dos frentistas.

### 4. Dashboard de Indicadores
- Exibe o total de litros abastecidos **hoje** e **no mês**.
- Gráficos responsivos em barras mostrando a distribuição por UPB, veículo, frota e empresa.
- **Fallback Offline**: Se você estiver offline, o dashboard recalcula todos os gráficos na hora a partir dos dados do IndexedDB local.

### 5. Exportação de Relatórios
- **Excel (.xlsx)**: Exporta a lista filtrada em uma planilha formatada com ajuste automático de colunas.
- **CSV**: Exporta em formato CSV com codificação UTF-8 BOM e delimitador `;` para compatibilidade imediata com as configurações regionais do Excel no Brasil.

---

## 📂 Modelagem do Banco de Dados SQLite

O banco cria automaticamente as tabelas na primeira inicialização:

### Tabela `veiculos`
```sql
CREATE TABLE veiculos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    placa TEXT UNIQUE NOT NULL,
    frota TEXT NOT NULL,
    empresa TEXT NOT NULL
);
```

### Tabela `abastecimentos`
```sql
CREATE TABLE abastecimentos (
    id TEXT PRIMARY KEY,
    data_hora TEXT NOT NULL,
    upb TEXT NOT NULL,
    motorista TEXT NOT NULL,
    placa TEXT NOT NULL,
    frota TEXT NOT NULL,
    empresa TEXT NOT NULL,
    quantidade_arla REAL NOT NULL,
    observacoes TEXT,
    sincronizado INTEGER DEFAULT 1
);
```
