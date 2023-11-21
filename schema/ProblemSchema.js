const mongoose = require("mongoose");

const ProblemSchema = new mongoose.Schema({
  title: {
    type: String,
  },
  category: {
    type: String,
  },
  difficulty: {
    type: String,
  },
  starterCode: {
    type: String,
  },
});

const Problem = mongoose.model("Problem", ProblemSchema);
module.exports = Problem;
