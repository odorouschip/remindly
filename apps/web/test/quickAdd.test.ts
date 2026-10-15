import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "../lib/calendar/quickAdd";

// Thursday, Oct 15 2026, 10:00 local.
const NOW = new Date(2026, 9, 15, 10, 0);
const parse = (s: string) => parseQuickAdd(s, NOW);

describe("parseQuickAdd", () => {
  it.each([
    ["lunch with Sam fri at noon",         { title: "Lunch with Sam", date: "2026-10-16", time: "12:00", end: "13:00" }],
    ["dentist tomorrow 3pm",               { title: "Dentist", date: "2026-10-16", time: "15:00", end: "16:00" }],
    ["gym every monday 6-7pm #health",     { title: "Gym", date: "2026-10-19", time: "18:00", end: "19:00", recur: "Weekly", cat: "health" }],
    ["1:1 with Priya at 11",               { title: "1:1 with Priya", date: "2026-10-15", time: "11:00" }],
    ["standup daily 9:30 for 15 min",      { title: "Standup", date: "2026-10-16", time: "09:30", end: "09:45", recur: "Daily" }],
    ["flight 11pm-1am",                    { title: "Flight", time: "23:00", end: "23:59" }],
    ["dinner 10/20 at 7",                  { title: "Dinner", date: "2026-10-20", time: "19:00", end: "20:00" }],
    ["party on sat",                       { title: "Party", date: "2026-10-17", allDay: true }],
    ["trip in 2 weeks",                    { title: "Trip", date: "2026-10-29", allDay: true }],
    ["dinner tonight",                     { title: "Dinner", date: "2026-10-15", time: "19:00" }],
    ["birthday party the 20th 2-5pm",      { title: "Birthday party", date: "2026-10-20", time: "14:00", end: "17:00" }],
    ["meeting from 10 to 11:30",           { title: "Meeting", time: "10:00", end: "11:30" }],
    ["review on oct 3",                    { title: "Review", date: "2027-10-03" }],
    ["call mom next thursday at 4",        { title: "Call mom", date: "2026-10-22", time: "16:00" }],
  ])("%s", (input, expected) => {
    expect(parse(input)).toMatchObject(expected);
  });

  it("makes tasks from a prefix and keeps them all-day", () => {
    expect(parse("task: pay rent nov 1")).toMatchObject({ title: "Pay rent", date: "2026-11-01", isTask: true, allDay: true, time: "" });
    expect(parse("remind me to call the bank friday")).toMatchObject({ title: "Call the bank", date: "2026-10-16", isTask: true });
  });

  it("leaves numbers and look-alike words in the title", () => {
    expect(parse("buy 3 eggs")).toMatchObject({ title: "Buy 3 eggs", allDay: true, dateMentioned: false });
    expect(parse("lie in the sun")).toMatchObject({ title: "Lie in the sun", dateMentioned: false });
    expect(parse("may 5")).toMatchObject({ title: "", date: "2027-05-05", dateMentioned: true });
  });

  it("recognizes a bare date for jumping", () => {
    expect(parse("next friday")).toMatchObject({ title: "", date: "2026-10-16", dateMentioned: true, allDay: true });
  });
});
