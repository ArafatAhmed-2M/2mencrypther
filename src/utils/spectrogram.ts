/**
 * Spectrogram utilities for Phase-Retrieved Spectrogram Suite with Steganographic Overlay
 */

// Complex number operations for FFT
class Complex {
  constructor(public real: number, public imag: number) {}

  static add(a: Complex, b: Complex): Complex {
    return new Complex(a.real + b.real, a.imag + b.imag);
  }

  static sub(a: Complex, b: Complex): Complex {
    return new Complex(a.real - b.imag, a.imag - b.imag);
  }

  static mul(a: Complex, b: Complex): Complex {
    return new Complex(
      a.real * b.real - a.imag * b.imag,
      a.real * b.imag + a.imag * b.real
    );
  }

  static magnitude(c: Complex): number {
    return Math.sqrt(c.real * c.real + c.imag * c.imag);
  }

  static fromPolar(magnitude: number, phase: number): Complex {
    return new Complex(magnitude * Math.cos(phase), magnitude * Math.sin(phase));
  }
}

/**
 * Fast Fourier Transform (Cooley-Tukey algorithm)
 */
export function fft(signal: Float32Array): Complex[] {
  const N = signal.length;
  
  // Check if N is a power of 2
  if ((N & (N - 1)) !== 0) {
    throw new Error('Signal length must be a power of 2 for FFT');
  }

  // Initialize complex array
  const x = new Array(N);
  for (let i = 0; i < N; i++) {
    x[i] = new Complex(signal[i], 0);
  }

  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < N; i++) {
    if (i < j) {
      [x[i], x[j]] = [x[j], x[i]];
    }
    let k = N >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Cooley-Tukey FFT
  for (let len = 2; len <= N; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2 * Math.PI) / len;
    
    const wlen = Complex.fromPolar(1, angle);
    let w = new Complex(1, 0);
    
    for (let i = 0; i < halfLen; i++) {
      for (let j = i; j < N; j += len) {
        const u = x[j];
        const v = Complex.mul(x[j + halfLen], w);
        x[j] = Complex.add(u, v);
        x[j + halfLen] = Complex.sub(u, v);
      }
      w = Complex.mul(w, wlen);
    }
  }

  return x;
}

/**
 * Inverse Fast Fourier Transform
 */
export function ifft(X: Complex[]): Float32Array {
  const N = X.length;
  
  // Conjugate the complex numbers
  const conjugated = X.map(x => new Complex(x.real, -x.imag));
  
  // Forward FFT
  const fftResult = fft(new Float32Array(conjugated.map(c => c.real)));
  
  // Conjugate again and divide by N
  const result = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    result[i] = fftResult[i] / N;
  }
  
  return result;
}

/**
 * Compute spectrogram from audio signal
 */
export function computeSpectrogram(
  signal: Float32Array,
  fftSize: number = 1024,
  hopSize: number = 256
): Float32Array[] {
  const numFrames = Math.floor((signal.length - fftSize) / hopSize) + 1;
  const spectrogram: Float32Array[] = [];
  
  for (let frame = 0; frame < numFrames; frame++) {
    const startIdx = frame * hopSize;
    const frameData = new Float32Array(fftSize);
    
    // Copy frame data
    for (let i = 0; i < fftSize; i++) {
      frameData[i] = startIdx + i < signal.length ? signal[startIdx + i] : 0;
    }
    
    // Apply window function (Hann)
    for (let i = 0; i < fftSize; i++) {
      frameData[i] *= 0.5 * (1 - Math.cos(2 * Math.PI * i / (fftSize - 1)));
    }
    
    // Perform FFT
    const fftResult = fft(frameData);
    
    // Extract magnitude
    const magnitude = new Float32Array(fftSize / 2);
    for (let i = 0; i < magnitude.length; i++) {
      magnitude[i] = Complex.magnitude(fftResult[i]);
    }
    
    spectrogram.push(magnitude);
  }
  
  return spectrogram;
}

/**
 * Griffin-Lim algorithm for phase reconstruction
 */
export async function griffinLim(
  magnitudeSpectrogram: Float32Array[],
  iterations: number = 30,
  callback?: (progress: number) => void
): Promise<Float32Array> {
  const numFrames = magnitudeSpectrogram.length;
  const fftSize = magnitudeSpectrogram[0].length * 2; // Double for full FFT size
  
  // Initialize random phases
  let phaseSpectrogram: Complex[][] = [];
  for (let frame = 0; frame < numFrames; frame++) {
    phaseSpectrogram[frame] = [];
    for (let bin = 0; bin < magnitudeSpectrogram[frame].length; bin++) {
      const phase = Math.random() * 2 * Math.PI;
      phaseSpectrogram[frame][bin] = Complex.fromPolar(1, phase);
    }
  }
  
  let audioEstimate = new Float32Array(numFrames * fftSize);
  
  for (let iter = 0; iter < iterations; iter++) {
    // Update progress if callback provided
    if (callback) {
      callback(Math.floor((iter / iterations) * 100));
    }
    
    // Combine magnitude and phase
    const combinedSpectrogram: Complex[][] = [];
    for (let frame = 0; frame < numFrames; frame++) {
      combinedSpectrogram[frame] = [];
      for (let bin = 0; bin < magnitudeSpectrogram[frame].length; bin++) {
        combinedSpectrogram[frame][bin] = Complex.fromPolar(
          magnitudeSpectrogram[frame][bin],
          phaseSpectrogram[frame][bin].imag
        );
      }
    }
    
    // Inverse STFT to get audio estimate
    audioEstimate = inverseSTFT(combinedSpectrogram, fftSize, fftSize / 4); // 75% overlap
    
    // Forward STFT to get new phase estimate
    const newSpectrogram = computeSpectrogram(audioEstimate, fftSize, fftSize / 4);
    
    // Update phases
    for (let frame = 0; frame < numFrames; frame++) {
      for (let bin = 0; bin < magnitudeSpectrogram[frame].length; bin++) {
        const newPhase = Math.atan2(
          newSpectrogram[frame][bin],
          magnitudeSpectrogram[frame][bin]
        );
        phaseSpectrogram[frame][bin] = Complex.fromPolar(1, newPhase);
      }
    }
  }
  
  return audioEstimate;
}

