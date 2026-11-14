import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty">
      <h1>Title not found.</h1>
      <p>It may not belong to this collection.</p>
      <Link className="button" href="/library">
        Back to library
      </Link>
    </div>
  );
}
