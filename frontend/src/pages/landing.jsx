import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Box, Typography, Container, Stack } from '@mui/material';

export default function LandingPage() {
    const router = useNavigate();

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#0f172a', color: '#fff', display: 'flex', flexDirection: 'column' }}>
            {/* Navbar */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 4, px: 8 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#3b82f6' }}>Apna Video Call</Typography>
                <Stack direction="row" spacing={3} alignItems="center">
                    <Button sx={{ color: '#fff' }} onClick={() => router("/aljk23")}>Join as Guest</Button>
                    <Button sx={{ color: '#fff' }} onClick={() => router("/auth")}>Register</Button>
                    <Button variant="outlined" sx={{ borderRadius: '8px' }} onClick={() => router("/auth")}>Login</Button>
                </Stack>
            </Box>

            {/* Main Hero Section */}
            <Container maxWidth="lg" sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', mt: 4 }}>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', gap: 10 }}>
                    {/* Text Section */}
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h1" sx={{ fontWeight: 800, fontSize: { xs: '3rem', md: '4.5rem' }, lineHeight: 1.1, mb: 3 }}>
                            Connect with <span style={{ color: '#3b82f6' }}>loved ones</span> instantly.
                        </Typography>
                        <Typography variant="h5" sx={{ color: '#94a3b8', mb: 5 }}>
                            Experience high-quality, seamless video conferencing. Bridge the distance with Apna Video Call.
                        </Typography>
                        <Button 
                            variant="contained" 
                            size="large" 
                            onClick={() => router("/auth")}
                            sx={{ px: 6, py: 2, borderRadius: '12px', fontSize: '1.1rem', bgcolor: '#3b82f6' }}
                        >
                            Get Started
                        </Button>
                    </Box>

                    {/* Image Section */}
                    <Box sx={{ flex: 1, display: { xs: 'none', md: 'block' } }}>
                        <img 
                            src="/mobile.png" 
                            alt="Video Call App" 
                            style={{ width: '100%', maxWidth: '400px', filter: 'drop-shadow(0px 20px 30px rgba(0,0,0,0.5))' }} 
                        />
                    </Box>
                </Box>
            </Container>
        </Box>
    );
}