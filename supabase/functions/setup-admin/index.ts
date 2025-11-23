import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

    const adminEmail = 'admin@admin.com';
    const adminPassword = 'admin123456';

    // Check if admin already exists
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const adminExists = existingUser?.users?.some(u => u.email === adminEmail);

    if (adminExists) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Admin user already exists',
          email: adminEmail 
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Create admin user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        full_name: 'System Administrator',
      },
    });

    if (createError) {
      throw createError;
    }

    // Update user profile to superadmin
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({ 
        role: 'superadmin',
        full_name: 'System Administrator'
      })
      .eq('id', newUser.user!.id);

    if (profileError) {
      throw profileError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Admin user created successfully',
        email: adminEmail,
        note: 'Use password: admin123456 to login',
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
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
