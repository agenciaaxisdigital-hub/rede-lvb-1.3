import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-token',
};

const bodySchema = z.object({
  tipo: z.enum(['lideranca', 'fiscal', 'eleitor']),
  // Quem indicou/cadastrou
  indicador_id: z.string().uuid(),
  indicador_tipo: z.enum(['suplente', 'lideranca', 'coordenador', 'super_admin', 'fiscal', 'eleitor_cadastrado', 'lideranca_cadastrada', 'fiscal_cadastrado']),
  indicador_nome: z.string().optional().nullable(),
  // Dados da pessoa sendo cadastrada
  nome: z.string().trim().min(2).max(120),
  cpf: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  zona_eleitoral: z.string().optional().nullable(),
  secao_eleitoral: z.string().optional().nullable(),
  colegio_eleitoral: z.string().optional().nullable(),
  municipio_eleitoral: z.string().optional().nullable(),
  titulo_eleitor: z.string().optional().nullable(),
  regiao_atuacao: z.string().optional().nullable(),
  zona_fiscal: z.string().optional().nullable(),
  secao_fiscal: z.string().optional().nullable(),
  compromisso_voto: z.string().optional().nullable(),
  lideranca_id: z.string().uuid().optional().nullable(),
  // Compatibilidade legada
  cadastrado_por_id: z.string().optional().nullable(),
  cadastrado_por_fonte: z.enum(['externo', 'local']).optional().nullable(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const TOKEN_SECRETO = Deno.env.get('CADASTRO_EXTERNO_TOKEN');
    const tokenRecebido = req.headers.get('x-api-token');
    if (!tokenRecebido || tokenRecebido !== TOKEN_SECRETO) {
      return new Response(
        JSON.stringify({ erro: 'Token inválido ou ausente' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawBody = await req.json();
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ erro: 'Dados inválidos', detalhes: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const body = parsed.data;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── Resolver indicador → cadastrado_por, suplente_id, municipio_id ──
    let cadastradoPorId: string | null = null;
    let suplenteId: string | null = null;
    let municipioId: string | null = null;

    const indId = body.indicador_id ?? body.cadastrado_por_id;
    const indTipo = body.indicador_tipo ?? (body.cadastrado_por_fonte === 'externo' ? 'suplente' : 'coordenador');

    if (!indId) {
      return new Response(
        JSON.stringify({ erro: 'indicador_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Tipos que são usuários diretos do sistema (hierarquia_usuarios)
    const tiposHierarquia = ['super_admin', 'coordenador', 'lideranca', 'fiscal'];

    if (tiposHierarquia.includes(indTipo)) {
      // O indicador_id É um hierarquia_usuarios.id
      const { data: usuario } = await supabaseAdmin
        .from('hierarquia_usuarios')
        .select('id, suplente_id, municipio_id')
        .eq('id', indId)
        .eq('ativo', true)
        .maybeSingle();

      if (usuario) {
        cadastradoPorId = usuario.id;
        suplenteId = usuario.suplente_id;
        municipioId = usuario.municipio_id;
      }
    } else if (indTipo === 'suplente') {
      // O indicador_id é um suplente (banco externo ou local)
      // Espelhar suplente localmente se necessário
      if (body.indicador_nome) {
        await supabaseAdmin.from('suplentes').upsert(
          { id: indId, nome: body.indicador_nome },
          { onConflict: 'id' }
        );
      }
      // Tentar encontrar usuário vinculado ao suplente
      const { data: usuarioVinculado } = await supabaseAdmin
        .from('hierarquia_usuarios')
        .select('id, suplente_id, municipio_id')
        .eq('suplente_id', indId)
        .eq('ativo', true)
        .maybeSingle();

      if (usuarioVinculado) {
        cadastradoPorId = usuarioVinculado.id;
        suplenteId = usuarioVinculado.suplente_id;
        municipioId = usuarioVinculado.municipio_id;
      } else {
        suplenteId = indId;
        const { data: sm } = await supabaseAdmin
          .from('suplente_municipio')
          .select('municipio_id')
          .eq('suplente_id', indId)
          .maybeSingle();
        municipioId = sm?.municipio_id ?? null;
      }
    } else if (indTipo === 'lideranca_cadastrada') {
      // O indicador_id é um liderancas.id
      const { data: lid } = await supabaseAdmin
        .from('liderancas')
        .select('id, cadastrado_por, suplente_id, municipio_id')
        .eq('id', indId)
        .maybeSingle();

      if (lid) {
        cadastradoPorId = lid.cadastrado_por;
        suplenteId = lid.suplente_id;
        municipioId = lid.municipio_id;
      }
    } else if (indTipo === 'fiscal_cadastrado') {
      // O indicador_id é um fiscais.id
      const { data: fisc } = await supabaseAdmin
        .from('fiscais')
        .select('id, cadastrado_por, suplente_id, municipio_id')
        .eq('id', indId)
        .maybeSingle();

      if (fisc) {
        cadastradoPorId = fisc.cadastrado_por;
        suplenteId = fisc.suplente_id;
        municipioId = fisc.municipio_id;
      }
    } else if (indTipo === 'eleitor_cadastrado') {
      // O indicador_id é um possiveis_eleitores.id
      const { data: el } = await supabaseAdmin
        .from('possiveis_eleitores')
        .select('id, cadastrado_por, suplente_id, municipio_id')
        .eq('id', indId)
        .maybeSingle();

      if (el) {
        cadastradoPorId = el.cadastrado_por;
        suplenteId = el.suplente_id;
        municipioId = el.municipio_id;
      }
    }

    // ── Upsert pessoa ──
    let pessoaId: string;

    if (body.cpf) {
      const cpfLimpo = body.cpf.replace(/\D/g, '');
      const { data: pessoaExistente } = await supabaseAdmin
        .from('pessoas')
        .select('id')
        .eq('cpf', cpfLimpo)
        .maybeSingle();

      if (pessoaExistente) {
        pessoaId = pessoaExistente.id;
        await supabaseAdmin.from('pessoas').update({
          telefone: body.telefone || undefined,
          whatsapp: body.whatsapp || undefined,
          zona_eleitoral: body.zona_eleitoral || undefined,
          secao_eleitoral: body.secao_eleitoral || undefined,
        }).eq('id', pessoaId);
      } else {
        const { data: nova, error } = await supabaseAdmin
          .from('pessoas')
          .insert({
            nome: body.nome,
            cpf: cpfLimpo,
            telefone: body.telefone,
            whatsapp: body.whatsapp,
            email: body.email,
            zona_eleitoral: body.zona_eleitoral,
            secao_eleitoral: body.secao_eleitoral,
            colegio_eleitoral: body.colegio_eleitoral,
            municipio_eleitoral: body.municipio_eleitoral,
            titulo_eleitor: body.titulo_eleitor,
          })
          .select('id')
          .single();
        if (error) throw new Error(`Erro ao criar pessoa: ${error.message}`);
        pessoaId = nova!.id;
      }
    } else {
      const { data: nova, error } = await supabaseAdmin
        .from('pessoas')
        .insert({
          nome: body.nome,
          telefone: body.telefone,
          whatsapp: body.whatsapp,
          email: body.email,
        })
        .select('id')
        .single();
      if (error) throw new Error(`Erro ao criar pessoa: ${error.message}`);
      pessoaId = nova!.id;
    }

    // ── Inserir no tipo correto ──
    if (body.tipo === 'lideranca') {
      const { data: existente } = await supabaseAdmin
        .from('liderancas').select('id').eq('pessoa_id', pessoaId).maybeSingle();
      if (existente) {
        return new Response(
          JSON.stringify({ aviso: 'Pessoa já cadastrada como liderança', id: existente.id }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const { data: novo, error } = await supabaseAdmin
        .from('liderancas')
        .insert({
          pessoa_id: pessoaId,
          cadastrado_por: cadastradoPorId,
          suplente_id: suplenteId,
          municipio_id: municipioId,
          status: 'Ativa',
          regiao_atuacao: body.regiao_atuacao,
          origem_captacao: 'visita_comite',
        })
        .select('id').single();
      if (error) throw new Error(`Erro ao criar liderança: ${error.message}`);
      return new Response(
        JSON.stringify({ sucesso: true, tipo: 'lideranca', id: novo!.id, pessoa_id: pessoaId }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.tipo === 'fiscal') {
      const { data: existente } = await supabaseAdmin
        .from('fiscais').select('id').eq('pessoa_id', pessoaId).maybeSingle();
      if (existente) {
        return new Response(
          JSON.stringify({ aviso: 'Pessoa já cadastrada como fiscal', id: existente.id }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const { data: novo, error } = await supabaseAdmin
        .from('fiscais')
        .insert({
          pessoa_id: pessoaId,
          cadastrado_por: cadastradoPorId,
          suplente_id: suplenteId,
          municipio_id: municipioId,
          status: 'Ativo',
          zona_fiscal: body.zona_fiscal,
          secao_fiscal: body.secao_fiscal,
          origem_captacao: 'visita_comite',
        } as any)
        .select('id').single();
      if (error) throw new Error(`Erro ao criar fiscal: ${error.message}`);
      return new Response(
        JSON.stringify({ sucesso: true, tipo: 'fiscal', id: novo!.id, pessoa_id: pessoaId }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.tipo === 'eleitor') {
      const { data: existente } = await supabaseAdmin
        .from('possiveis_eleitores').select('id').eq('pessoa_id', pessoaId).maybeSingle();
      if (existente) {
        return new Response(
          JSON.stringify({ aviso: 'Pessoa já cadastrada como eleitor', id: existente.id }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const { data: novo, error } = await supabaseAdmin
        .from('possiveis_eleitores')
        .insert({
          pessoa_id: pessoaId,
          cadastrado_por: cadastradoPorId,
          suplente_id: suplenteId,
          municipio_id: municipioId,
          lideranca_id: body.lideranca_id,
          compromisso_voto: body.compromisso_voto ?? 'Indefinido',
          origem_captacao: 'visita_comite',
        } as any)
        .select('id').single();
      if (error) throw new Error(`Erro ao criar eleitor: ${error.message}`);
      return new Response(
        JSON.stringify({ sucesso: true, tipo: 'eleitor', id: novo!.id, pessoa_id: pessoaId }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ erro: 'Tipo inválido' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro em receber-cadastro-externo:', error);
    return new Response(
      JSON.stringify({ erro: error instanceof Error ? error.message : 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
