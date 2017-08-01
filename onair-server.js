require("/home/pi/OnAirLamp/onair-config.js");

var pubnub = require("/usr/local/lib/node_modules/pubnub/node.js/pubnub.js")(pubnubConfig);

var callTracking = [];
var activeCalls = 0;
var gpio = require("/usr/local/lib/node_modules/pi-gpio/pi-gpio.js");

var alertInProgress = false;

gpio.close(11);
gpio.open(11, "output");

/* ---------------------------------------------------------------------------
 Listen for Messages
 --------------------------------------------------------------------------- */
pubnub.subscribe({
    channel: "my_channel",
    callback: function (message) {

        var moment = require("/usr/local/lib/node_modules/moment/moment.js");

        console.log(" > ", moment().format(), "DATA:", JSON.stringify(message));

        var commandMessage = {};
        if (typeof message === 'string' || message instanceof String)
            commandMessage = JSON.parse(message);
        else
            commandMessage = message;

        if (commandMessage.oncall !== undefined && commandMessage.phoneNumber !== undefined) {

            activeCalls = 0;

            callTracking[commandMessage.phoneNumber] = commandMessage.oncall;

            for (var phoneNumber in callTracking) {
                if (callTracking.hasOwnProperty(phoneNumber)) {
                    if (callTracking[phoneNumber]) {
                        console.log(" > ", moment().format(), "Active Call:", phoneNumber);
                        activeCalls++;
                    }
                }
            }

            console.log(" > ", moment().format(), "Active Call Count:", activeCalls);

            if ((commandMessage.oncall && activeCalls == 1)
                || !commandMessage.oncall && activeCalls == 0) {
                console.log(" > ", moment().format(), "Turning lamp", activeCalls > 0 ? "on" : "off");
                gpio.write(11, activeCalls > 0 ? 1 : 0);
            }
        }
        else if (commandMessage.alert !== undefined && !alertInProgress) {

            console.log(" > ", moment().format(), " Alert recieved");
            alertInProgress = true;

            var timesRun = 0;
            var interval = setInterval(function () {
                gpio.write(11, timesRun % 2);
                console.log(" > ", moment().format(), "Flashing lamp", timesRun % 2 > 0 ? "on" : "off");

                if (timesRun === 10) {
                    clearInterval(interval);
                    //restore light state
                    console.log(" > ", moment().format(), "Turning lamp", activeCalls > 0 ? "on" : "off");
                    gpio.write(11, activeCalls > 0 ? 1 : 0);
                    alertInProgress = false;
                }
                timesRun += 1;
            }, 500);
        }
        else if (commandMessage.reset !== undefined) {
            activeCalls = 0;
            callTracking = [];
            gpio.write(11, activeCalls > 0 ? 1 : 0);
        }
        else if (commandMessage.info !== undefined) {
            //publish info (IP) to channel
            console.log(" > ", moment().format(), " Info request recieved");

            pubnub.publish({
                channel   : 'my_channel',
                message   : "{\"ipAddress\": \"" + getIpAddress() + "\"}",
                callback  : function(e) { console.log(" > ", moment().format(), " Info published"); },
                error     : function(e) { console.log(" > ", moment().format(), " ERROR: Info publish failed", e ); }
            });
        }
    }
});

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
                console.log(" > ", moment().format(), ifname + ':' + alias, ipAddress);
            } else {
                // this interface has only one ipv4 adress
                console.log(" > ", moment().format(), ifname, ipAddress);
            }
            ++alias;
        });
    });

    return ipAddress;
}
