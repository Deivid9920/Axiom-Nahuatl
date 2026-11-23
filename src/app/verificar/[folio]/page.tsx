// R27 — página pública de verificación de documentos (/verificar/[folio])
// Consultable por cualquier persona con el folio (p. ej. escaneando el QR del
// documento impreso). No requiere sesión; muestra el estado, el titular con el
// correo enmascarado y la integridad de la copia almacenada contra su huella SHA-256.
import Link from 'next/link'
import { verifyDocumentByFolio } from '@/lib/issued-docs'

export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<string, string> = {
  report: 'Reporte formal de desempeño',
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default async function VerifyPage({ params }: { params: Promise<{ folio: string }> }) {
  const { folio } = await params
  const result = await verifyDocumentByFolio(folio)

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

        <h1 className="verify-title">Verificación de documento</h1>

        {!result.found ? (
          <div className="verify-state invalid">
            <p className="verify-state-tag">Sin registro</p>
            <p className="verify-folio">{folio}</p>
            <p className="verify-note">
              No existe ningún documento emitido con este folio. Revisa que el código esté
              completo y sin alteraciones; si el documento es legítimo, la persona emisora
              puede reimprimirlo para regenerar la verificación.
            </p>
          </div>
        ) : result.integrity === 'tampered' ? (
          <div className="verify-state invalid">
            <p className="verify-state-tag">Integridad comprometida</p>
            <p className="verify-folio">{result.folio}</p>
            <p className="verify-note">
              El registro existe pero su contenido no corresponde a la huella SHA-256 emitida.
              No confíes en este documento y repórtalo a la institución que lo presentó.
            </p>
          </div>
        ) : result.revoked ? (
          <div className="verify-state revoked">
            <p className="verify-state-tag">Documento revocado</p>
            <p className="verify-folio">{result.folio}</p>
            <p className="verify-note">
              Este documento fue emitido el {fmtDay(result.issuedAt)} y posteriormente revocado
              por la plataforma; perdió toda validez.
            </p>
          </div>
        ) : (
          <div className="verify-state valid">
            <p className="verify-state-tag">Documento válido</p>
            <p className="verify-folio">{result.folio}</p>
            <table className="verify-table">
              <tbody>
                <tr><td>Documento</td><td>{KIND_LABEL[result.kind] || result.kind}</td></tr>
                <tr><td>Titular</td><td>{result.holderName}</td></tr>
                <tr><td>Correo registrado</td><td className="verify-mono">{result.holderEmailMasked}</td></tr>
                <tr><td>Fecha de emisión</td><td>{fmtDay(result.issuedAt)}</td></tr>
                {'windowDays' in result.snapshot && (
                  <tr><td>Periodo analizado</td><td>{String(result.snapshot.windowDays)} días</td></tr>
                )}
                {'cefrCurrent' in result.snapshot && (
                  <tr><td>Nivel MCER al emitir</td><td>{String(result.snapshot.cefrCurrent)}</td></tr>
                )}
                {'institution' in result.snapshot && result.snapshot.institution ? (
                  <tr><td>Institución</td><td>{String(result.snapshot.institution)}</td></tr>
                ) : null}
              </tbody>
            </table>
            <p className="verify-hash" title="Huella SHA-256 del contenido emitido">
              Huella SHA-256: <span className="verify-mono">{result.payloadHash.slice(0, 32)}…</span>
            </p>
            <p className="verify-note">
              La huella corresponde al contenido emitido por la plataforma; cualquier
              alteración del documento o del registro haría fallar esta verificación.
            </p>
          </div>
        )}

        <footer className="verify-foot">
          Consulta de autenticidad · el folio se asigna al emitir el documento desde la
          plataforma y es la referencia oficial de trazabilidad.{' '}
          <Link href="/" className="verify-link">Ir a Axiom</Link>
        </footer>
      </div>
    </main>
  )
}
