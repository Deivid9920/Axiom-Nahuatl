// R28 — página pública de verificación del código de institución (/verificar-inst)
// Cualquier persona (p. ej. el contacto de la escuela) puede confirmar que su
// código AX-INST-XXXXXX está activo antes de compartirlo con sus alumnos.
// Server component con formulario GET — sin sesión y sin JS en cliente.
import { lookupInstitutionByCode } from '@/lib/coordinator'

export const dynamic = 'force-dynamic'

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default async function VerifyInstitutionPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const { code } = await searchParams
  const trimmed = (code || '').trim().slice(0, 40)
  const result = trimmed ? await lookupInstitutionByCode(trimmed) : null

  return (
    <main className="verify-shell">
      <div className="verify-card">
        <header className="verify-head">
          <span className="verify-mark">A</span>
          <div>
            <p className="verify-brand">Axiom</p>
            <p className="verify-brand-sub">Plataforma de aprendizaje de idiomas</p>
          </div>
        </header>

        <h1 className="verify-title">Verificación de código de institución</h1>

        <form method="get" className="verify-form" role="search">
          <input
            type="text"
            name="code"
            defaultValue={trimmed}
            placeholder="AX-INST-XXXXXX"
            maxLength={40}
            aria-label="Código de institución"
            className="verify-input"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="verify-button">Verificar código</button>
        </form>

        {result && !result.found && (
          <div className="verify-state invalid">
            <p className="verify-state-tag">Código no encontrado</p>
            <p className="verify-folio">{trimmed}</p>
            <p className="verify-note">
              No existe ninguna institución registrada con este código. Revisa que esté
              completo y en mayúsculas; si tu escuela aún no tiene código, solicítalo a tu
              coordinador o al equipo de Axiom.
            </p>
          </div>
        )}

        {result?.found && result.status === 'PENDING' && (
          <div className="verify-state revoked">
            <p className="verify-state-tag">Pendiente de verificación</p>
            <p className="verify-folio">{trimmed}</p>
            <table className="verify-table">
              <tbody>
                <tr><td>Institución</td><td>{result.name}</td></tr>
                <tr><td>Estado</td><td>PENDIENTE — aún no puede vincular alumnos</td></tr>
              </tbody>
            </table>
            <p className="verify-note">
              El código existe pero la institución todavía no fue validada por la
              plataforma; mientras tanto, el registro con este código no podrá completarse.
            </p>
          </div>
        )}

        {result?.found && result.status === 'VERIFIED' && (
          <div className="verify-state valid">
            <p className="verify-state-tag">Código de institución válido</p>
            <p className="verify-folio">{trimmed}</p>
            <table className="verify-table">
              <tbody>
                <tr><td>Institución</td><td>{result.name}</td></tr>
                <tr><td>Estado</td><td>VERIFICADA — puede vincular alumnos al registrarse</td></tr>
                {result.verifiedAt && (
                  <tr><td>Verificada el</td><td>{fmtDay(result.verifiedAt)}</td></tr>
                )}
              </tbody>
            </table>
            <p className="verify-note">
              Este código está activo: los alumnos que lo introduzcan al registrarse
              quedarán vinculados a la institución.
            </p>
          </div>
        )}

        <footer className="verify-foot">
          Consulta pública de códigos institucionales · el código lo genera la plataforma
          al dar de alta una institución y lo valida un administrador.{' '}
          <a href="/" className="verify-link">Ir a Axiom</a>
        </footer>
      </div>
    </main>
  )
}
