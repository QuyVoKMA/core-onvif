const chalk = require('chalk');
const moment = require('moment')
const childProcess = require('child_process')
const path = require('path')
const FileHandler = require('./fileHandler')

const fh = new FileHandler()

const RTSPRecorder = class {
  constructor(config = {}) {
    this.config = config
    this.name = config.name
    this.url = config.url
    this.timeLimit = config.timeLimit || 60
    this.folder = config.folder+'/record' || 'media/'
    this.categoryType = config.type || 'video'
    this.directoryPathFormat = config.directoryPathFormat || 'MMM-Do-YY'
    this.fileNameFormat = config.fileNameFormat || 'YYYY-M-D-h-mm-ss'
    fh.createDirIfNotExists(this.folder)
    fh.createDirIfNotExists(this.getDirectoryPath())
    fh.createDirIfNotExists(this.getTodayPath())
  }

  getDirectoryPath() {
    return path.join(this.folder, (this.name ? this.name : ''))
  }

  getTodayPath() {
    return path.join(this.getDirectoryPath(), moment().format(this.directoryPathFormat))
  }

  getMediaTypePath() {
    //return path.join(this.getTodayPath(), this.categoryType)
    return path.join(this.getTodayPath())
  }

  getFilename(folderPath) {
    return path.join(folderPath, moment().format(this.fileNameFormat) + this.getExtenstion())
  }

  getExtenstion() {
    if (this.categoryType === 'audio') {
      return '.avi'
    }
    if (this.categoryType === 'image') {
      return '.jpg'
    }

    return '.mp4'
  }

  getArguments() {
    if (this.categoryType === 'audio') {
      return ['-vn', '-acodec', 'copy']
    }
    if (this.categoryType === 'image') {
      return ['-vframes', '1']
    }
    return ['-acodec', 'copy', '-vcodec', 'copy']
  }

  getChildProcess(fileName) {
    var args = ['ffmpeg', '-rtsp_transport','tcp','-i', this.url]
    const mediaArgs = this.getArguments()
    mediaArgs.forEach((item) => {
    args.push(item)
    });
    args.push(fileName)
    console.log(this.logTime(), process.pid, chalk.bold.green('[INFO]'),'[args]',args.join(' '))
    return childProcess.exec(args.join(' '), function(err, stdout, stderr) {})
  }

  stopRecording() {
    this.disableStreaming = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.writeStream) {
      this.killStream()
    }
    const folderPath = this.getMediaTypePath()
    const fileName = this.getFilename(folderPath)
    console.log(this.logTime(), process.pid, chalk.bold.green('[RECORD]'),'Recording saved in (' + fileName + ')');
  }

  startRecording() {
    if (!this.url) {
      console.log(this.logTime(), process.pid, chalk.bold.red('[ERROR]'),'URL Not Found. ')
      return true
    }
    this.recordStream()
  }

  captureImage(cb) {
    this.writeStream = null
    const folderPath = this.getMediaTypePath()
    fh.createDirIfNotExists(folderPath)
    const fileName = this.getFilename(folderPath)
    this.writeStream = this.getChildProcess(fileName)
    this.writeStream.once('exit', () => {
      if (cb) {
        cb()
      }
    })
  }

  killStream() {
    //this.writeStream.kill()
    this.writeStream.stdin.write('q')
  }

  logTime = () => {
    let nowDate = new Date();
    return nowDate.toLocaleDateString() + ' ' + nowDate.toLocaleTimeString([], { hour12: false });
  }

  recordStream() {
    if (this.categoryType === 'image') {
      return
    }
    const self = this
    if (this.timer) {
      clearTimeout(this.timer)
    }

    if (this.writeStream && this.writeStream.binded) {
      return false
    }

    if (this.writeStream && this.writeStream.connected) {
      this.writeStream.binded = true
      this.writeStream.once('exit', () => {
        self.recordStream()
      })
      this.killStream()
      return false
    }

    this.writeStream = null
    const folderPath = this.getMediaTypePath()
    fh.createDirIfNotExists(folderPath)
    const fileName = this.getFilename(folderPath)
    this.writeStream = this.getChildProcess(fileName)

    this.writeStream.once('exit', () => {
      if (self.disableStreaming) {
        return true
      }
      self.recordStream()
    })
    this.timer = setTimeout(self.killStream.bind(this), this.timeLimit * 1000)
    console.log(this.logTime(), process.pid, chalk.bold.red('[RECORD]'),'Recording saved in (' + fileName + ')');
  }
}

module.exports = RTSPRecorder