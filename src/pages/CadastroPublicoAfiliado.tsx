import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, ClipboardList, Eye, EyeOff, KeyRound, LogIn, MapPin, Heart, Sparkles, UserCheck } from 'lucide-react';
import { checkTelefone } from '@/hooks/useInstagramCheck';
import { TelefoneStatusIcon, telefoneHelpText } from '@/components/CampoStatusIcon';
import { validateCPF } from '@/lib/cpf';

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export default function CadastroPublicoAfiliado() {
  const params = useParams<{ token?: string; slugComToken?: string }>();
  // Suporta 3 formatos de URL:
  //  - /cadastro/:token              (legado)
  //  - /c/:slug/:token               (legado)
  //  - /r/:slugComToken              (novo, formato curto: nome-xxxxxxxx)
  const token = useMemo(() => {
    if (params.token) return params.token;
    if (params.slugComToken) {
      const idx = params.slugComToken.lastIndexOf('-');
      if (idx > 0) return params.slugComToken.slice(idx + 1);
      return params.slugComToken;
    }
    return undefined;
  }, [params.token, params.slugComToken]);
  const navigate = useNavigate();
  const tipoParam = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const qs = new URLSearchParams(window.location.search);
    const t = qs.get('t') || qs.get('tipo');
    return t === 'lideranca' || t === 'cabo' || t === 'fiscal' || t === 'eleitor' || t === 'fernanda' || t === 'afiliado' || t === 'promotor' ? t : null;
  }, []);
  const tipoLabel = tipoParam === 'lideranca'
    ? 'Convite para Liderança'
    : tipoParam === 'cabo'
    ? 'Convite para Cabo Eleitoral'
    : tipoParam === 'fiscal'
    ? 'Convite para Fiscal'
    : tipoParam === 'eleitor'
    ? 'Convite para Eleitor'
    : tipoParam === 'fernanda'
    ? 'Cadastro Dra. Fernanda'
    : tipoParam === 'afiliado'
    ? 'Cadastro de Afiliado'
    : tipoParam === 'promotor'
    ? 'Convite para Promotor'
    : null;

  // Detecção de modo: 'captacao' (link de afiliado ativo, formulário simples)
  // ou 'criar_acesso' (registro pendente do próprio afiliado, fluxo completo)
  const [modo, setModo] = useState<'detectando' | 'captacao' | 'criar_acesso' | 'invalido'>('detectando');
  const [afiliadoNome, setAfiliadoNome] = useState<string>('');
  const [tokenCompleto, setTokenCompleto] = useState<string>('');
  const [afiliadoId, setAfiliadoId] = useState<string>('');

  // Captação (público)
  const [capNome, setCapNome] = useState('');
  const [capCpf, setCapCpf] = useState('');
  const [capTelefone, setCapTelefone] = useState('');
  const [capData, setCapData] = useState('');
  const [capRede, setCapRede] = useState('');
  const [capInstagram, setCapInstagram] = useState('');
  const capInstagramAlvo = tipoParam === 'fernanda' ? capInstagram : capRede;
  const telStatusCap = checkTelefone(capTelefone);
  // Eleitorais (lideranca/fiscal/eleitor)
  const [capTitulo, setCapTitulo] = useState('');
  const [capZona, setCapZona] = useState('');
  const [capSecao, setCapSecao] = useState('');
  const [capColegio, setCapColegio] = useState('');
  const [capMunicipioEl, setCapMunicipioEl] = useState('');
  const [capUfEl, setCapUfEl] = useState('GO');
  // Específicos
  const [capApoiadores, setCapApoiadores] = useState('');
  const [capBairros, setCapBairros] = useState('');
  const [capCompromisso, setCapCompromisso] = useState('');
  const [capObs, setCapObs] = useState('');
  const [capSaving, setCapSaving] = useState(false);
  const [capSuccess, setCapSuccess] = useState(false);
  const [capErrors, setCapErrors] = useState<Record<string, string>>({});
  const [countdown, setCountdown] = useState(3);

  // Pessoais
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [cep, setCep] = useState('');
  const [cidadeCep, setCidadeCep] = useState('');
  const [ufCep, setUfCep] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [instagram, setInstagram] = useState('');
  const telStatusSarelli = checkTelefone(whatsapp);
  // Eleitorais
  const [tituloEleitor, setTituloEleitor] = useState('');
  const [zonaEleitoral, setZonaEleitoral] = useState('');
  const [secaoEleitoral, setSecaoEleitoral] = useState('');
  const [municipioEleitoral, setMunicipioEleitoral] = useState('');
  const [ufEleitoral, setUfEleitoral] = useState('GO');
  const [colegioEleitoral, setColegioEleitoral] = useState('');
  // Login
  const [usuarioLogin, setUsuarioLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<{ login: string } | null>(null);
  const [mainErrors, setMainErrors] = useState<Record<string, string>>({});

  useEffect(() => { document.title = 'Cadastro de Afiliado'; }, []);

  useEffect(() => {
    if (!capSuccess) return;
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(interval);
          window.location.href = 'https://www.instagram.com/drafernandasarelli/';
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [capSuccess]);

  // Detectar tipo do link ao montar — edge function roda com service_role (bypass RLS)
  useEffect(() => {
    if (!token) { setModo('invalido'); return; }
    (async () => {
      try {
        const url = `${SUPABASE_URL}/functions/v1/captacao-afiliado?token=${encodeURIComponent(token)}`;
        const r = await fetch(url, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });
        const j = await r.json();
        if (!r.ok || j?.error) {
          // Fallback para links antigos com token truncado (8 chars) — busca por prefixo
          if (token.length <= 8) {
            const { data: row } = await (supabase as any)
              .from('hierarquia_usuarios')
              .select('id, nome')
              .ilike('link_token', `${token}%`)
              .maybeSingle();
            if (row?.id) {
              setAfiliadoId(row.id);
              setAfiliadoNome(row.nome || '');
              setTokenCompleto(token);
              setModo(tipoParam === 'afiliado' ? 'criar_acesso' : 'captacao');
              return;
            }
          }
          setModo('invalido');
          return;
        }
        setAfiliadoNome(j.afiliado_nome || '');
        setTokenCompleto(token);

        // Captura afiliado_id — tenta do GET response primeiro, depois query direta
        const idDoGet = j.afiliado_id || j.id || '';
        if (idDoGet) {
          setAfiliadoId(idDoGet);
        } else {
          // Tenta buscar diretamente (funciona se RLS permitir leitura anon)
          const { data: row } = await (supabase as any)
            .from('hierarquia_usuarios')
            .select('id')
            .eq('link_token', token)
            .maybeSingle();
          if (row?.id) setAfiliadoId(row.id);
        }
        if (tipoParam === 'afiliado') {
          setModo('criar_acesso');
        } else {
          setModo(j.is_ativo !== false ? 'captacao' : 'criar_acesso');
        }
      } catch {
        setModo('invalido');
      }
    })();
  }, [token, tipoParam]);

  const buscarCidadePorCep = async (raw: string) => {
    const cepLimpo = raw.replace(/\D/g, '');
    if (cepLimpo.length !== 8) { setCidadeCep(''); setUfCep(''); return; }
    setBuscandoCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const d = await r.json();
      if (d?.erro) { setCidadeCep(''); setUfCep(''); }
      else { setCidadeCep(d.localidade || ''); setUfCep(d.uf || ''); }
    } catch {
      setCidadeCep(''); setUfCep('');
    } finally {
      setBuscandoCep(false);
    }
  };

  const handleSubmitCaptacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const erros: Record<string, string> = {};
    if (!capNome.trim() || capNome.trim().length < 2) erros.nome = 'Nome obrigatório (mín. 2 caracteres)';
    const capTelDigits = capTelefone.replace(/\D/g, '');
    if (!capTelefone.trim() || capTelDigits.length < 10) erros.telefone = 'Telefone com DDD obrigatório (mín. 10 dígitos)';
    if (!capData) erros.data = 'Data de nascimento obrigatória';
    const instagramInformado = capInstagramAlvo.trim();
    if (!instagramInformado) erros.instagram = 'Instagram obrigatório';
    const cpfDigitsVal = capCpf.replace(/\D/g, '');
    if (!capCpf.trim() || cpfDigitsVal.length < 11) {
      erros.cpf = 'CPF obrigatório (11 dígitos)';
    } else if (!validateCPF(cpfDigitsVal)) {
      erros.cpf = 'CPF inválido — verifique os números';
    }
    const exigeEleitoral = tipoParam === 'lideranca' || tipoParam === 'cabo' || tipoParam === 'promotor' || tipoParam === 'fiscal' || tipoParam === 'eleitor';
    if (exigeEleitoral) {
      if (!capTitulo.trim()) erros.titulo = 'Título de eleitor obrigatório';
      if (!capZona.trim()) erros.zona = 'Zona eleitoral obrigatória';
      if (!capSecao.trim()) erros.secao = 'Seção eleitoral obrigatória';
      if (!capMunicipioEl.trim()) erros.municipio = 'Município eleitoral obrigatório';
      if (!capColegio.trim()) erros.colegio = 'Colégio eleitoral obrigatório';
    }
    if (Object.keys(erros).length > 0) { setCapErrors(erros); return; }
    setCapErrors({});
    setCapSaving(true);
    try {
      const url = `${SUPABASE_URL}/functions/v1/captacao-afiliado`;
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          token: tokenCompleto || token,
          tipo: tipoParam || 'afiliado',
          nome: capNome.trim(),
          cpf: capCpf.replace(/\D/g, '') || null,
          telefone: capTelefone.trim(),
          whatsapp: capTelefone.trim(),
          data_nascimento: capData || null,
          instagram: instagramInformado || null,
          rede_social: capRede.trim() || null,
          titulo_eleitor: capTitulo.trim() || null,
          zona_eleitoral: capZona.trim() || null,
          secao_eleitoral: capSecao.trim() || null,
          municipio_eleitoral: capMunicipioEl.trim() || null,
          uf_eleitoral: capUfEl.trim() || null,
          colegio_eleitoral: capColegio.trim() || null,
          apoiadores_estimados: capApoiadores ? Number(capApoiadores) : null,
          bairros_influencia: capBairros.trim() || null,
          compromisso_voto: capCompromisso.trim() || null,
          observacoes: capObs.trim() || null,
        }),
      });
      const j = await r.json();
      if (!r.ok || j?.error) {
        const msg = typeof j?.error === 'string' ? j.error : 'Erro ao enviar cadastro';
        throw new Error(msg);
      }
      setCapSuccess(true);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      setCapSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const erros: Record<string, string> = {};
    if (!nome.trim() || nome.trim().length < 2) erros.nome = 'Nome obrigatório (mín. 2 caracteres)';
    const waDigits = whatsapp.replace(/\D/g, '');
    if (!whatsapp.trim() || waDigits.length < 10) erros.whatsapp = 'WhatsApp com DDD obrigatório (mín. 10 dígitos)';
    if (cpf.trim()) {
      const cpfDigits = cpf.replace(/\D/g, '');
      if (cpfDigits.length === 11 && !validateCPF(cpfDigits)) erros.cpf = 'CPF inválido — verifique os números';
    }
    if (!usuarioLogin.trim() || usuarioLogin.trim().length < 3) erros.usuarioLogin = 'Usuário obrigatório (mín. 3 caracteres)';
    if (!senha.trim() || senha.length < 6) erros.senha = 'Senha obrigatória (mín. 6 caracteres)';
    if (!tituloEleitor.trim()) erros.titulo = 'Título de eleitor obrigatório';
    if (!zonaEleitoral.trim()) erros.zona = 'Zona eleitoral obrigatória';
    if (!secaoEleitoral.trim()) erros.secao = 'Seção eleitoral obrigatória';
    if (!municipioEleitoral.trim()) erros.municipio = 'Município eleitoral obrigatório';
    if (!colegioEleitoral.trim()) erros.colegio = 'Colégio eleitoral obrigatório';
    if (Object.keys(erros).length > 0) { setMainErrors(erros); return; }
    setMainErrors({});

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('cadastro-afiliado-publico', {
        body: {
          token: tokenCompleto || token,
          nome: nome.trim(),
          cpf: cpf.trim() || null,
          telefone: whatsapp.trim(),
          whatsapp: whatsapp.trim(),
          email: email.trim() || null,
          data_nascimento: dataNascimento || null,
          cep: cep.trim() || null,
          cidade_cep: cidadeCep || null,
          instagram: instagram.trim() || null,
          titulo_eleitor: tituloEleitor.trim(),
          zona_eleitoral: zonaEleitoral.trim(),
          secao_eleitoral: secaoEleitoral.trim(),
          municipio_eleitoral: municipioEleitoral.trim(),
          uf_eleitoral: ufEleitoral.trim() || null,
          colegio_eleitoral: colegioEleitoral.trim(),
          usuario_login: usuarioLogin.trim(),
          senha: senha,
        },
      });
      if (error) throw new Error(error.message || 'Erro ao enviar');
      const d: any = data;
      if (d?.error) {
        throw new Error(typeof d.error === 'string' ? d.error : 'Erro ao cadastrar');
      }
      setSuccess({ login: d?.login || usuarioLogin.trim() });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 overflow-y-auto flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-br from-primary/10 to-background">
        <div className="w-full max-w-sm text-center space-y-5 my-auto">
          <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
            <CheckCircle2 size={48} className="text-primary" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">Cadastro concluído!</h1>
            <p className="text-sm text-muted-foreground">Sua conta foi criada com sucesso.</p>
          </div>
          <div className="section-card text-left space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Seu usuário de acesso</p>
            <p className="text-base font-mono font-bold text-foreground">{success.login}</p>
            <p className="text-[11px] text-muted-foreground mt-2">Use a senha que você definiu para entrar no sistema.</p>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="w-full h-12 rounded-xl gradient-primary text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97]"
          >
            <LogIn size={16} /> Acessar o sistema
          </button>
        </div>
      </div>
    );
  }

  const inputCls = 'w-full h-11 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 transition-all';
  const labelCls = 'text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block';

  if (modo === 'detectando') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin text-primary" /> Carregando…
        </div>
      </div>
    );
  }

  if (modo === 'invalido') {
    return (
      <div className="fixed inset-0 flex items-center justify-center px-6 bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="text-center space-y-3 max-w-sm">
          <h1 className="text-xl font-bold text-foreground">Link inválido ou expirado</h1>
          <p className="text-sm text-muted-foreground">Solicite um novo link à pessoa que te enviou.</p>
        </div>
      </div>
    );
  }

  // ─── MODO CAPTAÇÃO: tela de sucesso ───
  if (modo === 'captacao' && capSuccess) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-6 bg-gradient-to-br from-primary/10 to-background">
        <div className="w-full max-w-sm text-center space-y-5 my-auto">
          <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
            <CheckCircle2 size={48} className="text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Cadastro enviado!</h1>
            <p className="text-sm text-muted-foreground">Obrigado por se cadastrar na rede da Dra. Fernanda Sarelli.</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-muted-foreground">
              Redirecionando para o Instagram em <span className="font-bold text-primary">{countdown}</span>s…
            </p>
            <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full gradient-primary rounded-full transition-all duration-1000"
                style={{ width: `${(countdown / 3) * 100}%` }}
              />
            </div>
          </div>
          <a
            href="https://www.instagram.com/drafernandasarelli/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-12 rounded-2xl gradient-primary text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97]"
          >
            <Heart size={16} fill="currentColor" /> Seguir no Instagram agora
          </a>
        </div>
      </div>
    );
  }

  // ─── MODO CAPTAÇÃO: formulário simples para o público preencher ───
  if (modo === 'captacao') {
    return (
      <div className="fixed inset-0 overflow-y-auto bg-gradient-to-br from-primary/10 via-background to-primary/5 px-4 pt-6 pb-32">
        {/* Decorative glow */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-primary/20 blur-3xl opacity-60" />

        <div className="relative w-full max-w-md space-y-5 mx-auto">
          {/* Hero header */}
          <div className="relative overflow-hidden rounded-3xl gradient-primary p-6 text-center shadow-xl">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-12 -left-10 w-44 h-44 rounded-full bg-white/10 blur-2xl" />
            <div className="relative space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wider">
                <Sparkles size={11} /> Mandato Dra. Fernanda Sarelli
              </div>
              {tipoLabel && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-primary text-[10px] font-extrabold uppercase tracking-wider shadow-md">
                  ⭐ {tipoLabel}
                </div>
              )}
              <h1 className="text-2xl font-extrabold text-white leading-tight drop-shadow-sm">
                Faça parte da nossa rede
              </h1>
              <p className="text-[13px] text-white/90 leading-snug">
                Cadastre-se e receba novidades, ações e convocações da Dra. Fernanda Sarelli.
              </p>
            </div>
          </div>

          {/* Indicado por */}
          {afiliadoNome && (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-primary/20 shadow-sm">
              <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center shrink-0">
                <Heart size={18} className="text-white" fill="currentColor" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Você foi indicado por</p>
                <p className="text-sm font-bold text-foreground truncate">{afiliadoNome}</p>
              </div>
              <UserCheck size={18} className="text-primary shrink-0" />
            </div>
          )}

          <form onSubmit={handleSubmitCaptacao} className="space-y-4">
            <div className="section-card space-y-3 shadow-sm">
              <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-border">
                <ClipboardList size={13} className="text-primary" /> Seus dados
              </h2>
              <div>
                <label className={labelCls}>Nome *</label>
                <input type="text" value={capNome} onChange={e => { setCapNome(e.target.value); setCapErrors(p => ({ ...p, nome: '' })); }} className={inputCls + (capErrors.nome ? ' border-destructive' : '')} maxLength={120} />
                {capErrors.nome && <p className="text-[10px] text-destructive mt-1">{capErrors.nome}</p>}
              </div>
              <div>
                <label className={labelCls}>Telefone *</label>
                <div className="relative">
                  <input type="tel" value={capTelefone} onChange={e => { setCapTelefone(e.target.value); setCapErrors(p => ({ ...p, telefone: '' })); }} className={inputCls + ' pr-9' + (capErrors.telefone ? ' border-destructive' : '')} maxLength={40} placeholder="(00) 00000-0000" />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2"><TelefoneStatusIcon status={telStatusCap} /></div>
                </div>
                {capErrors.telefone ? <p className="text-[10px] text-destructive mt-1">{capErrors.telefone}</p> : telefoneHelpText(telStatusCap) && <p className="text-[10px] text-destructive mt-1">{telefoneHelpText(telStatusCap)}</p>}
              </div>
              <div>
                <label className={labelCls}>Data de nascimento *</label>
                <input type="date" value={capData} onChange={e => { setCapData(e.target.value); setCapErrors(p => ({ ...p, data: '' })); }} className={inputCls + (capErrors.data ? ' border-destructive' : '')} />
                {capErrors.data && <p className="text-[10px] text-destructive mt-1">{capErrors.data}</p>}
              </div>
              {tipoParam !== 'fernanda' ? (
                <div>
                  <label className={labelCls}>Instagram *</label>
                  <input type="text" value={capRede} onChange={e => { setCapRede(e.target.value); setCapErrors(p => ({ ...p, instagram: '' })); }} className={inputCls + (capErrors.instagram ? ' border-destructive' : '')} maxLength={200} placeholder="@usuario" />
                  {capErrors.instagram && <p className="text-[10px] text-destructive mt-1">{capErrors.instagram}</p>}
                </div>
              ) : (
                <div>
                  <label className={labelCls}>Instagram *</label>
                  <input type="text" value={capInstagram} onChange={e => { setCapInstagram(e.target.value); setCapErrors(p => ({ ...p, instagram: '' })); }} className={inputCls + (capErrors.instagram ? ' border-destructive' : '')} maxLength={120} placeholder="@usuario" />
                  {capErrors.instagram && <p className="text-[10px] text-destructive mt-1">{capErrors.instagram}</p>}
                </div>
              )}
              {/* CPF — todos os tipos */}
              <div>
                <label className={labelCls}>CPF *</label>
                <input type="text" value={capCpf} onChange={e => { setCapCpf(e.target.value); setCapErrors(p => ({ ...p, cpf: '' })); }} className={inputCls + (capErrors.cpf ? ' border-destructive' : '')} maxLength={14} placeholder="000.000.000-00" />
                {capErrors.cpf && <p className="text-[10px] text-destructive mt-1">{capErrors.cpf}</p>}
              </div>
            </div>

            {/* Bloco eleitoral — somente para liderança / fiscal / eleitor */}
            {(tipoParam === 'lideranca' || tipoParam === 'fiscal' || tipoParam === 'eleitor') && (
              <div className="section-card space-y-3 shadow-sm">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-border">
                  🗳️ Dados eleitorais
                </h2>
                <div>
                  <label className={labelCls}>Título de eleitor *</label>
                  <input type="text" value={capTitulo} onChange={e => { setCapTitulo(e.target.value); setCapErrors(p => ({ ...p, titulo: '' })); }} className={inputCls + (capErrors.titulo ? ' border-destructive' : '')} maxLength={40} placeholder="Número do título" />
                  {capErrors.titulo && <p className="text-[10px] text-destructive mt-1">{capErrors.titulo}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Zona *</label>
                    <input type="text" value={capZona} onChange={e => { setCapZona(e.target.value); setCapErrors(p => ({ ...p, zona: '' })); }} className={inputCls + (capErrors.zona ? ' border-destructive' : '')} maxLength={20} placeholder="045" />
                    {capErrors.zona && <p className="text-[10px] text-destructive mt-1">{capErrors.zona}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Seção *</label>
                    <input type="text" value={capSecao} onChange={e => { setCapSecao(e.target.value); setCapErrors(p => ({ ...p, secao: '' })); }} className={inputCls + (capErrors.secao ? ' border-destructive' : '')} maxLength={20} placeholder="0123" />
                    {capErrors.secao && <p className="text-[10px] text-destructive mt-1">{capErrors.secao}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className={labelCls}>Município *</label>
                    <input type="text" value={capMunicipioEl} onChange={e => { setCapMunicipioEl(e.target.value); setCapErrors(p => ({ ...p, municipio: '' })); }} className={inputCls + (capErrors.municipio ? ' border-destructive' : '')} maxLength={120} placeholder="Cidade" />
                    {capErrors.municipio && <p className="text-[10px] text-destructive mt-1">{capErrors.municipio}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>UF</label>
                    <input type="text" value={capUfEl} onChange={e => setCapUfEl(e.target.value.toUpperCase())} className={inputCls} maxLength={2} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Colégio eleitoral *</label>
                  <input type="text" value={capColegio} onChange={e => { setCapColegio(e.target.value); setCapErrors(p => ({ ...p, colegio: '' })); }} className={inputCls + (capErrors.colegio ? ' border-destructive' : '')} maxLength={200} placeholder="Nome da escola / local" />
                  {capErrors.colegio && <p className="text-[10px] text-destructive mt-1">{capErrors.colegio}</p>}
                </div>
              </div>
            )}

            {/* Específicos por tipo */}
            {(tipoParam === 'lideranca' || tipoParam === 'cabo' || tipoParam === 'promotor') && (
              <div className="section-card space-y-3 shadow-sm">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-border">
                  👑 Liderança
                </h2>
                <div>
                  <label className={labelCls}>Apoiadores estimados</label>
                  <input type="number" min={0} value={capApoiadores} onChange={e => setCapApoiadores(e.target.value)} className={inputCls} placeholder="Ex: 50" />
                </div>
                <div>
                  <label className={labelCls}>Bairros / regiões de influência</label>
                  <input type="text" value={capBairros} onChange={e => setCapBairros(e.target.value)} className={inputCls} maxLength={300} placeholder="Bairros onde atua" />
                </div>
              </div>
            )}

            {tipoParam === 'eleitor' && (
              <div className="section-card space-y-3 shadow-sm">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-border">
                  🗳️ Compromisso
                </h2>
                <div>
                  <label className={labelCls}>Compromisso de voto</label>
                  <select value={capCompromisso} onChange={e => setCapCompromisso(e.target.value)} className={inputCls}>
                    <option value="">Selecione</option>
                    <option value="Confirmado">Confirmado</option>
                    <option value="Provável">Provável</option>
                    <option value="Indeciso">Indeciso</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Observações</label>
                  <textarea value={capObs} onChange={e => setCapObs(e.target.value)} className={inputCls + ' h-20 py-2'} maxLength={500} placeholder="Opcional" />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={capSaving}
              className="w-full h-12 rounded-2xl gradient-primary text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97] disabled:opacity-50 shadow-lg shadow-primary/30"
            >
              {capSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {capSaving ? 'Enviando...' : 'Quero fazer parte'}
            </button>
          </form>

          <div className="text-center space-y-1 pb-4">
            <p className="text-[10px] text-muted-foreground">
              🔒 Seus dados são tratados com sigilo e segurança.
            </p>
            <p className="text-[10px] text-muted-foreground/80">
              Após o envio você será direcionado ao Instagram da deputada.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── MODO CRIAR ACESSO: afiliado define seu próprio login ───
  return (
    <div className="fixed inset-0 overflow-y-auto bg-gradient-to-br from-primary/5 via-background to-background px-4 pt-8 pb-32">
      <div className="w-full max-w-md space-y-5 mx-auto">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <ClipboardList size={26} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Cadastro de Afiliado</h1>
          <p className="text-xs text-muted-foreground">Preencha seus dados e crie seu acesso</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dados pessoais */}
          <div className="section-card space-y-3">
            <h2 className="section-title">👤 Dados pessoais</h2>
            <div>
              <label className={labelCls}>Nome completo *</label>
              <input type="text" value={nome} onChange={e => { setNome(e.target.value); setMainErrors(p => ({ ...p, nome: '' })); }} className={inputCls + (mainErrors.nome ? ' border-destructive' : '')} maxLength={120} />
              {mainErrors.nome && <p className="text-[10px] text-destructive mt-1">{mainErrors.nome}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>CPF</label>
                <input type="text" value={cpf} onChange={e => { setCpf(e.target.value); setMainErrors(p => ({ ...p, cpf: '' })); }} className={inputCls + (mainErrors.cpf ? ' border-destructive' : '')} maxLength={14} placeholder="000.000.000-00" />
                {mainErrors.cpf && <p className="text-[10px] text-destructive mt-1">{mainErrors.cpf}</p>}
              </div>
              <div>
                <label className={labelCls}>Data nasc.</label>
                <input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>WhatsApp *</label>
              <div className="relative">
                <input type="tel" value={whatsapp} onChange={e => { setWhatsapp(e.target.value); setMainErrors(p => ({ ...p, whatsapp: '' })); }} className={inputCls + ' pr-9' + (mainErrors.whatsapp ? ' border-destructive' : '')} maxLength={40} placeholder="(00) 00000-0000" />
                <div className="absolute right-2 top-1/2 -translate-y-1/2"><TelefoneStatusIcon status={telStatusSarelli} /></div>
              </div>
              {mainErrors.whatsapp ? <p className="text-[10px] text-destructive mt-1">{mainErrors.whatsapp}</p> : telefoneHelpText(telStatusSarelli) && <p className="text-[10px] text-destructive mt-1">{telefoneHelpText(telStatusSarelli)}</p>}
              <p className="text-[10px] text-muted-foreground mt-1">Usado também como telefone de contato.</p>
            </div>
            <div>
              <label className={labelCls}>E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} maxLength={200} placeholder="seu@email.com" />
            </div>
            <div>
              <label className={labelCls}>CEP</label>
              <div className="relative">
                <input
                  type="text"
                  value={cep}
                  onChange={e => { setCep(e.target.value); }}
                  onBlur={e => buscarCidadePorCep(e.target.value)}
                  className={inputCls}
                  maxLength={20}
                  placeholder="00000-000"
                />
                {buscandoCep && (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
              {cidadeCep && (
                <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
                  <MapPin size={11} /> {cidadeCep}{ufCep ? ` - ${ufCep}` : ''}
                </span>
              )}
            </div>
            <div>
              <label className={labelCls}>Instagram</label>
              <input type="text" value={instagram} onChange={e => setInstagram(e.target.value)} className={inputCls} maxLength={120} placeholder="@usuario" />
            </div>
          </div>

          {/* Dados eleitorais */}
          <div className="section-card space-y-3">
            <h2 className="section-title">🗳️ Dados eleitorais</h2>
            <div>
              <label className={labelCls}>Título de eleitor *</label>
              <input type="text" value={tituloEleitor} onChange={e => { setTituloEleitor(e.target.value); setMainErrors(p => ({ ...p, titulo: '' })); }} className={inputCls + (mainErrors.titulo ? ' border-destructive' : '')} maxLength={40} placeholder="Número do título" />
              {mainErrors.titulo && <p className="text-[10px] text-destructive mt-1">{mainErrors.titulo}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Zona *</label>
                <input type="text" value={zonaEleitoral} onChange={e => { setZonaEleitoral(e.target.value); setMainErrors(p => ({ ...p, zona: '' })); }} className={inputCls + (mainErrors.zona ? ' border-destructive' : '')} maxLength={20} placeholder="045" />
                {mainErrors.zona && <p className="text-[10px] text-destructive mt-1">{mainErrors.zona}</p>}
              </div>
              <div>
                <label className={labelCls}>Seção *</label>
                <input type="text" value={secaoEleitoral} onChange={e => { setSecaoEleitoral(e.target.value); setMainErrors(p => ({ ...p, secao: '' })); }} className={inputCls + (mainErrors.secao ? ' border-destructive' : '')} maxLength={20} placeholder="0123" />
                {mainErrors.secao && <p className="text-[10px] text-destructive mt-1">{mainErrors.secao}</p>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className={labelCls}>Município *</label>
                <input type="text" value={municipioEleitoral} onChange={e => { setMunicipioEleitoral(e.target.value); setMainErrors(p => ({ ...p, municipio: '' })); }} className={inputCls + (mainErrors.municipio ? ' border-destructive' : '')} maxLength={120} placeholder="Cidade" />
                {mainErrors.municipio && <p className="text-[10px] text-destructive mt-1">{mainErrors.municipio}</p>}
              </div>
              <div>
                <label className={labelCls}>UF</label>
                <input type="text" value={ufEleitoral} onChange={e => setUfEleitoral(e.target.value.toUpperCase())} className={inputCls} maxLength={2} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Colégio eleitoral *</label>
              <input type="text" value={colegioEleitoral} onChange={e => { setColegioEleitoral(e.target.value); setMainErrors(p => ({ ...p, colegio: '' })); }} className={inputCls + (mainErrors.colegio ? ' border-destructive' : '')} maxLength={200} placeholder="Nome da escola / local" />
              {mainErrors.colegio && <p className="text-[10px] text-destructive mt-1">{mainErrors.colegio}</p>}
            </div>
          </div>

          {/* Login */}
          <div className="section-card space-y-3">
            <h2 className="section-title">🔑 Crie seu acesso</h2>
            <div>
              <label className={labelCls}>Nome de usuário *</label>
              <input
                type="text"
                value={usuarioLogin}
                onChange={e => { setUsuarioLogin(e.target.value.toLowerCase().replace(/[^a-z0-9.]/g, '')); setMainErrors(p => ({ ...p, usuarioLogin: '' })); }}
                className={inputCls + (mainErrors.usuarioLogin ? ' border-destructive' : '')}
                maxLength={60}
                placeholder="ex: maria.silva"
              />
              {mainErrors.usuarioLogin ? <p className="text-[10px] text-destructive mt-1">{mainErrors.usuarioLogin}</p> : <p className="text-[10px] text-muted-foreground mt-1">Apenas letras minúsculas, números e ponto.</p>}
            </div>
            <div>
              <label className={labelCls}>Senha *</label>
              <div className="relative">
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={e => { setSenha(e.target.value); setMainErrors(p => ({ ...p, senha: '' })); }}
                  className={inputCls + (mainErrors.senha ? ' border-destructive' : '')}
                  maxLength={72}
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {mainErrors.senha && <p className="text-[10px] text-destructive mt-1">{mainErrors.senha}</p>}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full h-12 rounded-xl gradient-primary text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97] disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            {saving ? 'Criando seu acesso...' : 'Concluir cadastro'}
          </button>
        </form>

        <p className="text-center text-[10px] text-muted-foreground pb-4">
          Seus dados são tratados com sigilo.
        </p>
      </div>
    </div>
  );
}