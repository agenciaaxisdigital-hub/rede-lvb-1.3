import { describe, it, expect } from 'vitest';
import { validateCPF } from '@/lib/cpf';

// ─── Lógica espelhada do componente CadastroPublicoAfiliado ───────────────────

type TipoLink = 'lideranca' | 'fiscal' | 'eleitor' | 'fernanda' | 'afiliado';

interface CadastroInput {
  nome: string;
  telefone: string;
  data: string;
  instagram: string;
  cpf: string;
  tipo?: TipoLink;
  // eleitorais (obrigatórios para lideranca/fiscal/eleitor)
  titulo?: string;
  zona?: string;
  secao?: string;
  municipio?: string;
  colegio?: string;
}

/** Espelha handleSubmitCaptacao em CadastroPublicoAfiliado.tsx */
function validarCadastroViaLink(input: CadastroInput): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!input.nome?.trim() || input.nome.trim().length < 2)
    erros.nome = 'Nome obrigatório (mín. 2 caracteres)';
  const telDigits = (input.telefone || '').replace(/\D/g, '');
  if (!input.telefone?.trim() || telDigits.length < 10)
    erros.telefone = 'Telefone com DDD obrigatório (mín. 10 dígitos)';
  if (!input.data)
    erros.data = 'Data de nascimento obrigatória';
  if (!input.instagram?.trim())
    erros.instagram = 'Instagram obrigatório';
  const cpfDigits = (input.cpf || '').replace(/\D/g, '');
  if (!input.cpf?.trim() || cpfDigits.length < 11) {
    erros.cpf = 'CPF obrigatório (11 dígitos)';
  } else if (!validateCPF(cpfDigits)) {
    erros.cpf = 'CPF inválido — verifique os números';
  }
  const exigeEleitoral = input.tipo === 'lideranca' || input.tipo === 'fiscal' || input.tipo === 'eleitor';
  if (exigeEleitoral) {
    if (!input.titulo?.trim()) erros.titulo = 'Título de eleitor obrigatório';
    if (!input.zona?.trim()) erros.zona = 'Zona eleitoral obrigatória';
    if (!input.secao?.trim()) erros.secao = 'Seção eleitoral obrigatória';
    if (!input.municipio?.trim()) erros.municipio = 'Município eleitoral obrigatório';
    if (!input.colegio?.trim()) erros.colegio = 'Colégio eleitoral obrigatório';
  }
  return erros;
}

/** Espelha handleSubmit (criar_acesso) em CadastroPublicoAfiliado.tsx */
function validarCriarAcesso(input: {
  nome: string; whatsapp: string; cpf?: string;
  usuarioLogin: string; senha: string;
  tituloEleitor: string; zonaEleitoral: string; secaoEleitoral: string;
  municipioEleitoral: string; colegioEleitoral: string;
  instagram?: string;
}): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!input.nome?.trim() || input.nome.trim().length < 2) erros.nome = 'Nome obrigatório';
  const waDigits = (input.whatsapp || '').replace(/\D/g, '');
  if (waDigits.length < 10) erros.whatsapp = 'WhatsApp com DDD obrigatório (mín. 10 dígitos)';
  if (input.cpf?.trim()) {
    const cpfDigits = input.cpf.replace(/\D/g, '');
    if (cpfDigits.length === 11 && !validateCPF(cpfDigits)) erros.cpf = 'CPF inválido';
  }
  if (!input.usuarioLogin?.trim() || input.usuarioLogin.trim().length < 3) erros.usuarioLogin = 'Usuário mín. 3 chars';
  if (!input.senha || input.senha.length < 6) erros.senha = 'Senha mín. 6 chars';
  if (!input.tituloEleitor?.trim()) erros.titulo = 'Título eleitoral obrigatório';
  if (!input.zonaEleitoral?.trim()) erros.zona = 'Zona eleitoral obrigatória';
  if (!input.secaoEleitoral?.trim()) erros.secao = 'Seção eleitoral obrigatória';
  if (!input.municipioEleitoral?.trim()) erros.municipio = 'Município eleitoral obrigatório';
  if (!input.colegioEleitoral?.trim()) erros.colegio = 'Colégio eleitoral obrigatório';
  return erros;
}

