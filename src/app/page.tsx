'use client';

import { useState } from 'react';
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import { PenumbraApp } from '@zondax/ledger-penumbra';
import { bech32m } from 'bech32';

export default function Home() {
  const [status, setStatus] = useState('Not connected');
  const [error, setError] = useState('');
  const [address, setAddress] = useState('');
  const [account, setAccount] = useState(0);
  const [app, setApp] = useState<PenumbraApp | null>(null);

  // This should be /0' to specify the default wallet
  const DEFAULT_PATH = "m/44'/6532'";

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

  // Then modify your getAddress function:
  const getAddress = async () => {
    try {
      setError('');
      if (!app) throw new Error('Please connect to Ledger first');

      // No way to generate addresses for other accounts?
      const response = await app.getAddress(DEFAULT_PATH, account);

      if (response.address) {
        // Convert Buffer to 5-bit words
        const words = convertBits(new Uint8Array(response.address), 8, 5, true);

        // Encode with our custom bech32m implementation
        const encoded = encodeBech32m('penumbra', words);

        setAddress(encoded);
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


// Add these helper functions at the top of your file, outside the component
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function convertBits(data: Uint8Array, fromBits: number, toBits: number, pad: boolean): number[] {
  let acc = 0;
  let bits = 0;
  const result: number[] = [];
  const maxv = (1 << toBits) - 1;

  for (let p = 0; p < data.length; p++) {
    const value = data[p];
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      result.push((acc >> bits) & maxv);
    }
  }

  if (pad) {
    if (bits > 0) {
      result.push((acc << (toBits - bits)) & maxv);
    }
  }

  return result;
}

function createChecksum(prefix: string, words: number[]): string {
  // Compute polynomial modulo
  const values = [...prefix.split('').map(c => c.charCodeAt(0) & 31), 0, ...words];
  let polymod = 1;
  for (let v of values) {
    let b = polymod >> 25;
    polymod = ((polymod & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 25; i++) {
      if ((b >> i) & 1) {
        polymod ^= 0x3b6a57b2 << i;
      }
    }
  }

  // Convert to 6 characters
  const result: string[] = [];
  for (let i = 0; i < 6; i++) {
    result.push(CHARSET[polymod & 31]);
    polymod >>= 5;
  }
  return result.reverse().join('');
}

function encodeBech32m(prefix: string, words: number[]): string {
  const checksum = createChecksum(prefix, words);
  let result = `${prefix}1`;
  for (const word of words) {
    result += CHARSET.charAt(word);
  }
  return result + checksum;
}
