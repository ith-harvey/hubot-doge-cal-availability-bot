// jscs:disable requireSemicolons
// jscs:disable maximumLineLength

const momentTZ = require('moment-timezone');
const moment = require('moment');
const rp = require('request-promise');
const ical2json = require('ical2json');
const CreateAvailability = require('./RecordAvailability.js');
const CreateSuggestion = require('./RecordSuggestion.js')
const Time = require('./Time.js');



function setupFindAvailability(robot, UserArray) {
  let allUsersAvailability = []

  UserArray.arr.forEach((User, i) => {
    // loop over each user

    allUsersAvailability.push(User.datesRequested.map((dayToCheck) => {

        let Availability = new CreateAvailability()

        let wrkHrsInUTC = Time.wrkHrsParse(robot.brain.get(User.userId).workHrs, User.timeZone, dayToCheck)

        // findAvailOverTime -> requires the entire event arr for that person
        return findAvailability(User.calBusyArr, wrkHrsInUTC, dayToCheck, Availability)
      }))
  })

  return allUsersAvailability
}




/**
   * findAvailability()
   * @param {Array} eventArr - The event data retreived from fastmail.
   * @param {Object} wrkHrs - Users prefered working hours & timezone
   *    i.e: {start: XXXX, end: XXXX, timeZone: XXXX}
   * @param {String} dateAvailRequested - the date the user has requested avail * on
   * @param {Class} Availability - instance of the RecordAvailability Class
   *
   * @returns Nothing - calls Availability.set() method
**/


function findAvailability (eventArr, wrkHrs, dateAvailRequested, Availability) {
  let i = 0
  let currEvent = eventArr[i]
  let eventStart
  let eventEnd

  // using function to compare event to workingHours
  eventStart = Time.formatDate(wrkHrs.timeZone, currEvent.DTSTART)
  eventEnd = Time.formatDate(wrkHrs.timeZone, currEvent.DTEND)

  while (eventStart.isSameOrBefore(wrkHrs.start, 'day')) {

    if (eventStart.isSame(wrkHrs.start, 'day')) {

      if (eventStart.isSameOrBefore(wrkHrs.start, 'minutes')) {
        // event start happens before || same time as wrkhrs start

        if (eventEnd.isSameOrBefore(wrkHrs.start, 'minutes')) {
          // event end happens before || same time as wrkhrs start
          // the entire event happens before working hours
          // do nothing -> go to next event

        } else if (eventEnd.isSameOrAfter(wrkHrs.end, 'minutes')) {
          // event books out the entire day!
          Availability.wholeDayIsBooked(wrkHrs)

        } else {
          //event ends during working hours
          Availability.set(wrkHrs, eventEnd)
        }

      } else { // event start happens after wrkhrs start

        if (eventStart.isBefore(wrkHrs.end, 'minutes')) {
          // event start happens during work hours
          Availability.set(wrkHrs, eventEnd, eventStart)

        } else {
          // the entire event happens after working hours
          // do nothing -> go to next event
        }

      }
    }

    if (eventArr.length - 1 === i) break

    i++
    currEvent = eventArr[i]

    // using function to compare event to wrkingHours
    eventStart = Time.formatDate(wrkHrs.timeZone, currEvent.DTSTART)
    eventEnd = Time.formatDate(wrkHrs.timeZone, currEvent.DTEND)

  }

  if ((Availability.lastEventEndTime !== 'undefined')
      && Availability.lastEventEndTime.isBefore(wrkHrs.end)) {
    // an event has been set add more availability till end of day
    Availability.setUntilEndOfWorkDay(wrkHrs)
  }

  if (!Availability.get().length) {
    // no events have been set
    Availability.dayIsFreeAddAvail(wrkHrs)
  }

  return Availability.get()
}

function checkIfUserIsSetup(robot, userId) {
  // input validation function

  if (robot.brain.get(userId) === null) {
    //user has not started the setup process.
    return true

  } else if (robot.brain.get(userId).busyCalUrl === undefined) {
    //user has not provided a URL.
    return true

  } else if (robot.brain.get(userId).workHrs === undefined) {
    //user has not provided working hours.
    return true
  }

  return false // user is already setup for cal suggest feature
}



function completeUserInformation(robot, userInfoArr, UserArray, Command) {

  UserArray.arr.forEach((User, i) => {

    let output = ical2json.convert(userInfoArr[i]);

    if (!output.VCALENDAR[0].VEVENT) {
      output.VCALENDAR[0].VEVENT = [{ DTEND: '20180413T000000Z',
        DTSTAMP: '20180418T151757Z',
        DTSTART: '20180412T160000Z',
        SEQUENCE: '0',
        TRANSP: 'OPAQUE',
        UID: 'user was didnt have any events in their calendar this is a fake entry', },
      ]
    }

    let data = {
      eventArr: output.VCALENDAR[0].VEVENT,
      timeZone: output.VCALENDAR[0]['X-WR-TIMEZONE'],
    }

    User.add('timeZone', data.timeZone).add('calBusyArr', data.eventArr).setDatesRequested(momentTZ().tz(data.timeZone), Command)

  })

  return UserArray.get()
}

function dayVsWeekAvailLoopAndBuildSuggestions(mergedAvailArr, requestersTimeZone, requestersDatesRequested, Command) {

  let buildDayHeader = (dayOfWeek) => {
    let dayOfWeekBold = dayOfWeek.format('dddd')
    let justDate = dayOfWeek.format('LL')

    return `\n *${dayOfWeekBold} ${justDate}*`
  }

  let dayIsFullyBooked = (dayRequested) => buildDayHeader(dayRequested) + '\n This day is fully booked. :( \n'

  let suggestString = ''
  let daySuggestionArr

  mergedAvailArr.forEach(weekAvailability => {

    weekAvailability.forEach((dayAvailability, i) => {

      let Suggestion = new CreateSuggestion()

      if (dayAvailability[0].dayIsBooked) {
        suggestString += dayIsFullyBooked(requestersDatesRequested[i])
        return

      } else if (dayAvailability.length === 1) {
        //run if the day's availability is 'whole' (not busy in middle of the day)


        if (dayAvailability[0].availEnd
          .isSameOrBefore(dayAvailability[0].availStart)) {
          suggestString += dayIsFullyBooked(requestersDatesRequested[i])
          return
        }

        daySuggestionArr = Suggestion.generateThreeWholeAvail(dayAvailability[0].availStart, dayAvailability[0].availEnd, requestersTimeZone)

        if (daySuggestionArr.error) {
          suggestString += dayIsFullyBooked(requestersDatesRequested[i])
          return
        }

      } else {
        //run if the day's availability is 'broken up' (busy in the middle of the day)

        daySuggestionArr = Suggestion.generateThreeSeperatedAvail(dayAvailability, requestersTimeZone)
      }

      suggestString += buildDayHeader(requestersDatesRequested[i])
      daySuggestionArr.forEach(availWindow => {
        suggestString += `\n${availWindow.localTime}\n ${availWindow.UTC}\n`
      })

    })
  })

  return `Here are some meeting suggestions for ${Command.getRequestedQuery()}:\n\n` + suggestString
}


module.exports = {
  dayVsWeekAvailLoopAndBuildSuggestions,
  checkIfUserIsSetup,
  findAvailability,
  setupFindAvailability,
  completeUserInformation,
}
