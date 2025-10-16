
/**
 * @file src/app/page.tsx
 * @fileoverview Componente principal da página do mapa interativo.
 * Este é o coração da aplicação, onde os principais componentes são orquestrados.
 * Ele gerencia o estado das ocorrências, filtros, busca, e a interação entre o mapa
 * e os painéis de controle e informações.
 */

'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Layers, Search, ThumbsUp, MapPin, Filter, List, PanelRightOpen, PanelRightClose, ExternalLink, Globe, Map as MapIcon, Square, Cuboid, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { listenToIssues, updateIssueUpvotes } from '@/services/issue-service';
import type { Issue } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import Link from 'next/link';
import { MapRef } from 'react-map-gl';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import LazyLoad from '@/components/lazy-load';
import IssueCard from '@/components/issue-card';
import { useDebounce } from 'use-debounce';
import { useTheme } from 'next-themes';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';


// Chave usada para armazenar no localStorage os IDs das ocorrências que o usuário já apoiou.
const UPVOTED_ISSUES_KEY = 'upvotedIssues';
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/**
 * @important Ponto chave de performance: Importação dinâmica do mapa.
 * A função `dynamic` do Next.js garante que o componente `InteractiveMap` só seja
 * carregado no lado do cliente (navegador), pois mapas interativos dependem de APIs
 * do navegador (como `window`) que não existem no ambiente do servidor (SSR).
 */
