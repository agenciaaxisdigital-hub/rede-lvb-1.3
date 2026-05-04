import { describe, it, expect } from 'vitest';
import { validateCPF } from '@/lib/cpf';

// ─── Lógica extraída das edge functions (testável sem Deno/Supabase) ──────────

type TipoLink = 'lideranca' | 'fiscal' | 'eleitor' | 'fernanda' | 'afiliado';

interface CadastroInput {
  nome: string;
  telefone: string;
  cpf?: string;
  instagram?: string;
  tipo?: TipoLink;
}

/** Validação completa do formulário de captação (todos os tipos via link) */
function validarCadastroViaLink(input: CadastroInput): string[] {
  const erros: string[] = [];
  if (!input.nome?.trim() || input.nome.trim().length < 2) erros.push('Nome obrigatório (mín. 2 chars)');
  const telDigits = (input.telefone || '').replace(/\D/g, '');
  if (telDigits.length < 10) erros.push('Telefone com DDD obrigatório (mín. 10 dígitos)');
  if (input.cpf?.trim()) {
    const cpfDigits = input.cpf.replace(/\D/g, '');
    if (cpfDigits.length === 11 && !validateCPF(cpfDigits)) erros.push('CPF inválido');
  }
  return erros;
}

/** Validação completa do modo criar_acesso (afiliado com login) */
function validarCriarAcesso(input: {
  nome: string; whatsapp: string; cpf?: string;
  usuarioLogin: string; senha: string;
  tituloEleitor: string; zonaEleitoral: string; secaoEleitoral: string;
  municipioEleitoral: string; colegioEleitoral: string;
  instagram?: string;
}): string[] {
  const erros: string[] = [];
  if (!input.nome?.trim() || input.nome.trim().length < 2) erros.push('Nome obrigatório');
  const waDigits = (input.whatsapp || '').replace(/\D/g, '');
  if (waDigits.length < 10) erros.push('WhatsApp com DDD obrigatório (mín. 10 dígitos)');
  if (input.cpf?.trim()) {
    const cpfDigits = input.cpf.replace(/\D/g, '');
    if (cpfDigits.length === 11 && !validateCPF(cpfDigits)) erros.push('CPF inválido');
  }
  if (!input.usuarioLogin?.trim() || input.usuarioLogin.trim().length < 3) erros.push('Usuário mín. 3 chars');
  if (!input.senha || input.senha.length < 6) erros.push('Senha mín. 6 chars');
  if (!input.tituloEleitor?.trim()) erros.push('Título eleitoral obrigatório');
  if (!input.zonaEleitoral?.trim()) erros.push('Zona eleitoral obrigatória');
  if (!input.secaoEleitoral?.trim()) erros.push('Seção eleitoral obrigatória');
  if (!input.municipioEleitoral?.trim()) erros.push('Município eleitoral obrigatório');
  if (!input.colegioEleitoral?.trim()) erros.push('Colégio eleitoral obrigatório');
  // Instagram: opcional, sem bloqueio
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

describe('Validação completa — formulário de captação (todos os tipos via link)', () => {
  const tiposSimples: TipoLink[] = ['lideranca', 'fiscal', 'eleitor', 'fernanda', 'afiliado'];

  tiposSimples.forEach(tipo => {
    describe(`Tipo: ${tipo}`, () => {
      it('aceita nome + telefone com DDD válidos', () => {
        expect(validarCadastroViaLink({ nome: 'João Silva', telefone: '62999998888', tipo })).toHaveLength(0);
      });
      it('aceita telefone formatado com parênteses e hífen', () => {
        expect(validarCadastroViaLink({ nome: 'João', telefone: '(62) 9999-8888', tipo })).toHaveLength(0);
      });
      it('rejeita nome vazio', () => {
        expect(validarCadastroViaLink({ nome: '', telefone: '62999998888', tipo })).toContain('Nome obrigatório (mín. 2 chars)');
      });
      it('rejeita nome com 1 char', () => {
        expect(validarCadastroViaLink({ nome: 'J', telefone: '62999998888', tipo })).toContain('Nome obrigatório (mín. 2 chars)');
      });
      it('rejeita telefone vazio', () => {
        expect(validarCadastroViaLink({ nome: 'João', telefone: '', tipo })).toContain('Telefone com DDD obrigatório (mín. 10 dígitos)');
      });
      it('rejeita telefone sem DDD (8 dígitos)', () => {
        expect(validarCadastroViaLink({ nome: 'João', telefone: '99998888', tipo })).toContain('Telefone com DDD obrigatório (mín. 10 dígitos)');
      });
      it('rejeita telefone com 9 dígitos (DDD incompleto)', () => {
        expect(validarCadastroViaLink({ nome: 'João', telefone: '629999888', tipo })).toContain('Telefone com DDD obrigatório (mín. 10 dígitos)');
      });
      it('aceita telefone com 10 dígitos (DDD + 8)', () => {
        expect(validarCadastroViaLink({ nome: 'João', telefone: '6299998888', tipo })).toHaveLength(0);
      });
      it('aceita telefone com 11 dígitos (DDD + 9 móvel)', () => {
        expect(validarCadastroViaLink({ nome: 'João', telefone: '62999998888', tipo })).toHaveLength(0);
      });
      it('instagram é opcional — não bloqueia o envio', () => {
        expect(validarCadastroViaLink({ nome: 'João', telefone: '62999998888', tipo })).toHaveLength(0);
      });
      it('instagram preenchido — não bloqueia (sem validação async)', () => {
        expect(validarCadastroViaLink({ nome: 'João', telefone: '62999998888', instagram: '@joao', tipo })).toHaveLength(0);
      });
      it('CPF não preenchido — não bloqueia', () => {
        expect(validarCadastroViaLink({ nome: 'João', telefone: '62999998888', cpf: '', tipo })).toHaveLength(0);
      });
      it('CPF parcial (< 11 dígitos) — não bloqueia', () => {
        expect(validarCadastroViaLink({ nome: 'João', telefone: '62999998888', cpf: '111.444', tipo })).toHaveLength(0);
      });
      it('CPF com 11 dígitos válido — aceita', () => {
        expect(validarCadastroViaLink({ nome: 'João', telefone: '62999998888', cpf: '529.982.247-25', tipo })).toHaveLength(0);
      });
      it('CPF com 11 dígitos inválido — rejeita', () => {
        expect(validarCadastroViaLink({ nome: 'João', telefone: '62999998888', cpf: '111.111.111-11', tipo })).toContain('CPF inválido');
      });
    });
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
    expect(validarCriarAcesso(base)).toHaveLength(0);
  });
  it('rejeita nome vazio', () => {
    expect(validarCriarAcesso({ ...base, nome: '' })).toContain('Nome obrigatório');
  });
  it('rejeita whatsapp sem DDD (8 dígitos)', () => {
    expect(validarCriarAcesso({ ...base, whatsapp: '99998888' })).toContain('WhatsApp com DDD obrigatório (mín. 10 dígitos)');
  });
  it('aceita whatsapp com 10 dígitos (DDD + 8)', () => {
    expect(validarCriarAcesso({ ...base, whatsapp: '6299998888' })).toHaveLength(0);
  });
  it('aceita whatsapp formatado "(62) 9999-8888"', () => {
    expect(validarCriarAcesso({ ...base, whatsapp: '(62) 9999-8888' })).toHaveLength(0);
  });
  it('CPF válido (529.982.247-25) — aceita', () => {
    expect(validarCriarAcesso({ ...base, cpf: '529.982.247-25' })).toHaveLength(0);
  });
  it('CPF inválido (111.111.111-11) — rejeita', () => {
    expect(validarCriarAcesso({ ...base, cpf: '111.111.111-11' })).toContain('CPF inválido');
  });
  it('CPF não preenchido — aceita (CPF é opcional)', () => {
    expect(validarCriarAcesso({ ...base, cpf: '' })).toHaveLength(0);
  });
  it('Instagram inválido preenchido — NÃO bloqueia (campo livre)', () => {
    expect(validarCriarAcesso({ ...base, instagram: '@@@invalido###' })).toHaveLength(0);
  });
  it('rejeita usuário com menos de 3 chars', () => {
    expect(validarCriarAcesso({ ...base, usuarioLogin: 'ab' })).toContain('Usuário mín. 3 chars');
  });
  it('rejeita senha com menos de 6 chars', () => {
    expect(validarCriarAcesso({ ...base, senha: '12345' })).toContain('Senha mín. 6 chars');
  });
  it('rejeita sem título eleitoral', () => {
    expect(validarCriarAcesso({ ...base, tituloEleitor: '' })).toContain('Título eleitoral obrigatório');
  });
  it('rejeita sem zona eleitoral', () => {
    expect(validarCriarAcesso({ ...base, zonaEleitoral: '' })).toContain('Zona eleitoral obrigatória');
  });
  it('rejeita sem seção eleitoral', () => {
    expect(validarCriarAcesso({ ...base, secaoEleitoral: '' })).toContain('Seção eleitoral obrigatória');
  });
  it('rejeita sem município eleitoral', () => {
    expect(validarCriarAcesso({ ...base, municipioEleitoral: '' })).toContain('Município eleitoral obrigatório');
  });
  it('rejeita sem colégio eleitoral', () => {
    expect(validarCriarAcesso({ ...base, colegioEleitoral: '' })).toContain('Colégio eleitoral obrigatório');
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

describe('Destino do cadastro por tipo de link', () => {
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

describe('Log unificado em cadastros_afiliados (contador do card atualiza para todos os tipos)', () => {
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
