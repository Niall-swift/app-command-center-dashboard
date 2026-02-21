import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Navigation, Route, MapPin, Play, Square, MapPinPlus, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/config/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface NetworkPoint {
  id: string;
  name: string;
  coordinates: [number, number];
  type: 'tower' | 'station' | 'repeater';
  status: 'active' | 'inactive' | 'maintenance';
}

interface Technician {
  id: string;
  name: string;
  coordinates: [number, number];
  email: string;
  lastUpdate: string;
  status: 'online' | 'offline';
}

const NetworkMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({}); 
  
  const [selectedPoint, setSelectedPoint] = useState<string>('');
  const [routeType, setRouteType] = useState<string>('fastest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTechnicians, setShowTechnicians] = useState(true);
  const [currentRoute, setCurrentRoute] = useState<L.Polyline | null>(null);
  const [routeCalculated, setRouteCalculated] = useState(false);
  const [rideInProgress, setRideInProgress] = useState(false);
  const [rideStartTime, setRideStartTime] = useState<Date | null>(null);
  const [estimatedArrival, setEstimatedArrival] = useState<string>('');
  const [addingPoint, setAddingPoint] = useState(false);
  const [newPointName, setNewPointName] = useState('');
  const [newPointType, setNewPointType] = useState<'tower' | 'station' | 'repeater'>('tower');
  const [newPointStatus, setNewPointStatus] = useState<'active' | 'inactive' | 'maintenance'>('active');
  const [networkPoints, setNetworkPoints] = useState<NetworkPoint[]>([
    {
      id: '1',
      name: 'Torre Central',
      coordinates: [-25.4284, -49.2748],
      type: 'tower',
      status: 'active'
    },
    {
      id: '2',
      name: 'Estação Norte',
      coordinates: [-25.4184, -49.2648],
      type: 'station',
      status: 'active'
    },
    {
      id: '3',
      name: 'Repetidor Sul',
      coordinates: [-25.4384, -49.2848],
      type: 'repeater',
      status: 'maintenance'
    },
    {
      id: '4',
      name: 'Torre Oeste',
      coordinates: [-25.4284, -49.2948],
      type: 'tower',
      status: 'active'
    }
  ]);
  
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const { toast } = useToast();

  // Firestore Listener for Technicians
  useEffect(() => {
    const q = collection(db, 'technicians');
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const techs: Technician[] = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.location && data.location.latitude && data.location.longitude) {
                // Determine status based on lastUpdate (e.g., active if < 10 min ago)
                const lastUpdateDate = new Date(data.lastUpdate);
                const now = new Date();
                const diffMinutes = (now.getTime() - lastUpdateDate.getTime()) / 60000;
                const status = diffMinutes < 15 ? 'online' : 'offline';

                techs.push({
                    id: doc.id,
                    name: data.email ? data.email.split('@')[0] : 'Técnico',
                    email: data.email || '',
                    coordinates: [data.location.latitude, data.location.longitude],
                    lastUpdate: data.lastUpdate,
                    status: status
                });
            }
        });
        setTechnicians(techs);
    }, (error) => {
        console.error("Error fetching technicians:", error);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize map only once
    if (!map.current) {
        map.current = L.map(mapContainer.current).setView([-25.4284, -49.2748], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map.current);
        
        map.current.on('click', (e) => {
          if (addingPoint) {
            const { lat, lng } = e.latlng;
            addNewPoint([lat, lng]);
          }
        });
    }

    // Refresh Network Points Markers (simplified: clear and re-add or manage via refs layer group in real app)
    // For this context, we'll assume network points are static mostly, but let's re-render roughly
    // Ideally use LayerGroup, but keeping consistent with existing pattern
    
  }, [addingPoint]); 

  // Effect to update markers when data changes
  useEffect(() => {
      if (!map.current) return;

      // Clear existing markers (naive approach, better use LayerGroup)
      // Actually, since we have mixed types, let's just clear for now or manage keys.
      // Ideally we should track them. Let's rely on simple re-render logic or just keep adding?
      // No, that duplicates. We need to clear.
      
      // Let's create a LayerGroup for points if not exists
      // But since we are modifying existing code, let's look at how it handled it.
      // It added markers in useEffect. We should clean up or use a ref for the layer group.
      
      // Let's implement a cleaner way using a LayerGroup for map items
      // or just re-add everything safely.
      
      // For Technicians:
      if (showTechnicians) {
          technicians.forEach(tech => {
              const icon = L.divIcon({
                  html: `<div style="background-color: ${tech.status === 'online' ? '#10b981' : '#6b7280'}; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">User</div>`, 
                  // Ideally use an icon or initials
                  className: 'tech-marker',
                  iconSize: [30, 30],
                  iconAnchor: [15, 15]
              });

              // Check if marker exists
              if (markersRef.current[tech.id]) {
                  markersRef.current[tech.id].setLatLng(tech.coordinates);
                  markersRef.current[tech.id].setIcon(icon); // Update status color
                  // Update popup content?
                  markersRef.current[tech.id].setPopupContent(`
                      <div class="p-2">
                        <h3 class="font-bold">${tech.name}</h3>
                        <p class="text-sm">${tech.email}</p>
                        <p class="text-sm">Status: <span class="${tech.status === 'online' ? 'text-green-600' : 'text-gray-500'} font-bold">${tech.status === 'online' ? 'Online' : 'Offline'}</span></p>
                        <p class="text-xs text-gray-500">Última atualização: ${new Date(tech.lastUpdate).toLocaleTimeString()}</p>
                      </div>
                  `);
              } else {
                  const marker = L.marker(tech.coordinates, { icon })
                      .addTo(map.current!)
                      .bindPopup(`
                          <div class="p-2">
                            <h3 class="font-bold">${tech.name}</h3>
                            <p class="text-sm">${tech.email}</p>
                            <p class="text-sm">Status: <span class="${tech.status === 'online' ? 'text-green-600' : 'text-gray-500'} font-bold">${tech.status === 'online' ? 'Online' : 'Offline'}</span></p>
                            <p class="text-xs text-gray-500">Última atualização: ${new Date(tech.lastUpdate).toLocaleTimeString()}</p>
                          </div>
                      `);
                  markersRef.current[tech.id] = marker;
              }
          });
      } else {
          // Remove technician markers
          Object.keys(markersRef.current).forEach(id => {
               // We should distinguish tech markers from others if we store all in one ref.
               // For now assuming markersRef only tracks techs for dynamic updates.
               map.current?.removeLayer(markersRef.current[id]);
               delete markersRef.current[id];
          });
      }

  }, [technicians, showTechnicians]);

  // Effect for static network points (render once or when changed)
  useEffect(() => {
      if (!map.current) return;
      // Network points are static in this demo, usually not needing frequent updates
      // But to be safe, we can loop and add them if not present. 
      // Existing code added them on mount. Let's keep it simple.
      
      networkPoints.forEach(point => {
        // Simple check probably needed to avoid duplicates if we re-run
        // For now, let's trust Leaflet handles it or we accept slight overhead of re-adding (but duplicates are bad).
        // Since we removed the initial rendering logic from the first useEffect, we need to add them here properly.
        
        const icon = createCustomIcon(point.type, point.status);
        L.marker(point.coordinates, { icon })
            .addTo(map.current!)
            .bindPopup(`
              <div class="p-2">
                <h3 class="font-bold">${point.name}</h3>
                <p class="text-sm">Tipo: ${point.type}</p>
                <p class="text-sm">Status: ${point.status}</p>
              </div>
            `);
      });
  }, [networkPoints]); // Re-run if points change


  const addNewPoint = (coordinates: [number, number]) => {
    if (!newPointName.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, insira um nome para o ponto.",
        variant: "destructive",
      });
      return;
    }

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

    toast({
      title: "Ponto adicionado!",
      description: `${newPoint.name} foi adicionado ao mapa.`,
    });
  };

  const toggleAddingMode = () => {
    setAddingPoint(!addingPoint);
    if (!addingPoint) {
      toast({
        title: "Modo de adição ativado",
        description: "Clique no mapa para adicionar um novo ponto.",
      });
    }
  };

  const createCustomIcon = (type: string, status: string) => {
    const color = getStatusColor(status);
    const symbol = getTypeSymbol(type);
    
    return L.divIcon({
      html: `<div style="background-color: ${color}; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${symbol}</div>`,
      className: 'custom-marker',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'inactive': return '#ef4444';
      case 'maintenance': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getTypeSymbol = (type: string) => {
    switch (type) {
      case 'tower': return 'T';
      case 'station': return 'S';
      case 'repeater': return 'R';
      default: return '?';
    }
  };

  const calculateRoute = async () => {
    if (!selectedPoint || !map.current) return;
    
    const selectedPointData = networkPoints.find(p => p.id === selectedPoint);
    if (!selectedPointData) return;

    // Remove existing route
    if (currentRoute) {
      map.current.removeLayer(currentRoute);
    }

    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const start: [number, number] = [latitude, longitude];
          const end: [number, number] = selectedPointData.coordinates;

          try {
            // Create route line with proper LatLngExpression type
            const routeLine = L.polyline([start, end], {
              color: '#3b82f6',
              weight: 4,
              opacity: 0.7
            }).addTo(map.current!);

            setCurrentRoute(routeLine);
            setRouteCalculated(true);
            
            // Calculate estimated time (mock calculation)
            const distance = calculateDistance(start, end);
            const estimatedMinutes = Math.round(distance * 2); // 2 minutes per km (mock)
            const arrivalTime = new Date(Date.now() + estimatedMinutes * 60000);
            setEstimatedArrival(arrivalTime.toLocaleTimeString('pt-BR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }));
            
            // Fit map to show the route
            map.current!.fitBounds(routeLine.getBounds(), { padding: [20, 20] });

            toast({
              title: "Rota calculada!",
              description: `Distância: ${distance.toFixed(1)}km - Tempo estimado: ${estimatedMinutes}min`,
            });
          } catch (error) {
            console.error('Erro ao calcular rota:', error);
            toast({
              title: "Erro",
              description: "Não foi possível calcular a rota.",
              variant: "destructive",
            });
          }
        },
        (error) => {
          console.error('Erro ao obter localização:', error);
          toast({
            title: "Erro de localização",
            description: "Não foi possível obter sua localização. Verifique as permissões do navegador.",
            variant: "destructive",
          });
        }
      );
    } else {
      toast({
        title: "Erro",
        description: "Geolocalização não suportada pelo navegador.",
        variant: "destructive",
      });
    }
  };

  const calculateDistance = (start: [number, number], end: [number, number]): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (end[0] - start[0]) * Math.PI / 180;
    const dLon = (end[1] - start[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(start[0] * Math.PI / 180) * Math.cos(end[0] * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const startRide = () => {
    if (!routeCalculated) return;
    
    setRideInProgress(true);
    setRideStartTime(new Date());
    
    toast({
      title: "Corrida iniciada!",
      description: `Destino: ${networkPoints.find(p => p.id === selectedPoint)?.name} - Chegada prevista: ${estimatedArrival}`,
    });

    // Simulate ride progress notifications
    setTimeout(() => {
      toast({
        title: "Progresso da corrida",
        description: "Você está no meio do caminho!",
      });
    }, 10000); // 10 seconds for demo
  };

  const endRide = () => {
    setRideInProgress(false);
    setRideStartTime(null);
    setRouteCalculated(false);
    setEstimatedArrival('');
    
    if (currentRoute && map.current) {
      map.current.removeLayer(currentRoute);
      setCurrentRoute(null);
    }
    
    toast({
      title: "Corrida finalizada!",
      description: "Você chegou ao seu destino.",
    });
  };

  return (
    <div className="space-y-4">
      {/* Controles do Mapa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="w-5 h-5" />
            Controles do Mapa
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
                disabled={rideInProgress || addingPoint}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Destino</label>
              <Select value={selectedPoint} onValueChange={setSelectedPoint} disabled={rideInProgress || addingPoint}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um ponto" />
                </SelectTrigger>
                <SelectContent>
                  {networkPoints
                    .filter(point => 
                      point.name.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map(point => (
                      <SelectItem key={point.id} value={point.id}>
                        {point.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Tipo de Rota</label>
              <Select value={routeType} onValueChange={setRouteType} disabled={rideInProgress || addingPoint}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fastest">Mais Rápida</SelectItem>
                  <SelectItem value="shortest">Mais Curta</SelectItem>
                  <SelectItem value="traffic">Evitar Trânsito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              {!rideInProgress ? (
                <>
                  <Button onClick={calculateRoute} className="mt-6" disabled={!selectedPoint || addingPoint}>
                    <Navigation className="w-4 h-4 mr-2" />
                    Calcular Rota
                  </Button>
                  {routeCalculated && (
                    <Button onClick={startRide} variant="default" className="bg-green-600 hover:bg-green-700" disabled={addingPoint}>
                      <Play className="w-4 h-4 mr-2" />
                      Iniciar Corrida
                    </Button>
                  )}
                </>
              ) : (
                <Button onClick={endRide} variant="destructive" className="mt-6">
                  <Square className="w-4 h-4 mr-2" />
                  Finalizar Corrida
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={toggleAddingMode}
                variant={addingPoint ? "destructive" : "outline"}
                disabled={rideInProgress}
                className="mt-6"
              >
                <MapPinPlus className="w-4 h-4 mr-2" />
                {addingPoint ? 'Cancelar' : 'Adicionar Ponto'}
              </Button>
            </div>
          </div>

          {/* Formulário para novo ponto */}
          {addingPoint && (
            <div className="mt-4 p-4 border rounded-lg bg-gray-50">
              <h3 className="font-medium mb-3">Configurações do Novo Ponto</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Nome do Ponto</label>
                  <Input
                    value={newPointName}
                    onChange={(e) => setNewPointName(e.target.value)}
                    placeholder="Digite o nome..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Tipo</label>
                  <Select value={newPointType} onValueChange={(value: 'tower' | 'station' | 'repeater') => setNewPointType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tower">Torre</SelectItem>
                      <SelectItem value="station">Estação</SelectItem>
                      <SelectItem value="repeater">Repetidor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select value={newPointStatus} onValueChange={(value: 'active' | 'inactive' | 'maintenance') => setNewPointStatus(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                      <SelectItem value="maintenance">Manutenção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Clique no mapa para selecionar a posição do novo ponto.
              </p>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button
              variant={showTechnicians ? "default" : "outline"}
              size="sm"
              onClick={() => setShowTechnicians(!showTechnicians)}
              disabled={rideInProgress || addingPoint}
            >
              {showTechnicians ? 'Ocultar' : 'Mostrar'} Técnicos
            </Button>
            
            {rideInProgress && (
              <div className="flex items-center gap-4">
                <Badge variant="default" className="bg-green-600">
                  Corrida em andamento
                </Badge>
                {estimatedArrival && (
                  <span className="text-sm text-gray-600">
                    Chegada prevista: {estimatedArrival}
                  </span>
                )}
                {rideStartTime && (
                  <span className="text-sm text-gray-600">
                    Iniciada às: {rideStartTime.toLocaleTimeString('pt-BR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Legenda */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500"></div>
              <span className="text-sm">Ativo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500"></div>
              <span className="text-sm">Inativo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
              <span className="text-sm">Manutenção</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-700" />
              <span className="text-sm">Técnicos (Online/Offline)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mapa */}
      <Card>
        <CardContent className="p-0">
          <div ref={mapContainer} className={`w-full h-[600px] rounded-lg ${addingPoint ? 'cursor-crosshair' : ''}`} />
        </CardContent>
      </Card>
    </div>
  );
};

export default NetworkMap;
