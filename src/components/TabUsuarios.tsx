import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import ModulosUsuario from '@/components/ModulosUsuario';
import {
  Loader2, UserPlus, Users, User, CheckCircle2, Search, Eye, EyeOff,
  ChevronRight, ArrowLeft, Shield, Pencil, Trash2, KeyRound, Save
} from 'lucide-react';

interface SuplenteExterno {
  id: string;
  nome: string;
  regiao_atuacao: string | null;
  telefone: string | null;
  partido: string | null;
}

interface HierarchyUser {
  id: string;
  nome: string;
  tipo: string;
  suplente_id: string | null;
  auth_user_id: string | null;
  ativo: boolean;
}

type SubTab = 'suplentes' | 'avulso' | 'gerenciar';

export default function TabUsuarios() {
  const { isAdmin } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>('gerenciar');
  const [suplentes, setSuplentes] = useState<SuplenteExterno[]>([]);
  const [usuarios, setUsuarios] = useState<HierarchyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create user form state
  const [creating, setCreating] = useState<{ tipo: 'suplente' | 'avulso'; suplenteId?: string; nomeDefault: string } | null>(null);
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [tipoUsuario, setTipoUsuario] = useState<string>('suplente');
  const [superiorId, setSuperiorId] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit user state
  const [editing, setEditing] = useState<HierarchyUser | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editSenha, setEditSenha] = useState('');
  const [showEditSenha, setShowEditSenha] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Modules view
  const [viewingModules, setViewingModules] = useState<HierarchyUser | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [supRes, usrRes] = await Promise.all([
      supabase.functions.invoke('buscar-suplentes'),
      supabase.from('hierarquia_usuarios').select('id, nome, tipo, suplente_id, auth_user_id, ativo').eq('ativo', true).order('nome'),
    ]);
    if (!supRes.error && supRes.data) setSuplentes(supRes.data);
    setUsuarios((usrRes.data || []) as HierarchyUser[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const suplentesComUsuario = useMemo(() => {
    return new Set(usuarios.filter(u => u.suplente_id).map(u => u.suplente_id));
  }, [usuarios]);

  const possiveisSuperior = useMemo(() => {
    return usuarios.filter(u => ['super_admin', 'coordenador', 'suplente'].includes(u.tipo));
  }, [usuarios]);

  const filteredSuplentes = useMemo(() => {
    if (!search) return suplentes;
    const q = search.toLowerCase();
    return suplentes.filter(s => s.nome.toLowerCase().includes(q));
  }, [suplentes, search]);

  const filteredUsuarios = useMemo(() => {
    if (!search) return usuarios;
    const q = search.toLowerCase();
    return usuarios.filter(u => u.nome.toLowerCase().includes(q));
  }, [usuarios, search]);

  const openCreateSuplente = (sup: SuplenteExterno) => {
    setCreating({ tipo: 'suplente', suplenteId: sup.id, nomeDefault: sup.nome });
    setNome(sup.nome);
    setSenha('');
    setTipoUsuario('suplente');
    setSuperiorId('');
    setShowSenha(false);
  };

  const openCreateAvulso = () => {
    setCreating({ tipo: 'avulso', nomeDefault: '' });
    setNome('');
    setSenha('');
    setTipoUsuario('suplente');
    setSuperiorId('');
    setShowSenha(false);
  };

  const handleCreate = async () => {
    if (!nome.trim()) { toast({ title: 'Informe o nome', variant: 'destructive' }); return; }
    if (!senha.trim() || senha.length < 4) { toast({ title: 'Senha deve ter ao menos 4 caracteres', variant: 'destructive' }); return; }
    if (!creating) return;

    setSaving(true);
    try {
      const payload: any = {
        nome: nome.trim(),
        senha: senha.trim(),
        tipo: tipoUsuario,
        superior_id: superiorId || null,
      };
      if (creating.tipo === 'suplente' && creating.suplenteId) {
        payload.suplente_id = creating.suplenteId;
      }

      const { data, error } = await supabase.functions.invoke('criar-usuario', { body: payload });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({ title: '✅ Usuário criado!', description: `${nome} pode acessar o sistema` });
      setCreating(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const openEdit = (user: HierarchyUser) => {
    setEditing(user);
    setEditNome(user.nome);
    setEditSenha('');
    setShowEditSenha(false);
    setConfirmDelete(false);
  };

  const handleEdit = async () => {
    if (!editing) return;
    if (!editNome.trim()) { toast({ title: 'Nome não pode ser vazio', variant: 'destructive' }); return; }
    if (editSenha && editSenha.length < 4) { toast({ title: 'Senha deve ter ao menos 4 caracteres', variant: 'destructive' }); return; }

    setEditSaving(true);
    try {
      const payload: any = { acao: 'atualizar', hierarquia_id: editing.id, auth_user_id: editing.auth_user_id };
      if (editNome.trim() !== editing.nome) payload.novo_nome = editNome.trim();
      if (editSenha.trim()) payload.nova_senha = editSenha.trim();
      if (!payload.novo_nome && !payload.nova_senha) { toast({ title: 'Nenhuma alteração' }); setEditSaving(false); return; }

      const { data, error } = await supabase.functions.invoke('gerenciar-usuario', { body: payload });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({ title: '✅ Usuário atualizado!' });
      setEditing(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally { setEditSaving(false); }
  };

  const handleDelete = async () => {
    if (!editing) return;
    setEditSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('gerenciar-usuario', {
        body: { acao: 'deletar', hierarquia_id: editing.id, auth_user_id: editing.auth_user_id },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({ title: '✅ Usuário removido!' });
      setEditing(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally { setEditSaving(false); }
  };

  const inputCls = "w-full h-11 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30";

  const tipoLabel = (t: string) => {
    const labels: Record<string, string> = { super_admin: 'Admin', coordenador: 'Coord.', suplente: 'Suplente', lideranca: 'Liderança', fiscal: 'Fiscal' };
    return labels[t] || t;
  };

  const tipoColor = (t: string) => {
    const colors: Record<string, string> = {
      super_admin: 'bg-red-500/10 text-red-600',
      coordenador: 'bg-orange-500/10 text-orange-600',
      suplente: 'bg-blue-500/10 text-blue-600',
      lideranca: 'bg-purple-500/10 text-purple-600',
      fiscal: 'bg-emerald-500/10 text-emerald-600',
    };
    return colors[t] || 'bg-muted text-muted-foreground';
  };

  if (!isAdmin) {
    return (
      <div className="section-card text-center py-8">
        <Shield size={32} className="mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Acesso restrito a administradores</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  // MODULES VIEW
  if (viewingModules) {
    return (
      <div className="space-y-4 pb-24">
        <button onClick={() => setViewingModules(null)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="section-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">{viewingModules.nome}</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tipoColor(viewingModules.tipo)}`}>{tipoLabel(viewingModules.tipo)}</span>
            </div>
          </div>
          <ModulosUsuario usuarioId={viewingModules.id} />
        </div>
      </div>
    );
  }

  // EDIT VIEW
  if (editing) {
    return (
      <div className="space-y-4 pb-24">
        <button onClick={() => setEditing(null)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="section-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Pencil size={24} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Editar Usuário</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tipoColor(editing.tipo)}`}>{tipoLabel(editing.tipo)}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nome de acesso</label>
              <input type="text" value={editNome} onChange={e => setEditNome(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><KeyRound size={12} /> Nova senha (deixe vazio para manter)</label>
              <div className="relative">
                <input type={showEditSenha ? 'text' : 'password'} value={editSenha} onChange={e => setEditSenha(e.target.value)} className={inputCls} placeholder="Nova senha (opcional)" />
                <button onClick={() => setShowEditSenha(!showEditSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showEditSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button onClick={handleEdit} disabled={editSaving}
              className="w-full h-12 gradient-primary text-white text-sm font-semibold rounded-xl shadow-lg active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
              {editSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {editSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>

        {/* Modules */}
        <div className="section-card">
          <ModulosUsuario usuarioId={editing.id} />
        </div>

        {/* Delete */}
        <div className="section-card border-destructive/30">
          <h3 className="text-sm font-semibold text-destructive mb-2">Zona de perigo</h3>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)}
              className="w-full h-10 border border-destructive/30 text-destructive text-sm font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.97]">
              <Trash2 size={16} /> Remover Acesso
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Tem certeza? O usuário perderá acesso ao sistema.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="flex-1 h-10 bg-muted text-sm font-semibold rounded-xl">Cancelar</button>
                <button onClick={handleDelete} disabled={editSaving}
                  className="flex-1 h-10 bg-destructive text-destructive-foreground text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                  {editSaving ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Confirmar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // CREATE VIEW
  if (creating) {
    return (
      <div className="space-y-4 pb-24">
        <button onClick={() => setCreating(null)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="section-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <UserPlus size={24} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {creating.tipo === 'suplente' ? 'Criar Acesso (Suplente)' : 'Criar Usuário Avulso'}
              </h2>
              {creating.nomeDefault && <p className="text-xs text-muted-foreground">{creating.nomeDefault}</p>}
            </div>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nome de acesso</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} className={inputCls} placeholder="Nome completo" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Senha</label>
              <div className="relative">
                <input type={showSenha ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} className={inputCls} placeholder="Mínimo 4 caracteres" />
                <button onClick={() => setShowSenha(!showSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {creating.tipo === 'avulso' && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Tipo de usuário</label>
                <select value={tipoUsuario} onChange={e => setTipoUsuario(e.target.value)} className={inputCls}>
                  <option value="suplente">Suplente</option>
                  <option value="lideranca">Liderança</option>
                  <option value="fiscal">Fiscal</option>
                  <option value="coordenador">Coordenador</option>
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Superior hierárquico</label>
              <select value={superiorId} onChange={e => setSuperiorId(e.target.value)} className={inputCls}>
                <option value="">Nenhum (raiz)</option>
                {possiveisSuperior.map(u => (<option key={u.id} value={u.id}>{u.nome} ({tipoLabel(u.tipo)})</option>))}
              </select>
            </div>
            <button onClick={handleCreate} disabled={saving}
              className="w-full h-12 gradient-primary text-white text-sm font-semibold rounded-xl shadow-lg active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
              {saving ? 'Criando...' : 'Criar Usuário'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MAIN LIST VIEW
  const comAcesso = suplentes.filter(s => suplentesComUsuario.has(s.id)).length;
  const semAcesso = suplentes.length - comAcesso;

  return (
    <div className="space-y-3 pb-24">
      {/* Sub tabs */}
      <div className="flex gap-1.5">
        {([
          { id: 'gerenciar' as SubTab, label: `Usuários (${usuarios.length})` },
          { id: 'suplentes' as SubTab, label: `Suplentes (${suplentes.length})` },
          { id: 'avulso' as SubTab, label: '+ Avulso' },
        ]).map(t => (
          <button key={t.id} onClick={() => { setSubTab(t.id); setSearch(''); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              subTab === t.id ? 'gradient-primary text-white shadow-lg' : 'bg-card border border-border text-muted-foreground'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* AVULSO - Create user without suplente */}
      {subTab === 'avulso' && (
        <div className="space-y-3">
          <div className="section-card text-center py-6">
            <UserPlus size={32} className="mx-auto text-primary mb-2" />
            <h3 className="text-sm font-bold text-foreground mb-1">Criar Usuário Avulso</h3>
            <p className="text-xs text-muted-foreground mb-4">Crie um usuário sem vínculo com suplente do banco externo</p>
            <button onClick={openCreateAvulso}
              className="px-6 py-2.5 gradient-primary text-white text-sm font-semibold rounded-xl shadow-lg active:scale-[0.97]">
              <UserPlus size={16} className="inline mr-2" /> Criar Usuário
            </button>
          </div>
        </div>
      )}

      {/* SUPLENTES - Create from external DB */}
      {subTab === 'suplentes' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-card rounded-xl border border-border p-2.5 text-center">
              <p className="text-lg font-bold text-foreground">{suplentes.length}</p>
              <p className="text-[9px] text-muted-foreground">Total</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-2.5 text-center">
              <p className="text-lg font-bold text-emerald-500">{comAcesso}</p>
              <p className="text-[9px] text-muted-foreground">Com acesso</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-2.5 text-center">
              <p className="text-lg font-bold text-amber-500">{semAcesso}</p>
              <p className="text-[9px] text-muted-foreground">Sem acesso</p>
            </div>
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar suplente..."
              className="w-full h-11 pl-9 pr-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          <div className="space-y-2">
            {filteredSuplentes.map(s => {
              const temAcesso = suplentesComUsuario.has(s.id);
              const user = temAcesso ? usuarios.find(u => u.suplente_id === s.id) : null;
              return (
                <div key={s.id} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${temAcesso ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                    {temAcesso ? <CheckCircle2 size={18} className="text-emerald-500" /> : <User size={18} className="text-amber-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{s.nome}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{s.partido || '—'} · {s.regiao_atuacao || '—'}</p>
                  </div>
                  {temAcesso && user ? (
                    <button onClick={() => openEdit(user)}
                      className="flex items-center gap-1 px-2 py-1.5 bg-emerald-500/10 text-emerald-600 text-[10px] font-semibold rounded-lg active:scale-95 shrink-0">
                      <Pencil size={12} /> Editar
                    </button>
                  ) : (
                    <button onClick={() => openCreateSuplente(s)}
                      className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-semibold rounded-lg active:scale-95 shrink-0">
                      Criar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* GERENCIAR - All existing users */}
      {subTab === 'gerenciar' && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar usuário..."
              className="w-full h-11 pl-9 pr-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {/* Stats by type */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {['super_admin', 'coordenador', 'suplente', 'lideranca', 'fiscal'].map(tipo => {
              const count = usuarios.filter(u => u.tipo === tipo).length;
              if (count === 0) return null;
              return (
                <div key={tipo} className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-semibold ${tipoColor(tipo)}`}>
                  {tipoLabel(tipo)} ({count})
                </div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground">{filteredUsuarios.length} usuário{filteredUsuarios.length !== 1 ? 's' : ''}</p>

          <div className="space-y-2">
            {filteredUsuarios.map(u => (
              <div key={u.id} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{u.nome}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tipoColor(u.tipo)}`}>{tipoLabel(u.tipo)}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setViewingModules(u)}
                    className="p-2 bg-primary/10 text-primary rounded-lg active:scale-95" title="Permissões">
                    <Shield size={14} />
                  </button>
                  <button onClick={() => openEdit(u)}
                    className="p-2 bg-muted text-muted-foreground rounded-lg active:scale-95" title="Editar">
                    <Pencil size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
