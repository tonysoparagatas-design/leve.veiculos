import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(url, service);
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization') || '';
    const caller = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) throw new Error('Sessão inválida. Entre novamente.');
    const { data: permission } = await admin.from('admin_users').select('user_id,role').eq('user_id', user.id).maybeSingle();
    if (!permission) throw new Error('Você não tem permissão para gerenciar usuários.');
    const body = await req.json();
    if (permission.role !== 'admin') throw new Error('Somente administradores podem gerenciar contas de acesso.');
    if (body.action === 'list') {
      const { data: rows, error } = await admin.from('admin_users').select('user_id,role').neq('user_id', user.id);
      if (error) throw error;
      const users = await Promise.all((rows || []).map(async (row) => {
        const { data } = await admin.auth.admin.getUserById(row.user_id);
        return { id: row.user_id, email: data.user?.email || '', name: data.user?.user_metadata?.name || '', role: row.role };
      }));
      return Response.json({ users }, { headers: corsHeaders });
    }
    if (body.action === 'create') {
      if (!body.email || !body.password || String(body.password).length < 8) throw new Error('Informe e-mail e senha com pelo menos 8 caracteres.');
      const { data, error } = await admin.auth.admin.createUser({ email: body.email, password: body.password, email_confirm: true, user_metadata: { name: body.name || '' } });
      if (error) throw error;
      const { error: insertError } = await admin.from('admin_users').insert({ user_id: data.user.id, role: body.role === 'admin' ? 'admin' : 'staff' });
      if (insertError) { await admin.auth.admin.deleteUser(data.user.id); throw insertError; }
      return Response.json({ ok: true, id: data.user.id }, { headers: corsHeaders });
    }
    if (body.action === 'delete') {
      if (!body.user_id || body.user_id === user.id) throw new Error('Não é permitido remover o próprio usuário.');
      const { error } = await admin.auth.admin.deleteUser(body.user_id);
      if (error) throw error;
      return Response.json({ ok: true }, { headers: corsHeaders });
    }
    throw new Error('Ação não reconhecida.');
  } catch (error) {
    return Response.json({ error: error.message || 'Erro interno.' }, { status: 400, headers: corsHeaders });
  }
});
