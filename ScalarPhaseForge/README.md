# Scalar Phase Forge

Standalone Android audio tool with package `com.vhanma.scalarphaseforge`.

It does not replace, update, or modify any existing BioSonify application.

## Functions

1. Import an Android-supported audio file.
2. Decode it to mono PCM without modifying the source.
3. Build a stereo audio-domain phase-conjugate analogue:
   - Left channel: forward signal.
   - Right channel: time-reversed and polarity-inverted signal.
4. Display four synchronized layers:
   - Forward component moving left-to-right.
   - Conjugate component moving right-to-left.
   - Matched-point sum after reversing the conjugate back into alignment.
   - Smoothed amplitude envelope.
5. Play the result, loop it, and save a lossless PCM WAV.

The app labels the method as an experimental audio-domain analogue. It does not claim detection or generation of a physical scalar field.
