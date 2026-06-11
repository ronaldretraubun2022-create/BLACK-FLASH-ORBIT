const { createClient } = require("@supabase/supabase-js");

let authClient = null;
let authClientKey = "";

function getSupabaseAuthClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey =
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  const nextClientKey = `${supabaseUrl}:${supabaseAnonKey}`;

  if (!authClient || authClientKey !== nextClientKey) {
    authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    authClientKey = nextClientKey;
  }

  return authClient;
}

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Missing bearer token.",
      });
    }

    const supabase = getSupabaseAuthClient();

    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: "Supabase auth belum dikonfigurasi.",
      });
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token.",
      });
    }

    req.user = data.user;
    req.userId = data.user.id;
    req.userEmail = data.user.email || null;

    return next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Auth middleware error.",
    });
  }
}

module.exports = { requireAuth };
