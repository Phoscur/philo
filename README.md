# Philopho, Raspberry Pi telegraphing Timelapse Photographer

Photo & Timelapse Telegram Bot

### MAJOR Features

- timelapses with libcamera, ffmpeg rendering & publishing on Github Pages

- save to folders shots & vids (with data.json & readme.md)
- upload to git and aws glacier
- self cleaning rotating storage

- !! automatically take a timelapse every day !!

### TODO

Fix regressions, lost features:

- Likes
- Preview while running
- Glacier Backup
- Destructive Rotation
- Misc commands: Cancel?!
- Local FFMpeg when Github disabled

Create Gallery and publish on github.io!

Discord API exploration and rearchitectured Bot: Sunseph

## Using `libcamera`

We have this new utility since Bullseye (buster 2022).
While taking the pictures for timelapses goes through `libcamera-still`, you can also use other commands,
e.g. Videostreaming `libcamera-vid -t 0 --width 1920 --height 1080 --codec h264 --inline --listen -o tcp://0.0.0.0:8888`
and `vlc tcp/h264://192.168.2.138:8888/` to manually adjust the objective, so you get sharp images (or `libcamera-vid -t 0 --width 4056 --height 3040 --codec mjpeg --framerate 10 --inline --listen -o tcp://0.0.0.0:8888` and `vlc tcp/mjpeg://192.168.2.150:8888/`).

## Dependencies

Install nodejs and ffmpeg

```sh
sudo apt-get update
sudo apt-get install ffmpeg -y
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
nvm install 16
nvm use 16
npm i -g pm2
```

I don't know if there is a copyright on it, I just liked the [loading animation](https://smashinghub.com/10-cool-loading-animated-gif.htm) a lot.

Discord:

1. Register App
2. Authenticate & add to server: https://discord.com/oauth2/authorize?client_id=948316990228033608&scope=bot&permissions=534723950656
