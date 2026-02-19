import React, { useState } from 'react';
import Encoder from './Encoder';
import Decoder from './Decoder';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'encoder' | 'decoder'>('encoder');

  return (
    <div className="app">
      <header className="app-header">
        <h1>Phase-Retrieved Spectrogram Suite with Steganographic Overlay</h1>
        <nav className="tab-nav">
          <button 
            className={activeTab === 'encoder' ? 'active' : ''}
            onClick={() => setActiveTab('encoder')}
          >
            Encoder
          </button>
          <button 
            className={activeTab === 'decoder' ? 'active' : ''}
            onClick={() => setActiveTab('decoder')}
          >
            Decoder
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'encoder' ? <Encoder /> : <Decoder />}
      </main>

      <footer className="app-footer">
        <p>Local Processing Only - No Data Leaves Your Device</p>
      </footer>
    </div>
  );
};

export default App;