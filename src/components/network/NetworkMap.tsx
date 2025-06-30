
import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Navigation, Route, MapPin } from 'lucide-react';

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
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState('');
  const [selectedPoint, setSelectedPoint] = useState<string>('');
  const [routeType, setRouteType] = useState<string>('fastest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDrivers, setShowDrivers] = useState(true);

  // Dados mock dos pontos da rede
  const networkPoints: NetworkPoint[] = [
    {
      id: '1',
      name: 'Torre Central',
      coordinates: [-49.2748, -25.4284],
      type: 'tower',
      status: 'active'
    },
    {
      id: '2',
      name: 'Estação Norte',
      coordinates: [-49.2648, -25.4184],
      type: 'station',
      status: 'active'
    },
    {
      id: '3',
      name: 'Repetidor Sul',
      coordinates: [-49.2848, -25.4384],
      type: 'repeater',
      status: 'maintenance'
    },
    {
      id: '4',
      name: 'Torre Oeste',
      coordinates: [-49.2948, -25.4284],
      type: 'tower',
      status: 'active'
    }
  ];

  // Dados mock dos motoristas
  const drivers: Driver[] = [
    {
      id: '1',
      name: 'João Silva',
      coordinates: [-49.2700, -25.4250],
      vehicle: 'Van - ABC-1234',
      status: 'available'
    },
    {
      id: '2',
      name: 'Maria Santos',
      coordinates: [-49.2800, -25.4300],
      vehicle: 'Caminhão - XYZ-5678',
      status: 'busy'
    }
  ];

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-49.2748, -25.4284], // Curitiba, PR
      zoom: 12
    });

    // Adicionar controles de navegação
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Adicionar controle de geolocalização
    map.current.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true
      }),
      'top-right'
    );

    map.current.on('load', () => {
      // Adicionar pontos da rede
      networkPoints.forEach(point => {
        const el = document.createElement('div');
        el.className = 'network-marker';
        el.style.backgroundImage = getMarkerIcon(point.type, point.status);
        el.style.width = '30px';
        el.style.height = '30px';
        el.style.backgroundSize = 'cover';
        el.style.borderRadius = '50%';
        el.style.cursor = 'pointer';
        el.style.border = `3px solid ${getStatusColor(point.status)}`;

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div class="p-2">
            <h3 class="font-bold">${point.name}</h3>
            <p class="text-sm">Tipo: ${point.type}</p>
            <p class="text-sm">Status: ${point.status}</p>
          </div>
        `);

        new mapboxgl.Marker(el)
          .setLngLat(point.coordinates)
          .setPopup(popup)
          .addTo(map.current!);
      });

      // Adicionar motoristas se habilitado
      if (showDrivers) {
        drivers.forEach(driver => {
          const el = document.createElement('div');
          el.innerHTML = '🚐';
          el.style.fontSize = '20px';
          el.style.cursor = 'pointer';

          const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div class="p-2">
              <h3 class="font-bold">${driver.name}</h3>
              <p class="text-sm">${driver.vehicle}</p>
              <p class="text-sm">Status: ${driver.status}</p>
            </div>
          `);

          new mapboxgl.Marker(el)
            .setLngLat(driver.coordinates)
            .setPopup(popup)
            .addTo(map.current!);
        });
      }
    });

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken, showDrivers]);

  const getMarkerIcon = (type: string, status: string) => {
    // Retornaria diferentes ícones baseados no tipo e status
    return 'url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMzYjgyZjYiLz4KPC9zdmc+Cg==")';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'inactive': return '#ef4444';
      case 'maintenance': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const calculateRoute = () => {
    if (!selectedPoint || !map.current) return;
    
    console.log(`Calculando rota para ${selectedPoint} usando ${routeType}`);
    // Aqui implementaria a lógica de cálculo de rota usando a API do Mapbox Directions
  };

  if (!mapboxToken) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Configurar Mapbox
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Para usar o mapa, insira seu token público do Mapbox:
            </p>
            <Input
              placeholder="pk.eyJ1IjoiZXhhbXBsZSIs..."
              value={mapboxToken}
              onChange={(e) => setMapboxToken(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Obtenha seu token em: <a href="https://mapbox.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">mapbox.com</a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros e Controles */}
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
