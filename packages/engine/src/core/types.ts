/** Unix epoch milliseconds, always UTC. */
export type UtcMs = number;

/** IANA time zone name, e.g. "Europe/London". */
export type IanaTz = string;

/** Wall-clock time of day "HH:mm". */
export type LocalTime = `${number}:${number}`;
