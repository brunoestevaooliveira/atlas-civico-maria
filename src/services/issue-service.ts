/**
 * @file src/services/issue-service.ts
 * @fileoverview Camada de Serviço para Ocorrências (Issues).
 * @important Ponto chave de arquitetura: Abstração do Backend.
 * Este arquivo centraliza toda a lógica de comunicação com o Firestore para a coleção 'issues'.
 * Ao criar esta camada de serviço, desacoplamos a lógica de negócios (o que a aplicação faz)
 * da lógica de dados (como os dados são salvos/lidos). Se no futuro decidirmos trocar o
 * Firestore por outro banco de dados, só precisaremos modificar este arquivo, e o resto da
 * aplicação continuará funcionando sem alterações.
 */

'use client';

import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp,
  GeoPoint,
  serverTimestamp,
  getDocs,
  arrayUnion,
  getDoc,
  increment,
  arrayRemove,
} from 'firebase/firestore';
import type { Issue, IssueData, CommentData, AppUser, Comment } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';


/**
 * @function fromFirestore
 * @description Converte um documento do Firestore (IssueData) para um objeto de domínio (Issue).
 * Essa transformação é importante para adaptar os tipos de dados do backend (ex: Timestamp, GeoPoint)
 * para formatos mais fáceis de usar no frontend (ex: Date, {lat, lng}).
 * @param {any} docData Os dados brutos do documento do Firestore.
 * @param {string} id O ID do documento.
 * @returns {Issue} O objeto de ocorrência formatado para uso na UI.
 */
