import axios from 'axios'
import { changeTimezoneToLocal, humanizeDuration, getFormattedDate, FormattedDate } from './time'

const { LOCATION_LATITUDE, LOCATION_LONGITUDE } = process.env
export interface Sunset extends FormattedDate {
  readonly diff: number
  readonly humanizedDiff: string
}

export async function getNextSunset(tomorrow = false): Promise<Sunset> {
  const apiUrl = `https://api.sunrise-sunset.org/json?lat=${LOCATION_LATITUDE}&lng=${LOCATION_LONGITUDE}&formatted=0&${
    tomorrow ? 'date=tomorrow' : ''
  }`
  // console.log('Sundown timing from', apiUrl)
  const { data } = await axios.get(apiUrl)
  const sunset = data.results.sunset
  const localSunset = changeTimezoneToLocal(sunset)
  const formatted: Sunset = {
    get diff() {
      return localSunset.diff(Date.now())
    },
    get humanizedDiff() {
      return humanizeDuration(this.diff)
    },
    ...getFormattedDate(localSunset),
  }
  return formatted
}

if (require.main === module) {
  const test = async () => {
    const { diff, humanizedDiff } = await getNextSunset()
    const { diff: diff2, humanizedDiff: humanizedDiff2 } = await getNextSunset(true)
    console.log(
      'sundown',
      diff > 0 ? 'is next in' : 'was',
      humanizedDiff,
      diff < 0 ? 'ago' : '',
      diff
    )
    console.log('sundown tommorow is in', humanizedDiff2, diff2)
  }
  test()
}
