"use client";

import { useActionState } from "react";
import { mondayOf } from "@/lib/verti-block";
import { createWeek, type FormState } from "./actions";

export function NewWeekForm() {
  const [state, formAction] = useActionState<FormState, FormData>(
    createWeek,
    {},
  );
  const thisMonday = mondayOf(new Date());

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}
      <div className="del-grid" style={{ alignItems: "end" }}>
        <label>
          Week commencing (any day that week)
          <input type="date" name="week_commencing" defaultValue={thisMonday} required />
        </label>
        <label>
          Operator name
          <input name="operator_name" />
        </label>
        <button className="btn" type="submit">
          Start the sheet
        </button>
      </div>
    </form>
  );
}
