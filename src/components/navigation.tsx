"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  Library,
  Sparkles,
  SlidersHorizontal,
  Settings,
  Clapperboard,
} from "lucide-react";
const links = [
  ["/", "Tonight", House],
  ["/library", "Library", Library],
  ["/recommendations", "For you", Sparkles],
  ["/taste", "Your taste", SlidersHorizontal],
  ["/settings", "Settings & data", Settings],
] as const;
export function Navigation() {
  const path = usePathname();
  return (
    <aside className="sidebar">
      <Link href="/" className="brand">
        <Clapperboard size={27} />
        <span>
          MIDO<span className="brand-light">WATCH</span>
          <small>THE PERSONAL COLLECTION</small>
        </span>
      </Link>
      <p className="nav-caption">YOUR SCREENING ROOM</p>
      <nav aria-label="Main navigation">
        {links.map(([href, label, Icon]) => (
          <Link
            key={href}
            href={href}
            className={path === href ? "active" : ""}
          >
            <Icon size={19} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <span className="live-dot" /> A little more intentional.
        <br />
        <small>A collection shaped by you.</small>
      </div>
    </aside>
  );
}
