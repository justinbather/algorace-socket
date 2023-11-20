const mongoose = require("mongoose");

const LobbySchema = new mongoose.Schema({
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  name: String,
  settings: Object,
  problems: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem'
    }],

  users: [
    {
      type: Object
    }
  ],
  currentRound: {
    type: Number,
    default: 0
  },
  numRounds: {
    type: Number,
    required: true
  },
  started: {
    type: Boolean,
    default: false
  }

});

const Lobby = mongoose.model("Lobby", LobbySchema);

module.exports = Lobby;
