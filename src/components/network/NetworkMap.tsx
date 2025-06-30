
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Navigation, Route, MapPin } from 'lucide-react';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
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

interface Driver {
  id: string;
  name: string;
  coordinates: [number, number];
  vehicle: string;
  status: 'available' | 'busy' | 'offline';
}

const NetworkMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<string>('');
  const [routeType, setRouteType] = useState<string>('fastest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDrivers, setShowDrivers] = useState(true);
  const [currentRoute, setCurrentRoute] = useState<L.Polyline | null>(null);

  // Dados mock dos pontos da rede
  const networkPoints: NetworkPoint[] = [
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
  ];

  // Dados mock dos motoristas
  const drivers: Driver[] = [
    {
      id: '1',
      name: 'João Silva',
      coordinates: [-25.4250, -49.2700],
      vehicle: 'Van - ABC-1234',
      status: 'available'
    },
    {
      id: '2',
      name: 'Maria Santos',
      coordinates: [-25.4300, -49.2800],
      vehicle: 'Caminhão - XYZ-5678',
      status: 'busy'
    }
  ];

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize map
    map.current = L.map(mapContainer.current).setView([-25.4284, -49.2748], 13);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map.current);

    // Add network points
    networkPoints.forEach(point => {
      const icon = createCustomIcon(point.type, point.status);
      
      const marker = L.marker(point.coordinates, { icon })
        .addTo(map.current!)
        .bindPopup(`
          <div class="p-2">
            <h3 class="font-bold">${point.name}</h3>
            <p class="text-sm">Tipo: ${point.type}</p>
            <p class="text-sm">Status: ${point.status}</p>
          </div>
        `);
    });

    // Add drivers if enabled
    if (showDrivers) {
      drivers.forEach(driver => {
        const driverIcon = L.divIcon({
          html: '🚐',
          className: 'driver-marker',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });

        L.marker(driver.coordinates, { icon: driverIcon })
          .addTo(map.current!)
          .bindPopup(`
            <div class="p-2">
              <h3 class="font-bold">${driver.name}</h3>
              <p class="text-sm">${driver.vehicle}</p>
              <p class="text-sm">Status: ${driver.status}</p>
            </div>
          `);
      });
    }

    return () => {
      map.current?.remove();
    };
  }, [showDrivers]);

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
          const start = [latitude, longitude];
          const end = selectedPointData.coordinates;

          try {
            // Use OpenRouteService API (free with registration)
            // For demo purposes, we'll create a simple straight line
            const routeLine = L.polyline([start, end], {
              color: '#3b82f6',
              weight: 4,
              opacity: 0.7
            }).addTo(map.current!);

            setCurrentRoute(routeLine);
            
            // Fit map to show the route
            map.current!.fitBounds(routeLine.getBounds(), { padding: [20, 20] });

            console.log(`Rota calculada para ${selectedPointData.name} usando ${routeType}`);
          } catch (error) {
            console.error('Erro ao calcular rota:', error);
          }
        },
        (error) => {
          console.error('Erro ao obter localização:', error);
          alert('Não foi possível obter sua localização. Verifique as permissões do navegador.');
        }
      );
    } else {
      alert('Geolocalização não suportada pelo navegador.');
    }
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <Select value={routeType} onValueChange={setRouteType}>
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
              <Button onClick={calculateRoute} className="mt-6">
                <Navigation className="w-4 h-4 mr-2" />
                Calcular Rota
              </Button>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              variant={showDrivers ? "default" : "outline"}
              size="sm"
              onClick={() => setShowDrivers(!showDrivers)}
            >
              {showDrivers ? 'Ocultar' : 'Mostrar'} Motoristas
            </Button>
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
              <span className="text-lg">🚐</span>
              <span className="text-sm">Motoristas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">T</div>
              <span className="text-sm">Torre</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">S</div>
              <span className="text-sm">Estação</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center text-white text-xs font-bold">R</div>
              <span className="text-sm">Repetidor</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mapa */}
      <Card>
        <CardContent className="p-0">
          <div ref={mapContainer} className="w-full h-[600px] rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
};

export default NetworkMap;
