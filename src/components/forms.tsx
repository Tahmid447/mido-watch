"use client";
import { useActionState, type ReactNode } from "react";
import { mutate, type Result } from "@/app/actions";
export function ActionForm({
  children,
  action,
  titleId,
  submit = "Save changes",
  handler = mutate,
  className = "",
}: {
  children?: ReactNode;
  action?: string;
  titleId?: string;
  submit?: string;
  handler?: (s: Result, f: FormData) => Promise<Result>;
  className?: string;
}) {
  const [state, dispatch, pending] = useActionState(handler, {});
  return (
    <form action={dispatch} className={`form ${className}`}>
      {action && <input type="hidden" name="action" value={action} />}
      {titleId && <input type="hidden" name="title_id" value={titleId} />}
      <fieldset disabled={pending}>
        {children}
        <button className="button primary" type="submit">
          {pending ? "Saving…" : submit}
        </button>
      </fieldset>
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="success">
          {state.message}
        </p>
      )}
    </form>
  );
}
