const mongoose = require("mongoose");

const ProblemCodeSchema = new mongoose.Schema({
  title: {
    type: String,
  },
  language: {
    type: String,
  },
  userStarterCode: {
    type: String,
  },
  filePrefix: {
    type: String,
  },
  fileExt: {
    type: String,
  },
  inputCode: {
    type: String,
  },
  callerCode: {
    type: String,
  },
  output: {
    type: String,
  },
  description: String,
});

const ProblemCode = mongoose.model("Problem Code", ProblemCodeSchema);

module.exports = ProblemCode;
