// jscs:disable requireSemicolons
// jscs:disable maximumLineLength

const momentTZ = require('moment-timezone');
const moment = require('moment');

const Time = require('./Time.js')
const Misc = require('./Misc.js')

class CreateAvailability {
  constructor() {
    this.lastEventEndTime = 'undefined'
    this.availabilityArr = []
  }

  set(wrkHrs, eventEnd, eventStart) {
    if (eventStart === undefined) { //event started before working hours
      this.lastEventEndTime = eventEnd
      return
    }

    if (this.lastEventEndTime === 'undefined') {
      // first event that day && there is gap time between wrkHrs start and eventStart
      this.lastEventEndTime = wrkHrs.start
    }

    this.add(this.lastEventEndTime, eventStart)

    this.lastEventEndTime = eventEnd
  }

  setUntilEndOfWorkDay(wrkHrs) {
    this.add(this.lastEventEndTime, wrkHrs.end)
  }

  dayIsFreeAddAvail(wrkHrs) {
    this.add(wrkHrs.start, wrkHrs.end, 'dayIsFree')
  }

  wholeDayIsBooked(wrkHrs) {
    this.add(wrkHrs.start, wrkHrs.end, 'dayIsBooked')
  }

  add (availStart, availEnd, additionalArg) {
    let availabilityObj = {
      availStart: availStart,
      availEnd: availEnd,
    }

    if (additionalArg) availabilityObj[additionalArg] = true

    this.availabilityArr.push(availabilityObj)
  }

  get() { return this.availabilityArr}

}

module.exports = CreateAvailability
