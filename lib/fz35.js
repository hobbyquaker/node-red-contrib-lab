const {EventEmitter} = require('events');
const SerialPort = require('serialport');
const ParserDelimiter = require('@serialport/parser-delimiter');

module.exports = class Fz35 extends EventEmitter {
    constructor(options) {
        super();

        this.port = new SerialPort(options.port, {
            baudRate: 9600
        });

        this.parser = this.port.pipe(new ParserDelimiter({delimiter: '\r\n'}));
        this.ready = false;

        this.lasterror = null;

        this.port.on('error', error => {
            this.emit('error', error)
        });

        this.parser.on('data', data => {
            //console.log(data, data.toString());
            this.parse(data.toString());
        });



        setInterval(() => {
            const now = (new Date()).getTime();
            if (now - this.lastData > 1020) {
                this.port.close((e) => {
                    console.log('fz35 close', e && e.message);
                    this.port.open((e) => {
                        console.log('fz35 open', e && e.message);
                    });
                });
                //this.command('start')//.then(() => this.command('start'));
            }
        }, 1000);

        this.port.on('open', (e) => {
            this.portOpen = true;
            this.values = {};
            console.log('fz35 open', e && e.message);
            this.command('read').then(() => this.command('start')).then(() => {
                if (!this.ready) {
                    this.ready = true;
                    this.emit('ready');
                }
            });
        });

        this.port.on('close', (e) => {
            console.log('fz35 close', e && e.message)
            this.portOpen = false;
        })
    }

    command(data) {
        //console.log('command', data);
        if (this.commandPending) {
            return Promise.reject(new Error('command pending'));
        }

        return new Promise((resolve, reject) => {
            this.callback = error => {
                clearTimeout(this.timeout);
                delete this.callback;
                if (error) {
                    reject(error);
                } else {
                    if (data === 'on') {
                        this.resetProtections();
                    }

                    resolve();
                }

                this.commandPending = false;
            };

            this.commandPending = true;
            this.port.write(data);

            this.timeout = setTimeout(() => {
                this.callback(new Error('timeout ' + data));
            }, 2000);
        });
    }

    resetProtections() {
        ['lvp', 'ocp', 'ovp', 'opp', 'oah', 'oap'].forEach(key => {
            if (this[key]) {
                this[key] = false;
                this.emit('protection', '');
            }
        });
    }

    parse(data) {
        let match = data.match(/([\d.]+)V,([\d.]+)A,([\d.]+)Ah,([\d:]+)/);
        if (match) {
            const [, voltage, current, capacity, time] = match;
            if (current > 0 && !this.protectionTimer) {
                this.resetProtections();
            }

            const newValues = {
                voltage: Number.parseFloat(voltage, 10),
                current: Number.parseFloat(current, 10),
                capacity: Number.parseFloat(capacity, 10),
                time
            };

            let change = false;
            Object.keys(newValues).forEach(key => {
                if (newValues[key] !== this.values[key]) {
                    this.values[key] = newValues[key];
                    change = true;
                }
            });
            if (change) {
                this.emit('data', this.values);
            }

            this.lastData = (new Date()).getTime();
        } else if (data === 'sucess' || data === 'ok') { // typo by intention!
            if (this.callback) {
                this.callback();
            }
        } else if (data === 'fail') {
            //console.log('fail!');
        } else {
            match = data.match(/OVP:([\d.]+), OCP:([\d.]+), OPP:([\d.]+), LVP:([\d.]+),OAH:([\d.]+),OHP:([\d:]+)/);
            if (match) {
                const [, ovp, ocp, opp, lvp, oah, ohp] = match;
                this.emit('settings', {ovp, ocp, opp, lvp, oah, ohp});
                if (this.callback) {
                    this.callback();
                }
            } else if (data === 'LVP') {
                this.lvp = true;
                this.emit('protection', 'lvp');
            } else if (data === 'OCP') {
                this.ocp = true;
                this.emit('protection', 'ocp');
            } else if (data === 'OVP') {
                this.ovp = true;
                this.emit('protection', 'ovp');
            } else if (data === 'OPP') {
                this.opp = true;
                this.emit('protection', 'opp');
            } else if (data === 'OAH') {
                this.oah = true;
                this.emit('protection', 'oah');
            } else if (data === 'OAP') {
                this.oap = true;
                this.emit('protection', 'oap');
            } else {
                //console.log('Unhandled data:', JSON.stringify(data));
            }

            if (['LVP', 'OVP', 'OCP', 'OPP', 'OAH', 'OAP'].includes(data)) {
                clearTimeout(this.protectionTimer);
                this.protectionTimer = setTimeout(() => {
                    this.protectionTimer = null;
                }, 1000);
            }
        }
    }
};

