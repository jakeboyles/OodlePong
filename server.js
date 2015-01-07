var
    path = require('path'),
    net = require('net'),
    chalk = require('chalk'),
    jade = require('jade'),
    serveStatic = require('serve-static'),
    environment = process.env.NODE_ENV = process.env.NODE_ENV || 'development',
    app = require('./app.js'),
    cardReader = require('./lib/cardReader'),
    Slack = require('node-slack');
    leaderboard = require('./lib/leaderboard');

getConfig = require('./config');
config = getConfig[environment];
settings = getConfig.global;

app.set('settings', settings);
app.engine('jade', jade.__express);
app.use(serveStatic('./ui/public'));
app.locals.config = config;
app.locals.settings = settings;



_ = require('underscore');
io = require('socket.io');
moment = require('moment');
spark = require('sparknode');
core = new spark.Core(settings.sparkCore);

gameController = require('./classes/gameController');

game = {};
player = {};

// Setup socketio
io = io.listen(config.wsPort);

domain = "--oodle--";
webhookToken = "--https://hooks.slack.com/services/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--";

slack = new Slack(webhookToken, domain);


// io.set('origins', config.wsPort);


console.log(chalk.green('Websocket Server: Listening on port ' + config.wsPort));



// io.configure(function() {
//     io.set('log level', 2);
// });

app.get('/', function(req, res) {
    
    delete require.cache[path.resolve('./versions/js.json')];
    delete require.cache[path.resolve('./versions/css.json')];
    
    res.render('home.jade', {
        title: 'Ping Pong',
        metaDesc: 'Ping Pong',
        JSVersions: require('./versions/js'),
        CSSVersions: require('./versions/css')
    });
    
});

app.get('/leaderboard', function(req, res) {
    // This could use a streaming response instead
    leaderboard.get(10)
        .then(function(players) {
            res.json(players.toJSON());
        });
});

app.listen(config.clientPort);
console.log(chalk.green('Web Server: Listening on port ' + config.clientPort));

game = new gameController();

game.addPlayerByRfid('1');
game.addPlayerByRfid('2');

game.feelersPingReceived();

io.sockets.on('connection', function(client) {
    console.log("connectd");
    game.reset();
    game.clientJoined();
    cardReader.connectionStatus();
    client.on('fakeScored', game.feelerPressed); // Fake score event for easier testing
    game.addPlayerByRfid('1');
    game.addPlayerByRfid('2');
});

core.on('scored', game.feelerPressed);
core.on('ping', game.feelersPingReceived);    
core.on('batteryLow', game.batteryLow);

core.on('online', function() {
    game.feelersOnline();
    game.feelerStatus();
    game.feelersPingReceived();
    console.log("TEST");
});

cardReader.on('read', function(data) {
    console.log('New read', data);
    game.addPlayerByRfid(data.rfid);
});




process.on('uncaughtException', function (err) {
    console.log(err);
});

cardReader.on('err', game.cardReadError);

cardReader.on('connect', function() {
    io.sockets.emit('cardReader.connect');
});

cardReader.on('disconnect', function() {
    io.sockets.emit('cardReader.disconnect');
});