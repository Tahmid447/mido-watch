import Link from "next/link";
import { Plus } from "lucide-react";
import { session, profile } from "@/lib/data";
import { Navigation } from "@/components/navigation";
import { signOut } from "@/app/actions";
export const dynamic = "force-dynamic";
export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await session();
  const p = await profile();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Navigation />
      <div className="workspace">
        <header className="topbar">
          <span className="topbar-note">
            A world of stories. <strong>Your point of view.</strong>
          </span>
          <div className="topbar-actions">
            <span className="region">{p.region}</span>
            <Link className="button primary" href="/add">
              <Plus size={16} /> Add title
            </Link>
            <form action={signOut}>
              <button className="avatar" title="Sign out" aria-label="Sign out">
                {p.display_name.slice(0, 1) || "M"}
              </button>
            </form>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="page-footer">
          MIDO WATCH <span>Private by design. Curated by you.</span>
        </footer>
      </div>
    </div>
  );
}
