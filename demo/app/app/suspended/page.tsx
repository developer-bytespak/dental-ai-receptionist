export const dynamic = "force-dynamic";

export default function Suspended() {
  return (
    <main className="notice">
      <div className="notice-card">
        <h1 className="notice-title">This workspace is paused</h1>
        <p className="notice-body">
          The account has been suspended. Calls are no longer answered by the assistant. Contact our team to
          reactivate it.
        </p>
      </div>
    </main>
  );
}
