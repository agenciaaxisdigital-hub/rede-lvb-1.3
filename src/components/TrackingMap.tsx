import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface MapLocation {
  id: string;
  latitude: number;
  longitude: number;
  precisao: number | null;
  fonte: string | null;
  bateria_nivel: number | null;
  criado_em: string;
}

interface MapGroup {
  usuario_id: string;
  nome: string;
  tipo: string;
  locations: MapLocation[];
  lastLocation: MapLocation;
  color: string;
}

function FitBoundsHelper({ points }: { points: Array<[number, number]> }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    try {
      map.fitBounds(points, { padding: [30, 30], maxZoom: 15 });
    } catch {
      // Ignore invalid bounds
    }
  }, [points, map]);

  return null;
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
  } catch {
    return iso;
  }
}

function fonteLabel(f: string | null) {
  if (f === 'gps') return 'GPS';
  if (f === 'ip') return 'IP';
  if (f === 'ip_background') return 'IP(bg)';
  return f || '—';
}

interface TrackingMapProps {
  groups: MapGroup[];
  loading: boolean;
}

export default function TrackingMap({ groups, loading }: TrackingMapProps) {
  const allPoints = groups.flatMap(g =>
    g.locations.map(l => [l.latitude, l.longitude] as [number, number])
  );

  return (
    <div className="rounded-2xl overflow-hidden border border-border relative" style={{ height: 400 }}>
      {loading && (
        <div className="absolute inset-0 z-[1000] bg-background/50 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <MapContainer
        center={[-15.78, -47.93]}
        zoom={4}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBoundsHelper points={allPoints} />
        {groups.map(group => {
          const path = group.locations.map(l => [l.latitude, l.longitude] as [number, number]);
          if (!path.length) return null;
          const last = group.locations[group.locations.length - 1];
          const sampled = group.locations.slice(1, -1).filter((_, i) => i % 3 === 0);

          return (
            <React.Fragment key={group.usuario_id}>
              {path.length > 1 && (
                <Polyline
                  positions={path}
                  pathOptions={{ color: group.color, weight: 3, opacity: 0.7, dashArray: '8, 6' }}
                />
              )}
              {sampled.map(loc => (
                <CircleMarker
                  key={loc.id}
                  center={[loc.latitude, loc.longitude]}
                  radius={4}
                  pathOptions={{ color: group.color, fillColor: group.color, fillOpacity: 0.8, weight: 1 }}
                >
                  <Popup>
                    <div className="text-xs">
                      <strong>{group.nome}</strong><br />
                      {formatDateTime(loc.criado_em)}<br />
                      Fonte: {fonteLabel(loc.fonte)}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
              <CircleMarker
                center={[last.latitude, last.longitude]}
                radius={8}
                pathOptions={{ color: group.color, fillColor: group.color, fillOpacity: 1, weight: 3 }}
              >
                <Popup>
                  <div className="text-xs space-y-0.5">
                    <strong>{group.nome}</strong>{' '}
                    <span style={{ color: '#999' }}>({group.tipo})</span><br />
                    📍 Última posição<br />
                    {formatDateTime(last.criado_em)}<br />
                    Fonte: {fonteLabel(last.fonte)}<br />
                    {last.precisao && <>Precisão: ±{Math.round(last.precisao)}m<br /></>}
                    {last.bateria_nivel !== null && <>🔋 {last.bateria_nivel}%<br /></>}
                    <a
                      href={"https://www.google.com/maps?q=" + last.latitude + "," + last.longitude}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#3b82f6' }}
                    >
                      Google Maps
                    </a>
                  </div>
                </Popup>
              </CircleMarker>
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
