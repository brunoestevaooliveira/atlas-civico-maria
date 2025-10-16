/**
 * @file src/app/layout.tsx
 * @fileoverview Componente de Layout Raiz da aplicação.
 * Este arquivo define a estrutura HTML base (<html> e <body>) e envolve
 * todo o conteúdo da aplicação com provedores essenciais como o AuthProvider (autenticação),
 * ThemeProvider (tema claro/escuro) e o LayoutContent, que gerencia a lógica de
 * renderização condicional e o roteamento.
 */

'use client';

import { useState, useEffect } from 'react';
import './globals.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/header';
import { cn } from '@/lib/utils';
import SplashScreen from '@/components/splash-screen';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { ThemeProvider } from '@/components/theme-provider';
import TutorialModal from '@/components/tutorial-modal';
import { useTheme } from 'next-themes';


/**
 * @component LayoutContent
 * @description Componente interno que gerencia a lógica de renderização do conteúdo principal.
 * Ele decide o que mostrar com base no estado de autenticação, na rota atual
 * e no estado de carregamento do splash screen. É o "cérebro" do layout.
 * @param {object} props - Propriedades do componente.
 * @param {React.ReactNode} props.children - O conteúdo da página a ser renderizado.
 */
function LayoutContent({ children }: { children: React.ReactNode }) {
  const { appUser, isLoading, showTutorial, setShowTutorial } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Define se a página atual é pública (não requer login).
  const isPublicPage = ['/login', '/register'].includes(pathname);
  // Define se a página atual é a página inicial (onde o splash screen aparece).
  const isSplashPage = pathname === '/';
  
  // Controla a visibilidade do splash screen.
  const [isSplashLoading, setIsSplashLoading] = useState(isSplashPage);
  // Controla a animação de fade-out do splash screen.
  const [isSplashFinishing, setIsSplashFinishing] = useState(false);

  // Efeito para controlar a exibição e remoção do splash screen na página inicial.
  useEffect(() => {
    // Se não estiver na página inicial, garante que o splash não seja exibido.
    if (!isSplashPage) {
      setIsSplashLoading(false);
      return;
    }
    // Timer para iniciar a animação de desaparecimento.
    const finishTimer = setTimeout(() => setIsSplashFinishing(true), 2000);
    // Timer para remover completamente o splash screen do DOM após a animação.
    const removeTimer = setTimeout(() => setIsSplashLoading(false), 3000);
    
    // Limpa os timers se o componente for desmontado.
    return () => {
      clearTimeout(finishTimer);
      clearTimeout(removeTimer);
    };
  }, [isSplashPage]);
  
  // Efeito principal para controle de acesso às rotas (gatekeeper).
  useEffect(() => {
    // Não faz nada enquanto o estado de autenticação está sendo verificado.
    if (isLoading) {
      return; 
    }

    // Se o usuário está logado e tenta acessar uma página pública (login/registro), redireciona para a home.
    if (appUser && isPublicPage) {
        router.push('/');
    } 
    // Se o usuário NÃO está logado e tenta acessar uma página protegida, redireciona para o login.
    else if (!appUser && !isPublicPage) {
        router.push('/login');
    }
  }, [isLoading, appUser, pathname, router, isPublicPage]);

   // Enquanto a autenticação inicial está carregando em uma página protegida,
   // exibe um loading genérico para evitar um "flash" da página de login.
   if (isLoading && !isPublicPage) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        {/* Um spinner ou esqueleto global pode ser colocado aqui. */}
      </div>
    );
  }
  
  // Exibe o splash screen se estiver na página inicial e o estado de loading do splash estiver ativo.
  if (isSplashPage && isSplashLoading) {
    return <SplashScreen isFinishing={isSplashFinishing} />;
  }

  // A condição principal para renderizar o aplicativo:
  // o usuário está autenticado OU está em uma página pública.
  if (appUser || isPublicPage) {
     return (
        <>
          {/* O Header só é exibido em páginas protegidas (não públicas). */}
          {!isPublicPage && <Header />}
          <main>{children}</main>
          <Toaster />
          <TutorialModal isOpen={showTutorial} onOpenChange={setShowTutorial} />
        </>
    );
  }

  // Caso de fallback: se nenhuma das condições acima for atendida, retorna nulo.
  // Isso acontece enquanto o redirecionamento do useEffect está em andamento.
  return null;
}

/**
 * @component RootLayout
 * @description Componente Raiz do Layout. Envolve toda a aplicação com os provedores de contexto
 * essenciais, como Autenticação (AuthProvider) e Tema (ThemeProvider).
 * @param {object} props - Propriedades do componente.
 * @param {React.ReactNode} props.children - Conteúdo da aplicação aninhado.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
       <head>
        <title>Atlas Cívico</title>
        <meta name="description" content="Plataforma cívica para mapeamento e resolução de problemas urbanos em Santa Maria-DF." />
      </head>
      <body className={cn('min-h-screen font-sans antialiased')}>
        {/* Ponto crucial: Injeção dos provedores de contexto que estarão disponíveis em toda a árvore de componentes. */}
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="light">
              <LayoutContent>{children}</LayoutContent>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
