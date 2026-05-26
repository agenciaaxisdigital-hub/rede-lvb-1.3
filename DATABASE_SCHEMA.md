# 📋 Esquema Detalhado do Banco de Dados - Rede Sarelli

Este documento fornece uma análise técnica profunda das tabelas, colunas e relacionamentos do banco de dados, servindo como a "Única Fonte de Verdade" para a equipe de desenvolvimento sênior.

## 🛠️ Tipos e Enums (Domínios)

### `tipo_usuario`
Define os papéis na hierarquia política:
- `super_admin`, `coordenador`, `suplente`, `lideranca`, `fiscal`, `fernanda`, `afiliado`

### `cargo_admin`
Define permissões de acesso ao painel:
- `super_admin`, `admin`, `editor`

---

## 👥 Núcleo de Usuários e Hierarquia

### `hierarquia_usuarios`
Tabela mestre de permissões e estrutura da rede.
- `id` (uuid, PK)
- `nome` (text)
- `tipo` (enum: `tipo_usuario`)
- `superior_id` (uuid, FK -> `hierarquia_usuarios`): Define o "chefe" imediato na rede.
- `suplente_id` (uuid, FK -> `suplentes`): Vínculo com o candidato.
- `auth_user_id` (uuid): Link com a tabela de autenticação do Supabase.
- `link_token` (text): Token para convites e links de afiliados.

### `usuarios` / `usuarios_painel` / `admin_users`
Tabelas de login para diferentes interfaces do sistema (Legado e Novo).

---

## 🗳️ Cadastros Políticos e Operacionais

### `pessoas`
Repositório central de dados de cidadãos.
- `id` (uuid, PK)
- `nome`, `cpf`, `telefone`, `whatsapp`, `email`
- **Dados Eleitorais**: `titulo_eleitor`, `zona_eleitoral`, `secao_eleitoral`, `municipio_eleitoral`, `uf_eleitoral`, `colegio_eleitoral`.
- **Social**: `instagram`, `facebook`, `outras_redes`.

### `liderancas`
Dados específicos de quem coordena grupos de eleitores.
- `pessoa_id` (uuid, FK -> `pessoas`): Dados pessoais.
- `meta_votos` (int): Objetivo de captação.
- `area_atuacao`: `regiao_atuacao`, `zona_atuacao`, `bairros_influencia`.
- `financeiro`: `meses_recebimento` (int[]), `suplente_id`.

### `fiscais`
Equipe de fiscalização de urnas.
- `pessoa_id` (uuid, FK -> `pessoas`)
- `secao_fiscal`, `zona_fiscal`: Local onde o fiscal atuará.
- `lideranca_id` (uuid, FK -> `liderancas`): Quem trouxe este fiscal.

### `suplentes`
Planejamento de campanha para candidatos.
- `expectativa_votos`, `total_campanha`.
- `fiscais_qtd`, `liderancas_qtd`: Metas de equipe.
- `retirada_mensal_valor`, `retirada_mensal_meses`.

---

## 💰 Módulo Financeiro

### `contas_pagar`
- `descricao`, `valor`, `data_vencimento`, `status` (pendente, pago, etc).
- `categoria`, `subcategoria`.
- `fornecedor_id` (uuid, FK -> `fornecedores`).
- `comprovante_url` (text): Link para o arquivo no storage.

### `fornecedores`
- `nome`, `cpf_cnpj`.
- `banco`, `agencia`, `conta`, `pix`.

---

## 📸 Galeria e Site Público

### `albuns` e `galeria_fotos`
Gestão de conteúdo visual para o site.
- `fixado_home` (bool): Destaque na página principal.
- `url_foto` (text): Caminho no CDN/Storage.

---

## 📊 Analytics e Monitoramento

### `acessos_site`
Log detalhado de visitantes.
- `dispositivo`, `navegador`, `sistema_operacional`.
- `utm_source`, `utm_medium`, `utm_campaign`: Rastreamento de origem de marketing.
- `latitude`, `longitude`, `cidade`, `bairro`: Geolocalização via IP.

### `cliques_whatsapp`
Monitoramento de conversão.
- `texto_botao`, `pagina_origem`, `telefone_destino`.

### `localizacoes_usuarios`
Rastreamento GPS (App Mobile).
- `latitude`, `longitude`, `bateria_nivel`, `em_movimento`.

---

## 🏛️ Dados Históricos (TSE)
Tabelas prefixadas com `bd_eleicoes_` contêm dados oficiais para análise de desempenho em anos anteriores (2020, 2022, 2024), permitindo cruzamento de dados com a rede atual.

---

## ⚙️ Inteligência Artificial

### `documentos_ia`
- `conteudo` (text): Texto processado (chunk).
- `embedding` (vector): Vetor para busca semântica (RAG).
- `tabela_origem`: Referência de onde o dado veio para contexto.