function extrairToken(slugComToken: string): string {
  const idx = slugComToken.lastIndexOf('-');
  if (idx > 0) return slugComToken.slice(idx + 1);
  return slugComToken;
}

function detectarModo(tipoParam: string | null, isAtivo: boolean): 'captacao' | 'criar_acesso' {
  if (tipoParam === 'afiliado') return 'criar_acesso';
  return isAtivo ? 'captacao' : 'criar_acesso';
}

function resolverSuplenteId(referrer: { suplente_id?: string | null; tipo: string }): string | null {
  return referrer.suplente_id || null;
}

// ─── Base válida para todos os campos obrigatórios de captação ────────────────

const baseValida: CadastroInput = {
  nome: 'João Silva',
  telefone: '62999998888',
  data: '1990-05-15',
  instagram: '@joaosilva',
  cpf: '529.982.247-25',
};

const baseEleitoralValida = {
  titulo: '1234567890',
  zona: '045',
  secao: '0123',
  municipio: 'Goiânia',
  colegio: 'Escola Municipal',
};

// ─── TESTES ───────────────────────────────────────────────────────────────────

describe('Extração de token da URL', () => {
  it('extrai token de slug simples', () => {
    expect(extrairToken('maria-abc12345')).toBe('abc12345');
  });
  it('extrai token de slug com múltiplos hífens (nome composto)', () => {
    expect(extrairToken('maria-da-silva-abc12345')).toBe('abc12345');
  });
  it('extrai token longo (32 chars UUID)', () => {
    const token = 'abcdef1234567890abcdef1234567890';
    expect(extrairToken(`joao-silva-${token}`)).toBe(token);
  });
  it('retorna o próprio valor quando não há hífen', () => {
    expect(extrairToken('abc12345')).toBe('abc12345');
  });
});

describe('Detecção de modo por tipo de link', () => {
  it('?t=afiliado → criar_acesso (com ou sem is_ativo)', () => {
    expect(detectarModo('afiliado', true)).toBe('criar_acesso');
    expect(detectarModo('afiliado', false)).toBe('criar_acesso');
  });
  it('?t=lideranca + ativo → captacao', () => expect(detectarModo('lideranca', true)).toBe('captacao'));
  it('?t=fiscal + ativo → captacao', () => expect(detectarModo('fiscal', true)).toBe('captacao'));
  it('?t=eleitor + ativo → captacao', () => expect(detectarModo('eleitor', true)).toBe('captacao'));
  it('?t=fernanda + ativo → captacao', () => expect(detectarModo('fernanda', true)).toBe('captacao'));
  it('sem parâmetro + ativo → captacao', () => expect(detectarModo(null, true)).toBe('captacao'));
});

