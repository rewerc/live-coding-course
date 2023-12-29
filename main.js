import express from "express";
import mongoose from "mongoose";
import http from "http";
import session from "express-session";
import fs from "fs";

import { mongoURI } from "./const.js";
import User from "./models/user.js";
import Course from "./models/course.js";
import Booked from "./models/booked.js";
import utils from "./utils.js";
import WSS from "./wss.js";


const app = express();
const server = http.createServer(app);
const wss = WSS(server);

app.set("view engine", "ejs");
app.set('port', process.env.PORT || 3000);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/files", express.static("public"));
app.use(session({
    secret: "finpro",
    resave: false,
    saveUninitialized: true,
}));

app.get("/", (req, res) => {
    if (!req.session.user) {
        res.redirect("/login")
    } else {
        res.redirect("/home")
    }
});

app.get("/login", (req, res) => {
    if (req.session.user) {
        res.redirect("/home");
        return;
    }
    res.render("login", {
        error: 0
    });
});

app.post("/login", async (req, res) => {
    if (req.session.user) {
        res.redirect("/home");
        return;
    }

    const email = req.body.email;
    const password = req.body.password;

    const user = await User.findOne({
        email: email,
        password: password
    });

    if (!user) {
        res.render("login", {
            error: 1
        });
        return;
    }

    req.session.user = user.username;
    req.session.email = user.email;
    res.redirect("/home");
});

app.get("/signup", (req, res) => {
    res.render("signup");
});

app.post("/signup", async (req, res) => {
    const email = req.body.email;
    const username = req.body.username;
    const password = req.body.password;

    if (!email || !username || !password) {
        res.redirect("/signup");
        return;
    }

    const user = await User.findOne({
        email: email
    });

    if (user) {
        res.redirect("/signup");
        return;
    }

    const newUser = new User({
        username: username,
        email: email,
        password: password
    });
    
    await newUser.save();

    res.redirect("/login");
});

app.get("/home", (req, res) => {
    if (!req.session.user) {
        res.redirect("/login");
        return;
    }
    res.render("home", {
        user: req.session.user,
        email: req.session.email
    });
});

app.get("/meeting", (req, res) => {
    res.render("meeting");
});

app.post("/create-course", async (req, res) => {
    const instructor = req.session.email;
    const instructorName = req.session.user;
    const title = req.body.title;
    const description = req.body.description;
    const courseContent = req.body.content;
    
    if (!title || !description) {
        res.send({
            status: "error"
        })
        return;
    }

    const newCourse = new Course({
        title: title,
        description: description,
        instructor: instructor,
        instructorName: instructorName,
        courseContent: courseContent
    })

    await newCourse.save()

    res.send({
        status: "success",
        content: {
            title: title,
            description: description,
            instructor: instructor,
            content: courseContent
        }
    })
});

app.get("/retrieve-courses", async (req, res) => {
    if (!req.session.email) {
        res.send({ status: "error" })
        return
    }
    res.send(await Course.find());
});

app.get("/get-course-details/:_id", async (req, res) => {
    const courseId = req.params._id;
    const courseDetails = await Course.findById(courseId);
    res.send(courseDetails);
});

app.post("/book", async (req, res) => {
    const startTime = new Date(req.body.startTime);
    const endTime = new Date(req.body.endTime);
    const bookedContent = req.body.courseContent;

    const newBooked = new Booked({
        course: req.body.courseId,
        student: req.session.email,
        startTime: startTime,
        endTime: endTime,
        bookedContent: bookedContent
    })

    await newBooked.save();
    
    const courseDetails = await utils.getBookedDetails(newBooked._id);
    const instructor = courseDetails.courseDetails.instructor;

    wss.sendByEmail(instructor, {
        message: "booked",
        content: [courseDetails]
    })

    res.send({
        status: "success",
        content: newBooked
    })
});

app.get("/get-booked-courses", async (req, res) => {
    const bookedCourses = await utils.getBookedDetailsByStudentEmail(req.session.email);

    res.send(bookedCourses);
});

app.get("/get-user", async (req, res) => {
    res.send(await User.findOne({
        email: req.session.email
    }, {
        password: 0
    }))
})

app.post("/cancel-booked", async (req, res) => {
    const bookedId = req.body.bookedId;
    console.log(bookedId)
    const bookedDetails = await utils.getBookedDetails(bookedId);
    const instructor = bookedDetails.courseDetails.instructor;
    const student = bookedDetails.student;
    
    if (![instructor, student].includes(req.session.email)) {
        res.send({ message: "Cancelling party is not involved." });
        return;
    }

    await Booked.deleteOne({ _id: bookedId });

    wss.sendByEmail(instructor, {
        message: "reset-notification",
        content: await utils.getBookedDetailsByInstructor(instructor)
    });

    wss.sendByEmail(student, {
        message: "reset-booked-courses"
    });

    res.send({ message: "Successfully cancelled booked course." })
})

app.get("/get-booked-details/:_id", async (req, res) => {
    const bookedId = req.params._id;
    const bookedDetails = await utils.getBookedDetails(bookedId);
    res.send(bookedDetails);
})

app.post("/run-python-code", async (req, res) => {
    const code = req.body.code;
    const [sessionId, filepath, process] = utils.runPythonCode(code);

    const addOutput = data => {
        wss.sendByEmail(req.session.email, {
            context: "ide",
            message: "output",
            content: data
        })
    };

    process.stdout.on("data", addOutput);
    process.stderr.on("data", addOutput);
    process.on("close", () => {
        fs.unlinkSync(filepath);
        wss.removeRuntime(sessionId);
        wss.sendByEmail([req.session.email], {
            context: "ide",
            message: "done"
        })
    })

    wss.addRuntimeSession(sessionId, filepath, process, req.session.email);
    
    res.send({
        sessionId: sessionId
    });
});

app.post("/logout", (req, res) => {
    req.session.user = null;
    req.session.email = null;
    res.redirect("/login");
})

mongoose.connect(mongoURI).then(() => {
    console.log("[CONNECTED TO DB]");
    server.listen(app.get("port"), () => {
        console.log("[SERVER RUNNING]");
    });
});

