/**
 * The public demo. Anyone can open it, call the demo agent and reset it.
 * The product itself lives at /app, behind sign-in.
 */
import Desk from "@/app/components/Desk";

export default function Page() {
  return <Desk scope="demo" canReset />;
}
