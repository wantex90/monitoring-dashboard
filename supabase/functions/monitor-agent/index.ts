import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key",
};

interface MetricsPayload {
  cpu_usage: number;
  memory: {
    total: number;
    used: number;
    percent: number;
  };
  disk: {
    total: number;
    used: number;
    percent: number;
  };
  network: {
    sent: number;
    recv: number;
  };
  load_average: number[];
  services: Array<{
    name: string;
    status: string;
    enabled: boolean;
  }>;
  timestamp: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const apiKey = req.headers.get("X-API-Key");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing API Key" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: server, error: serverError } = await supabase
      .from("servers")
      .select("id")
      .eq("api_key", apiKey)
      .maybeSingle();

    if (serverError || !server) {
      return new Response(
        JSON.stringify({ error: "Invalid API Key" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname;

    if (path.includes("/commands") && req.method === "GET") {
      const { data: commands } = await supabase
        .from("server_commands")
        .select("*")
        .eq("server_id", server.id)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      await supabase
        .from("server_commands")
        .update({ status: "executing", executed_at: new Date().toISOString() })
        .eq("server_id", server.id)
        .eq("status", "pending");

      return new Response(
        JSON.stringify(commands || []),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.includes("/command-result") && req.method === "POST") {
      const { id, output, status } = await req.json();

      await supabase
        .from("server_commands")
        .update({ output, status })
        .eq("id", id);

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (req.method === "POST") {
      const metrics: MetricsPayload = await req.json();

      await supabase
        .from("servers")
        .update({
          status: "online",
          last_seen: new Date().toISOString(),
        })
        .eq("id", server.id);

      const { error: metricsError } = await supabase
        .from("server_metrics")
        .insert({
          server_id: server.id,
          cpu_usage: metrics.cpu_usage,
          memory_total: metrics.memory.total,
          memory_used: metrics.memory.used,
          memory_percent: metrics.memory.percent,
          disk_total: metrics.disk.total,
          disk_used: metrics.disk.used,
          disk_percent: metrics.disk.percent,
          network_sent: metrics.network.sent,
          network_recv: metrics.network.recv,
          load_average: metrics.load_average,
          timestamp: metrics.timestamp,
        });

      if (metricsError) {
        throw metricsError;
      }

      for (const service of metrics.services) {
        await supabase
          .from("server_services")
          .upsert(
            {
              server_id: server.id,
              service_name: service.name,
              status: service.status,
              enabled: service.enabled,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "server_id,service_name",
            }
          );
      }

      return new Response(
        JSON.stringify({ success: true, server_id: server.id }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});