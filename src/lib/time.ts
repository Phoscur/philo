import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone' // dependent on utc plugin
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(duration)
dayjs.extend(relativeTime)

const { LOCATION_TIMEZONE } = process.env

export function changeTimezoneToLocal(time: Date|number) {
  return dayjs(time).tz(LOCATION_TIMEZONE || 'Europe/Berlin')
}

export function humanizeDuration(diff: number) {
  return dayjs.duration(diff).humanize()
}