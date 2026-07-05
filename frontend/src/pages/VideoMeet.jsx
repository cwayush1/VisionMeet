import React, { useEffect, useRef, useState } from 'react'
import io from "socket.io-client";
import { Badge, IconButton, TextField, Button } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare'
import ChatIcon from '@mui/icons-material/Chat'
import styles from "../styles/videoComponent.module.css";
import server from '../environment';
import { Box, Paper, Typography,Container} from '@mui/material';

const server_url = server;

var connections = {};

const peerConfigConnections = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302" }
    ]
}

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
    let [showModal, setModal] = useState(true);
    let [screenAvailable, setScreenAvailable] = useState();
    let [messages, setMessages] = useState([]);
    let [message, setMessage] = useState("");
    let [newMessages, setNewMessages] = useState(0);
    let [askForUsername, setAskForUsername] = useState(true);
    let [username, setUsername] = useState("");
    let [videos, setVideos] = useState([]);

    // 1. Fixed the infinite re-render loop
    useEffect(() => {
        getPermissions();
    }, []);

    const getPermissions = async () => {
        try {
            const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => false);
            if (videoPermission) {
                setVideoAvailable(true);
            } else {
                setVideoAvailable(false);
            }

            const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => false);
            if (audioPermission) {
                setAudioAvailable(true);
            } else {
                setAudioAvailable(false);
            }

            if (navigator.mediaDevices.getDisplayMedia) {
                setScreenAvailable(true);
            } else {
                setScreenAvailable(false);
            }

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
        if (screen) {
            if (navigator.mediaDevices.getDisplayMedia) {
                navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
                    .then(getDislayMediaSuccess)
                    .catch((e) => console.log(e))
            }
        }
    }

    let getMedia = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable);
        connectToSocketServer();
    }

    // 2. Modernized gotMessageFromServer (Fixes second user not seeing video)
    let gotMessageFromServer = (fromId, message) => {
        var signal = JSON.parse(message)

        if (fromId !== socketIdRef.current) {
            
            // Instantly catch new connections so WebRTC doesn't fail
            if (!connections[fromId]) {
                connections[fromId] = new RTCPeerConnection(peerConfigConnections);
                
                connections[fromId].onicecandidate = function (event) {
                    if (event.candidate != null) {
                        socketRef.current.emit('signal', fromId, JSON.stringify({ 'ice': event.candidate }))
                    }
                }
                
                connections[fromId].ontrack = (event) => {
                    setVideos(prevVideos => {
                        const existingVideo = prevVideos.find(v => v.socketId === fromId);

                        if (existingVideo) {
                            return prevVideos.map(v =>
                                v.socketId === fromId
                                    ? { ...v, stream: event.streams[0] }
                                    : v
                            );
                        }

                        return [
                            ...prevVideos,
                            {
                                socketId: fromId,
                                stream: event.streams[0]
                            }
                        ];
                    });
                };

                if (window.localStream) {
                    window.localStream.getTracks().forEach(track => {
                        connections[fromId].addTrack(track, window.localStream);
                    });
                }
            }

            if (signal.sdp) {
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                    if (signal.sdp.type === 'offer') {
                        connections[fromId].createAnswer().then((description) => {
                            connections[fromId].setLocalDescription(description).then(() => {
                                socketRef.current.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription }))
                            }).catch(e => console.log(e))
                        }).catch(e => console.log(e))
                    }
                }).catch(e => console.log(e))
            }

            if (signal.ice) {
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e))
            }
        }
    }

    // 3. Modernized socket connection with 'ontrack' and 'addTrack'
    let connectToSocketServer = () => {
        socketRef.current = io.connect(server_url, { secure: false })
        socketRef.current.on('signal', gotMessageFromServer)

        socketRef.current.on('connect', () => {
            socketRef.current.emit('join-call', window.location.href)
            socketIdRef.current = socketRef.current.id

            socketRef.current.on('chat-message', addMessage)

            socketRef.current.on('user-left', (id) => {
                setVideos((videos) => videos.filter((video) => video.socketId !== id))
                if (connections[id]) {
                    connections[id].close();
                    delete connections[id];
                }
            })

            socketRef.current.on('user-joined', (id, clients) => {
                clients.forEach((socketListId) => {
                    if(connections[socketListId]) return; // Prevent overwriting

                    connections[socketListId] = new RTCPeerConnection(peerConfigConnections)
                    
                    connections[socketListId].onicecandidate = function (event) {
                        if (event.candidate != null) {
                            socketRef.current.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }))
                        }
                    }

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
                            let newVideo = { socketId: socketListId, stream: event.streams[0], autoplay: true, playsinline: true };
                            setVideos(videos => {
                                const updatedVideos = [...videos, newVideo];
                                videoRef.current = updatedVideos;
                                return updatedVideos;
                            });
                        }
                    };

                    if (window.localStream !== undefined && window.localStream !== null) {
                        window.localStream.getTracks().forEach(track => {
                            connections[socketListId].addTrack(track, window.localStream);
                        });
                    } else {
                        let blackSilence = (...args) => new MediaStream([black(...args), silence()])
                        window.localStream = blackSilence()
                        window.localStream.getTracks().forEach(track => {
                            connections[socketListId].addTrack(track, window.localStream);
                        });
                    }
                })

                if (id === socketIdRef.current) {
                    for (let id2 in connections) {
                        if (id2 === socketIdRef.current) continue

                        connections[id2].createOffer().then((description) => {
                            connections[id2].setLocalDescription(description)
                                .then(() => {
                                    socketRef.current.emit('signal', id2, JSON.stringify({ 'sdp': connections[id2].localDescription }))
                                })
                                .catch(e => console.log(e))
                        })
                    }
                }
            })
        })
    }

    let getDislayMediaSuccess = (stream) => {
        try {
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        window.localStream = stream
        localVideoref.current.srcObject = stream

        for (let id in connections) {
            if (id === socketIdRef.current) continue

            const senders = connections[id].getSenders();
            senders.forEach(sender => connections[id].removeTrack(sender));
            
            window.localStream.getTracks().forEach(track => {
                connections[id].addTrack(track, window.localStream);
            });

            connections[id].createOffer().then((description) => {
                connections[id].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                    })
                    .catch(e => console.log(e))
            })
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setScreen(false)
            // Re-fetch regular camera when screen share ends
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
                            connections[id].setLocalDescription(description)
                                .then(() => socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription })))
                        });
                    }
                });
        })
    }

    let silence = () => {
        let ctx = new AudioContext()
        let oscillator = ctx.createOscillator()
        let dst = oscillator.connect(ctx.createMediaStreamDestination())
        oscillator.start()
        ctx.resume()
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false })
    }

    let black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height })
        canvas.getContext('2d').fillRect(0, 0, width, height)
        let stream = canvas.captureStream()
        return Object.assign(stream.getVideoTracks()[0], { enabled: false })
    }

    // 4. Clean Toggle Functions (No more black screens/re-renders)
    let handleVideo = () => {
        const newVideoState = !video;
        setVideo(newVideoState);
        if (window.localStream) {
            window.localStream.getVideoTracks().forEach(track => {
                track.enabled = newVideoState;
            });
        }
    }
    
    let handleAudio = () => {
        const newAudioState = !audio;
        setAudio(newAudioState);
        if (window.localStream) {
            window.localStream.getAudioTracks().forEach(track => {
                track.enabled = newAudioState;
            });
        }
    }

    useEffect(() => {
        if (screen !== undefined) {
            getDislayMedia();
        }
    }, [screen])
    
    let handleScreen = () => {
        setScreen(!screen);
    }

    let handleEndCall = () => {
        try {
            let tracks = localVideoref.current.srcObject.getTracks()
            tracks.forEach(track => track.stop())
        } catch (e) { }
        window.location.href = "/"
    }

    let openChat = () => {
        setModal(true);
        setNewMessages(0);
    }
    
    let closeChat = () => {
        setModal(false);
    }
    
    let handleMessage = (e) => {
        setMessage(e.target.value);
    }

    const addMessage = (data, sender, socketIdSender) => {
        setMessages((prevMessages) => [
            ...prevMessages,
            { sender: sender, data: data }
        ]);
        if (socketIdSender !== socketIdRef.current) {
            setNewMessages((prevNewMessages) => prevNewMessages + 1);
        }
    };

    let sendMessage = () => {
        socketRef.current.emit('chat-message', message, username)
        setMessage("");
    }
    
    let connect = () => {
        setAskForUsername(false);
        getMedia();
    }
