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

    const now = new Date();
    const { data: monitoredEmails } = await supabase
      .from("monitored_emails")
      .select("*")
      .eq("is_active", true);

    if (!monitoredEmails || monitoredEmails.length === 0) {
      return new Response(
        JSON.stringify({ message: "No monitored emails found", scanned: 0 }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    let scannedCount = 0;
    let totalNewBreaches = 0;

    for (const monitoredEmail of monitoredEmails) {
      const lastScan = new Date(monitoredEmail.last_scan);
      const timeSinceLastScan = now.getTime() - lastScan.getTime();
      const minutesSinceLastScan = timeSinceLastScan / (1000 * 60);

      let shouldScan = false;

      switch (monitoredEmail.scan_interval) {
        case "every_10_minutes":
          shouldScan = minutesSinceLastScan >= 10;
          break;
        case "hourly":
          shouldScan = minutesSinceLastScan >= 60;
          break;
        case "daily":
          shouldScan = minutesSinceLastScan >= 1440;
          break;
      }

      if (!shouldScan) {
        continue;
      }

      try {
        const response = await fetch(
          `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(
            monitoredEmail.email
          )}?truncateResponse=false`,
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
            .update({ last_scan: now.toISOString() })
            .eq("id", monitoredEmail.id);
          scannedCount++;
          continue;
        }

        if (!response.ok) {
          console.error(
            `Failed to check breaches for ${monitoredEmail.email}: ${response.status}`
          );
          continue;
        }

        const breaches = await response.json();

        const { data: existingBreaches } = await supabase
          .from("breach_records")
          .select("breach_name")
          .eq("monitored_email_id", monitoredEmail.id);

        const existingBreachNames = new Set(
          existingBreaches?.map((b) => b.breach_name) || []
        );

        for (const breach of breaches) {
          if (!existingBreachNames.has(breach.Name)) {
            await supabase.from("breach_records").insert([
              {
                monitored_email_id: monitoredEmail.id,
                breach_name: breach.Name,
                breach_title: breach.Title,
                breach_date: breach.BreachDate,
                is_new: true,
                pwn_count: breach.PwnCount,
                data_classes: breach.DataClasses || [],
              },
            ]);
            totalNewBreaches++;
          }
        }

        await supabase
          .from("monitored_emails")
          .update({ last_scan: now.toISOString() })
          .eq("id", monitoredEmail.id);

        scannedCount++;

        await new Promise((resolve) => setTimeout(resolve, 1600));
      } catch (error) {
        console.error(
          `Error scanning ${monitoredEmail.email}:`,
          error
        );
      }
    }

    return new Response(
      JSON.stringify({
        message: "Scan completed",
        scanned: scannedCount,
        new_breaches: totalNewBreaches,
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