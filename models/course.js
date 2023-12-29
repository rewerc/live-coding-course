import mongoose from "mongoose";

export default mongoose.model("Course", mongoose.Schema({
    title: String,
    description: String,
    instructor: String,
    instructorName: String,
    courseContent: [mongoose.Schema({
        contentTitle: String,
        contentDescription: String,
        contentDuration: Number
    })]
}))