import { Clapperboard } from "lucide-react";
import { ActionForm } from "@/components/forms";
import { Field } from "@/components/fields";
import { signIn } from "@/app/actions";
import { configured } from "@/lib/supabase/server";
export default function Login() {
  return (
    <main className="login">
      <div className="login-art">
        <Clapperboard size={38} />
        <p className="eyebrow gold">MIDO WATCH / VOL. 02</p>
        <h1>
          A world of stories.
          <br />
          <em>Your point of view.</em>
        </h1>
        <p>
          Your watch history, your next obsession, your taste.
          <br />
          All in one private screening room.
        </p>
      </div>
      <section className="login-form panel">
        <p className="eyebrow gold">WELCOME BACK</p>
        <h2>Take your seat.</h2>
        {configured() ? (
          <>
            <p>Sign in to your private collection.</p>
            <ActionForm handler={signIn} submit="Sign in">
              <Field
                label="Email address"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
              <Field
                label="Password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </ActionForm>
            <p className="small">
              Private access. Accounts are created by the project owner.
            </p>
          </>
        ) : (
          <>
            <p>Connect Supabase to open your screening room.</p>
            <p className="small">
              Set NEXT_PUBLIC_SUPABASE_URL and
              NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local, apply the
              migration, then restart the app. Setup instructions are in
              README.md.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
