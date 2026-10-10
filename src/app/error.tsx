"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="panel">
      <h1>We couldn’t load this page.</h1>
      <p>
        Your saved data hasn’t changed. Check your connection and try again.
      </p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
