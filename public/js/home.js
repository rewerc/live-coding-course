const createCourseModal = new bootstrap.Modal(document.getElementById("createCourseModal"));
const courseDetailsModal = new bootstrap.Modal(document.getElementById("courseDetails"));
const bookDialogModal = new bootstrap.Modal(document.getElementById("bookDialog"));
const createCourseBtn = $("#createCourse");
const createCourseModalTrigger = $("#createCourseModalTrigger");
const notificationContainer = $("#notificationContainer");

function wsSend(data) {
    wsSendPrototype("home")(data);
}

function notificationBlock(data) {
    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    const datetimeString = `${start.toDateString()}, ${start.getTimeString()} - ${end.getTimeString()}`;
    const block = $(`
    <div class="row">
        <div class="col-12 bg-dark rounded mb-2 p-3" style="min-height: 80px">
            <div class="w-100 d-flex justify-content-between">
                <div class="d-flex flex-column w-75">
                    <div class="fw-bold mb-1">
                        ${data.courseDetails.title}
                    </div>
                    <div class="mb-1">
                        <span class="badge bg-light text-dark fw-bold">
                            ${datetimeString}
                        </span>
                    </div>
                    <div class="fs-6">
                        <small>${data.student}</small>
                    </div>
                </div>
                <div class="d-flex flex-column justify-content-around">
                    <button data-delete type="button" class="btn btn-sm btn-outline-danger rounded-circle"><i class="fa-solid fa-ban"></i></button>
                    <button data-more type="button" class="btn btn-sm btn-outline-light rounded-circle"><i class="fa-solid fa-ellipsis"></i></button>
                </div>
            </div>
        </div>
    </div>`);
    block.find("[data-delete]").on("click", () => cancelBookedCourse(data))
    block.find("[data-more]").on("click", async () => await renderBookedDetails(data._id))
    return block;
}

function getCourseContentMap(courseDetails) {
    const mapped = {};
    for (const content of courseDetails.courseContent) {
        mapped[content._id] = content;
    }
    return mapped;
}

async function renderBookedDetails(bookedId) {
    
    const bookedDetails = await getBookedDetails(bookedId);
    const user = await getUser();
    const contentMap = getCourseContentMap(bookedDetails.courseDetails);
    
    let rowIdx = 0;
    const contentRows = bookedDetails.bookedContent.map(contentId => {
        return `
        <tr>
            <td>${++rowIdx}</td>
            <td>${contentMap[contentId].contentTitle}</td>
            <td>${contentMap[contentId].contentDuration}</td>
        </tr>
        `
    }).join('\n');

    const start = new Date(bookedDetails.startTime);
    const end = new Date(bookedDetails.endTime);
    const datetimeString = `${start.toDateString()}, ${start.getTimeString()} - ${end.getTimeString()}`;
    
    detailsDialog({
        title: `Booked Session for <span class="fw-bolder text-primary">${bookedDetails.courseDetails.title}</span> Course`,
        size: "xl",
        content: `
        <div class="d-flex flex-column mb-4">
            <div class="mb-1">
                <h4>General Information</h4>
            </div>
            <div class="d-flex mb-1">
                <div class="fw-bold" style="width: 150px">Course Title</div>
                <div style="width: 30px">:</div>
                <div>${bookedDetails.courseDetails.title}</div>
            </div>
            <div class="d-flex mb-1">
                <div class="fw-bold" style="width: 150px">Participant</div>
                <div style="width: 30px">:</div>
                <div>${bookedDetails.student}</div>
            </div>
            <div class="d-flex mb-1">
                <div class="fw-bold" style="width: 150px">Instructor</div>
                <div style="width: 30px">:</div>
                <div>${bookedDetails.courseDetails.instructor}</div>
            </div>
            <div class="d-flex mb-1">
                <div class="fw-bold" style="width: 150px">Date/Time</div>
                <div style="width: 30px">:</div>
                <div>${datetimeString}</div>
            </div>
        </div>
        
        <div class="d-flex flex-column w-50">
            <div class="mb-1">
                <h4>Booked Content</h4>
            </div>
            <table class="table table-bordered table-sm table-hover">
                <thead>
                    <tr>
                        <th scope="col" style="width: 5%">#</th>
                        <th scope="col" style="width: 25%">Name</th>
                        <th scope="col" style="width: 10%">Duration (minutes)</th>
                    </tr>
                </thead>
                <tbody>
                    ${contentRows}
                </tbody>
            </table>
        </div>`,
        buttons: [
            {
                color: "danger",
                label: "Cancel",
                callback: dialog => {
                    dialog.hide();
                    cancelBookedCourse(bookedDetails);
                }
            },
            {
                color: "success",
                label: "Join Meeting Room",
                callback: dialog => {
                    dialog.hide();
                    renderCallDialog(bookedDetails);
                }
            }
        ]
    })
}

