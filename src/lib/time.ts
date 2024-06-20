import dayjs, { Dayjs } from 'dayjs/esm';
import utc from 'dayjs/esm/plugin/utc';
import timezone from 'dayjs/esm/plugin/timezone'; // dependent on utc plugin
import duration from 'dayjs/esm/plugin/duration';
import relativeTime from 'dayjs/esm/plugin/relativeTime';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(duration);
dayjs.extend(relativeTime);

const {
  LOCATION_TIMEZONE,
  DATE_FORMAT,
  DAY_FORMAT,
  DAY_FOLDER_FORMAT,
  MONTH_FOLDER_FORMAT,
  HOURS_FORMAT,
} = process.env;

const dateFormat = DATE_FORMAT || 'D.M.YYYY H:mm';
const dayFormat = DAY_FORMAT || 'D. MMMM YYYY';
const dayFolderFormat = DAY_FOLDER_FORMAT || 'YYYY-MM-DD';
const monthFolderFormat = MONTH_FOLDER_FORMAT || 'YYYY-MM';
const hoursFormat = HOURS_FORMAT || 'HH:mm:ss';

export function changeTimezoneToLocal(time: Date | number | Dayjs) {
  return dayjs(time).tz(LOCATION_TIMEZONE || 'Europe/Berlin');
}

export function humanizeDuration(diff: number) {
  return dayjs.duration(diff).humanize();
}
export interface FormattedDate {
  date: Dayjs;
  readonly fileNameFormatted: string;
  readonly fullFormatted: string;
  readonly dayFormatted: string;
  readonly folderDayFormatted: string;
  readonly folderMonthFormatted: string;
  readonly hoursFormatted: string;
}

export function getFormattedDate(now: Dayjs | number = Date.now()): FormattedDate {
  const date = dayjs(changeTimezoneToLocal(now));
  return {
    date,
    get folderDayFormatted() {
      return date.format(dayFolderFormat);
    },
    get folderMonthFormatted() {
      return date.format(monthFolderFormat);
    },
    get fileNameFormatted() {
      return date.format('YYYY-MM-DD--HH-mm');
    },
    get fullFormatted() {
      return date.format(dateFormat);
    },
    get dayFormatted() {
      return date.format(dayFormat);
    },
    get hoursFormatted() {
      return date.format(hoursFormat);
    },
  };
}
