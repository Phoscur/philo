import dayjs, { Dayjs } from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone' // dependent on utc plugin
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(duration)
dayjs.extend(relativeTime)

const { LOCATION_TIMEZONE, DATE_FORMAT, DAY_FORMAT, HOURS_FORMAT } = process.env

const dateFormat = DATE_FORMAT || 'D.M.YYYY H:mm'
const dayFormat = DAY_FORMAT || 'D. MMMM YYYY'
const hoursFormat = HOURS_FORMAT || 'HH:mm:ss'

export function changeTimezoneToLocal(time: Date | number | Dayjs) {
  return dayjs(time).tz(LOCATION_TIMEZONE || 'Europe/Berlin')
}

export function humanizeDuration(diff: number) {
  return dayjs.duration(diff).humanize()
}
export interface FormattedDate {
  date: Dayjs
  readonly fullFormatted: string
  readonly dayFormatted: string
  readonly hoursFormatted: string
}

export function getFormattedDate(now: Dayjs | number = Date.now()): FormattedDate {
  const date = dayjs(changeTimezoneToLocal(now))
  return {
    date,
    get fullFormatted() {
      return date.format(dateFormat)
    },
    get dayFormatted() {
      return date.format(dayFormat)
    },
    get hoursFormatted() {
      return date.format(hoursFormat)
    },
  }
}
