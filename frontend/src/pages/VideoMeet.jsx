import React, { useEffect, useRef, useState } from 'react';
import io from "socket.io-client";
import { Badge, IconButton, TextField, Button, Box, Paper, Typography, Container } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatIcon from '@mui/icons-material/Chat';
import styles from "../styles/videoComponent.module.css";
import server from '../environment';

const server_url = server;
let connections = {};

const peerConfigConnections = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302" }
    ]
};

export default function VideoMeetComponent() {
    var socketRef = useRef();
    let socketIdRef = useRef();
    let localVideoref = useRef();
    const videoRef = useRef([]);

    let [videoAvailable, setVideoAvailable] = useState(true);
    let [audioAvailable, setAudioAvailable] = useState(true);
    let [video, setVideo] = useState(true);
    let [audio, setAudio] = useState(true);
    let [screen, setScreen] = useState();
    let [showModal, setModal] = useState(false); // Changed default to false for chat
    let [screenAvailable, setScreenAvailable] = useState();
    let [messages, setMessages] = useState([]);
    let [message, setMessage] = useState("");
    let [newMessages, setNewMessages] = useState(0);
    let [askForUsername, setAskForUsername] = useState(true);
    let [username, setUsername] = useState("");
    let [videos, setVideos] = useState([]);

    useEffect(() => {
        getPermissions();
        
        // CLEANUP: Component unmount par clear karna zaruri hai
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current.off('signal');
                socketRef.current.off('chat-message');
                socketRef.current.off('user-left');
                socketRef.current.off('user-joined');
            }
            // Clear connections object to prevent ghost peers
            for (let key in connections) {
                if (connections[key]) connections[key].close();
                delete connections[key];
            }
        };
    }, []);

    const getPermissions = async () => {
        try {
            const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => false);
            setVideoAvailable(!!videoPermission);

            const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => false);
            setAudioAvailable(!!audioPermission);

            setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);

            if (videoPermission || audioPermission) {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({ video: !!videoPermission, audio: !!audioPermission });
                if (userMediaStream) {
                    window.localStream = userMediaStream;
                    if (localVideoref.current) {
                        localVideoref.current.srcObject = userMediaStream;
                    }
                }
            }
        } catch (error) {
            console.log(error);
        }
    };

    let getDislayMedia = () => {
        if (screen && navigator.mediaDevices.getDisplayMedia) {
            navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
                .then(getDislayMediaSuccess)
                .catch((e) => console.log(e));
        }
    };

    let getMedia = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable);
        connectToSocketServer();
    };

    let connectToSocketServer = () => {
        socketRef.current = io.connect(server_url, { secure: false });

        socketRef.current.on('signal', gotMessageFromServer);

        socketRef.current.on('connect', () => {
            socketRef.current.emit('join-call', window.location.href);
            socketIdRef.current = socketRef.current.id;
        });

        socketRef.current.on('chat-message', addMessage);

        socketRef.current.on('user-left', (id) => {
            setVideos((videos) => videos.filter((video) => video.socketId !== id));
            if (connections[id]) {
                connections[id].close();
                delete connections[id];
            }
        });

        socketRef.current.on('user-joined', (id, clients) => {
            clients.forEach((socketListId) => {
                // DUPLICATE FIX: Ensure we don't setup connection with ourselves or twice
                if (connections[socketListId] || socketListId === socketIdRef.current) return;

                connections[socketListId] = new RTCPeerConnection(peerConfigConnections);

                connections[socketListId].onicecandidate = function (event) {
                    if (event.candidate != null) {
                        socketRef.current.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }));
                    }
                };

                connections[socketListId].ontrack = (event) => {
                    let videoExists = videoRef.current.find(video => video.socketId === socketListId);

                    if (videoExists) {
                        setVideos(videos => {
                            const updatedVideos = videos.map(video =>
                                video.socketId === socketListId ? { ...video, stream: event.streams[0] } : video
                            );
                            videoRef.current = updatedVideos;
                            return updatedVideos;
                        });
                    } else {
                        let newVideo = { socketId: socketListId, stream: event.streams[0] };
                        setVideos(videos => {
                            const updatedVideos = [...videos, newVideo];
                            videoRef.current = updatedVideos;
                            return updatedVideos;
                        });
                    }
                };

                if (window.localStream) {
                    window.localStream.getTracks().forEach(track => {
                        connections[socketListId].addTrack(track, window.localStream);
                    });
                } else {
                    let blackSilence = (...args) => new MediaStream([black(...args), silence()]);
                    window.localStream = blackSilence();
                    window.localStream.getTracks().forEach(track => {
                        connections[socketListId].addTrack(track, window.localStream);
                    });
                }
            });

            if (id === socketIdRef.current) {
                for (let id2 in connections) {
                    if (id2 === socketIdRef.current) continue;
                    connections[id2].createOffer().then((description) => {
                        connections[id2].setLocalDescription(description)
                            .then(() => {
                                socketRef.current.emit('signal', id2, JSON.stringify({ 'sdp': connections[id2].localDescription }));
                            }).catch(e => console.log(e));
                    });
                }
            }
        });
    };

    let gotMessageFromServer = (fromId, message) => {
        var signal = JSON.parse(message);
        if (fromId !== socketIdRef.current) {
            if (!connections[fromId]) {
                connections[fromId] = new RTCPeerConnection(peerConfigConnections);
                // setup identical to above if late joining
            }
            if (signal.sdp) {
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                    if (signal.sdp.type === 'offer') {
                        connections[fromId].createAnswer().then((description) => {
                            connections[fromId].setLocalDescription(description).then(() => {
                                socketRef.current.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription }));
                            }).catch(e => console.log(e));
                        }).catch(e => console.log(e));
                    }
                }).catch(e => console.log(e));
            }
            if (signal.ice) {
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e));
            }
        }
    };

    let getDislayMediaSuccess = (stream) => {
        try { window.localStream.getTracks().forEach(track => track.stop()); } catch (e) { }

        window.localStream = stream;
        localVideoref.current.srcObject = stream;

        for (let id in connections) {
            if (id === socketIdRef.current) continue;
            const senders = connections[id].getSenders();
            senders.forEach(sender => connections[id].removeTrack(sender));
            window.localStream.getTracks().forEach(track => {
                connections[id].addTrack(track, window.localStream);
            });
            connections[id].createOffer().then((description) => {
                connections[id].setLocalDescription(description).then(() => {
                    socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }));
                }).catch(e => console.log(e));
            });
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setScreen(false);
            navigator.mediaDevices.getUserMedia({ video: video, audio: audio })
                .then(newStream => {
                    window.localStream = newStream;
                    localVideoref.current.srcObject = newStream;
                    for (let id in connections) {
                        const senders = connections[id].getSenders();
                        senders.forEach(sender => connections[id].removeTrack(sender));
                        window.localStream.getTracks().forEach(track => {
                            connections[id].addTrack(track, window.localStream);
                        });
                        connections[id].createOffer().then((description) => {
                            connections[id].setLocalDescription(description).then(() => socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription })));
                        });
                    }
                });
        });
    };

    let silence = () => {
        let ctx = new AudioContext();
        let oscillator = ctx.createOscillator();
        let dst = oscillator.connect(ctx.createMediaStreamDestination());
        oscillator.start();
        ctx.resume();
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
    };

    let black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height });
        canvas.getContext('2d').fillRect(0, 0, width, height);
        let stream = canvas.captureStream();
        return Object.assign(stream.getVideoTracks()[0], { enabled: false });
    };

    let handleVideo = () => {
        setVideo(!video);
        if (window.localStream) {
            window.localStream.getVideoTracks().forEach(track => track.enabled = !video);
        }
    };
    
    let handleAudio = () => {
        setAudio(!audio);
        if (window.localStream) {
            window.localStream.getAudioTracks().forEach(track => track.enabled = !audio);
        }
    };

    useEffect(() => {
        if (screen !== undefined) {
            getDislayMedia();
        }
    }, [screen]);
    
    let handleScreen = () => setScreen(!screen);

    let handleEndCall = () => {
        try {
            let tracks = localVideoref.current.srcObject.getTracks();
            tracks.forEach(track => track.stop());
        } catch (e) { }
        window.location.href = "/";
    };

    const addMessage = (data, sender, socketIdSender) => {
        setMessages((prev) => [...prev, { sender: sender, data: data }]);
        if (socketIdSender !== socketIdRef.current) {
            setNewMessages((prev) => prev + 1);
        }
    };

    let sendMessage = () => {
        if (message.trim() === "") return;
        socketRef.current.emit('chat-message', message, username);
        setMessage("");
    };
    
    let connect = () => {
        if (username.trim() === "") return; // Protect against empty usernames
        setAskForUsername(false);
        getMedia();
    };

    return (
        <div>
            {askForUsername === true ?
                <Container maxWidth="sm">
                    <Paper elevation={8} sx={{ p: 6, borderRadius: '24px', bgcolor: '#1e293b', width: '100%', textAlign: 'center', border: '1px solid #334155' }}>
                        <Typography variant="h4" sx={{ mb: 4, fontWeight: 700, color: '#fff' }}>
                            Join Meeting
                        </Typography>
                        <TextField 
                            fullWidth label="Username" variant="outlined" value={username} 
                            onChange={e => setUsername(e.target.value)}
                            sx={{ mb: 4, bgcolor: '#ffffff', borderRadius: '10px', '& .MuiInputBase-input': { color: '#000', fontSize: '1.1rem' } }}
                        />
                        <Button 
                            fullWidth variant="contained" size="large" onClick={connect}
                            sx={{ borderRadius: '12px', textTransform: 'none', mb: 4, py: 2, fontSize: '1.1rem' }}
                        >
                            Connect Now
                        </Button>
                        <Box sx={{ mt: 2, borderRadius: '20px', overflow: 'hidden', bgcolor: '#000', aspectRatio: '16/9', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                            <video 
                                ref={ref => { if (ref && window.localStream && ref.srcObject !== window.localStream) ref.srcObject = window.localStream; }} 
                                autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            ></video>
                        </Box>
                    </Paper>
                </Container> :
                <div className={styles.meetVideoContainer}>
                    {showModal && (
                        <div className={styles.chatRoom}>
                            <div className={styles.chatContainer}>
                                <h1>Chat</h1>
                                <div className={styles.chattingDisplay}>
                                    {messages.length !== 0 ? messages.map((item, index) => (
                                        <div style={{ marginBottom: "20px" }} key={index}>
                                            <p style={{ fontWeight: "bold" }}>{item.sender}</p>
                                            <p>{item.data}</p>
                                        </div>
                                    )) : <p>No Messages Yet</p>}
                                </div>
                                <div className={styles.chattingArea}>
                                    <TextField value={message} onChange={(e) => setMessage(e.target.value)} label="Enter Your chat" variant="outlined" />
                                    <Button variant='contained' onClick={sendMessage}>Send</Button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={styles.videoGrid}>
                        <div className={styles.videoWrapper}>
                            <video 
                                ref={ref => { if (ref && window.localStream && ref.srcObject !== window.localStream) ref.srcObject = window.localStream; }} 
                                autoPlay muted playsInline
                            />
                        </div>
                        {videos.map((video) => (
                            <div key={video.socketId} className={styles.videoWrapper}>
                                <video
                                    data-socket={video.socketId}
                                    ref={ref => { if (ref && video.stream && ref.srcObject !== video.stream) ref.srcObject = video.stream; }}
                                    autoPlay playsInline
                                />
                            </div>
                        ))}
                    </div>

                    <div className={styles.buttonContainers}>
                        <IconButton onClick={handleVideo} style={{ color: "white" }}>
                            {video ? <VideocamIcon /> : <VideocamOffIcon />}
                        </IconButton>
                        <IconButton onClick={handleEndCall} style={{ color: "red" }}>
                            <CallEndIcon />
                        </IconButton>
                        <IconButton onClick={handleAudio} style={{ color: "white" }}>
                            {audio ? <MicIcon /> : <MicOffIcon />}
                        </IconButton>
                        {screenAvailable && (
                            <IconButton onClick={handleScreen} style={{ color: "white" }}>
                                {screen ? <ScreenShareIcon /> : <StopScreenShareIcon />}
                            </IconButton>
                        )}
                        <Badge badgeContent={newMessages} max={999} color='error'>
                            <IconButton onClick={() => { setModal(!showModal); if(!showModal) setNewMessages(0); }} style={{ color: "white" }}>
                                <ChatIcon />
                            </IconButton>
                        </Badge>
                    </div>
                </div>
            }
        </div>
    );
}