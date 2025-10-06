

'use client';

import type { Issue } from '@/lib/types';
import { useState, useMemo, forwardRef } from 'react';
import { useRouter } from 'next/navigation';
import Map, { Marker, Popup, NavigationControl, GeolocateControl, MapLayerMouseEvent, MapRef } from 'react-map-gl';
import { supported } from 'mapbox-gl';
import { Loader2, MapPin } from 'lucide-react';
import useSupercluster from 'use-supercluster';
import type { PointFeature } from 'supercluster';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';


if (!supported()) {
  console.error("Mapbox GL not supported by this browser.");
}
interface NewIssueLocation {
  lat: number;
  lng: number;
  address: string;
}

interface MapComponentProps {
  issues: Issue[];
  center: { lat: number; lng: number };
  mapStyle: 'streets' | 'satellite';
  theme?: string;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const MapComponent = forwardRef<MapRef, MapComponentProps>(({ issues, center, mapStyle, theme }, ref) => {
  const router = useRouter();
  const [popupInfo, setPopupInfo] = useState<Issue | null>(null);
  const [newIssueLocation, setNewIssueLocation] = useState<NewIssueLocation | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  
  const [zoom, setZoom] = useState(13);
  const [bounds, setBounds] = useState<[number, number, number, number] | undefined>();

  const points: PointFeature<{ cluster: false; issue: Issue }>[] = useMemo(() => issues.map(issue => ({
      type: 'Feature',
      properties: {
        cluster: false,
        issue: issue,
      },
      geometry: {
        type: 'Point',
        coordinates: [issue.location.lng, issue.location.lat],
      },
  })), [issues]);

  const { clusters, supercluster } = useSupercluster({
    points,
    bounds,
    zoom,
    options: { radius: 75, maxZoom: 20 },
  });

  const handleMapClick = async (event: MapLayerMouseEvent) => {
    // Fecha qualquer popup de ocorrência existente antes de criar um novo ponto.
    if (popupInfo) {
      setPopupInfo(null);
    }
    
    setGeocoding(true);
    const { lng, lat } = event.lngLat;
    
    const map = (ref as React.RefObject<MapRef>)?.current;
    if (map) {
      map.flyTo({ center: [lng, lat], duration: 1500, zoom: Math.max(map.getZoom(), 16) });
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}`
      );
      const data = await response.json();
      
      const address = data.features[0]?.place_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      
      setNewIssueLocation({ lat, lng, address });

    } catch (error) {
      console.error("Erro na geocodificação:", error);
      setNewIssueLocation({ lat, lng, address: 'Endereço não encontrado' });
    } finally {
      setGeocoding(false);
    }
  };

  const handleConfirmLocation = () => {
    if (!newIssueLocation) return;
    const { lat, lng, address } = newIssueLocation;
    router.push(`/report?lat=${lat}&lng=${lng}&address=${encodeURIComponent(address)}`);
    setNewIssueLocation(null);
  };

  const mapStyleUrl = useMemo(() => {
    if (mapStyle === 'satellite') {
      return 'mapbox://styles/mapbox/satellite-streets-v12';
    }
    if (theme === 'dark') {
      return 'mapbox://styles/mapbox/dark-v11';
    }
    return 'mapbox://styles/mapbox/streets-v12';
  }, [mapStyle, theme]);

  const getPinColor = (status: Issue['status']): string => {
    switch (status) {
      case 'Resolvido':
        return 'text-green-500';
      case 'Em análise':
        return 'text-yellow-500';
      case 'Recebido':
      default:
        return 'text-sky-500';
    }
  };
  
  const getStatusVariant = (status: Issue['status']): "success" | "warning" | "info" => {
    switch (status) {
      case 'Resolvido':
        return 'success';
      case 'Em análise':
        return 'warning';
      case 'Recebido':
      default:
        return 'info';
    }
  };

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-red-100 text-red-800">
        Erro: A variável de ambiente NEXT_PUBLIC_MAPBOX_TOKEN não está configurada.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Map
        ref={ref}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: center.lng,
          latitude: center.lat,
          zoom: 13,
          pitch: 0,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyleUrl}
        onClick={handleMapClick}
        onMoveEnd={(e) => {
          setZoom(e.viewState.zoom);
          const mapInstance = e.target;
          if (mapInstance?.getBounds) {
            const bounds = mapInstance.getBounds();
            if (bounds) {
              setBounds(bounds.toArray().flat() as [number, number, number, number]);
            }
          }
      }}
        cursor={geocoding ? 'wait' : 'crosshair'}
      >
        <GeolocateControl position="top-left" />
        <NavigationControl position="top-left" />

        {clusters.map(cluster => {
            const properties = cluster.properties as {
              cluster?: boolean;
              point_count?: number;
              issue?: Issue;
            };
            const [longitude, latitude] = cluster.geometry.coordinates as [number, number];

            if (properties.cluster) {
                const pointCount = properties.point_count ?? 0;
                
                return (
                    <Marker key={`cluster-${cluster.id}`} latitude={latitude} longitude={longitude}>
                        <div
                            className="w-8 h-8 bg-primary/80 text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm cursor-pointer border-2 border-white/50 shadow-md hover:scale-110 transition-transform"
                            onClick={(e) => {
                                e.stopPropagation();
                                const map = (ref as React.RefObject<MapRef>)?.current;
                                if (!supercluster || !map) return;
                                const expansionZoom = Math.min(
                                    supercluster.getClusterExpansionZoom(cluster.id as number),
                                    20
                                );
                                  map.flyTo({
                                      center: [longitude, latitude],
                                      duration: 800,
                                      zoom: expansionZoom,
                                  });
                            }}
                        >
                            {pointCount}
                        </div>
                    </Marker>
                );
            }

            const issue = properties.issue;
            if (!issue) return null;

            return (
                <Marker
                    key={`issue-${issue.id}`}
                    latitude={latitude}
                    longitude={longitude}
                >
                    <button onClick={(e) => {
                        e.stopPropagation();
                        setNewIssueLocation(null);
                        setPopupInfo(issue);
                        const map = (ref as React.RefObject<MapRef>)?.current;
                        if (map) {
                          map.flyTo({ center: [longitude, latitude], duration: 1500, zoom: Math.max(map.getZoom(), 15) });
                        }
                    }} className="transform hover:scale-125 transition-transform duration-200 ease-in-out">
                        <MapPin className={cn("h-8 w-8 fill-current drop-shadow-lg", getPinColor(issue.status))} />
                    </button>
                </Marker>
            );
        })}
        
        {newIssueLocation && (
          <>
            <Marker 
              latitude={newIssueLocation.lat} 
              longitude={newIssueLocation.lng}
            >
               <MapPin className="h-8 w-8 text-green-500 fill-current drop-shadow-lg" />
            </Marker>
            <Popup
              longitude={newIssueLocation.lng}
              latitude={newIssueLocation.lat}
              onClose={() => setNewIssueLocation(null)}
              closeOnClick={false}
              anchor="bottom"
              offset={-15}
            >
              <div className="p-1 max-w-xs space-y-2">
                <h3 className="font-bold text-base text-foreground">Confirmar Local</h3>
                <p className="text-muted-foreground text-sm">{newIssueLocation.address}</p>
                <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setNewIssueLocation(null)}>
                        Cancelar
                    </Button>
                    <Button size="sm" onClick={handleConfirmLocation}>
                        Reportar aqui
                    </Button>
                </div>
              </div>
            </Popup>
          </>
        )}

        {popupInfo && (
          <Popup
            longitude={popupInfo.location.lng}
            latitude={popupInfo.location.lat}
            onClose={() => setPopupInfo(null)}
            closeOnClick={false}
            anchor="bottom"
            offset={-15}
          >
            <div className="p-1 max-w-xs space-y-1">
              <div className="flex justify-between items-start">
                  <h3 className="font-bold text-base text-foreground">{popupInfo.title}</h3>
                  <Badge variant={getStatusVariant(popupInfo.status)} className="ml-2 flex-shrink-0">{popupInfo.status}</Badge>
              </div>
              <p className="text-primary text-sm font-semibold">{popupInfo.category}</p>
              <p className="text-muted-foreground text-xs mt-1">{popupInfo.address}</p>
            </div>
          </Popup>
        )}
      </Map>

      {geocoding && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-20">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}
    </div>
  );
});

MapComponent.displayName = 'MapComponent';

export default MapComponent;
