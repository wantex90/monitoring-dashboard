import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { hostname, port, username, password } = body;

    if (!hostname || !port || !username || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const log = `🔐 SSH Auto-Install Not Available in Edge Runtime\n\n` +
                `⚠️  Edge Functions don't support SSH connections.\n\n` +
                `📋 Please use Manual mode instead:\n` +
                `   1. Click "Manual" tab\n` +
                `   2. Copy installation command\n` +
                `   3. SSH to your server\n` +
                `   4. Run the command\n\n` +
                `💡 The agent will auto-register after installation!`;

    return new Response(
      JSON.stringify({
        success: false,
        error: "SSH not supported in Edge Functions",
        log: log,
      }),
      { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        log: `❌ Error: ${error.message}`,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
