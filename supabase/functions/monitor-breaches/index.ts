import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
    const { monitored_email_id, email } = await req.json();

    if (!email || !monitored_email_id) {
      return new Response(
        JSON.stringify({ error: "Email and monitored_email_id are required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const apiKey = Deno.env.get("HIBP_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const response = await fetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
      {
        headers: {
          "hibp-api-key": apiKey,
          "User-Agent": "SDBA-Mobile-App",
        },
      }
    );

    if (response.status === 404) {
      await supabase
        .from("monitored_emails")
        .update({ last_scan: new Date().toISOString() })
        .eq("id", monitored_email_id);

      return new Response(
        JSON.stringify({ breached: false, new_breaches: 0 }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to check breaches" }),
        {
          status: response.status,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const breaches = await response.json();

    const { data: existingBreaches } = await supabase
      .from("breach_records")
      .select("breach_name")
      .eq("monitored_email_id", monitored_email_id);

    const existingBreachNames = new Set(
      existingBreaches?.map((b) => b.breach_name) || []
    );

    let newBreachCount = 0;

    for (const breach of breaches) {
      if (!existingBreachNames.has(breach.Name)) {
        await supabase.from("breach_records").insert([
          {
            monitored_email_id,
            breach_name: breach.Name,
            breach_title: breach.Title,
            breach_date: breach.BreachDate,
            is_new: true,
            pwn_count: breach.PwnCount,
            data_classes: breach.DataClasses || [],
          },
        ]);
        newBreachCount++;
      }
    }

    await supabase
      .from("monitored_emails")
      .update({ last_scan: new Date().toISOString() })
      .eq("id", monitored_email_id);

    return new Response(
      JSON.stringify({
        breached: true,
        total_breaches: breaches.length,
        new_breaches: newBreachCount,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
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