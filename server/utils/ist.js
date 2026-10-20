/**
 * IST (Indian Standard Time) Utility — Asia/Kolkata
 * All time operations in the system must use this module.
 */

const IST_TZ = 'Asia/Kolkata';

/** Current IST date string YYYY-MM-DD */
function getISTDateString(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: IST_TZ });
}

/** Format a Date to IST time string e.g. "09:30 AM" */
function formatISTTime(date) {
  return new Date(date).toLocaleTimeString('en-IN', {
    timeZone: IST_TZ, hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

/** Format a Date to full IST date+time string */
function formatISTDateTime(date) {
  return new Date(date).toLocaleString('en-IN', {
    timeZone: IST_TZ, day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

/**
 * Build a UTC Date object from an IST date string and hour/minute.
 * IST = UTC+5:30, so subtract 5h 30m to get UTC.
 */
function buildISTDate(dateStr, hour, minute = 0) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour - 5, minute - 30));
}

/** Get current moment as IST-adjusted Date (useful for comparisons) */
function getISTNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: IST_TZ }));
}

module.exports = { IST_TZ, getISTDateString, getISTNow, formatISTTime, formatISTDateTime, buildISTDate };
