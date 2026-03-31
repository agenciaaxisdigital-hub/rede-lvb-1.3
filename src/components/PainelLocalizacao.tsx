import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Clock, Battery, Wifi, ChevronDown, ChevronUp, RefreshCw, Loader2, Navigation } from 'lucide-react';

interface LocationRecord {
  id: string;
  usuario_id: string;
  latitude: number;
  longitude: number;
  precisao: number | null;
  fonte: string | null;
  bateria_nivel: number | null;
  em_movimento: boolean;
  criado_em: string;
}

interface UserLocationGroup {
  usuario_id: string;
  nome: string;
  tipo: string;
  locations: LocationRecord[];
  lastLocation: LocationRecord;
}

export default function PainelLocalizacao() {
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    setRefreshing(true);
    const [locRes, usrRes] = await Promise.all([
      supabase.from('localizacoes_usuarios').select('*').order('criado_em', { ascending: false }).limit(500),
      supabase.from('hierarquia_usuarios').select('id, nome, tipo').eq('ativo', true),
    ]);
    setLocations((locRes.data || []) as unknown as LocationRecord[]);
    setUsuarios(usrRes.data || []);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchData(); }, []);

  const userGroups = useMemo(() => {
    const map: Record<string, LocationRecord[]> = {};
    locations.forEach(loc => {
      if (!map[loc.usuario_id]) map[loc.usuario_id] = [];
      map[loc.usuario_id].push(loc);
    });

    return Object.entries(map).map(([uid, locs]) => {
      const user = usuarios.find(u => u.id === uid);
      return {
        usuario_id: uid,
        nome: user?.nome || 'Desconhecido',
        tipo: user?.tipo || '—',
        locations: locs,
        lastLocation: locs[0],
      } as UserLocationGroup;
    }).sort((a, b) => new Date(b.lastLocation.criado_em).getTime() - new Date(a.lastLocation.criado_em).getTime());
  }, [locations, usuarios]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diff < 1) return 'Agora';
    if (diff < 60) return `${diff}min atrás`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h atrás`;
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const fonteIcon = (fonte: string | null) => {
    if (fonte === 'gps') return <Navigation size={10} className="text-emerald-400" />;
    if (fonte === 'ip' || fonte === 'ip_background') return <Wifi size={10} className="text-amber-400" />;
    return <MapPin size={10} className="text-muted-foreground" />;
  };

  const fonteLabel = (fonte: string | null) => {
    if (fonte === 'gps') return 'GPS';
    if (fonte === 'ip') return 'IP';
    if (fonte === 'ip_background') return 'IP (bg)';
    return fonte || '—';
  };

  const openMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground">📍 Rastreamento em Tempo Real</h2>
          <p className="text-[10px] text-muted-foreground">{userGroups.length} usuários rastreados · {locations.length} registros</p>
        </div>
        <button onClick={fetchData} disabled={refreshing}
          className="p-2 rounded-xl bg-muted hover:bg-muted/80 active:scale-95 transition-all">
          <RefreshCw size={16} className={`text-foreground ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {userGroups.length === 0 ? (
        <div className="section-card text-center py-8">
          <MapPin size={32} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma localização registrada ainda</p>
          <p className="text-[10px] text-muted-foreground mt-1">As localizações aparecerão conforme os usuários usarem o app</p>
        </div>
      ) : (
        <div className="space-y-2">
          {userGroups.map(group => {
            const isExpanded = expandedUser === group.usuario_id;
            const last = group.lastLocation;
            return (
              <div key={group.usuario_id} className="section-card !p-0 overflow-hidden">
                <button
                  onClick={() => setExpandedUser(isExpanded ? null : group.usuario_id)}
                  className="w-full flex items-center gap-3 p-3 text-left active:bg-muted/50 transition-all"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">{group.nome.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{group.nome}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{group.tipo}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock size={10} className="text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">{formatTime(last.criado_em)}</span>
                      {fonteIcon(last.fonte)}
                      <span className="text-[10px] text-muted-foreground">{fonteLabel(last.fonte)}</span>
                      {last.bateria_nivel !== null && (
                        <>
                          <Battery size={10} className={last.bateria_nivel > 20 ? 'text-emerald-400' : 'text-red-400'} />
                          <span className="text-[10px] text-muted-foreground">{last.bateria_nivel}%</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openMaps(last.latitude, last.longitude); }}
                      className="p-1.5 rounded-lg bg-primary/10 text-primary active:scale-95"
                    >
                      <MapPin size={14} />
                    </button>
                    {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-3 pb-3 pt-2 space-y-1.5 max-h-[300px] overflow-y-auto">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Histórico ({group.locations.length} registros)</p>
                    {group.locations.slice(0, 50).map(loc => (
                      <div key={loc.id} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
                        {fonteIcon(loc.fonte)}
                        <span className="text-[10px] text-muted-foreground w-16 shrink-0">{fonteLabel(loc.fonte)}</span>
                        <button
                          onClick={() => openMaps(loc.latitude, loc.longitude)}
                          className="text-[10px] text-primary underline truncate"
                        >
                          {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                        </button>
                        {loc.precisao && <span className="text-[9px] text-muted-foreground">±{Math.round(loc.precisao)}m</span>}
                        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{formatTime(loc.criado_em)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
