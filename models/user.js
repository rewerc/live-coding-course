import mongoose from "mongoose";

export default mongoose.model("User", mongoose.Schema({
    email: String,
    username: String,
    password: String
}))