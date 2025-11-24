import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { serverId } = await req.json();

    if (!serverId) {
      return new Response(
        JSON.stringify({ error: "Server ID is required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const updateScript = `#!/bin/bash
set -e
echo "Downloading latest agent..."
curl -sSL "${supabaseUrl}/functions/v1/download-agent" -o /opt/server-monitor/server-agent.py
chmod +x /opt/server-monitor/server-agent.py
echo "Restarting agent service..."
systemctl restart monitor-agent
echo "Agent updated successfully!"
echo "Waiting for services scan..."
sleep 65
echo "Services should now be visible in dashboard"`;

    const { error } = await supabase.from("server_commands").insert({
      server_id: serverId,
      command_type: "execute",
      command: updateScript,
      status: "pending",
      output: "",
    });

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Agent update command queued. Please wait 1-2 minutes for completion.",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});