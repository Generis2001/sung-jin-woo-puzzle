import { useState, useEffect } from 'react';
import { useConnect, useAccount, useChainId, useSwitchChain, useDisconnect } from 'wagmi';
import { base } from 'wagmi/chains';
import { toast } from './lib/toast';
import { BUILDER_CODE } from './config';

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum Mainnet', 5: 'Goerli Testnet', 11155111: 'Sepolia Testnet',
  137: 'Polygon', 56: 'BNB Chain', 42161: 'Arbitrum One',
  10: 'Optimism', 43114: 'Avalanche', 84532: 'Base Sepolia', 324: 'zkSync Era', 250: 'Fantom',
};

interface Props { onStart: (username: string) => void; }

export default function OnboardingScreen({ onStart }: Props) {
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { disconnect } = useDisconnect();

  const [username, setUsername] = useState('');
  const onBase = chainId === base.id;

  useEffect(() => {
    const saved = localStorage.getItem('sjw_username');
    if (saved) setUsername(saved);
  }, []);

  useEffect(() => {
    if (isConnected && chainId) {
      if (!onBase) toast(`⚠️ Wrong network. Switch to Base to continue.`, 'err');
      else toast('✅ Connected to Base!', 'ok');
    }
  }, [isConnected, chainId, onBase]);

  const handleConnect = () => {
    const injector = connectors.find(c => c.id === 'injected');
    const cbw      = connectors.find(c => c.id === 'coinbaseWalletSDK');
    const connector = injector ?? cbw ?? connectors[0];
    if (!connector) {
      toast('No wallet detected. Install MetaMask or open in the Base app.', 'err');
      return;
    }
    connect({ connector });
  };

  const handleSwitch = () => switchChain({ chainId: base.id });

  const handleStart = () => {
    if (!username.trim()) { toast('Please enter your hunter name!', 'err'); return; }
    if (!isConnected)     { toast('Connect your wallet first.', 'err'); return; }
    if (!onBase)          { toast('Switch to Base network first.', 'err'); return; }
    localStorage.setItem('sjw_username', username.trim());
    onStart(username.trim());
  };

  const fmtAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  const wrongNetName = CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;

  return (
    <div className="screen" id="screen-onboarding">
      <div className="ob-card">
        <div className="logo-wrap">
          <span className="sjw-aura">👤</span>
          <div className="game-title">Shadow Monarch's Match</div>
          <div className="game-sub">Solo Leveling Puzzle · Powered by Base</div>
        </div>

        {isConnected && !onBase && (
          <div className="net-warn show">
            <div className="nw-title">⚠️ Wrong Network Detected</div>
            <div className="nw-text">
              You are currently on {wrongNetName}. Please switch to Base network to continue.
            </div>
            <button className="btn btn-danger" onClick={handleSwitch}>Switch to Base Network</button>
          </div>
        )}

        {isConnected && address && (
          <div className="wallet-strip show">
            <div className="ws-dot" />
            <span className="ws-addr">{fmtAddr(address)}</span>
            <span className={`ws-net${onBase ? '' : ' wrong'}`}>
              {onBase ? 'Base' : '⚠ Wrong Network'}
            </span>
          </div>
        )}

        {!isConnected && (
          <button
            className="btn btn-primary"
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? '🔄 Connecting…' : '🔗 Connect Wallet'}
          </button>
        )}

        {isConnected && onBase && (
          <div>
            <label className="field-label" htmlFor="username-input">Hunter Name</label>
            <input
              className="text-field"
              id="username-input"
              type="text"
              placeholder="e.g. Sung Jin-Woo"
              maxLength={18}
              autoComplete="off"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
            />
            <button className="btn btn-gold" onClick={handleStart}>⚔️ Enter the Dungeon</button>
          </div>
        )}

        {isConnected && (
          <button
            className="btn btn-ghost"
            style={{ marginTop: 4 }}
            onClick={() => disconnect()}
          >
            🔌 Disconnect
          </button>
        )}

        <div className="brand-line">🔷 Base L2 · Builder Code: {BUILDER_CODE}</div>
      </div>
    </div>
  );
}
