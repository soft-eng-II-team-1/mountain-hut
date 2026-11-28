// Dates and times in the hut's local time zone.
// Slots are stored as timestamptz (UTC), but weeks and the time of day of a slot
// are defined in local hut time, also across a daylight saving time change

export const HUT_TIME_ZONE = 'Europe/Rome';

const DAY_MS = 24 * 60 * 60 * 1000;

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: HUT_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
});

// "2026-12-07" -> [2026, 12, 7]
const parseDay = (day) => day.split('-').map(Number);

// Wall clock fields (in hut time) of an instant given in ms
const localParts = (ms) => {
    const parts = Object.fromEntries(
        partsFormatter.formatToParts(new Date(ms)).map(({ type, value }) => [type, Number(value)]),
    );
    return parts; // { year, month, day, hour, minute, second, ... }
};

// Offset in ms of hut time from UTC at the given instant (+1h in winter, +2h in summer)
const offsetAt = (ms) => {
    const p = localParts(ms);
    const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return wallAsUtc - (ms - (ms % 1000));
};

// Instant of a wall clock time in hut time. Day overflow is allowed (e.g. day 35 -> next month)
const localToUtc = (year, month, day, hour = 0, minute = 0, second = 0, millis = 0) => {
    const wall = Date.UTC(year, month - 1, day, hour, minute, second, millis);
    // second pass corrects the offset when the first guess falls on the other side of a DST change
    const guess = wall - offsetAt(wall);
    return new Date(wall - offsetAt(guess));
};

// True if "YYYY-MM-DD" is a Monday (calendar date, independent of the time zone)
export const isMonday = (day) => {
    const [y, m, d] = parseDay(day);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 1;
};

// [start, end) of the week starting on the Monday "YYYY-MM-DD", from 00:00 hut time
export const weekBounds = (monday) => {
    const [y, m, d] = parseDay(monday);
    return { start: localToUtc(y, m, d), end: localToUtc(y, m, d + 7) };
};

// Calendar days from day "YYYY-MM-DD" `from` to day `to`
export const daysBetween = (from, to) => {
    const [y1, m1, d1] = parseDay(from);
    const [y2, m2, d2] = parseDay(to);
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS);
};

// Same local hut time, `days` days later (12:00 stays 12:00 also across a DST change)
export const shiftByDays = (date, days) => {
    const p = localParts(date.getTime());
    return localToUtc(p.year, p.month, p.day + days, p.hour, p.minute, p.second, date.getUTCMilliseconds());
};