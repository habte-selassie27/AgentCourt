import { useState, useEffect } from 'react';
import { DisputeDashboard } from './components/DisputeDashboard';
import { DisputeDetail } from './components/DisputeDetail';
import { CreateDisputeForm } from './components/CreateDisputeForm';
import { getCourt } from './sdk';

type View = 'dashboard' | 'create' | 'detail';

declare global {
  interface Window {
    ethereum?: any;
  }
}

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedDisputeId, setSelectedDisputeId] = useState<bigint | null>(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [wrongChain, setWrongChain] = useState(false);

  const TARGET_CHAIN_ID = 61999;

  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length === 0) {
        setWalletConnected(false);
        setWalletAddress('');
      } else {
        setWalletAddress(String(accounts[0] ?? ''));
      }
    });
    window.ethereum.on('chainChanged', (chainHex: string) => {
      const id = parseInt(chainHex, 16);
      setWrongChain(id !== TARGET_CHAIN_ID);
      window.location.reload();
    });
  }, []);

  const handleConnectWallet = async () => {
    if (walletConnected) {
      setWalletConnected(false);
      setWalletAddress('');
      return;
    }

    if (!window.ethereum) {
      alert('Please install MetaMask or Rabby wallet');
      return;
    }

    try {
      const court = getCourt();
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      await court.connectWallet(window.ethereum);
      setWalletConnected(true);
      setWalletAddress(String(accounts[0]));

      const chainHex = await window.ethereum.request({ method: 'eth_chainId' });
      const id = parseInt(String(chainHex), 16);
      setWrongChain(id !== TARGET_CHAIN_ID);
    } catch (err) {
      console.error('Wallet connection failed:', err);
      alert('Failed to connect wallet. Make sure you are on GenLayer Studionet (chain 61999).');
    }
  };

  const handleSwitchChain = async () => {
    if (!window.ethereum) return;
    const chainIdHex = `0x${TARGET_CHAIN_ID.toString(16)}`; // 61999 -> 0xF22F
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
    } catch (err: any) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: chainIdHex,
            chainName: 'GenLayer Studionet',
            nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
            rpcUrls: ['https://studio.genlayer.com/api'],
            blockExplorerUrls: ['https://explorer-studio.genlayer.com'],
          }],
        });
      }
    }
  };

  const handleViewDispute = (id: bigint) => {
    setSelectedDisputeId(id);
    setCurrentView('detail');
  };

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : '';

  return (
    <div className="app">
      <header className="header">
        <h1>AgentCourt</h1>
        <nav>
          <a href="#" onClick={() => setCurrentView('dashboard')}>Dashboard</a>
          <a href="#" onClick={() => setCurrentView('create')}>Create Dispute</a>
          {wrongChain && (
            <button className="btn btn-warning" onClick={handleSwitchChain}>
              Switch to GenLayer
            </button>
          )}
          <button className={`wallet-btn ${walletConnected ? 'connected' : ''}`} onClick={handleConnectWallet}>
            <span className="wallet-dot" />
            {walletConnected ? shortAddress : 'Connect Wallet'}
          </button>
        </nav>
      </header>

      {!walletConnected && (
        <div style={{
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '1rem 1.5rem',
          marginBottom: '1.5rem',
          color: 'var(--text-secondary)',
          fontSize: '0.9rem',
        }}>
          Connect your wallet to interact with AgentCourt contracts on GenLayer Studionet (Chain ID: 61999)
        </div>
      )}

      {walletConnected && wrongChain && (
        <div style={{
          background: '#3d2200',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          padding: '1rem 1.5rem',
          marginBottom: '1.5rem',
          color: '#fbbf24',
          fontSize: '0.9rem',
        }}>
          Wrong network. Please switch to GenLayer Studionet (Chain ID: 61999).
        </div>
      )}

      <main className="container">
        {currentView === 'dashboard' && <DisputeDashboard onViewDispute={handleViewDispute} />}
        {currentView === 'create' && (
          <CreateDisputeForm
            onCreated={(id) => { setSelectedDisputeId(id); setCurrentView('detail'); }}
            onCancel={() => setCurrentView('dashboard')}
          />
        )}
        {currentView === 'detail' && selectedDisputeId !== null && (
          <DisputeDetail disputeId={selectedDisputeId} onBack={() => setCurrentView('dashboard')} />
        )}
      </main>
    </div>
  );
}

export { App };