function cancelBookedCourse(detailedBookedCourse) {
    const start = new Date(detailedBookedCourse.startTime);
    const end = new Date(detailedBookedCourse.endTime);
    const datetimeString = `${start.toDateString()}, ${start.getTimeString()} - ${end.getTimeString()}`;

    confirmDialog( 
        `<div>
            <span class="d-ib fw-bold" style="width: 100px">Participant</span>
            <span class="d-ib" style="width: 20px">:</span> 
            ${detailedBookedCourse.student}
        </div>
        <div>
            <span class="d-ib fw-bold" style="width: 100px">Instructor</span>
            <span class="d-ib" style="width: 20px">:</span> 
            ${detailedBookedCourse.courseDetails.instructor}
        </div>
        <div>
            <span class="d-ib fw-bold" style="width: 100px">Course</span>
            <span class="d-ib" style="width: 20px">:</span> 
            ${detailedBookedCourse.courseDetails.title}
        </div>
        <div>
            <span class="d-ib fw-bold" style="width: 100px">Datetime</span>
            <span class="d-ib" style="width: 20px">:</span> 
            ${datetimeString}
        </div>
        <div class="mt-2 text-danger fw-bold">
            Cancel appointment?
        </div>`,
        async dialog => {
            await $.ajax({
                method: "POST",
                url: "/cancel-booked",
                data: {
                    bookedId: detailedBookedCourse._id
                }
            })
            dialog.hide();
        }
    )
}

function websocketSetup() {
    ws.addEventListener("open", async () => {
        wsSend({
            message: "initialize",
            content: (await getUser()).email
        })
    });

    ws.addEventListener("message", e => {
        const content = JSON.parse(e.data);

        if (content.message === "booked") {
            notified(true);
            for (const booked of content.content) {
                notificationContainer.append(notificationBlock(booked));
            }
        }

        if (content.message === "reset-booked-courses") {
            renderBookedCourses();
        }

        if (content.message === "reset-notification") {
            notified(true);
            notificationContainer.empty();
            for (const booked of content.content) {
                notificationContainer.append(notificationBlock(booked));
            }
        }
    });
}

function notified(hasUpdates) {
    if (hasUpdates) {
        $("#notificationButton").addClass("text-info");
    } else {
        $("#notificationButton").removeClass("text-info");
    }
}

async function getCourseDetails(courseId) {
    return await $.ajax({
        type: "GET",
        url: "/get-course-details/" + courseId.toString()
    })
}

