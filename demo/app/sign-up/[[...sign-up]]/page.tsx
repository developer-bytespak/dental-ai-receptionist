/**
 * Only reachable through an invitation link: Clerk sign-up is in Restricted
 * mode, so the page without a ticket shows Clerk's "sign-up is closed" state.
 */
import { SignUp } from "@clerk/nextjs";
import { authConfigured } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  if (!authConfigured()) redirect("/sign-in");
  return (
    <main className="notice">
      <SignUp fallbackRedirectUrl="/app" />
    </main>
  );
}