/**
 * Inverse Short-Time Fourier Transform
 */
export function inverseSTFT(
  spectrogram: Complex[][],
  fftSize: number,
  hopSize: number
): Float32Array {
  const numFrames = spectrogram.length;
  const signalLength = numFrames * hopSize + fftSize;
  const signal = new Float32Array(signalLength);
  const window = new Float32Array(fftSize);
  
  // Create Hann window
  for (let i = 0; i < fftSize; i++) {
    window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (fftSize - 1)));
  }
  
  // Overlap-add synthesis
  for (let frame = 0; frame < numFrames; frame++) {
    const startIdx = frame * hopSize;
    
    // Convert complex spectrogram to time domain
    const frameSignal = new Float32Array(fftSize);
    const complexFrame = [...spectrogram[frame]];
    
    // Pad with zeros if needed
    while (complexFrame.length < fftSize) {
      complexFrame.push(new Complex(0, 0));
    }
    
    // Inverse FFT
    const ifftResult = ifft(complexFrame);
    
    // Apply window and overlap-add
    for (let i = 0; i < fftSize && startIdx + i < signalLength; i++) {
      signal[startIdx + i] += ifftResult[i] * window[i];
    }
  }
  
  return signal;
}

/**
 * Convert linear frequency to mel scale
 */
export function freqToMel(freq: number): number {
  return 2595 * Math.log10(1 + freq / 700);
}

/**
 * Convert mel scale to linear frequency
 */
export function melToFreq(mel: number): number {
  return 700 * (Math.pow(10, mel / 2595) - 1);
}

/**
 * Generate mel-frequency scale
 */
export function generateMelScale(
  numFilters: number,
  sampleRate: number,
  nfft: number
): Float32Array {
  const lowFreq = 0;
  const highFreq = sampleRate / 2;
  
  // Convert Hz to mel
  const lowMel = freqToMel(lowFreq);
  const highMel = freqToMel(highFreq);
  
  // Create equally spaced mel points
  const melPoints = new Float32Array(numFilters + 2);
  for (let i = 0; i <= numFilters + 1; i++) {
    melPoints[i] = lowMel + (highMel - lowMel) * i / (numFilters + 1);
  }
  
  // Convert back to Hz
  const hzPoints = new Float32Array(numFilters + 2);
  for (let i = 0; i <= numFilters + 1; i++) {
    hzPoints[i] = melToFreq(melPoints[i]);
  }
  
  // Convert Hz to FFT bin numbers
  const binIndexes = new Float32Array(numFilters + 2);
  for (let i = 0; i <= numFilters + 1; i++) {
    binIndexes[i] = Math.floor((nfft + 1) * hzPoints[i] / sampleRate);
  }
  
  // Create filter banks
  const fbank = new Float32Array(numFilters * Math.floor(nfft / 2 + 1));
  
  for (let j = 0; j < numFilters; j++) {
    const left = binIndexes[j];
    const center = binIndexes[j + 1];
    const right = binIndexes[j + 2];
    
    for (let i = left; i < center; i++) {
      if (center - left !== 0) {
        fbank[j * (nfft / 2 + 1) + i] = (i - left) / (center - left);
      }
    }
    
    for (let i = center; i < right; i++) {
      if (right - center !== 0) {
        fbank[j * (nfft / 2 + 1) + i] = (right - i) / (right - center);
      }
    }
  }
  
  return fbank;
}

/**
 * Apply mel filter banks to spectrogram
 */
export function applyMelFilter(
  spectrogram: Float32Array[],
  melFilters: Float32Array,
  numFilters: number
): Float32Array[] {
  const filteredSpectrogram: Float32Array[] = [];
  
  for (let frame = 0; frame < spectrogram.length; frame++) {
    const filteredFrame = new Float32Array(numFilters);
    
    for (let filter = 0; filter < numFilters; filter++) {
      let sum = 0;
      for (let bin = 0; bin < spectrogram[frame].length; bin++) {
        sum += spectrogram[frame][bin] * melFilters[filter * spectrogram[frame].length + bin];
      }
      filteredFrame[filter] = sum;
    }
    
    filteredSpectrogram.push(filteredFrame);
  }
  
  return filteredSpectrogram;
}

/**
 * Generate logarithmic frequency mapping
 */
export function generateLogFrequencies(
  numFrequencyBands: number,
  minFreq: number,
  maxFreq: number,
  sampleRate: number
): Float32Array {
  const frequencies = new Float32Array(numFrequencyBands);
  
  // Limit max frequency to Nyquist frequency
  const nyquist = sampleRate / 2;
  const actualMaxFreq = Math.min(maxFreq, nyquist);
  
  // Generate log-spaced frequencies
  const logMin = Math.log(minFreq);
  const logMax = Math.log(actualMaxFreq);
  
  for (let i = 0; i < numFrequencyBands; i++) {
    const ratio = i / (numFrequencyBands - 1);
    frequencies[i] = Math.exp(logMin + ratio * (logMax - logMin));
  }
  
  return frequencies;
}