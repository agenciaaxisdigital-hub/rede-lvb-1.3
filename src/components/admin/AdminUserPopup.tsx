import { X, MapPin, Users, Target, Shield, Loader2, Trash2 } from 'lucide-react';
import { PopupUserData, tipoLabel, LiderancaReg, EleitorReg, FiscalReg } from './adminTypes';

interface Props {
  popupUser: string | null;
  popupUserData: PopupUserData | null;
  onClose: () => void;
  getCargoTag: (supId: string | null) => string | null;
  nomeMunicipioPorId: (id: string | null | undefined) => string | undefined;
  deletingId: string | null;
  handleDeleteCadastro: (id: string, tipo: 'lideranca' | 'eleitor' | 'fiscal') => void;
}

const Field = ({ label, value }: { label: string; value: any }) => (
  <div className="text-[10px] bg-background rounded px-2 py-1">
    <span className="text-muted-foreground">{label}:</span>{' '}
    <span className={value ? 'text-foreground' : 'text-muted-foreground/50 italic'}>{value || '—'}</span>
  </div>
);

export default function AdminUserPopup({
  popupUser, popupUserData, onClose, getCargoTag, nomeMunicipioPorId, deletingId, handleDeleteCadastro,
}: Props) {
  if (!popupUser || !popupUserData) return null;

  const { usuario } = popupUserData;
  const totalCount =
    popupUserData.liderancas.length + popupUserData.cabos.length + popupUserData.promotores.length +
    popupUserData.eleitores.length + popupUserData.fiscais.length +
    popupUserData.fernanda.length + popupUserData.social.length;

  const allRecords = [
    ...popupUserData.liderancas.map(r => ({ ...r, _tipo: 'lideranca' as const })),
    ...popupUserData.cabos.map(r => ({ ...r, _tipo: 'cabo' as const })),
    ...popupUserData.promotores.map(r => ({ ...r, _tipo: 'promotor' as const })),
    ...popupUserData.eleitores.map(r => ({ ...r, _tipo: 'eleitor' as const })),
    ...popupUserData.fiscais.map(r => ({ ...r, _tipo: 'fiscal' as const })),
    ...popupUserData.fernanda.map(r => ({
      ...r, _tipo: 'fernanda' as const,
      pessoas: { nome: r.nome, whatsapp: r.telefone, email: null, instagram: r.instagram, facebook: null,
        cpf: null, telefone: null, titulo_eleitor: null, zona_eleitoral: null, secao_eleitoral: null,
        municipio_eleitoral: null, uf_eleitoral: null, colegio_eleitoral: null, endereco_colegio: null },
    })),
    ...popupUserData.social.map(r => ({
      ...r, _tipo: 'social' as const,
      pessoas: { nome: r.nome, whatsapp: r.whatsapp, email: null, instagram: r.instagram, facebook: null,
        cpf: null, telefone: null, titulo_eleitor: null, zona_eleitoral: null, secao_eleitoral: null,
        municipio_eleitoral: null, uf_eleitoral: null, colegio_eleitoral: null, endereco_colegio: null },
    })),
  ].sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());

  const tipoBadge = (tipo: string) => {
    const map: Record<string, string> = {
      lideranca: 'bg-primary/15 text-primary', cabo: 'bg-pink-500/15 text-pink-600',
      fiscal: 'bg-amber-500/15 text-amber-600', promotor: 'bg-purple-500/15 text-purple-600',
      fernanda: 'bg-rose-500/15 text-rose-600', social: 'bg-teal-500/15 text-teal-600',
      eleitor: 'bg-secondary text-secondary-foreground',
    };
    return map[tipo] || 'bg-secondary text-secondary-foreground';
  };
  const tipoName = (tipo: string) => ({
    lideranca: 'Liderança', cabo: 'Cabo', fiscal: 'Fiscal', promotor: 'Promotor',
    fernanda: 'Fernanda', social: 'Social', eleitor: 'Eleitor',
  }[tipo] || tipo);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] bg-background rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-3 p-4 border-b border-border shrink-0">
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-lg font-bold text-primary">{usuario?.nome?.charAt(0) || '?'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-foreground truncate">{usuario?.nome || 'Desconhecido'}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-primary/10 text-primary">{tipoLabel(usuario?.tipo || '')}</span>
              {getCargoTag(usuario?.suplente_id || null) && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-accent/50 text-accent-foreground font-medium">{getCargoTag(usuario?.suplente_id || null)}</span>
              )}
              {usuario?.municipio_id && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <MapPin size={9} />{nomeMunicipioPorId(usuario.municipio_id)}
                </span>
              )}
            </div>
          </div>
          <div className="text-right mr-2">
            <p className="text-2xl font-black text-primary">{totalCount}</p>
            <p className="text-[9px] text-muted-foreground">cadastros</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted active:scale-95">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-border shrink-0">
          {[
            { data: popupUserData.liderancas, label: 'Lideranças', cls: 'bg-primary/15 text-primary', Icon: Users },
            { data: popupUserData.cabos, label: 'Cabos', cls: 'bg-pink-500/15 text-pink-600', Icon: Users },
            { data: popupUserData.eleitores, label: 'Eleitores', cls: 'bg-secondary text-secondary-foreground', Icon: Target },
            { data: popupUserData.fiscais, label: 'Fiscais', cls: 'bg-amber-500/15 text-amber-600', Icon: Shield },
            { data: popupUserData.promotores, label: 'Promotores', cls: 'bg-purple-500/15 text-purple-600', Icon: Users },
            { data: popupUserData.fernanda, label: 'Fernanda', cls: 'bg-rose-500/15 text-rose-600', Icon: Users },
            { data: popupUserData.social, label: 'Social', cls: 'bg-teal-500/15 text-teal-600', Icon: Users },
          ].filter(({ data }) => data.length > 0).map(({ data, label, cls, Icon }) => (
            <span key={label} className={`text-xs font-bold px-2.5 py-1 rounded-lg ${cls}`}>
              <Icon size={12} className="inline mr-1" />{label}: {data.length}
            </span>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-2">
          {allRecords.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum cadastro no período selecionado</p>
          )}
          {allRecords.map((r: any) => {
            const p = r.pessoas || {};
            return (
              <div key={r.id} className="p-3 rounded-xl bg-muted/50 border border-border/50 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${tipoBadge(r._tipo)}`}>
                      {tipoName(r._tipo)}
                    </span>
                    <p className="text-sm font-semibold text-foreground">{p.nome || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{new Date(r.criado_em).toLocaleDateString('pt-BR')}</span>
                    {(r._tipo === 'lideranca' || r._tipo === 'cabo' || r._tipo === 'eleitor' || r._tipo === 'fiscal') && (
                      <button
                        onClick={() => handleDeleteCadastro(r.id, r._tipo === 'eleitor' ? 'eleitor' : (r._tipo === 'cabo' ? 'lideranca' : r._tipo))}
                        disabled={deletingId === r.id}
                        className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      >
                        {deletingId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <Field label="CPF" value={p.cpf} />
                  <Field label="WhatsApp" value={p.whatsapp} />
                  <Field label="E-mail" value={p.email} />
                  <Field label="Instagram" value={p.instagram || p.facebook} />
                </div>
                {(r._tipo === 'lideranca' || r._tipo === 'cabo') && (
                  <div className="grid grid-cols-2 gap-1">
                    <Field label="Região" value={r.regiao_atuacao} />
                    <Field label="Comprometimento" value={r.nivel_comprometimento} />
                    <Field label="Apoiadores" value={r.apoiadores_estimados} />
                    <Field label="Meta votos" value={r.meta_votos} />
                  </div>
                )}
                {r._tipo === 'eleitor' && <div className="grid grid-cols-2 gap-1"><Field label="Compromisso" value={r.compromisso_voto} /></div>}
                {r._tipo === 'fiscal' && (
                  <div className="grid grid-cols-2 gap-1">
                    <Field label="Zona fiscal" value={r.zona_fiscal} />
                    <Field label="Seção fiscal" value={r.secao_fiscal} />
                    <Field label="Colégio" value={r.colegio_eleitoral} />
                  </div>
                )}
                {r.observacoes && <Field label="Observações" value={r.observacoes} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
