Date.prototype.getDayOfWeek = function(isLong) {
    const dayNames =[
        'Sunday', 
        'Monday', 
        'Tuesday', 
        'Wednesday', 
        'Thursday', 
        'Friday', 
        'Saturday'
    ];
    const day = dayNames[this.getDay()];
    return isLong ? day : day.slice(0, 3);
}

Date.prototype.getMonthName = function(isLong) {
    const monthNames = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
    ];
    const month = monthNames[this.getMonth()];
    return isLong ? month : month.slice(0, 3);
}

Date.prototype.getDateString = function() { 
    return `${this.getDayOfWeek()}, ${pad2Digits(this.getDate())} ${this.getMonthName()} ${this.getFullYear()}`
}

Date.prototype.getTimeString = function(format24) {
    if (format24) {
        return `${pad2Digits(this.getHours())}:${pad2Digits(this.getMinutes())}`;
    } else {
        const passedNoon = this.getHours() > 12;
        return `${pad2Digits(passedNoon ? this.getHours() - 12 : this.getHours())}:${pad2Digits(this.getMinutes())} ${passedNoon ? "PM" : "AM"}`
    }
}

Date.prototype.toISOStringWithTimezone = function() {
    const tzOffset = -this.getTimezoneOffset();
    const diff = tzOffset >= 0 ? '+' : '-';
    const pad = n => `${Math.floor(Math.abs(n))}`.padStart(2, '0');
    return this.getFullYear() +
    '-' + pad(this.getMonth() + 1) +
    '-' + pad(this.getDate()) +
    'T' + pad(this.getHours()) +
    ':' + pad(this.getMinutes()) +
    ':' + pad(this.getSeconds()) +
    diff + pad(tzOffset / 60) +
    ':' + pad(tzOffset % 60);
}

Date.prototype.setFromTimeObject = function(time) {
    this.setHours(time.hours);
    this.setMinutes(time.minutes);
    this.setSeconds(time.seconds);
    return this;
}

class Time {
    constructor(timeString) {
        if (!timeString) {
            const todayDate = new Date();
            this.hours = todayDate.getHours();
            this.minutes = todayDate.getMinutes();
            this.seconds = todayDate.getSeconds();
            return;
        }
        const splitTime = timeString.split(":");
        this.hours = parseInt(splitTime[0]);
        this.minutes = parseInt(splitTime[1]);
        this.seconds = splitTime.length > 2 ? parseInt(splitTime[2]) : 0;
    }

    add(durationObject) {
        const tempDate = new Date();
        tempDate.setHours(this.hours);
        tempDate.setMinutes(this.minutes);
        tempDate.setSeconds(this.seconds);
        
        const newTempDate = addTime(tempDate, durationObject);
        this.hours = newTempDate.getHours();
        this.minutes = newTempDate.getMinutes();
        this.seconds = newTempDate.getSeconds();
        return this;
    }

    toString(format24) {
        if (format24) {
            return `${pad2Digits(this.hours)}:${pad2Digits(this.minutes)}`;
        } else {
            const passedNoon = this.hours > 12;
            return `${pad2Digits(passedNoon ? this.hours - 12 : this.hours)}:${pad2Digits(this.minutes)} ${passedNoon ? "PM" : "AM"}`
        }
    }
}

function addTime(date, durationObject, toString) {
    if (durationObject.hours) {
        date.setTime(date.getTime() + durationObject.hours * 3600000);
    }
    if (durationObject.minutes) {
        date.setTime(date.getTime() + durationObject.minutes * 60000);
    } 
    if (durationObject.seconds) {
        date.setTime(date.getTime() + durationObject.seconds * 1000);
    }

    if (toString) {
        date.setSeconds(0);
        date.setMilliseconds(0);
        return date.toISOStringWithTimezone().replace().substring(0,16);
    }
    return date
}

function sameDay(date1, date2) {
    if (
        date1.getDate() === date2.getDate() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getFullYear() === date2.getFullYear()
    ) return true;
    return false;
}

function pad2Digits(str) {
    return str.toString().padStart(2, "0");
}

async function getUser() {
    return await $.ajax({
        method: "GET",
        url: "/get-user"
    });
}

async function confirmDialog(label, callback) {
    const dialog = $(`
    <div class="modal fade" data-confirm-dialog tabindex="-1" aria-labelledby="exampleModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="exampleModalLabel">Confirm</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    ${label}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    <button type="button" class="btn btn-primary">Confirm <i class="fa-solid fa-check"></i></button>
                </div>
            </div>
        </div>
    </div>`);
    $("body").append(dialog);
    const bsDialog = new bootstrap.Modal(dialog);
    dialog.on("hidden.bs.modal", e => dialog.remove());
    dialog.find($(".btn-primary")).on("click", () => callback(bsDialog));
    bsDialog.show();
}

async function detailsDialog(props) {
    const renderDialogBtn = (color, label) => `<button data-label="${label}" type="button" class="btn btn-${color}">${label}</button>`;

    const dialog = $(`
    <div class="modal fade" data-confirm-dialog tabindex="-1" aria-labelledby="exampleModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-${props.size}">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="exampleModalLabel">${props.title}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    ${props.content}
                </div>
                <div class="modal-footer">
                    ${props.buttons.map(btn => renderDialogBtn(btn.color, btn.label)).join('\n')}
                </div>
            </div>
        </div>
    </div>`);
    $("body").append(dialog);
    const bsDialog = new bootstrap.Modal(dialog);
    dialog.on("hidden.bs.modal", e => dialog.remove());
    for (const btn of props.buttons) {
        dialog.find(`[data-label="${btn.label}"]`).on("click", () => btn.callback(bsDialog));
    }
    bsDialog.show();
    if (props.returnBsDialog) return [dialog, bsDialog];
    return dialog;
}

async function getBookedDetails(bookedId) {
    return await $.ajax({
        method: "GET",
        url: `/get-booked-details/${bookedId}`
    })
}