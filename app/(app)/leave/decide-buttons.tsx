"use client";

import { useState } from "react";
import { decideLeave } from "./actions";

export function DecideButtons({ id }: { id: string }) {
  const [note, setNote] = useState("");
  const decide = decideLeave.bind(null, id);

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        style={{ minWidth: 140 }}
      />
      <form action={decide}>
        <input type="hidden" name="decision" value="approved" />
        <input type="hidden" name="note" value={note} />
        <button className="btn small" type="submit">
          Approve
        </button>
      </form>
      <form
        action={decide}
        onSubmit={(e) => {
          if (!confirm("Decline this request?")) e.preventDefault();
        }}
      >
        <input type="hidden" name="decision" value="rejected" />
        <input type="hidden" name="note" value={note} />
        <button className="btn small ghost" type="submit">
          Decline
        </button>
      </form>
    </div>
  );
}
