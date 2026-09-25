export default function Notice({ ok, error }: { ok?: string; error?: string }) {
  if (error) return <p className="admin-notice admin-notice-error" role="alert">{error}</p>;
  if (ok) return <p className="admin-notice admin-notice-ok" role="status">{ok}</p>;
  return null;
}
