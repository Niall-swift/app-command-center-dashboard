import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft, ChevronRight, Search, Layers, Signal as SignalIcon,
  Server, Users, Home, Wifi, Circle, Zap, RefreshCw, Eye, EyeOff,
  MapPin, Radio
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/config/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { ixcService } from '@/services/ixc/ixcService';
import { IXCLoginData, IXCCaixaData, IXCPosteData, IXCPopData } from '@/types/ixc';
import { smartOltService } from '@/services/smartolt/smartOltService';
import { SmartOltOnu, SmartOltOlt } from '@/types/smartOlt';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  InfoWindow,
  useMap,
  MapCameraChangedEvent
} from '@vis.gl/react-google-maps';

interface Technician {
  id: string; name: string; coordinates: [number, number];
  email: string; lastUpdate: string; status: 'online' | 'offline';
}

// ---------- Polyline Component ----------
const Polyline = ({ points, color, weight, opacity, dashed }: {
  points: google.maps.LatLngLiteral[]; color: string; weight: number; opacity: number; dashed?: boolean;
}) => {
  const map = useMap();
  const ref = useRef<google.maps.Polyline | null>(null);
  useEffect(() => {
    if (!map) return;
    ref.current = new google.maps.Polyline({
      path: points, geodesic: true, strokeColor: color,
      strokeOpacity: dashed ? 0 : opacity, strokeWeight: weight,
      icons: dashed ? [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: opacity, scale: weight }, offset: '0', repeat: '12px' }] : [],
      map,
    });
    return () => { ref.current?.setMap(null); };
  }, [map, points, color, opacity, weight, dashed]);
  return null;
};

// ---------- Layer Config ----------
type LayerId = 'logins' | 'ctos' | 'olts' | 'technicians' | 'cables' | 'postes' | 'pops' | 'standalone';
interface LayerConfig { id: LayerId; label: string; icon: React.ReactNode; color: string; defaultOn: boolean; }
const LAYERS: LayerConfig[] = [
  { id: 'logins',      label: 'Logins / Clientes', icon: <Home className="w-3.5 h-3.5" />,       color: '#3b82f6', defaultOn: true },
  { id: 'ctos',        label: 'CTOs (Caixas)',      icon: <Circle className="w-3.5 h-3.5" />,     color: '#8b5cf6', defaultOn: true },
  { id: 'cables',      label: 'Cabos Drop',         icon: <Zap className="w-3.5 h-3.5" />,        color: '#06b6d4', defaultOn: true },
  { id: 'olts',        label: 'OLTs SmartOLT',      icon: <Server className="w-3.5 h-3.5" />,     color: '#1d4ed8', defaultOn: true },
  { id: 'technicians', label: 'Técnicos',           icon: <Users className="w-3.5 h-3.5" />,      color: '#10b981', defaultOn: true },
  { id: 'standalone',  label: 'Clientes Avulsos',   icon: <Home className="w-3.5 h-3.5" />,       color: '#94a3b8', defaultOn: false },
  { id: 'postes',      label: 'Postes',             icon: <Radio className="w-3.5 h-3.5" />,      color: '#6b7280', defaultOn: false },
  { id: 'pops',        label: 'POPs',               icon: <Wifi className="w-3.5 h-3.5" />,       color: '#f59e0b', defaultOn: false },
];

// ---------- Custom SVG Markers ----------
const HomeSvg = ({ color }: { color: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={color} stroke="white" strokeWidth="1.5">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9,22 9,12 15,12 15,22"/>
  </svg>
);
const CtoSvg = ({ color, label }: { color: string; label: string }) => (
  <div style={{
    backgroundColor: color, color: 'white', borderRadius: '50%',
    width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '2px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
    fontSize: '9px', fontWeight: 700, lineHeight: 1
  }}>{label}</div>
);
const PosteSvg = () => (
  <svg width="14" height="28" viewBox="0 0 14 28" fill="none">
    <rect x="5" y="0" width="4" height="22" rx="2" fill="#6b7280"/>
    <rect x="0" y="6" width="14" height="3" rx="1.5" fill="#9ca3af"/>
    <circle cx="7" cy="24" r="3" fill="#4b5563" stroke="white" strokeWidth="1"/>
  </svg>
);
const PopSvg = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="#f59e0b" stroke="white" strokeWidth="1.5">
    <polygon points="12,2 22,20 2,20"/>
  </svg>
);

