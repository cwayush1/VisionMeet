import React, { useContext, useState } from 'react';
import withAuth from '../utils/withAuth';
import { useNavigate } from 'react-router-dom';
import { Button, IconButton, TextField, Box, Typography, Container, Paper } from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import LogoutIcon from '@mui/icons-material/Logout';
import { AuthContext } from '../contexts/AuthContext';
import "../App.css";

function HomeComponent() {
    let navigate = useNavigate();
    const [meetingCode, setMeetingCode] = useState("");
    const { addToUserHistory } = useContext(AuthContext);

    let handleJoinVideoCall = async () => {
        await addToUserHistory(meetingCode);
        navigate(`/${meetingCode}`);
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#0f172a', color: '#fff' }}>
            {/* Navbar */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3, borderBottom: '1px solid #1e293b' }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#3b82f6' }}>Apna Video Call</Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Button startIcon={<RestoreIcon />} onClick={() => navigate("/history")} sx={{ color: '#94a3b8' }}>History</Button>
                    <Button startIcon={<LogoutIcon />} onClick={() => { localStorage.removeItem("token"); navigate("/auth"); }} sx={{ color: '#ef4444' }}>Logout</Button>
                </Box>
            </Box>

            {/* Main Content */}
            <Container maxWidth="lg" sx={{ mt: 8 }}>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', gap: 8 }}>
                    {/* Left Panel */}
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h2" sx={{ fontWeight: 800, mb: 3, fontSize: { xs: '2.5rem', md: '3.5rem' } }}>
                            Quality Video Calls for <span style={{ color: '#3b82f6' }}>Everyone</span>
                        </Typography>
                        <Typography variant="h6" sx={{ color: '#94a3b8', mb: 4 }}>
                            Connect seamlessly with high-quality audio and video. Simply enter your code to start.
                        </Typography>
                        
                        <Paper sx={{ p: 3, display: 'flex', gap: 2, bgcolor: '#1e293b', borderRadius: '16px', border: '1px solid #334155' }}>
                            <TextField 
                                fullWidth 
                                label="Enter Meeting Code" 
                                variant="outlined" 
                                onChange={e => setMeetingCode(e.target.value)}
                                sx={{ 
                                    bgcolor: '#ffffff', // White background for input
                                    borderRadius: '8px',
                                    '& .MuiInputBase-input': { color: '#000' }, // Black text
                                    '& .MuiInputLabel-root': { color: '#64748b' } // Grey label
                                }}
                            />
                            <Button onClick={handleJoinVideoCall} variant='contained' size="large" sx={{ px: 5, borderRadius: '8px' }}>
                                Join
                            </Button>
                        </Paper>
                    </Box>

                    {/* Right Panel */}
                    <Box sx={{ flex: 1, display: { xs: 'none', md: 'block' } }}>
                        <img src='/logo3.png' alt="Video Call" style={{ width: '100%', borderRadius: '24px' }} />
                    </Box>
                </Box>
            </Container>
        </Box>
    );
}

export default withAuth(HomeComponent);