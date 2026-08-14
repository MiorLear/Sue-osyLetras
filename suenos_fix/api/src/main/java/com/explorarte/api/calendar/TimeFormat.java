package com.explorarte.api.calendar;

/** Wall-clock times are stored as VARCHAR(10) strings rather than a time type,
 * so the format is enforced on the way in. Accepts 24-hour "H:mm"/"HH:mm". */
final class TimeFormat {

    static final String PATTERN = "^([01]?\\d|2[0-3]):[0-5]\\d$";
    static final String MESSAGE = "must be a time in HH:mm format";

    private TimeFormat() {
    }
}
