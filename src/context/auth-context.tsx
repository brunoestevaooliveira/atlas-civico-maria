/**
 * @file src/context/auth-context.tsx
 * @fileoverview Provedor de Contexto para Autenticação.
 * @important Ponto chave de arquitetura: Gerenciamento de Estado Global.
 * Este arquivo é um dos mais importantes da aplicação. Ele cria um Contexto React que gerencia
 * o estado de autenticação do usuário, interage com o Firebase Auth e Firestore, e fornece
 * funções (login, logout, registro) e dados (usuário, status de admin, etc.) para toda a
 * árvore de componentes. Isso evita "prop drilling" e centraliza toda a lógica de autenticação.
 */

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { 
    getAuth, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    signInWithPopup,
    GoogleAuthProvider,
    type User 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { AppUser, AppUserData } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

// Chave para o localStorage que marca se o tutorial já foi concluído.
const TUTORIAL_COMPLETED_KEY = 'tutorialCompleted';

/**
 * @interface AuthContextType
 * @description Define a "forma" do nosso contexto: quais valores e funções ele irá fornecer
 * para os componentes que o consumirem.
 */
interface AuthContextType {
  /** O objeto de usuário do Firebase Auth, ou null se não estiver logado. */
  authUser: User | null;
  /** O objeto de usuário personalizado da aplicação (do Firestore), ou null. */
  appUser: AppUser | null;
  /** `true` enquanto o estado de autenticação inicial está sendo verificado. */
  isLoading: boolean;
  /** `true` se o usuário logado tem permissões de administrador. */
  isAdmin: boolean;
  /** `true` se o modal de tutorial deve ser exibido. */
  showTutorial: boolean;
  /** Função para controlar a visibilidade do modal de tutorial. */
  setShowTutorial: (show: boolean) => void;
  /** Função para registrar um novo usuário com email, senha e nome. */
  register: (email: string, pass: string, name: string) => Promise<void>;
  /** Função para fazer login com email e senha. */
  login: (email: string, pass: string) => Promise<void>;
  /** Função para fazer login usando o pop-up do Google. */
  loginWithGoogle: () => Promise<void>;
  /** Função para fazer logout do usuário. */
  logout: () => Promise<void>;
}

// Cria o contexto com um valor inicial `undefined`.
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * @function fetchAppUser
 * @description Busca os dados do perfil do usuário no Firestore.
 * @param {string} uid O ID do usuário.
 * @returns {Promise<AppUser | null>} O objeto AppUser ou null se não for encontrado.
 */
const fetchAppUser = async (uid: string): Promise<AppUser | null> => {
    const userRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
        const data = docSnap.data() as AppUserData;
        
        return {
            ...data,
            // Converte o Timestamp do Firestore para um objeto Date.
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
            issuesReported: data.issuesReported || 0, // Garante que o campo exista
        };
    }
    return null;
}

/**
 * @component AuthProvider
 * @description O componente Provedor que envolve a aplicação e fornece o contexto de autenticação.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const router = useRouter();
  const { toast } = useToast();

  /**
   * @important Ponto chave de funcionamento: `onAuthStateChanged`.
   * Este é o principal listener do Firebase Auth. Ele é disparado sempre que o estado de
   * login do usuário muda (login, logout, token atualizado). É aqui que o estado local
   * (authUser, appUser, isAdmin) é sincronizado com o estado do Firebase.
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsLoading(true);
      if (user) {
        setAuthUser(user);
        
        const isNewUser = user.metadata.creationTime === user.metadata.lastSignInTime;
        const tutorialCompleted = localStorage.getItem(TUTORIAL_COMPLETED_KEY);

        // Mostra o tutorial apenas se for um usuário novo E ele ainda não viu o tutorial.
        if (isNewUser && tutorialCompleted !== 'true') {
            setShowTutorial(true);
        }

        // Busca o perfil do usuário no Firestore para obter o 'role' e outros dados.
        const appProfile = await fetchAppUser(user.uid);
        
        if (appProfile) {
            setAppUser(appProfile);
            // Define o status de admin com base no campo 'role' do documento do Firestore.
            setIsAdmin(appProfile.role === 'admin');
        } else {
            // Se o perfil não existe (ex: primeiro login com Google), cria um novo.
            await handleNewUser(user);
            setIsAdmin(false);
        }

      } else {
        // Se não houver usuário, limpa todos os estados relacionados.
        setAuthUser(null);
        setAppUser(null);
        setIsAdmin(false);
        setShowTutorial(false);
      }
      setIsLoading(false);
    });

    // Função de limpeza que cancela a inscrição do listener ao desmontar o componente.
    return () => unsubscribe();
  }, []);

  /**
   * @function handleNewUser
   * @description Cria um novo documento de usuário no Firestore.
   * Chamado no registro ou no primeiro login com um provedor social.
   * @param {User} user O objeto de usuário do Firebase Auth.
   * @param {string | null} [name] O nome do usuário (opcional).
   */
  const handleNewUser = async (user: User, name?: string | null) => {
    const userRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) { 
        const appProfile = await fetchAppUser(user.uid);
        if (appProfile) {
          setAppUser(appProfile);
          setIsAdmin(appProfile.role === 'admin');
        }
        return;
    }
    
    const newName = name || user.displayName || user.email?.split('@')[0] || 'Usuário';
    
    // Estrutura do documento a ser salvo no Firestore.
    const newUserDocData: AppUserData = {
        uid: user.uid,
        email: user.email,
        name: newName,
        photoURL: user.photoURL,
        role: 'user', // Papel padrão.
        createdAt: serverTimestamp() as Timestamp,
        issuesReported: 0,
    };
    
    await setDoc(userRef, newUserDocData);

    // Atualiza o estado local para refletir o novo usuário imediatamente.
    const newAppUser: AppUser = {
        uid: newUserDocData.uid,
        email: newUserDocData.email,
        name: newUserDocData.name,
        photoURL: newUserDocData.photoURL,
        role: newUserDocData.role,
        createdAt: new Date(),
        issuesReported: newUserDocData.issuesReported,
    };
    setAppUser(newAppUser);
  }

  // Funções de autenticação que serão expostas pelo contexto.
  const register = async (email: string, pass: string, name: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    await handleNewUser(userCredential.user, name);
  };

  const login = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error: any) {
        let description = error.message || 'Não foi possível autenticar com o Google.';
        if (error.code === 'auth/popup-closed-by-user') {
            return;
        }
        
        console.error("Erro no Login com Google:", error);
        toast({
            variant: 'destructive',
            title: 'Falha no Login com Google',
            description: description,
        });
        throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  // Fornece os valores (estado e funções) para os componentes filhos.
  return (
    <AuthContext.Provider value={{ authUser, appUser, isLoading, isAdmin, showTutorial, setShowTutorial, register, login, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * @function useAuth
 * @description Hook customizado para facilitar o consumo do AuthContext.
 * Em vez de usar `useContext(AuthContext)` em cada componente, basta usar `useAuth()`.
 * @returns {AuthContextType} O objeto do contexto de autenticação.
 * @throws {Error} Se for usado fora de um `AuthProvider`.
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
