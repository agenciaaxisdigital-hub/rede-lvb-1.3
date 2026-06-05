import { useState } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { formatCPF, cleanCPF } from '@/lib/cpf';

export type TipoCadastroEdit = 'eleitor' | 'lideranca' | 'cabo' | 'promotor' | 'fiscal';

export interface EditCadastroInicial {
  nome: string;
  cpf?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  titulo_eleitor?: string | null;
  zona_eleitoral?: string | null;
  secao_eleitoral?: string | null;
  municipio_eleitoral?: string | null;
  uf_eleitoral?: string | null;
  colegio_eleitoral?: string | null;
  observacoes?: string | null;
  // eleitor
  compromisso_voto?: string | null;
  regiao?: string | null;
  // lideranca / cabo / promotor
  regiao_atuacao?: string | null;
  nivel_comprometimento?: string | null;
  apoiadores_estimados?: number | null;
  // fiscal
  zona_fiscal?: string | null;
  secao_fiscal?: string | null;
  colegio_fiscal?: string | null;
}

interface Props {
  tipo: TipoCadastroEdit;
  registroId: string;
  pessoaId: string;
  inicial: EditCadastroInicial;
  onClose: () => void;
  onSaved: () => void;
}

const COMPROMISSO_OPT = ['Confirmado', 'Provável', 'Indefinido', 'Improvável'];
const COMPROMETIMENTO_OPT = ['Alto', 'Médio', 'Baixo'];

