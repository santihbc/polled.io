var express = require('express'),
	bodyParser = require('body-parser'),
	hbs = require('hbs'),
	path = require('path'),
	cors = require('cors'),
	mongodb = require('mongodb'),
	mongoose = require('mongoose'),
	app = express(),
	port = process.env.PORT || 8000;


/**
 * MongoDB Setup
 */
var mongoUri = 'mongodb://localhost/poll';

app.configure('production', function() {
	mongoUri = process.env.MONGOLAB_URI;
});

app.db = mongoose.connect(mongoUri);


/**
 * App Config Setup
 */
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(bodyParser.json());
app.use(cors());
app.use(express.cookieParser());

app.set('views', __dirname + '/public');
app.set('view engine', 'html');
app.engine('html', hbs.__express);
app.use(express.static(path.join(__dirname, 'public')));

app.configure('development', function() {
	app.use(express.errorHandler());
});

app.configure('production', function() {
	app.use(function(err, req, res, next) {
		console.error(err);
		res.send(500, 'Sorry, there\'s been an error!');
	});
});


/**
 * Routes
 */
var routes = {
	index: require('./routes/index.js'),
	poll: require('./routes/poll.js'),
};

/**
 * Routing
 */

//Poll
app.get('/api/poll/:url', routes.poll.getPoll);
app.post('/api/poll', routes.poll.createPoll);
app.put('/api/poll/:url', function(req, res, next) {
	routes.poll.savePoll(req, res, function(poll) {
		io.sockets.in(req.headers.referer).emit('voted', poll);
	});
});

//Direct all normal traffic to / and allow backbone to dictate navigation.
app.use(function(req, res, next){ return res.render('index'); });

//404
app.use(function(req, res, next) {
	res.status(404);

	if (req.accepts('html')) {
		res.render('404', {
			url: req.url
		});
		return;
	}

	res.type('txt').send('Not found');
});


/**
 * Server setup
 */
var server = app.listen(port, function() {
	var host = server.address().address,
		port = server.address().port;
	console.log('Poll app listening at http://%s:%s', host, port);
});


/**
 * Socket IO setup
 */
var io = require('socket.io')(server);

/**
 * The sockets are set up so when a user connects, they join a socket.io 'room' of their requested URL.
 * A connection is only made when a user sends a GET request to /api/poll. This is triggered via /poll/:url.
 * So an example 'room' would be: http://polled.io/poll/udwkwa
 *
 * All users that view the URL join that room, so when a poll is sent a PUT request, a 'voted' event is emited to everyone
 * viewing that poll, because the PUT's request URL is passed in as the room to trigger. .join() can be viewed as, everyone on the
 * same web page.
 */
io.sockets.on('connection', function (socket) {
	socket.join(socket.handshake.headers.referer);

    socket.on('disconnect', function() {
    	socket.leave(socket.handshake.headers.referer);
    });
});
