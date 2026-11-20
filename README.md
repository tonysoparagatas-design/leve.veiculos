# Leve Veículos — Site + Painel Administrativo

Projeto estático em HTML, CSS e JavaScript, pronto para GitHub Pages.

## Estrutura
- `index.html`: página inicial e catálogo público.
- `admin/index.html`: painel administrativo (endereço recomendado).
- `admin.html`: atalho alternativo para o painel.
- `assets/`: estilos, scripts, configuração e logotipo.
- `supabase.sql`: tabelas, políticas RLS e armazenamento de fotos.

## Publicar no GitHub Pages
1. Envie **todo o conteúdo desta pasta** para a raiz do repositório (não envie apenas o ZIP).
2. No GitHub, abra Settings → Pages.
3. Selecione Deploy from a branch, branch `main`, pasta `/(root)`.
4. Salve e aguarde a publicação.

## Configurar Supabase
1. Execute `supabase.sql` no SQL Editor do projeto Supabase.
2. Em Authentication → Users, crie o usuário administrador.
3. Copie o UUID e execute: `insert into public.admin_users(user_id) values ('UUID-DO-ADMIN');`
4. Edite `assets/config.js` e preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` com os dados do projeto.
5. Faça commit e push das alterações.

```js
window.LEVE_CONFIG = {
  SUPABASE_URL: 'https://SEU-PROJETO.supabase.co',
  SUPABASE_ANON_KEY: 'SUA_CHAVE_ANON_PUBLIC'
};
```

Nunca publique a chave `service_role`. A chave anon/public é própria para o navegador, com a segurança garantida pelas políticas RLS.

## Endereços
- Início: `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`
- Painel: `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/admin/`

## Dados comerciais utilizados
- Leve Veículos — Campinas/SP
- R. Domício Pachêco e Silva, 1126, Campinas/SP, CEP 13060-190
- WhatsApp: (19) 98605-5364
- Instagram: https://www.instagram.com/leve.veiculos/
- Facebook: https://www.facebook.com/share/1F5emp2vqW/

## Observações
O catálogo começa vazio até que veículos reais sejam cadastrados. O painel depende da configuração do Supabase e de um usuário autorizado em `admin_users`. Confirme com a empresa horários e demais condições comerciais antes de publicar.


## Novas funções administrativas

### Carrossel da página inicial
- No painel, abra “Carrossel inicial”.
- Envie uma imagem (JPG, PNG ou WebP, até 10 MB), informe título/texto, ordem e status.
- As imagens ativas aparecem automaticamente no banner da página inicial; o visitante pode navegar pelas setas e indicadores.
- Execute a versão atualizada de `supabase.sql` para criar a tabela `site_slides`, políticas e bucket `site-media`.

### Clientes
- O painel permite cadastrar, editar e excluir clientes com nome, telefone, e-mail, documento opcional e observações.
- Os dados ficam na tabela `customers`, protegida por RLS e disponível apenas para usuários autenticados autorizados.
- Trate dados pessoais conforme a LGPD e limite o acesso da equipe.

### Usuários da equipe
A criação/exclusão de contas Auth exige a chave `service_role`, que nunca deve ser colocada no navegador. Por isso, foi incluída a Edge Function `supabase/functions/admin-users/index.ts`. Publique-a pelo Supabase CLI:

```bash
supabase functions deploy admin-users
```

A função usa os secrets gerenciados pelo Supabase (`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`). Não configure nem exponha a chave service role no GitHub Pages. O primeiro usuário administrador deve ser criado em Authentication > Users e autorizado na tabela `admin_users`, com `role='admin'`. Administradores podem criar/remover acessos; usuários com perfil `staff` não podem gerenciar contas.

Para adicionar o primeiro administrador após criar o usuário no Supabase Auth:

```sql
insert into public.admin_users(user_id, role)
values ('UUID-DO-PRIMEIRO-ADMIN', 'admin');
```

Após atualizar o projeto, publique novamente os arquivos estáticos no GitHub Pages e execute o SQL atualizado no Supabase.
