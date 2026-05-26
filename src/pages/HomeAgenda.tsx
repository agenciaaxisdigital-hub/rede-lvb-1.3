// src/pages/HomeAgenda.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Calendar, Loader2, LogOut, Search, Plus, Eye, X, Copy, RefreshCw, Save, Link2, MapPin
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface UsuarioAgendaItem {
  id: string;
  nome: string;
  tipo: string;
  criado_em: string;
  suplente_id: string | null;
  municipio_id: string | null;
  suplentes?: {
    nome: string;
    cargo_disputado: string | null;
  } | null;
}

interface Reuniao {
  id: string;
  usuario_id: string;
  data_reuniao: string;
  local: string;
  observacoes: string | null;
}

const tipoLabels: Record<string, string> = {
  super_admin: 'Admin',
  coordenador: 'Coord.',
  suplente: 'Suplente',
  lideranca: 'Liderança',
  fernanda: 'Fernanda',
  social: 'Social',
  agenda: 'Agenda',
};

const tipoColors: Record<string, string> = {
  super_admin: 'bg-red-500/10 text-red-600',
  coordenador: 'bg-orange-500/10 text-orange-600',
  suplente: 'bg-blue-500/10 text-blue-600',
  lideranca: 'bg-purple-500/10 text-purple-600',
  fernanda: 'bg-primary/10 text-primary',
  social: 'bg-teal-500/15 text-teal-600',
  agenda: 'bg-emerald-500/10 text-emerald-600',
};

