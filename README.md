# Philopho, Raspberry Pi telegraphing Timelapse Photographer

Photo & Timelapse Telegram Bot

### MAJOR Features

- timelapses with libcamera, ffmpeg rendering & publishing on Github Pages

- save to folders shots & vids (with data.json & readme.md)
- upload to git and aws glacier
- self cleaning rotating storage

- !! automatically take a timelapse every day !!

### TODO

- update @joist/di to v4
- indent 4 spaces, default to double quotes?

- compress (zip?) before glacier upload

Fix regressions, lost features:

- Glacier Backup
- Check/Retry Github Upload
- Destructive Rotation

Create Gallery and publish on github.io!

Discord API exploration and rearchitectured Bot: Sunseph

## Using `libcamera`

We have this new utility since Bullseye (buster 2022).
While taking the pictures for timelapses goes through `libcamera-still`, you can also use other commands,
e.g. Videostreaming `libcamera-vid -t 0 --width 1920 --height 1080 --codec h264 --inline --listen -o tcp://0.0.0.0:8888`
and `vlc tcp/h264://192.168.2.138:8888/` to manually adjust the objective, so you get sharp images (or `libcamera-vid -t 0 --width 4056 --height 3040 --codec mjpeg --framerate 10 --inline --listen -o tcp://0.0.0.0:8888` and `vlc tcp/mjpeg://192.168.2.150:8888/`).

I've failed to use this to make captures with more than 370 frames on my RaspberryPi 3 (it just crashes without a stack), so now we are back to scheduling each frame ourselves again. Also, I tried both packages `node-libcamera` and `libcamera` (which is a bit smaller), but we might aswell have full control about the spawned process without using additional dependencies

## Dependencies

On Debian (Bullseye),
install nodejs (with Node Version Manager) and ffmpeg

Test `libcamera-still` commands, if necessary edit the `dtoverlay` setting, e.g.

> sudo nano /boot/firmware/config.txt

```sh
sudo apt-get update
sudo apt-get install ffmpeg -y
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install --lts
npm i -g pm2 tsx
```

I don't know if there is a copyright on it, I just liked the [loading animation](https://smashinghub.com/10-cool-loading-animated-gif.htm) a lot.

Discord:

1. Register App
2. Authenticate & add to server: https://discord.com/oauth2/authorize?client_id=948316990228033608&scope=bot&permissions=534723950656