function setupRecommendedCourses(courseList) {

    const applyTemplate = course => $(`
    <div class="col-lg-2 col-sm-4 mb-3 d-ib d-flex justify-content-center align-items-center">
        <div class="card hover-card d-ib" style="width: 100%; height: 200px">
            <div class="card-body">
                <h5 class="card-title">${course.title}</h5>
                <h6 class="card-subtitle mb-2 text-muted">${ (course.instructorName ? (course.instructorName + " - ") : "") + course.instructor}</h6>
                <p class="card-text">${course.description}</p>
            </div>
        </div>
    </div>`).on("click", async () => {
        const courseDetails = await getCourseDetails(course._id);

        let courseContent = "";
        for (const [idx, content] of courseDetails.courseContent.entries()) {
            courseContent += `
            <tr>
                <td scope="row">${idx + 1}</td>
                <td>${content.contentTitle}</td>
                <td>${content.contentDescription}</td>
                <td>${content.contentDuration}</td>
            </tr>`
        }

        $("#courseDetailsLabel").html(courseDetails.title);
        $("#courseDetailsContent").html(`
            <div class="container-fluid">
                <div class="row">
                    <div class="col-12">
                        <h4>Course Information</h4>
                    </div>
                </div>
                <div class="row mb-5">
                    <div class="col-12 mb-2">
                        instructed by <b>${courseDetails.instructorName}</b> <a href="/user">${courseDetails.instructor}</a>
                    </div>
                    <div class="col-12">
                        ${courseDetails.description}
                    </div>
                </div>
                <div class="row">
                    <div class="col-12">
                        <h4>Content</h4>
                    </div>
                </div>
                <div class="row mb-5">
                    <div class="col-9">
                        <table class="table table-bordered table-sm table-hover">
                            <thead>
                                <tr>
                                    <th scope="col" style="width: 5%">#</th>
                                    <th scope="col" style="width: 25%">Name</th>
                                    <th scope="col" style="width: 50%">Description</th>
                                    <th scope="col" style="width: 20%">Duration (minutes)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${courseContent}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="row mb-5">
                    <div class="col-12">
                        <button type="button" class="btn btn-success" data-book="${courseDetails._id}"><i class="fa fa-plus"></i> Book</button>
                    </div>
                </div>
            </div>
        `)

        $(`[data-book="${course._id}"]`).on("click", async () => {
            const courseDetails = await getCourseDetails(course._id);
            const getToBeBooked = () => {
                const $bookedContent = $("[data-booked-content]:checked");
                let objectIds = [];
                for (const content of $bookedContent) {
                    objectIds.push(content.getAttribute("data-booked-content"));
                }
                return objectIds;
            };
            const setEndTime = () => {
                const $startTime = $("[data-booked-start-time]").val();
                if (!$startTime) return;
                const $bookedContent = $("[data-booked-content]:checked");
                const $endTime = $("[data-booked-end-time]");
                const startTime = new Time($("[data-booked-start-time]").val());
                let totalDuration = 0;
                for (const content of $bookedContent) {
                    totalDuration += parseInt(content.getAttribute("data-duration"));
                }
                $endTime.val(startTime.add({
                    minutes: totalDuration
                }).toString(true));
            };

            let courseContent = "";
            for (const [idx, content] of courseDetails.courseContent.entries()) {
                courseContent += `
                <tr>
                    <td scope="row">${idx + 1}</td>
                    <td>${content.contentTitle}</td>
                    <td>${content.contentDescription}</td>
                    <td>${content.contentDuration}</td>
                    <td class="text-center">
                        <input data-duration="${content.contentDuration}" data-booked-content="${content._id}" type="checkbox" class="form-check-input">
                    </td>
                </tr>`
            }

            $("#bookDialogLabel").html(`Book ${courseDetails.title} by ${courseDetails.instructorName}`);
            $("#bookDialogContent").html(`
                <div class="container-fluid">
                    <div class="row mb-2">
                        <div class="col-3 d-flex align-items-center">
                            Date
                        </div>
                        <div class="col-9">
                            <input data-booked-date class="form-control" type="date">
                        </div>
                    </div>
                    <div class="row mb-4">
                        <div class="col-3 d-flex align-items-center">
                            Start Time
                        </div>
                        <div class="col-9">
                            <input data-booked-start-time class="form-control" type="time">
                        </div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-12">
                            <table class="table table-bordered table-sm table-hover">
                                <thead>
                                    <tr>
                                        <th scope="col" style="width: 5%">#</th>
                                        <th scope="col" style="width: 20%">Name</th>
                                        <th scope="col" style="width: 50%">Description</th>
                                        <th scope="col" style="width: 20%">Duration (minutes)</th>
                                        <th scope="col" style="width: 5%"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${courseContent}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-3 d-flex align-items-center">
                            Estimated End Time
                        </div>
                        <div class="col-9">
                            <input data-booked-end-time class="form-control" type="time" disabled>
                        </div>
                    </div>
                </div>
            `);

            $("[data-booked-content]").on("click", setEndTime);
            $("[data-booked-start-time]").on("input", setEndTime);
            $("#bookCourse").on("click", async () => {
                const date = $("[data-booked-date]").val() ? 
                                new Date($("[data-booked-date]").val()) : null;
                const startTime = $("[data-booked-start-time]").val();
                const endTime = $("[data-booked-end-time]").val();
                const courseContent = getToBeBooked();

                if (!date || !startTime || !endTime) return;
                const response = await $.ajax({
                    type: "POST",
                    url: "/book",
                    data: {
                        courseId: course._id,
                        startTime: date.setFromTimeObject(new Time(startTime)).toISOStringWithTimezone(),
                        endTime: date.setFromTimeObject(new Time(endTime)).toISOStringWithTimezone(),
                        courseContent: courseContent
                    }
                });
                bookDialogModal.hide();
                renderBookedCourses();
            })
            courseDetailsModal.hide();
            bookDialogModal.show();
        })

        courseDetailsModal.show();
    });
    const $recommended = $("#recommended-courses");
    $recommended.empty();
    for (const course of courseList) {
        $recommended.append(applyTemplate(course));
    }
}

async function renderRecommendedCourses() {
    const courses = await $.ajax({
        type: "GET",
        url: "/retrieve-courses"
    });
    setupRecommendedCourses(courses);
}

