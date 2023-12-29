import mongoose from "mongoose";
import fs from "fs";
import child_process from "child_process";
import { v4 as uuid } from "uuid";
import Booked from "./models/booked.js";
import Course from "./models/course.js";

async function getBookedDetails(bookedId) {
    const courseDetails = await Booked.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(bookedId)
            }
        },
        {
            $lookup: {
                from: "courses",
                localField: "course",
                foreignField: "_id",
                as: "courseDetails"
            }
        },
        {
            $unwind: "$courseDetails"
        }
    ]);
    return courseDetails[0] || null;
}

async function getBookedDetailsByStudentEmail(email) {
    const bookedCourses = await Booked.aggregate([
        {
            $match: {
                student: email
            }
        },
        {
            $lookup: {
                from: "courses",
                localField: "course",
                foreignField: "_id",
                as: "courseDetails"
            }
        },
        {
            $unwind: "$courseDetails"
        }
    ])
    return bookedCourses;
}

async function getBookedDetailsByInstructor(email) {
    const bookedCourses = await Course.aggregate([
        {
            $match: {
                instructor: email
            }
        },
        {
            $lookup: {
                from: "bookeds",
                localField: "_id",
                foreignField: "course",
                as: "bookedDetails"
            }
        },
        {
            $unwind: "$bookedDetails"
        }
    ]);

    return bookedCourses.map(course => {
        const bookedDetails = course.bookedDetails;
        delete course.bookedDetails;
        bookedDetails.courseDetails = course;
        return bookedDetails;
    })
}

async function getInstructorsMap(courseIds) {
    const formattedCourseIds = courseIds.map(courseId => 
        (typeof courseId === "string") ?
        new mongoose.Types.ObjectId(courseId) : courseId
    );

    const courseDocs = await Course.aggregate([
        {
            $match: {
                _id: {
                    $in: formattedCourseIds
                }
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "instructor",
                foreignField: "email",
                as: "instructorDetails"
            }
        },
        {
            $unwind: "$instructorDetails"
        }
    ]);

    const mappedUsers = {};
    for (const doc of courseDocs) {
        if (!mappedUsers[doc.instructor]) {
            mappedUsers[doc.instructor] = doc.instructorDetails;
        }
    }

    return mappedUsers;
}

function runPythonCode(code) {
    const tempId = uuid();
    const path = `./python-scripts/${tempId}.py`;
    fs.writeFileSync(path, code);

    const process = child_process.spawn("python3", [path]);
    process.stdout.setEncoding('utf8');
    process.stderr.setEncoding('utf8');

    // fs.unlinkSync(path);
    return [
        tempId,
        path,
        process
    ]
}

export default {
    getBookedDetails,
    getBookedDetailsByStudentEmail,
    getBookedDetailsByInstructor,
    getInstructorsMap,
    runPythonCode
}