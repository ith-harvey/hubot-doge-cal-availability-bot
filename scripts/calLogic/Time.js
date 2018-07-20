
// jscs:disable requireSemicolons
// jscs:disable maximumLineLength

const momentTZ = require('moment-timezone');
const moment = require('moment');
const getTodaysDate = currentTimeZone => moment.utc()
const minutesOfDay = m => m.minutes() + m.hours() * 60;


module.exports = {
  getTodaysDate,
  minutesOfDay,
  localTime,
  formatDate,
  wrkHrsParse,
  interpDate,
}

function interpDate(month, day) {
  return moment().month(month).date(day).hour(00).minutes(00).seconds(00)
}

function formatDate(timeZone, icalStr) {
  let strYear = icalStr.substr(0, 4);
  let strMonth = parseInt(icalStr.substr(4, 2), 10) - 2;
  let strDay = icalStr.substr(6, 2);
  let strHour = icalStr.substr(9, 2);
  let strMin = icalStr.substr(11, 2);
  let strSec = icalStr.substr(13, 2);
  strMonth += 1
  let dateNeedsFormat = new Date(strYear, strMonth, strDay, strHour, strMin, strSec)

  return moment.utc(dateNeedsFormat, 'YYYY-MM-DD HH:mm:ss Z').month(strMonth).date(strDay).hours(strHour).minutes(strMin).seconds(strSec)

}

function localTime(time, timeZone) {
  let timeClone = moment(time).clone()
  return timeClone.tz(timeZone).format('DD-MM-YYYY hh:mm:ss a')
}

function wrkHrsParse(wrkHrs, timeZone, dayRequested) {

  let start = {
    Hrs: wrkHrs.slice(0, 2),
    Min: wrkHrs.slice(3, 5),
  }

  let end = {
    Hrs: wrkHrs.slice(6, 8),
    Min: wrkHrs.slice(9, 11),
  }

  let momentSet = (dayReq, startOrEnd) => {
    // dayReq = moment.utc(dayReq).clone()

    let currUtcOffSet = momentTZ.tz(dayReq, timeZone)

    let mdhmsChange = currUtcOffSet.month(dayReq.month()).date(dayReq.date()).hours(startOrEnd.Hrs).minutes(startOrEnd.Min).seconds(00).milliseconds(0)

    let utc = moment.utc(mdhmsChange)

    return utc
  }

  let returnObj = {
    start: momentSet(dayRequested, start),
    end: momentSet(dayRequested, end),
    timeZone: timeZone,
  }

  return returnObj
}
