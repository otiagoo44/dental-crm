import { Link } from 'react-router';
import EmptyState from '../components/ui/EmptyState';

export default function NotFoundPage({ entity = 'Página' }) {
  return <EmptyState title={`404 · ${entity} no disponible`} text="El enlace no existe o no está disponible para tu usuario."
    action={<Link className="inline-flex min-h-11 items-center text-mint" to="/pacientes">Volver a pacientes</Link>} />;
}
