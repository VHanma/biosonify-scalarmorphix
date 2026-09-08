# Erinspace Sonify mobile port

This project includes a TypeScript/React Native adaptation of the data-to-MIDI mapping ideas from:

- **Project:** `erinspace/sonify`
- **Author:** Erin Braswell
- **Original language:** Python
- **Original purpose:** turn numeric data into MIDI music
- **License:** MIT

## Capabilities carried into BioSonify

The mobile port preserves the useful mapping model while removing desktop-only dependencies:

- arbitrary numeric data → musical notes
- data normalization/scaling
- timing quantization
- key/scale locking
- octave range control
- General MIDI instrument selection
- General MIDI percussion selection
- single-track and multi-track output
- Standard MIDI File export

BioSonify adds phone-native features that the original Python project did not provide:

- CSV/TXT file picker
- pasted data editor
- deterministic offline WAV preview synthesis
- stereo placement for multiple tracks
- WAV export through Android/iOS share/save UI
- progress reporting and UI yielding for large renders
- safe handling of constant-valued data

The port is intentionally a separate **Musical** tab. It does not replace BioSonify's existing Spectral, Wave Genetics, Biofield, Cymatics, Binary, Virtual Spinor, Simultaneous, or Unified Scalar engines.

## MIT license notice for upstream code/concepts

MIT License

Copyright (c) 2017 Erin Braswell

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
