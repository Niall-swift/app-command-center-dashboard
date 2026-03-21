import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Navigation,
  Route,
  MapPin,
  Play,
  Square,
  MapPinPlus,
  Signal as SignalIcon,
  RefreshCw,
  Users,
  Server
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/config/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { ixcService } from '@/services/ixc/ixcService';
import { IXCLoginData, IXCCaixaData } from '@/types/ixc';
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

// Interface for static network points
interface NetworkPoint {
  id: string;
  name: string;
  coordinates: [number, number];
  type: 'tower' | 'station' | 'repeater';
  status: 'active' | 'inactive' | 'maintenance';
}

// Interface for technicians
interface Technician {
  id: string;
  name: string;
  coordinates: [number, number];
  email: string;
  lastUpdate: string;
  status: 'online' | 'offline';
}

// Polyline component for Google Maps
const Polyline = (props: { points: google.maps.LatLngLiteral[], color: string, weight: number, opacity: number }) => {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map) return;

    polylineRef.current = new google.maps.Polyline({
      path: props.points,
      geodesic: true,
      strokeColor: props.color,
      strokeOpacity: props.opacity,
      strokeWeight: props.weight,
      icons: [{
        icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 2 },
        offset: '0',
        repeat: '20px'
      }],
      map: map,
    });

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }
    };
  }, [map, props.points, props.color, props.opacity, props.weight]);

  return null;
};

