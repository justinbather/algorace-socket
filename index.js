const socketIo = require("socket.io");
const http = require('http');
const Lobby = require("./schema/LobbySchema");
const Problem = require("./schema/ProblemSchema")
const User = require("./schema/UserSchema")
const express = require('express')
const app = express();
const ProblemCode = require('./schema/ProblemCodeSchema')
const connectDB = require('./config/db')

connectDB()
const socketServer = http.createServer(app);

const PORT = process.env.PORT || 8000
const SOCKET_ORIGIN = process.env.SOCKET_ORIGIN || `http://localhost:3000`

const io = socketIo(socketServer, {
  cors: {
    origin: SOCKET_ORIGIN,
  },
});

io.on("connection", (socket) => {

  socket.on("join_lobby", async (data) => {
    const { username, lobby } = data;

    try {
      //Only update lobby with the user if user doesn't exist in lobby already
      const result = await Lobby.findOneAndUpdate(
        { name: lobby, 'users.username': { $ne: username } },
        { $addToSet: { users: { username, isReady: false } } },
        { new: true }
      ).populate('problems').populate('host').exec();

      console.log(result.host)
      if (result) {
        //add socket to lobby with lobby name
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
      //Update given users isReady to true returning newly saved lobby object
      const savedLobby = await Lobby.findOneAndUpdate(
        { name: lobby, 'users.username': username },
        { $set: { 'users.$.isReady': true } },
        { new: true }
      ).populate('problems').exec();

      // For use between rounds
      // Sets user status to ready
      // if all users are ready we increase current round number and return new problem
      //      if (savedLobby.users.every((user) => user.isReady === true) && savedLobby.started) {
      //        savedLobby.roundNumber = savedLobby.roundNumber + 1
      //        const updatedLobbyRound = await savedLobby.save()
      //        const currentProblem = await ProblemCode.findOne({ title: savedLobby.problems[updatedLobbyRound.roundNumber].title, language: 'javascript' })
      //        io.to(lobby).emit('new_round', { lobbyObj: updatedLobbyRound, roundNumber: savedLobby.roundNumber, currentProblem })
      //      }
      socket.emit('successful_ready', { isReady: true });
      io.to(lobby).emit('user_ready', savedLobby);

    } catch (error) {
      console.error('Error handling user_ready event:', error);
    }
  });

  socket.on('user_unready', async (data) => {
    const { username, lobby } = data;

    // Find user and set isReady to false
    try {
      const savedLobby = await Lobby.findOneAndUpdate(
        { name: lobby, 'users.username': username },
        { $set: { 'users.$.isReady': false } },
        { new: true }
      ).populate('problems');

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
      // Increase round number and check if anymore rounds left
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
