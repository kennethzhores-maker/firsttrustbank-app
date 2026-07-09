import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { error: jsonResponse({ error: "Missing authorization" }, 401) };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return { error: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: profile } = await adminClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { error: jsonResponse({ error: "Admin access required" }, 403) };
  }

  return { adminClient };
}

async function findAuthUserByEmail(adminClient: ReturnType<typeof createClient>, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  let page = 1;

  while (page <= 10) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;

    const existing = data.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
    if (existing) return existing;

    if (data.users.length < 200) break;
    page += 1;
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const adminCheck = await requireAdmin(req);
    if ("error" in adminCheck && adminCheck.error) {
      return adminCheck.error;
    }

    const { adminClient } = adminCheck;
    const body = await req.json();
    const action = body.action ?? "create";

    if (action === "delete") {
      const userId = body.userId as string;
      if (!userId) {
        return jsonResponse({ error: "User ID is required" }, 400);
      }

      await adminClient.from("users").delete().eq("id", userId);
      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (authDeleteError) {
        return jsonResponse({ error: authDeleteError.message }, 400);
      }

      return jsonResponse({ success: true });
    }

    const {
      email,
      password,
      full_name,
      account_number,
      balance,
      card_number,
      expiry_date,
      pin_code,
    } = body;

    let authUserId: string | null = null;

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      const authUser = await findAuthUserByEmail(adminClient, email);
      if (!authUser) {
        return jsonResponse({ error: authError.message }, 400);
      }
      authUserId = authUser.id;

      const { error: passwordError } = await adminClient.auth.admin.updateUserById(authUserId, {
        password,
      });
      if (passwordError) {
        return jsonResponse({ error: passwordError.message }, 400);
      }
    } else {
      authUserId = authData.user.id;
    }

    const { data: existingProfile } = await adminClient
      .from("users")
      .select("id")
      .eq("id", authUserId)
      .maybeSingle();

    if (existingProfile) {
      return jsonResponse({ error: "A user with this email already exists." }, 400);
    }

    const { error: dbError } = await adminClient.from("users").insert({
      id: authUserId,
      email,
      full_name,
      account_number,
      balance,
      card_number,
      expiry_date,
      pin_code,
      role: "user",
    });

    if (dbError) {
      if (!authError) {
        await adminClient.auth.admin.deleteUser(authUserId);
      }
      return jsonResponse({ error: dbError.message }, 400);
    }

    return jsonResponse({ success: true, userId: authUserId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
