import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { AlertCircle, Loader2, Send, RefreshCw } from 'lucide-react';

interface UsuarioSemCadastro {
  id: string;
  nome: string;
  tipo: string;
  ultimo_cadastro: string | null;
}

const TIPOS_MONITORADOS = [
  { val: 'fernanda',  label: 'Fernanda',  tabela: 'cadastros_fernanda',  campo: 'cadastrado_por' },
  { val: 'social',    label: 'Social',    tabela: 'cadastros_social',    campo: 'cadastrado_por' },
  { val: 'afiliado',  label: 'Afiliado',  tabela: 'cadastros_afiliados', campo: 'afiliado_id' },
  { val: 'lideranca', label: 'Liderança', tabela: 'liderancas',          campo: 'cadastrado_por' },
  { val: 'suplente',  label: 'Suplente',  tabela: 'liderancas',          campo: 'cadastrado_por' },
];

export default function TabCobranca() {
  const [tipoFiltro, setTipoFiltro] = useState(TIPOS_MONITORADOS[0].val);
  const [semCadastro, setSemCadastro] = useState<UsuarioSemCadastro[]>([]);
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = TIPOS_MONITORADOS.find(t => t.val === tipoFiltro)!;
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const { data: usuarios } = await (supabase as any)
        .from('hierarquia_usuarios')
        .select('id, nome, tipo')
        .eq('tipo', tipoFiltro)
        .eq('ativo', true)
        .order('nome');

      if (!usuarios || usuarios.length === 0) { setSemCadastro([]); return; }

      const { data: cadastrosHoje } = await (supabase as any)
        .from(cfg.tabela)
        .select(`${cfg.campo}`)
        .gte('criado_em', hoje.toISOString());

      const comCadastroHoje = new Set((cadastrosHoje || []).map((c: any) => c[cfg.campo]));

      const ids = usuarios.map((u: any) => u.id);
      const { data: ultimosCadastros } = await (supabase as any)
        .from(cfg.tabela)
        .select(`${cfg.campo}, criado_em`)
        .in(cfg.campo, ids)
        .order('criado_em', { ascending: false });

      const ultimoMap: Record<string, string> = {};
      for (const c of ultimosCadastros || []) {
        if (!ultimoMap[c[cfg.campo]]) ultimoMap[c[cfg.campo]] = c.criado_em;
      }

      const resultado: UsuarioSemCadastro[] = usuarios
        .filter((u: any) => !comCadastroHoje.has(u.id))
        .map((u: any) => ({
          id: u.id,
          nome: u.nome,
          tipo: u.tipo,
          ultimo_cadastro: ultimoMap[u.id] || null,
        }));

      setSemCadastro(resultado);
    } finally {
      setLoading(false);
    }
  }, [tipoFiltro]);

  useEffect(() => { carregar(); }, [carregar]);

  function diasDesde(dateStr: string | null): string {
    if (!dateStr) return 'nunca cadastrou';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (diff === 0) return 'hoje';
    if (diff === 1) return 'ontem';
    return `${diff} dias atrás`;
  }

  async function notificarTodos() {
    if (semCadastro.length === 0) return;
    setEnviando(true);
    try {
      const { data: novoAviso, error } = await (supabase as any)
        .from('avisos_app')
        .insert({
          titulo: 'Você não cadastrou hoje!',
          corpo: 'Não esqueça de registrar seus cadastros de hoje. Acesse o app agora!',
          tipo: 'urgente',
          ativa: true,
          persistente: true,
        })
        .select('id')
        .single();

      if (error) throw error;

      await (supabase as any).from('avisos_destinatarios').insert(
        semCadastro.map(u => ({ aviso_id: novoAviso.id, hierarquia_id: u.id }))
      );

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-notificacao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          aviso_id: novoAviso.id,
          hierarquia_ids: semCadastro.map(u => u.id),
        }),
      });
      const result = await res.json();
      toast({ title: `Push enviado para ${result.enviados ?? semCadastro.length} pessoa(s)` });
    } catch (err: any) {
      toast({ title: 'Erro ao notificar', description: err.message, variant: 'destructive' });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <AlertCircle size={20} className="text-amber-500" />
        <div>
          <h2 className="text-base font-bold">Sem cadastro hoje</h2>
          <p className="text-xs text-muted-foreground">Usuários que não registraram nenhum cadastro hoje</p>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
        {TIPOS_MONITORADOS.map(t => (
          <button key={t.val} onClick={() => setTipoFiltro(t.val)}
            className={`shrink-0 px-3 h-8 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
              tipoFiltro === t.val ? 'gradient-primary text-white' : 'bg-card border border-border text-muted-foreground'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={carregar} disabled={loading}
          className="h-10 px-4 rounded-xl bg-muted border border-border text-xs font-semibold flex items-center gap-1.5 active:scale-95">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
        <button onClick={notificarTodos} disabled={enviando || semCadastro.length === 0}
          className="flex-1 h-10 rounded-xl gradient-primary text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.97]">
          {enviando ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          Notificar todos ({semCadastro.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : semCadastro.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <AlertCircle size={32} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm font-semibold">Todos cadastraram hoje!</p>
          <p className="text-xs">Nenhum usuário {TIPOS_MONITORADOS.find(t => t.val === tipoFiltro)?.label} em falta</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {semCadastro.map(u => (
            <div key={u.id} className="section-card !py-3 !px-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <AlertCircle size={16} className="text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{u.nome}</p>
                <p className="text-[10px] text-muted-foreground">
                  Último cadastro: <span className={u.ultimo_cadastro ? 'text-amber-600' : 'text-red-500'}>{diasDesde(u.ultimo_cadastro)}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
