# Sounds of Heidrun Code

Source of the sounds: https://freesound.org/people/sonsdebarcelona/sounds/393948/

The two goat bleats that Heidrun Code plays when the developer clicks the sound button of the About modal, the sound button of the splash screen, or the smiley of the empty tab screen. The rules of the sound are in [the rules of the user interface](../../../docs/agents_rules/user_interface/window/window_state_and_start.md), in the section "Goat sounds".

- `goat_bleat_1.wav` and `goat_bleat_2.wav` are the two halves of the sound "Cabra" by sonsdebarcelona: https://freesound.org/people/sonsdebarcelona/sounds/393948/
- The license of the sound is Creative Commons Attribution NonCommercial 3.0: http://creativecommons.org/licenses/by-nc/3.0/. It asks for a credit to the author, and it forbids commercial use. The About modal shows the credit.
- The two files come from the free MP3 preview of the sound on Freesound, because the full file needs a login. The cut is at 2.49 seconds, in the quiet moment between the two bleats. The background noise is removed with the `noisered` effect of SoX, with a noise profile of the quiet moment, at the strength 0.25. Each file is a WAV file of 16 bits, in stereo, at 44.1 kilohertz, with a fade of 40 milliseconds at the cut.