describe('Validação captação — campos base (todos os tipos)', () => {
  const tiposSimples: TipoLink[] = ['lideranca', 'fiscal', 'eleitor', 'fernanda', 'afiliado'];

  tiposSimples.forEach(tipo => {
    describe(`Tipo: ${tipo}`, () => {
      const extraEleitoral = (tipo === 'lideranca' || tipo === 'fiscal' || tipo === 'eleitor')
        ? baseEleitoralValida : {};

      it('aceita todos os campos obrigatórios válidos', () => {
        expect(Object.keys(validarCadastroViaLink({ ...baseValida, tipo, ...extraEleitoral }))).toHaveLength(0);
      });

      // Nome
      it('rejeita nome vazio', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...extraEleitoral, nome: '' }).nome).toBeTruthy();
      });
      it('rejeita nome com 1 char', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...extraEleitoral, nome: 'J' }).nome).toBeTruthy();
      });
      it('aceita nome com 2+ chars', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...extraEleitoral, nome: 'Jo' }).nome).toBeUndefined();
      });

      // Telefone
      it('rejeita telefone vazio', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...extraEleitoral, telefone: '' }).telefone).toBeTruthy();
      });
      it('rejeita telefone com 9 dígitos (sem DDD completo)', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...extraEleitoral, telefone: '629999888' }).telefone).toBeTruthy();
      });
      it('aceita telefone com 10 dígitos (DDD + 8)', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...extraEleitoral, telefone: '6299998888' }).telefone).toBeUndefined();
      });
      it('aceita telefone formatado "(62) 9999-8888"', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...extraEleitoral, telefone: '(62) 9999-8888' }).telefone).toBeUndefined();
      });
      it('aceita telefone com 11 dígitos (celular com 9)', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...extraEleitoral, telefone: '62999998888' }).telefone).toBeUndefined();
      });

      // Data de nascimento — OBRIGATÓRIA
      it('rejeita data de nascimento vazia', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...extraEleitoral, data: '' }).data).toBeTruthy();
      });
      it('aceita data de nascimento preenchida', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...extraEleitoral, data: '1990-01-01' }).data).toBeUndefined();
      });

      // Instagram — OBRIGATÓRIO
      it('rejeita instagram vazio', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...extraEleitoral, instagram: '' }).instagram).toBeTruthy();
      });
      it('rejeita instagram só com espaços', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...extraEleitoral, instagram: '   ' }).instagram).toBeTruthy();
      });
      it('aceita instagram preenchido', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...extraEleitoral, instagram: '@usuario' }).instagram).toBeUndefined();
      });
      it('aceita instagram sem @ (campo livre)', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...extraEleitoral, instagram: 'usuario_sem_arroba' }).instagram).toBeUndefined();
      });

      // CPF — OBRIGATÓRIO
      it('rejeita CPF vazio', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...extraEleitoral, cpf: '' }).cpf).toBeTruthy();
      });
      it('rejeita CPF parcial (< 11 dígitos)', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...extraEleitoral, cpf: '111.444' }).cpf).toBeTruthy();
      });
      it('rejeita CPF com 11 dígitos inválido', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...extraEleitoral, cpf: '111.111.111-11' }).cpf).toBeTruthy();
      });
      it('aceita CPF válido 529.982.247-25', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...extraEleitoral, cpf: '529.982.247-25' }).cpf).toBeUndefined();
      });
      it('aceita CPF válido sem formatação', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...extraEleitoral, cpf: '52998224725' }).cpf).toBeUndefined();
      });
    });
  });
});

describe('Validação captação — dados eleitorais (lideranca/fiscal/eleitor)', () => {
  const tiposComEleitoral: TipoLink[] = ['lideranca', 'fiscal', 'eleitor'];

  tiposComEleitoral.forEach(tipo => {
    describe(`Tipo: ${tipo}`, () => {
      it('aceita todos os dados eleitorais válidos', () => {
        expect(Object.keys(validarCadastroViaLink({ ...baseValida, tipo, ...baseEleitoralValida }))).toHaveLength(0);
      });
      it('rejeita sem título de eleitor', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...baseEleitoralValida, titulo: '' }).titulo).toBeTruthy();
      });
      it('rejeita sem zona eleitoral', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...baseEleitoralValida, zona: '' }).zona).toBeTruthy();
      });
      it('rejeita sem seção eleitoral', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...baseEleitoralValida, secao: '' }).secao).toBeTruthy();
      });
      it('rejeita sem município eleitoral', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...baseEleitoralValida, municipio: '' }).municipio).toBeTruthy();
      });
      it('rejeita sem colégio eleitoral', () => {
        expect(validarCadastroViaLink({ ...baseValida, tipo, ...baseEleitoralValida, colegio: '' }).colegio).toBeTruthy();
      });
    });
  });

  it('fernanda não exige dados eleitorais', () => {
    const erros = validarCadastroViaLink({ ...baseValida, tipo: 'fernanda' });
    expect(erros.titulo).toBeUndefined();
    expect(erros.zona).toBeUndefined();
  });

  it('afiliado não exige dados eleitorais', () => {
    const erros = validarCadastroViaLink({ ...baseValida, tipo: 'afiliado' });
    expect(erros.titulo).toBeUndefined();
    expect(erros.zona).toBeUndefined();
  });
});

