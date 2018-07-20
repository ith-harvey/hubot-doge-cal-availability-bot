// jscs:disable requireSemicolons
// jscs:disable maximumLineLength

const momentTZ = require('moment-timezone');
const moment = require('moment');
const Time = require('./Time.js')
const CreateAvailability = require('./RecordAvailability.js')

class Merge {

  static determLongerAvailWindows(arr1, arr2) {
    if (arr1.length > arr2.length) {
      return arr1.length
    } else {
      return arr2.length
    }
  }

  static diff (start, end) {
    return moment.duration(end.diff(start)).asMinutes()
  }

  static availability(user1, user2) {

    let mergedAvailArr = []

    for (let i = 0; i < user1.length; i++) {

      let largerNumOfAvailWindows = this.determLongerAvailWindows(user1[i], user2[i])

      let Availability = new CreateAvailability()

      let compare = this.prepEventsForComparison(largerNumOfAvailWindows, user1[i][0], user1[i], user2[i][0], user2[i])

      mergedAvailArr.push(
        this.checkForOverlapBooking(
          this.compareAvailability(compare, Availability)
        )
      )
    }

    return mergedAvailArr

  }

  static checkForOverlapBooking(dayAvailArr) {

    let availabilityArr = []
    let dayIsBookedTally = 0

    dayAvailArr.forEach( dayAvail => {
      if (!dayAvail.timeWindowIsBooked) {
        availabilityArr.push(dayAvail)
      } else {
        dayIsBookedTally ++
      }
    })

    if (dayIsBookedTally === dayAvailArr.length) {
      // all windows coming back overlap to create a booked schedule
      let copyOfDay = JSON.parse(JSON.stringify(dayAvailArr[0]));
      delete copyOfDay.timeWindowIsBooked
      copyOfDay.dayIsBooked = true
      return [copyOfDay]
    }

    return availabilityArr

  }

  static prepEventsForComparison(largerNumOfAvailWindows, user1FirstWindow, user1EventArr, user2FirstWindow, user2EventArr) {

    function buildCompare(windowToUse, additionalParam) {
      let returnObj = {
        start: windowToUse.availStart,
        end: windowToUse.availEnd,
      }
      if (additionalParam) returnObj[additionalParam] = true
      return returnObj
    }

    function findLastAvailability(availArray, i) {
      while (availArray[i] === undefined) {
        i++
      }

      return buildCompare(availArray[i])
    }

    let compareArr = []

    for (let j = 0; j < largerNumOfAvailWindows; j++) {
      let compare = {}

      if (user1FirstWindow.dayIsFree && user2FirstWindow.dayIsFree) {
        // both days are entirely free -> run comparison
        compare.user1Event = buildCompare(user1FirstWindow, 'dayIsFree')
        compare.user2Event = buildCompare(user2FirstWindow, 'dayIsFree')

      } else if (user1FirstWindow.dayIsBooked || user2FirstWindow.dayIsBooked) {
        // both days are entirely Booked -> run comparison

        compare.user1Event = buildCompare(user1FirstWindow, 'dayIsBooked')
        compare.user2Event = buildCompare(user2FirstWindow, 'dayIsBooked')

      } else if (user1FirstWindow.dayIsFree) {
        // just the first user's day is free
        compare.user1Event = buildCompare(user1FirstWindow, 'dayIsFree')
        compare.user2Event = buildCompare(user2EventArr[j])

      } else if (user2FirstWindow.dayIsFree) {
        // just the second user's day is free
        compare.user2Event = buildCompare(user2FirstWindow, 'dayIsFree')
        compare.user1Event = buildCompare(user1EventArr[j])

      } else {

        if (user1EventArr[j] === undefined) {
          compare.user1Event = findLastAvailability(user1EventArr, (j - 1))
          compare.user2Event = buildCompare(user2EventArr[j])

        } else if (user2EventArr[j] === undefined) {
          compare.user1Event = buildCompare(user1EventArr[j])
          compare.user2Event = findLastAvailability(user2EventArr, (j - 1))
        } else {
          compare.user1Event = buildCompare(user1EventArr[j])
          compare.user2Event = buildCompare(user2EventArr[j])
        }
      }

      compareArr.push(compare)
    }

    return compareArr
  }

  static compareAvailability (compareArr, Availability) {

    let mergeEventToPush = {}

    for (let j = 0; j < compareArr.length; j++) {

      let user1Ev = compareArr[j].user1Event
      let user2Ev = compareArr[j].user2Event

      if (user1Ev.dayIsBooked || user2Ev.dayIsBooked) {
        Availability.wholeDayIsBooked(user1Ev)
        return Availability.get()
      }

      // determine start of window
      if (user1Ev.start.isSameOrBefore(user2Ev.start, 'minutes')) {
        mergeEventToPush.start = user2Ev.start
      } else if (user1Ev.start.isSameOrAfter(user2Ev.start, 'minutes')) {
        mergeEventToPush.start = user1Ev.start
      }

      // determine end of window
      if (user1Ev.end.isSameOrBefore(user2Ev.end, 'minutes')) {
        mergeEventToPush.end = user1Ev.end
      } else if (user1Ev.end.isSameOrAfter(user2Ev.end, 'minutes')) {
        mergeEventToPush.end = user2Ev.end
      }

      // two users times overlap to create booked || availability is less than 60 minutes
      if ( (mergeEventToPush.end.isSameOrBefore(mergeEventToPush.start))
      || (this.diff(mergeEventToPush.start, mergeEventToPush.end) < 60)) {
        Availability.add(mergeEventToPush.start, mergeEventToPush.end, 'timeWindowIsBooked')
      } else {
        Availability.add(mergeEventToPush.start, mergeEventToPush.end)
      }

    }

    return Availability.get()

  }

}

module.exports = Merge