export default function HomeAgenda() {
  const { usuario, signOut, isAdmin } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioAgendaItem[]>([]);
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);

  // Configuration
  const [icalUrl, setIcalUrl] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  // Manual Meeting Modal
  const [selectedUser, setSelectedUser] = useState<UsuarioAgendaItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ data: '', local: '', observacoes: '' });
  const [savingMeeting, setSavingMeeting] = useState(false);

  // User History Modal
  const [userHistory, setUserHistory] = useState<UsuarioAgendaItem | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch active users and suplentes separately to avoid schema cache relationship errors
      const { data: usersData, error: usersErr } = await supabase
        .from('hierarquia_usuarios')
        .select('id, nome, tipo, criado_em, suplente_id, municipio_id')
        .eq('ativo', true)
        .order('nome');

      if (usersErr) throw usersErr;

      const { data: suplentesData, error: suplentesErr } = await supabase
        .from('suplentes')
        .select('id, nome, cargo_disputado');

      if (suplentesErr) throw suplentesErr;

      const suplentesMap: Record<string, { nome: string; cargo_disputado: string | null }> = {};
      if (suplentesData) {
        for (const s of suplentesData) {
          suplentesMap[s.id] = { nome: s.nome, cargo_disputado: s.cargo_disputado };
        }
      }

      const mappedUsers = (usersData || []).map((u: any) => ({
        ...u,
        suplentes: u.suplente_id ? suplentesMap[u.suplente_id] || null : null
      }));

      setUsuarios(mappedUsers as UsuarioAgendaItem[]);

      // 2. Fetch all meetings
      const { data: reunioesData, error: reunioesErr } = await supabase
        .from('reunioes')
        .select('*')
        .order('data_reuniao', { ascending: false });

      if (reunioesErr) throw reunioesErr;
      setReunioes((reunioesData || []) as Reuniao[]);

      // 3. Fetch iCal URL config
      const { data: configData } = await supabase
        .from('configuracoes_app')
        .select('valor')
        .eq('chave', 'google_calendar_ical_url')
        .maybeSingle();

      if (configData) {
        setIcalUrl(configData.valor);
      }
    } catch (err: any) {
      console.error('[agenda] Error fetching data:', err);
      toast({ title: 'Erro ao carregar dados', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Google iCal Sync
  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sincronizar-agenda');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: '🔄 Google Agenda Sincronizada!',
        description: data.mensagem || 'Reuniões atualizadas com sucesso.',
      });
      fetchAll();
    } catch (err: any) {
      toast({
        title: 'Falha na sincronização',
        description: err.message || 'Erro ao conectar ao Google Agenda.',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  // Save iCal Link configuration (Admins only)
  const handleSaveConfig = async () => {
    if (!icalUrl.trim()) {
      toast({ title: 'Insira o link privado iCal', variant: 'destructive' });
      return;
    }
    setSavingConfig(true);
    try {
      const { error } = await supabase
        .from('configuracoes_app')
        .upsert({
          chave: 'google_calendar_ical_url',
          valor: icalUrl.trim(),
          atualizado_em: new Date().toISOString(),
        });
      if (error) throw error;
      toast({ title: '✅ Link iCal salvo com sucesso!' });
      fetchAll();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar configuração', description: err.message, variant: 'destructive' });
    } finally {
      setSavingConfig(false);
    }
  };

  // Log manual meeting
  const handleCreateMeeting = async () => {
    if (!selectedUser) return;
    if (!form.data || !form.local) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    setSavingMeeting(true);
    try {
      const { error } = await supabase
        .from('reunioes')
        .insert({
          usuario_id: selectedUser.id,
          registrado_por: usuario?.id,
          data_reuniao: new Date(form.data).toISOString(),
          local: form.local.trim(),
          observacoes: form.observacoes.trim() || null,
        });
      if (error) throw error;
      toast({ title: `✅ Reunião registrada para ${selectedUser.nome}!` });
      setForm({ data: '', local: '', observacoes: '' });
      setModalOpen(false);
      setSelectedUser(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar reunião', description: err.message, variant: 'destructive' });
    } finally {
      setSavingMeeting(false);
    }
  };

  // Helper to generate tag slugs
  const generateSlug = (nome: string) => {
    return nome
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9.]/g, '');
  };

  const filteredUsuarios = useMemo(() => {
    if (!search) return usuarios;
    const q = search.toLowerCase();
    return usuarios.filter(u => {
      const matchName = u.nome.toLowerCase().includes(q);
      const matchSuplente = u.suplentes?.nome?.toLowerCase().includes(q) || false;
      const matchCargo = u.suplentes?.cargo_disputado?.toLowerCase().includes(q) || false;
      return matchName || matchSuplente || matchCargo;
    });
  }, [usuarios, search]);

  const meetingsOfUser = useCallback((userId: string) => {
    return reunioes.filter(r => r.usuario_id === userId);
  }, [reunioes]);

  const getGoogleCalendarUrl = (titulo: string, dataStr: string, local: string, userName: string) => {
    try {
      const data = new Date(dataStr);
      const start = data.toISOString().replace(/-|:|\.\d\d\d/g, "");
      const end = new Date(data.getTime() + 60 * 60 * 1000).toISOString().replace(/-|:|\.\d\d\d/g, "");
      const params = new URLSearchParams({
        action: "TEMPLATE",
        text: titulo,
        dates: `${start}/${end}`,
        details: `Reunião de campanha - Rede Sarelli\n\n👤 Integrante: ${userName}\n🔗 Rede Sarelli`,
        location: local || "",
      });
      return `https://calendar.google.com/calendar/render?${params.toString()}`;
    } catch (e) {
      return '#';
    }
  };

  const inputCls = "w-full h-11 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border py-4">
        <div className="max-w-[600px] mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Calendar className="text-emerald-600" size={20} />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">Gestão de Agenda</h1>
              <p className="text-[10px] text-muted-foreground">Rede Política – Dra. Fernanda Sarelli</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="p-2 rounded-xl bg-destructive/10 text-destructive active:scale-95 transition-all"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[600px] w-full mx-auto px-4 py-4 space-y-4">
        {/* Google iCal Settings */}
        <div className="section-card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title flex items-center gap-1.5 text-sm font-bold">
              <Link2 size={16} className="text-primary" /> Google Agenda Sincronização
            </h2>
            {icalUrl && (
              <span className="text-[9px] px-2 py-0.5 bg-emerald-500/10 text-emerald-700 font-bold rounded-full">
                Conectado ✅
              </span>
            )}
          </div>

          {/* Configuration input ONLY visible for Admins */}
          {isAdmin && (
            <div className="space-y-1.5 p-3 bg-muted/40 rounded-xl border border-border/40">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Endereço Privado formato iCal (.ics) *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={icalUrl}
                  onChange={e => setIcalUrl(e.target.value)}
                  placeholder="https://calendar.google.com/.../basic.ics"
                  className="flex-1 h-9 px-3 bg-card border border-border rounded-xl text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/30"
                />
                <button
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  className="h-9 px-3 bg-primary text-primary-foreground font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 shrink-0"
                >
                  {savingConfig ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Salvar
                </button>
              </div>
            </div>
          )}

          {icalUrl ? (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="w-full h-11 gradient-primary text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-md shadow-primary/20"
            >
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {syncing ? 'Sincronizando...' : '🔄 Sincronizar Google Agenda Agora'}
            </button>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">⚠️ Nenhuma Google Agenda configurada.</p>
          )}
        </div>

        {/* User Search & List */}
        <div className="section-card space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="section-title text-sm font-bold flex items-center gap-1.5">
              <Calendar size={16} className="text-emerald-600" /> Acompanhar Integrantes
            </h2>
            <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-700 font-bold rounded-full">
              {usuarios.length} Ativos
            </span>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar integrante para verificar @ ou reuniões..."
              className={`${inputCls} pl-9 h-10 text-xs`}
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary" /></div>
          ) : filteredUsuarios.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum integrante encontrado.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {filteredUsuarios.map(u => {
                const userMeetings = meetingsOfUser(u.id);
                const count = userMeetings.length;
                const slug = generateSlug(u.nome);
                return (
                  <div key={u.id} className="p-3 bg-muted/30 border border-border/50 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">{u.nome.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-extrabold text-foreground truncate leading-normal">{u.nome}</p>
                      <div className="flex items-center gap-2 flex-wrap pt-0.5">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${tipoColors[u.tipo] || 'bg-muted text-muted-foreground'}`}>
                          {tipoLabels[u.tipo] || u.tipo}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`@${slug}`);
                            toast({ title: 'Tag copiada!', description: `@${slug} copiado com sucesso.` });
                          }}
                          className="text-xs font-mono font-extrabold bg-primary/15 hover:bg-primary/25 text-primary px-3 py-1 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shrink-0 shadow-sm border border-primary/10"
                          title="Clique para copiar a tag de linkagem"
                        >
                          <span className="tracking-wide">@{slug}</span>
                          <Copy size={11} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => { setUserHistory(u); }}
                        className="px-2 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 text-[10px] font-bold flex items-center gap-1 active:scale-95"
                      >
                        <Eye size={12} /> {count} R.
                      </button>
                      <button
                        onClick={() => { setSelectedUser(u); setForm({ data: '', local: '', observacoes: '' }); setModalOpen(true); }}
                        className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 active:scale-95"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Manual Meeting Registration Modal */}
      {modalOpen && selectedUser && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center px-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setModalOpen(false); setSelectedUser(null); }} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-5 space-y-3.5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Calendar size={14} className="text-primary" /> Registrar Reunião Manual
              </h4>
              <button onClick={() => { setModalOpen(false); setSelectedUser(null); }} className="p-1 rounded-lg hover:bg-muted"><X size={14} /></button>
            </div>

            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Integrante</p>
              <p className="text-xs font-bold text-primary mt-0.5">{selectedUser.nome}</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Data e Hora *</label>
                <input
                  type="datetime-local"
                  value={form.data}
                  onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Local *</label>
                <input
                  type="text"
                  value={form.local}
                  onChange={e => setForm(f => ({ ...f, local: e.target.value }))}
                  placeholder="Ex: Comitê Central, Bairro Jardim, etc."
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Observações (opcional)</label>
                <textarea
                  value={form.observacoes}
                  onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  placeholder="Observações ou notas do alinhamento..."
                  rows={2}
                  className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            <button
              onClick={handleCreateMeeting}
              disabled={savingMeeting || !form.data || !form.local}
              className="w-full h-11 bg-primary text-primary-foreground text-xs font-bold rounded-xl flex items-center justify-center gap-2 active:scale-[0.97] transition-all disabled:opacity-50"
            >
              {savingMeeting ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
              Confirmar Reunião
            </button>
          </div>
        </div>
      )}

      {/* User History/Meetings Modal */}
      {userHistory && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center px-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setUserHistory(null)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-5 space-y-3.5 max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-2.5 shrink-0">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Calendar size={14} className="text-primary" /> Histórico de Reuniões
              </h4>
              <button onClick={() => setUserHistory(null)} className="p-1 rounded-lg hover:bg-muted"><X size={14} /></button>
            </div>

            <div className="shrink-0 bg-primary/5 border border-primary/20 rounded-xl p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase">Integrante</p>
              <p className="text-xs font-bold text-foreground truncate">{userHistory.nome}</p>
              <span className={`inline-block text-[9px] px-1.5 py-0.5 mt-1 rounded font-bold uppercase ${tipoColors[userHistory.tipo] || 'bg-muted text-muted-foreground'}`}>
                {tipoLabels[userHistory.tipo] || userHistory.tipo}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[200px]">
              {meetingsOfUser(userHistory.id).length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhuma reunião registrada ainda.</p>
              ) : (
                meetingsOfUser(userHistory.id).map(reuniao => (
                  <div key={reuniao.id} className="p-3 bg-muted/40 border border-border/50 rounded-xl space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground">
                          {new Date(reuniao.data_reuniao).toLocaleDateString('pt-BR', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate font-medium flex items-center gap-0.5">
                          <MapPin size={10} className="text-primary" /> {reuniao.local}
                        </p>
                      </div>
                      <a
                        href={getGoogleCalendarUrl(`Reunião: ${userHistory.nome}`, reuniao.data_reuniao, reuniao.local, userHistory.nome)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-semibold bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 transition-all shrink-0 active:scale-95"
                      >
                        <Calendar size={8} /> Add Google
                      </a>
                    </div>
                    {reuniao.observacoes && (
                      <p className="text-[10px] text-muted-foreground leading-relaxed border-t border-border/40 pt-1.5 italic font-medium">
                        {reuniao.observacoes}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setUserHistory(null)}
              className="w-full h-11 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-xl shrink-0"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      <footer className="fixed bottom-0 inset-x-0 bg-background border-t border-border py-3 px-4 text-center text-[10px] text-muted-foreground z-30">
        Rede Política – Dra. Fernanda Sarelli
      </footer>
    </div>
  );
}