const fromFirestore = (docData: any, id: string): Issue => {
  const data = docData as IssueData;
  return {
    id,
    title: data.title,
    description: data.description,
    category: data.category,
    status: data.status,
    location: {
      lat: data.location.latitude,
      lng: data.location.longitude,
    },
    address: data.address,
    imageUrl: data.imageUrl,
    reportedAt: data.reportedAt ? (data.reportedAt as Timestamp).toDate() : new Date(),
    reporter: data.reporter,
    reporterId: data.reporterId,
    upvotes: data.upvotes || 0,
    // Converte os Timestamps dos comentários para Datas e os ordena.
    comments: (data.comments || []).map(comment => ({
      ...comment,
      createdAt: (comment.createdAt as Timestamp).toDate(),
    })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  };
};

/**
 * Tipo para os dados de uma nova ocorrência sendo criada.
 */
export type NewIssue = {
  title: string;
  description: string;
  category: string;
  location: { lat: number; lng: number };
  address: string;
  reporter: string;
  reporterId: string;
};

/**
 * @function addIssueClient
 * @description Adiciona uma nova ocorrência ao Firestore. Chamada pelo lado do cliente.
 * @param {NewIssue} issue O objeto da nova ocorrência.
 * @returns {Promise<string>} O ID do documento recém-criado.
 */
export async function addIssueClient(issue: NewIssue) {
  // Validação dos dados de entrada.
  if (!issue.title?.trim()) throw new Error("Título obrigatório");
  if (!issue.description?.trim()) throw new Error("Descrição obrigatória");
  if (!issue.address?.trim()) throw new Error("Endereço obrigatório");
  if (!issue.reporterId) throw new Error("ID do relator é obrigatório");
  if (
    typeof issue.location?.lat !== "number" ||
    typeof issue.location?.lng !== "number" ||
    Number.isNaN(issue.location.lat) ||
    Number.isNaN(issue.location.lng)
  ) {
    throw new Error("Localização inválida");
  }

  const ref = collection(db, "issues");
  
  // Cria o payload para o Firestore, convertendo os tipos de dados conforme necessário.
  const payload: Omit<IssueData, 'reportedAt'> & { reportedAt: any } = {
    title: issue.title.trim(),
    description: issue.description.trim(),
    category: issue.category || "Outros",
    status: "Recebido", // Status inicial padrão.
    upvotes: 0,
    reporter: issue.reporter,
    reporterId: issue.reporterId,
    address: issue.address.trim(),
    imageUrl: `https://placehold.co/600x400.png?text=${encodeURIComponent(issue.title)}`,
    reportedAt: serverTimestamp(), // Usa o timestamp do servidor para consistência.
    location: new GeoPoint(issue.location.lat, issue.location.lng), // Converte para GeoPoint.
    comments: [], // Inicializa com um array de comentários vazio.
  };

  const docRef = await addDoc(ref, payload);

  // Ação secundária: incrementa o contador de ocorrências do usuário.
  const userRef = doc(db, "users", issue.reporterId);
  await updateDoc(userRef, {
    issuesReported: increment(1)
  });

  return docRef.id;
}

/**
 * @function getIssues
 * @description Busca todas as ocorrências do Firestore uma única vez (não em tempo real).
 * @returns {Promise<Issue[]>} Uma lista de todas as ocorrências.
 */
export const getIssues = async (): Promise<Issue[]> => {
  const q = query(collection(db, 'issues'), orderBy('reportedAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => fromFirestore(doc.data() as IssueData, doc.id));
};

/**
 * @function listenToIssues
 * @description Inscreve-se para ouvir atualizações em tempo real da coleção de ocorrências.
 * Esta é a principal função para manter a UI sincronizada com o banco de dados.
 * @param {(issues: Issue[]) => void} callback A função a ser chamada com a lista de ocorrências sempre que houver uma atualização.
 * @returns {() => void} Uma função para cancelar a inscrição (unsubscribe), crucial para evitar memory leaks.
 */
export const listenToIssues = (callback: (issues: Issue[]) => void): (() => void) => {
  const q = query(collection(db, 'issues'), orderBy('reportedAt', 'desc'));
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const issues = querySnapshot.docs.map(doc => fromFirestore(doc.data(), doc.id));
    callback(issues);
  }, (error) => {
    console.error("Erro no listener do Firestore:", error);
  });
  return unsubscribe; // Retorna a função de cancelamento.
};

/**
 * @function updateIssueUpvotes
 * @description Atualiza o número de apoios (upvotes) de uma ocorrência.
 */
export const updateIssueUpvotes = async (issueId: string, newUpvotes: number) => {
    const issueRef = doc(db, 'issues', issueId);
    await updateDoc(issueRef, { upvotes: newUpvotes });
};

/**
 * @function updateIssueStatus
 * @description Atualiza o status de uma ocorrência (usado pelo admin).
 */
export const updateIssueStatus = async (issueId: string, newStatus: Issue['status']) => {
    const issueRef = doc(db, 'issues', issueId);
    await updateDoc(issueRef, { status: newStatus });
};

/**
 * @function deleteIssue
 * @description Exclui uma ocorrência do Firestore (usado pelo admin).
 */
export const deleteIssue = async (issueId: string) => {
  const issueRef = doc(db, 'issues', issueId);
  await deleteDoc(issueRef);
};

/**
 * @function addCommentToIssue
 * @description Adiciona um novo comentário a uma ocorrência.
 */
export const addCommentToIssue = async (
    issueId: string, 
    content: string,
    user: AppUser
) => {
    if (!content?.trim()) throw new Error("O comentário não pode estar vazio.");
    if (!user) throw new Error("Usuário não autenticado.");

    const issueRef = doc(db, 'issues', issueId);
    
    const newComment: CommentData = {
        id: uuidv4(),
        content: content.trim(),
        author: user.name || 'Usuário Anônimo',
        authorId: user.uid,
        authorPhotoURL: user.photoURL || null,
        authorRole: user.role, // Salva o papel do usuário no momento do comentário.
        createdAt: Timestamp.now()
    };

    // Usa `arrayUnion` para adicionar o novo comentário ao array atomicamente.
    await updateDoc(issueRef, {
        comments: arrayUnion(newComment)
    });
};

/**
 * @function deleteCommentFromIssue
 * @description Exclui um comentário de uma ocorrência (usado pelo admin).
 */
export const deleteCommentFromIssue = async (issueId: string, commentId: string) => {
  const issueRef = doc(db, 'issues', issueId);
  const issueSnap = await getDoc(issueRef);
  if (!issueSnap.exists()) {
    throw new Error('Ocorrência não encontrada.');
  }
  
  const issueData = issueSnap.data() as IssueData;
  const commentToDelete = issueData.comments.find((c: CommentData) => c.id === commentId);

  if (commentToDelete) {
    // Usa `arrayRemove` para remover o objeto do comentário do array atomicamente.
    await updateDoc(issueRef, {
      comments: arrayRemove(commentToDelete)
    });
  } else {
    console.warn(`Comentário com ID ${commentId} não encontrado na ocorrência ${issueId}.`);
  }
};
