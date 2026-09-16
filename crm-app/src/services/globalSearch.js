import { validId } from './contactQueries.js';

export const GLOBAL_SEARCH_LIMIT = 12;

async function checked(request) {
  const { data, error } = await request;
  if (error) throw error;
  return data || [];
}

export function createGlobalSearch(client, clinicId) {
  if (!validId(clinicId)) throw new Error('No hay una clínica autorizada.');

  return async function search({ query, limit = GLOBAL_SEARCH_LIMIT, signal } = {}) {
    const normalized = String(query || '').trim();
    if (normalized.length < 2 || normalized.length > 80) throw new Error('Escribí entre 2 y 80 caracteres.');
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error('Límite de búsqueda inválido.');
    return checked(client.rpc('search_dentflow_v1', {
      p_clinic_id: clinicId, p_query: normalized, p_limit: limit,
    }).abortSignal(signal));
  };
}
