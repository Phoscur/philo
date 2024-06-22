import SunCalc from 'suncalc';

export class SunMoonTime {
  constructor(
    readonly latitude = parseFloat(`${process.env.LOCATION_LATITUDE}`),
    readonly longitude = parseFloat(`${process.env.LOCATION_LONGITUDE}`),
    readonly timeZone = `${process.env.LOCATION_TIMEZONE}`,
    public today: Date = new Date()
  ) {
    this.resetToday(today);
  }

  get tomorrow() {
    return this.addDay(this.today);
  }

  addDay(date: Date, days = 1, hour = 12) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, hour, 0, 0);
  }

  /**
   * Reset "today", always noon!
   * @param date
   */
  resetToday(date = new Date()) {
    this.today = new Date(date.valueOf());
    this.today.setHours(12, 0, 0, 0);
    return this.today;
  }

  getSunset(date = this.today): Date {
    const { sunset } = SunCalc.getTimes(date, this.latitude, this.longitude);
    return sunset;
  }

  getSunsetDiff(date = this.today, now = date): number {
    return this.getSunset(date).getTime() - now.getTime();
  }

  /** not every date has a moonset everywhere! */
  getMoonset(date = this.today): Date | undefined {
    const { set } = SunCalc.getMoonTimes(date, this.latitude, this.longitude);
    return set;
  }

  getAlignment(date = this.today) {
    const sun = this.getSunset(date);
    let moon = this.getMoonset(date);
    let diff = Number.POSITIVE_INFINITY;
    if (moon) {
      diff = sun.getTime() - moon.getTime();
    }
    // if the moonset was before the sunset, we need to check the moonset of the next day
    if (diff > 0) {
      const morrowset = this.getMoonset(this.addDay(date));
      if (morrowset) {
        diff = sun.getTime() - morrowset.getTime();
        moon = morrowset;
      }
    }
    return {
      sun,
      moon,
      minutes: Math.floor(diff / 1000 / 60),
    };
  }

  async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

if (import.meta.url.endsWith(process.argv[1].split(/\/|\\/).pop() as string)) {
  const year = 2024;
  const maxHours = 4;
  const sunMoonTime = new SunMoonTime();
  for (let month = 0; month < 12; month++) {
    for (let day = 1; day < 32; day++) {
      const date = new Date(year, month, day, 12);
      if (date.getMonth() !== month) {
        continue;
      }
      const { sun, moon, minutes } = sunMoonTime.getAlignment(date);
      if (!moon) {
        continue;
      }
      if (Math.abs(minutes) > 60 * maxHours) {
        continue;
      }
      const { azimuth } = SunCalc.getMoonPosition(sun, sunMoonTime.latitude, sunMoonTime.longitude);
      const angle = azimuth * (180 / Math.PI) + 180; // azimuth needs to be converted from -180° to 180° to 0° to 360°
      if (angle < 230) {
        continue;
      }
      const illumination = SunCalc.getMoonIllumination(sun).fraction;
      if (illumination < 0.05) {
        //continue
      }
      console.log(
        (sun.getDate() < 10 ? ' ' : '') +
          sun.toLocaleString('de-DE', { timeZone: sunMoonTime.timeZone }),
        '|',
        illumination.toFixed(2),
        '|',
        (moon.getDate() < 10 ? ' ' : '') +
          moon.toLocaleString('de-DE', { timeZone: sunMoonTime.timeZone }),
        '|',
        angle.toFixed(2) + '°',
        '|',
        -minutes
      );
    }
  }
}
