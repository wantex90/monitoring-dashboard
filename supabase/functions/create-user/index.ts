import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { email, password, full_name, role } = await req.json();

    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || email.split('@')[0],
      },
    });

    if (createError) {
      throw createError;
    }

    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({ 
        role: role || 'viewer',
        full_name: full_name || email.split('@')[0]
      })
      .eq('id', newUser.user!.id);

    if (profileError) {
      throw profileError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User created successfully',
        user: {
          id: newUser.user!.id,
          email: newUser.user!.email,
          role: role || 'viewer',
        },
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
