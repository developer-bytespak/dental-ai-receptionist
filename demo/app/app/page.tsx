/**
 * The product. Sign-in required; the workspace is the one the signed-in
 * person belongs to. A platform admin can open any workspace from /admin.
 */
import Desk from "@/app/components/Desk";
import { authConfigured, requireTenant } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const ctx = await requireTenant();

  return (
    <Desk
      scope="app"
      canReset={ctx.admin}
      account={{
        email: ctx.session.email ?? "",
        name: ctx.session.name,
        tenantName: ctx.tenant.name,
        clerk: authConfigured() && !ctx.session.dev,
        viewingAs: ctx.viewingAs,
        admin: ctx.admin,
      }}
    />
  );
}
