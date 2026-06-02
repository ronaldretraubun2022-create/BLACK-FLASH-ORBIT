import { supabase } from "../lib/supabase";

export function createProfilePayload(user) {
  return {
    id: user.id,
    email: user.email,
    role: "user",
  };
}

export async function ensureUserProfile(user) {
  if (!supabase || !user) return null;

  const { data: existingProfile, error: selectError } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existingProfile) return existingProfile;

  const profile = createProfilePayload(user);
  const { data, error } = await supabase
    .from("profiles")
    .insert(profile)
    .select("id, email, role")
    .single();

  if (error) throw error;

  return data;
}

export async function insertRegisteredUserProfile(user) {
  if (!supabase || !user) return null;

  const profile = createProfilePayload(user);
  const { data, error } = await supabase
    .from("profiles")
    .upsert(profile, { onConflict: "id" })
    .select("id, email, role")
    .single();

  if (error) throw error;

  return data;
}