const Frag = ({ children }: { children: React.ReactNode, [key: string]: any }) => <>{children}</>;
const NetworkMap = () => {
  const [selectedPoint, setSelectedPoint] = useState<string>('');
  const [routeType, setRouteType] = useState<string>('fastest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTechnicians, setShowTechnicians] = useState(true);
  const [showOnus, setShowOnus] = useState(true);
  const [showCaixas, setShowCaixas] = useState(true);
  const [showOlts, setShowOlts] = useState(true);
  const [routeCalculated, setRouteCalculated] = useState(false);
  const [rideInProgress, setRideInProgress] = useState(false);
  const [estimatedArrival, setEstimatedArrival] = useState<string>('');
  const [addingPoint, setAddingPoint] = useState(false);
  const [newPointName, setNewPointName] = useState('');
  const [newPointType, setNewPointType] = useState<'tower' | 'station' | 'repeater'>('tower');
  const [newPointStatus, setNewPointStatus] = useState<'active' | 'inactive' | 'maintenance'>('active');
  const [mapStyle, setMapStyle] = useState<'roadmap' | 'satellite' | 'hybrid'>('roadmap');

  const [onuPoints, setOnuPoints] = useState<(IXCLoginData & { clientName?: string; address?: string })[]>([]);
  const [caixas, setCaixas] = useState<IXCCaixaData[]>([]);
  const [smartOnus, setSmartOnus] = useState<SmartOltOnu[]>([]);
  const [olts, setOlts] = useState<SmartOltOlt[]>([]);
  const [smartGps, setSmartGps] = useState<Record<string, { lat: string, lng: string }>>({});
  const [loadingOnus, setLoadingOnus] = useState(false);
  const [loadingCaixas, setLoadingCaixas] = useState(false);
  const [loadingOlts, setLoadingOlts] = useState(false);

  const [activeInfoWindow, setActiveInfoWindow] = useState<{ type: string, id: string } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number, lng: number }>({ lat: -25.4284, lng: -49.2748 });
  const [mapZoom, setMapZoom] = useState(13);

  const [networkPoints, setNetworkPoints] = useState<NetworkPoint[]>([
    { id: '1', name: 'Torre Central', coordinates: [-25.4284, -49.2748], type: 'tower', status: 'active' },
    { id: '2', name: 'Estação Norte', coordinates: [-25.4184, -49.2648], type: 'station', status: 'active' },
    { id: '3', name: 'Repetidor Sul', coordinates: [-25.4384, -49.2848], type: 'repeater', status: 'maintenance' },
    { id: '4', name: 'Torre Oeste', coordinates: [-25.4284, -49.2948], type: 'tower', status: 'active' }
  ]);

  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const { toast } = useToast();

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const isKeyValid = apiKey.startsWith('AIza') && apiKey.length > 20;
  const [apiLoaded, setApiLoaded] = useState(false);

  useEffect(() => {
    const checkGoogle = setInterval(() => {
      if (typeof google !== 'undefined') {
        setApiLoaded(true);
        clearInterval(checkGoogle);
      }
    }, 500);
    return () => clearInterval(checkGoogle);
  }, []);

  // Firestore Listener for Technicians
  useEffect(() => {
    const q = collection(db, 'technicians');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const techs: Technician[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.location && data.location.latitude && data.location.longitude) {
          const lastUpdateDate = new Date(data.lastUpdate);
          const diffMinutes = (new Date().getTime() - lastUpdateDate.getTime()) / 60000;
          techs.push({
            id: doc.id,
            name: data.email ? data.email.split('@')[0] : 'Técnico',
            email: data.email || '',
            coordinates: [data.location.latitude, data.location.longitude],
            lastUpdate: data.lastUpdate,
            status: diffMinutes < 15 ? 'online' : 'offline'
          });
        }
      });
      setTechnicians(techs);
    });
    return () => unsubscribe();
  }, []);

  // Fetch IXC Infrastructure
  useEffect(() => {
    const fetchInfrastructure = async () => {
      setLoadingOnus(true);
      setLoadingCaixas(true);
      setLoadingOlts(true);
      try {
        const [logins, allCaixas, activeClients, smartOltOnus, smartOltOlts, smartOltGps] = await Promise.all([
          ixcService.getLoginsComCoordenadas(),
          ixcService.getCaixasComCoordenadas(),
          ixcService.getClientesAtivos(),
          smartOltService.getOnus(),
          smartOltService.getOlts(),
          smartOltService.getOnuGpsCoordinates()
        ]);

        const clientMap = new Map(activeClients.map(c => [c.id, c]));
        const enrichedLogins = logins.map(login => {
          const client = clientMap.get(login.id_cliente || '');
          return {
            ...login,
            clientName: client ? (client.razao || client.nome) : `Cliente ${login.id_cliente}`,
            address: client ? `${client.endereco}, ${client.bairro}` : (login.endereco as string || 'Não informado')
          };
        });

        setOnuPoints(enrichedLogins);
        setCaixas(allCaixas);
        setSmartOnus(smartOltOnus);
        setOlts(smartOltOlts);
        setSmartGps(smartOltGps);

        if (enrichedLogins.length > 0 || allCaixas.length > 0) {
          const lats = [
            ...enrichedLogins.map(l => parseFloat(String(l.latitude || '').replace(',', '.'))),
            ...allCaixas.map(c => parseFloat(String(c.latitude || '').replace(',', '.')))
          ].filter(l => !isNaN(l));
          const lngs = [
            ...enrichedLogins.map(l => parseFloat(String(l.longitude || '').replace(',', '.'))),
            ...allCaixas.map(c => parseFloat(String(c.longitude || '').replace(',', '.')))
          ].filter(l => !isNaN(l));

          if (lats.length > 0 && lngs.length > 0) {
            setMapCenter({
              lat: (Math.min(...lats) + Math.max(...lats)) / 2,
              lng: (Math.min(...lngs) + Math.max(...lngs)) / 2
            });
          }
        }
      } catch (error) {
        console.error("IXC Fetch Error:", error);
      } finally {
        setLoadingOnus(false);
        setLoadingCaixas(false);
      }
    };
    fetchInfrastructure();
  }, []);

  const addNewPoint = (coordinates: [number, number]) => {
    if (!newPointName.trim()) return;
    const newPoint: NetworkPoint = {
      id: Date.now().toString(),
      name: newPointName,
      coordinates,
      type: newPointType,
      status: newPointStatus
    };
    setNetworkPoints(prev => [...prev, newPoint]);
    setNewPointName('');
    setAddingPoint(false);
    toast({ title: "Ponto adicionado!", description: `${newPoint.name} foi adicionado ao mapa.` });
  };

  const calculateDistance = (start: [number, number], end: [number, number]): number => {
    const R = 6371;
    const dLat = (end[0] - start[0]) * Math.PI / 180;
    const dLon = (end[1] - start[1]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(start[0] * Math.PI / 180) * Math.cos(end[0] * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'inactive': return '#ef4444';
      case 'maintenance': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  return (
    <div className="space-y-4">
      <style>
        {`
          @keyframes pulse-red {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
          }
        `}
      </style>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="w-5 h-5" />
            Controles do Mapa e Infraestrutura
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Buscar Ponto</label>
              <Input
                placeholder="Nome do ponto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Destino</label>
              <Select value={selectedPoint} onValueChange={setSelectedPoint}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um ponto" />
                </SelectTrigger>
                <SelectContent>
                  {networkPoints
                    .filter(point => point.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(point => (
                      <SelectItem key={point.id} value={point.id}>{point.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Tipo de Rota</label>
              <Select value={routeType} onValueChange={setRouteType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fastest">Mais Rápida</SelectItem>
                  <SelectItem value="shortest">Mais Curta</SelectItem>
                  <SelectItem value="traffic">Evitar Trânsito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              {!rideInProgress ? (
                <Button onClick={() => {
                  setRouteCalculated(true);
                  setRideInProgress(true);
                  toast({ title: "Simulação Iniciada", description: "Monitorando rota para " + selectedPoint });
                }} className="mt-6" disabled={!selectedPoint}>
                  <Navigation className="w-4 h-4 mr-2" />
                  Iniciar Rota
                </Button>
              ) : (
                <Button onClick={() => setRideInProgress(false)} variant="destructive" className="mt-6">
                  <Square className="w-4 h-4 mr-2" />
                  Parar Rota
                </Button>
              )}
            </div>

            <div className="flex flex-col justify-end gap-2">
              <Button
                onClick={() => setAddingPoint(!addingPoint)}
                variant={addingPoint ? "destructive" : "outline"}
                className="w-full"
              >
                <MapPinPlus className="w-4 h-4 mr-2" />
                {addingPoint ? 'Cancelar' : 'Adicionar Ponto'}
              </Button>
              <div className="flex gap-1 mt-2">
                <Button variant={mapStyle === 'roadmap' ? "default" : "outline"} size="sm" onClick={() => setMapStyle('roadmap')} className="text-[9px] h-6 px-1">Rua</Button>
                <Button variant={mapStyle === 'satellite' ? "default" : "outline"} size="sm" onClick={() => setMapStyle('satellite')} className="text-[9px] h-6 px-1">Sat</Button>
                <Button variant={mapStyle === 'hybrid' ? "default" : "outline"} size="sm" onClick={() => setMapStyle('hybrid')} className="text-[9px] h-6 px-1">Híb</Button>
              </div>
            </div>
          </div>

          {addingPoint && (
            <div className="mt-4 p-4 border rounded-lg bg-blue-50/50">
              <h3 className="text-sm font-bold text-blue-800 mb-3">Novo Ponto de Rede</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Input value={newPointName} onChange={(e) => setNewPointName(e.target.value)} placeholder="Nome da Torre/Repetidor" />
                </div>
                <div>
                  <Select value={newPointType} onValueChange={(v: any) => setNewPointType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tower">Torre</SelectItem>
                      <SelectItem value="station">Estação</SelectItem>
                      <SelectItem value="repeater">Repetidor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-xs text-blue-600 flex items-center italic">
                  * Clique no mapa para definir a localização
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button variant={showTechnicians ? "default" : "outline"} size="sm" onClick={() => setShowTechnicians(!showTechnicians)}>
              <Users className="w-4 h-4 mr-1" /> {showTechnicians ? 'Ocultar' : 'Ver'} Técnicos
            </Button>
            <Button variant={showOnus ? "default" : "outline"} size="sm" onClick={() => setShowOnus(!showOnus)}>
              {loadingOnus ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <SignalIcon className="w-4 h-4 mr-1" />}
              {showOnus ? 'Ocultar' : 'Ver'} ONUs
            </Button>
            <Button variant={showCaixas ? "default" : "outline"} size="sm" onClick={() => setShowCaixas(!showCaixas)}>
              {loadingCaixas ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <MapPin className="w-4 h-4 mr-1" />}
              {showCaixas ? 'Ocultar' : 'Ver'} CTOs
            </Button>
            <Button variant={showOlts ? "default" : "outline"} size="sm" onClick={() => setShowOlts(!showOlts)}>
              {loadingOlts ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Server className="w-4 h-4 mr-1" />}
              {showOlts ? 'Ocultar' : 'Ver'} OLTs
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="relative w-full h-[600px] rounded-xl overflow-hidden border shadow-inner bg-gray-100 flex items-center justify-center">
        {!isKeyValid ? (
          <div className="text-center p-8 max-w-md">
            <div className="bg-red-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <SignalIcon className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-red-800 mb-2">Chave de API Inválida</h3>
            <p className="text-sm text-gray-600 mb-4">
              A chave atual não parece ser uma chave válida do Google Maps (deve começar com "AIza").
              Por favor, verifique o arquivo .env.local.
            </p>
            <div className="bg-gray-800 text-white p-2 rounded text-[10px] font-mono break-all line-clamp-1">
              {apiKey || 'Nenhuma chave configurada'}
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
                setMapCenter(ev.detail.center);
                setMapZoom(ev.detail.zoom);
              }}
              onClick={(e) => {
                if (addingPoint && e.detail.latLng) {
                  addNewPoint([e.detail.latLng.lat, e.detail.latLng.lng]);
                }
              }}
            >
              {/* Technicians */}
              {apiLoaded && showTechnicians && technicians.map(tech => (
                <AdvancedMarker key={tech.id} position={{ lat: tech.coordinates[0], lng: tech.coordinates[1] }} onClick={() => setActiveInfoWindow({ type: 'tech', id: tech.id })}>
                  <div style={{
                    backgroundColor: tech.status === 'online' ? '#10b981' : '#6b7280',
                    color: 'white', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', fontSize: '10px', fontWeight: 'bold'
                  }}>User</div>
                  {activeInfoWindow?.type === 'tech' && activeInfoWindow.id === tech.id && (
                    <InfoWindow position={{ lat: tech.coordinates[0], lng: tech.coordinates[1] }} onCloseClick={() => setActiveInfoWindow(null)}>
                      <div className="p-2">
                        <h3 className="font-bold">{tech.name}</h3>
                        <p className="text-xs">{tech.email}</p>
                        <Badge variant={tech.status === 'online' ? 'default' : 'secondary'} className="mt-1">{tech.status}</Badge>
                      </div>
                    </InfoWindow>
                  )}
                </AdvancedMarker>
              ))}

              {/* OLTs */}
              {apiLoaded && showOlts && olts.map(olt => {
                // @ts-ignore - a API pode retornar lat/lng se configurado
                const lat = parseFloat(olt.latitude || olt.gps_lat);
                // @ts-ignore
                const lng = parseFloat(olt.longitude || olt.gps_lng);
                
                if (isNaN(lat) || isNaN(lng)) return null;

                return (
                  <Frag key={olt.id}>
                    <AdvancedMarker 
                    position={{ lat, lng }}
                    onClick={() => setActiveInfoWindow({ type: 'olt', id: olt.id })}
                  >
                    <div style={{ 
                      backgroundColor: '#1e3a8a', 
                      color: 'white', 
                      borderRadius: '4px', 
                      padding: '4px',
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      border: '2px solid white', 
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}>
                      <Server className="w-4 h-4" />
                    </div>
                    {activeInfoWindow?.type === 'olt' && activeInfoWindow.id === olt.id && (
                      <InfoWindow position={{ lat, lng }} onCloseClick={() => setActiveInfoWindow(null)}>
                        <div className="p-2 min-w-[200px]">
                          <h3 className="font-bold text-blue-900 border-b pb-1 mb-2 flex items-center gap-2">
                            <Server className="w-4 h-4" /> {olt.name}
                          </h3>
                          <p className="text-xs"><strong>IP:</strong> {olt.ip}</p>
                          <p className="text-xs"><strong>Uptime:</strong> {olt.uptime || 'N/D'}</p>
                          <p className="text-xs"><strong>Temp:</strong> {olt.temperature || 'N/D'}</p>
                          <div className="mt-2 text-[10px] text-gray-400">ID: {olt.id}</div>
                        </div>
                      </InfoWindow>
                    )}
                  </AdvancedMarker>
                </Frag>
              );
            })}

              {/* ONUs */}
              {apiLoaded && showOnus && onuPoints.map(onu => {
                // Tentar encontrar ONU correspondente no SmartOLT
                const smartOnu = smartOnus.find(s => 
                  s.sn === onu.mac || 
                  s.name.includes(onu.login || '') || 
                  s.description.includes(onu.login || '')
                );

                // Prioridade para Coordenadas do SmartOLT (mais precisas)
                let lat = parseFloat(String(onu.latitude || '').replace(',', '.'));
                let lng = parseFloat(String(onu.longitude || '').replace(',', '.'));

                if (smartOnu && smartGps[smartOnu.id]) {
                  const sLat = parseFloat(smartGps[smartOnu.id].lat);
                  const sLng = parseFloat(smartGps[smartOnu.id].lng);
                  if (!isNaN(sLat) && !isNaN(sLng)) {
                    lat = sLat;
                    lng = sLng;
                  }
                }

                if (isNaN(lat) || isNaN(lng)) return null;

                let color = '#3b82f6'; // Padrão Azul
                let statusLabel = 'Ativo';

                // Prioridade para Status do SmartOLT
                if (smartOnu) {
                  if (smartOnu.status === 'online') {
                    color = '#10b981'; // Verde
                    statusLabel = 'Online';
                  } else if (smartOnu.status === 'los') {
                    color = '#ef4444'; // Vermelho (Rompedura)
                    statusLabel = 'LOS (Rompedura)';
                  } else {
                    color = '#f59e0b'; // Laranja (Offline)
                    statusLabel = 'Offline';
                  }
                } else {
                  // Fallback para sinal do IXC se não houver SmartOLT
                  const signal = parseFloat((onu.sinal_ultimo_atendimento || '').replace(/[^-0-9.]/g, ''));
                  if (!isNaN(signal)) {
                    if (signal > -25) color = '#10b981';
                    else if (signal > -28) color = '#f59e0b';
                    else color = '#ef4444';
                  }
                }

                const connectedCaixa = caixas.find(c => c.id === onu.id_caixa_ftth);
                const cLat = connectedCaixa ? parseFloat(String(connectedCaixa.latitude || '').replace(',', '.')) : NaN;
                const cLng = connectedCaixa ? parseFloat(String(connectedCaixa.longitude || '').replace(',', '.')) : NaN;

                return (
                  <Frag key={onu.id}>
                    <AdvancedMarker position={{ lat, lng }} onClick={() => setActiveInfoWindow({ type: 'onu', id: onu.id! })}>
                      <div style={{ 
                        backgroundColor: color, 
                        color: 'white', 
                        borderRadius: '50%', 
                        width: '22px', 
                        height: '22px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        border: '2px solid white', 
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                        animation: smartOnu?.status === 'los' ? 'pulse-red 2s infinite' : 'none'
                      }}>
                        <SignalIcon className="w-3 h-3" />
                      </div>
                      {activeInfoWindow?.type === 'onu' && activeInfoWindow.id === onu.id && (
                        <InfoWindow position={{ lat, lng }} onCloseClick={() => setActiveInfoWindow(null)}>
                          <div className="p-1 min-w-[220px]">
                            <div className="flex justify-between items-start mb-1">
                              <h3 className="font-bold text-blue-700 leading-tight pr-2">{onu.clientName}</h3>
                              <Badge variant={smartOnu?.status === 'online' ? 'default' : 'destructive'} className="text-[8px] h-4">
                                {statusLabel}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-gray-500">{onu.login}</p>
                            
                            <div className="mt-2 space-y-1 border-t border-gray-100 pt-1">
                              <p className="text-[10px]"><strong>Endereço:</strong> {onu.address}</p>
                              <p className="text-[10px]"><strong>Caixa:</strong> {connectedCaixa?.caixa || 'N/I'}</p>
                              
                              {smartOnu ? (
                                <>
                                  <p className="text-[10px]"><strong>SmartOLT SN:</strong> {smartOnu.sn}</p>
                                  <p className="text-[10px]"><strong>Tipo ONU:</strong> {smartOnu.onu_type}</p>
                                  {smartOnu.last_offline_at && (
                                    <p className="text-[10px] text-red-500"><strong>Caiu em:</strong> {new Date(smartOnu.last_offline_at).toLocaleString()}</p>
                                  )}
                                </>
                              ) : (
                                <p className="text-[10px] italic text-gray-400">Dados SmartOLT não vinculados</p>
                              )}
                              
                              <p className="text-xs mt-1">
                                <strong>Sinal:</strong> 
                                <span className="font-bold ml-1" style={{ color }}>
                                  {onu.sinal_ultimo_atendimento || 'N/D'}
                                </span>
                              </p>
                            </div>
                            
                            {!isNaN(cLat) && (
                              <p className="text-[9px] text-gray-400 mt-1 italic">
                                Distância da CTO: {Math.round(calculateDistance([lat, lng], [cLat, cLng]) * 1000)}m
                              </p>
                            )}

                            {smartOnu && (
                              <div className="mt-2 flex gap-1">
                                <Button size="sm" variant="outline" className="h-6 text-[9px] w-full" onClick={() => window.open(`https://api.smartolt.com/onus/${smartOnu.id}`, '_blank')}>
                                  Abrir no SmartOLT
                                </Button>
                              </div>
                            )}
                          </div>
                        </InfoWindow>
                      )}
                    </AdvancedMarker>
                    {showCaixas && !isNaN(cLat) && !isNaN(cLng) && (
                      <Polyline points={[{ lat, lng }, { lat: cLat, lng: cLng }]} color={color} weight={2} opacity={0.6} />
                    )}
                  </Frag>
                );
              })}

              {/* CTOs */}
              {apiLoaded && showCaixas && caixas.map(caixa => {
                const lat = parseFloat(String(caixa.latitude || '').replace(',', '.'));
                const lng = parseFloat(String(caixa.longitude || '').replace(',', '.'));
                if (isNaN(lat) || isNaN(lng)) return null;

                return (
                  <AdvancedMarker key={caixa.id} position={{ lat, lng }} onClick={() => setActiveInfoWindow({ type: 'caixa', id: caixa.id! })}>
                    <div style={{ backgroundColor: '#7c3aed', color: 'white', borderRadius: '4px', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', fontSize: '10px', fontWeight: 'bold' }}>C</div>
                    {activeInfoWindow?.type === 'caixa' && activeInfoWindow.id === caixa.id && (
                      <InfoWindow position={{ lat, lng }} onCloseClick={() => setActiveInfoWindow(null)}>
                        <div className="p-1 min-w-[180px]">
                          <h3 className="font-bold text-purple-700">{caixa.caixa}</h3>
                          <p className="text-xs"><strong>Capacidade:</strong> {caixa.capacidade || 'N/D'}</p>
                          <p className="text-xs"><strong>Ocupação:</strong> {caixa.ocupacao || '0'}</p>
                          <div className="mt-1 pt-1 border-t border-gray-100"><span className="text-[8px] px-1 py-0.5 rounded bg-purple-100 text-purple-700 font-bold uppercase">CTO</span></div>
                        </div>
                      </InfoWindow>
                    )}
                  </AdvancedMarker>
                );
              })}

              {/* Network Points */}
              {apiLoaded && networkPoints.map(point => (
                <AdvancedMarker key={point.id} position={{ lat: point.coordinates[0], lng: point.coordinates[1] }}>
                  <div style={{
                    backgroundColor: getStatusColor(point.status),
                    color: 'white', borderRadius: '50%', width: '24px', height: '24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    fontSize: '12px', fontWeight: 'bold'
                  }}>
                    {point.type.charAt(0).toUpperCase()}
                  </div>
                </AdvancedMarker>
              ))}
            </GoogleMap>
          </APIProvider>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center text-xs">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div><span>Sinal OK</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500"></div><span>Alerta / Offline</span></div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
              <span>Rompedura (LOS)</span>
            </div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-purple-600"></div><span>CTO</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-blue-900 border border-white"></div><span>OLT</span></div>
            <div className="ml-auto flex items-center gap-2 font-bold text-blue-800">
              <SignalIcon className="w-4 h-4" />
              <span>{loadingOnus ? 'Carregando ONUs...' : `Total ONUs: ${onuPoints.length}`}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NetworkMap;
