# alm0n_tts_js
A Discord bot for TTS

## Table of contents
  - [Table of contents](#table-of-contents)
  - [Prerequisites](#prerequisites)
  - [Run](#run)

## Prerequisites
- [git](https://git-scm.com/downloads) (optional)
- [node.js](https://nodejs.org/en/download/)

## Run
Clone this repository
```
git clone https://github.com/duongoku/alm0n_tts_js.git
```
And change working directory to this project
```
cd alm0n_tts_js
```
Then create an [.env](https://gist.github.com/ericelliott/4152984) file in this directory and fill in those environment variables:
- TOKEN: Your Discord bot token
- INVITE: Your Discord bot invitation url
- CREPATH: Path to your google cloud text-to-speech credential ([Click here for more information on how to get this](https://cloud.google.com/text-to-speech/docs/libraries#cloud-console))

Then install all the packages needed with
```
npm install
```
Finally, run the bot with
```
node .
```