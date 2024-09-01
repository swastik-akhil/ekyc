"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Peer, { MediaConnection } from 'peerjs';

const EkycPage: React.FC = () => {
  const [peerId, setPeerId] = useState<string>('');
  const [remotePeerIdValue, setRemotePeerIdValue] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [applicantId, setApplicantId] = useState<string>('');
  const [ekycCode, setEkycCode] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [isUploadingScreenshot, setIsUploadingScreenshot] = useState<boolean>(false);
  const [uploadScreenshotSuccess, setUploadScreenshotSuccess] = useState<boolean>(false);

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const currentUserVideoRef = useRef<HTMLVideoElement>(null);
  const peerInstance = useRef<Peer | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const uploadToServer = useCallback((blob: Blob) => {
    setIsUploading(true);
    setUploadSuccess(false);

    const formData = new FormData();
    formData.append('video', blob, 'recording.webm');
    formData.append('applicantId', applicantId);
    formData.append('ekycCode', ekycCode);

    fetch('/api/upload', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      console.log('Successfully uploaded to server', data);
      setIsUploading(false);
      setUploadSuccess(true);
    })
    .catch(err => {
      console.error('Error uploading to server', err);
      setIsUploading(false);
      setUploadSuccess(false);
    });
  }, [applicantId, ekycCode]);

  const uploadScreenshotToServer = useCallback((blob: Blob) => {
    setIsUploadingScreenshot(true);
    setUploadScreenshotSuccess(false);

    const formData = new FormData();
    formData.append('screenshot', blob, 'screenshot.png');
    formData.append('applicantId', applicantId);
    formData.append('ekycCode', ekycCode);

    fetch('/api/upload-screenshot', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      console.log('Successfully uploaded screenshot to server', data);
      setIsUploadingScreenshot(false);
      setUploadScreenshotSuccess(true);
    })
    .catch(err => {
      console.error('Error uploading screenshot to server', err);
      setIsUploadingScreenshot(false);
      setUploadScreenshotSuccess(false);
    });
  }, [applicantId, ekycCode]);

  const startRecording = useCallback((stream: MediaStream) => {
    console.log("Starting recording");
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.start();
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        uploadToServer(blob);
        recordedChunksRef.current = [];
      };
    }
  }, [uploadToServer]);

  const captureScreenshot = useCallback(() => {
    const video = currentUserVideoRef.current;
    if (video) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (blob) {
            uploadScreenshotToServer(blob);
          }
        }, 'image/png');
      }
    }
  }, [uploadScreenshotToServer]);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    setIsAdmin(queryParams.get('admin') === 'true');
    setApplicantId(queryParams.get('applicantId') || '');
    setEkycCode(queryParams.get('ekycCode') || '');

    console.log('isAdmin:', isAdmin);
    console.log('applicantId:', applicantId);
    console.log('ekycCode:', ekycCode);

    const peerId = isAdmin ? ekycCode : applicantId;


    const peer = new Peer(peerId);

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
  }, [applicantId, ekycCode, isAdmin]);

  const call = useCallback((remotePeerId: string) => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
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
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-800">
      <header className="flex flex-col sm:flex-row justify-between items-center p-4 bg-gray-900 text-white border-b border-gray-700">
        <h1 className="text-xl font-semibold text-center sm:text-left">Meeting ID: <span className="text-blue-400">{peerId}</span></h1>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-4 sm:mt-0">
          <input
            type="text"
            className="p-2 text-lg text-gray-900 border border-gray-600 rounded-md bg-white w-full sm:w-auto"
            placeholder="Enter remote peer ID"
            value={remotePeerIdValue}
            onChange={e => setRemotePeerIdValue(e.target.value)}
          />
          <button
            className="px-4 py-2 text-lg text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            onClick={() => navigator.clipboard.writeText(peerId)}
          >
            Copy ID
          </button>
          <button
            className="px-4 py-2 text-lg text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400"
            onClick={() => call(remotePeerIdValue)}
          >
            Call
          </button>
        </div>
      </header>

      {isAdmin && (
        <div className="flex flex-col sm:flex-row justify-center p-4 bg-gray-900 border-t border-gray-700">
          <button
            className="px-4 py-2 text-lg text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 mb-2 sm:mb-0 sm:mr-4"
            onClick={() => {
              if (remoteVideoRef.current?.srcObject) {
                startRecording(remoteVideoRef.current.srcObject as MediaStream);
              }
            }}
          >
            Start Recording
          </button>
          <button
            className="px-4 py-2 text-lg text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
            onClick={stopRecording}
          >
            End Recording
          </button>
          <button
            className="px-4 py-2 text-lg text-white bg-yellow-600 rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-400 mt-2"
            onClick={captureScreenshot}
          >
            Upload Screenshot
          </button>
        </div>
      )}

      <main className="flex-1 flex flex-col justify-center items-center bg-gray-900 p-4">
        <div className="flex flex-col sm:flex-row w-[99%] h-[99%] gap-4">
          <div className="flex-1 flex flex-col relative">
            <h2 className="text-xl text-white font-medium mb-2">Your Video</h2>
            <video 
              ref={currentUserVideoRef} 
              className="w-full h-full border border-gray-700 rounded-lg" 
              autoPlay 
              muted 
            />
          </div>
          <div className="flex-1 flex flex-col relative">
            <h2 className="text-xl text-white font-medium mb-2">Remote Video</h2>
            <video 
              ref={remoteVideoRef} 
              className="w-full h-full border border-gray-700 rounded-lg" 
              autoPlay 
            />
          </div>
        </div>
      </main>

      {isUploading && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-t-4 border-gray-600 border-opacity-50 rounded-full animate-spin border-blue-500"></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 bg-blue-500 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p className="text-white ml-4 text-sm">Do not close the window while uploading the video...!</p>
        </div>
      )}

      {uploadSuccess && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 p-4 bg-green-600 text-white rounded-lg shadow-lg">
          <p className="text-lg font-semibold">Uploaded successfully!</p>
        </div>
      )}

      {isUploadingScreenshot && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-t-4 border-gray-600 border-opacity-50 rounded-full animate-spin border-yellow-500"></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 bg-yellow-500 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p className="text-white ml-4 text-sm">Do not close the window while uploading the screenshot...!</p>
        </div>
      )}

      {uploadScreenshotSuccess && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 p-4 bg-yellow-600 text-white rounded-lg shadow-lg">
          <p className="text-lg font-semibold">Screenshot uploaded successfully!</p>
        </div>
      )}
    </div>
  );
};

export default EkycPage;
