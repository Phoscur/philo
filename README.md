# Philo Philm, Raspberry Pi telegraphing Timelapse Photographer

Photo &amp; Timelapse Telegram Bot

### MAJOR TODOS

- create PhotoStream, reusable multitarget, queueing [fix queueing!]
- more timelapse settings

- save to folders shots & vids (with data.json & readme.md)
- upload via git
- clean storage

- !! automatically take a timelapse every day !!

## Dependencies

Install nodejs, raspistill and ffmpeg

```sh
sudo apt-get update
sudo apt-get install raspistill ffmpeg -y
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
nvm install 14
nvm use 14
```

I don't know if there is a copyright on it, I just liked the [loading animation](https://smashinghub.com/10-cool-loading-animated-gif.htm) a lot.

Discord:

1. Register App
2. Authenticate & add to server: https://discord.com/oauth2/authorize?client_id=948316990228033608&scope=bot&permissions=534723950656
