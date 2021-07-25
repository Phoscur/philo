import axios from 'axios'
import { changeTimezoneLondonToLocal, humanizeDuration } from './time'

const { LOCATION_LATITUDE, LOCATION_LONGITUDE } = process.env

export default async function getNextSundownMS(tomorrow = false) {
  const { data } = await axios.get(
    `https://api.sunrise-sunset.org/json?lat=${LOCATION_LATITUDE}&lng=${LOCATION_LONGITUDE}&formatted=0&${
      tomorrow ? 'date=tomorrow' : ''
    }`
  )
  const sunset = data.results.sunset
  const localSunset = changeTimezoneLondonToLocal(sunset)
  return localSunset.diff(Date.now())
}

if (require.main === module) {
  const test = async () => {
    const diff = await getNextSundownMS()
    const diff2 = await getNextSundownMS(true)
    console.log(
      'sundown',
      diff > 0 ? 'is next in' : 'was',
      humanizeDuration(diff),
      diff < 0 ? 'ago' : '',
      diff
    )
    console.log(
      'sundown tommorow is in',
      humanizeDuration(diff2),
      diff2
    )
  }
  test()
}
