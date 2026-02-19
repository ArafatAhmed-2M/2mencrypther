import React, { useState, useRef } from 'react';
import { griffinLim, generateLogFrequencies } from './utils/spectrogram';

const Encoder: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [carrierAudio, setCarrierAudio] = useState<File | null>(null);
  const [isEncoding, setIsEncoding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logScale, setLogScale] = useState(true);
  const [griffinLimIterations, setGriffinLimIterations] = useState(30);
  const audioContextRef = useRef<AudioContext | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleCarrierAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCarrierAudio(e.target.files[0]);
    }
  };

  const encodeToSpectrogram = async () => {
    if (!imageFile) {
      alert('Please select an image first');
      return;
    }

    setIsEncoding(true);
    setProgress(0);

    try {
      // Read image file
      const imageBuffer = await imageFile.arrayBuffer();
      
      // Create object URL for displaying image preview
      const imageUrl = URL.createObjectURL(imageFile);
      
      // Load image
      const img = new Image();
      img.src = imageUrl;
      
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      // Create canvas to get image data
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Initialize Web Audio API
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const sampleRate = audioContextRef.current.sampleRate;
      
      // Determine frequency bands based on image height
      const numFrequencyBands = img.height;
      const maxFreq = Math.min(sampleRate / 2, 8000); // Limit to 8kHz
      
      // Calculate frequencies per row based on scale type
      const frequencyArray = generateLogFrequencies(numFrequencyBands, 0, maxFreq, sampleRate);
      const frequencies: number[] = Array.from(frequencyArray);

      // Process carrier audio if provided
      let carrierBuffer: AudioBuffer | null = null;
      if (carrierAudio) {
        const carrierArrayBuffer = await carrierAudio.arrayBuffer();
        carrierBuffer = await audioContextRef.current.decodeAudioData(carrierArrayBuffer);
      }

      // Calculate total duration based on width of image
      const duration = img.width / 100; // 100 samples per column
      const totalSamples = Math.floor(duration * sampleRate);
      
      // Create stereo audio buffer
      const audioBuffer = audioContextRef.current.createBuffer(2, totalSamples, sampleRate); // Stereo
      
      // Prepare image data for encoding
      const processedData = new Uint8ClampedArray(data.length);
      for (let i = 0; i < data.length; i += 4) {
        // Convert RGBA to grayscale and normalize
        const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        processedData[i] = gray;
        processedData[i + 1] = gray;
        processedData[i + 2] = gray;
        processedData[i + 3] = 255; // Alpha channel
      }

      // Encode image data into spectrogram using Griffin-Lim algorithm concept
      // This is a simplified version - a real implementation would use iterative phase estimation
      
      // Create placeholder for magnitude spectrogram
      const magnitudeSpectrogram: number[][] = [];
      for (let t = 0; t < img.width; t++) {
        magnitudeSpectrogram[t] = new Array(numFrequencyBands).fill(0);
        for (let f = 0; f < numFrequencyBands; f++) {
          const pixelIndex = ((f * img.width) + t) * 4;
          if (pixelIndex < processedData.length) {
            // Use red channel as magnitude (could use luminance)
            magnitudeSpectrogram[t][f] = processedData[pixelIndex] / 255.0;
          }
        }
      }

      // Apply Griffin-Lim algorithm for phase reconstruction
      // Convert magnitude spectrogram to the format expected by the utility function
      const magnitudeSpectrogramArray: Float32Array[] = magnitudeSpectrogram.map(row => new Float32Array(row));
      
      // Use the utility function to perform Griffin-Lim reconstruction
      const reconstructedAudio = await griffinLim(
        magnitudeSpectrogramArray, 
        griffinLimIterations,
        (progressValue) => setProgress(progressValue)
      );

      // Generate waveform from reconstructed audio
      const leftChannel = audioBuffer.getChannelData(0);
      const rightChannel = audioBuffer.getChannelData(1);
      
      // Copy reconstructed audio to both channels
      const samplesToCopy = Math.min(reconstructedAudio.length, totalSamples);
      for (let i = 0; i < samplesToCopy; i++) {
        leftChannel[i] = reconstructedAudio[i] * 0.5; // Reduce amplitude to prevent clipping
        rightChannel[i] = reconstructedAudio[i] * 0.5; // Reduce amplitude to prevent clipping
      }

      // Mix with carrier audio if provided
      if (carrierBuffer) {
        const carrierLeft = carrierBuffer.getChannelData(0);
        const carrierRight = carrierBuffer.getChannelData(1);
        
        // Mix the encoded signal with the carrier (adjust ratio as needed)
        const mixRatio = 0.3; // 30% encoded signal, 70% carrier
        const minLength = Math.min(
          leftChannel.length, 
          rightChannel.length,
          carrierLeft.length,
          carrierRight.length
        );
        
        for (let i = 0; i < minLength; i++) {
          leftChannel[i] = leftChannel[i] * mixRatio + carrierLeft[i] * (1 - mixRatio);
          rightChannel[i] = rightChannel[i] * mixRatio + carrierRight[i] * (1 - mixRatio);
        }
      }

      // Export as WAV with 32-bit float
      const wavBlob = audioBufferToWav(audioBuffer, true); // true for 32-bit float
      
      // Create download link
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'encoded_image.wav';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Encoding error:', error);
      alert('Error during encoding: ' + (error as Error).message);
    } finally {
      setIsEncoding(false);
      setProgress(100);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  // Helper function to convert AudioBuffer to WAV with 32-bit float support
  function audioBufferToWav(buffer: AudioBuffer, isFloat32: boolean = false) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = isFloat32 ? 3 : 1; // 3 = IEEE float, 1 = PCM
    const bitDepth = isFloat32 ? 32 : 16;
    
    let length = 0;
    for (let i = 0; i < numChannels; i++) {
      length += buffer.getChannelData(i).length;
    }
    
    const wavBuffer = new ArrayBuffer(44 + length * (bitDepth / 8));
    const view = new DataView(wavBuffer);
    
    // Write WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * (bitDepth / 8), true); // Length
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // Format chunk size
    view.setUint16(20, format, true); // Format: PCM or IEEE float
    view.setUint16(22, numChannels, true); // Channels
    view.setUint32(24, sampleRate, true); // Sample rate
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true); // Byte rate
    view.setUint16(32, numChannels * (bitDepth / 8), true); // Block align
    view.setUint16(34, bitDepth, true); // Bit depth
    writeString(36, 'data');
    view.setUint32(40, length * (bitDepth / 8), true); // Data chunk size
    
    // Write interlaced audio data
    let offset = 44;
    const channelData: Float32Array[] = [];
    for (let i = 0; i < numChannels; i++) {
      channelData.push(buffer.getChannelData(i));
    }
    
    if (isFloat32) {
      // Write 32-bit float data
      for (let i = 0; i < channelData[0].length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
          view.setFloat32(offset, channelData[channel][i], true);
          offset += 4;
        }
      }
    } else {
      // Write 16-bit PCM data
      for (let i = 0; i < channelData[0].length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
          const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
          view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
          offset += 2;
        }
      }
    }
    
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  return (
    <div className="encoder">
      <h2>Phase-Retrieved Spectrogram Suite with Steganographic Overlay</h2>
      
      <div className="input-group">
        <label htmlFor="image-upload">Select Image:</label>
        <input 
          id="image-upload"
          type="file" 
          accept="image/*" 
          onChange={handleImageChange} 
        />
      </div>
      
      <div className="input-group">
        <label htmlFor="carrier-upload">Carrier Audio (optional):</label>
        <input 
          id="carrier-upload"
          type="file" 
          accept="audio/*" 
          onChange={handleCarrierAudioChange} 
        />
      </div>
      
      <div className="controls">
        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={logScale}
              onChange={(e) => setLogScale(e.target.checked)}
            />
            Log Scale (Mel)
          </label>
        </div>
        
        <div className="control-group">
          <label>
            Griffin-Lim Iterations: 
            <select 
              value={griffinLimIterations} 
              onChange={(e) => setGriffinLimIterations(Number(e.target.value))}
            >
              <option value={30}>30</option>
              <option value={40}>40</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>
      </div>
      
      <button onClick={encodeToSpectrogram} disabled={isEncoding}>
        {isEncoding ? 'Encoding...' : 'Encode to WAV'}
      </button>
      
      {isEncoding && (
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progress}%` }}
          ></div>
          <span className="progress-text">{progress}%</span>
        </div>
      )}
      
      {imageFile && (
        <div className="preview">
          <h3>Image Preview:</h3>
          <img 
            src={URL.createObjectURL(imageFile)} 
            alt="Preview" 
            style={{ maxWidth: '300px', maxHeight: '300px' }} 
          />
        </div>
      )}
    </div>
  );
};

export default Encoder;