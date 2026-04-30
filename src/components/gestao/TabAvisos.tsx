import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Bell, Loader2, Plus, Save, Trash2, ToggleLeft, ToggleRight, AlertCircle, CheckCircle, Info, Zap } from 'lucide-react';

interface Aviso {
  id: string;
  titulo: string;
  corpo: string;
  ativa: boolean;
  tipo: string;
  criado_em: string;
}

const TIPOS = [
  { key: 'info', label: 'Informativo', icon: Info, color: 'text-blue-500 bg-blue-500/10 border-blue-400/30' },
  { key: 'sucesso', label: 'Sucesso', icon: CheckCircle, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-400/30' },
  { key: 'alerta', label: 'Alerta', icon: AlertCircle, color: 'text-amber-500 bg-amber-500/10 border-amber-400/30' },
  { key: 'urgente', label: 'Urgente', icon: Zap, color: 'text-red-500 bg-red-500/10 border-red-400/30' },
];

export default function TabAvisos() {
  const { isAdmin, usuario } = useAuth();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titulo: '', corpo: '', tipo: 'info' });

  useEffect(() => { loadAvisos(); }, []);

  async function loadAvisos() {
    setLoading(true);
    const { data } = await (supabase as any).from('avisos_app').select('*').order('criado_em', { ascending: false });
    setAvisos(data || []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.titulo.trim() || !form.corpo.trim()) {
      toast({ title: 'Preencha título e mensagem', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from('avisos_app').insert({
      titulo: form.titulo.trim(),
      corpo: form.corpo.trim(),
      tipo: form.tipo,
      ativa: true,
      criado_por: usuario?.id || null,
    });
    setSaving(false);
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: '✅ Aviso criado!' });
    setForm({ titulo: '', corpo: '', tipo: 'info' });
    setShowForm(false);
    loadAvisos();
  }

  async function toggleAtivo(aviso: Aviso) {
    await (supabase as any).from('avisos_app').update({ ativa: !aviso.ativa }).eq('id', aviso.id);
    setAvisos(prev => prev.map(a => a.id === aviso.id ? { ...a, ativa: !aviso.ativa } : a));
    toast({ title: aviso.ativa ? '⏸ Aviso desativado' : '▶️ Aviso ativado' });
  }

  async function deleteAviso(id: string) {
    if (!confirm('Excluir este aviso permanentemente?')) return;
    await (supabase as any).from('avisos_app').delete().eq('id', id);
    setAvisos(prev => prev.filter(a => a.id !== id));
    toast({ title: 'Aviso excluído' });
  }

  const getTipo = (key: string) => TIPOS.find(t => t.key === key) || TIPOS[0];
  const inputCls = 'w-full h-11 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30';

  // Usuários comuns só veem avisos ativos
  const avisosVisiveis = isAdmin ? avisos : avisos.filter(a => a.ativa);

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <Bell size={20} className="text-primary" />
        <div>
          <h2 className="text-base font-bold text-foreground">Avisos</h2>
          <p className="text-xs text-muted-foreground">{isAdmin ? 'Crie e gerencie avisos para os usuários' : 'Comunicados e avisos importantes'}</p>
        </div>
      </div>

      {isAdmin && (
        <button onClick={() => setShowForm(v => !v)}
          className="w-full h-12 gradient-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.97] transition-all">
          <Plus size={18} /> Criar Aviso
        </button>
      )}

      {isAdmin && showForm && (
        <div className="section-card space-y-3">
          <h3 className="text-sm font-bold text-foreground">Novo Aviso</h3>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setForm(f => ({ ...f, tipo: key }))}
                  className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                    form.tipo === key ? 'gradient-primary text-white border-transparent' : 'bg-card border-border text-muted-foreground'
                  }`}>
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Título *</label>
            <input type="text" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Reunião amanhã às 18h" className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Mensagem *</label>
            <textarea value={form.corpo} onChange={e => setForm(f => ({ ...f, corpo: e.target.value }))} rows={3}
              placeholder="Digite o aviso completo aqui..."
              className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          <button onClick={handleSave} disabled={saving}
            className="w-full h-11 gradient-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Salvando...' : 'Publicar Aviso'}
          </button>
        </div>
      )}

      {avisosVisiveis.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Bell size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum aviso {isAdmin ? '' : 'ativo '}no momento</p>
        </div>
      ) : (
        <div className="space-y-2">
          {avisosVisiveis.map(aviso => {
            const tipo = getTipo(aviso.tipo);
            const TipoIcon = tipo.icon;
            return (
              <div key={aviso.id} className={`section-card border ${tipo.color} ${!aviso.ativa ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${tipo.color} shrink-0`}>
                    <TipoIcon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{aviso.titulo}</p>
                      {!aviso.ativa && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium shrink-0">Inativo</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{aviso.corpo}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{new Date(aviso.criado_em).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-current/10">
                    <button onClick={() => toggleAtivo(aviso)}
                      className={`flex-1 h-8 flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                        aviso.ativa ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'
                      }`}>
                      {aviso.ativa ? <><ToggleLeft size={14} /> Desativar</> : <><ToggleRight size={14} /> Ativar</>}
                    </button>
                    <button onClick={() => deleteAviso(aviso.id)}
                      className="h-8 px-3 flex items-center gap-1 rounded-lg text-xs font-semibold bg-destructive/10 text-destructive active:scale-95">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
