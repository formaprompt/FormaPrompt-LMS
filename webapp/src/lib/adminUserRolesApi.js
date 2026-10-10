export const USER_ROLE_LABELS = {
  user: 'Apprenant',
  employee: 'Formateur / collaborateur',
  admin: 'Administrateur',
};

export function isProtectedAccount(learner) {
  if (typeof learner.protected === 'boolean') return learner.protected;
  return String(learner.email || '').trim().toLowerCase() === 'thierry227@gmail.com';
}

export async function setAdminUserRole(client, { userId, role, expectedRole }) {
  if (!userId || !Object.hasOwn(USER_ROLE_LABELS, role) || !Object.hasOwn(USER_ROLE_LABELS, expectedRole)) {
    throw new Error('Modification de rôle invalide.');
  }
  const { data, error } = await client.rpc('admin_set_user_role', {
    p_user_id: userId,
    p_role: role,
    p_expected_role: expectedRole,
  });
  if (error) throw error;
  if (!data || data.userId !== userId || data.role !== role || typeof data.protected !== 'boolean' || typeof data.changed !== 'boolean') {
    throw new Error('Le serveur n’a pas confirmé le rôle demandé.');
  }
  return data;
}

export function isRolePermissionError(error) {
  return error?.code === '42501' || error?.status === 403 || error?.status === 401;
}

export function isRoleProtectedError(error) {
  return error?.code === '42501' && /compte proprietaire est protege/i.test(String(error?.message || ''));
}

export function isRoleConflictError(error) {
  return error?.code === '40001' || error?.code === 'P0002' || error?.status === 409;
}
