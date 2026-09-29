"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import "./schedule-calendar.css";

export type CalendarTone =
  | "available"
  | "requested"
  | "confirmed"
  | "resident"
  | "maintenance"
  | "blocked"
  | "event";

export type CalendarEntry = {
  id: string;
  title: string;
  subtitle?: string;
  startsAt: string;
  endsAt: string;
  tone: CalendarTone;
  editable?: boolean;
};

const DAY_MS = 86400000;
const START_HOUR = 5;
const END_HOUR = 23;
const HOUR_HEIGHT = 64;

function startOfWeek(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return date;
}

function dayKey(value: Date) {
  return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
}

type PositionedEntry = CalendarEntry & { lane: number; laneCount: number };
function positionOverlaps(entries: CalendarEntry[]): PositionedEntry[] {
  const sorted = [...entries].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const clusters: CalendarEntry[][] = [];
  let cluster: CalendarEntry[] = [], clusterEnd = 0;
  sorted.forEach((entry) => {
    const start = new Date(entry.startsAt).getTime(), end = new Date(entry.endsAt).getTime();
    if (cluster.length && start >= clusterEnd) { clusters.push(cluster); cluster = []; clusterEnd = 0; }
    cluster.push(entry); clusterEnd = Math.max(clusterEnd, end);
  });
  if (cluster.length) clusters.push(cluster);
  return clusters.flatMap((group) => {
    const laneEnds: number[] = [];
    const assigned = group.map((entry) => {
      const start = new Date(entry.startsAt).getTime();
      let lane = laneEnds.findIndex((end) => end <= start);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = new Date(entry.endsAt).getTime();
      return { entry, lane };
    });
    return assigned.map(({ entry, lane }) => ({ ...entry, lane, laneCount: laneEnds.length }));
  });
}

export function ScheduleLegend({ publicView = false }: { publicView?: boolean }) {
  const items: [CalendarTone, string][] = publicView
    ? [["event", "Food event"]]
    : [
        ["available", "Open"],
        ["requested", "Requested"],
        ["confirmed", "Confirmed"],
        ["resident", "Resident"],
        ["maintenance", "Maintenance"],
        ["blocked", "Closed"],
      ];
  return (
    <div className="calendar-legend" aria-label="Calendar legend">
      {items.map(([tone, label]) => (
        <span key={tone}><i className={`tone-${tone}`} />{label}</span>
      ))}
    </div>
  );
}

