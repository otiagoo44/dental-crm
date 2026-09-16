import { Link } from 'react-router';

export default function NotFoundPage({ entity = 'Página' }) {
  return <section className="space-y-3 p-6">
    <h1 className="text-xl font-bold">404 · {entity} no disponible</h1>
    <p>El enlace no existe o no está disponible para tu usuario.</p>
    <Link className="inline-flex min-h-11 items-center text-mint" to="/pacientes">Volver a pacientes</Link>
  </section>;
}
