import React, { useState, useRef, useEffect } from 'react';
import { computeSpectrogram, generateLogFrequencies } from './utils/spectrogram';

interface AudioPosition {
  time: number;
  frequency: number;
}

const Decoder: React.FC = () => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [decodedImage, setDecodedImage] = useState<string | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [hoverFrequency, setHoverFrequency] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<AudioPosition | null>(null);
  const [logScale, setLogScale] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0]);
      setDecodedImage(null);
    }
  };

  // Function to decode spectrogram from audio
  const decodeFromSpectrogram = async () => {
    if (!audioFile) {
      alert('Please select an audio file first');
      return;
    }

    setIsDecoding(true);

    try {
      // Initialize Web Audio API
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const sampleRate = audioContextRef.current.sampleRate;

      // Read and decode audio file
      const arrayBuffer = await audioFile.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      // Get audio data from channels
      const leftChannel = audioBuffer.getChannelData(0);
      const rightChannel = audioBuffer.getChannelData(1) || leftChannel; // Use left if mono

      // Parameters for spectrogram generation
      const fftSize = 1024;
      const hopSize = 256; // 4x overlap
      const numFrames = Math.floor((leftChannel.length - fftSize) / hopSize) + 1;
      
      // Calculate frequencies per row based on scale type
      const numFrequencyBins = fftSize / 2;
      const maxFreq = Math.min(sampleRate / 2, 8000); // Limit to 8kHz
      
      const frequencyArray = generateLogFrequencies(numFrequencyBins, 0, maxFreq, sampleRate);
      const frequencies: number[] = Array.from(frequencyArray);

      // Create spectrogram matrix using the utility function
      const stereoSignal = new Float32Array(leftChannel.length);
      for (let i = 0; i < leftChannel.length; i++) {
        stereoSignal[i] = (leftChannel[i] + (rightChannel[i] || leftChannel[i])) / 2;
      }
      
      const spectrogramData = computeSpectrogram(stereoSignal, fftSize, hopSize);
      
      // Convert spectrogram data to 2D array format
      const spectrogram: number[][] = [];
      for (let frame = 0; frame < spectrogramData.length; frame++) {
        spectrogram[frame] = Array.from(spectrogramData[frame]);
      }

      // Normalize spectrogram values to 0-255 range
      let maxVal = 0;
      for (let t = 0; t < spectrogram.length; t++) {
        for (let f = 0; f < spectrogram[t].length; f++) {
          if (spectrogram[t][f] > maxVal) {
            maxVal = spectrogram[t][f];
          }
        }
      }

      // Create image from spectrogram
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      canvas.width = spectrogram.length;
      canvas.height = spectrogram[0].length;

      const imageData = ctx.createImageData(canvas.width, canvas.height);
      const data = imageData.data;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const idx = (y * canvas.width + x) * 4;
          const val = maxVal > 0 ? (spectrogram[x][y] / maxVal) * 255 : 0;

          // Convert to grayscale RGB
          data[idx] = val;       // R
          data[idx + 1] = val;   // G
          data[idx + 2] = val;   // B
          data[idx + 3] = 255;   // A
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const imageUrl = canvas.toDataURL('image/png');
      setDecodedImage(imageUrl);

      // Set up hover-to-hear functionality
      setupHoverToHear(audioBuffer, frequencies);

    } catch (error) {
      console.error('Decoding error:', error);
      alert('Error during decoding: ' + (error as Error).message);
    } finally {
      setIsDecoding(false);
    }
  };

  // Set up hover-to-hear functionality
  const setupHoverToHear = (audioBuffer: AudioBuffer, frequencies: number[]) => {
    if (!audioContextRef.current) return;

    // Clean up any existing playback
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current.disconnect();
    }

    // Create audio nodes for frequency filtering
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 2048;

    // We'll implement the actual playback in the mouse event handlers
  };

  // Handle mouse movement over the decoded image
  const handleImageMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!decodedImage || !audioFile || !audioContextRef.current) return;

    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate corresponding time and frequency
    const time = (x / img.width) * (audioRef.current?.duration || 1);
    const frequency = frequencies ? frequencies[Math.floor((y / img.height) * frequencies.length)] : 0;

    setHoverPosition({ time, frequency });
    setHoverFrequency(frequency);
  };

  // Handle clicking to play the corresponding frequency band
  const handleImageClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!decodedImage || !audioFile || !audioContextRef.current) return;

    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Calculate corresponding time
    const time = (x / img.width) * (audioRef.current?.duration || 1);

    // Play audio segment around the clicked time
    await playAudioSegment(time);
  };

  // Play a specific audio segment
  const playAudioSegment = async (startTime: number) => {
    if (!audioFile || !audioContextRef.current) return;

    try {
      // Clean up any existing playback
      if (sourceRef.current) {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
      }

      // Create new audio context if needed
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // Decode audio file again
      const arrayBuffer = await audioFile.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      // Create source and connect to destination
      sourceRef.current = audioContextRef.current.createBufferSource();
      sourceRef.current.buffer = audioBuffer;

      // Connect to destination
      sourceRef.current.connect(audioContextRef.current.destination);

      // Play from the specified start time (play a short segment)
      const duration = 1.0; // Play 1 second segment
      sourceRef.current.start(0, startTime, duration);

      setIsPlaying(true);

      // Reset playing status when done
      sourceRef.current.onended = () => {
        setIsPlaying(false);
      };
    } catch (error) {
      console.error('Error playing audio segment:', error);
    }
  };

  // Stop audio playback
  const stopPlayback = () => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current.disconnect();
      sourceRef.current = null;
      setIsPlaying(false);
    }
  };

  // Clean up audio resources on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (sourceRef.current) {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className="decoder">
      <h2>Phase-Retrieved Spectrogram Suite with Steganographic Overlay</h2>
      
      <div className="input-group">
        <label htmlFor="audio-upload">Select Encoded Audio:</label>
        <input 
          id="audio-upload"
          type="file" 
          accept="audio/*" 
          onChange={handleAudioChange} 
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
      </div>
      
      <button onClick={decodeFromSpectrogram} disabled={isDecoding}>
        {isDecoding ? 'Decoding...' : 'Decode from Audio'}
      </button>
      
      {isPlaying && (
        <button onClick={stopPlayback} className="stop-button">
          Stop Playback
        </button>
      )}
      
      {decodedImage && (
        <div className="result">
          <h3>Decoded Image:</h3>
          <img 
            ref={canvasRef}
            src={decodedImage} 
            alt="Decoded from audio" 
            onMouseMove={handleImageMouseMove}
            onClick={handleImageClick}
            style={{ 
              maxWidth: '100%', 
              border: hoverFrequency ? `2px solid rgb(${hoverFrequency % 255}, ${Math.floor(hoverFrequency / 255) % 255}, ${Math.floor(hoverFrequency / 255 / 255) % 255})` : 'none',
              cursor: 'crosshair'
            }} 
          />
          
          {hoverPosition && (
            <div className="hover-info">
              Time: {hoverPosition.time.toFixed(2)}s | Frequency: {hoverPosition.frequency.toFixed(2)}Hz
            </div>
          )}
          
          <div className="instructions">
            <p><strong>Hover-to-Hear:</strong> Move your mouse over the image to see the corresponding time and frequency. Click anywhere on the image to play audio from that time position.</p>
          </div>
        </div>
      )}
      
      {/* Hidden audio element to access duration */}
      <audio 
        ref={audioRef} 
        src={audioFile ? URL.createObjectURL(audioFile) : ''} 
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default Decoder;