import Button from '../ui/Button';
export function QueryError({ error, retry }) {
  return <div role="alert" className="space-y-3 rounded-xl border border-danger/30 p-4"><p>{error}</p><Button onClick={retry}>Reintentar</Button></div>;
}
export function PageControls({ nextCursor, onNext, onFirst, loading }) {
  return <nav aria-label="Paginación" className="flex flex-wrap justify-between gap-3 py-3">
    <Button variant="secondary" onClick={onFirst} disabled={loading}>Primera página</Button>
    <Button onClick={onNext} disabled={!nextCursor || loading}>Siguiente página</Button>
  </nav>;
}