export default function EditCadastroModal({ tipo, registroId, pessoaId, inicial, onClose, onSaved }: Props) {
  const [form, setForm] = useState<EditCadastroInicial>({ ...inicial });
  const [saving, setSaving] = useState(false);

  const upd = (field: keyof EditCadastroInicial, value: any) =>
    setForm(f => ({ ...f, [field]: value }));

  const tipoLabel = { eleitor: 'Eleitor', lideranca: 'Liderança', cabo: 'Cabo Eleitoral', promotor: 'Promotor', fiscal: 'Fiscal' }[tipo];

  const handleSave = async () => {
    if (!form.nome?.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Atualiza tabela pessoas
      const { error: errPessoa } = await supabase.from('pessoas').update({
        nome: form.nome.trim(),
        cpf: form.cpf ? cleanCPF(form.cpf) || null : null,
        whatsapp: form.whatsapp?.trim() || null,
        instagram: form.instagram?.trim() || null,
        titulo_eleitor: form.titulo_eleitor?.trim() || null,
        zona_eleitoral: form.zona_eleitoral?.trim() || null,
        secao_eleitoral: form.secao_eleitoral?.trim() || null,
        municipio_eleitoral: form.municipio_eleitoral?.trim() || null,
        uf_eleitoral: form.uf_eleitoral?.trim() || 'GO',
        colegio_eleitoral: tipo !== 'fiscal' ? (form.colegio_eleitoral?.trim() || null) : null,
      }).eq('id', pessoaId);
      if (errPessoa) throw errPessoa;

      // Atualiza tabela específica do tipo
      if (tipo === 'eleitor') {
        const { error } = await supabase.from('possiveis_eleitores').update({
          compromisso_voto: form.compromisso_voto || null,
          observacoes: form.observacoes?.trim() || null,
          origem_captacao: form.regiao?.trim() || null,
        }).eq('id', registroId);
        if (error) throw error;
      } else if (tipo === 'lideranca' || tipo === 'cabo' || tipo === 'promotor') {
        const { error } = await supabase.from('liderancas').update({
          regiao_atuacao: form.regiao_atuacao?.trim() || null,
          nivel_comprometimento: form.nivel_comprometimento || null,
          apoiadores_estimados: form.apoiadores_estimados != null ? Number(form.apoiadores_estimados) : null,
          observacoes: form.observacoes?.trim() || null,
        }).eq('id', registroId);
        if (error) throw error;
      } else if (tipo === 'fiscal') {
        const { error } = await supabase.from('fiscais').update({
          zona_fiscal: form.zona_fiscal?.trim() || null,
          secao_fiscal: form.secao_fiscal?.trim() || null,
          colegio_eleitoral: form.colegio_fiscal?.trim() || null,
          observacoes: form.observacoes?.trim() || null,
        }).eq('id', registroId);
        if (error) throw error;
      }

      toast({ title: `✅ ${tipoLabel} atualizado com sucesso!` });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full h-11 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30';
  const lbl = 'text-xs font-medium text-muted-foreground';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[92vh] bg-background rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl flex flex-col">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">Editar {tipoLabel}</h2>
            <p className="text-[11px] text-muted-foreground">Corrija os dados e toque em Salvar</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted active:scale-95">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Corpo rolável */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-5">

          {/* Dados pessoais */}
          <section className="space-y-3">
            <p className="text-[11px] font-bold text-foreground uppercase tracking-wider">👤 Dados Pessoais</p>
            <div className="space-y-1">
              <label className={lbl}>Nome completo *</label>
              <input value={form.nome} onChange={e => upd('nome', e.target.value)} className={inp} placeholder="Nome completo" />
            </div>
            <div className="space-y-1">
              <label className={lbl}>CPF</label>
              <input
                value={form.cpf ? formatCPF(form.cpf) : ''}
                onChange={e => upd('cpf', cleanCPF(e.target.value))}
                className={inp} placeholder="000.000.000-00" maxLength={14} inputMode="numeric"
              />
            </div>
            <div className="space-y-1">
              <label className={lbl}>WhatsApp</label>
              <input value={form.whatsapp || ''} onChange={e => upd('whatsapp', e.target.value)} className={inp} placeholder="(00) 00000-0000" type="tel" />
            </div>
            <div className="space-y-1">
              <label className={lbl}>Instagram</label>
              <input value={form.instagram || ''} onChange={e => upd('instagram', e.target.value)} className={inp} placeholder="@usuario" />
            </div>
          </section>

          {/* Dados eleitorais */}
          <section className="space-y-3">
            <p className="text-[11px] font-bold text-foreground uppercase tracking-wider">🗳️ Dados Eleitorais</p>
            <div className="space-y-1">
              <label className={lbl}>Título de Eleitor</label>
              <input value={form.titulo_eleitor || ''} onChange={e => upd('titulo_eleitor', e.target.value)} className={inp} placeholder="Número do título" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className={lbl}>Zona</label>
                <input value={form.zona_eleitoral || ''} onChange={e => upd('zona_eleitoral', e.target.value)} className={inp} placeholder="045" />
              </div>
              <div className="space-y-1">
                <label className={lbl}>Seção</label>
                <input value={form.secao_eleitoral || ''} onChange={e => upd('secao_eleitoral', e.target.value)} className={inp} placeholder="0123" />
              </div>
            </div>
            <div className="space-y-1">
              <label className={lbl}>Município</label>
              <input value={form.municipio_eleitoral || ''} onChange={e => upd('municipio_eleitoral', e.target.value)} className={inp} placeholder="Cidade" />
            </div>
            {tipo !== 'fiscal' && (
              <div className="space-y-1">
                <label className={lbl}>Colégio Eleitoral</label>
                <input value={form.colegio_eleitoral || ''} onChange={e => upd('colegio_eleitoral', e.target.value)} className={inp} placeholder="Nome da escola / local" />
              </div>
            )}
          </section>

          {/* Campos específicos — Eleitor */}
          {tipo === 'eleitor' && (
            <section className="space-y-3">
              <p className="text-[11px] font-bold text-foreground uppercase tracking-wider">📋 Dados do Eleitor</p>
              <div className="space-y-1">
                <label className={lbl}>Compromisso de Voto</label>
                <select value={form.compromisso_voto || ''} onChange={e => upd('compromisso_voto', e.target.value)} className={inp}>
                  <option value="">Selecione...</option>
                  {COMPROMISSO_OPT.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className={lbl}>Região / Bairro</label>
                <input value={form.regiao || ''} onChange={e => upd('regiao', e.target.value)} className={inp} placeholder="Ex: Setor Bueno, Jardim América..." />
              </div>
              <div className="space-y-1">
                <label className={lbl}>Observações</label>
                <textarea value={form.observacoes || ''} onChange={e => upd('observacoes', e.target.value)} className={inp + ' h-20 py-2 resize-none'} placeholder="Observações adicionais" />
              </div>
            </section>
          )}

          {/* Campos específicos — Liderança / Cabo / Promotor */}
          {(tipo === 'lideranca' || tipo === 'cabo' || tipo === 'promotor') && (
            <section className="space-y-3">
              <p className="text-[11px] font-bold text-foreground uppercase tracking-wider">👑 Dados da Liderança</p>
              <div className="space-y-1">
                <label className={lbl}>Região de Atuação</label>
                <input value={form.regiao_atuacao || ''} onChange={e => upd('regiao_atuacao', e.target.value)} className={inp} placeholder="Bairros, regiões onde atua" />
              </div>
              <div className="space-y-1">
                <label className={lbl}>Nível de Comprometimento</label>
                <select value={form.nivel_comprometimento || ''} onChange={e => upd('nivel_comprometimento', e.target.value)} className={inp}>
                  <option value="">Selecione...</option>
                  {COMPROMETIMENTO_OPT.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className={lbl}>Apoiadores Estimados</label>
                <input type="number" min={0} value={form.apoiadores_estimados ?? ''} onChange={e => upd('apoiadores_estimados', e.target.value ? Number(e.target.value) : null)} className={inp} placeholder="Ex: 50" />
              </div>
              <div className="space-y-1">
                <label className={lbl}>Observações</label>
                <textarea value={form.observacoes || ''} onChange={e => upd('observacoes', e.target.value)} className={inp + ' h-20 py-2 resize-none'} placeholder="Observações adicionais" />
              </div>
            </section>
          )}

          {/* Campos específicos — Fiscal */}
          {tipo === 'fiscal' && (
            <section className="space-y-3">
              <p className="text-[11px] font-bold text-foreground uppercase tracking-wider">🔍 Dados da Fiscalização</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className={lbl}>Zona Fiscal</label>
                  <input value={form.zona_fiscal || ''} onChange={e => upd('zona_fiscal', e.target.value)} className={inp} placeholder="045" />
                </div>
                <div className="space-y-1">
                  <label className={lbl}>Seção Fiscal</label>
                  <input value={form.secao_fiscal || ''} onChange={e => upd('secao_fiscal', e.target.value)} className={inp} placeholder="0123" />
                </div>
              </div>
              <div className="space-y-1">
                <label className={lbl}>Colégio Eleitoral</label>
                <input value={form.colegio_fiscal || ''} onChange={e => upd('colegio_fiscal', e.target.value)} className={inp} placeholder="Nome da escola / local" />
              </div>
              <div className="space-y-1">
                <label className={lbl}>Observações</label>
                <textarea value={form.observacoes || ''} onChange={e => upd('observacoes', e.target.value)} className={inp + ' h-20 py-2 resize-none'} placeholder="Observações adicionais" />
              </div>
            </section>
          )}
        </div>

        {/* Rodapé fixo */}
        <div className="px-4 py-4 border-t border-border shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 gradient-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.97] disabled:opacity-50 shadow-lg shadow-primary/20"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}
