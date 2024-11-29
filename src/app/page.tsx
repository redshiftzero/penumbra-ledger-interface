'use client';

import * as protobuf from 'protobufjs';
import { useState } from 'react';
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import { PenumbraApp } from '@zondax/ledger-penumbra';
import { AddressIndex } from '@zondax/ledger-penumbra';
import { bech32m } from 'bech32';

export default function Home() {
  const [status, setStatus] = useState('Not connected');
  const [error, setError] = useState('');
  const [address, setAddress] = useState('');
  const [account, setAccount] = useState(0);
  const [app, setApp] = useState<PenumbraApp | null>(null);
  const [fvk, setFvk] = useState('');
  const [signatureResult, setSignatureResult] = useState<string>('');

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

      const my_addressIndex: AddressIndex = {
        account: account,
      };
      const response = await app.getAddress(DEFAULT_PATH, my_addressIndex);

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

  const showAddress = async () => {
    try {
      setError('');
      if (!app) throw new Error('Please connect to Ledger first');

      // No way to generate addresses for other accounts?
      const my_addressIndex: AddressIndex = {
        account: account,
      };
      const response = await app.showAddress(DEFAULT_PATH, my_addressIndex);

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

  const getFvk = async () => {
    try {
      setError('');
      if (!app) throw new Error('Please connect to Ledger first');

      const my_addressIndex: AddressIndex = {
        account: account,
      };
      const response = await app.getFVK(DEFAULT_PATH, my_addressIndex);

      if (response.ak) {
        const combinedBuffer = Buffer.concat([response.ak, response.nk]);
        const fvkHex = combinedBuffer.toString('hex');
        setFvk(fvkHex);
        setStatus('FVK retrieved successfully');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to get FVK');
    }
  };

  const signTransaction = async () => {
    try {
      setError('');
      if (!app) throw new Error('Please connect to Ledger first');

      // Check app is ready
      const appInfo = await app.appInfo();
      console.log('App Info:', appInfo);

      // Check version
      const version = await app.getVersion();
      console.log('App Version:', version);


      const root = new protobuf.Root();

      root.resolvePath = (origin, target) => {
        // Remove everything up to the second 'penumbra' in the path
        const parts = target.split('penumbra/');
        const cleanTarget = parts[parts.length - 1];

        const path = `/protos/penumbra/${cleanTarget}`;
        console.log('Resolving import:', { origin, target, resolvedPath: path });
        return path;
      };

      await root.load('/protos/penumbra/core/transaction/v1/transaction.proto', {
        keepCase: true,
      });

      const TransactionPlan = root.lookupType('penumbra.core.transaction.v1.TransactionPlan');

      // // Create the simplest possible transaction plan
      // const message = TransactionPlan.create({
      //   actions: [], // Empty array of actions
      // });

      // Load the encoded message
      const response2 = await fetch('/protos/transaction_plan_3.proto');
      const arrayBuffer = await response2.arrayBuffer();
      const encodedMessage = new Uint8Array(arrayBuffer);

      // Decode and verify it's a valid TransactionPlan
      const decodedPlan = TransactionPlan.decode(encodedMessage);
      const verifyError = TransactionPlan.verify(decodedPlan);
      if (verifyError) {
        throw new Error(`Invalid transaction plan: ${verifyError}`);
      }

      // const response2 = await fetch('/protos/transaction_plan_3.proto');
      // const arrayBuffer = await response2.arrayBuffer();
      // //const buffer = Buffer.from(arrayBuffer);

      // // Verify the message
      // const errMsg = TransactionPlan.verify(message);
      // if (errMsg) throw Error(errMsg);

      // // Encode to buffer
      // const buffer = Buffer.from(TransactionPlan.encode(message).finish());

      // Re-encode it to a buffer
      const buffer = Buffer.from(TransactionPlan.encode(decodedPlan).finish());

      console.log('Transaction plan size:', buffer.length, 'bytes');
      console.log('Decoded plan:', decodedPlan);

      if (buffer.length > 10240) {
        throw new Error('Transaction plan too large: must be under 10KB');
      }

      console.log('Buffer size before signing:', buffer.length, 'bytes');
      console.log('First few bytes:', buffer.slice(0, 20));  // Look at start of buffer
      console.log('Path:', DEFAULT_PATH);

      setStatus('Attempting to sign - please check your Ledger device...');

      const my_addressIndex: AddressIndex = {
        account: account,
      };
      console.log('Address Index:', my_addressIndex);

      // Add timeout to the sign operation
      console.log('Starting sign operation...');
      const signPromise = app.sign(DEFAULT_PATH, my_addressIndex, buffer);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Signing timed out - check your Ledger device')), 30000);
      });

      const response3 = await Promise.race([signPromise, timeoutPromise]) as Awaited<ReturnType<typeof app.sign>>;

      if (response3.signature) {
        const signatureHex = Buffer.from(response3.signature).toString('hex');
        setSignatureResult(signatureHex);
        setStatus('Transaction signed successfully');
      }
    } catch (err: any) {
      console.error('Signing error:', err);
      if (err.message.includes('timeout')) {
        setError('Operation timed out. Make sure your Ledger is unlocked and the Penumbra app is open');
      } else {
        setError(err.message || 'Failed to sign transaction');
      }
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
        <br></br>

        <button
          onClick={signTransaction}
          disabled={!app}
          className="w-full bg-yellow-500 text-white p-2 rounded disabled:bg-gray-300"
        >
          Sign Test Transaction 3
        </button>

        {signatureResult && (
          <div className="p-4 bg-gray-100 rounded break-all">
            <div className="font-bold">Signature:</div>
            <div className="font-mono text-sm">{signatureResult}</div>
          </div>
        )}

        <button
          onClick={getFvk}
          disabled={!app}
          className="w-full bg-purple-500 text-white p-2 rounded disabled:bg-gray-300"
        >
          Get Full Viewing Key
        </button>
        <br></br>

        {fvk && (
          <div className="p-4 bg-gray-100 rounded break-all">
            <div className="font-bold">Full Viewing Key:</div>
            <div className="font-mono text-sm">{fvk}</div>
          </div>
        )}

        <div>
          <label className="block mb-2">Address Index for Account 0</label>
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

        <button
          onClick={showAddress}
          disabled={!app}
          className="w-full bg-blue-500 text-white p-2 rounded disabled:bg-gray-300"
        >
          Show Address on Ledger
        </button>

        {address && (
          <div className="p-4 bg-gray-100 rounded break-all">
            <div className="font-bold">Address:</div>
            <div className="font-mono text-sm">{address}</div>
          </div>
        )}
      </div>
      <div className="mt-4">
        <div className="font-bold">Status:</div>
        <div>{status}</div>

        {error && (
          <div className="mt-2 p-4 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
      </div>

    </main>
  );
}


// Add these helper functions at the top of your file, outside the component
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

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const BECH32M_CONST = 0x2bc830a3;

function hrpExpand(hrp: string): number[] {
  const highBits = hrp.split('').map(c => c.charCodeAt(0) >> 5);
  const lowBits = hrp.split('').map(c => c.charCodeAt(0) & 31);
  return [...highBits, 0, ...lowBits];
}

function polymod(values: number[]): number {
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) {
      chk ^= (top >> i) & 1 ? GENERATOR[i] : 0;
    }
  }
  return chk;
}

function createChecksum(hrp: string, data: number[]): number[] {
  const values = [...hrpExpand(hrp), ...data];
  const polymodValue = polymod([...values, 0, 0, 0, 0, 0, 0]) ^ BECH32M_CONST;
  const checksum = [];
  for (let i = 0; i < 6; i++) {
    checksum.push((polymodValue >> (5 * (5 - i))) & 31);
  }
  return checksum;
}

function encodeBech32m(hrp: string, data: number[]): string {
  const checksum = createChecksum(hrp, data);
  const combined = [...data, ...checksum];
  let result = `${hrp}1`;
  for (const value of combined) {
    result += CHARSET[value];
  }
  return result;
}

function verifyChecksum(hrp: string, data: number[]): boolean {
  const values = [...hrpExpand(hrp), ...data];
  return polymod(values) === BECH32M_CONST;
}