# Sign-in, invitations and the admin console

The product is invite only. Nobody can sign up on their own: our team creates
the customer in the admin console, the owner receives an email, sets a
password and lands in their workspace.

## What runs where

| Route | Who | What |
|---|---|---|
| `/` | anyone | the public demo workspace, resettable, unchanged |
| `/app` | invited customers | their own workspace: calls, board, pipeline, texts |
| `/admin` | our team (`PLATFORM_ADMIN_EMAILS`) | customers, invitations, status, open any workspace |
| `/api/retell/*` | Retell | tool and lifecycle webhooks, routed to the tenant by agent id |

Every table carries `tenant_id`. Every query is scoped through
`lib/tenancy.ts`, and a query that runs with no tenant in scope throws.

## Setting up Clerk (about ten minutes, once per product)

1. Create an application at https://dashboard.clerk.com. Name it after the
   product. Enable Email address with password and email code; leave social
   sign-in off unless wanted.
2. **User & Authentication > Restrictions**: set Sign-up mode to
   **Restricted**. This is what makes the product invite only. Invitation
   links still work in Restricted mode.
3. Copy the publishable key and the secret key into the Vercel project
   (Settings > Environment Variables) and into `.env.local`:
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, plus the four
   `NEXT_PUBLIC_CLERK_*_URL` values from `.env.example`.
4. Set `PLATFORM_ADMIN_EMAILS` to the team addresses that may use `/admin`.
5. Redeploy. Open `/sign-in`, sign in with a team address (create that one
   account from the Clerk dashboard under Users > Create, since sign-up is
   closed), then open `/admin`.

The development instance of a Clerk application is free and enough until
launch; switch to the production instance when a custom domain exists.

## Creating a customer

1. `/admin` > New customer. Business name and the owner's email are required.
   The Retell agent id can wait until onboarding provisions one (phase 2).
2. Tick "Email the invitation now". Clerk sends the email; the row on the
   customer's page shows sent, and turns to accepted when they first sign in.
3. The owner opens the link, sets a password, and is taken to `/app`. Their
   workspace is empty until their agent takes calls.

Add staff from the customer's page with the Invite form. Remove someone with
Remove; their Clerk account stays, but they have no workspace and see the
"No workspace yet" page.

## Support: opening a customer's workspace

On the customer's page, **Open workspace** sets a cookie and shows `/app` as
that customer, with a "Viewing" label in the sidebar. Platform admins also
see the Clear workspace control there. Customers never see it.

## Working locally before Clerk exists

Set `AUTH_DEV_USER=you@company.com` and `PLATFORM_ADMIN_EMAILS=you@company.com`
in `.env.local`. Every request is treated as that person. The bypass is
ignored when `NODE_ENV=production` or when Clerk keys are present, so it
cannot open a deployment by accident.

## Webhooks and tenants

Retell sends the agent id with every tool call and lifecycle event. The
tool route looks the agent up in `tenants.retell_agent_id`; the demo agent
from `NEXT_PUBLIC_RETELL_AGENT_ID` always maps to the demo tenant; an agent
nobody owns is refused with 404 before anything is written. Until phase 2
provisions agents automatically, paste a customer's agent id into their
page in `/admin`.
