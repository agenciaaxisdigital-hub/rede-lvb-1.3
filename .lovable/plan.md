
## Fase 2 — Permissões (já parcialmente implementado)
A lógica de `resolverLigacaoPolitica` e `CampoLigacaoPolitica` já cuida dos 3 fluxos (Suplente bloqueado, Liderança bloqueado, Coordenador/Admin editável). **Ajuste necessário**: Para Coordenador, filtrar busca de suplentes/lideranças para mostrar SOMENTE os que vieram do sistema externo E que são usuários do sistema (têm `auth_user_id` na `hierarquia_usuarios`).

## Fase 3 — Sistema de Eventos

### 1. Migração SQL
- Criar tabela `eventos` (id, nome, local, descricao, criado_por, ativo, criado_em, atualizado_em)
- Adicionar coluna `evento_id` (nullable FK) em: `liderancas`, `fiscais`, `possiveis_eleitores`
- RLS: admin full, autenticados lêem eventos ativos

### 2. Contexto de Evento Ativo
- Criar `EventoContext` com estado do evento selecionado (localStorage para persistência)
- Admin e Coordenador veem seletor de evento no header

### 3. Admin CRUD de Eventos
- Nova seção no AdminDashboard para criar/editar/remover eventos

### 4. Injetar evento_id nos formulários
- TabCadastrar (lideranças): incluir `evento_id` do contexto no `registroData`
- TabFiscais: idem
- TabEleitores: idem

### 5. Filtros por evento no dashboard
- Adicionar filtro por evento no ranking/registros
