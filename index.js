const socketIo = require("socket.io");
const http = require('http');
const Lobby = require("./schema/LobbySchema");
const Problem = require("./schema/ProblemSchema")
const User = require('./schema/UserSchema')
const express = require('express')
const app = express();
const PORT = process.env.PORT || 8000
const ProblemCode = require('./schema/ProblemCodeSchema')
const connectDB = require('./config/db')

connectDB()
const socketServer = http.createServer(app);

const SOCKET_ORIGIN = process.env.SOCKET_ORIGIN || `http://localhost:3000`

const io = socketIo(socketServer, {
  cors: {
    origin: SOCKET_ORIGIN,
  },
});


const checkAllReady = (lobbyObj) => {
  let output = true
  lobbyObj.users.forEach(user => {
    if (!user.isReady) {
      output = false
    }

  });
  return output
}


io.on("connection", (socket) => {

  socket.on("join_lobby", async (data) => {
    const { username, lobby } = data;

    try {
      const result = await Lobby.findOneAndUpdate(
        { name: lobby, 'users.username': { $ne: username } }, // Ensure username is not in the array
        { $addToSet: { users: { username, isReady: false } } },
        { new: true }
      ).populate('problems').exec();

      if (result) {
        socket.join(result.name);
        socket.emit('successful_enter', result);
        io.emit('user_joined', result);
      }
    } catch (error) {
      socket.emit('error_joining', 'Internal server error');
    }
  });

  socket.on("user_ready", async (data) => {
    const { username, lobby } = data;

    try {
      const savedLobby = await Lobby.findOneAndUpdate(
        { name: lobby, 'users.username': username },
        { $set: { 'users.$.isReady': true } },
        { new: true }
      ).populate('problems').exec();

      if (savedLobby.users.every((user) => user.isReady === true) && savedLobby.started) {
        savedLobby.roundNumber = savedLobby.roundNumber + 1
        const updatedLobbyRound = await savedLobby.save()
        const currentProblem = await ProblemCode.findOne({ title: savedLobby.problems[updatedLobbyRound.roundNumber].title, language: 'javascript' })
        io.to(lobby).emit('new_round', { lobbyObj: updatedLobbyRound, roundNumber: savedLobby.roundNumber, currentProblem })
      }
      socket.emit('successful_ready', { isReady: true });
      io.to(lobby).emit('user_ready', savedLobby);

    } catch (error) {
      console.error('Error handling user_ready event:', error);
    }
  });

  socket.on('user_unready', async (data) => {
    const { username, lobby } = data;

    try {
      const savedLobby = await Lobby.findOneAndUpdate(
        { name: lobby, 'users.username': username },
        { $set: { 'users.$.isReady': false } },
        { new: true }
      );

      socket.emit('successful_ready', { isReady: false });
      io.to(lobby).emit('user_ready', savedLobby);
    } catch (err) {
      console.log(err);
    }
  });

  socket.on('start_match', async (data) => {
    const { username, lobby } = data

    try {

      const lobbyObj = await Lobby.findOne({ name: lobby }).populate('problems').populate('host').exec()
      if (lobbyObj && lobbyObj.host.username === username) {
        lobbyObj.started = true
        lobbyObj.users = lobbyObj.users.map(user => ({ ...user, isReady: false }));
        const savedLobby = await lobbyObj.save()
        const currentProblem = await ProblemCode.findOne({ title: lobbyObj.problems[0].title, language: 'javascript' })
        io.to(lobby).emit('begin_match', { lobbyObj, roundNumber: 1, currentProblem })
      }
    } catch (err) {
      // Emit error here
      console.log('error starting match', err)
    }
  })

  socket.on('user_completed', async (data) => {
    const { username, lobby } = data;

    try {
      const lobbyObj = await Lobby.findOne({ name: lobby }).populate('problems').exec()
      if (lobbyObj) {
        lobbyObj.currentRound = lobbyObj.currentRound + 1
        const savedLobby = await lobbyObj.save()
        if (savedLobby.numRounds < (savedLobby.currentRound + 1)) {
          io.to(lobby).emit('game_completed')
        } else {
          io.to(lobby).emit('round_completed', ({ savedLobby, winner: username }))
        }
      }
    } catch (err) {
      console.log(err)
    }
  })

  socket.on('user_ready_next_match', async (data) => {
    const { username, lobby } = data

    try {
      const lobbyObj = await Lobby.findOneAndUpdate(
        { name: lobby, 'users.username': username }, // Find the lobby with the specified username
        { $set: { 'users.$.isReady': true } }, // Update the 'isReady' field of the matched user
        { new: true }
      ).populate('problems').exec()
      if (lobbyObj) {

        const savedLobby = await lobbyObj.save()
        const currentProblem = await ProblemCode.findOne({ title: savedLobby.problems[savedLobby.currentRound].title, language: 'javascript' })
        if (savedLobby.users.every((user) => (user.isReady === true))) {
          io.to(lobby).emit('next_round', { lobbyObj: savedLobby, roundNumber: savedLobby.roundNumber, currentProblem })
        }
      }
    } catch (err) {
      console.log(err)
    }
  })

  socket.on("disconnect", async (lobby) => {
    const count = io.engine.clientsCount;
    console.log("num clients: ", count);
  })
});

socketServer.listen(PORT, () => console.log(`Socket server listening on ${PORT}`))
