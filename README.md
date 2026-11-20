# MESTRE KAME SKINS

Aplicativo comunitário multiplataforma (Android/iPhone) para publicar e compartilhar imagens de skins do Global Truck Online.

## O que já está no projeto

- Cadastro e login por e-mail/senha
- Feed público de skins
- Categorias (Scania, Volvo, Mercedes, caminhões, baús e carretas)
- Publicação de imagem com título e descrição
- Curtidas e comentários
- Download da imagem para a galeria do celular
- Perfil básico e contagem de publicações
- Backend com Supabase e políticas de segurança (RLS)

## Importante: o que é necessário para funcionar online

O pacote contém o aplicativo e o SQL do banco, mas não inclui uma conta de hospedagem/backend. Para que pessoas diferentes vejam as publicações umas das outras, configure um projeto Supabase (plano gratuito disponível, sujeito aos limites do serviço).

### 1. Criar o backend

1. Acesse https://supabase.com e crie uma conta/projeto.
2. No painel do projeto, abra **SQL Editor**.
3. Abra `supabase/schema.sql` deste projeto, copie todo o conteúdo e execute.
4. Vá a **Storage** e crie um bucket chamado `skins`.
5. Marque o bucket `skins` como **Public**.
6. Em **Project Settings > API**, copie a **Project URL** e a chave **anon/public**. Nunca use a `service_role` no aplicativo.

### 2. Configurar as chaves

1. Na raiz do projeto, copie `.env.example` e dê o nome `.env`.
2. Preencha:
   - `EXPO_PUBLIC_SUPABASE_URL` com a Project URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` com a chave anon/public
3. Salve o arquivo.

### 3. Executar no computador

Instale Node.js LTS e depois, dentro da pasta do projeto, execute:

```bash
npm install
npx expo start
```

Instale **Expo Go** no Android ou iPhone e leia o QR code exibido no terminal/navegador. Para iPhone, o Expo Go está disponível na App Store. Android e iPhone precisam estar na mesma rede Wi-Fi do computador, ou use `npx expo start --tunnel`.

### 4. Testar no Android usando apenas o celular

O projeto pode ser editado em um ambiente de desenvolvimento na nuvem, mas compilar e configurar o backend é mais simples em um computador. Se estiver apenas com Android:
1. Instale Expo Go pela Play Store.
2. Guarde/extraia o ZIP em um serviço de arquivos.
3. Abra um ambiente de desenvolvimento online compatível com Expo/Node.js (por exemplo, GitHub Codespaces, se disponível para sua conta), envie os arquivos e siga os passos 1–3.
4. Abra o link/QR do Expo no celular.

O ZIP não é um APK instalável. Ele é o código-fonte do app para executar com Expo Go ou gerar builds Android/iOS posteriormente.

## Segurança e moderação

As publicações estão abertas a qualquer usuário autenticado, como você escolheu. As imagens e posts ficam visíveis publicamente. O banco impede que um usuário publique em nome de outra conta. Antes de divulgar amplamente, adicione moderação, denúncia de conteúdo e regras da comunidade.

## Observações

- O nome Global Truck Online é usado apenas para descrever a comunidade de jogadores. Este projeto não é afiliado aos desenvolvedores do jogo.
- O download salva a imagem publicada; não instala automaticamente uma skin dentro do jogo. A compatibilidade/importação depende do formato e das regras oficiais do jogo.
- O projeto precisa das chaves do seu Supabase para sair da tela de configuração e funcionar online.
