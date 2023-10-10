
const { error } = require('console');
var app = require('express')()
var server = require('http').Server(app)
var	Cam = require('./lib/onvif/onvif').Cam
const io = require('socket.io')(server)
const rtsp = require('./lib/ffmpef/rtsp-ffmpeg')
const Recorder = require('./lib/recoder/index').Recorder


var camDetails= new Cam({
	hostname: "172.17.1.131",
	username: "admin",
	password: "admin",
	port: "2000"
}, function(err) {
	if (err) {
		console.log(err);
		return;
	}
	console.log('CONNECTED');
});

server.listen(6147, function(){
	console.log('Listening on localhost:6147');
});


var cams = [
	
		'rtsp://' + camDetails.hostname +':554/live/av0',
		
	].map(function(uri, i) {
		var stream = new rtsp.FFMpeg({input: uri, resolution: '1920x1080', quality: 3});
		stream.on('start', function() {
			console.log('stream ' + i + ' started');
		});
		stream.on('stop', function() {
			console.log('stream ' + i + ' stopped');
		});
		return stream;
	});

cams.forEach(function(camStream, i) {
	var ns = io.of('/cam' + i);
	ns.on('connection', function(wsocket) {
		console.log('connected to /cam' + i);
		var pipeStream = function(data) {
			wsocket.emit('data', data);
		};
		camStream.on('data', pipeStream);
		wsocket.on('disconnect', function() {
			console.log('disconnected from /cam' + i);
			camStream.removeListener('data', pipeStream);
		});
	});
});

io.on('connection', function(socket) {
	socket.emit('start', cams.length);
});

app.get('/', function (req, res) {
	res.sendFile(__dirname + '/index.html');
});


 
var rec = new Recorder({
    url: 'rtsp://172.17.1.131:554/live/av0',
    timeLimit: 60, // time in seconds for each segmented video file
    folder: './video',
    name: 'cam1',
})
// Starts Recording
rec.startRecording();

setTimeout(() => {
    console.log('Stopping Recording')
    rec.stopRecording()
    rec = null
}, 300000)