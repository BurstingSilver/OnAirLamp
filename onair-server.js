var pubnubConfig = require("./onair-config.js");

var PubNub = require("pubnub");
var moment = require("moment");
var gpio = require("rpi-gpio");

var pubnub = new PubNub(pubnubConfig);
var callTracking = [];
var activeCalls = 0;
var alertInProgress = false;

const gpioPin = 11;
const channelName = "my_channel";

var supportedCommands = {
    callStatus : {name: "callStatus", parameters: {oncall: "oncall", phoneNumber: "phoneNumber"}},
    alert : "alert",
    reset : "reset",
    info : "info",
};

function init() {
    initializeGPIO();
    subscribeToChannel();
}

function initializeGPIO() {
    writeLog("Initializing GPIO.");
    gpio.setup(gpioPin, gpio.DIR_OUT, togglePin);
}

function subscribeToChannel() {
    writeLog("Adding PubNub listener.");
    pubnub.addListener({
        status: function(statusEvent) {
            if (statusEvent.category === "PNConnectedCategory") {
                publishIpAddress();
            }
        },
        message: function(message) {
            onMessageReceived(message);
        },
        presence: function(presenceEvent) {
            // handle presence
        }
    });

    writeLog("Subscribing to PubNub channel.");
    pubnub.subscribe({
        channels: [channelName] 
    });
}
 
function togglePin(pinOn) {
    gpio.write(gpioPin, pinOn, function(err) {
        if (err) throw err;
    });
}

function turnLampOn() {
    togglePin(true);
}

function turnLampOff() {
    togglePin(false);
}

function writeLog(message) {
    console.log(" > ", moment().format(), " ", message);
}

function onMessageReceived(message) {
    writeLog("DATA: " + JSON.stringify(message));

    if (typeof message.message === "string" || message.message instanceof String)
        message = JSON.parse(message.message);

    if (message.command === undefined) message = convertLegacyMessage(message);

    switch (message.command) {
        case supportedCommands.callStatus.name:
            handleCallStatus(message);
            break;
        case supportedCommands.alert:
            handleAlert();
            break;
        case supportedCommands.reset:
            handleReset();
            break;
        case supportedCommands.info:
            handleInfo();
            break;
        default:
            writeLog("ERROR: Unsupported \"" + message.command + "\" command recieved");
            break;
    }
}

function convertLegacyMessage(message) {
    writeLog("Converting legacy message: " + JSON.stringify(message));
    var newMessage = {
        command : "",
        parameters: []
    };

    if (message.oncall !== undefined && message.phoneNumber !== undefined) {
        writeLog("Converting oncall message");
        newMessage.command = supportedCommands.callStatus;
        newMessage.parameters[supportedCommands.callStatus.parameters.oncall] = message.oncall;
        newMessage.parameters[supportedCommands.callStatus.parameters.phoneNumber] = message.phoneNumber;
    }
    else if (message.alert !== undefined) {
        writeLog("Converting alert message");
        newMessage.command = supportedCommands.alert;
    }
    else if (message.reset !== undefined) {
        writeLog("Converting reset message");
        newMessage.command = supportedCommands.reset;
    }
    else if (message.info !== undefined) {
        writeLog("Converting info message");
        newMessage.command = supportedCommands.info;
    }

    writeLog("New message: " + JSON.stringify(newMessage));
    return newMessage;
}

function handleCallStatus(message) {
    writeLog("Call status command recieved");

    var oncall = message.parameters[supportedCommands.callStatus.parameters.oncall];
    var phoneNumber = message.parameters[supportedCommands.callStatus.parameters.phoneNumber];

    activeCalls = 0;

    callTracking[phoneNumber] = oncall;

    for (var phoneNumber in callTracking) {
        if (callTracking.hasOwnProperty(phoneNumber)) {
            if (callTracking[phoneNumber]) {
                writeLog("Active Call:", phoneNumber);
                activeCalls++;
            }
        }
    }

    writeLog("Active Call Count:", activeCalls);

    if ((command.oncall && activeCalls == 1)
        || !command.oncall && activeCalls == 0) {
        writeLog("Turning lamp", activeCalls > 0 ? "on" : "off");
        if (activeCalls > 0)
            turnLampOn();
        else
            turnLampOff();
    }
}

function handleAlert() {
    writeLog("Alert command recieved");

    if (alertInProgress) {
        writeLog("There is already an Alert in progress!");
        return;
    }

    alertInProgress = true;

    var timesRun = 0;
    var interval = setInterval(function () {
        if (timesRun % 2 > 0 )
            turnLampOn();
        else
            turnLampOff();

        writeLog("Flashing lamp " + timesRun % 2 > 0 ? "on" : "off");

        if (timesRun === 10) {
            clearInterval(interval);
            //restore light state
            writeLog("Turning lamp " + activeCalls > 0 ? "on" : "off");
            if (activeCalls > 0)
                turnLampOn();
            else
                turnLampOff();
            alertInProgress = false;
        }
        timesRun += 1;
    }, 500);
}

function handleInfo() {
    writeLog("Info command recieved");
    publishIpAddress();
}

function publishIpAddress() {
    writeLog("Publish IP Address.");
    pubnub.publish({
        channel   : channelName,
        message   : "{\"ipAddress\": \"" + getIpAddress() + "\"}",
        callback  : function(e) { writeLog(" Info published"); },
        error     : function(e) { writeLog(" ERROR: Info publish failed", e ); }
    });
}

function handleReset() {
    writeLog("Reset command recieved");

    //reset active call count and call tracking hashtable
    activeCalls = 0;
    callTracking = [];
    gpio.write(11, activeCalls > 0 ? 1 : 0);
}

function getIpAddress() {

    var os = require('os');
    var ifaces = os.networkInterfaces();
    var ipAddress;

    Object.keys(ifaces).forEach(function (ifname) {
        var alias = 0;

        ifaces[ifname].forEach(function (iface) {
            if ('IPv4' !== iface.family || iface.internal !== false) {
            // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
            return;
            }

            ipAddress = iface.address;

            if (alias >= 1) {
                // this single interface has multiple ipv4 addresses
                writeLog(ifname + ':' + alias, ipAddress);
            } else {
                // this interface has only one ipv4 adress
                writeLog(ifname, ipAddress);
            }
            ++alias;
        });
    });

    return ipAddress;
}

init();
