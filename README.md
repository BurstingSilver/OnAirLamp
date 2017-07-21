# OnAirLamp
The Bursting Silver On Air Lamp was created to indicate when one or more people is/are on the phone in the Toronto offices. Employees use an app on their phone which determines if they are in the office and monitors the call state and sends messages to a PubNub channel when a call starts or ends. Node.js is used on a internet connected Raspberry Pi which is physically connected to a studio style "On Air" lamp. The "onair-server.js" script runs at boot and monitors a PubNub channel for messages containing a variety of different commands.

## Commands

**oncall** - *boolean* - indicates whether a call is starting or stopping, this is coupled with a required phoneNumber variable containing the phone number of the employee phone

`{"oncall": true, "phoneNumber": "123-456-7890"}`

**alert** - *boolean* - flashes the light on/off 5 times

`{"alert": true}`

**info** - *boolean* - publishes info about the Raspberry Pi to the PubNub channel, currently the only information sent is the assigned IP address of the Pi

`{"info": true}`

**reset** - *boolean* - resets the call log hash table and the active calls counter

`{"reset": true}`

