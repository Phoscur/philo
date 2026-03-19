/**
 * DHT11 Temperature and Humidity Sensor for Raspberry Pi
 * Should get a DHT22 sensor instead, as DHT11 is very inaccurate.
 * https://test-wetterstation.de/temperaturmessung-mit-dem-raspberry-pi

![GPIO Pins]https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#gpio) 

| Sensor Pin | GPIO Pin   |
| ---------- | :--------: |
| VCC | 5V Power (2 or 4) | Edit: Better use 3.3V (1 or 17) to avoid damage to the gpio pins. |
| GND | Ground (6 or 9)   |
| DAT | GPIO (7 or 11)    |

With Raspberry Pi OS 6+ (Bullseye and newer), the DHT11 sensor can be used via the new kernel driver.

Add to /boot/firmware/config.txt:
dtoverlay=dht11,gpiopin=4
 */

import { readFile } from 'fs/promises';

const DEVICE = 'iio:device0';

async function getTemperature() {
  const raw = await readFile(`/sys/bus/iio/devices/${DEVICE}/in_temp_input`, 'utf8');
  // Value is usually in millidegrees
  return parseInt(raw.trim()) / 1000;
}

async function getHumidity() {
  const raw = await readFile(`/sys/bus/iio/devices/${DEVICE}/in_humidityrelative_input`, 'utf8');
  // 65000 => 65.0 %
  return parseInt(raw.trim()) / 1000;
}

export async function getTemperatureHumidityMessage() {
  const temperature = await getTemperature();
  const humidity = await getHumidity();
  return `🌡️ ${temperature}°C, 💦 ${humidity}%`;
}

if (import.meta.url.endsWith(process.argv[1])) {
  getTemperatureHumidityMessage()
    .then((message) => {
      console.log(message);
    })
    // reports [Error: failed to read sensor] when the sensor is not connected
    .catch(console.error);
}
