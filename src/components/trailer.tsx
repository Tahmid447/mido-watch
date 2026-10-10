"use client";
import { useRef, useState } from "react";
import { Play, X } from "lucide-react";
import type { z } from "zod";
import { trailerSchema } from "@/lib/model";
export function Trailer({
  trailer,
  title,
}: {
  trailer: z.infer<typeof trailerSchema> | null;
  title: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    button = useRef<HTMLButtonElement>(null),
    [open, setOpen] = useState(false);
  if (
    !trailer ||
    !trailer.official ||
    trailer.site !== "YouTube" ||
    !/^[A-Za-z0-9_-]{11}$/.test(trailer.key)
  )
    return null;
  const close = () => {
    dialog.current?.close();
    setOpen(false);
    button.current?.focus();
  };
  return (
    <>
      <button
        ref={button}
        className="button"
        type="button"
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        <Play size={16} /> Watch Trailer
      </button>
      <dialog
        ref={dialog}
        className="trailer-dialog"
        aria-label={`${title} trailer`}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
      >
        <div className="trailer-heading">
          <div>
            <p className="eyebrow gold">OFFICIAL TRAILER</p>
            <h2>{title}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close trailer"
            onClick={close}
          >
            <X />
          </button>
        </div>
        {open && (
          <iframe
            title={`${title} official trailer`}
            src={`https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=0&rel=0`}
            allow="encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        )}
        <p className="small">{trailer.name} · YouTube</p>
      </dialog>
    </>
  );
}
