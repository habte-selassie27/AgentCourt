import { useState, useEffect } from 'react';
import { DisputeDashboard } from './components/DisputeDashboard';
import { DisputeDetail } from './components/DisputeDetail';
import { CreateDisputeForm } from './components/CreateDisputeForm';
import { GENLAYER_EXPLORER_URL, getCourt } from './sdk';

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

    let lastChainId: number | null = null;
    const onAccountsChanged = (accounts: string[]) => {
      // Keep the SDK writeClient.account in lockstep with the wallet's
      // selected account — otherwise eth_sendTransaction fails with
      // -32602 "from should be same as current address".
      const court = getCourt();
      if (accounts.length === 0) {
        court.disconnectWallet();
        setWalletConnected(false);
        setWalletAddress('');
        return;
      }
      void court
        .syncWalletAccount(window.ethereum)
        .then((live) => {
          setWalletConnected(Boolean(live));
          setWalletAddress(live ?? String(accounts[0] ?? ''));
        })
        .catch((err) => {
          console.error('Failed to resync wallet account:', err);
          setWalletConnected(false);
          setWalletAddress(String(accounts[0] ?? ''));
        });
    };
    const onChainChanged = (chainHex: string) => {
      const id = parseInt(chainHex, 16);
      // Wallets re-emit chainChanged after every tx on the same chain.
      // A full reload here wipes an in-flight Create Dispute submit.
      if (lastChainId !== null && id === lastChainId) return;
      const changedFromKnown = lastChainId !== null;
      lastChainId = id;
      setWrongChain(id !== TARGET_CHAIN_ID);
      if (changedFromKnown && id !== TARGET_CHAIN_ID) {
        window.location.reload();
      }
    };

    // Seed from current chain so the first post-tx re-emit is ignored.
    window.ethereum
      .request({ method: 'eth_chainId' })
      .then((chainHex: string) => {
        lastChainId = parseInt(String(chainHex), 16);
      })
      .catch(() => {});

    window.ethereum.on('accountsChanged', onAccountsChanged);
    window.ethereum.on('chainChanged', onChainChanged);
    return () => {
      window.ethereum?.removeListener?.('accountsChanged', onAccountsChanged);
      window.ethereum?.removeListener?.('chainChanged', onChainChanged);
    };
  }, []);

  const handleConnectWallet = async () => {
    if (walletConnected) {
      getCourt().disconnectWallet();
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
            blockExplorerUrls: [GENLAYER_EXPLORER_URL],
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
        <div className="brand">
          <span className="brand-mark" role="img" aria-label="AgentCourt">⚖️</span>
          <span className="brand-text">
            <h1>AgentCourt</h1>
            <span className="brand-tagline">Autonomous arbitration · GenLayer Studionet</span>
          </span>
        </div>
        <nav>
          <button
            type="button"
            className={`nav-link ${currentView === 'dashboard' ? 'active' : ''}`}
            aria-current={currentView === 'dashboard' ? 'page' : undefined}
            onClick={() => setCurrentView('dashboard')}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={`nav-link ${currentView === 'create' ? 'active' : ''}`}
            aria-current={currentView === 'create' ? 'page' : undefined}
            onClick={() => setCurrentView('create')}
          >
            Create Dispute
          </button>
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
        <div className="container" style={{ paddingBottom: 0 }}>
          <div className="banner banner-info">
            <strong>Connect your wallet</strong> to interact with AgentCourt contracts on GenLayer Studionet (Chain ID: 61999).
          </div>
        </div>
      )}

      {walletConnected && wrongChain && (
        <div className="container" style={{ paddingBottom: 0 }}>
          <div className="banner banner-warning">
            <strong>Wrong network.</strong> Please switch to GenLayer Studionet (Chain ID: 61999).
          </div>
        </div>
      )}

      <main className="container">
        {currentView === 'dashboard' && (
          <DisputeDashboard
            onViewDispute={handleViewDispute}
            onCreateDispute={() => setCurrentView('create')}
          />
        )}
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

      <footer className="footer">
        <span>AgentCourt · GenLayer Studionet (61999) · Intelligent Contracts, no Solidity path</span>
        <span>
          <a href={GENLAYER_EXPLORER_URL} target="_blank" rel="noreferrer">Explorer</a>
          {' · '}
          <a href="https://studio.genlayer.com/api" target="_blank" rel="noreferrer">RPC</a>
        </span>
      </footer>
    </div>
  );
}

export { App };
