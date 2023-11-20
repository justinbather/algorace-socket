const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "Username is required"],
    unique: [true, "This username already exists"],
  },
  password: {
    type: String,
    required: [true, "Password is required"],
  },
});

//Prevents password from getting rehashed everytime a user is saved
UserSchema.pre("save", async function(next) {
  const user = this;
  if (!user.isModified("password")) {
    return next();
  } else {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  }
});

const User = mongoose.model("User", UserSchema);

module.exports = User;