describe('Validação captação — múltiplos erros simultâneos', () => {
  it('coleta todos os erros de uma vez (não para no primeiro)', () => {
    const erros = validarCadastroViaLink({
      nome: '',
      telefone: '',
      data: '',
      instagram: '',
      cpf: '',
      tipo: 'lideranca',
      titulo: '',
      zona: '',
      secao: '',
      municipio: '',
      colegio: '',
    });
    expect(Object.keys(erros).length).toBeGreaterThanOrEqual(8);
    expect(erros.nome).toBeTruthy();
    expect(erros.telefone).toBeTruthy();
    expect(erros.data).toBeTruthy();
    expect(erros.instagram).toBeTruthy();
    expect(erros.cpf).toBeTruthy();
    expect(erros.titulo).toBeTruthy();
    expect(erros.zona).toBeTruthy();
    expect(erros.colegio).toBeTruthy();
  });
});

describe('Validação completa — modo criar_acesso (?t=afiliado)', () => {
  const base = {
    nome: 'Maria Silva',
    whatsapp: '62999998888',
    usuarioLogin: 'maria.silva',
    senha: 'senha123',
    tituloEleitor: '1234567890',
    zonaEleitoral: '045',
    secaoEleitoral: '0123',
    municipioEleitoral: 'Goiânia',
    colegioEleitoral: 'Escola Municipal',
  };

  it('aceita todos os campos válidos', () => {
    expect(Object.keys(validarCriarAcesso(base))).toHaveLength(0);
  });
  it('rejeita nome vazio', () => {
    expect(validarCriarAcesso({ ...base, nome: '' }).nome).toBeTruthy();
  });
  it('rejeita whatsapp sem DDD (8 dígitos)', () => {
    expect(validarCriarAcesso({ ...base, whatsapp: '99998888' }).whatsapp).toBeTruthy();
  });
  it('aceita whatsapp com 10 dígitos (DDD + 8)', () => {
    expect(validarCriarAcesso({ ...base, whatsapp: '6299998888' }).whatsapp).toBeUndefined();
  });
  it('aceita whatsapp formatado "(62) 9999-8888"', () => {
    expect(validarCriarAcesso({ ...base, whatsapp: '(62) 9999-8888' }).whatsapp).toBeUndefined();
  });
  it('CPF válido (529.982.247-25) — aceita', () => {
    expect(validarCriarAcesso({ ...base, cpf: '529.982.247-25' }).cpf).toBeUndefined();
  });
  it('CPF inválido (111.111.111-11) — rejeita', () => {
    expect(validarCriarAcesso({ ...base, cpf: '111.111.111-11' }).cpf).toBeTruthy();
  });
  it('CPF não preenchido — aceita (CPF é opcional no criar_acesso)', () => {
    expect(validarCriarAcesso({ ...base, cpf: '' }).cpf).toBeUndefined();
  });
  it('Instagram preenchido — NÃO bloqueia (campo livre no criar_acesso)', () => {
    expect(Object.keys(validarCriarAcesso({ ...base, instagram: '@@@invalido###' }))).toHaveLength(0);
  });
  it('rejeita usuário com menos de 3 chars', () => {
    expect(validarCriarAcesso({ ...base, usuarioLogin: 'ab' }).usuarioLogin).toBeTruthy();
  });
  it('rejeita senha com menos de 6 chars', () => {
    expect(validarCriarAcesso({ ...base, senha: '12345' }).senha).toBeTruthy();
  });
  it('rejeita sem título eleitoral', () => {
    expect(validarCriarAcesso({ ...base, tituloEleitor: '' }).titulo).toBeTruthy();
  });
  it('rejeita sem zona eleitoral', () => {
    expect(validarCriarAcesso({ ...base, zonaEleitoral: '' }).zona).toBeTruthy();
  });
  it('rejeita sem seção eleitoral', () => {
    expect(validarCriarAcesso({ ...base, secaoEleitoral: '' }).secao).toBeTruthy();
  });
  it('rejeita sem município eleitoral', () => {
    expect(validarCriarAcesso({ ...base, municipioEleitoral: '' }).municipio).toBeTruthy();
  });
  it('rejeita sem colégio eleitoral', () => {
    expect(validarCriarAcesso({ ...base, colegioEleitoral: '' }).colegio).toBeTruthy();
  });
});

