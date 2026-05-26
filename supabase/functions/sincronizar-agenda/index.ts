// supabase/functions/sincronizar-agenda/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, any>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── iCal Parser Helper ──────────────────────────────────────────

function parseICal(icsText: string) {
  const events = [];
  const lines = icsText.split(/\r?\n/);
  let currentEvent: any = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Handle line folding (standard in iCal format)
    while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
      line += lines[i + 1].slice(1);
      i++;
    }

    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = {};
    } else if (line.startsWith('END:VEVENT')) {
      if (currentEvent) {
        events.push(currentEvent);
        currentEvent = null;
      }
    } else if (currentEvent) {
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const keyPart = line.slice(0, colonIndex);
        const val = line.slice(colonIndex + 1);
        const match = keyPart.match(/^([A-Z0-9-]+)(;[^;]*)?$/);
        if (match) {
          const name = match[1];
          if (name === 'SUMMARY') currentEvent.summary = unescapeICalText(val);
          else if (name === 'LOCATION') currentEvent.location = unescapeICalText(val);
          else if (name === 'DESCRIPTION') currentEvent.description = unescapeICalText(val);
          else if (name === 'DTSTART') currentEvent.dtstart = parseICalDate(val);
          else if (name === 'UID') currentEvent.uid = val;
        }
      }
    }
  }
  return events;
}

function unescapeICalText(text: string) {
  return text
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\n/g, '\n')
    .replace(/\\N/g, '\n')
    .replace(/\\\\/g, '\\');
}

function parseICalDate(val: string) {
  const match = val.match(/^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})(Z)?)?/);
  if (!match) return null;
  const year = parseInt(match[1]);
  const month = parseInt(match[2]) - 1;
  const day = parseInt(match[3]);
  if (!match[4]) {
    // All-day event
    return new Date(year, month, day);
  }
  const hour = parseInt(match[5]);
  const min = parseInt(match[6]);
  const sec = parseInt(match[7]);
  
  if (match[8] === 'Z') {
    // UTC
    return new Date(Date.UTC(year, month, day, hour, min, sec));
  } else {
    // Local time
    return new Date(year, month, day, hour, min, sec);
  }
}

function generateSlug(nome: string) {
  return nome
    .toLowerCase()
    .trim()
    .normalize('NFD') // decomposes accents
    .replace(/[\u0300-\u036f]/g, '') // removes decomposed accent marks
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '');
}

// ── Main handler ───────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Authenticate caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Não autenticado' }, 401);
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) return jsonResponse({ error: 'Token inválido' }, 401);

    // Check permissions: admin or agenda
    const { data: callerHier } = await supabaseAdmin
      .from('hierarquia_usuarios')
      .select('id, tipo')
      .eq('auth_user_id', caller.id)
      .eq('ativo', true)
      .single();

    if (!callerHier || !['super_admin', 'coordenador', 'agenda'].includes(callerHier.tipo)) {
      return jsonResponse({ error: 'Acesso negado' }, 403);
    }

    // 2. Fetch iCal URL from configuration
    const { data: config } = await supabaseAdmin
      .from('configuracoes_app')
      .select('valor')
      .eq('chave', 'google_calendar_ical_url')
      .maybeSingle();

    if (!config || !config.valor) {
      return jsonResponse({ error: 'Nenhum link de Google Agenda (iCal) configurado no sistema' }, 400);
    }

    console.log('[sync] Fetching iCal feed from:', config.valor.slice(0, 50) + '...');
    const res = await fetch(config.valor);
    if (!res.ok) {
      return jsonResponse({ error: 'Erro ao baixar calendário do Google. Verifique a URL iCal.' }, 400);
    }

    const icsText = await res.text();
    const googleEvents = parseICal(icsText);
    console.log(`[sync] Parsed ${googleEvents.length} events from iCal feed`);

    // 3. Fetch all active users to match tags
    const { data: usuarios } = await supabaseAdmin
      .from('hierarquia_usuarios')
      .select('id, nome, tipo')
      .eq('ativo', true);

    if (!usuarios || usuarios.length === 0) {
      return jsonResponse({ success: true, importados: 0, mensagem: 'Nenhum usuário ativo para parear' });
    }

    // Pre-calculate slugs and name matchers
    const usersMap = usuarios.map(u => ({
      user: u,
      slug: generateSlug(u.nome),
      nameMatcher: u.nome.toLowerCase().trim()
    }));

    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // 4. Sync events
    for (const evt of googleEvents) {
      const summary = evt.summary || '';
      const description = evt.description || '';
      const dtstart = evt.dtstart;
      const location = evt.location || 'Não especificado';

      if (!dtstart) continue;

      // Find if any user is tagged in title or description (e.g. @carlos.souza, @joao.da.silva or @Carlos Souza)
      const textToSearch = `${summary} ${description}`.toLowerCase();
      
      let matchedUser: any = null;
      
      for (const item of usersMap) {
        // Match by @slug (ex: @carlos.souza)
        const slugTag = `@${item.slug}`;
        // Match by @name (ex: @carlos souza)
        const nameTag = `@${item.nameMatcher}`;
        
        if (textToSearch.includes(slugTag) || textToSearch.includes(nameTag)) {
          matchedUser = item.user;
          break;
        }
      }

      // If no tag, try to match exact name without @ as fallback (e.g. "Reunião com Carlos Souza")
      if (!matchedUser) {
        for (const item of usersMap) {
          if (textToSearch.includes(item.nameMatcher)) {
            matchedUser = item.user;
            break;
          }
        }
      }

      if (matchedUser) {
        const startIso = dtstart.toISOString();

        // Check if meeting already exists for this user at this exact time
        const { data: existing } = await supabaseAdmin
          .from('reunioes')
          .select('id')
          .eq('usuario_id', matchedUser.id)
          .eq('data_reuniao', startIso)
          .maybeSingle();

        if (!existing) {
          // Log/Insert meeting
          const { error: insertErr } = await supabaseAdmin
            .from('reunioes')
            .insert({
              usuario_id: matchedUser.id,
              registrado_por: callerHier.id, // registered by current logged-in synchronizer
              data_reuniao: startIso,
              local: location,
              observacoes: summary + (description ? ` - ${description}` : ''),
            });

          if (insertErr) {
            console.error(`[sync] Insert error for user ${matchedUser.nome}:`, insertErr);
            errors.push(`${matchedUser.nome}: ${insertErr.message}`);
          } else {
            importedCount++;
          }
        } else {
          skippedCount++;
        }
      }
    }

    return jsonResponse({
      success: true,
      importados: importedCount,
      ignorado_duplicados: skippedCount,
      erros: errors,
      mensagem: `Sincronização concluída! ${importedCount} novas reuniões importadas, ${skippedCount} já existentes ignoradas.`
    });

  } catch (err: any) {
    console.error('[sync] Sincronizar-agenda error:', err);
    return jsonResponse({ error: err.message }, 500);
  }
});
