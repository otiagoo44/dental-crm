export function savedViewError(error) {
  return ({ '23505': 'Ya existe una vista con ese nombre.', '54000': 'Llegaste al límite de vistas. Eliminá una que ya no uses.',
    '42501': 'No tenés permiso para modificar esta vista.', '22023': 'Revisá los filtros: alguno ya no está disponible.' })[error?.code]
    || 'No pudimos guardar o cargar las vistas. Intentá de nuevo.';
}

export function createSavedViewService(client) {
  async function call(name, args, signal) {
    let request = client.rpc(name, args);
    if (signal) request = request.abortSignal(signal);
    const { data, error } = await request;
    if (error) throw error;
    return data;
  }
  return {
    list: (entity, signal) => call('list_saved_views_v1', { p_entity: entity }, signal),
    create: (entity, view) => call('create_saved_view_v1', { p_entity: entity, p_name: view.name, p_visibility: view.visibility, p_filters: view.filters, p_sorts: view.sorts }),
    update: (view) => call('update_saved_view_v1', { p_id: view.id, p_name: view.name, p_visibility: view.visibility, p_filters: view.filters, p_sorts: view.sorts }),
    remove: (id) => call('delete_saved_view_v1', { p_id: id }),
  };
}
