 st# Atlas Cívico

![Atlas Cívico](https://placehold.co/1200x630.png?text=Atlas+Cívico)

## 📌 Sobre o Projeto

O **Atlas Cívico** é uma plataforma web moderna e interativa, projetada para capacitar cidadãos a mapear, visualizar e acompanhar problemas urbanos em sua comunidade. Através de um mapa interativo, os usuários podem reportar ocorrências como buracos em vias, problemas de iluminação pública e acúmulo de lixo, transformando a participação cívica em dados acionáveis.

O objetivo principal é criar uma ponte transparente entre a população e a administração local, permitindo que gestores públicos analisem os dados através de um dashboard intuitivo para tomar decisões mais eficientes e priorizar soluções.

Este projeto foi desenvolvido como um Trabalho de Conclusão de Curso (TCC), aplicando as tecnologias mais atuais de desenvolvimento web para resolver um problema cívico real.

---

## 🚀 Tecnologias Utilizadas

A plataforma foi construída com um stack moderno, focado em performance, escalabilidade e uma excelente experiência de desenvolvimento.

- **Frontend:**
  - **[Next.js 15](https://nextjs.org/)**: Framework React com renderização no servidor (SSR) e componentização via App Router.
  - **[React 18](https://react.dev/)**: Biblioteca para construção de interfaces de usuário reativas.
  - **[TypeScript](https://www.typescriptlang.org/)**: Para um código mais seguro, legível e com tipagem estática.
  - **[Tailwind CSS](https://tailwindcss.com/)**: Framework CSS utility-first para estilização rápida e consistente.
  - **[shadcn/ui](https://ui.shadcn.com/)**: Coleção de componentes de UI acessíveis e reutilizáveis, construídos sobre Radix UI.
  - **[Lucide React](https://lucide.dev/)**: Biblioteca de ícones leve e customizável.

- **Backend & Banco de Dados:**
  - **[Firebase](https://firebase.google.com/)**: Plataforma utilizada para autenticação de usuários (Authentication) e como banco de dados NoSQL em tempo real (Firestore).

- **Mapas e Visualização de Dados:**
  - **[Leaflet](https://leafletjs.com/)** & **[React Leaflet](https://react-leaflet.js.org/)**: Para a criação de mapas interativos e leves.
  - **[Recharts](https://recharts.org/)**: Para a construção de gráficos e dashboards analíticos.

- **Formulários e Validação:**
  - **[React Hook Form](https://react-hook-form.com/)**: Gerenciamento de formulários performático e eficiente.
  - **[Zod](https://zod.dev/)**: Validação de schemas com inferência de tipos para TypeScript.

---

## 🏃‍♂️ Como Executar Localmente

Siga os passos abaixo para configurar e rodar o projeto em seu ambiente de desenvolvimento.

**Pré-requisitos:**
- [Node.js](https://nodejs.org/en) (versão 18 ou superior)
- [npm](https://www.npmjs.com/) ou [yarn](https://yarnpkg.com/)

**1. Clone o Repositório**
```bash
git clone https://github.com/seu-usuario/atlas-civico.git
cd atlas-civico
```

**2. Instale as Dependências**
```bash
npm install
```

**3. Configure as Variáveis de Ambiente**

Para conectar o projeto ao Firebase, você precisará de suas chaves de API.

- Crie um arquivo chamado `.env` na raiz do projeto.
- Copie o conteúdo do arquivo `.env.example` (se houver) ou adicione as seguintes variáveis, preenchendo com suas credenciais do Firebase:

```
# Credenciais do Firebase
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu_project_id
NEXT_PUBLIC_FIREBASE_APP_ID=seu_app_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu_storage_bucket
NEXT_PUBLIC_FIREBASE_API_KEY=sua_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu_auth_domain
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=seu_messaging_sender_id
```
> **Importante:** O arquivo `.env` já está incluído no `.gitignore` para garantir que suas chaves privadas não sejam enviadas para o repositório.

**4. Execute o Projeto**
```bash
npm run dev
```

Abra [http://localhost:9002](http://localhost:9002) no seu navegador para ver a aplicação funcionando.

---

## 📁 Estrutura de Pastas

A estrutura do projeto segue as convenções do Next.js App Router para manter o código organizado e escalável.

```
src/
├── app/          # Contém todas as rotas da aplicação (páginas e layouts).
│   ├── (public)/ # Rotas públicas como /login e /register.
│   ├── (app)/    # Rotas privadas que exigem autenticação.
│   └── admin/    # Rota específica para o painel de administração.
│
├── components/   # Componentes React reutilizáveis.
│   ├── ui/       # Componentes de UI (shadcn/ui).
│   ├── charts/   # Gráficos para o dashboard.
│   └── ...       # Outros componentes customizados (Header, Map, etc.).
│
├── context/      # Contextos React (ex: AuthContext para autenticação).
│
├── hooks/        # Hooks customizados (ex: useToast).
│
├── lib/          # Funções utilitárias, tipos, e configuração do Firebase.
│
└── services/     # Camada de serviço para abstrair a lógica de backend (ex: interações com o Firestore).
```
