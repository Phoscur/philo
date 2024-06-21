/**
# [DHT11 setup](https://github.com/momenso/node-dht-sensor)

Connect pins 2, 6 and 7 to VCC, GND and DAT:

![GPIO Pins](https://www.raspberrypi.org/documentation/usage/gpio/images/GPIO-Pinout-Diagram-2.png) 

| Sensor Pin | GPIO Pin   |
| ---------- | :--------: |
| VCC | 5V Power (2 or 4) |
| GND | Ground (6 or 9)   |
| DAT | GPIO (7 or 11)    |

Resources:
- https://test-wetterstation.de/temperaturmessung-mit-dem-raspberry-pi
- https://www.raspberrypi.org/documentation/usage/gpio/
 */
const DHT_VERSION = 11;
const GPIO_PIN = 4;

interface SensorResults {
  temperature: number;
  humidity: number;
}

export function readTemperatureSensor(): Promise<SensorResults> {
  // TODO catch error? and/or use API instead
  const sensor = require('node-dht-sensor');
  return new Promise((resolve, reject) => {
    sensor.read(
      DHT_VERSION,
      GPIO_PIN,
      function (err: Error, temperature: number, humidity: number) {
        if (err) {
          return reject(err);
        }
        resolve({
          temperature,
          humidity,
        });
      }
    );
  });
}

export async function getTemperatureHumidityMessage() {
  const { temperature, humidity } = await readTemperatureSensor();
  return `Current temperature: ${temperature}°C, humidity: ${humidity}%`;
}

if (import.meta.url.endsWith(process.argv[1])) {
  readTemperatureSensor()
    .then(({ temperature, humidity }) => {
      console.log(`temp: ${temperature}°C, humidity: ${humidity}%`);
    })
    .catch(console.error);
}
