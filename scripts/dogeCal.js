
// jscs:disable requireSemicolons
// jscs:disable maximumLineLength
// @doge calendar setup and calendar feature script

const momentTZ = require('moment-timezone');
const moment = require('moment');

const rp = require('request-promise');
const IncomingCommand = require('./calLogic/IncomingCommand.js')
const CreateAvailability = require('./calLogic/RecordAvailability.js')
const CreateSuggestion = require('./calLogic/RecordSuggestion.js')
const User = require('./calLogic/User.js')
const Time = require('./calLogic/Time.js')
const Merge = require('./calLogic/MergeAvail.js')
const Misc = require('./calLogic/Misc.js')

const { FU } = require('hubot-doge-utility-functions')

//Functional Utilities
const { checkIfDMOrPublic, modObjKickBack} = FU

module.exports = (robot) => {

  let awaitingUrl = false
  let awaitingWorkHours = false
  let calSetupDone = false

  robot.respond(/(cal setup)/i, function (msg) {
    msg.reply('Welcome to the cal setup wizard. \n \n Please enter your fastmail account’s free/busy calendar URL so I can share your availability upon request.\n \n (To access your free/busy calendar URL visit www.fastmail.com/calendar/ while logged in.\n Select the calendar dropdown > settings > calendars > Edit&share > check free/busy information > copy the url > hit save up top > paste URL in chat and hit enter)')
    awaitingUrl = true
  })

  robot.hear(/https/i, function (msg) {
    if (awaitingUrl) {
      msg.message.text = checkIfDMOrPublic(msg.message.text)

      // download cal object that user provides URL to
      rp(msg.message.text).then(response => {

        const addBusyCalUrl = modObjKickBack('busyCalUrl', msg.message.text)

        robot.brain.set(msg.message.user.id, addBusyCalUrl(robot.brain.get(msg.message.user.id)))

        msg.reply('URL was received... \n \n Excellent, now I need to know your preferred working hours when you will be available for meetings. \n \n Enter them in 24hr format: <HH:mm>-<HH:mm> (e.g. 09:00-17:00)')

        awaitingUrl = false
        awaitingWorkHours = true
      }).catch(err => {
        console.log('err', err);
        msg.reply('Uh oh, it looks like there was an error when trying to retreive your busy calendar information... Did you hit save in the top left after you checked the free/busy information box? \n \n Please try to reenter your free/busy URL again -> (To access your free/busy calendar URL visit www.fastmail.com/calendar/ while logged in.\n Select the calendar dropdown > settings > calendars > Edit&share > check free/busy information > copy the url > hit save up top > paste URL in chat and hit enter)')
      })

    }
  })

  robot.hear(/[0-9][0-9]:[0-5][0-9]-[0-9][0-9]:[0-5][0-9]/i, function (msg) {
    if (awaitingWorkHours) {

      msg.message.text = checkIfDMOrPublic(msg.message.text)

      let hrs = msg.message.text.split('-')

      let compareprep = (hrsArr) => Number(hrsArr.split('').splice(0, 2).join(''))

      let compareStart = compareprep(hrs[0])
      let compareEnd = compareprep(hrs[1])

      if ((compareEnd - compareStart) < 5) {
        return msg.reply('The times you have provided amount to less than five hours i.e. `09:00-13:00` or cross into the next day i.e. `17:00-4:00`. Please enter in work hours with a difference of five or more hours that don\'t cross into the next day. \n \n Enter them in a 24hr format: <HH:mm>-<HH:mm> (e.g. 09:00-17:00)')
      }

      const addWorkHrs = modObjKickBack('workHrs', msg.message.text)

      robot.brain.set(msg.message.user.id, addWorkHrs(robot.brain.get(msg.message.user.id)))

      msg.reply('Thank you for completing the cal setup wizard!, you may now use the `@doge cal suggest` feature.')

      awaitingWorkHours = false
      calSetupDone = true
    }
  })

  robot.respond(/(cal suggest)/i, function (msg) {

    if (Misc.checkIfUserIsSetup(robot, msg.message.user.id)) {
      msg.reply('To use the `@doge cal suggest` feature you must first go through the setup wizard. Do so by typing the command `@doge cal setup`.')
    } else {
      console.log('incoming message : ', msg.message.text);

      let Command = new IncomingCommand()
      let UserArray = Command.interpreter(robot, msg.message)

      let userInfoPromiseArr = UserArray.arr.map(user => new Promise((resolve, reject) => resolve(rp(robot.brain.get(user.userId).busyCalUrl))))

      // response to GET user info
      Promise.all(userInfoPromiseArr).then(userInfoArr => {
        let response = []


        UserArray = Misc.completeUserInformation(robot, userInfoArr, UserArray, Command)

        if (UserArray.error) {
          return msg.reply(UserArray.error)
        }

        return Misc.setupFindAvailability(robot, UserArray)

      }).then(allUsersAvailability => { //receive users availability

        if (UserArray.arr.length > 1) {
          // if more than one users info is supplied -> merge availability
          while (allUsersAvailability.length >= 2) {
            // run cross check with first 2 users info and remove them from arr

            // re-add the merged availability and rerun until 1 avail is left
            allUsersAvailability.unshift(Merge.availability(allUsersAvailability.shift(), allUsersAvailability.shift()))
          }
        }

        console.log('allUsersAvailability post merge:');
        allUsersAvailability.forEach(user => {
          console.log(user);
        })

        msg.reply('Your current Timezone (set at fastmail.com): ' + UserArray.arr[0].get().timeZone)

        msg.reply(Misc.dayVsWeekAvailLoopAndBuildSuggestions(allUsersAvailability, UserArray.arr[0].get().timeZone, UserArray.arr[0].get().datesRequested, Command))

      }).catch(err => {
        console.log('err', err)
        return err
      })
    }
  })
}
