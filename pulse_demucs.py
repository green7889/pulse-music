import sys

import soundfile as sf

import demucs.audio
import demucs.separate


def save_audio_with_soundfile(wav, path, samplerate, **_kwargs):
    audio = wav.detach().cpu().clamp(-1, 1).numpy().T
    sf.write(path, audio, samplerate, subtype="PCM_16")


demucs.audio.save_audio = save_audio_with_soundfile
demucs.separate.save_audio = save_audio_with_soundfile

if __name__ == "__main__":
    sys.argv = ["demucs", *sys.argv[1:]]
    demucs.separate.main()