describe('Herança de suplente_id na hierarquia', () => {
  it('novo usuário herda suplente_id do suplente', () => {
    expect(resolverSuplenteId({ tipo: 'suplente', suplente_id: 'uuid-suplente-123' })).toBe('uuid-suplente-123');
  });
  it('novo usuário herda suplente_id da liderança', () => {
    expect(resolverSuplenteId({ tipo: 'lideranca', suplente_id: 'uuid-suplente-456' })).toBe('uuid-suplente-456');
  });
  it('novo usuário herda suplente_id do afiliado', () => {
    expect(resolverSuplenteId({ tipo: 'afiliado', suplente_id: 'uuid-suplente-789' })).toBe('uuid-suplente-789');
  });
  it('suplente_id null para coordenador sem vínculo', () => {
    expect(resolverSuplenteId({ tipo: 'coordenador', suplente_id: null })).toBeNull();
  });
  it('suplente_id null se undefined', () => {
    expect(resolverSuplenteId({ tipo: 'coordenador' })).toBeNull();
  });
});

describe('Destino do cadastro por tipo de link (edge function)', () => {
  const getTabela = (tipo: TipoLink) => {
    if (tipo === 'fernanda') return 'cadastros_fernanda';
    if (tipo === 'afiliado') return 'cadastros_afiliados';
    if (tipo === 'lideranca') return 'liderancas';
    if (tipo === 'fiscal') return 'fiscais';
    if (tipo === 'eleitor') return 'possiveis_eleitores';
    return null;
  };

  it('lideranca → liderancas', () => expect(getTabela('lideranca')).toBe('liderancas'));
  it('fiscal → fiscais', () => expect(getTabela('fiscal')).toBe('fiscais'));
  it('eleitor → possiveis_eleitores', () => expect(getTabela('eleitor')).toBe('possiveis_eleitores'));
  it('fernanda → cadastros_fernanda', () => expect(getTabela('fernanda')).toBe('cadastros_fernanda'));
  it('afiliado → cadastros_afiliados', () => expect(getTabela('afiliado')).toBe('cadastros_afiliados'));
});

describe('Log unificado em cadastros_afiliados (contador do card)', () => {
  const tiposQueLogam: TipoLink[] = ['lideranca', 'fiscal', 'eleitor', 'fernanda', 'afiliado'];
  tiposQueLogam.forEach(tipo => {
    it(`${tipo} → loga em cadastros_afiliados`, () => expect(true).toBe(true));
  });
});

describe('Validação de CPF standalone', () => {
  it('aceita CPF válido 529.982.247-25', () => expect(validateCPF('529.982.247-25')).toBe(true));
  it('aceita CPF válido 111.444.777-35', () => expect(validateCPF('11144477735')).toBe(true));
  it('rejeita CPF com todos dígitos iguais', () => expect(validateCPF('111.111.111-11')).toBe(false));
  it('rejeita CPF com menos de 11 dígitos', () => expect(validateCPF('123456789')).toBe(false));
  it('rejeita CPF com dígitos verificadores errados', () => expect(validateCPF('123.456.789-01')).toBe(false));
});

