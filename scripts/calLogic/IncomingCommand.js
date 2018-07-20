// jscs:disable requireSemicolons
// jscs:disable maximumLineLength

const rp = require('request-promise');
const momentTZ = require('moment-timezone');
const moment = require('moment');

const ical2json = require('ical2json')
const User = require('./User')
const Misc = require('./Misc.js')
const Time = require('./Time.js')

class IncomingCommand {

  constructor() {
    this.timeFrameRequested = ''
    this.arrayOfUsers = ''
    this.queryParsable = []
  }

  monthQuery (text) {
    let regExp = /(may|february|january|august|september|october|november|december|march|april|july|june)/
    return regExp.test(text)
  }

  checkIfValidQuery(cmdArr) {

    let weekIsPositionedWrong = (cmdArr) => {
      if (cmdArr.indexOf('week') !== -1) {
        if (cmdArr.indexOf('week') === cmdArr.length - 1) {
          if (!isNaN(cmdArr[cmdArr.indexOf('week') - 1])) {
            // error week
            return true
          }
        }
      }

      return false
    }

    if (weekIsPositionedWrong(cmdArr)) {
      return this.errorHandler('Invalid query, please check the position of "week" in your request. If you need a refresher on commands type `@doge cal help`.')
    }

  }

  interpreter (robot, message) {

    let cmdArr = message.text.split(' ')

    this.arrayOfUsers = new User.UserArray()

    let basicQuery = cmdArr.indexOf('suggest')

    this.checkIfValidQuery(cmdArr)

    // add the user who requested suggestions to our user array
    this.arrayOfUsers.addUser(new User.Individual(message.user.id))


    if (cmdArr.length - 1 === basicQuery) {
      this.saveQueryParsable('DayQueryNoDates')
      return this.arrayOfUsers.get()
    }

    if (cmdArr[basicQuery + 1][0] === '@') {
      // run when additional users are added to a query

      let uNamePosition = basicQuery + 1
      let userIdArr = []
      let currUser = cmdArr[uNamePosition]

      while (currUser && currUser[0] === '@') {
        currUser = currUser.substr(1)

        if (!robot.brain.usersForFuzzyName(currUser).length) {
          return this.errorHandler('Either the user you have requested has not run the `@doge cal suggest setup` wizard or that user does not exist! For now try running a query without ' + '@' + currUser + '\'s username.')
        } else if (Misc.checkIfUserIsSetup(robot, robot.brain.usersForFuzzyName(currUser)[0].id)) {
          return this.errorHandler('Either the user you have requested has not run the `@doge cal suggest setup` wizard or that user does not exist! For now try running a query without ' + '@' + currUser + '\'s username.')
        }

        this.arrayOfUsers.addUser(new User.Individual(robot.brain.usersForFuzzyName(currUser)[0].id))
        uNamePosition++
        currUser = cmdArr[uNamePosition]
      }

      if (!currUser) {
        // day query, with users - no dates
        this.saveQueryParsable('DayQueryNoDates')
        return this.arrayOfUsers.get()
      }

      // week query, with users - and dates and or week
      this.saveQueryParsable(cmdArr.splice(uNamePosition, cmdArr.length))
      return this.arrayOfUsers.get()
    }

    // week query, no additional users, no dates?
    this.saveQueryParsable(cmdArr.splice(basicQuery + 1, cmdArr.length))
    return this.arrayOfUsers.get()
  }

  dateInterpreter(User, todaysDate) {
    let cmd = this.queryParsable
    if (cmd[0] === 'week') {

      if (cmd.length === 1) {
        return this.weekQueryNoDates(User, todaysDate)
      } else if (cmd.length === 3) {
        return this.weekQueryWithDates(User, cmd[1], cmd[2])
      }

    } else if (this.monthQuery(cmd[0])) {
      return this.dayQueryWithDates(User, cmd[0], cmd[1])
    }
  }

  errorHandler(errMsg) {
    this.arrayOfUsers.triggerError(errMsg)
    return this.arrayOfUsers.get()
  }

  setRequestedQuery(msg) {
    this.timeFrameRequested = msg
  }

  getRequestedQuery(msg) {
    return this.timeFrameRequested
  }

  weekQueryWithDates(User, month, day) {
    // week query with dates
    let dateRequested = Time.interpDate(month, day)

    let weeksWorkingDaysArr = this.setScopeOfWorkWeek(dateRequested)

    //if Query is weekend return error msg

    if (weeksWorkingDaysArr.err) {
      return this.errorHandler(weeksWorkingDaysArr.err)
    }

    this.setRequestedQuery(`week of ${dateRequested.format('LL')}`)
    weeksWorkingDaysArr.forEach(date => User.add('datesRequested', date))

    return User.get()
  }

  weekQueryNoDates(User, todaysDate) {
    // week query no dates
    let weeksWorkingDaysArr = this.setScopeOfWorkWeek(todaysDate)

    if (weeksWorkingDaysArr.err) return this.errorHandler(weeksWorkingDaysArr.err)

    this.setRequestedQuery('this week')
    weeksWorkingDaysArr.forEach(date => User.add('datesRequested', date))

    return User.get()
  }

  dayQueryNoDates(IndividualUser, todaysDate) {
    // day query without dates
    IndividualUser.add('datesRequested', todaysDate)

    this.setRequestedQuery(`today, ${todaysDate.format('LL')}`)
  }

  saveQueryParsable(query) {
    if (typeof query === 'string') {
      this.queryParsable.push(query)
      return
    }

    this.queryParsable = query
  }

  dayQueryWithDates(User, month, day) {
    // day query with dates
    let dateRequested = Time.interpDate(month, day)

    User.add('datesRequested', dateRequested)

    this.setRequestedQuery(`${dateRequested.format('LL')}`)

    return User.get()
  }

  buildEventWeek(dayProvided) {
    let startOfWorkWeek = moment(dayProvided).startOf('isoWeek');
    let endOfWorkWeek = moment(dayProvided).endOf('isoWeek').subtract(2, 'days')

    let daysToCheckAvailability = [];
    let day = startOfWorkWeek;

    // possible error here Time.getTodaysDate() is used...

    while (day <= endOfWorkWeek) {
      if (day.isSameOrAfter(Time.getTodaysDate(), 'day')) {
        daysToCheckAvailability.push(moment.utc(day.toDate()));
      }

      day = day.clone().add(1, 'd');
    }

    return daysToCheckAvailability
  }

  setScopeOfWorkWeek(dayProvided) {
    if (1 <= dayProvided.isoWeekday() && dayProvided.isoWeekday() <= 5) {
      return this.buildEventWeek(dayProvided)

    } else if (6 === dayProvided.isoWeekday() || dayProvided.isoWeekday() === 7) {
      console.log('returning error! from setScope');
      return { err: 'I don\'t support week queries that land on weekend dates. To retrieve weekend meeting suggestions please use the single day query: `@doge cal suggest <users(optional)> <month> <day>`.' }
    }
  }

}

module.exports = IncomingCommand
