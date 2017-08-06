var pubnubConfig = require("./onair-config.js");

var PubNub = require("pubnub");
var moment = require("moment");
var gpio = require("pi-gpio");

var pubnub = new PubNub(pubnubConfig);
var callTracking = [];
var activeCalls = 0;
var alertInProgress = false;

const channelName = "my_channel";

const supportedCommands = {
    callStatus : {name: "callStatus", parameters: {oncall: "oncall", phoneNumber: "phoneNumber"}},
    alert : "alert",
    reset : "reset",
    info : "info",
};

function init() {
    initializeGPIO();
    pubnub.subscribe({
        channel: channelName,
        callback: onMessageReceived
    });
}

function initializeGPIO() {
    gpio.close(11);
    gpio.open(11, "output");
}

function turnLampOn() {
    gpio.write(11, 1);
}

function turnLampOff() {
    gpio.write(11, 0);
}

function writeLog(message) {
    console.log(" > ", moment().format(), message);
}

function onMessageReceived(message) {
    writeLog("DATA: " + JSON.stringify(message));

    if (typeof message === "string" || message instanceof String)
        message = JSON.parse(message);

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
    var newMessage = {
        command : "",
        parameters: []
    };

    if (message.oncall !== undefined && message.phoneNumber !== undefined) {
        newMessage.command = supportedCommands.callStatus;
        newMessage.parameters[supportedCommands.callStatus.parameters.oncall] = message.oncall;
        newMessage.parameters[supportedCommands.callStatus.parameters.phoneNumber] = message.phoneNumber;
    }
    else if (message.alert !== undefined) {
        newMessage.command = supportedCommands.alert;
    }
    else if (message.reset !== undefined) {
        newMessage.command = supportedCommands.reset;
    }
    else if (message.info !== undefined) {
        newMessage.command = supportedCommands.info;
    }
    return newMessage;
}

function handleCallStatus(message) {
    writeLog(" Call status command recieved");

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
    writeLog(" Alert command recieved");

    if (alertInProgress) {
        writeLog(" There is already an Alert in progress!");
        return;
    }

    alertInProgress = true;

    var timesRun = 0;
    var interval = setInterval(function () {
        if (timesRun % 2 > 0 )
            turnLampOn();
        else
            turnLampOff();

        writeLog("Flashing lamp", timesRun % 2 > 0 ? "on" : "off");

        if (timesRun === 10) {
            clearInterval(interval);
            //restore light state
            writeLog("Turning lamp", activeCalls > 0 ? "on" : "off");
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
    writeLog(" Info command recieved");

    //publish info (IP) to channel
    pubnub.publish({
        channel   : channelName,
        message   : "{\"ipAddress\": \"" + getIpAddress() + "\"}",
        callback  : function(e) { writeLog(" Info published"); },
        error     : function(e) { writeLog(" ERROR: Info publish failed", e ); }
    });
}

function handleReset() {
    writeLog(" Reset command recieved");

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
