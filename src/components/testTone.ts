// A self-synthesised test tone for exercising the audio runtime + remote audio
// controls. We generate the PCM ourselves, so it is unambiguously free to use:
// no third-party or licensed media, nothing to commit, nothing to fetch. It is
// a small WAV encoded as a data: URI, which <audio src> (and the AudioPlayer's
// seek/duration logic) handle exactly like a real file.

type TestToneOptions = {
  seconds?: number;
  frequency?: number;
  sampleRate?: number;
  gain?: number;
};

export function makeTestToneDataUri({
  seconds = 5,
  frequency = 440, // concert A
  sampleRate = 8000, // low rate keeps the data URI small; fine for a test tone
  gain = 0.25,
}: TestToneOptions = {}): string {
  const totalSamples = Math.floor(seconds * sampleRate);
  const bytesPerSample = 2; // 16-bit PCM
  const dataSize = totalSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };

  // Canonical 44-byte WAV/PCM header.
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Sine wave with short fades so it never clicks on loop/seek.
  const fade = Math.floor(sampleRate * 0.06);
  for (let i = 0; i < totalSamples; i += 1) {
    let amplitude = gain;
    if (i < fade) amplitude *= i / fade;
    else if (i > totalSamples - fade) amplitude *= (totalSamples - i) / fade;

    const sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * amplitude;
    view.setInt16(44 + i * bytesPerSample, Math.max(-1, Math.min(1, sample)) * 0x7fff, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);

  return `data:audio/wav;base64,${btoa(binary)}`;
}

// Built once at module load and reused; ~80KB string, cheap to keep around.
export const TEST_TONE_DATA_URI = makeTestToneDataUri();
