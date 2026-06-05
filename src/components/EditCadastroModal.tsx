import { useState } from 'react';
import { X, Loader2, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
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
  compromisso_voto?: string | null;
  regiao?: string | null;
  regiao_atuacao?: string | null;
  nivel_comprometimento?: string | null;
  apoiadores_estimados?: number | null;
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

const TIPO_LABEL: Record<TipoCadastroEdit, string> = {
  eleitor: 'Eleitor', lideranca: 'Liderança', cabo: 'Cabo Eleitoral',
  promotor: 'Promotor', fiscal: 'Fiscal',
};

function Field({ label, children, opcional }: { label: string; children: React.ReactNode; opcional?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
        <span>{label}</span>
        {opcional && <span className="font-normal normal-case text-[10px] opacity-60">opcional</span>}
      </label>
      {children}
    </div>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 text-left"
      >
        <span className="text-xs font-bold text-foreground">{title}</span>
        {open ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
      </button>
      {open && <div className="px-4 py-4 space-y-4 bg-card">{children}</div>}
    </div>
  );
}

export default function EditCadastroModal({ tipo, registroId, pessoaId, inicial, onClose, onSaved }: Props) {
  const [form, setForm] = useState<EditCadastroInicial>({ ...inicial });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const upd = (field: keyof EditCadastroInicial, value: any) =>
    setForm(f => ({ ...f, [field]: value }));

  const inp = [
    'w-full h-11 px-3.5',
    'bg-background border border-border rounded-xl',
    'text-sm text-foreground placeholder:text-muted-foreground/50',
    'outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
    'transition-all duration-150',
  ].join(' ');

  const sel = inp;
  const ta = inp + ' h-24 py-3 resize-none';

  const handleSave = async () => {
    if (!form.nome?.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
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

      setSaved(true);
      setTimeout(() => {
        onSaved();
        onClose();
      }, 900);
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/*
        Mobile  → bottom sheet (slide up, quase full screen)
        Desktop → dialog centralizado
      */}
      <div className={[
        'fixed z-50 bg-background flex flex-col',
        'shadow-2xl',
        // mobile: bottom sheet
        'inset-x-0 bottom-0 rounded-t-3xl max-h-[93dvh]',
        // sm+: dialog central
        'sm:inset-0 sm:m-auto sm:rounded-2xl sm:w-full sm:max-w-lg sm:h-fit sm:max-h-[90vh]',
        'animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:fade-in duration-300',
      ].join(' ')}>

        {/* Drag handle (mobile only) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">Editar {TIPO_LABEL[tipo]}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Corrija os dados e toque em Salvar</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted active:scale-90 transition-all"
          >
            <X size={17} className="text-muted-foreground" />
          </button>
        </div>

        {/* Scroll area */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">

          <Section title="👤 Dados Pessoais">
            <Field label="Nome completo">
              <input
                value={form.nome}
                onChange={e => upd('nome', e.target.value)}
                className={inp}
                placeholder="Nome completo"
                autoComplete="name"
              />
            </Field>
            <Field label="CPF" opcional>
              <input
                value={form.cpf ? formatCPF(form.cpf) : ''}
                onChange={e => upd('cpf', cleanCPF(e.target.value))}
                className={inp}
                placeholder="000.000.000-00"
                maxLength={14}
                inputMode="numeric"
              />
            </Field>
            <Field label="WhatsApp" opcional>
              <input
                value={form.whatsapp || ''}
                onChange={e => upd('whatsapp', e.target.value)}
                className={inp}
                placeholder="(00) 00000-0000"
                type="tel"
                inputMode="tel"
              />
            </Field>
            <Field label="Instagram" opcional>
              <input
                value={form.instagram || ''}
                onChange={e => upd('instagram', e.target.value)}
                className={inp}
                placeholder="@usuario"
                autoCapitalize="none"
              />
            </Field>
          </Section>

          <Section title="🗳️ Dados Eleitorais" defaultOpen={false}>
            <Field label="Título de Eleitor" opcional>
              <input
                value={form.titulo_eleitor || ''}
                onChange={e => upd('titulo_eleitor', e.target.value)}
                className={inp}
                placeholder="Número do título"
                inputMode="numeric"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Zona" opcional>
                <input
                  value={form.zona_eleitoral || ''}
                  onChange={e => upd('zona_eleitoral', e.target.value)}
                  className={inp}
                  placeholder="045"
                  inputMode="numeric"
                />
              </Field>
              <Field label="Seção" opcional>
                <input
                  value={form.secao_eleitoral || ''}
                  onChange={e => upd('secao_eleitoral', e.target.value)}
                  className={inp}
                  placeholder="0123"
                  inputMode="numeric"
                />
              </Field>
            </div>
            <Field label="Município" opcional>
              <input
                value={form.municipio_eleitoral || ''}
                onChange={e => upd('municipio_eleitoral', e.target.value)}
                className={inp}
                placeholder="Cidade"
              />
            </Field>
            {tipo !== 'fiscal' && (
              <Field label="Colégio Eleitoral" opcional>
                <input
                  value={form.colegio_eleitoral || ''}
                  onChange={e => upd('colegio_eleitoral', e.target.value)}
                  className={inp}
                  placeholder="Nome da escola / local"
                />
              </Field>
            )}
          </Section>

          {tipo === 'eleitor' && (
            <Section title="📋 Dados do Eleitor">
              <Field label="Compromisso de Voto" opcional>
                <select
                  value={form.compromisso_voto || ''}
                  onChange={e => upd('compromisso_voto', e.target.value)}
                  className={sel}
                >
                  <option value="">Selecione...</option>
                  {COMPROMISSO_OPT.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Região / Bairro" opcional>
                <input
                  value={form.regiao || ''}
                  onChange={e => upd('regiao', e.target.value)}
                  className={inp}
                  placeholder="Ex: Setor Bueno, Jardim América..."
                />
              </Field>
              <Field label="Observações" opcional>
                <textarea
                  value={form.observacoes || ''}
                  onChange={e => upd('observacoes', e.target.value)}
                  className={ta}
                  placeholder="Observações adicionais..."
                />
              </Field>
            </Section>
          )}

          {(tipo === 'lideranca' || tipo === 'cabo' || tipo === 'promotor') && (
            <Section title="👑 Dados da Liderança">
              <Field label="Região de Atuação" opcional>
                <input
                  value={form.regiao_atuacao || ''}
                  onChange={e => upd('regiao_atuacao', e.target.value)}
                  className={inp}
                  placeholder="Bairros, regiões onde atua"
                />
              </Field>
              <Field label="Comprometimento" opcional>
                <select
                  value={form.nivel_comprometimento || ''}
                  onChange={e => upd('nivel_comprometimento', e.target.value)}
                  className={sel}
                >
                  <option value="">Selecione...</option>
                  {COMPROMETIMENTO_OPT.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Apoiadores Estimados" opcional>
                <input
                  type="number"
                  min={0}
                  value={form.apoiadores_estimados ?? ''}
                  onChange={e => upd('apoiadores_estimados', e.target.value ? Number(e.target.value) : null)}
                  className={inp}
                  placeholder="Ex: 50"
                  inputMode="numeric"
                />
              </Field>
              <Field label="Observações" opcional>
                <textarea
                  value={form.observacoes || ''}
                  onChange={e => upd('observacoes', e.target.value)}
                  className={ta}
                  placeholder="Observações adicionais..."
                />
              </Field>
            </Section>
          )}

          {tipo === 'fiscal' && (
            <Section title="🔍 Dados da Fiscalização">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Zona Fiscal" opcional>
                  <input
                    value={form.zona_fiscal || ''}
                    onChange={e => upd('zona_fiscal', e.target.value)}
                    className={inp}
                    placeholder="045"
                    inputMode="numeric"
                  />
                </Field>
                <Field label="Seção Fiscal" opcional>
                  <input
                    value={form.secao_fiscal || ''}
                    onChange={e => upd('secao_fiscal', e.target.value)}
                    className={inp}
                    placeholder="0123"
                    inputMode="numeric"
                  />
                </Field>
              </div>
              <Field label="Colégio Eleitoral" opcional>
                <input
                  value={form.colegio_fiscal || ''}
                  onChange={e => upd('colegio_fiscal', e.target.value)}
                  className={inp}
                  placeholder="Nome da escola / local"
                />
              </Field>
              <Field label="Observações" opcional>
                <textarea
                  value={form.observacoes || ''}
                  onChange={e => upd('observacoes', e.target.value)}
                  className={ta}
                  placeholder="Observações adicionais..."
                />
              </Field>
            </Section>
          )}

          {/* Espaço extra para o botão fixo não cobrir conteúdo */}
          <div className="h-4" />
        </div>

        {/* Botão fixo no rodapé */}
        <div className="shrink-0 px-4 pb-6 pt-3 border-t border-border bg-background">
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={[
              'w-full h-13 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2',
              'transition-all duration-200 active:scale-[0.97] disabled:opacity-70',
              saved
                ? 'bg-emerald-500 text-white'
                : 'gradient-primary text-white shadow-lg shadow-primary/20',
            ].join(' ')}
            style={{ height: '52px' }}
          >
            {saved ? (
              <><CheckCircle2 size={20} /> Salvo com sucesso!</>
            ) : saving ? (
              <><Loader2 size={18} className="animate-spin" /> Salvando...</>
            ) : (
              'Salvar alterações'
            )}
          </button>
        </div>
      </div>
    </>
  );
}
