import { Server } from "socket.io";

let connections = {};
let messages = {};
let timeOnline = {};

export const connectToSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["*"],
            credentials: true
        }
    });

    io.on("connection", (socket) => {
        console.log("User connected:", socket.id);

        socket.on("join-call", (path) => {
            if (!connections[path]) {
                connections[path] = [];
            }

            // DUPLICATE FIX: Sirf tabhi push karo agar ID pehle se nahi hai
            if (!connections[path].includes(socket.id)) {
                connections[path].push(socket.id);
            }

            timeOnline[socket.id] = new Date();

            // Emit 'user-joined' to everyone in the room
            connections[path].forEach((id) => {
                io.to(id).emit("user-joined", socket.id, connections[path]);
            });

            // Send past messages
            if (messages[path]) {
                messages[path].forEach((msg) => {
                    io.to(socket.id).emit("chat-message", msg.data, msg.sender, msg['socket-id-sender']);
                });
            }
        });
        socket.on("signal", (toId, message) => {
            io.to(toId).emit("signal", socket.id, message);
        });

        socket.on("chat-message", (data, sender) => {
            // Find room for the current user
            const matchingRoom = Object.keys(connections).find(room => connections[room].includes(socket.id));

            if (matchingRoom) {
                if (!messages[matchingRoom]) messages[matchingRoom] = [];
                
                const messageData = { 'sender': sender, "data": data, "socket-id-sender": socket.id };
                messages[matchingRoom].push(messageData);

                // Broadcast message
                connections[matchingRoom].forEach((id) => {
                    io.to(id).emit("chat-message", data, sender, socket.id);
                });
            }
        });

        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.id);
            
            // Clean up connections
            for (const path in connections) {
                if (connections[path].includes(socket.id)) {
                    connections[path] = connections[path].filter(id => id !== socket.id);
                    
                    // Notify others that user left
                    connections[path].forEach(id => io.to(id).emit('user-left', socket.id));

                    if (connections[path].length === 0) delete connections[path];
                }
            }
            delete timeOnline[socket.id];
        });
    });

    return io;
};