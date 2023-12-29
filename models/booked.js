import mongoose from "mongoose";

export default mongoose.model("Booked", mongoose.Schema({
    course: mongoose.Types.ObjectId,
    student: String,
    startTime: Date,
    endTime: Date,
    status: {
        type: String,
        enum: ["Booked", "Ongoing", "Completed"],
        default: "Booked"
    },
    bookedContent: [mongoose.Types.ObjectId]
}))