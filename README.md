# Breath

Hold to breathe in, let go to breathe out, and speak. Each take keeps your voice and the imprint of your breath together, on your own device.

**Play it:** https://storymapradio.github.io/breath/

**The instrument as it lives on the site:** https://asynchronousinstruments.com/breath

&nbsp;

Breath is two windows under a bar of icons.

Hold the lower window to breathe in and let go to breathe out, or let the microphone hear your breath, and the circle above fills and empties while a pen writes each breath around a turning dial. The lower window holds a shape that breathes with you: a bellows, lungs, a balloon, an accordion, a tide or a jellyfish. Press start there and a guide breathes it on its own at a pace you choose, so your breath has something steady to follow.

Arm, record, pause and stop work as they do in the Dream Journal. Each take keeps two things together, the voice and the imprint of the breath, and playing a take moves the circle and the shape with the breath you recorded, so you can breathe along with it later.

&nbsp;

## The ear

The ear icon lets the microphone listen for the breath. It learns the quiet of your room, hears the sound of air, and turns each breath the other way from the last. Speaking counts as breathing out, and the circle rests in the quiet between breaths. Holding the lower window always has the last word.

&nbsp;

## Run it yourself

Open the link above, or serve this folder from any static file server and open `index.html`:

```
npx serve .
```

The microphone needs the page to come from `https://` or `localhost`, so opening the file straight from disk works only for reading and listening.

&nbsp;

## How this version works

This is the same code as the instrument on asynchronousinstruments.com, published from that project as the instrument grows. Where the site keeps what people make in a shared database, this version keeps it in your own browser: `local/local-supabase.js` answers the same calls from IndexedDB on your device, and `local/local.js` holds the few things this instrument needs from it.

There is no login, no account and no server. This page uploads nothing you record or write: it all stays in this browser, and clearing this site's data in your browser clears it.

&nbsp;

## Where it comes from

Made by Aaron Goldstein at Asynchronous Instruments, https://asynchronousinstruments.com. This repository is written by the build in the main project (`storymapradio/open`), so changes made here directly are replaced at the next publication. Issues and ideas are welcome.

&nbsp;

## License

MIT. See `LICENSE`.
