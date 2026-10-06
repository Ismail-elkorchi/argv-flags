const SHORT_FLAG_PATTERN = /^-[A-Za-z0-9]$/u;
const LONG_FLAG_PATTERN = /^--[A-Za-z0-9][A-Za-z0-9_-]*$/u;

/** Checks configured short flag syntax. */
export const isShortFlag = (flag: string): boolean => SHORT_FLAG_PATTERN.test(flag);
/** Checks configured and scanned long flag syntax. */
export const isLongFlag = (flag: string): boolean => LONG_FLAG_PATTERN.test(flag);
