import axios from 'axios'
import { changeTimezoneToLocal, humanizeDuration } from './time'

const { LOCATION_LATITUDE, LOCATION_LONGITUDE } = process.env

export async function getNextSunset(tomorrow = false) {
  const apiUrl = `https://api.sunrise-sunset.org/json?lat=${LOCATION_LATITUDE}&lng=${LOCATION_LONGITUDE}&formatted=0&${
    tomorrow ? 'date=tomorrow' : ''
  }`
  // console.log('Sundown timing from', apiUrl)
  const { data } = await axios.get(apiUrl)
  const sunset = data.results.sunset
  const localSunset = changeTimezoneToLocal(sunset)
  return {
    date: localSunset,
    get diff() {
      return localSunset.diff(Date.now())
    },
    get humanizedDiff() {
      return humanizeDuration(this.diff)
    },
  } 
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
    console.log(
      'sundown tommorow is in',
      humanizedDiff2,
      diff2
    )
  }
  test()
}
