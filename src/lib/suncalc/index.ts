import SunCalc from 'suncalc'
//import 'dotenv/config'
import { changeTimezoneToLocal, humanizeDuration, getFormattedDate, FormattedDate } from '../time'

const { LOCATION_LATITUDE, LOCATION_LONGITUDE, LOCATION_TIMEZONE } = process.env

export interface Moonset extends FormattedDate {
  readonly diff: number
  readonly humanizedDiff: string
}

export interface Sunset extends FormattedDate {
  readonly diff: number
  readonly humanizedDiff: string
  readonly moon: Moonset
}

export function getNextSunset(tomorrow = false): Sunset {
  const now = new Date()
  const noon = new Date(
    now.getFullYear(),
    now.getMonth(),
    tomorrow ? now.getDate() + 1 : now.getDate(),
    12,
    0,
    0
  )
  const { sun, moon } = getNextSunMoonSet(noon)
  const localSunset = changeTimezoneToLocal(sun)
  const localMoonset = changeTimezoneToLocal(moon)
  const formatted: Sunset = {
    get diff() {
      return localSunset.diff(Date.now())
    },
    get humanizedDiff() {
      return humanizeDuration(this.diff)
    },
    ...getFormattedDate(localSunset),
    moon: {
      get diff() {
        return localMoonset.diff(Date.now())
      },
      get humanizedDiff() {
        return humanizeDuration(this.diff)
      },
      ...getFormattedDate(localMoonset),
    },
  }
  return formatted
}

export function getAlignmentDate(
  date: Date,
  latitude: number,
  longitude: number,
  timeZone: string
): { sun: Date; moon: Date; diff: number } {
  // Calculate the sunset and moonset times for the current date in the local time zone
  const times = SunCalc.getTimes(date, latitude, longitude)
  const moonTimes = SunCalc.getMoonTimes(date, latitude, longitude)

  // Check if the moonset occurs within the specified time frame after the sunset
  /* if (
    times.sunset &&
    moonTimes.set &&
    Math.abs(times.sunset.getTime() - moonTimes.set.getTime()) <= 3 * 60 * 60 * 1000
  ) {
    const timeDiff = Math.abs(times.sunset.getTime() - moonTimes.set.getTime())

    console.log('Alignment Occurrence:')
    console.log('Date:', date.toLocaleString('de-DE', { timeZone }).substring(0, 10))
    console.log('Sunset:', times.sunset.toLocaleString('de-DE', { timeZone }))
    console.log('Moonset:', moonTimes.set.toLocaleString('de-DE', { timeZone }))
    console.log('Time Difference:', Math.round(timeDiff / (60 * 1000)), 'minutes', '\n')
  } */
  return {
    sun: times.sunset,
    moon: moonTimes.set,
    diff: Math.abs(times.sunset.getTime() - moonTimes.set.getTime()),
  }
}

function getNextSunMoonSet(date: Date) {
  if (!LOCATION_LATITUDE) {
    console.error(
      'Missing env config LOCATION_*:',
      LOCATION_TIMEZONE,
      LOCATION_LATITUDE,
      LOCATION_LONGITUDE
    )
  }
  return getAlignmentDate(
    date,
    parseFloat(LOCATION_LATITUDE!),
    parseFloat(LOCATION_LONGITUDE!),
    LOCATION_TIMEZONE!
  )
}

if (require.main === module) {
  const test = async () => {
    const { diff, humanizedDiff, moon } = getNextSunset()
    const { hoursFormatted, diff: diff2, moon: moon2 } = getNextSunset(true)
    console.log(
      `sunset ${diff > 0 ? 'is next in' : 'was'}`,
      `${humanizedDiff}${diff < 0 ? ' ago' : ''}`,
      `${Math.round(diff / (60 * 1000))} minutes`
    )
    console.log(
      `moonset ${moon.diff > 0 ? 'is next in' : 'was'}`,
      `${moon.humanizedDiff}${moon.diff < 0 ? ' ago' : ''}`,
      `${Math.round(moon.diff / (60 * 1000))} minutes`,
      `(${Math.round((moon.diff - diff) / (60 * 1000))} minutes later)`
    )
    console.log('\nsunset tomorrow is at', hoursFormatted)
    console.log(
      'moonset tomorrow is',
      Math.round((moon2.diff - diff2) / (60 * 1000)),
      'minutes later'
    )
  }
  test()
}
