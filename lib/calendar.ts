export const EVENT_CATEGORIES = [
  "test",
  "service",
  "delivery",
  "collection",
  "meeting",
  "visitor",
  "training",
  "other",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  test: "Test / CVRT",
  service: "Service",
  delivery: "Delivery",
  collection: "Collection",
  meeting: "Meeting",
  visitor: "Visitor on site",
  training: "Training",
  other: "Other",
};

export type CalendarEvent = {
  id: string;
  title: string;
  category: EventCategory;
  start_date: string;
  end_date: string;
  note: string | null;
  asset_type: string | null;
  asset_id: string | null;
};

export function readCategory(v: FormDataEntryValue | null): EventCategory {
  const s = String(v ?? "other");
  return (EVENT_CATEGORIES as readonly string[]).includes(s)
    ? (s as EventCategory)
    : "other";
}
