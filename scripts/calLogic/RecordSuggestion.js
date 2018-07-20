// jscs:disable requireSemicolons
// jscs:disable maximumLineLength

const momentTZ = require('moment-timezone');
const moment = require('moment');

const Time = require('./Time.js')
const Misc = require('./Misc.js')

class CreateSuggestion {
  constructor() {
    this.suggestionArr = []
    this.meetingSuggestionLength = 0
  }

  getMeetingLength() {
    return this.meetingSuggestionLength
  }

  setMeetingLength(lengthInMinutes) {
    this.meetingSuggestionLength = lengthInMinutes
  }

  generateThreeWholeAvail(timeWindowStart, timeWindowEnd, requestersTimeZone) {

    let endTime
    let arr
    let dateRequested = timeWindowStart

    let diff = (start, end) => moment.duration(end.diff(start)).asMinutes()

    let buildAllPossibleStartTimes = (start, end) => {
      let meetingLeng = 60
      let arr = []
      let modStart = moment.utc(start)
      for (let i = 0; i < (diff(start, end) / meetingLeng); i++) {
        if (i) {
          arr.push(moment.utc(modStart.add(60, 'm')))
        } else {
          arr.push(start)
        }
      }

      return arr
    }

    arr = buildAllPossibleStartTimes(timeWindowStart, timeWindowEnd)

    if (diff(timeWindowStart, timeWindowEnd) > 180) {
      // if start - end hr diff is 4 or more select at random
      arr = this.selectRandomStartTimes(arr)
    }

    if (diff(timeWindowStart, timeWindowEnd) < 60)  {
      return {error: 'timeslot < 60 min'}
    }

    arr.forEach(startTime =>  {
      endTime = moment(startTime).add(1, 'hours')
      this.add(requestersTimeZone, startTime, endTime)
    })

    return this.sortSuggestsChronologically(this.get())
  }

  sortSuggestsChronologically (suggestions) {
    if (suggestions.length < 2) {
      // only one suggestion, purposless to sort
      return suggestions
    }

    let chronSuggestions = [suggestions.pop()]
    let i = 0

    while (suggestions.length) {
      if(chronSuggestions[i].rawStartTime
        .isSameOrBefore(suggestions[0].rawStartTime) ) {
          if (i === chronSuggestions.length - 1) {
            chronSuggestions.splice(i + 1, 0, suggestions.shift())
          } else {
            i++
          }

      } else { // put in infront of curr item
        chronSuggestions.splice(i, 0, suggestions.shift())
      }
    }

    return this.replaceSuggestions(chronSuggestions)
  }

  buildTestSuggestions(availArr, timeZone) {

    let testSuggestions = []

    availArr.forEach(availWindow => {
      let sizeOfAvailWindowInMin =  moment.duration(availWindow.availEnd.diff(availWindow.availStart)).asMinutes()
      let availabilityStartPoint = availWindow.availStart

      for (let i = 1; i <= (sizeOfAvailWindowInMin / 60); i++) {

        // only create 60 min suggestions
        testSuggestions.push(this.testAdd(timeZone, availabilityStartPoint, moment(availabilityStartPoint).add(1, 'hours')))

        availabilityStartPoint = moment(availabilityStartPoint).add(1, 'hours') //bump suggestionStartPoint an hour
      }
    })
    return testSuggestions
  }

  recurseToFindSuggest(availArr, timeZone, currItem, suggestObj) {

    if (this.suggestionArr.length === 3) {
      return
    }

    currItem = availArr[Math.floor(Math.random() * availArr.length)];

    if (!suggestObj[currItem.rawStartTime]) {
      suggestObj[currItem.rawStartTime] = true
      this.add(timeZone, currItem.rawStartTime, currItem.rawEndTime)
    }

    return this.recurseToFindSuggest(availArr, timeZone, currItem, suggestObj)
  }

  generateThreeSeperatedAvail(availArr, timeZone) {
    availArr = this.buildTestSuggestions(availArr, timeZone)

    if (availArr.length <= 3) {
      // could have only one/two/three items in availArr
      availArr.forEach(currItem => {
        this.add(timeZone, currItem.rawStartTime, currItem.rawEndTime)
      })

      return this.sortSuggestsChronologically(this.get())
    }

    this.recurseToFindSuggest(availArr, timeZone, '', {})

    return this.sortSuggestsChronologically(this.get())
  }

  add(timeZone, availStart, availEnd) {

    this.suggestionArr.push({
      localTime: `${timeZone}: ${moment(Time.localTime(availStart, timeZone), 'DD-MM-YYYY hh:mm:ss a').format('hh:mm:ss a')} - ${moment(Time.localTime(availEnd, timeZone), 'DD-MM-YYYY hh:mm:ss a').format('hh:mm:ss a')}`,

      UTC: `UTC: ${availStart} - ${availEnd}`,

      rawStartTime: availStart,

      rawEndTime: availEnd,
    })
  }

  testAdd(timeZone, availStart, availEnd) {
    return {
      localTime: `${timeZone}: ${moment(Time.localTime(availStart, timeZone), 'DD-MM-YYYY hh:mm:ss a').format('hh:mm:ss a')} - ${moment(Time.localTime(availEnd, timeZone), 'DD-MM-YYYY hh:mm:ss a').format('hh:mm:ss a')}`,

      UTC: `UTC: ${availStart} - ${availEnd}`,

      rawStartTime: availStart,
      rawEndTime: availEnd,
    }

  }

  replaceSuggestions(chronSuggestions) {
    this.suggestionArr = chronSuggestions
    return this.suggestionArr
  }

  get() { return this.suggestionArr}

  selectRandomStartTimes(startTimesArr) {

    let randomStartTime = {
      Obj: {},
      Arr: [],
    }

    const randomIntFromInterval = (min, max) => {
      max = max - 1
      return Math.floor(Math.random() * (max - min + 1) + min)
    }

    const recurseToSelectTimes = (origStartTimeArr, randomStartTimeArr, randomStartTimeObj) => {

      if (randomStartTimeArr.length === 3) {
        return randomStartTimeArr
      }

      let i = randomIntFromInterval(0, origStartTimeArr.length)

      if (!randomStartTimeObj[origStartTimeArr[i]]) {
        randomStartTimeObj[origStartTimeArr[i]] = true
        randomStartTimeArr.push(origStartTimeArr[i])
      }

      return recurseToSelectTimes(origStartTimeArr, randomStartTimeArr, randomStartTimeObj)
    }

    return recurseToSelectTimes(startTimesArr, randomStartTime.Arr, randomStartTime.Obj)
  }

}

module.exports = CreateSuggestion
