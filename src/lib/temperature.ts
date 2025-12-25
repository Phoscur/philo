/**
# [DHT11 setup](https://github.com/momenso/node-dht-sensor)

Connect pins 2, 6 and 7 to VCC, GND and DAT:

![GPIO Pins]https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#gpio) 

| Sensor Pin | GPIO Pin   |
| ---------- | :--------: |
| VCC | 5V Power (2 or 4) | Edit: Better use 3.3V (1 or 17) to avoid damage to the gpio pins. |
| GND | Ground (6 or 9)   |
| DAT | GPIO (7 or 11)    |

Resources:
- https://test-wetterstation.de/temperaturmessung-mit-dem-raspberry-pi


### Installing on Raspberry Pi 5 (libgpiod requirement)

When running node-dht-sensor on a Raspberry Pi 5 (or newer), you must install libgpiod (and its development headers) before you build. If you try to install the module with --use_libgpiod=true without having libgpiod-dev installed, the build will fail.

For Raspberry Pi OS (Debian-based), use:

```sh
sudo apt-get update
sudo apt-get install -y libgpiod-dev
```

After installing libgpiod-dev, build node-dht-sensor with:

```sh
npm install node-dht-sensor --use_libgpiod=true
```

> Note: Specifying --use_libgpiod=true compiles and links against libgpiod for GPIO access, because the BCM2835 library does not work on Raspberry Pi 5’s architecture. If you omit --use_libgpiod=true, node-dht-sensor defaults to using BCM2835, which is compatible with older Raspberry Pi models.
 */
const DHT_VERSION = 11;
const GPIO_PIN = 4;

interface SensorResults {
  temperature: number;
  humidity: number;
}

export async function readTemperatureSensor(): Promise<SensorResults> {
  // TODO catch error? and/or use API instead
  const sensor = (await import('node-dht-sensor')).default;
  return new Promise((resolve, reject) => {
    sensor.read(DHT_VERSION, GPIO_PIN, function (err: any, temperature: number, humidity: number) {
      if (err) {
        return reject(err);
      }
      resolve({
        temperature,
        humidity,
      });
    });
  });
}

export async function getTemperatureHumidityMessage() {
  const { temperature, humidity } = await readTemperatureSensor();
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
