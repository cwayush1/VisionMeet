import * as React from 'react';
import { Avatar, Button, CssBaseline, TextField, Paper, Box, Typography, Snackbar, Container, ThemeProvider, createTheme } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { AuthContext } from '../contexts/AuthContext';

const theme = createTheme({
  palette: {
    mode: 'light', // Paper white rahega
    primary: { main: '#1e3a8a' }, // Deep Dark Blue
  },
});

export default function Authentication() {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [formState, setFormState] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const { handleRegister, handleLogin } = React.useContext(AuthContext);

  const handleAuth = async () => {
    try {
      if (formState === 0) await handleLogin(username, password);
      else {
        const res = await handleRegister(name, username, password);
        setOpen(true); setFormState(0);
      }
    } catch (err) { /* error handling */ }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* BACKGROUND DARK RAKHA HAI */}
      <Box sx={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        bgcolor: '#0f172a' // Dark Navy background
      }}>
        <Container maxWidth="xs">
          {/* WHITE FORM CARD */}
          <Paper elevation={6} sx={{ 
            p: 4, 
            borderRadius: '20px', 
            bgcolor: '#ffffff',
            border: '1px solid #e2e8f0'
          }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Avatar sx={{ m: 1, bgcolor: '#1e3a8a' }}><LockOutlinedIcon /></Avatar>
              <Typography variant="h5" sx={{ mt: 1, mb: 3, fontWeight: 700, color: '#1e3a8a' }}>
                {formState === 0 ? "Login" : "Sign Up"}
              </Typography>

              {/* Toggle */}
              <Box sx={{ display: 'flex', width: '100%', mb: 3, bgcolor: '#f1f5f9', p: 0.5, borderRadius: '10px' }}>
                <Button fullWidth onClick={() => setFormState(0)} sx={{ borderRadius: '8px', color: formState === 0 ? '#fff' : '#64748b', bgcolor: formState === 0 ? '#1e3a8a' : 'transparent' }}>Login</Button>
                <Button fullWidth onClick={() => setFormState(1)} sx={{ borderRadius: '8px', color: formState === 1 ? '#fff' : '#64748b', bgcolor: formState === 1 ? '#1e3a8a' : 'transparent' }}>Register</Button>
              </Box>

              <TextField fullWidth label="Username" margin="normal" value={username} onChange={(e) => setUsername(e.target.value)} />
              {formState === 1 && <TextField fullWidth label="Full Name" margin="normal" value={name} onChange={(e) => setName(e.target.value)} />}
              <TextField fullWidth label="Password" type="password" margin="normal" value={password} onChange={(e) => setPassword(e.target.value)} />

              <Button fullWidth variant="contained" size="large" sx={{ mt: 3, borderRadius: '10px', textTransform: 'none', bgcolor: '#1e3a8a' }} onClick={handleAuth}>
                {formState === 0 ? "Sign In" : "Create Account"}
              </Button>
            </Box>
          </Paper>
        </Container>
      </Box>
    </ThemeProvider>
  );
}