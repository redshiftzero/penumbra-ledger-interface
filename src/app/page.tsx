'use client';

import { useState } from 'react';
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import { PenumbraApp } from '@zondax/ledger-penumbra';

export default function Home() {
  const [status, setStatus] = useState('Not connected');
  const [error, setError] = useState('');
  const [address, setAddress] = useState('');
  const [account, setAccount] = useState(0);
  const [app, setApp] = useState<PenumbraApp | null>(null);

  const DEFAULT_PATH = "m/44'/6532'/0'";

  const handleConnect = async () => {
    try {
      setError('');
      setStatus('Connecting...');
      
      const transport = await TransportWebUSB.create();
      const penumbraApp = new PenumbraApp(transport);
      
      setApp(penumbraApp);
      setStatus('Connected');
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Ledger device');
      setStatus('Connection failed');
    }
  };

  const getAddress = async () => {
    try {
      setError('');
      if (!app) throw new Error('Please connect to Ledger first');
      
      const response = await app.getAddress(DEFAULT_PATH, account);
      
      if (response.address) {
        setAddress(response.address.toString('hex'));
        setStatus('Address retrieved successfully');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to get address');
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold mb-8">Penumbra Ledger Interface</h1>
        
        <button
          onClick={handleConnect}
          disabled={app !== null}
          className="w-full bg-blue-500 text-white p-2 rounded disabled:bg-gray-300"
        >
          Connect to Ledger
        </button>

        <div>
          <label className="block mb-2">Account Index</label>
          <input
            type="number"
            value={account}
            onChange={(e) => setAccount(parseInt(e.target.value) || 0)}
            className="w-full border p-2 rounded"
          />
        </div>

        <button
          onClick={getAddress}
          disabled={!app}
          className="w-full bg-green-500 text-white p-2 rounded disabled:bg-gray-300"
        >
          Get Address
        </button>

        {address && (
          <div className="p-4 bg-gray-100 rounded break-all">
            <div className="font-bold">Address:</div>
            <div className="font-mono text-sm">{address}</div>
          </div>
        )}

        <div className="mt-4">
          <div className="font-bold">Status:</div>
          <div>{status}</div>
          
          {error && (
            <div className="mt-2 p-4 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}