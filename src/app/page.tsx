"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Peer, { MediaConnection } from 'peerjs';

interface Params {
  ekycUrl: string;
  [key: string]: string;
}

const EkycPage: React.FC = () => {
  const params = useParams<Params>();
  const ekycUrl = params?.ekycUrl ?? '';  
  const [peerId, setPeerId] = useState<string>('');
  const [remotePeerIdValue, setRemotePeerIdValue] = useState<string>('');
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const currentUserVideoRef = useRef<HTMLVideoElement>(null);
  const peerInstance = useRef<Peer | null>(null);

  useEffect(() => {
    const peer = new Peer();

    peer.on('open', (id: string) => {
      setPeerId(id);
    });

    peer.on('call', (call: MediaConnection) => {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(mediaStream => {
          if (currentUserVideoRef.current) {
            currentUserVideoRef.current.srcObject = mediaStream;
            currentUserVideoRef.current.play();
          }
          call.answer(mediaStream);
          call.on('stream', (remoteStream: MediaStream) => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
              remoteVideoRef.current.play();
            }
          });
        })
        .catch(err => console.error('Failed to get local stream', err));
    });

    peerInstance.current = peer;

    return () => {
      if (peerInstance.current) {
        peerInstance.current.destroy();
      }
    };
  }, [ekycUrl]);

  const call = (remotePeerId: string) => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(mediaStream => {
        if (currentUserVideoRef.current) {
          currentUserVideoRef.current.srcObject = mediaStream;
          currentUserVideoRef.current.play();
        }
        const call = peerInstance.current?.call(remotePeerId, mediaStream);
        if (call) {
          call.on('stream', (remoteStream: MediaStream) => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
              remoteVideoRef.current.play();
            }
          });
        }
      })
      .catch(err => console.error('Failed to get local stream', err));
  };

  return (
    <div className="flex flex-col items-center p-6 font-sans bg-black-100 min-h-screen">
      <h1 className="text-2xl text-lime-500 font-semibold mb-6">Current User ID: <span className="text-blue-500">{peerId}</span></h1>
      <div className="mb-6 flex flex-col md:flex-row items-center gap-4">
        <input
          type="text"
          className="p-2 text-lg text-fuchsia-600 border border-gray-300 rounded-md"
          placeholder="Enter remote peer ID"
          value={remotePeerIdValue}
          onChange={e => setRemotePeerIdValue(e.target.value)}
        />
        <button
          className="px-4 py-2 text-lg text-amber-600 bg-white-500 rounded-md border border-amber-600 hover:bg-amber-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-300"
          onClick={() => {
            navigator.clipboard.writeText(peerId);
          }}
        >
          Copy ID
        </button>

        <button 
          className="px-4 py-2 text-lg text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
          onClick={() => call(remotePeerIdValue)}
        >
          Call
        </button>
      </div>
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex flex-col items-center">
          <h2 className="text-xl font-medium mb-2">Your Video</h2>
          <video ref={currentUserVideoRef} className="w-80 h-60 border border-gray-300 rounded-md" autoPlay muted />
        </div>
        <div className="flex flex-col items-center">
          <h2 className="text-xl font-medium mb-2">Remote Video</h2>
          <video ref={remoteVideoRef} className="w-80 h-60 border border-gray-300 rounded-md" autoPlay />
        </div>
      </div>
      <button
        className="px-4 py-2 mt-6 text-lg text-white bg-red-500 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
        onClick={() => {
          if (peerInstance.current) {
            peerInstance.current.destroy();
          }
        }}
      >
        End Call
      </button>
    </div>
  );
};

export default EkycPage;
