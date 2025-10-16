/**
 * @file src/components/interactive-map.tsx
 * @fileoverview Componente wrapper que encapsula o mapa principal.
 * @important Ponto chave de arquitetura: Padrão de Encapsulamento.
 * Este componente atua como uma "ponte" entre a página principal (`page.tsx`) e
 * a implementação real do mapa (`Map.tsx`). Ele simplifica a API exposta para a página,
 * recebendo apenas as props essenciais (ocorrências, estilo) e repassando-as.
 * O uso de `forwardRef` é crucial para permitir que o componente pai (a página)
 * controle diretamente a câmera do mapa (ex: `mapRef.current.flyTo(...)`).
 */

'use client';

import { forwardRef } from 'react';
import type { Issue } from '@/lib/types';
import Map from '@/components/map';
import { MapRef } from 'react-map-gl';

interface InteractiveMapProps {
  /** A lista de ocorrências a serem exibidas no mapa. */
  issues: Issue[];
  /** O estilo visual do mapa (ruas ou satélite). */
  mapStyle: 'streets' | 'satellite';
  /** O tema atual da aplicação (claro ou escuro), para estilização do mapa. */
  theme?: string;
}

/**
 * @component InteractiveMap
 * @description Encapsula o componente de mapa, agindo como uma ponte entre a página principal
 * e a implementação do `react-map-gl`.
 * @param {InteractiveMapProps} props As propriedades do componente.
 * @param {React.Ref<MapRef>} ref A referência para o objeto do mapa, permitindo controle externo da câmera.
 */
const InteractiveMap = forwardRef<MapRef, InteractiveMapProps>(({ issues, mapStyle, theme }, ref) => {
  // Coordenadas centrais padrão para o mapa (Santa Maria-DF).
  const center = { lat: -16.0036, lng: -47.9872 };

  return (
    <div className="absolute inset-0 z-0">
      {/* Repassa as propriedades e a referência para o componente de mapa real. */}
      <Map issues={issues} center={center} mapStyle={mapStyle} ref={ref} theme={theme} />
    </div>
  );
});

// Define um nome de exibição para o componente, útil para depuração no React DevTools.
InteractiveMap.displayName = 'InteractiveMap';

export default InteractiveMap;
