import { invokeFunction } from '@/lib/functions';
import { supabase } from '@/lib/supabase';

export async function changePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** Permanently deletes the signed-in user's account and all their data (see
 * supabase/functions/delete-account). Does not sign out locally -- the
 * caller should do that once this resolves. */
export async function deleteMyAccount() {
  await invokeFunction<{ deleted: true }>('delete-account', {});
}
