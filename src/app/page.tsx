"use client";

import { useEffect, useRef, useState } from "react";
import Peer, { MediaConnection } from 'peerjs';

const EkycPage: React.FC = () => {
  const [peerId, setPeerId] = useState<string>('');
  const [remotePeerIdValue, setRemotePeerIdValue] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false); // Loading state
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false); // Success state

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const currentUserVideoRef = useRef<HTMLVideoElement>(null);
  const peerInstance = useRef<Peer | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    setIsAdmin(queryParams.get('admin') === 'true');
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
  }, [isAdmin]);

  const startRecording = (stream: MediaStream) => {
    console.log("Starting recording");
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.start();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        uploadToServer(blob);
        recordedChunksRef.current = [];
      };
    }
  };

  const uploadToServer = (blob: Blob) => {
    setIsUploading(true); // Show loading state
    setUploadSuccess(false); // Reset success message

    const formData = new FormData();
    formData.append('video', blob, 'recording.webm');

    fetch('/api/upload', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      console.log('Successfully uploaded to server', data);
      setIsUploading(false); // Hide loading state
      setUploadSuccess(true); // Show success message
    })
    .catch(err => {
      console.error('Error uploading to server', err);
      setIsUploading(false); // Hide loading state
      setUploadSuccess(false); // Optionally handle error state
    });
  };

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
    <div className="flex flex-col items-center p-6 font-sans bg-gray-900 min-h-screen">
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
          <h2 className="text-xl font-medium mb-2 text-white">Your Video</h2>
          <video ref={currentUserVideoRef} className="w-80 h-60 border border-gray-300 rounded-md" autoPlay muted />
        </div>
        <div className="flex flex-col items-center">
          <h2 className="text-xl font-medium mb-2 text-white">Remote Video</h2>
          <video ref={remoteVideoRef} className="w-80 h-60 border border-gray-300 rounded-md" autoPlay />
        </div>
      </div>
      {isAdmin && (
        <div className="mt-6 flex gap-4">
          <button
            className="px-4 py-2 text-lg text-white bg-green-500 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-300"
            onClick={() => {
              if (remoteVideoRef.current?.srcObject) {
                startRecording(remoteVideoRef.current.srcObject as MediaStream);
              }
            }}
          >
            Start Recording
          </button>
          <button
            className="px-4 py-2 text-lg text-white bg-red-500 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
            onClick={stopRecording}
          >
            End Recording
          </button>
        </div>
      )}
      {isUploading && (
        <div className="mt-4 text-center flex flex-col items-center">
          <p className="text-white mb-2">Please don't close the window while it's uploading...</p>
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-t-4 border-gray-200 border-opacity-50 rounded-full animate-spin border-blue-500"></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-blue-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      )}
      {uploadSuccess && (
        <div className="mt-4 text-center">
          <p className="text-green-500 text-lg font-semibold">Uploaded successfully!</p>
        </div>
      )}
    </div>
  );
};

export default EkycPage;