const InteractiveMap = dynamic(() => import('@/components/interactive-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});


/**
 * @component MapPage
 * @description O componente principal da página, que integra o mapa, controles e a lista de ocorrências.
 */
export default function MapPage() {
  // --- ESTADOS (States) ---

  // Armazena a lista completa de ocorrências recebidas do Firestore.
  const [issues, setIssues] = useState<Issue[]>([]);
  // Armazena um conjunto de IDs das ocorrências que o usuário logado já apoiou.
  const [upvotedIssues, setUpvotedIssues] = useState(new Set<string>());
  // Armazena o texto digitado pelo usuário na barra de busca.
  const [searchQuery, setSearchQuery] = useState('');
  const [geocoderResults, setGeocoderResults] = useState<any[]>([]);
  const [isGeocoderOpen, setIsGeocoderOpen] = useState(false);
  // Versão com "debounce" da busca para evitar re-renderizações excessivas.
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
  // Controla a visibilidade dos marcadores de ocorrências no mapa.
  const [showIssues, setShowIssues] = useState(true);
  // Controla a visibilidade do painel lateral de ocorrências em telas de desktop.
  const [isDesktopPanelOpen, setIsDesktopPanelOpen] = useState(true);
  // Controla o estilo do mapa (ruas ou satélite).
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
  // Referência para o componente do mapa, usada para controlar programaticamente a câmera (zoom, pitch, etc.).
  const mapRef = useRef<MapRef>(null);
  const geocoderRef = useRef<MapboxGeocoder | null>(null);
  const geocoderContainerRef = useRef<HTMLDivElement>(null);


  // --- HOOKS ---
  const { toast } = useToast();
  const { appUser } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();

  // --- INICIALIZAÇÃO DO GEOCODER (Busca de Endereços) ---
  useEffect(() => {
    if (!MAPBOX_TOKEN || geocoderRef.current || !geocoderContainerRef.current) return;
    
    // Inicializa o serviço de geocodificação do Mapbox.
    const geocoder = new MapboxGeocoder({
        accessToken: MAPBOX_TOKEN,
        marker: false, // Não mostra um marcador padrão; nós controlamos isso.
        countries: 'br', 
        language: 'pt-BR',
    });
    
    // Anexa o controle a um container oculto para a API funcionar.
    geocoder.addTo(geocoderContainerRef.current);

    // Ouve os resultados da busca e atualiza o estado.
    geocoder.on('results', (e) => {
        setGeocoderResults(e.features);
        if (e.features.length > 0) {
            setIsGeocoderOpen(true);
        }
    });
    
    // Limpa os resultados quando a busca é limpa.
    geocoder.on('clear', () => {
       setGeocoderResults([]);
       setIsGeocoderOpen(false);
    });

    geocoderRef.current = geocoder;

}, []);


  // --- MEMOS (useMemo) ---

  // Extrai e armazena uma lista de categorias únicas de todas as ocorrências.
  const allCategories = useMemo(() => {
    return [...new Set(issues.map(issue => issue.category))];
  }, [issues]);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  // Efeito que inicializa os filtros com todas as categorias disponíveis no primeiro carregamento.
  useEffect(() => {
    if (allCategories.length > 0) {
      setSelectedCategories(allCategories);
    }
  }, [allCategories]);


  /**
   * @important Otimização de Performance com `useMemo`.
   * Filtra a lista de ocorrências com base nos filtros selecionados. `useMemo` garante
   * que esta operação (potencialmente custosa) só seja reexecutada quando as dependências
   * (`issues` ou `selectedCategories`) mudarem, evitando recálculos em cada renderização.
   */
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(issue.category);
      return categoryMatch;
    });
  }, [issues, selectedCategories]);


  // --- EFEITOS (useEffect) ---
  
  // Dispara a busca do geocoder quando o texto de busca (debounced) muda.
  useEffect(() => {
    if (debouncedSearchQuery.trim() && geocoderRef.current) {
      geocoderRef.current.query(debouncedSearchQuery);
    } else if (!debouncedSearchQuery.trim()) {
       setGeocoderResults([]);
       setIsGeocoderOpen(false);
    }
  }, [debouncedSearchQuery]);

  /**
   * @important Ponto central de dados: Inscrição em tempo real.
   * Este `useEffect` se inscreve para ouvir atualizações da coleção de ocorrências
   * no Firestore. A função `listenToIssues` (do issue-service) estabelece a conexão
   * e o callback `setIssues` atualiza o estado local, fazendo com que a UI reaja
   * automaticamente a novas ocorrências ou mudanças. A função de limpeza (`unsubscribe`)
   * é crucial para evitar memory leaks.
   */
  useEffect(() => {
    const unsubscribe = listenToIssues(setIssues);
    return () => unsubscribe();
  }, []);

  // Carrega os IDs das ocorrências apoiadas pelo usuário do localStorage.
  useEffect(() => {
    if (!appUser) return;
    try {
      const storedUpvotes = localStorage.getItem(`${UPVOTED_ISSUES_KEY}_${appUser.uid}`);
      if (storedUpvotes) {
        setUpvotedIssues(new Set(JSON.parse(storedUpvotes)));
      }
    } catch (error) {
      console.error('Falha ao analisar os apoios do localStorage', error);
    }
  }, [appUser]);

  
  // --- FUNÇÕES AUXILIARES ---

  /**
   * @function handleUpvote
   * @description Lida com a lógica de apoio a uma ocorrência, combinando atualização
   * otimista da UI, chamada ao serviço de backend e persistência local (localStorage).
   */
  const handleUpvote = async (issueId: string, currentUpvotes: number) => {
    if (!appUser) {
        toast({
            variant: 'destructive',
            title: 'Acesso Negado',
            description: 'Você precisa estar logado para apoiar uma ocorrência.',
        });
        return router.push('/login');
    }

    if (upvotedIssues.has(issueId)) return; 
    
    const newUpvotedSet = new Set(upvotedIssues).add(issueId);
    setUpvotedIssues(newUpvotedSet); // Atualização otimista

    try {
      await updateIssueUpvotes(issueId, currentUpvotes + 1); // Chamada de API
       localStorage.setItem(`${UPVOTED_ISSUES_KEY}_${appUser.uid}`, JSON.stringify(Array.from(newUpvotedSet))); // Persistência
    } catch (error) {
       // Reversão em caso de erro
       const revertedUpvotedSet = new Set(upvotedIssues);
       revertedUpvotedSet.delete(issueId);
       setUpvotedIssues(revertedUpvotedSet);

       toast({
        variant: 'destructive',
        title: 'Erro ao apoiar',
        description: 'Não foi possível registrar seu apoio. Tente novamente.',
      });
    }
  };

  /**
   * Manipula a mudança de seleção de uma categoria no filtro.
   * @param category A categoria que foi clicada.
   */
  const handleCategoryChange = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };
  
  // Funções para controlar a câmera do mapa (visão 2D/3D).
  const set3DView = () => mapRef.current?.flyTo({ pitch: 60, bearing: -20, duration: 1500 });
  const set2DView = () => mapRef.current?.flyTo({ pitch: 0, bearing: 0, duration: 1500 });

  // Centraliza o mapa no resultado da busca clicado.
  const handleGeocoderResultClick = (result: any) => {
      const [lng, lat] = result.center;
      mapRef.current?.flyTo({
          center: [lng, lat],
          zoom: 16,
          duration: 1500,
      });
      setSearchQuery(result.place_name);
      setIsGeocoderOpen(false);
  }

  // Componente para o painel de ocorrências recentes.
  const RecentIssuesPanelContent = () => (
      <div className="space-y-4">
        {filteredIssues.length > 0 ? filteredIssues.sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime()).map((issue) => (
            <LazyLoad key={issue.id} placeholderHeight="290px">
              <IssueCard
                  issue={issue}
                  onUpvote={() => handleUpvote(issue.id, issue.upvotes)}
                  isUpvoted={upvotedIssues.has(issue.id)}
              />
            </LazyLoad>
          )) : (
          <p className="text-sm text-center text-muted-foreground py-8">Nenhuma ocorrência encontrada.</p>
        )}
      </div>
  );

  // Componente para os controles do mapa (busca, filtros, etc.).
  const MapControlsContent = () => (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar endereço..."
          className="pl-10 bg-background/80 focus:border-primary"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => { if (geocoderResults.length > 0) setIsGeocoderOpen(true); }}
        />
        {searchQuery && (
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearchQuery('')}>
                <X className="h-4 w-4"/>
            </Button>
        )}
        {isGeocoderOpen && geocoderResults.length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-background border border-border rounded-md shadow-lg z-20">
              <ul className="py-1">
                  {geocoderResults.map((result) => (
                      <li key={result.id} 
                          className="px-3 py-2 text-sm cursor-pointer hover:bg-accent"
                          onClick={() => handleGeocoderResultClick(result)}
                      >
                          {result.place_name}
                      </li>
                  ))}
              </ul>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
            <Switch 
            id="layers-switch-controls" 
            checked={showIssues}
            onCheckedChange={setShowIssues}
            />
            <Label htmlFor="layers-switch-controls">Mostrar Ocorrências</Label>
        </div>
        <div className="flex items-center">
            <TooltipProvider>
               <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setMapStyle(style => style === 'streets' ? 'satellite' : 'streets')}>
                      {mapStyle === 'streets' ? <Globe className="h-5 w-5 text-primary"/> : <MapIcon className="h-5 w-5 text-primary"/>}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                   <p>Mudar para vista {mapStyle === 'streets' ? 'Satélite' : 'Ruas'}</p>
                </TooltipContent>
              </Tooltip>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon">
                      <Layers className="h-5 w-5 text-primary"/>
                      <span className="sr-only">Filtrar Camadas</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64">
                  <div className="space-y-4">
                      <div className="flex items-center gap-2">
                          <Filter className="h-4 w-4"/>
                          <h4 className="font-medium text-sm">Filtrar por Categoria</h4>
                      </div>
                      <div className="space-y-2">
                      {allCategories.map(category => (
                          <div key={category} className="flex items-center space-x-2">
                              <Checkbox
                                  id={`category-${category}`}
                                  checked={selectedCategories.includes(category)}
                                  onCheckedChange={() => handleCategoryChange(category)}
                              />
                              <Label htmlFor={`category-${category}`} className="text-sm font-normal">
                                  {category}
                              </Label>
                          </div>
                      ))}
                      </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Separator orientation="vertical" className="h-6 mx-1" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={set2DView}>
                      <Square className="h-5 w-5 text-primary"/>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Visão de Cima (2D)</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={set3DView}>
                      <Cuboid className="h-5 w-5 text-primary"/>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Visão 3D</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
        </div>
      </div>
    </div>
  );
  

  return (
    <div className="h-screen w-screen flex flex-col pt-0 overflow-hidden" onClick={() => setIsGeocoderOpen(false)}>
      <div ref={geocoderContainerRef} className="hidden"></div>
      <div className="relative flex-grow">
        <InteractiveMap issues={showIssues ? filteredIssues : []} mapStyle={mapStyle} ref={mapRef} theme={theme}/>

        {/* --- Layout de Desktop: Controles à esquerda, painel à direita --- */}
        <div className="absolute top-24 left-4 z-10 hidden md:block w-96 space-y-4">
          <Card className="rounded-lg border border-white/20 bg-white/30 dark:bg-black/30 shadow-lg backdrop-blur-xl">
            <CardContent className="p-4" onClick={(e) => e.stopPropagation()}>
              <MapControlsContent />
            </CardContent>
          </Card>
        </div>

        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-10 w-full max-w-sm md:max-w-md px-4">
          <Card className="rounded-lg border border-white/20 bg-white/30 dark:bg-black/30 shadow-lg backdrop-blur-xl">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="bg-primary/20 text-primary p-2 rounded-full">
                  <MapPin className="h-5 w-5" />
                </div>
                <p className="text-sm md:text-base text-foreground">
                  Clique no mapa para selecionar um local e criar uma ocorrência.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="absolute top-24 right-4 z-10 max-h-[calc(100vh-8rem)] hidden md:block">
          {!isDesktopPanelOpen && (
            <Button size="icon" className="rounded-full shadow-lg" onClick={() => setIsDesktopPanelOpen(true)}>
              <PanelRightClose />
              <span className="sr-only">Abrir painel de ocorrências</span>
            </Button>
          )}
          <div className={cn(
              "transition-all duration-300 ease-in-out",
              isDesktopPanelOpen ? "w-96 opacity-100" : "w-0 opacity-0",
              "overflow-hidden"
            )}>
            <Card className="h-full flex flex-col rounded-lg border border-white/20 bg-white/30 dark:bg-black/30 shadow-lg backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl text-foreground font-headline">Ocorrências Recentes</CardTitle>
                  <CardDescription className="text-muted-foreground">Veja os problemas reportados.</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsDesktopPanelOpen(false)}>
                  <PanelRightOpen />
                  <span className="sr-only">Fechar painel</span>
                </Button>
              </CardHeader>
              <CardContent className="flex-grow p-6 pt-0 overflow-y-auto">
                <RecentIssuesPanelContent />
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* --- Layout Mobile: Botões flutuantes para abrir painéis (Sheets) --- */}
        <div className="absolute top-24 right-4 z-10 md:hidden flex flex-col gap-2">
           <Sheet>
            <SheetTrigger asChild>
                <Button size="icon" className="rounded-full shadow-lg">
                    <List className="h-5 w-5"/>
                    <span className="sr-only">Ver ocorrências</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[75vh] flex flex-col">
                <SheetHeader>
                    <SheetTitle>Ocorrências Recentes</SheetTitle>
                </SheetHeader>
                <div className="flex-grow overflow-y-auto pr-6">
                  <RecentIssuesPanelContent />
                </div>
            </SheetContent>
          </Sheet>
          <Sheet>
            <SheetTrigger asChild>
                <Button size="icon" className="rounded-full shadow-lg">
                    <Filter className="h-5 w-5"/>
                    <span className="sr-only">Abrir filtros</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto flex flex-col">
                <SheetHeader>
                    <SheetTitle>Filtros e Controles</SheetTitle>
                </SheetHeader>
                <div className="p-4">
                  <MapControlsContent />
                </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}