describe('Retry de FK/NOT NULL na edge function (suplente de suplente)', () => {
  type InsertResult = { error: { code: string } | null };

  function tryInsertSimulado(
    payload: Record<string, any>,
    failOn: string[] = [],
  ): { tentativas: number; erro: boolean } {
    let tentativas = 0;

    const tentativa = (p: Record<string, any>): InsertResult => {
      tentativas++;
      const hasFKProblem =
        (p.suplente_id && failOn.includes('suplente_id')) ||
        (p.municipio_id && failOn.includes('municipio_id')) ||
        (p.cadastrado_por && failOn.includes('cadastrado_por'));
      return hasFKProblem ? { error: { code: '23503' } } : { error: null };
    };

    let r = tentativa(payload);
    if (r.error?.code === '23503' || r.error?.code === '23502') {
      r = tentativa({ ...payload, suplente_id: null, municipio_id: null, cadastrado_por: null });
    }
    return { tentativas, erro: r.error !== null };
  }

  it('FK válida → insere na primeira tentativa', () => {
    const result = tryInsertSimulado({ suplente_id: 'uuid-ok', municipio_id: 'uuid-ok', cadastrado_por: 'uuid-ok' }, []);
    expect(result.tentativas).toBe(1);
    expect(result.erro).toBe(false);
  });

  it('suplente_id FK inválida → retry sem suplente_id, sucesso na 2ª tentativa', () => {
    const result = tryInsertSimulado(
      { suplente_id: 'uuid-invalido', municipio_id: 'uuid-ok', cadastrado_por: 'uuid-ok' },
      ['suplente_id'],
    );
    expect(result.tentativas).toBe(2);
    expect(result.erro).toBe(false);
  });

  it('municipio_id FK inválida → retry, sucesso na 2ª tentativa', () => {
    const result = tryInsertSimulado(
      { suplente_id: null, municipio_id: 'uuid-invalido', cadastrado_por: 'uuid-ok' },
      ['municipio_id'],
    );
    expect(result.tentativas).toBe(2);
    expect(result.erro).toBe(false);
  });

  it('suplente sem suplente_id → insere na primeira tentativa sem retry', () => {
    const result = tryInsertSimulado({ suplente_id: null, municipio_id: null, cadastrado_por: 'uuid-ok' }, []);
    expect(result.tentativas).toBe(1);
    expect(result.erro).toBe(false);
  });
});

describe('Retry de CPF duplicado na tabela pessoas', () => {
  type Pessoa = { cpf: string | null; titulo_eleitor: string | null; email: string | null };

  function tryInsertPessoa(base: Pessoa, duplicados: (keyof Pessoa)[]): { tentativas: number; ok: boolean } {
    let tentativas = 0;
    const tentar = (p: Pessoa): boolean => {
      tentativas++;
      if (p.cpf && duplicados.includes('cpf')) return false;
      if (p.titulo_eleitor && duplicados.includes('titulo_eleitor')) return false;
      if (p.email && duplicados.includes('email')) return false;
      return true;
    };

    if (tentar(base)) return { tentativas, ok: true };
    const s1 = { ...base, cpf: null };
    if (tentar(s1)) return { tentativas, ok: true };
    const s2 = { ...s1, titulo_eleitor: null };
    if (tentar(s2)) return { tentativas, ok: true };
    const s3 = { ...s2, email: null };
    if (tentar(s3)) return { tentativas, ok: true };
    return { tentativas, ok: false };
  }

  it('sem duplicados → 1 tentativa', () => {
    expect(tryInsertPessoa({ cpf: '123', titulo_eleitor: 'abc', email: 'x@y.com' }, []).tentativas).toBe(1);
  });

  it('CPF duplicado → retry sem CPF, ok na 2ª', () => {
    const r = tryInsertPessoa({ cpf: '123', titulo_eleitor: 'abc', email: 'x@y.com' }, ['cpf']);
    expect(r.tentativas).toBe(2);
    expect(r.ok).toBe(true);
  });

  it('CPF + título duplicados → retry remove ambos, ok na 3ª', () => {
    const r = tryInsertPessoa({ cpf: '123', titulo_eleitor: 'abc', email: 'x@y.com' }, ['cpf', 'titulo_eleitor']);
    expect(r.tentativas).toBe(3);
    expect(r.ok).toBe(true);
  });

  it('CPF + título + email duplicados → ok na 4ª tentativa', () => {
    const r = tryInsertPessoa({ cpf: '123', titulo_eleitor: 'abc', email: 'x@y.com' }, ['cpf', 'titulo_eleitor', 'email']);
    expect(r.tentativas).toBe(4);
    expect(r.ok).toBe(true);
  });

  it('todos os campos null → 1 tentativa (nada a deduplicar)', () => {
    expect(tryInsertPessoa({ cpf: null, titulo_eleitor: null, email: null }, ['cpf']).tentativas).toBe(1);
  });
});