createCourseBtn.on("click", async () => {
    const newCourseTitle = $(".new-course-title").val();
    const newCourseDesc = $(".new-course-description").val();
    
    createCourseModal.hide();

    const response = await $.ajax({
        type: "POST",
        url: "/create-course",
        data: {
            title: newCourseTitle,
            description: newCourseDesc,
            content: getNewCourseContentTable()
        }
    });
    renderBookedCourses();
    renderRecommendedCourses();
})

function renderNewCourseContentTable(tableContent) {
    const tableBody = $("#current-course-content");
    tableBody.empty();

    for (const [idx, rowContent] of tableContent.entries()) {
        const row = $(`<tr data-row=${idx}></tr>`);
        row.append($(`<th scope="row">${(idx + 1)}</th>`));
        row.append(
            $(`<td class="p-0"></td>`).append($(`
                <input data-new-course-title="${idx}" class="form-control form-control-sm rounded-0" type="text">
            `).val(rowContent.contentTitle))
        );
        row.append(
            $(`<td class="p-0"></td>`).append($(`
                <textarea data-new-course-description="${idx}" class="form-control form-control-sm rounded-0" rows="1"></textarea>
            `).val(rowContent.contentDescription))
        );
        row.append(
            $(`<td class="p-0"></td>`).append($(`
                <input data-new-course-duration="${idx}" class="form-control form-control-sm rounded-0" type="number">
            `).val(rowContent.contentDuration))
        );
        tableBody.append(row);
    }
}

function getNewCourseContentTable() {
    let contentList = [];
    const rowLength = $("[data-row]").length;
    for (let i = 0; i < rowLength; i++) {
        const title = $(`[data-new-course-title="${i}"]`).val();
        const description = $(`[data-new-course-description="${i}"]`).val();
        const duration = $(`[data-new-course-duration="${i}"]`).val();
        contentList.push(
            {
                contentTitle: title,
                contentDescription: description,
                contentDuration: parseInt(duration)
            }
        )
    }
    return contentList;
}

createCourseModalTrigger.on("click", () => {
    $(".new-course-title").val("");
    $(".new-course-description").val("");

    const newRow = {
        contentTitle: "",
        contentDescription: "",
        contentDuration: 0
    };

    renderNewCourseContentTable([newRow]);

    $("#add-row-content").off();
    $("#add-row-content").on("click", () => {
        const prevContent = getNewCourseContentTable();
        renderNewCourseContentTable([
            ...prevContent,
            newRow
        ])
    })

    createCourseModal.show();
})

$("#notificationButton").on("click", () => {
    notified(false);
})

function setupBookedCourses(courseList) {
    $("#booked-courses").empty();
    const applyTemplate = course => {
        const startTime = new Date(course.startTime);
        const endTime = new Date(course.endTime);
        const bookedCard = $(`
        <div class="card hover-card mx-2 d-ib" style="width: 18rem; height: 200px">
            <div class="card-body">
                <h5 class="card-title">
                    ${course.courseDetails.title} <span class="badge rounded-pill bg-${course.status === "Booked" ? "primary" : "success"}">${course.status}</span>
                </h5>
                
                <h6 class="card-subtitle text-primary mb-1">${startTime.getDateString()}</h6>
                <h6 class="card-subtitle mb-2 text-muted">${startTime.getTimeString()} - ${endTime.getTimeString()}</h6>
                <p class="card-text">Instructed by <b>${course.courseDetails.instructorName}</b></p>
                <button data-delete type="button" class="btn btn-sm btn-outline-danger rounded-circle"><i class="fa-solid fa-ban"></i></button>
                <button data-join type="button" class="btn btn-sm btn-outline-success rounded-circle"><i class="fa-solid fa-phone"></i></button>
            </div>
        </div>`).on("click", async () => {
            await renderBookedDetails(course._id);
        });

        bookedCard.find("[data-delete]").on("click", e => {
            e.stopPropagation();
            cancelBookedCourse(course);
        });

        bookedCard.find("[data-join]").on("click", e => {
            e.stopPropagation();
            renderCallDialog(course);
        })

        return bookedCard;
    } 

    for (const course of courseList) {
        $("#booked-courses").append(applyTemplate(course));
    }
}

async function renderBookedCourses() {
    const bookedCourses = await $.ajax({
        type: "GET",
        url: "/get-booked-courses"
    });
    setupBookedCourses(bookedCourses);
}

function main() {
    renderRecommendedCourses();
    renderBookedCourses();
    $("#reload-recommended").on("click", renderRecommendedCourses);
    $("#reload-booked").on("click", renderBookedCourses);
    websocketSetup();
}

main();