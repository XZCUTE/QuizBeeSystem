# Sound Assets

This directory contains sound effects used in the application. All files should be in MP3 format for optimal browser compatibility.

## Required Sounds

The application expects the following sound files:

- `click.mp3` - Button click sound
- `correct.mp3` - Sound for correct answer
- `incorrect.mp3` - Sound for incorrect answer
- `success.mp3` - Sound for celebration moments
- `timeout.mp3` - Sound for timer expiration

## Attribution

When adding sound effects, please ensure they are properly licensed for commercial use. Free sound sources include:
- [Freesound](https://freesound.org/)
- [Mixkit](https://mixkit.co/free-sound-effects/)
- [Zapsplat](https://www.zapsplat.com/)

## Usage

Sound effects are managed through the AudioContext provider. Add new sound mappings in `src/contexts/AudioContext.jsx`. 