export function WeekSchedule({
  entries,
  onEmptySlot,
  onEntrySelect,
  emptyLabel = "Select open time",
}: {
  entries: CalendarEntry[];
  onEmptySlot?: (startsAt: Date, endsAt: Date) => void;
  onEntrySelect?: (entry: CalendarEntry) => void;
  emptyLabel?: string;
}) {
  const [anchor, setAnchor] = useState(() => new Date());
  const week = useMemo(() => startOfWeek(anchor), [anchor]);
  const days = Array.from({ length: 7 }, (_, index) => new Date(week.getTime() + index * DAY_MS));
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, index) => START_HOUR + index);
  const positionedByDay = new Map(days.map((day) => {
    const positioned = positionOverlaps(entries.filter((entry) => dayKey(new Date(entry.startsAt)) === dayKey(day)));
    return [dayKey(day), positioned] as const;
  }));
  const maxLanes = Math.max(1, ...Array.from(positionedByDay.values()).map((items) => Math.max(1, ...items.map((item) => item.laneCount))));
  const move = (amount: number) => setAnchor(new Date(anchor.getTime() + amount * 7 * DAY_MS));
  const selectSlot = (day: Date, event: React.MouseEvent<HTMLButtonElement>) => {
    if (!onEmptySlot) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const minutes = Math.max(0, Math.min((END_HOUR - START_HOUR) * 60 - 60, ((event.clientY - rect.top) / HOUR_HEIGHT) * 60));
    const rounded = Math.floor(minutes / 30) * 30;
    const start = new Date(day);
    start.setHours(START_HOUR, rounded, 0, 0);
    onEmptySlot(start, new Date(start.getTime() + 2 * 3600000));
  };
  return (
    <section className="week-calendar" aria-label="Weekly schedule">
      <div className="calendar-toolbar">
        <div>
          <button type="button" onClick={() => move(-1)} aria-label="Previous week"><ChevronLeft /></button>
          <button type="button" onClick={() => setAnchor(new Date())}>Today</button>
          <button type="button" onClick={() => move(1)} aria-label="Next week"><ChevronRight /></button>
        </div>
        <strong>{week.toLocaleDateString(undefined, { month: "long", day: "numeric" })} – {days[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</strong>
        <ScheduleLegend />
      </div>
      <div className="week-scroll">
        <div className="week-grid" style={{ "--calendar-height": `${hours.length * HOUR_HEIGHT}px`, minWidth: `${66 + 7 * Math.max(130, maxLanes * 92)}px` } as React.CSSProperties}>
          <div className="time-head" />
          {days.map((day) => <div className={`day-head ${dayKey(day) === dayKey(new Date()) ? "today" : ""}`} key={dayKey(day)}><span>{day.toLocaleDateString(undefined, { weekday: "short" })}</span><b>{day.getDate()}</b></div>)}
          <div className="time-axis">
            {hours.map((hour) => <span key={hour} style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}>{new Date(2020, 0, 1, hour).toLocaleTimeString(undefined, { hour: "numeric" })}</span>)}
          </div>
          {days.map((day) => {
            const dayEntries = positionedByDay.get(dayKey(day)) || [];
            return (
              <div className="day-column" key={dayKey(day)}>
                {onEmptySlot && <button type="button" className="slot-picker" aria-label={`${emptyLabel} on ${day.toLocaleDateString()}`} onClick={(event) => selectSlot(day, event)} />}
                {hours.map((hour) => <i key={hour} style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }} />)}
                {dayEntries.map((entry) => {
                  const start = new Date(entry.startsAt), end = new Date(entry.endsAt);
                  const startMinutes = start.getHours() * 60 + start.getMinutes() - START_HOUR * 60;
                  const duration = Math.max(30, (end.getTime() - start.getTime()) / 60000);
                  const top = Math.max(0, startMinutes / 60 * HOUR_HEIGHT);
                  const height = Math.max(34, Math.min(duration / 60 * HOUR_HEIGHT, hours.length * HOUR_HEIGHT - top));
                  const width = 100 / entry.laneCount;
                  return <button type="button" className={`calendar-block tone-${entry.tone} ${entry.editable ? "editable" : ""}`} key={entry.id} style={{ top, height, left: `calc(${entry.lane * width}% + 3px)`, right: "auto", width: `calc(${width}% - 5px)` }} title={`${entry.title} — ${start.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})}–${end.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})} — ${entry.subtitle || ""}${entry.editable ? " — Click to edit" : ""}`} onClick={() => entry.editable && onEntrySelect?.(entry)} disabled={!entry.editable} aria-label={`${entry.title}, ${entry.subtitle || "assignment"}, ${start.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})} to ${end.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})}`}><b>{entry.title}</b><span>{start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}–{end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>{entry.subtitle && <small>{entry.subtitle}</small>}{entry.editable && <em>Edit</em>}</button>;
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function MonthEvents({ entries }: { entries: CalendarEntry[] }) {
  const firstEvent = entries[0] ? new Date(entries[0].startsAt) : new Date();
  const [month, setMonth] = useState(() => new Date(firstEvent.getFullYear(), firstEvent.getMonth(), 1));
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = first.getDay();
  const gridStart = new Date(first.getTime() - offset * DAY_MS);
  const days = Array.from({ length: 42 }, (_, index) => new Date(gridStart.getTime() + index * DAY_MS));
  const move = (amount: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1));
  return (
    <section className="month-calendar" aria-label="Events calendar">
      <div className="calendar-toolbar">
        <div><button type="button" onClick={() => move(-1)} aria-label="Previous month"><ChevronLeft /></button><button type="button" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</button><button type="button" onClick={() => move(1)} aria-label="Next month"><ChevronRight /></button></div>
        <strong><CalendarDays /> {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong>
        <ScheduleLegend publicView />
      </div>
      <div className="month-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => <b className="month-weekday" key={label}>{label}</b>)}
        {days.map((day) => {
          const dayEntries = entries.filter((entry) => dayKey(new Date(entry.startsAt)) === dayKey(day));
          return <div className={`month-day ${day.getMonth() !== month.getMonth() ? "outside" : ""}`} key={dayKey(day)}><span>{day.getDate()}</span>{dayEntries.slice(0, 3).map((entry) => <article className="tone-event" key={entry.id}><b>{new Date(entry.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</b> {entry.title}<small>{entry.subtitle}</small></article>)}{dayEntries.length > 3 && <em>+{dayEntries.length - 3} more</em>}</div>;
        })}
      </div>
    </section>
  );
}
