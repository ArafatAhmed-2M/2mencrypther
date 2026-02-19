# Phase-Retrieved Spectrogram Suite with Steganographic Overlay

A sophisticated web-based tool for hiding images in audio using advanced spectrogram techniques and steganography. This application allows users to encode images into audio files and decode them back, using phase retrieval algorithms and frequency masking techniques.

## Features

- **Griffin-Lim Algorithm**: Uses iterative phase reconstruction for high-fidelity audio recovery
- **Steganographic Overlay**: Hides images within audio carrier signals (songs, ambient sounds)
- **Logarithmic Frequency Mapping**: Supports both linear and Mel-scale frequency mapping
- **32-bit Float Audio**: Ensures high precision during encoding/decoding processes
- **Interactive Visualizer**: Hover-to-hear functionality to listen to specific frequency bands
- **Full Local Processing**: All processing happens in the browser - no data leaves your device
- **Carrier Audio Support**: Embed images into existing audio tracks for covert transmission

## How It Works

### Encoding Process
1. Upload an image to be hidden
2. Optionally upload carrier audio (background music, nature sounds, etc.)
3. The image is converted to a spectrogram representation
4. The Griffin-Lim algorithm reconstructs the phase information
5. The image data is embedded in the audio spectrum
6. If carrier audio is provided, the image data is mixed with it
7. The result is exported as a high-quality 32-bit WAV file

### Decoding Process
1. Upload the encoded audio file
2. The application computes the spectrogram of the audio
3. Image data is extracted from the frequency bands
4. The original image is reconstructed
5. Interactive hover-to-hear functionality allows exploring the audio content

## Technical Implementation

- **Frontend**: React TypeScript application
- **Audio Processing**: Web Audio API for local processing
- **Algorithms**: FFT, IFFT, Griffin-Lim phase reconstruction
- **Frequency Mapping**: Linear and Mel-scale transformations
- **Audio Formats**: 32-bit float WAV for high fidelity

## Setup for Development

1. Clone the repository:
```bash
git clone https://github.com/yourusername/phase-retrieved-spectrogram-suite.git
cd phase-retrieved-spectrogram-suite
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

## Building for Production

To build the application for production deployment:

```bash
npm run build
```

The built files will be in the `dist` directory.

## Deploying to GitHub Pages

### Method 1: Using GitHub Actions (Recommended)

1. Create a `.github/workflows/deploy.yml` file in your repository:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout
      uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm install

    - name: Build
      run: npm run build

    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist
```

2. Enable GitHub Pages in your repository settings:
   - Go to Settings > Pages
   - Under "Build and deployment", select "GitHub Actions"

### Method 2: Manual Deployment

1. Build the project:
```bash
npm run build
```

2. Create a new orphan branch for gh-pages:
```bash
git checkout --orphan gh-pages
git add -f dist/
git commit -m "Deploy to GitHub Pages"
git subtree push --prefix dist origin gh-pages
```

3. Enable GitHub Pages in your repository settings:
   - Go to Settings > Pages
   - Under "Source", select "Deploy from a branch"
   - Choose "gh-pages" branch and save

## Usage Instructions

### Encoding Images
1. Open the application in your browser
2. Switch to the "Encoder" tab
3. Upload the image you want to hide
4. Optionally upload carrier audio (music, ambient sounds)
5. Adjust settings (Griffin-Lim iterations, log scale, etc.)
6. Click "Encode to WAV" to generate the audio file
7. Download the resulting WAV file

### Decoding Images
1. Switch to the "Decoder" tab
2. Upload the encoded audio file
3. Select your preferred frequency mapping (Linear or Log Scale)
4. Click "Decode from Audio" to extract the image
5. Explore the image using hover-to-hear functionality

## Browser Compatibility

The application uses modern web technologies:
- Web Audio API (supported in all modern browsers)
- Canvas API
- File API
- ES6+ JavaScript features

Tested on Chrome, Firefox, Safari, and Edge.

## Security & Privacy

- All processing occurs locally in your browser
- No data is sent to any servers
- Files remain on your device at all times
- Perfect for sensitive or confidential data

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

MIT License - see the LICENSE file for details.

## Troubleshooting

### Audio not playing during hover-to-hear
- Make sure to interact with the page first (click or tap) before trying the hover functionality
- Some browsers require user interaction before playing audio

### Low quality reconstruction
- Increase Griffin-Lim iterations for better quality
- Ensure the original image isn't too large
- Consider using higher quality carrier audio

### Performance issues
- Large images may take longer to process
- Close other applications to free up memory
- Use a modern browser with good Web Audio API support

## Acknowledgments

- Based on the Griffin-Lim algorithm for phase retrieval
- Inspired by spectrogram-based steganography research
- Built with React and the Web Audio API