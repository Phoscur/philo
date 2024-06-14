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
  readonly moon?: Moonset
  readonly sunMoonDiff: number
}

export function getNextSunset(tomorrow = false, now = new Date()): Sunset {
  const noon = new Date(
    now.getFullYear(),
    now.getMonth(),
    tomorrow ? now.getDate() + 1 : now.getDate(),
    12,
    0,
    0
  )
  const { sun, moon, diff } = getNextSunMoonSet(noon)
  const localSunset = changeTimezoneToLocal(sun)
  const localMoonset = changeTimezoneToLocal(moon!)
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
    sunMoonDiff: diff,
  }
  return formatted
}

export function getAlignmentDate(
  date: Date,
  latitude: number,
  longitude: number,
  timeZone: string
): { sun: Date; moon?: Date; diff: number } {
  // Calculate the sunset and moonset times for the current date in the local time zone
  const times = SunCalc.getTimes(date, latitude, longitude)
  const moonTimes = SunCalc.getMoonTimes(date, latitude, longitude)
  // TODO need to check the day after as well to get the moonset following sometimes after midnight
  const morrow = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
    12, // noon
    0,
    0
  )
  const moonTimesMorrow = SunCalc.getMoonTimes(morrow, latitude, longitude)
  //console.log('sun', times)
  //console.log('moon', moonTimes)

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
  let moon,
    diff = -1
  if (moonTimes.set) {
    diff = times.sunset.getTime() - moonTimes.set.getTime()
    moon = moonTimes.set
  }
  // if the moonset was before the sunset, we need to check the moonset of the next day
  if (diff > 0 && moonTimesMorrow.set) {
    diff = times.sunset.getTime() - moonTimesMorrow.set.getTime()
    moon = moonTimesMorrow.set
  }
  return {
    sun: times.sunset,
    moon,
    diff,
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
    // TODO also check if the direction is (North) West
    const date = new Date(Date.UTC(2024, 5, 10, 0)) // 10th of June 2024, Noon
    const { diff, humanizedDiff, moon, fullFormatted, sunMoonDiff } = getNextSunset(false, date)
    const { hoursFormatted, diff: diff2, moon: moon2 } = getNextSunset(true, date)
    if (!date) {
      console.log(
        `sunset ${diff > 0 ? 'is next in' : 'was'}`,
        `${humanizedDiff}${diff < 0 ? ' ago' : ''}`,
        `(${Math.round(diff / (60 * 1000))} minutes)`
      )
      console.log('\nsunset tomorrow is at', hoursFormatted)
    } else {
      //const date = new Date(Date.UTC(2024, 5, 10, 0));
      console.log(date.toString()) // Lokale Zeit
      console.log('UTC: ', date.toISOString()) // UTC Zeit
      console.log('Date:', date.toLocaleString('de-DE', { timeZone: LOCATION_TIMEZONE }))
      console.log('Sunset:', fullFormatted)
      //console.log('Diff:', diff, 'ms -', humanizedDiff)
    }
    if (!moon) {
      return
    }
    if (!date) {
      console.log(
        moon.hoursFormatted,
        `moonset ${moon.diff > 0 ? 'is next in' : 'was'}`,
        `${moon.humanizedDiff}${moon.diff < 0 ? ' ago' : ''}`,
        `(${Math.round(moon.diff / (60 * 1000))} minutes`,
        `- ${Math.round((moon.diff - diff) / (60 * 1000))} minutes later)`
      )
    } else {
      console.log('Moonset:', moon.fullFormatted)
      //console.log('Diff:', moon.diff, 'ms -', moon.humanizedDiff)
      console.log('Diff:', sunMoonDiff, 'ms -', humanizeDuration(sunMoonDiff))
    }
    if (!moon2) {
      return
    }
    if (!date) {
      console.log(
        moon2.hoursFormatted,
        'moonset tomorrow is',
        Math.round((moon2.diff - diff2) / (60 * 1000)),
        'minutes later'
      )
    } else {
      console.log('Moonset:', moon2.fullFormatted)
      //console.log('Diff:', moon2.diff, 'ms -', moon2.humanizedDiff)
    }
  }
  test()
}