return (
    <div>
        {askForUsername === true ?
  <Container maxWidth="sm"> {/* <--- xs se sm (small) kar diya, yeh card ko bada kar dega */}
    <Paper elevation={8} sx={{ 
        p: 6,           // Padding badha di (5 se 6)
        borderRadius: '24px', 
        bgcolor: '#1e293b', 
        width: '100%', 
        textAlign: 'center',
        border: '1px solid #334155'
    }}>
        <Typography variant="h4" sx={{ mb: 4, fontWeight: 700, color: '#fff' }}>
            Join Meeting
        </Typography>
        
        <TextField 
            fullWidth 
            label="Username" 
            variant="outlined" 
            value={username} 
            onChange={e => setUsername(e.target.value)}
            sx={{ 
                mb: 4, 
                bgcolor: '#ffffff', 
                borderRadius: '10px',
                '& .MuiInputBase-input': { color: '#000', fontSize: '1.1rem' } // Font size bhi badha diya
            }}
        />
        
        <Button 
            fullWidth 
            variant="contained" 
            size="large" 
            onClick={connect}
            sx={{ borderRadius: '12px', textTransform: 'none', mb: 4, py: 2, fontSize: '1.1rem' }}
        >
            Connect Now
        </Button>

        {/* Video Preview Box ko thoda bada kiya */}
        <Box sx={{ 
            mt: 2, 
            borderRadius: '20px', 
            overflow: 'hidden', 
            bgcolor: '#000', 
            aspectRatio: '16/9',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}>
            <video 
                ref={ref => {
                    if (ref && window.localStream && ref.srcObject !== window.localStream) {
                        ref.srcObject = window.localStream;
                    }
                }} 
                autoPlay 
                muted 
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            ></video>
        </Box>
    </Paper>
</Container>:

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
                                <TextField value={message} onChange={(e) => setMessage(e.target.value)} id="outlined-basic" label="Enter Your chat" variant="outlined" />
                                <Button variant='contained' onClick={sendMessage}>Send</Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Unified Video Grid Container */}
                <div className={styles.videoGrid}>
                    {/* Local Video */}
                    <div className={styles.videoWrapper}>
                        <video 
                            ref={ref => {
                                if (ref && window.localStream && ref.srcObject !== window.localStream) {
                                    ref.srcObject = window.localStream;
                                }
                            }} 
                            autoPlay 
                            muted 
                            playsInline
                        />
                    </div>

                    {/* Remote Videos */}
                    {videos.map((video) => (
                        <div key={video.socketId} className={styles.videoWrapper}>
                            <video
                                data-socket={video.socketId}
                                ref={ref => {
                                    if (ref && video.stream && ref.srcObject !== video.stream) {
                                        ref.srcObject = video.stream;
                                    }
                                }}
                                autoPlay
                                playsInline
                            />
                        </div>
                    ))}
                </div>

                {/* Controls */}
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
)
}