const Frag = ({ children }: { children: React.ReactNode; [k: string]: unknown }) => <>{children}</>;

// ---------- Helpers ----------
const parseCoord = (v?: string | number | null): number => {
  const n = parseFloat(String(v || '').replace(',', '.'));
  return isNaN(n) ? NaN : n;
};
const getCtoColor = (cap?: string, occ?: string): string => {
  const c = parseInt(cap || '0'); const o = parseInt(occ || '0');
  if (!c) return '#8b5cf6';
  const pct = o / c;
  if (pct < 0.7) return '#10b981';
  if (pct < 0.9) return '#f59e0b';
  return '#ef4444';
};
const getSignalColor = (sinal?: string, smartStatus?: string): string => {
  if (smartStatus === 'online')  return '#10b981';
  if (smartStatus === 'los')     return '#ef4444';
  if (smartStatus === 'offline') return '#f59e0b';
  const s = parseFloat((sinal || '').replace(/[^-0-9.]/g, ''));
  if (isNaN(s)) return '#3b82f6';
  if (s > -25) return '#10b981';
  if (s > -28) return '#f59e0b';
  return '#ef4444';
};

// ---------- Main Component ----------
const NetworkMap = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [layers, setLayers] = useState<Record<LayerId, boolean>>(
    Object.fromEntries(LAYERS.map(l => [l.id, l.defaultOn])) as Record<LayerId, boolean>
  );
  const [mapStyle, setMapStyle] = useState<'roadmap' | 'satellite' | 'hybrid'>('roadmap');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeInfoWindow, setActiveInfoWindow] = useState<{ type: string; id: string } | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: -25.4284, lng: -49.2748 });
  const [mapZoom, setMapZoom] = useState(13);
  const [apiLoaded, setApiLoaded] = useState(false);

  // Data
  const [logins, setLogins] = useState<(IXCLoginData & { clientName?: string })[]>([]);
  const [ctos, setCtos] = useState<IXCCaixaData[]>([]);
  const [postes, setPostes] = useState<IXCPosteData[]>([]);
  const [pops, setPops] = useState<IXCPopData[]>([]);
  const [olts, setOlts] = useState<SmartOltOlt[]>([]);
  const [smartOnus, setSmartOnus] = useState<SmartOltOnu[]>([]);
  const [techs, setTechs] = useState<Technician[]>([]);
  const [standaloneClients, setStandaloneClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const { toast } = useToast();
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const isKeyValid = apiKey.startsWith('AIza') && apiKey.length > 20;

  // Google API check
  useEffect(() => {
    const t = setInterval(() => { if (typeof google !== 'undefined') { setApiLoaded(true); clearInterval(t); } }, 500);
    return () => clearInterval(t);
  }, []);

  // Technicians (Firebase)
  useEffect(() => {
    const q = collection(db, 'technicians');
    return onSnapshot(q, snap => {
      const techs: Technician[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (d.location?.latitude && d.location?.longitude) {
          const diff = (new Date().getTime() - new Date(d.lastUpdate).getTime()) / 60000;
          techs.push({ id: doc.id, name: d.email?.split('@')[0] || 'Técnico', email: d.email || '',
            coordinates: [d.location.latitude, d.location.longitude], lastUpdate: d.lastUpdate, status: diff < 15 ? 'online' : 'offline' });
        }
      });
      setTechs(techs);
    });
  }, []);

  // IXC + SmartOLT data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [rawLogins, allCtos, allClients, rawPostes, rawPops, smartOnusRes, smartOltsRes] = await Promise.all([
          ixcService.fetchAllLoginsComCoordenadas(),
          ixcService.fetchAllCaixasComCoordenadas(),
          ixcService.fetchAllClientesAtivos(),
          ixcService.getPostesComCoordenadas(),
          ixcService.getPopsComCoordenadas(),
          smartOltService.getOnus().catch(() => [] as SmartOltOnu[]),
          smartOltService.getOlts().catch(() => [] as SmartOltOlt[]),
        ]);

        const clientMap = new Map(allClients.map(c => [c.id, c]));
        
        // Logins enriched with client data
        const enriched = rawLogins.map(l => ({
          ...l, 
          clientName: clientMap.get(l.id_cliente || '')?.razao || clientMap.get(l.id_cliente || '')?.nome || `Cliente ${l.id_cliente}`
        }));

        // Clients with Geo that are NOT represented in radusuarios records
        const loginClientIds = new Set(rawLogins.map(l => l.id_cliente));
        const standaloneClients = allClients.filter(c => {
          const lat = parseCoord(c.latitude);
          const lng = parseCoord(c.longitude);
          return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && !loginClientIds.has(c.id);
        });

        setLogins(enriched);
        setCtos(allCtos);
        setPostes(rawPostes);
        setPops(rawPops);
        setSmartOnus(smartOnusRes);
        setOlts(smartOltsRes);
        setStandaloneClients(standaloneClients);

        // We can add standalone clients to a specific state or just merge them for display
        // For now, let's just count them and maybe show them as a separate layer
        setCounts({ 
          logins: enriched.length, 
          ctos: allCtos.length, 
          postes: rawPostes.length, 
          pops: rawPops.length, 
          olts: smartOltsRes.length,
          standalone: standaloneClients.length
        });

        // Auto-center using ALL available points
        const allPoints = [
          ...enriched.map(l => ({ lat: parseCoord(l.latitude), lng: parseCoord(l.longitude) })),
          ...allCtos.map(c => ({ lat: parseCoord(c.latitude), lng: parseCoord(c.longitude) })),
          ...standaloneClients.map(c => ({ lat: parseCoord(c.latitude), lng: parseCoord(c.longitude) }))
        ].filter(p => !isNaN(p.lat) && !isNaN(p.lng));

        if (allPoints.length > 0) {
          const lats = allPoints.map(p => p.lat);
          const lngs = allPoints.map(p => p.lng);
          setMapCenter({ 
            lat: (Math.min(...lats) + Math.max(...lats)) / 2, 
            lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 
          });
        }
      } catch (e) {
        console.error('Erro ao carregar dados do mapa:', e);
        toast({ title: 'Erro ao carregar mapa', description: 'Verifique a conexão com o IXC.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggleLayer = (id: LayerId) => setLayers(prev => ({ ...prev, [id]: !prev[id] }));

  // Filter by search
  const filtered = searchQuery
    ? logins.filter(l => (l.clientName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (l.login || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : logins;

  return (
    <div className="relative w-full" style={{ height: 'calc(100vh - 120px)', minHeight: '600px', background: '#1a1a2e' }}>
      <style>{`
        @keyframes pulse-red { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.7)} 70%{box-shadow:0 0 0 10px rgba(239,68,68,0)} }
        .fbmap-sidebar { transition: width 0.3s ease, opacity 0.3s ease; }
      `}</style>

      {/* ===== LEFT SIDEBAR ===== */}
      <div className="fbmap-sidebar absolute top-0 left-0 h-full z-20 flex flex-col"
        style={{ width: sidebarOpen ? '260px' : '0px', overflow: 'hidden' }}>
        <div className="h-full flex flex-col" style={{ width: '260px', background: 'rgba(15,23,42,0.96)', backdropFilter: 'blur(8px)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
          {/* Header */}
          <div className="p-3 border-b border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span className="text-white font-semibold text-sm">Árvore de Elementos</span>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-gray-400" />
              <Input
                placeholder="Buscar elemento..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-7 h-7 text-xs bg-white/10 border-white/20 text-white placeholder:text-gray-500"
              />
            </div>
          </div>
          {/* Layers List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {loading && (
              <div className="flex items-center gap-2 p-3 text-xs text-gray-400">
                <RefreshCw className="w-3 h-3 animate-spin" /> Carregando dados...
              </div>
            )}
            {LAYERS.map(layer => {
              const count = counts[layer.id];
              const isOn = layers[layer.id];
              const hide = (layer.id === 'postes' && !loading && (counts.postes || 0) === 0) ||
                           (layer.id === 'pops' && !loading && (counts.pops || 0) === 0);
              if (hide) return null;
              return (
                <button key={layer.id} onClick={() => toggleLayer(layer.id)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-all hover:bg-white/10 group">
                  <div className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all"
                    style={{ borderColor: isOn ? layer.color : '#4b5563', background: isOn ? layer.color : 'transparent' }}>
                    {isOn && <svg width="8" height="8" viewBox="0 0 10 10"><path d="M1 5L4 8L9 2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
                  </div>
                  <span style={{ color: layer.color }} className="flex-shrink-0">{layer.icon}</span>
                  <span className="text-gray-300 text-xs flex-1 truncate">{layer.label}</span>
                  {count !== undefined && count > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                      style={{ background: isOn ? layer.color + '33' : '#ffffff11', color: isOn ? layer.color : '#6b7280' }}>
                      {count}
                    </span>
                  )}
                  <span className="opacity-0 group-hover:opacity-100 text-gray-500 flex-shrink-0">
                    {isOn ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Legend */}
          <div className="p-3 border-t border-white/10 space-y-1.5">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">Legendas – Sinal</p>
            {[['#10b981', 'Online / Sinal OK'], ['#f59e0b', 'Offline / Alerta'], ['#ef4444', 'LOS / Crítico']].map(([c, l]) => (
              <div key={c} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c }} />
                <span className="text-[10px] text-gray-400">{l}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: '#8b5cf6' }} />
              <span className="text-[10px] text-gray-400">CTO (verde &lt;70% / laranja &lt;90% / vermelho ≥90%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== TOGGLE SIDEBAR BUTTON ===== */}
      <button
        onClick={() => setSidebarOpen(p => !p)}
        className="absolute top-3 z-30 w-6 h-12 flex items-center justify-center rounded-r-lg transition-all hover:opacity-90"
        style={{ left: sidebarOpen ? '260px' : '0px', background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderLeft: 'none' }}>
        {sidebarOpen ? <ChevronLeft className="w-3.5 h-3.5 text-gray-300" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
      </button>

      {/* ===== TOP TOOLBAR ===== */}
      <div className="absolute top-3 right-3 z-20 flex gap-2 items-center">
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.92)' }}>
          {(['roadmap','satellite','hybrid'] as const).map(s => (
            <button key={s} onClick={() => setMapStyle(s)}
              className="px-3 py-1.5 text-[10px] font-medium transition-all"
              style={{ background: mapStyle === s ? '#3b82f6' : 'transparent', color: mapStyle === s ? 'white' : '#9ca3af' }}>
              {s === 'roadmap' ? 'Mapa' : s === 'satellite' ? 'Satélite' : 'Híbrido'}
            </button>
          ))}
        </div>
        {!loading && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-green-300"
            style={{ background: 'rgba(15,23,42,0.92)', border: '1px solid rgba(34,197,94,0.3)' }}>
            <Zap className="w-3 h-3 text-green-400" /> Dados 100% Carregados
          </div>
        )}
        {loading && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-blue-300"
            style={{ background: 'rgba(15,23,42,0.92)', border: '1px solid rgba(59,130,246,0.3)' }}>
            <RefreshCw className="w-3 h-3 animate-spin" /> Carregando...
          </div>
        )}
      </div>

      {/* ===== MAP ===== */}
      {!isKeyValid ? (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center p-8 bg-white/5 rounded-xl border border-white/10">
            <SignalIcon className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-white font-semibold">Chave Google Maps inválida</p>
            <p className="text-gray-400 text-sm mt-1">Verifique VITE_GOOGLE_MAPS_API_KEY no .env.local</p>
          </div>
        </div>
      ) : (
        <APIProvider apiKey={apiKey}>
          <GoogleMap
            defaultCenter={mapCenter}
            defaultZoom={mapZoom}
            mapId="bf51a910020faedc"
            mapTypeId={mapStyle}
            onCameraChanged={(ev: MapCameraChangedEvent) => {
              setMapCenter(ev.detail.center); setMapZoom(ev.detail.zoom);
            }}
            onClick={() => setActiveInfoWindow(null)}
          >
            {/* ---- Technicians ---- */}
            {apiLoaded && layers.technicians && techs.map(tech => (
              <AdvancedMarker key={tech.id} position={{ lat: tech.coordinates[0], lng: tech.coordinates[1] }}
                onClick={() => setActiveInfoWindow({ type: 'tech', id: tech.id })}>
                <div style={{ backgroundColor: tech.status === 'online' ? '#10b981' : '#6b7280', color: 'white', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.4)', fontSize: '10px', fontWeight: 700 }}>
                  {tech.name.charAt(0).toUpperCase()}
                </div>
                {activeInfoWindow?.type === 'tech' && activeInfoWindow.id === tech.id && (
                  <InfoWindow position={{ lat: tech.coordinates[0], lng: tech.coordinates[1] }} onCloseClick={() => setActiveInfoWindow(null)}>
                    <div className="p-2 min-w-[160px]">
                      <p className="font-bold text-sm">{tech.name}</p>
                      <p className="text-xs text-gray-500">{tech.email}</p>
                      <Badge variant={tech.status === 'online' ? 'default' : 'secondary'} className="mt-1 text-[10px]">{tech.status}</Badge>
                    </div>
                  </InfoWindow>
                )}
              </AdvancedMarker>
            ))}

            {/* ---- OLTs ---- */}
            {apiLoaded && layers.olts && olts.map(olt => {
              const lat = parseCoord((olt as any).latitude || (olt as any).gps_lat);
              const lng = parseCoord((olt as any).longitude || (olt as any).gps_lng);
              if (isNaN(lat) || isNaN(lng)) return null;
              return (
                <Frag key={olt.id}>
                  <AdvancedMarker position={{ lat, lng }} onClick={() => setActiveInfoWindow({ type: 'olt', id: olt.id })}>
                    <div style={{ backgroundColor: '#1e3a8a', color: 'white', borderRadius: '6px', padding: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.5)', gap: '3px' }}>
                      <Server className="w-4 h-4" />
                    </div>
                    {activeInfoWindow?.type === 'olt' && activeInfoWindow.id === olt.id && (
                      <InfoWindow position={{ lat, lng }} onCloseClick={() => setActiveInfoWindow(null)}>
                        <div className="p-2 min-w-[200px]">
                          <h3 className="font-bold text-blue-900 flex items-center gap-1"><Server className="w-3.5 h-3.5" />{olt.name}</h3>
                          <p className="text-xs mt-1"><strong>IP:</strong> {olt.ip}</p>
                          <p className="text-xs"><strong>Uptime:</strong> {olt.uptime || 'N/D'}</p>
                          <p className="text-xs"><strong>Temp:</strong> {olt.temperature || 'N/D'}</p>
                        </div>
                      </InfoWindow>
                    )}
                  </AdvancedMarker>
                </Frag>
              );
            })}

            {/* ---- CTOs ---- */}
            {apiLoaded && layers.ctos && ctos.map(cto => {
              const lat = parseCoord(cto.latitude); const lng = parseCoord(cto.longitude);
              if (isNaN(lat) || isNaN(lng)) return null;
              const color = getCtoColor(cto.capacidade, cto.ocupacao);
              const cap = parseInt(cto.capacidade || '0'); const occ = parseInt(cto.ocupacao || '0');
              const label = cap > 0 ? `${occ}/${cap}` : 'CTO';
              return (
                <AdvancedMarker key={cto.id} position={{ lat, lng }} onClick={() => setActiveInfoWindow({ type: 'cto', id: cto.id! })}>
                  <CtoSvg color={color} label={label} />
                  {activeInfoWindow?.type === 'cto' && activeInfoWindow.id === cto.id && (
                    <InfoWindow position={{ lat, lng }} onCloseClick={() => setActiveInfoWindow(null)}>
                      <div className="p-2 min-w-[200px]">
                        <h3 className="font-bold text-purple-800">{cto.caixa}</h3>
                        {cap > 0 && (
                          <>
                            <div className="flex justify-between text-xs mt-1 mb-0.5 text-gray-600">
                              <span>Ocupação</span><span className="font-semibold">{occ}/{cap} portas</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (occ/cap)*100)}%`, background: color }} />
                            </div>
                          </>
                        )}
                        <div className="mt-2 flex gap-1">
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: color + '22', color }}>CTO</span>
                        </div>
                      </div>
                    </InfoWindow>
                  )}
                </AdvancedMarker>
              );
            })}

            {/* ---- Logins/Clientes + Drop Cables ---- */}
            {apiLoaded && layers.logins && filtered.map(login => {
              const lat = parseCoord(login.latitude); const lng = parseCoord(login.longitude);
              if (isNaN(lat) || isNaN(lng)) return null;
              const smartOnu = smartOnus.find(s => s.sn === login.mac || s.name?.includes(login.login || '') || s.description?.includes(login.login || ''));
              const color = getSignalColor(login.sinal_ultimo_atendimento as string, smartOnu?.status);
              const cto = ctos.find(c => c.id === login.id_caixa_ftth);
              const cLat = cto ? parseCoord(cto.latitude) : NaN;
              const cLng = cto ? parseCoord(cto.longitude) : NaN;
              const isLos = smartOnu?.status === 'los';
              return (
                <Frag key={login.id}>
                  <AdvancedMarker position={{ lat, lng }} onClick={() => setActiveInfoWindow({ type: 'login', id: login.id! })}>
                    <div style={{ animation: isLos ? 'pulse-red 2s infinite' : 'none', padding: '1px' }}>
                      <HomeSvg color={color} />
                    </div>
                    {activeInfoWindow?.type === 'login' && activeInfoWindow.id === login.id && (
                      <InfoWindow position={{ lat, lng }} onCloseClick={() => setActiveInfoWindow(null)}>
                        <div className="p-1.5 min-w-[220px]">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="font-bold text-gray-800 text-sm leading-tight">{login.clientName}</h3>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase flex-shrink-0" style={{ background: color + '22', color }}>
                              {smartOnu?.status?.toUpperCase() || 'ATIVO'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 font-mono">{login.login}</p>
                          {cto && <p className="text-xs mt-1"><strong>CTO:</strong> {cto.caixa} — Porta {login.ftth_porta || 'N/I'}</p>}
                          <p className="text-xs"><strong>Sinal:</strong> <span style={{ color, fontWeight: 600 }}>{login.sinal_ultimo_atendimento as string || 'N/D'}</span></p>
                          {smartOnu && (
                            <div className="mt-1.5 pt-1.5 border-t border-gray-100">
                              <p className="text-[10px]"><strong>SmartOLT SN:</strong> {smartOnu.sn}</p>
                              <p className="text-[10px]"><strong>Tipo ONU:</strong> {smartOnu.onu_type}</p>
                              {smartOnu.last_offline_at && <p className="text-[10px] text-red-500"><strong>Offline em:</strong> {new Date(smartOnu.last_offline_at).toLocaleString('pt-BR')}</p>}
                              <button className="mt-1 text-[9px] px-2 py-0.5 rounded border border-blue-300 text-blue-600 hover:bg-blue-50 w-full"
                                onClick={() => window.open(`https://ncbrasil.smartolt.com/onu/view/${smartOnu.id}`, '_blank')}>
                                Abrir no SmartOLT →
                              </button>
                            </div>
                          )}
                        </div>
                      </InfoWindow>
                    )}
                  </AdvancedMarker>
                  {layers.cables && !isNaN(cLat) && !isNaN(cLng) && (
                    <Polyline points={[{ lat, lng }, { lat: cLat, lng: cLng }]} color={color} weight={2} opacity={0.7} dashed={smartOnu?.status === 'offline'} />
                  )}
                </Frag>
              );
            })}

            {/* ---- Postes ---- */}
            {apiLoaded && layers.postes && postes.map(poste => {
              const lat = parseCoord(poste.latitude); const lng = parseCoord(poste.longitude);
              if (isNaN(lat) || isNaN(lng)) return null;
              return (
                <AdvancedMarker key={poste.id} position={{ lat, lng }} onClick={() => setActiveInfoWindow({ type: 'poste', id: poste.id! })}>
                  <PosteSvg />
                  {activeInfoWindow?.type === 'poste' && activeInfoWindow.id === poste.id && (
                    <InfoWindow position={{ lat, lng }} onCloseClick={() => setActiveInfoWindow(null)}>
                      <div className="p-2">
                        <p className="font-bold text-sm">{poste.descricao || poste.codigo || `Poste ${poste.id}`}</p>
                        <p className="text-xs text-gray-500">Tipo: {poste.tipo || 'N/D'}</p>
                      </div>
                    </InfoWindow>
                  )}
                </AdvancedMarker>
              );
            })}

            {/* ---- POPs ---- */}
            {apiLoaded && layers.pops && pops.map(pop => {
              const lat = parseCoord(pop.latitude); const lng = parseCoord(pop.longitude);
              if (isNaN(lat) || isNaN(lng)) return null;
              return (
                <AdvancedMarker key={pop.id} position={{ lat, lng }} onClick={() => setActiveInfoWindow({ type: 'pop', id: pop.id! })}>
                  <PopSvg />
                  {activeInfoWindow?.type === 'pop' && activeInfoWindow.id === pop.id && (
                    <InfoWindow position={{ lat, lng }} onCloseClick={() => setActiveInfoWindow(null)}>
                      <div className="p-2">
                        <p className="font-bold text-sm">{pop.nome || pop.descricao || `POP ${pop.id}`}</p>
                      </div>
                    </InfoWindow>
                  )}
                </AdvancedMarker>
              );
            })}
            {/* ---- Standalone Clients ---- */}
            {apiLoaded && (layers as any).standalone && standaloneClients.map(client => {
              const lat = parseCoord(client.latitude); const lng = parseCoord(client.longitude);
              if (isNaN(lat) || isNaN(lng)) return null;
              return (
                <AdvancedMarker key={client.id} position={{ lat, lng }} onClick={() => setActiveInfoWindow({ type: 'standalone', id: client.id! })}>
                  <HomeSvg color="#94a3b8" />
                  {activeInfoWindow?.type === 'standalone' && activeInfoWindow.id === client.id && (
                    <InfoWindow position={{ lat, lng }} onCloseClick={() => setActiveInfoWindow(null)}>
                      <div className="p-2 min-w-[200px]">
                        <h3 className="font-bold text-slate-800">{client.razao || client.nome}</h3>
                        <p className="text-xs text-slate-500">ID: {client.id} (Sem login ativo)</p>
                        <p className="text-xs mt-1"><strong>Endereço:</strong> {client.endereco}, {client.numero}</p>
                        <p className="text-xs"><strong>Bairro:</strong> {client.bairro}</p>
                      </div>
                    </InfoWindow>
                  )}
                </AdvancedMarker>
              );
            })}
          </GoogleMap>
        </APIProvider>
      )}

      {/* ===== BOTTOM STATUS BAR ===== */}
      <div className="absolute bottom-3 left-0 right-0 flex justify-center z-20 pointer-events-none">
        <div className="flex items-center gap-4 px-4 py-2 rounded-full text-xs pointer-events-auto"
          style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}>
          <span>🏠 {logins.length} Logins</span>
          <span className="text-white/20">|</span>
          <span>🟢 {ctos.length} CTOs</span>
          {olts.length > 0 && <><span className="text-white/20">|</span><span>📡 {olts.length} OLTs</span></>}
          {techs.length > 0 && <><span className="text-white/20">|</span><span>👷 {techs.filter(t => t.status === 'online').length}/{techs.length} Técnicos</span></>}
        </div>
      </div>
    </div>
  );
};

export default NetworkMap;
