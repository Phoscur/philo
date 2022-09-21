# Philo Philm, Raspberry Pi telegraphing Timelapse Photographer

Photo &amp; Timelapse Telegram Bot

### MAJOR Features

- create PhotoStream, reusable multitarget, queueing [fix queueing!]
- more timelapse settings

- save to folders shots & vids (with data.json & readme.md)
- upload to git and aws glacier
- self cleaning rotating storage

- !! automatically take a timelapse every day !!

### TODO

Create Gallery and publish on github.io!

Discord API exploration and rearchitectured Bot: Sunseph

Use `libcamera`

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
